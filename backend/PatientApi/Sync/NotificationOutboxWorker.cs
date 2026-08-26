using Dapper;
using Npgsql;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PatientApi.Sync;

public sealed class NotificationOutboxWorker(
    IConfiguration configuration,
    HttpClient httpClient,
    ZaloZnsClient zalo,
    ILogger<NotificationOutboxWorker> logger) : BackgroundService
{
    private readonly string _workerId = $"{Environment.MachineName}-notification-{Guid.NewGuid():N}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("PatientPortal:EnableNotificationOutboxWorker", false))
        {
            logger.LogInformation("Notification outbox worker is disabled.");
            return;
        }

        var connectionString = GetBookingConnectionString();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            logger.LogWarning("Notification outbox worker is enabled but BookingDatabase/BOOKING_DATABASE_URL is not configured.");
            return;
        }

        var intervalSeconds = Math.Clamp(configuration.GetValue("PatientPortal:NotificationOutboxIntervalSeconds", 30), 10, 600);
        logger.LogInformation("Notification outbox worker started with interval {IntervalSeconds}s.", intervalSeconds);

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
                logger.LogError(ex, "Notification outbox polling cycle failed.");
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
        var batchSize = Math.Clamp(configuration.GetValue("PatientPortal:NotificationOutboxBatchSize", 20), 1, 100);
        var autoSendEnabled = await IsAutoSendEnabledAsync(cancellationToken);
        List<NotificationOutboxItem> items;

        await using (var connection = new NpgsqlConnection(connectionString))
        {
            items = (await connection.QueryAsync<NotificationOutboxItem>(new CommandDefinition(
                """
                update portal.notification_outbox
                set status='running',
                    locked_by=@WorkerId,
                    locked_until=now() + interval '2 minutes',
                    updated_at=now()
                where id in (
                  select id
                  from portal.notification_outbox
                  where channel='zalo'
                    and status in ('pending', 'retry')
                    and run_after <= now()
                    and (locked_until is null or locked_until < now())
                    and (
                      @AutoSendEnabled
                      or lower(coalesce(payload_json->>'manual_send_requested', 'false')) = 'true'
                    )
                  order by run_after, id
                  for update skip locked
                  limit @Limit
                )
                returning
                  id as "Id",
                  appointment_id as "AppointmentId",
                  recipient_phone as "RecipientPhone",
                  template_key as "TemplateKey",
                  template_id as "TemplateId",
                  payload_json::text as "PayloadJson",
                  attempt_count as "AttemptCount",
                  max_attempts as "MaxAttempts";
                """,
                new { WorkerId = _workerId, Limit = batchSize, AutoSendEnabled = autoSendEnabled },
                cancellationToken: cancellationToken))).ToList();
        }

        if (items.Count == 0) return false;

        foreach (var item in items)
        {
            await ProcessOneAsync(connectionString, item, cancellationToken);
        }

        return true;
    }

    private async Task<bool> IsAutoSendEnabledAsync(CancellationToken cancellationToken)
    {
        var configured = configuration["PatientPortal:NotificationOutboxAutoSendEnabled"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return IsTruthy(configured);
        }

        var settings = await ReadPortalSettingsAsync(cancellationToken);
        if (settings.TryGetValue("booking.zalo_auto_send_enabled", out var setting))
        {
            return IsTruthy(setting);
        }

        return false;
    }

    private async Task<Dictionary<string, string>> ReadPortalSettingsAsync(CancellationToken cancellationToken)
    {
        var supabaseUrl = configuration["SUPABASE_URL"]?.TrimEnd('/');
        var supabaseKey = configuration["SUPABASE_SECRET_KEY"] ?? configuration["SUPABASE_SERVICE_ROLE_KEY"];
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(supabaseKey))
        {
            return [];
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"{supabaseUrl}/rest/v1/portal_app_settings?select=setting_key,setting_value&setting_key=in.(booking.zalo_auto_send_enabled)");
        request.Headers.TryAddWithoutValidation("apikey", supabaseKey);
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {supabaseKey}");

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) return [];
            var rows = await response.Content.ReadFromJsonAsync<List<PortalSettingRow>>(cancellationToken: cancellationToken) ?? [];
            return rows
                .Where(row => !string.IsNullOrWhiteSpace(row.SettingKey))
                .ToDictionary(row => row.SettingKey!, row => row.SettingValue ?? "", StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not read notification outbox settings from portal_app_settings.");
            return [];
        }
    }

    private static bool IsTruthy(string? value)
    {
        return string.Equals(value, "true", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(value, "1", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(value, "on", StringComparison.OrdinalIgnoreCase);
    }

    private async Task ProcessOneAsync(string connectionString, NotificationOutboxItem item, CancellationToken cancellationToken)
    {
        try
        {
            using var payload = JsonDocument.Parse(item.PayloadJson);
            var result = await zalo.SendTemplateAsync(item.RecipientPhone, item.TemplateKey, payload.RootElement, item.TemplateId, cancellationToken);
            await using var connection = new NpgsqlConnection(connectionString);
            if (result.Success)
            {
                await MarkSentAsync(connection, item, result.RawResponse, cancellationToken);
                logger.LogInformation("Sent notification outbox {OutboxId} template {TemplateKey} to {Phone}.", item.Id, item.TemplateKey, MaskPhone(item.RecipientPhone));
                return;
            }

            await MarkFailedOrRetryAsync(connection, item, result.ErrorMessage ?? "Zalo ZNS send failed.", result.RawResponse, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Notification outbox {OutboxId} failed.", item.Id);
            await using var connection = new NpgsqlConnection(connectionString);
            await MarkFailedOrRetryAsync(connection, item, ex.Message, null, cancellationToken);
        }
    }

    private static async Task MarkSentAsync(NpgsqlConnection connection, NotificationOutboxItem item, string? rawResponse, CancellationToken cancellationToken)
    {
        const string sql = """
            update portal.notification_outbox
            set status='sent',
                attempt_count=attempt_count + 1,
                locked_by=null,
                locked_until=null,
                last_error=null,
                sent_at=now(),
                updated_at=now(),
                payload_json=jsonb_set(
                  payload_json,
                  '{zalo_send_result}',
                  cast(@RawResponseJson as jsonb),
                  true
                )
            where id=@Id;

            update portal.lich_hen_kham
            set zalo_confirm_sent_at=now()
            where id=@AppointmentId;
            """;

        await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            item.Id,
            item.AppointmentId,
            RawResponseJson = JsonForRawResponse(rawResponse)
        }, cancellationToken: cancellationToken));
    }

    private async Task MarkFailedOrRetryAsync(NpgsqlConnection connection, NotificationOutboxItem item, string error, string? rawResponse, CancellationToken cancellationToken)
    {
        var retryMinutes = Math.Clamp(configuration.GetValue("PatientPortal:NotificationOutboxRetryMinutes", 5), 1, 120);
        var nextAttempt = item.AttemptCount + 1;
        var nextStatus = nextAttempt >= item.MaxAttempts ? "failed" : "retry";

        const string sql = """
            update portal.notification_outbox
            set status=@Status,
                attempt_count=attempt_count + 1,
                locked_by=null,
                locked_until=null,
                last_error=@Error,
                run_after=case when @Status='retry' then now() + make_interval(mins => @RetryMinutes) else run_after end,
                updated_at=now(),
                payload_json=jsonb_set(
                  payload_json,
                  '{zalo_send_result}',
                  cast(@RawResponseJson as jsonb),
                  true
                )
            where id=@Id;
            """;

        await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            item.Id,
            Status = nextStatus,
            Error = Truncate(error, 1000),
            RetryMinutes = retryMinutes,
            RawResponseJson = JsonForRawResponse(rawResponse)
        }, cancellationToken: cancellationToken));
    }

    private static string JsonForRawResponse(string? rawResponse)
    {
        if (string.IsNullOrWhiteSpace(rawResponse)) return "null";
        return System.Text.Json.JsonSerializer.Serialize(rawResponse);
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

        return builder.ConnectionString;
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength) return value;
        return value[..maxLength];
    }

    private static string MaskPhone(string phone)
    {
        if (phone.Length < 7) return "***";
        return $"{phone[..3]}***{phone[^3..]}";
    }

    private sealed record NotificationOutboxItem(
        long Id,
        Guid AppointmentId,
        string RecipientPhone,
        string TemplateKey,
        string? TemplateId,
        string PayloadJson,
        int AttemptCount,
        int MaxAttempts);

    private sealed record PortalSettingRow(
        [property: JsonPropertyName("setting_key")] string? SettingKey,
        [property: JsonPropertyName("setting_value")] string? SettingValue);
}
