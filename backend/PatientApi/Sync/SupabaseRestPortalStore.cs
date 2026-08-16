using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using PatientApi.Models;

namespace PatientApi.Sync;

public sealed class SupabaseRestPortalStore(HttpClient httpClient, IConfiguration configuration)
{
    private readonly string _supabaseUrl = configuration["Supabase:Url"]
        ?? Environment.GetEnvironmentVariable("SUPABASE_URL")
        ?? throw new InvalidOperationException("SUPABASE_URL is not configured.");
    private readonly string _secretKey = configuration["Supabase:SecretKey"]
        ?? Environment.GetEnvironmentVariable("SUPABASE_SECRET_KEY")
        ?? Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
        ?? throw new InvalidOperationException("SUPABASE_SECRET_KEY is not configured.");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AuthAttemptJob?> TryClaimAuthAttemptAsync(string workerId, TimeSpan lockFor, CancellationToken cancellationToken)
    {
        var rows = await RpcAsync<List<AuthAttemptJob>>("portal_claim_auth_attempt", new
        {
            p_worker_id = workerId,
            p_lock_seconds = (int)lockFor.TotalSeconds
        }, cancellationToken);
        return rows.FirstOrDefault();
    }

    public Task CompleteAuthAttemptAsync(Guid attemptId, string status, string? mabn, object? result, string? error, CancellationToken cancellationToken)
        => PatchAsync($"portal_auth_attempts?attempt_id=eq.{Uri.EscapeDataString(attemptId.ToString())}", new
        {
            status,
            mabn,
            result_json = result,
            error_message = error,
            locked_by = (string?)null,
            locked_until = (DateTimeOffset?)null,
            updated_at = DateTimeOffset.UtcNow
        }, cancellationToken);

    public async Task<SyncJob?> TryClaimSyncJobAsync(string workerId, TimeSpan lockFor, CancellationToken cancellationToken)
    {
        var rows = await RpcAsync<List<SyncJob>>("portal_claim_sync_job", new
        {
            p_worker_id = workerId,
            p_lock_seconds = (int)lockFor.TotalSeconds
        }, cancellationToken);
        return rows.FirstOrDefault();
    }

    public Task CompleteSyncJobAsync(SyncJob job, string status, string? error, DateTimeOffset? nextSync, CancellationToken cancellationToken)
        => RpcAsync<object>("portal_complete_sync_job", new
        {
            p_job_id = job.JobId,
            p_mabn = job.Mabn,
            p_resource_name = job.ResourceName,
            p_resource_id = job.ResourceId,
            p_maql = job.Maql,
            p_status = status,
            p_error = error,
            p_next_sync_after = nextSync
        }, cancellationToken);

    public Task PutLoginAsync<T>(string phone, string citizenId, string mabn, T data, CancellationToken cancellationToken)
        => UpsertAsync("portal_login_lookup?on_conflict=lookup_hash", new[]
        {
            new
            {
                lookup_hash = ReportingStoreLoginHash.Create(phone, citizenId),
                mabn,
                payload_json = data,
                synced_at = DateTimeOffset.UtcNow,
                expires_at = DateTimeOffset.UtcNow.AddHours(24)
            }
        }, cancellationToken);

    public async Task PutAccountProfilesAsync(string accountKey, string phone, string primaryMabn, IReadOnlyList<PatientLinkedProfileDto> profiles, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await UpsertAsync("portal_accounts?on_conflict=account_key", new[]
        {
            new
            {
                account_key = accountKey,
                phone_masked = MaskPhone(phone),
                primary_mabn = primaryMabn,
                updated_at = now
            }
        }, cancellationToken);

        var rows = profiles.Select((profile, index) => new
        {
            account_key = accountKey,
            mabn = profile.HisPatientCode,
            display_name = profile.FullName,
            relationship = index == 0 ? "Bản thân" : profile.Relationship,
            is_default = index == 0,
            last_selected_at = index == 0 ? now : (DateTimeOffset?)null
        }).ToArray();

        if (rows.Length > 0)
        {
            await UpsertAsync("portal_account_profiles?on_conflict=account_key,mabn", rows, cancellationToken);
        }
    }

    public Task PutAsync<T>(string mabn, string resource, string? resourceId, T data, TimeSpan ttl, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return UpsertAsync("portal_resource_snapshots?on_conflict=cache_key", new[]
        {
            new
            {
                cache_key = $"{mabn}:{resource}:{resourceId ?? "_"}",
                mabn,
                resource_name = resource,
                resource_id = resourceId,
                payload_json = data,
                synced_at = now,
                expires_at = now.Add(ttl),
                updated_at = now
            }
        }, cancellationToken);
    }

    private async Task<T> RpcAsync<T>(string functionName, object payload, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, $"rpc/{functionName}", payload);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Supabase RPC {functionName} failed with status {(int)response.StatusCode}: {body}");
        }
        if (string.IsNullOrWhiteSpace(body))
        {
            return default!;
        }
        return JsonSerializer.Deserialize<T>(body, JsonOptions) ?? throw new InvalidOperationException($"Supabase RPC {functionName} returned invalid JSON.");
    }

    private async Task PatchAsync(string path, object payload, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Patch, path, payload);
        request.Headers.TryAddWithoutValidation("Prefer", "return=minimal");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Supabase PATCH {path} failed with status {(int)response.StatusCode}: {body}");
        }
    }

    private async Task UpsertAsync(string path, object payload, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, path, payload);
        request.Headers.TryAddWithoutValidation("Prefer", "resolution=merge-duplicates,return=minimal");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Supabase UPSERT {path} failed with status {(int)response.StatusCode}: {body}");
        }
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path, object payload)
    {
        var request = new HttpRequestMessage(method, $"{_supabaseUrl.TrimEnd('/')}/rest/v1/{path}");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.UserAgent.ParseAdd("AnPhuPatientPortalSyncAgent/1.0");
        request.Headers.TryAddWithoutValidation("apikey", _secretKey);
        request.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
        return request;
    }

    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length <= 6 ? digits : $"{digits[..3]}****{digits[^3..]}";
    }
}

internal static class ReportingStoreLoginHash
{
    public static string Create(string phone, string citizenId)
    {
        var value = $"{Digits(phone)}|{Digits(citizenId)}";
        return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }

    private static string Digits(string value) => new(value.Where(char.IsDigit).ToArray());
}
