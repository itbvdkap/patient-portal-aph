using Dapper;
using Npgsql;
using Oracle.ManagedDataAccess.Client;
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

        var branchCode = NormalizeBranchCode(configuration["PatientPortal:BranchCode"]);
        if (branchCode is null)
        {
            logger.LogError("Notification outbox worker requires PatientPortal:BranchCode=CN1 or CN3. Worker stopped to prevent cross-branch delivery.");
            return;
        }

        var intervalSeconds = Math.Clamp(configuration.GetValue("PatientPortal:NotificationOutboxIntervalSeconds", 30), 10, 600);
        logger.LogInformation("Notification outbox worker started for branch {BranchCode} with interval {IntervalSeconds}s.", branchCode, intervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var didWork = await ProcessBatchAsync(connectionString, branchCode, stoppingToken);
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

    private async Task<bool> ProcessBatchAsync(string connectionString, string branchCode, CancellationToken cancellationToken)
    {
        // Zalo calls can take tens of seconds. Keep batches small so later
        // manual requests do not wait behind a large batch and locks do not
        // expire while the worker is processing sequentially.
        var batchSize = Math.Clamp(configuration.GetValue("PatientPortal:NotificationOutboxBatchSize", 5), 1, 5);
        var lockSeconds = Math.Clamp(
            configuration.GetValue("PatientPortal:NotificationOutboxLockSeconds", 600),
            120,
            1800);
        try
        {
            await RecoverExpiredLocksAsync(connectionString, branchCode, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Recovery is housekeeping. A transient database timeout must not
            // prevent a new manual request from being claimed below.
            logger.LogWarning(ex, "Could not recover expired notification outbox locks; continuing with the current batch.");
        }
        var autoSendEnabled = await IsAutoSendEnabledAsync(cancellationToken);
        var items = await ClaimPendingNotificationsAsync(
            connectionString,
            branchCode,
            batchSize,
            lockSeconds,
            autoSendEnabled,
            cancellationToken);

        if (items.Count == 0)
        {
            // A Zalo send can succeed while the Oracle callback times out. Do
            // not require a new outbox item before retrying that callback;
            // otherwise an already-sent row can remain CHO_GUI forever.
            try
            {
                await ReconcileSentHisStatusesAsync(connectionString, branchCode, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not reconcile sent HIS Zalo statuses while the outbox was idle.");
            }

            // Reconciliation must run before promotion. A sent outbox row
            // whose HIS callback failed also looks like a manual resend
            // request while HIS is still CHO_GUI; promoting it first would
            // send a duplicate Zalo message instead of fixing HIS.
            if (!autoSendEnabled)
            {
                await PromoteHisRequestedNotificationsAsync(connectionString, branchCode, cancellationToken);
            }

            return false;
        }

        foreach (var item in items)
        {
            await ProcessOneAsync(connectionString, item, cancellationToken);
        }

        // Reconciliation runs before HIS resend promotion. A sent outbox row
        // whose callback failed must be repaired in HIS first, not mistaken
        // for a new resend request.
        try
        {
            await ReconcileSentHisStatusesAsync(connectionString, branchCode, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not reconcile sent HIS Zalo statuses; continuing with the next notification cycle.");
        }

        if (!autoSendEnabled)
        {
            await PromoteHisRequestedNotificationsAsync(connectionString, branchCode, cancellationToken);
        }

        return true;
    }

    private async Task<List<NotificationOutboxItem>> ClaimPendingNotificationsAsync(
        string connectionString,
        string branchCode,
        int batchSize,
        int lockSeconds,
        bool autoSendEnabled,
        CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            // Do not use UPDATE ... RETURNING in autocommit mode. If the
            // network drops while reading RETURNING, PostgreSQL can keep the
            // update while the worker never receives the item. Holding the
            // claim in an explicit transaction makes any read timeout roll
            // back the claim atomically.
            var ids = (await connection.QueryAsync<long>(new CommandDefinition(
                """
                select id
                from portal.notification_outbox
                where channel='zalo'
                  and status in ('pending', 'retry')
                  and branch_code=@BranchCode
                  and sent_at is null
                  and run_after <= now()
                  and (locked_until is null or locked_until < now())
                  and (
                    @AutoSendEnabled
                    or lower(coalesce(payload_json->>'manual_send_requested', 'false')) = 'true'
                  )
                order by
                  case when lower(coalesce(payload_json->>'manual_send_requested', 'false')) = 'true' then 0 else 1 end,
                  run_after,
                  id
                for update skip locked
                limit @Limit;
                """,
                new
                {
                    BranchCode = branchCode,
                    AutoSendEnabled = autoSendEnabled,
                    Limit = batchSize
                },
                transaction: transaction,
                cancellationToken: cancellationToken))).ToArray();

            if (ids.Length == 0)
            {
                await transaction.CommitAsync(cancellationToken);
                return [];
            }

            await connection.ExecuteAsync(new CommandDefinition(
                """
                update portal.notification_outbox
                set status='running',
                    locked_by=@WorkerId,
                    locked_until=now() + make_interval(secs => @LockSeconds),
                    updated_at=now()
                where id = any(@Ids)
                  and status in ('pending', 'retry')
                  and sent_at is null;
                """,
                new { Ids = ids, WorkerId = _workerId, LockSeconds = lockSeconds },
                transaction: transaction,
                cancellationToken: cancellationToken));

            var items = (await connection.QueryAsync<NotificationOutboxItem>(new CommandDefinition(
                """
                select
                  n.id as "Id",
                  n.appointment_id as "AppointmentId",
                  l.his_online_booking_id as "HisOnlineBookingId",
                  l.ma_lich_hen as "BookingCode",
                  n.recipient_phone as "RecipientPhone",
                  n.template_key as "TemplateKey",
                  n.template_id as "TemplateId",
                  n.payload_json::text as "PayloadJson",
                  n.attempt_count as "AttemptCount",
                  n.max_attempts as "MaxAttempts"
                from portal.notification_outbox n
                join portal.lich_hen_kham l on l.id=n.appointment_id
                where n.id = any(@Ids)
                  and n.status='running'
                  and n.locked_by=@WorkerId
                order by n.id;
                """,
                new { Ids = ids, WorkerId = _workerId },
                transaction: transaction,
                cancellationToken: cancellationToken))).ToList();

            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Claimed {Count} notification outbox item(s) for worker.", items.Count);
            return items;
        }
        catch
        {
            try
            {
                await transaction.RollbackAsync(CancellationToken.None);
            }
            catch
            {
                // The connection may already be broken; the original
                // exception contains the useful failure details.
            }

            throw;
        }
    }

    private async Task RecoverExpiredLocksAsync(
        string connectionString,
        string branchCode,
        CancellationToken cancellationToken)
    {
        // The claim query changes rows to running before it returns them. If
        // the network drops while reading the RETURNING result, PostgreSQL
        // keeps that change and the worker never receives the item. Requeue
        // only locks that have been expired for a grace period so an active
        // Zalo request is not reclaimed while it is still in flight.
        var graceSeconds = Math.Clamp(
            configuration.GetValue("PatientPortal:NotificationOutboxLockGraceSeconds", 30),
            10,
            300);

        await using var connection = new NpgsqlConnection(connectionString);
        var recovered = await connection.QueryAsync<long>(new CommandDefinition(
            """
            update portal.notification_outbox
            set status=case when attempt_count >= max_attempts then 'failed' else 'retry' end,
                locked_by=null,
                locked_until=null,
                run_after=now(),
                last_error=coalesce(last_error, 'Worker lock expired before processing completed; queued for retry.'),
                updated_at=now()
            where channel='zalo'
              and branch_code=@BranchCode
              and status='running'
              and sent_at is null
              and locked_until is not null
              and locked_until < now() - make_interval(secs => @GraceSeconds)
            returning id;
            """,
            new { BranchCode = branchCode, GraceSeconds = graceSeconds },
            cancellationToken: cancellationToken));

        var ids = recovered.ToList();
        if (ids.Count > 0)
        {
            logger.LogWarning(
                "Recovered {Count} expired notification outbox lock(s): {OutboxIds}.",
                ids.Count,
                string.Join(",", ids));
        }
    }

    private async Task PromoteHisRequestedNotificationsAsync(
        string bookingConnectionString,
        string branchCode,
        CancellationToken cancellationToken)
    {
        var oracleConnectionString = configuration.GetConnectionString("OracleHis");
        if (string.IsNullOrWhiteSpace(oracleConnectionString))
        {
            return;
        }

        var promotionLimit = Math.Clamp(
            configuration.GetValue("PatientPortal:NotificationOutboxPromotionBatchSize", 25),
            5,
            100);
        List<PendingManualRequest> pending;
        await using (var bookingConnection = new NpgsqlConnection(bookingConnectionString))
        {
            pending = (await bookingConnection.QueryAsync<PendingManualRequest>(new CommandDefinition(
                """
                select
                  n.id as "Id",
                  l.ma_lich_hen as "BookingCode",
                  l.his_online_booking_id as "HisOnlineBookingId",
                  n.sent_at as "SentAt"
                from portal.notification_outbox n
                join portal.lich_hen_kham l on l.id=n.appointment_id
                where n.channel='zalo'
                  and n.status in ('pending', 'retry', 'failed', 'sent')
                  and n.branch_code=@BranchCode
                  and (
                    (n.sent_at is null and l.zalo_confirm_sent_at is null)
                    or n.sent_at is not null
                  )
                order by case when n.sent_at is null then 0 else 1 end, n.updated_at desc, n.id desc
                limit @PromotionLimit;
                """,
                new { BranchCode = branchCode, PromotionLimit = promotionLimit },
                cancellationToken: cancellationToken))).ToList();
        }

        if (pending.Count == 0)
        {
            return;
        }

        try
        {
            await using var oracle = new OracleConnection(oracleConnectionString);
            await oracle.OpenAsync(cancellationToken);
            await using var bookingConnection = new NpgsqlConnection(bookingConnectionString);

            foreach (var item in pending)
            {
                try
                {
                    var hisState = await oracle.QuerySingleOrDefaultAsync<OracleZaloState>(new CommandDefinition(
                    """
                    select
                      nvl(trangthai_zalo, 'CHUA_GUI') as "Status",
                      ngaygui_zalo as "SentAt",
                      loi_zalo as "Error"
                    from hgsoft_soyba.dangkykham
                    where ((:HisOnlineBookingId > 0 and id=:HisOnlineBookingId)
                       or (:BookingCode is not null and madatcho=:BookingCode))
                      and rownum=1
                    """,
                    new
                    {
                        HisOnlineBookingId = item.HisOnlineBookingId ?? 0,
                        BookingCode = string.IsNullOrWhiteSpace(item.BookingCode) ? null : item.BookingCode
                    },
                        cancellationToken: cancellationToken));

                    if (!string.Equals(hisState?.Status?.Trim(), "CHO_GUI", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var isExplicitResend = hisState is not null && item.SentAt is not null &&
                        hisState.SentAt is null &&
                        string.IsNullOrWhiteSpace(hisState.Error);
                    if (item.SentAt is not null && !isExplicitResend)
                    {
                        // A previous send is known to have reached Zalo. A CHO_GUI
                        // status caused by a transient worker error must not create
                        // a duplicate message; only the HIS resend action clears
                        // ngaygui_zalo/loi_zalo and reaches this branch.
                        continue;
                    }

                    var updated = await bookingConnection.ExecuteAsync(new CommandDefinition(
                    """
                    update portal.notification_outbox
                    set status='pending',
                        run_after=now(),
                        locked_by=null,
                        locked_until=null,
                        last_error=null,
                        attempt_count=case when @ResetSentState then 0 else attempt_count end,
                        sent_at=case when @ResetSentState then null else sent_at end,
                        payload_json=jsonb_set(payload_json, '{manual_send_requested}', 'true'::jsonb, true),
                        updated_at=now()
                    where id=@Id
                      and (status in ('pending', 'retry', 'failed') or (@ResetSentState and status='sent'))
                      and (sent_at is null or @ResetSentState);

                    update portal.lich_hen_kham
                    set zalo_confirm_sent_at=case when @ResetSentState then null else zalo_confirm_sent_at end
                    where id=(select appointment_id from portal.notification_outbox where id=@Id)
                      and @ResetSentState;
                    """,
                        new { item.Id, ResetSentState = isExplicitResend },
                        cancellationToken: cancellationToken));

                    if (updated > 0)
                    {
                        logger.LogInformation(
                            "Promoted HIS Zalo request {BookingCode} to manual outbox send.",
                            item.BookingCode ?? item.Id.ToString());
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    // One slow or unavailable HIS row must not prevent newer
                    // manual requests from reaching the outbox.
                    logger.LogWarning(
                        ex,
                        "Could not promote HIS Zalo request {BookingCode}; continuing with the remaining requests.",
                        item.BookingCode ?? item.Id.ToString());
                }
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not read HIS Zalo request statuses for pending notification outbox items.");
        }
    }

    private async Task ReconcileSentHisStatusesAsync(
        string bookingConnectionString,
        string branchCode,
        CancellationToken cancellationToken)
    {
        List<SentNotification> sentItems;
        await using (var connection = new NpgsqlConnection(bookingConnectionString))
        {
            sentItems = (await connection.QueryAsync<SentNotification>(new CommandDefinition(
                """
                select
                  n.id as "OutboxId",
                  l.his_online_booking_id as "HisOnlineBookingId",
                  l.ma_lich_hen as "BookingCode"
                from portal.notification_outbox n
                join portal.lich_hen_kham l on l.id=n.appointment_id
                where n.channel='zalo'
                  and n.sent_at is not null
                  and n.branch_code=@BranchCode
                  and coalesce(n.payload_json->>'his_zalo_status_sync', '') <> 'DA_GUI'
                order by n.sent_at
                limit 50;
                """,
                new { BranchCode = branchCode },
                cancellationToken: cancellationToken))).ToList();
        }

        foreach (var item in sentItems)
        {
            if (!await TryUpdateHisOnlineZaloStatusAsync(item.HisOnlineBookingId, item.BookingCode, "DA_GUI", null, cancellationToken))
            {
                continue;
            }

            await MarkHisStatusSynchronizedAsync(bookingConnectionString, item.OutboxId, cancellationToken);
        }
    }

    private async Task<bool> MarkHisStatusSynchronizedAsync(
        string bookingConnectionString,
        long outboxId,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = new NpgsqlConnection(bookingConnectionString);
            await connection.ExecuteAsync(new CommandDefinition(
                """
                update portal.notification_outbox
                set payload_json=jsonb_set(
                        coalesce(payload_json, '{}'::jsonb),
                        '{his_zalo_status_sync}',
                        '"DA_GUI"'::jsonb,
                        true
                    ),
                    updated_at=now()
                where id=@OutboxId;
                """,
                new { OutboxId = outboxId },
                cancellationToken: cancellationToken));
            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // The Oracle update has already succeeded. A marker write failure
            // must not turn a delivered Zalo message back into a retry.
            logger.LogWarning(ex, "HIS Zalo status was updated, but the outbox sync marker could not be saved for {OutboxId}.", outboxId);
            return false;
        }
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
        var supabaseKey = configuration["SUPABASE_SERVICE_ROLE_KEY"] ?? configuration["SUPABASE_SECRET_KEY"];
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(supabaseKey))
        {
            return [];
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"{supabaseUrl}/rest/v1/portal_app_settings?select=setting_key,setting_value&setting_key=in.(booking.zalo_auto_send_enabled)");
        request.Headers.TryAddWithoutValidation("apikey", supabaseKey);
        request.Headers.TryAddWithoutValidation("User-Agent", "AnPhuPatientPortalSyncAgent/1.0");
        if (!supabaseKey.StartsWith("sb_secret_", StringComparison.Ordinal))
        {
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {supabaseKey}");
        }

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

    private static string? NormalizeBranchCode(string? value)
    {
        var code = value?.Trim().ToUpperInvariant();
        return code is "CN1" or "CN3" ? code : null;
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
                if (await TryUpdateHisOnlineZaloStatusAsync(item.HisOnlineBookingId, item.BookingCode, "DA_GUI", null, cancellationToken))
                {
                    _ = await MarkHisStatusSynchronizedAsync(connectionString, item.Id, cancellationToken);
                }
                logger.LogInformation("Sent notification outbox {OutboxId} template {TemplateKey} to {Phone}.", item.Id, item.TemplateKey, MaskPhone(item.RecipientPhone));
                return;
            }

            await MarkFailedOrRetryAsync(connection, item, result.ErrorMessage ?? "Zalo ZNS send failed.", result.RawResponse, cancellationToken);
            await TryUpdateHisOnlineZaloStatusAsync(item.HisOnlineBookingId, item.BookingCode, NextOracleZaloStatus(item), result.ErrorMessage, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Notification outbox {OutboxId} failed.", item.Id);
            try
            {
                await using var connection = new NpgsqlConnection(connectionString);
                await MarkFailedOrRetryAsync(connection, item, ex.Message, null, cancellationToken);
                await TryUpdateHisOnlineZaloStatusAsync(item.HisOnlineBookingId, item.BookingCode, NextOracleZaloStatus(item), ex.Message, cancellationToken);
            }
            catch (Exception stateException)
            {
                // Leave the row recoverable by RecoverExpiredLocksAsync when
                // the database is unavailable while recording the failure.
                logger.LogError(
                    stateException,
                    "Could not persist failure state for notification outbox {OutboxId}; its expired lock will be recovered.",
                    item.Id);
            }
        }
    }

    private async Task<bool> TryUpdateHisOnlineZaloStatusAsync(
        long? hisOnlineBookingId,
        string? bookingCode,
        string status,
        string? error,
        CancellationToken cancellationToken)
    {
        if ((hisOnlineBookingId is null or <= 0) && string.IsNullOrWhiteSpace(bookingCode))
        {
            return false;
        }

        var oracleConnectionString = configuration.GetConnectionString("OracleHis");
        if (string.IsNullOrWhiteSpace(oracleConnectionString))
        {
            return false;
        }

        var timeoutSeconds = Math.Clamp(
            configuration.GetValue("PatientPortal:NotificationOutboxHisStatusTimeoutSeconds", 5),
            2,
            30);

        // The HIS id and booking code are loaded with the claimed outbox row.
        // Do not query Supabase again after Zalo sends: that extra round trip
        // was the source of Npgsql stream timeouts and prevented the Oracle
        // update. Older rows may not have his_online_booking_id persisted, so
        // madatcho is a safe fallback key.
        var hasHisOnlineBookingId = hisOnlineBookingId is > 0 ? 1 : 0;
        var normalizedBookingCode = string.IsNullOrWhiteSpace(bookingCode) ? null : bookingCode.Trim();
        // Retry the idempotent Oracle update once with a fresh connection so a
        // transient Oracle socket timeout does not leave HIS at CHO_GUI.
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            using var statusTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            statusTimeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
            var statusCancellationToken = statusTimeout.Token;

            try
            {
                await using var oracle = new OracleConnection(oracleConnectionString);
                await oracle.OpenAsync(statusCancellationToken);
                var affected = await oracle.ExecuteAsync(new CommandDefinition(
                    """
                update hgsoft_soyba.dangkykham
                set trangthai_zalo = :Status,
                    ngaygui_zalo = case when :Status = 'DA_GUI' then nvl(ngaygui_zalo, sysdate) else ngaygui_zalo end,
                    loi_zalo = case when :Status = 'DA_GUI' then null else :Error end,
                    ngaycapnhat = sysdate
                where (
                    (:HasHisOnlineBookingId = 1 and id = :HisOnlineBookingId)
                    or (:BookingCode is not null and madatcho = :BookingCode)
                  )
                  and (
                    nvl(trangthai_zalo, 'CHUA_GUI') <> :Status
                    or (:Status = 'DA_GUI' and (ngaygui_zalo is null or loi_zalo is not null))
                  )
                """,
                new
                {
                    Status = status,
                    Error = Truncate(error ?? string.Empty, 1000),
                    HisOnlineBookingId = hisOnlineBookingId ?? 0,
                    HasHisOnlineBookingId = hasHisOnlineBookingId,
                    BookingCode = normalizedBookingCode
                },
                commandTimeout: timeoutSeconds,
                cancellationToken: statusCancellationToken));

                if (affected > 0)
                {
                    logger.LogInformation(
                        "Updated HIS Zalo status {Status} for HGSOFT_SOYBA.DANGKYKHAM id {HisOnlineBookingId}, booking {BookingCode}.",
                        status,
                        hisOnlineBookingId,
                        normalizedBookingCode);
                    return true;
                }

                // An affected-row count of zero can mean the row is already in
                // the requested state. Treat that as success after verifying
                // the row, so reconciliation is idempotent and does not keep
                // rewriting NGAYGUI_ZALO.
                var current = await oracle.QuerySingleOrDefaultAsync<OracleZaloState>(new CommandDefinition(
                    """
                    select nvl(trangthai_zalo, 'CHUA_GUI') as "Status",
                           ngaygui_zalo as "SentAt",
                           loi_zalo as "Error"
                    from hgsoft_soyba.dangkykham
                    where (
                        (:HasHisOnlineBookingId = 1 and id=:HisOnlineBookingId)
                        or (:BookingCode is not null and madatcho=:BookingCode)
                    )
                    """,
                    new
                    {
                        HisOnlineBookingId = hisOnlineBookingId ?? 0,
                        HasHisOnlineBookingId = hasHisOnlineBookingId,
                        BookingCode = normalizedBookingCode
                    },
                    commandTimeout: timeoutSeconds,
                    cancellationToken: statusCancellationToken));

                return current is not null &&
                    string.Equals(current.Status?.Trim(), status, StringComparison.OrdinalIgnoreCase);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex) when (attempt < 2)
            {
                logger.LogWarning(
                    ex,
                    "HIS Zalo status update attempt {Attempt} failed for id {HisOnlineBookingId}, booking {BookingCode}; retrying.",
                    attempt,
                    hisOnlineBookingId,
                    normalizedBookingCode);
                await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "Could not update HGSOFT_SOYBA.DANGKYKHAM Zalo status for id {HisOnlineBookingId}, booking {BookingCode}.",
                    hisOnlineBookingId,
                    normalizedBookingCode);
                return false;
            }
        }

        return false;
    }

    private static string NextOracleZaloStatus(NotificationOutboxItem item)
    {
        var nextAttempt = item.AttemptCount + 1;
        return nextAttempt >= item.MaxAttempts ? "LOI" : "CHO_GUI";
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
            try
            {
                var rawBuilder = new NpgsqlConnectionStringBuilder(trimmed)
                {
                    Timeout = 30,
                    CommandTimeout = 45,
                    KeepAlive = 30,
                    Pooling = false,
                    Multiplexing = false
                };
                return rawBuilder.ConnectionString;
            }
            catch (ArgumentException)
            {
                return trimmed;
            }
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
            Timeout = 30,
            CommandTimeout = 45,
            KeepAlive = 30,
            Pooling = false,
            Multiplexing = false
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
        long? HisOnlineBookingId,
        string? BookingCode,
        string RecipientPhone,
        string TemplateKey,
        string? TemplateId,
        string PayloadJson,
        int AttemptCount,
        int MaxAttempts);

    // Use settable properties here instead of a positional record. Npgsql
    // exposes timestamptz as DateTime, and older Dapper versions cannot bind
    // that reader shape to a DateTimeOffset record constructor reliably.
    private sealed class PendingManualRequest
    {
        public long Id { get; set; }
        public string? BookingCode { get; set; }
        public long? HisOnlineBookingId { get; set; }
        public DateTime? SentAt { get; set; }
    }

    private sealed record OracleZaloState(
        string? Status,
        DateTime? SentAt,
        string? Error);

    private sealed record SentNotification(long OutboxId, long? HisOnlineBookingId, string? BookingCode);

    private sealed record PortalSettingRow(
        [property: JsonPropertyName("setting_key")] string? SettingKey,
        [property: JsonPropertyName("setting_value")] string? SettingValue);
}
