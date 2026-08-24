using System.Globalization;
using System.Text;
using System.Text.Json;
using Dapper;
using Npgsql;
using PatientApi.Models;
using PatientApi.Repositories;

namespace PatientApi.Sync;

public sealed class BookingHisMatchWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<BookingHisMatchWorker> logger) : BackgroundService
{
    private readonly string _workerId = $"{Environment.MachineName}-booking-match-{Guid.NewGuid():N}";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("PatientPortal:EnableBookingHisMatchWorker", false))
        {
            logger.LogInformation("Booking HIS match worker is disabled.");
            return;
        }

        var connectionString = GetBookingConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            logger.LogWarning("Booking HIS match worker is enabled but BookingDatabase/BOOKING_DATABASE_URL is not configured.");
            return;
        }

        var intervalSeconds = Math.Clamp(configuration.GetValue("PatientPortal:BookingHisMatchIntervalSeconds", 60), 10, 600);
        logger.LogInformation("Booking HIS match worker started with interval {IntervalSeconds}s.", intervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var didWork = await ProcessBatchAsync(connectionString, stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(didWork ? 2 : intervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Booking HIS match polling cycle failed.");
                await Task.Delay(TimeSpan.FromSeconds(Math.Min(intervalSeconds, 30)), stoppingToken);
            }
        }
    }

    private string? GetBookingConnectionString()
    {
        var configured = configuration.GetConnectionString("BookingDatabase")
            ?? configuration.GetConnectionString("PortalBooking")
            ?? configuration["BOOKING_DATABASE_URL"];
        return NormalizePostgresConnectionString(configured);
    }

    private async Task<bool> ProcessBatchAsync(string connectionString, CancellationToken cancellationToken)
    {
        var batchSize = Math.Clamp(configuration.GetValue("PatientPortal:BookingHisMatchBatchSize", 25), 1, 100);
        List<PendingBooking> bookings;
        await using (var connection = new NpgsqlConnection(connectionString))
        {
            bookings = (await connection.QueryAsync<PendingBooking>(new CommandDefinition(
            """
            select
              id as "Id",
              ma_lich_hen as "BookingCode",
              ho_ten as "FullName",
              so_dien_thoai as "Phone",
              ngay_kham as "AppointmentDate",
              gio_kham as "AppointmentTime",
              khoa_kham as "DepartmentName",
              old_patient_code as "OldPatientCode",
              patient_code as "PatientCode",
              status as "Status"
            from portal.lich_hen_kham
            where coalesce(his_match_status, 'PENDING') in ('PENDING', 'RETRY')
              and coalesce(his_match_next_check_at, now() - interval '1 second') <= now()
              and ngay_kham >= current_date - interval '1 day'
              and ngay_kham <= current_date + interval '14 days'
            order by ngay_kham, id
            limit @Limit;
            """,
            new { Limit = batchSize },
            cancellationToken: cancellationToken))).ToList();
        }

        if (bookings.Count == 0) return false;

        using var scope = scopeFactory.CreateScope();
        var oracle = scope.ServiceProvider.GetRequiredService<OracleHisPatientRepository>();

        foreach (var booking in bookings)
        {
            await MatchOneAsync(connectionString, oracle, booking, cancellationToken);
        }

        return true;
    }

    private async Task MatchOneAsync(
        string connectionString,
        OracleHisPatientRepository oracle,
        PendingBooking booking,
        CancellationToken cancellationToken)
    {
        var mabn = FirstNonEmpty(booking.OldPatientCode, booking.PatientCode);
        if (string.IsNullOrWhiteSpace(mabn))
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await MarkNeedsReviewAsync(connection, booking.Id, "Booking chưa có mã BN cũ nên không tự động đối soát HIS.", cancellationToken);
            return;
        }

        try
        {
            var registrations = await oracle.GetRegistrationsAsync(mabn, cancellationToken);
            var match = FindBestMatch(booking, registrations);

            if (match is null || match.Confidence < 70)
            {
                await using var connection = new NpgsqlConnection(connectionString);
                await MarkRetryAsync(connection, booking.Id, match?.Reason ?? "Chưa tìm thấy lượt TIEPDON phù hợp trong HIS.", cancellationToken);
                return;
            }

            await using (var connection = new NpgsqlConnection(connectionString))
            {
            await SaveMatchAsync(connection, booking, match, cancellationToken);
            }
            logger.LogInformation("Matched booking {BookingId}/{BookingCode} to HIS MABN {Mabn}, MAQL {Maql}.", booking.Id, booking.BookingCode, mabn, match.Registration.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Booking HIS match failed for booking {BookingId}/{BookingCode}.", booking.Id, booking.BookingCode);
            await using var connection = new NpgsqlConnection(connectionString);
            await MarkRetryAsync(connection, booking.Id, ex.Message, cancellationToken);
        }
    }

    private static BookingMatch? FindBestMatch(PendingBooking booking, IReadOnlyList<RegistrationDto> registrations)
    {
        BookingMatch? best = null;
        foreach (var registration in registrations)
        {
            var score = 0m;
            var reasons = new List<string>();

            if (booking.AppointmentDate is not null && registration.RegisteredAt.Date == booking.AppointmentDate.Value.Date)
            {
                score += 55;
                reasons.Add("trùng ngày khám");
            }

            if (!string.IsNullOrWhiteSpace(booking.DepartmentName) &&
                TextContains(registration.DepartmentName, booking.DepartmentName))
            {
                score += 25;
                reasons.Add("khớp phòng/khoa");
            }

            if (!string.IsNullOrWhiteSpace(registration.TicketNumber))
            {
                score += 10;
                reasons.Add("có STT khám");
            }

            if (!string.IsNullOrWhiteSpace(registration.Id))
            {
                score += 10;
                reasons.Add("có MAQL");
            }

            var candidate = new BookingMatch(registration, Math.Min(score, 100), string.Join(", ", reasons));
            if (best is null || candidate.Confidence > best.Confidence)
            {
                best = candidate;
            }
        }

        return best;
    }

    private static bool TextContains(string left, string right)
    {
        var a = NormalizeText(left);
        var b = NormalizeText(right);
        return a.Length > 0 && b.Length > 0 && (a.Contains(b, StringComparison.Ordinal) || b.Contains(a, StringComparison.Ordinal));
    }

    private static string NormalizeText(string value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(ch);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private async Task MarkNeedsReviewAsync(NpgsqlConnection connection, Guid bookingId, string reason, CancellationToken cancellationToken)
    {
        const string sql = """
            update portal.lich_hen_kham
            set his_match_status='NEEDS_REVIEW',
                his_match_reason=@Reason,
                his_match_checked_at=now(),
                his_match_attempt_count=his_match_attempt_count + 1,
                his_match_next_check_at=null
            where id=@BookingId;
            """;
        await connection.ExecuteAsync(new CommandDefinition(sql, new { BookingId = bookingId, Reason = reason }, cancellationToken: cancellationToken));
    }

    private async Task MarkRetryAsync(NpgsqlConnection connection, Guid bookingId, string reason, CancellationToken cancellationToken)
    {
        var retryMinutes = Math.Clamp(configuration.GetValue("PatientPortal:BookingHisMatchRetryMinutes", 5), 1, 120);
        const string sql = """
            update portal.lich_hen_kham
            set his_match_status='RETRY',
                his_match_reason=@Reason,
                his_match_checked_at=now(),
                his_match_attempt_count=his_match_attempt_count + 1,
                his_match_next_check_at=now() + make_interval(mins => @RetryMinutes)
            where id=@BookingId
              and coalesce(his_match_status, 'PENDING') <> 'MATCHED';
            """;
        await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            BookingId = bookingId,
            Reason = Truncate(reason, 1000),
            RetryMinutes = retryMinutes
        }, cancellationToken: cancellationToken));
    }

    private async Task SaveMatchAsync(NpgsqlConnection connection, PendingBooking booking, BookingMatch match, CancellationToken cancellationToken)
    {
        var registration = match.Registration;
        var payload = new
        {
            booking_code = booking.BookingCode,
            full_name = booking.FullName,
            appointment_date = booking.AppointmentDate?.ToString("yyyy-MM-dd"),
            appointment_time = booking.AppointmentTime,
            department_name = registration.DepartmentName,
            doctor_name = registration.DoctorName,
            ticket_number = registration.TicketNumber,
            mabn = FirstNonEmpty(booking.OldPatientCode, booking.PatientCode),
            mavaovien = registration.VisitId,
            maql = registration.Id,
            registered_at = ToUtcDateTime(registration.RegisteredAt)
        };

        const string sql = """
            update portal.lich_hen_kham
            set status=case when status in ('CHO_DUYET', 'CHO_HIS_XAC_NHAN') then 'DA_XAC_NHAN_HIS' else status end,
                his_match_status='MATCHED',
                his_mabn=@HisMabn,
                his_mavaovien=@HisMavaovien,
                his_maql=@HisMaql,
                his_stt_kham=@HisSttKham,
                his_makp=@HisMakp,
                his_department_name=@HisDepartmentName,
                his_doctor_name=@HisDoctorName,
                his_registered_at=@HisRegisteredAt,
                his_match_confidence=@MatchConfidence,
                his_match_reason=@MatchReason,
                his_match_checked_at=now(),
                his_match_attempt_count=his_match_attempt_count + 1,
                his_match_next_check_at=null,
                his_matched_at=now()
            where id=@AppointmentId;

            insert into portal.booking_his_matches (
              appointment_id, online_booking_code, online_patient_code,
              his_mabn, his_mavaovien, his_maql, his_stt_kham, his_makp,
              his_department_name, his_doctor_name, his_registered_at,
              match_status, match_confidence, match_reason, raw_his_json
            )
            values (
              @AppointmentId, @BookingCode, @OnlinePatientCode,
              @HisMabn, @HisMavaovien, @HisMaql, @HisSttKham, @HisMakp,
              @HisDepartmentName, @HisDoctorName, @HisRegisteredAt,
              'MATCHED', @MatchConfidence, @MatchReason, cast(@RawHisJson as jsonb)
            )
            on conflict (appointment_id) do update set
              online_booking_code=excluded.online_booking_code,
              online_patient_code=excluded.online_patient_code,
              his_mabn=excluded.his_mabn,
              his_mavaovien=excluded.his_mavaovien,
              his_maql=excluded.his_maql,
              his_stt_kham=excluded.his_stt_kham,
              his_makp=excluded.his_makp,
              his_department_name=excluded.his_department_name,
              his_doctor_name=excluded.his_doctor_name,
              his_registered_at=excluded.his_registered_at,
              match_status=excluded.match_status,
              match_confidence=excluded.match_confidence,
              match_reason=excluded.match_reason,
              raw_his_json=excluded.raw_his_json,
              updated_at=now();

            insert into portal.lich_hen_kham_history (
              appointment_id, action, performed_by, old_status, new_status, changed_fields
            )
            values (
              @AppointmentId, 'HIS_AUTO_MATCH', @WorkerId, @OldStatus, 'DA_XAC_NHAN_HIS', cast(@ChangedFieldsJson as jsonb)
            );

            insert into portal.notification_outbox (
              channel, recipient_phone, template_key, appointment_id, payload_json, status
            )
            select
              'zalo', @RecipientPhone, 'booking_his_confirmed', @AppointmentId, cast(@PayloadJson as jsonb), 'pending'
            where nullif(@RecipientPhone, '') is not null
            on conflict do nothing;
            """;

        await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            AppointmentId = booking.Id,
            BookingCode = booking.BookingCode,
            OnlinePatientCode = FirstNonEmpty(booking.OldPatientCode, booking.PatientCode),
            OldStatus = booking.Status,
            WorkerId = _workerId,
            RecipientPhone = booking.Phone ?? string.Empty,
            HisMabn = FirstNonEmpty(booking.OldPatientCode, booking.PatientCode),
            HisMavaovien = registration.VisitId,
            HisMaql = registration.Id,
            HisSttKham = registration.TicketNumber,
            HisMakp = registration.DepartmentCode,
            HisDepartmentName = registration.DepartmentName,
            HisDoctorName = registration.DoctorName,
            HisRegisteredAt = ToUtcDateTime(registration.RegisteredAt),
            MatchConfidence = match.Confidence,
            MatchReason = match.Reason,
            RawHisJson = JsonSerializer.Serialize(registration, JsonOptions),
            ChangedFieldsJson = JsonSerializer.Serialize(new
            {
                match_confidence = match.Confidence,
                match_reason = match.Reason,
                his = payload
            }, JsonOptions),
            PayloadJson = JsonSerializer.Serialize(payload, JsonOptions)
        }, cancellationToken: cancellationToken));
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        return values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();
    }

    private static DateTime ToUtcDateTime(DateTimeOffset value)
    {
        return value.ToUniversalTime().UtcDateTime;
    }

    private static string? NormalizePostgresConnectionString(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        var trimmed = value.Trim();
        if (!trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        var uri = new Uri(trimmed);
        var userInfo = uri.UserInfo.Split(':', 2);
        var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var database = uri.AbsolutePath.TrimStart('/');
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = string.IsNullOrWhiteSpace(database) ? "postgres" : Uri.UnescapeDataString(database),
            Username = username,
            Password = password,
            SslMode = SslMode.Require,
            Timeout = 60,
            CommandTimeout = 60,
            KeepAlive = 30,
            Pooling = false
        };

        foreach (var item in ParseQuery(uri.Query))
        {
            if (builder.Pooling &&
                item.Key.Equals("connection_limit", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(item.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var maxPoolSize) &&
                maxPoolSize > 0)
            {
                builder.MaxPoolSize = maxPoolSize;
            }
        }

        return builder.ConnectionString;
    }

    private static IEnumerable<KeyValuePair<string, string>> ParseQuery(string query)
    {
        var trimmed = query.TrimStart('?');
        if (string.IsNullOrWhiteSpace(trimmed)) yield break;

        foreach (var part in trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pieces = part.Split('=', 2);
            var key = Uri.UnescapeDataString(pieces[0]);
            var value = pieces.Length > 1 ? Uri.UnescapeDataString(pieces[1]) : "";
            yield return new KeyValuePair<string, string>(key, value);
        }
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength) return value;
        return value[..maxLength];
    }

    private sealed record PendingBooking(
        Guid Id,
        string? BookingCode,
        string? FullName,
        string? Phone,
        DateTime? AppointmentDate,
        string? AppointmentTime,
        string? DepartmentName,
        string? OldPatientCode,
        string? PatientCode,
        string? Status);

    private sealed record BookingMatch(RegistrationDto Registration, decimal Confidence, string Reason);
}
