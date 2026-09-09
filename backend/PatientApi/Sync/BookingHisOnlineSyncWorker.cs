using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using Npgsql;
using Oracle.ManagedDataAccess.Client;

namespace PatientApi.Sync;

public sealed class BookingHisOnlineSyncWorker(
    IConfiguration configuration,
    ILogger<BookingHisOnlineSyncWorker> logger) : BackgroundService
{
    private readonly string _workerId = $"{Environment.MachineName}-booking-his-online-{Guid.NewGuid():N}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("PatientPortal:EnableBookingHisOnlineSyncWorker", false))
        {
            logger.LogInformation("Booking HIS online sync worker is disabled.");
            return;
        }

        var bookingConnectionString = GetBookingConnectionString();
        if (string.IsNullOrWhiteSpace(bookingConnectionString))
        {
            logger.LogWarning("Booking HIS online sync worker is enabled but BookingDatabase/BOOKING_DATABASE_URL is not configured.");
            return;
        }

        var branchCode = NormalizeBranchCode(configuration["PatientPortal:BranchCode"]);
        if (branchCode is null)
        {
            logger.LogError("Booking HIS online sync worker requires PatientPortal:BranchCode=CN1 or CN3. Worker stopped to prevent cross-branch inserts.");
            return;
        }

        var oracleConnectionString = configuration.GetConnectionString("OracleHis");
        if (string.IsNullOrWhiteSpace(oracleConnectionString))
        {
            logger.LogWarning("Booking HIS online sync worker is enabled but ConnectionStrings:OracleHis is not configured.");
            return;
        }

        var intervalSeconds = Math.Clamp(configuration.GetValue("PatientPortal:BookingHisOnlineSyncIntervalSeconds", 30), 5, 600);
        logger.LogInformation("Booking HIS online sync worker started for branch {BranchCode} with interval {IntervalSeconds}s.", branchCode, intervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var didWork = await ProcessBatchAsync(bookingConnectionString, oracleConnectionString, branchCode, stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(didWork ? 2 : intervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Booking HIS online sync polling cycle failed.");
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

    private async Task<bool> ProcessBatchAsync(
        string bookingConnectionString,
        string oracleConnectionString,
        string branchCode,
        CancellationToken cancellationToken)
    {
        var batchSize = Math.Clamp(configuration.GetValue("PatientPortal:BookingHisOnlineSyncBatchSize", 25), 1, 100);
        List<OnlineBooking> bookings;

        await using (var connection = new NpgsqlConnection(bookingConnectionString))
        {
            bookings = (await connection.QueryAsync<OnlineBooking>(new CommandDefinition(
                """
                select
                  id as "Id",
                  ma_lich_hen as "BookingCode",
                  ho_ten as "FullName",
                  so_dien_thoai as "Phone",
                  email as "Email",
                  ngay_sinh as "BirthDate",
                  gioi_tinh as "Gender",
                  dia_chi as "Address",
                  "soCCCD_encrypt" as "CitizenIdEncrypted",
                  ngay_kham as "AppointmentDate",
                  gio_kham as "AppointmentTime",
                  khoa_kham as "DepartmentName",
                  trieu_chung as "Symptoms",
                  bacsikham as "DoctorName",
                  old_patient_code as "OldPatientCode",
                  patient_code as "PatientCode",
                  can_nang as "Weight",
                  tinh_thanh as "ProvinceName",
                  phuong_xa as "WardName",
                  branch_code as "BranchCode",
                  account_key as "AccountKey",
                  status as "Status"
                from portal.lich_hen_kham
                where coalesce(his_online_sync_status, 'PENDING') in ('PENDING', 'RETRY')
                  and coalesce(his_online_sync_next_check_at, now() - interval '1 second') <= now()
                  and coalesce(status, '') <> 'DA_HUY'
                  and ngay_kham >= current_date - interval '1 day'
                  and ngay_kham <= current_date + interval '60 days'
                  and branch_code = @BranchCode
                order by ngay_kham, ngay_tao, id
                limit @Limit;
                """,
                new { Limit = batchSize, BranchCode = branchCode },
                cancellationToken: cancellationToken))).ToList();
        }

        if (bookings.Count == 0) return false;

        await using var oracle = new OracleConnection(oracleConnectionString);
        await oracle.OpenAsync(cancellationToken);

        foreach (var booking in bookings)
        {
            await SyncOneAsync(bookingConnectionString, oracle, booking, cancellationToken);
        }

        return true;
    }

    private async Task SyncOneAsync(
        string bookingConnectionString,
        OracleConnection oracle,
        OnlineBooking booking,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(booking.BookingCode))
            {
                await MarkNeedsReviewAsync(bookingConnectionString, booking.Id, "Lịch hẹn chưa có mã lịch hẹn nên không thể đẩy sang HIS.", cancellationToken);
                return;
            }

            var mapped = await MapToHisAsync(oracle, booking, cancellationToken);
            if (mapped is null)
            {
                await MarkRetryAsync(bookingConnectionString, booking.Id, "Chưa tìm được mã tỉnh/phường/nghề nghiệp/dân tộc hợp lệ trong HIS.", cancellationToken);
                return;
            }

            var hisId = await UpsertHisOnlineBookingAsync(oracle, booking, mapped, cancellationToken);
            await SyncLegacyDangKyOnlineAsync(oracle, booking, hisId, cancellationToken);
            await MarkSyncedAsync(bookingConnectionString, booking, hisId, mapped, cancellationToken);
            logger.LogInformation("Synced booking {BookingId}/{BookingCode} to HGSOFT_SOYBA.DANGKYKHAM id {HisOnlineId}.", booking.Id, booking.BookingCode, hisId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Booking HIS online sync failed for booking {BookingId}/{BookingCode}.", booking.Id, booking.BookingCode);
            await MarkRetryAsync(bookingConnectionString, booking.Id, ex.Message, cancellationToken);
        }
    }

    private async Task<HisOnlineMapping?> MapToHisAsync(OracleConnection connection, OnlineBooking booking, CancellationToken cancellationToken)
    {
        var provinceCode = await ResolveCodeAsync(
            connection,
            "dm_tt",
            "ma_tt",
            "ten_tt",
            booking.ProvinceName,
            configuration["PatientPortal:HisOnlineDefaultProvinceCode"],
            null,
            cancellationToken);

        var wardCode = await ResolveWardCodeAsync(connection, booking.WardName, provinceCode, cancellationToken);
        wardCode ??= await ResolveCodeAsync(
            connection,
            "dm_px",
            "ma_px",
            "ten_px",
            null,
            configuration["PatientPortal:HisOnlineDefaultWardCode"],
            provinceCode is null ? null : "ma_tt = :ScopeValue",
            cancellationToken,
            provinceCode);

        var occupationCode = await ResolveCodeAsync(
            connection,
            "btdnn_bv",
            "mann",
            "tennn",
            null,
            configuration["PatientPortal:HisOnlineDefaultOccupationCode"] ?? "00000",
            null,
            cancellationToken);

        var ethnicityCode = await ResolveCodeAsync(
            connection,
            "btddt",
            "madantoc",
            "dantoc",
            null,
            configuration["PatientPortal:HisOnlineDefaultEthnicityCode"] ?? "25",
            null,
            cancellationToken);

        var departmentCode = await ResolveDepartmentCodeAsync(connection, booking.DepartmentName, cancellationToken);
        var doctorCode = await ResolveDoctorCodeAsync(connection, booking.DoctorName, departmentCode, cancellationToken);

        if (provinceCode is null || wardCode is null || occupationCode is null || ethnicityCode is null)
        {
            return null;
        }

        return new HisOnlineMapping(provinceCode, wardCode, occupationCode, ethnicityCode, departmentCode, doctorCode);
    }

    private async Task<long> UpsertHisOnlineBookingAsync(
        OracleConnection connection,
        OnlineBooking booking,
        HisOnlineMapping mapped,
        CancellationToken cancellationToken)
    {
        var existingId = await connection.ExecuteScalarAsync<long?>(new CommandDefinition(
            "select id from hgsoft_soyba.dangkykham where madatcho = :BookingCode and rownum = 1",
            new { booking.BookingCode },
            cancellationToken: cancellationToken));

        var gender = MapGender(booking.Gender);
        var appointmentAt = CombineDateAndTime(booking.AppointmentDate, booking.AppointmentTime);
        var patientCode = NormalizeHisPatientCode(FirstNonEmpty(booking.OldPatientCode, booking.PatientCode));
        var citizenId = DecryptBookingSecret(booking.CitizenIdEncrypted, configuration);

        if (existingId is long id)
        {
            await connection.ExecuteAsync(new CommandDefinition(
                """
                update hgsoft_soyba.dangkykham
                set ngaydangky = :AppointmentAt,
                    mabn = :PatientCode,
                    hoten = :FullName,
                    ngaysinh = :BirthDate,
                    phai = :Gender,
                    cccd = :CitizenId,
                    sdt = :Phone,
                    email = :Email,
                    mann = :OccupationCode,
                    madantoc = :EthnicityCode,
                    cholam = :BranchName,
                    sonha = :Address,
                    maphuongxa = :WardCode,
                    matt = :ProvinceCode,
                    trieuchung = :Symptoms,
                    phongkham = :DepartmentCode,
                    bacsi = :DoctorCode,
                    cannang = :Weight,
                    id_user = :PortalUserId,
                    id_usertao = :PortalUserId,
                    trangthai = 0,
                    trangthai_zalo = nvl(trangthai_zalo, 'CHUA_GUI'),
                    maql_tiepdon = nvl(maql_tiepdon, 0),
                    ngaycapnhat = sysdate
                where id = :Id
                """,
                new
                {
                    Id = id,
                    AppointmentAt = appointmentAt,
                    PatientCode = patientCode,
                    booking.FullName,
                    booking.BirthDate,
                    Gender = gender,
                    CitizenId = citizenId,
                    booking.Phone,
                    booking.Email,
                    mapped.OccupationCode,
                    mapped.EthnicityCode,
                    BranchName = BranchName(booking.BranchCode),
                    booking.Address,
                    mapped.WardCode,
                    mapped.ProvinceCode,
                    booking.Symptoms,
                    mapped.DepartmentCode,
                    mapped.DoctorCode,
                    booking.Weight,
                    PortalUserId = PortalUserId(booking.AccountKey)
                },
                cancellationToken: cancellationToken));

            return id;
        }

        var newId = await connection.ExecuteScalarAsync<long>(new CommandDefinition(
            "select hgsoft_soyba.seq_dangkykham.nextval from dual",
            cancellationToken: cancellationToken));

        await connection.ExecuteAsync(new CommandDefinition(
            """
            insert into hgsoft_soyba.dangkykham (
              id, ngaydangky, madatcho, mabn, hoten, ngaysinh, phai, mabhyt,
              cccd, sdt, sdt_nguoithan, email, mann, madantoc, cholam, sonha, thon,
              maphuongxa, matt, trieuchung, phongkham, bacsi, cannang, chieucao,
              id_usertao, id_user, trangthai, trangthai_zalo, maql_tiepdon, ngaytao, ngaycapnhat
            )
            values (
              :Id, :AppointmentAt, :BookingCode, :PatientCode, :FullName, :BirthDate, :Gender, null,
              :CitizenId, :Phone, null, :Email, :OccupationCode, :EthnicityCode, :BranchName, :Address, null,
              :WardCode, :ProvinceCode, :Symptoms, :DepartmentCode, :DoctorCode, :Weight, null,
              :PortalUserId, :PortalUserId, 0, 'CHUA_GUI', 0, sysdate, sysdate
            )
            """,
            new
            {
                Id = newId,
                AppointmentAt = appointmentAt,
                booking.BookingCode,
                PatientCode = patientCode,
                booking.FullName,
                booking.BirthDate,
                Gender = gender,
                CitizenId = citizenId,
                booking.Phone,
                booking.Email,
                mapped.OccupationCode,
                mapped.EthnicityCode,
                BranchName = BranchName(booking.BranchCode),
                booking.Address,
                mapped.WardCode,
                mapped.ProvinceCode,
                booking.Symptoms,
                mapped.DepartmentCode,
                mapped.DoctorCode,
                booking.Weight,
                PortalUserId = PortalUserId(booking.AccountKey)
            },
            cancellationToken: cancellationToken));

        return newId;
    }

    private async Task SyncLegacyDangKyOnlineAsync(
        OracleConnection connection,
        OnlineBooking booking,
        long hisOnlineId,
        CancellationToken cancellationToken)
    {
        var patientCode = NormalizeHisPatientCode(FirstNonEmpty(booking.OldPatientCode, booking.PatientCode));
        if (string.IsNullOrWhiteSpace(patientCode))
        {
            return;
        }

        foreach (var schema in LegacyOnlineSchemas())
        {
            if (!await LegacyPatientExistsAsync(connection, schema, patientCode, cancellationToken))
            {
                logger.LogInformation("Skipping legacy DANGKY_ONLINE sync for booking {BookingCode}: MABN {PatientCode} does not exist in {Schema}.BTDBN.", booking.BookingCode, patientCode, schema);
                continue;
            }

            await connection.ExecuteAsync(new CommandDefinition(
                $"""
                merge into {schema}.dangky_online target
                using (
                  select
                    :Maql maql,
                    :Mabn mabn,
                    :Ngay ngay,
                    :DienThoai dienthoai,
                    :StrMavp str_mavp,
                    :GhiChu ghi_chu
                  from dual
                ) source
                on (target.maql = source.maql)
                when matched then update set
                  target.mabn = source.mabn,
                  target.ngay = source.ngay,
                  target.dienthoai = source.dienthoai,
                  target.str_mavp = source.str_mavp,
                  target.ngayud = sysdate,
                  target.done = nvl(target.done, 0),
                  target.paid = nvl(target.paid, 0),
                  target.ghi_chu = source.ghi_chu
                when not matched then insert (
                  maql, mabn, ngay, dienthoai, str_mavp, ngayud, done, paid, ghi_chu
                )
                values (
                  source.maql, source.mabn, source.ngay, source.dienthoai, source.str_mavp, sysdate, 0, 0, source.ghi_chu
                )
                """,
                new
                {
                    Maql = hisOnlineId,
                    Mabn = patientCode,
                    Ngay = CombineDateAndTime(booking.AppointmentDate, booking.AppointmentTime),
                    DienThoai = Truncate(booking.Phone ?? string.Empty, 20),
                    StrMavp = configuration["PatientPortal:HisOnlineLegacyServiceCodes"],
                    GhiChu = Truncate($"Portal {booking.BookingCode}: {booking.Symptoms}".Trim(), 4000)
                },
                cancellationToken: cancellationToken));
        }
    }

    private async Task MarkSyncedAsync(
        string connectionString,
        OnlineBooking booking,
        long hisOnlineId,
        HisOnlineMapping mapped,
        CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.ExecuteAsync(new CommandDefinition(
            """
            update portal.lich_hen_kham
            set status = case when status = 'CHO_DUYET' then 'CHO_HIS_XAC_NHAN' else status end,
                his_online_sync_status = 'SYNCED',
                his_online_booking_id = @HisOnlineBookingId,
                his_online_synced_at = now(),
                his_online_sync_checked_at = now(),
                his_online_sync_next_check_at = null,
                his_online_sync_reason = null,
                his_makp = coalesce(his_makp, @DepartmentCode),
                his_department_name = coalesce(his_department_name, @DepartmentName)
            where id = @BookingId;
            """,
            new
            {
                BookingId = booking.Id,
                HisOnlineBookingId = hisOnlineId,
                mapped.DepartmentCode,
                booking.DepartmentName
            },
            cancellationToken: cancellationToken));
    }

    private async Task MarkRetryAsync(string connectionString, Guid bookingId, string reason, CancellationToken cancellationToken)
    {
        var retryMinutes = Math.Clamp(configuration.GetValue("PatientPortal:BookingHisOnlineSyncRetryMinutes", 5), 1, 120);
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.ExecuteAsync(new CommandDefinition(
            """
            update portal.lich_hen_kham
            set his_online_sync_status = 'RETRY',
                his_online_sync_reason = @Reason,
                his_online_sync_checked_at = now(),
                his_online_sync_attempt_count = his_online_sync_attempt_count + 1,
                his_online_sync_next_check_at = now() + make_interval(mins => @RetryMinutes)
            where id = @BookingId
              and coalesce(his_online_sync_status, 'PENDING') <> 'SYNCED';
            """,
            new { BookingId = bookingId, Reason = Truncate(reason, 1000), RetryMinutes = retryMinutes },
            cancellationToken: cancellationToken));
    }

    private static async Task MarkNeedsReviewAsync(string connectionString, Guid bookingId, string reason, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.ExecuteAsync(new CommandDefinition(
            """
            update portal.lich_hen_kham
            set his_online_sync_status = 'NEEDS_REVIEW',
                his_online_sync_reason = @Reason,
                his_online_sync_checked_at = now(),
                his_online_sync_attempt_count = his_online_sync_attempt_count + 1,
                his_online_sync_next_check_at = null
            where id = @BookingId;
            """,
            new { BookingId = bookingId, Reason = Truncate(reason, 1000) },
            cancellationToken: cancellationToken));
    }

    private async Task<string?> ResolveDepartmentCodeAsync(OracleConnection connection, string? departmentName, CancellationToken cancellationToken)
    {
        var configured = configuration["PatientPortal:HisOnlineDefaultDepartmentCode"];
        if (!string.IsNullOrWhiteSpace(configured) && await CodeExistsAsync(connection, "btdkp_bv", "makp", configured, cancellationToken))
        {
            return configured.Trim();
        }

        if (!string.IsNullOrWhiteSpace(departmentName))
        {
            var code = await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
                """
                select makp
                from btdkp_bv
                where loai = 1
                  and nvl(dangky_online, 0) = 1
                  and (upper(tenkp) like upper(:Pattern) or upper(:Name) like '%' || upper(tenkp) || '%')
                  and rownum = 1
                """,
                new { Name = departmentName.Trim(), Pattern = $"%{departmentName.Trim()}%" },
                cancellationToken: cancellationToken));
            if (!string.IsNullOrWhiteSpace(code)) return code.Trim();
        }

        return await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            """
            select makp
            from btdkp_bv
            where loai = 1
              and nvl(dangky_online, 0) = 1
              and rownum = 1
            """,
            cancellationToken: cancellationToken));
    }

    private async Task<string?> ResolveDoctorCodeAsync(OracleConnection connection, string? doctorName, string? departmentCode, CancellationToken cancellationToken)
    {
        var configured = configuration["PatientPortal:HisOnlineDefaultDoctorCode"];
        if (!string.IsNullOrWhiteSpace(configured) && await CodeExistsAsync(connection, "dmbs", "ma", configured, cancellationToken))
        {
            return configured.Trim();
        }

        if (string.IsNullOrWhiteSpace(doctorName))
        {
            return null;
        }

        var trimmed = doctorName.Trim();
        if (trimmed.Length <= 4 && await CodeExistsAsync(connection, "dmbs", "ma", trimmed, cancellationToken))
        {
            return trimmed;
        }

        return await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            """
            select ma
            from dmbs
            where (:DepartmentCode is null or makp = :DepartmentCode)
              and upper(hoten) like upper(:Pattern)
              and rownum = 1
            """,
            new { DepartmentCode = departmentCode, Pattern = $"%{trimmed}%" },
            cancellationToken: cancellationToken));
    }

    private static async Task<string?> ResolveWardCodeAsync(OracleConnection connection, string? wardName, string? provinceCode, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(wardName))
        {
            return null;
        }

        return await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            """
            select ma_px
            from dm_px
            where (:ProvinceCode is null or ma_tt = :ProvinceCode)
              and (upper(ten_px) like upper(:Pattern) or upper(:Name) like '%' || upper(ten_px) || '%')
              and rownum = 1
            """,
            new { ProvinceCode = provinceCode, Name = wardName.Trim(), Pattern = $"%{wardName.Trim()}%" },
            cancellationToken: cancellationToken));
    }

    private static async Task<string?> ResolveCodeAsync(
        OracleConnection connection,
        string tableName,
        string codeColumn,
        string nameColumn,
        string? displayName,
        string? configuredDefault,
        string? fallbackWhere,
        CancellationToken cancellationToken,
        string? scopeValue = null)
    {
        if (!string.IsNullOrWhiteSpace(configuredDefault) &&
            await CodeExistsAsync(connection, tableName, codeColumn, configuredDefault, cancellationToken))
        {
            return configuredDefault.Trim();
        }

        if (!string.IsNullOrWhiteSpace(displayName))
        {
            var sql = $"""
                select {codeColumn}
                from {tableName}
                where (upper({nameColumn}) like upper(:Pattern) or upper(:Name) like '%' || upper({nameColumn}) || '%')
                  and rownum = 1
                """;
            var matched = await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
                sql,
                new { Name = displayName.Trim(), Pattern = $"%{displayName.Trim()}%" },
                cancellationToken: cancellationToken));
            if (!string.IsNullOrWhiteSpace(matched)) return matched.Trim();
        }

        var where = string.IsNullOrWhiteSpace(fallbackWhere) ? "" : $"where {fallbackWhere}";
        return await connection.ExecuteScalarAsync<string?>(new CommandDefinition(
            $"select {codeColumn} from {tableName} {where} and rownum = 1".Replace(" where  and ", " where ").Replace("  and rownum", " where rownum"),
            new { ScopeValue = scopeValue },
            cancellationToken: cancellationToken));
    }

    private static async Task<bool> CodeExistsAsync(OracleConnection connection, string tableName, string codeColumn, string code, CancellationToken cancellationToken)
    {
        var count = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            $"select count(*) from {tableName} where {codeColumn} = :Code",
            new { Code = code.Trim() },
            cancellationToken: cancellationToken));
        return count > 0;
    }

    private async Task<bool> LegacyPatientExistsAsync(OracleConnection connection, string schema, string patientCode, CancellationToken cancellationToken)
    {
        var count = await connection.ExecuteScalarAsync<int>(new CommandDefinition(
            $"select count(*) from {schema}.btdbn where mabn = :PatientCode",
            new { PatientCode = patientCode.Trim() },
            cancellationToken: cancellationToken));
        return count > 0;
    }

    private IReadOnlyList<string> LegacyOnlineSchemas()
    {
        var configured = configuration["PatientPortal:HisOnlineLegacySchemas"];
        var schemas = string.IsNullOrWhiteSpace(configured)
            ? ["HGSOFT_BV", "HGSOFT"]
            : configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return schemas
            .Select(schema => schema.Trim().ToUpperInvariant())
            .Where(IsOracleIdentifier)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static bool IsOracleIdentifier(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 30) return false;
        if (!char.IsLetter(value[0])) return false;
        return value.All(ch => char.IsLetterOrDigit(ch) || ch == '_' || ch == '$' || ch == '#');
    }

    private static DateTime? CombineDateAndTime(DateTime? appointmentDate, string? appointmentTime)
    {
        if (appointmentDate is null) return null;
        if (TimeSpan.TryParse(appointmentTime, CultureInfo.InvariantCulture, out var time))
        {
            return appointmentDate.Value.Date.Add(time);
        }

        return appointmentDate.Value.Date;
    }

    private static int? MapGender(string? gender)
    {
        var value = NormalizeText(gender);
        if (value is "nam" or "male" or "m" or "1") return 0;
        if (value is "nu" or "female" or "f" or "2") return 1;
        return null;
    }

    private static long PortalUserId(string? accountKey)
    {
        if (string.IsNullOrWhiteSpace(accountKey)) return 0;
        var digits = new string(accountKey.Where(char.IsDigit).ToArray());
        if (long.TryParse(digits, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && id > 0)
        {
            return id;
        }

        return 0;
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        return values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();
    }

    private static string? NormalizeHisPatientCode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var trimmed = value.Trim();
        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.Length == 8) return digits;
        if (digits.Length > 0 && digits.Length < 8) return digits.PadLeft(8, '0');
        if (trimmed.Length <= 8) return trimmed;
        return trimmed[..8];
    }

    private static string? NormalizeBranchCode(string? value)
    {
        var code = value?.Trim().ToUpperInvariant();
        return code is "CN1" or "CN3" ? code : null;
    }

    private static string BranchName(string branchCode) => branchCode switch
    {
        "CN3" => "Phòng khám An Phú - Chi nhánh 3",
        _ => "Bệnh viện An Phú - Chi nhánh 1"
    };

    private static string NormalizeText(string? value)
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

    private static string? DecryptBookingSecret(string? encryptedValue, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(encryptedValue) || !encryptedValue.Contains(':', StringComparison.Ordinal))
        {
            return null;
        }

        var pieces = encryptedValue.Split(':', 2);
        try
        {
            var secret = configuration["BOOKING_ENCRYPTION_KEY"]
                ?? configuration["ENCRYPTION_KEY"]
                ?? configuration["JWT_SECRET"]
                ?? "fallback-secure-encryption-key-32b";
            var key = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
            var iv = Convert.FromHexString(pieces[0]);
            var cipherText = Convert.FromHexString(pieces[1]);

            using var aes = Aes.Create();
            aes.Key = key;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var decryptor = aes.CreateDecryptor();
            var clearBytes = decryptor.TransformFinalBlock(cipherText, 0, cipherText.Length);
            var digits = new string(Encoding.UTF8.GetString(clearBytes).Where(char.IsDigit).ToArray());
            return string.IsNullOrWhiteSpace(digits) ? null : Truncate(digits, 20);
        }
        catch
        {
            return null;
        }
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength) return value;
        return value[..maxLength];
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
        return new NpgsqlConnectionStringBuilder
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
        }.ConnectionString;
    }

    private sealed record OnlineBooking(
        Guid Id,
        string? BookingCode,
        string? FullName,
        string? Phone,
        string? Email,
        DateTime? BirthDate,
        string? Gender,
        string? Address,
        string? CitizenIdEncrypted,
        DateTime? AppointmentDate,
        string? AppointmentTime,
        string? DepartmentName,
        string? Symptoms,
        string? DoctorName,
        string? OldPatientCode,
        string? PatientCode,
        double? Weight,
        string? ProvinceName,
        string? WardName,
        string BranchCode,
        string? AccountKey,
        string? Status);

    private sealed record HisOnlineMapping(
        string ProvinceCode,
        string WardCode,
        string OccupationCode,
        string EthnicityCode,
        string? DepartmentCode,
        string? DoctorCode);
}
