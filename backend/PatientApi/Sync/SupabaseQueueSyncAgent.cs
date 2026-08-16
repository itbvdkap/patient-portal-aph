using PatientApi.Repositories;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PatientApi.Sync;

public sealed class SupabaseQueueSyncAgent(
    SupabaseRestPortalStore store,
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<SupabaseQueueSyncAgent> logger) : BackgroundService
{
    private readonly string _workerId = $"{Environment.MachineName}-{Guid.NewGuid():N}";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("PatientPortal:EnableSupabaseQueueAgent", false))
        {
            logger.LogInformation("Supabase queue sync agent is disabled.");
            return;
        }

        var concurrency = Math.Clamp(configuration.GetValue("PatientPortal:SupabaseQueueConcurrency", 3), 1, 5);
        await Task.WhenAll(Enumerable.Range(0, concurrency).Select(_ => ConsumeAsync(stoppingToken)));
    }

    private async Task ConsumeAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var didWork = await ProcessOneAuthAttemptAsync(cancellationToken)
                || await ProcessOneSyncJobAsync(cancellationToken);

            if (!didWork)
            {
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
    }

    private async Task<bool> ProcessOneAuthAttemptAsync(CancellationToken cancellationToken)
    {
        var job = await store.TryClaimAuthAttemptAsync(_workerId, TimeSpan.FromMinutes(2), cancellationToken);
        if (job is null) return false;

        try
        {
            var payload = Decrypt<AuthPayload>(job.EncryptedPayload);
            logger.LogInformation("Processing auth attempt {AttemptId}", job.AttemptId);
            using var scope = scopeFactory.CreateScope();
            var oracle = scope.ServiceProvider.GetRequiredService<OracleHisPatientRepository>();
            var verified = await oracle.VerifyLoginAsync(payload.Phone, payload.CitizenId, cancellationToken);

            if (verified is null)
            {
                await store.CompleteAuthAttemptAsync(job.AttemptId, "failed", null, null, "Không tìm thấy hồ sơ phù hợp.", cancellationToken);
                return true;
            }

            await store.PutLoginAsync(payload.Phone, payload.CitizenId, verified.HisPatientCode, verified, cancellationToken);
            await store.PutAccountProfilesAsync(job.LookupHash, payload.Phone, verified.HisPatientCode, verified.Profiles, cancellationToken);
            await store.CompleteAuthAttemptAsync(job.AttemptId, "success", verified.HisPatientCode, verified, null, cancellationToken);
            logger.LogInformation("Auth attempt {AttemptId} verified patient {Mabn}", job.AttemptId, verified.HisPatientCode);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Auth attempt sync failed for {AttemptId}", job.AttemptId);
            await store.CompleteAuthAttemptAsync(job.AttemptId, "failed", null, null, ex.Message, cancellationToken);
            return true;
        }
    }

    private async Task<bool> ProcessOneSyncJobAsync(CancellationToken cancellationToken)
    {
        var job = await store.TryClaimSyncJobAsync(_workerId, TimeSpan.FromMinutes(5), cancellationToken);
        if (job is null) return false;

        try
        {
            logger.LogInformation("Processing sync job {JobId} for {Mabn}/{Resource}/{ResourceId}", job.JobId, job.Mabn, job.ResourceName, job.ResourceId);
            using var scope = scopeFactory.CreateScope();
            var oracle = scope.ServiceProvider.GetRequiredService<OracleHisPatientRepository>();
            await SyncResourceAsync(oracle, job, cancellationToken);
            await store.CompleteSyncJobAsync(job, "success", null, DateTimeOffset.UtcNow.Add(PatientSyncCoordinator.Ttl(job.ResourceName)), cancellationToken);
            logger.LogInformation("Sync job {JobId} completed", job.JobId);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Patient sync job failed for {JobId}", job.JobId);
            await store.CompleteSyncJobAsync(job, "failed", ex.Message, null, cancellationToken);
            return true;
        }
    }

    private async Task SyncResourceAsync(OracleHisPatientRepository source, SyncJob job, CancellationToken ct)
    {
        var ttl = PatientSyncCoordinator.Ttl(job.ResourceName);
        switch (job.ResourceName)
        {
            case "patient_profile": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetPatientAsync(job.Mabn, ct), ttl, ct); break;
            case "summary": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetSummaryAsync(job.Mabn, ct), ttl, ct); break;
            case "visits": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetVisitsAsync(job.Mabn, ct), ttl, ct); break;
            case "visit_detail": await store.PutAsync(job.Mabn, job.ResourceName, job.ResourceId, await source.GetVisitDetailAsync(job.Mabn, job.ResourceId!, ct), ttl, ct); break;
            case "lab_results": await store.PutAsync(job.Mabn, job.ResourceName, job.ResourceId, await source.GetLabResultsAsync(job.Mabn, ct, job.ResourceId), ttl, ct); break;
            case "imaging_results": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetImagingResultsAsync(job.Mabn, ct), ttl, ct); break;
            case "prescriptions": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetPrescriptionsAsync(job.Mabn, ct), ttl, ct); break;
            case "insurance": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetInsuranceAsync(job.Mabn, ct), ttl, ct); break;
            case "appointments": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetAppointmentsAsync(job.Mabn, ct), ttl, ct); break;
            case "today_visit": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetTodayVisitStatusAsync(job.Mabn, ct), ttl, ct); break;
            case "registrations": await store.PutAsync(job.Mabn, job.ResourceName, null, await source.GetRegistrationsAsync(job.Mabn, ct), ttl, ct); break;
            case "all":
                foreach (var resource in new[] { "patient_profile", "summary", "visits", "lab_results", "imaging_results", "prescriptions", "insurance", "appointments", "today_visit", "registrations" })
                {
                    await SyncResourceAsync(source, job with { ResourceName = resource, ResourceId = null }, ct);
                }
                break;
            default: throw new InvalidOperationException($"Unknown sync resource: {job.ResourceName}");
        }
    }

    private T Decrypt<T>(string payload)
    {
        var secret = configuration["PatientPortal:AuthSyncEncryptionKey"]
            ?? Environment.GetEnvironmentVariable("AUTH_SYNC_ENCRYPTION_KEY")
            ?? throw new InvalidOperationException("AUTH_SYNC_ENCRYPTION_KEY is not configured.");
        var parts = payload.Split('.');
        if (parts.Length != 3) throw new InvalidOperationException("Invalid encrypted payload.");

        var salt = Base64UrlDecode(parts[0]);
        var iv = Base64UrlDecode(parts[1]);
        var cipher = Base64UrlDecode(parts[2]);
        var key = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(secret), salt, 100000, HashAlgorithmName.SHA256, 32);
        var plain = new byte[cipher.Length - 16];
        var tag = cipher[^16..];
        var ciphertext = cipher[..^16];

        using var aes = new AesGcm(key, 16);
        aes.Decrypt(iv, ciphertext, tag, plain);
        return JsonSerializer.Deserialize<T>(plain, JsonOptions) ?? throw new InvalidOperationException("Invalid decrypted payload.");
    }

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }

    private sealed record AuthPayload(string Phone, string CitizenId, string AttemptId);
}
