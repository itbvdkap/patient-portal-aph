using Dapper;
using Npgsql;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PatientApi.Sync;

public sealed class ReportingStore(IConfiguration configuration)
{
    private readonly string _connectionString = configuration.GetConnectionString("PortalReporting")
        ?? throw new InvalidOperationException("ConnectionStrings:PortalReporting is not configured.");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task EnsureSchemaAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            create table if not exists portal_resource_snapshots (
              cache_key varchar(255) primary key, mabn varchar(20) not null,
              resource_name varchar(80) not null, resource_id varchar(100),
              payload_json jsonb not null, synced_at timestamptz not null,
              expires_at timestamptz not null, created_at timestamptz not null default now(),
              updated_at timestamptz not null default now());
            create index if not exists idx_portal_resource_snapshots_patient
              on portal_resource_snapshots (mabn, resource_name, resource_id);
            create table if not exists portal_login_lookup (
              lookup_hash char(64) primary key, mabn varchar(20) not null,
              payload_json jsonb not null, synced_at timestamptz not null, expires_at timestamptz not null);
            create table if not exists portal_auth_attempts (
              attempt_id uuid primary key, lookup_hash char(64) not null, encrypted_payload text not null,
              status varchar(30) not null default 'queued', mabn varchar(20), result_json jsonb, error_message text,
              locked_by varchar(100), locked_until timestamptz, expires_at timestamptz not null default now() + interval '10 minutes',
              created_at timestamptz not null default now(), updated_at timestamptz not null default now());
            create index if not exists idx_portal_auth_attempts_pickup
              on portal_auth_attempts (status, created_at) where status in ('queued', 'running');
            create table if not exists portal_sync_state (
              id bigserial primary key, mabn varchar(20) not null, resource_name varchar(80) not null,
              mavaovien varchar(100), maql varchar(30), status varchar(30) not null, last_synced_at timestamptz,
              next_sync_after timestamptz, error_message text, updated_at timestamptz not null default now());
            create unique index if not exists ux_portal_sync_state_key
              on portal_sync_state (mabn, resource_name, coalesce(mavaovien, ''), coalesce(maql, ''));
            create table if not exists portal_sync_jobs (
              job_id bigserial primary key, mabn varchar(20) not null, resource_name varchar(80) not null,
              mavaovien varchar(100), maql varchar(30), status varchar(30) not null, requested_by varchar(100),
              attempt_count integer not null default 0, started_at timestamptz, finished_at timestamptz,
              error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync(new CommandDefinition(sql, cancellationToken: cancellationToken));
    }

    public async Task<ReportingSnapshot<T>?> GetAsync<T>(string mabn, string resource, string? resourceId, CancellationToken cancellationToken)
    {
        const string sql = "select payload_json::text as PayloadJson, synced_at as SyncedAt, expires_at as ExpiresAt from portal_resource_snapshots where cache_key = @Key";
        await using var connection = new NpgsqlConnection(_connectionString);
        var row = await connection.QuerySingleOrDefaultAsync<SnapshotRow>(new CommandDefinition(sql, new { Key = CacheKey(mabn, resource, resourceId) }, cancellationToken: cancellationToken));
        if (row is null) return null;
        var data = JsonSerializer.Deserialize<T>(row.PayloadJson, JsonOptions);
        return data is null ? null : new ReportingSnapshot<T>(data, row.SyncedAt, row.ExpiresAt);
    }

    public async Task<AuthAttemptJob?> TryClaimAuthAttemptAsync(string workerId, TimeSpan lockFor, CancellationToken cancellationToken)
    {
        const string sql = """
            update portal_auth_attempts
            set status='running', locked_by=@WorkerId, locked_until=@LockedUntil, updated_at=now()
            where attempt_id = (
              select attempt_id from portal_auth_attempts
              where status='queued' and expires_at > now()
              order by created_at
              for update skip locked
              limit 1
            )
            returning attempt_id as AttemptId, lookup_hash as LookupHash, encrypted_payload as EncryptedPayload;
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        return await connection.QuerySingleOrDefaultAsync<AuthAttemptJob>(new CommandDefinition(sql, new
        {
            WorkerId = workerId,
            LockedUntil = DateTimeOffset.UtcNow.Add(lockFor)
        }, cancellationToken: cancellationToken));
    }

    public async Task CompleteAuthAttemptAsync(Guid attemptId, string status, string? mabn, object? result, string? error, CancellationToken cancellationToken)
    {
        const string sql = """
            update portal_auth_attempts
            set status=@Status, mabn=@Mabn, result_json=cast(@ResultJson as jsonb), error_message=@Error,
                locked_by=null, locked_until=null, updated_at=now()
            where attempt_id=@AttemptId;
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            AttemptId = attemptId,
            Status = status,
            Mabn = mabn,
            ResultJson = result is null ? null : JsonSerializer.Serialize(result, JsonOptions),
            Error = error
        }, cancellationToken: cancellationToken));
    }

    public async Task<SyncJob?> TryClaimSyncJobAsync(string workerId, TimeSpan lockFor, CancellationToken cancellationToken)
    {
        const string sql = """
            update portal_sync_jobs
            set status='running', locked_by=@WorkerId, locked_until=@LockedUntil,
                started_at=coalesce(started_at, now()), attempt_count=attempt_count+1, updated_at=now()
            where job_id = (
              select job_id from portal_sync_jobs
              where status='queued' and run_after <= now() and attempt_count < max_attempts
              order by priority, run_after, job_id
              for update skip locked
              limit 1
            )
            returning job_id as JobId, mabn as Mabn, resource_name as ResourceName, resource_id as ResourceId, maql as Maql;
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        return await connection.QuerySingleOrDefaultAsync<SyncJob>(new CommandDefinition(sql, new
        {
            WorkerId = workerId,
            LockedUntil = DateTimeOffset.UtcNow.Add(lockFor)
        }, cancellationToken: cancellationToken));
    }

    public async Task CompleteSyncJobAsync(SyncJob job, string status, string? error, DateTimeOffset? nextSync, CancellationToken cancellationToken)
    {
        const string sql = """
            update portal_sync_jobs
            set status=@Status, finished_at=case when @Status in ('success','failed') then now() else finished_at end,
                locked_by=null, locked_until=null, error_message=@Error, updated_at=now()
            where job_id=@JobId;

            insert into portal_sync_state(mabn, resource_name, mavaovien, maql, status, last_synced_at, next_sync_after, error_message)
            values (@Mabn, @ResourceName, @ResourceId, @Maql, @Status,
              case when @Status='success' then now() else null end, @NextSync, @Error)
            on conflict (mabn, resource_name, (coalesce(mavaovien, '')), (coalesce(maql, ''))) do update set
              status=excluded.status,
              last_synced_at=coalesce(excluded.last_synced_at, portal_sync_state.last_synced_at),
              next_sync_after=excluded.next_sync_after,
              error_message=excluded.error_message,
              updated_at=now();
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            job.JobId,
            job.Mabn,
            job.ResourceName,
            job.ResourceId,
            job.Maql,
            Status = status,
            Error = error,
            NextSync = nextSync
        }, cancellationToken: cancellationToken));
    }

    public async Task PutAsync<T>(string mabn, string resource, string? resourceId, T data, TimeSpan ttl, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into portal_resource_snapshots(cache_key, mabn, resource_name, resource_id, payload_json, synced_at, expires_at)
            values (@Key, @Mabn, @Resource, @ResourceId, cast(@Payload as jsonb), @Now, @Expires)
            on conflict (cache_key) do update set payload_json=excluded.payload_json, synced_at=excluded.synced_at,
              expires_at=excluded.expires_at, updated_at=now();
            """;
        var now = DateTimeOffset.UtcNow;
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync(new CommandDefinition(sql, new
        {
            Key = CacheKey(mabn, resource, resourceId), Mabn = mabn, Resource = resource,
            ResourceId = resourceId, Payload = JsonSerializer.Serialize(data, JsonOptions), Now = now, Expires = now.Add(ttl)
        }, cancellationToken: cancellationToken));
    }

    public async Task<T?> GetLoginAsync<T>(string phone, string citizenId, CancellationToken cancellationToken)
    {
        const string sql = "select payload_json::text from portal_login_lookup where lookup_hash=@Hash and expires_at > now()";
        await using var connection = new NpgsqlConnection(_connectionString);
        var json = await connection.QuerySingleOrDefaultAsync<string>(new CommandDefinition(sql, new { Hash = LoginHash(phone, citizenId) }, cancellationToken: cancellationToken));
        return json is null ? default : JsonSerializer.Deserialize<T>(json, JsonOptions);
    }

    public async Task PutLoginAsync<T>(string phone, string citizenId, string mabn, T data, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into portal_login_lookup(lookup_hash, mabn, payload_json, synced_at, expires_at)
            values (@Hash, @Mabn, cast(@Payload as jsonb), now(), now() + interval '24 hours')
            on conflict (lookup_hash) do update set mabn=excluded.mabn, payload_json=excluded.payload_json,
              synced_at=excluded.synced_at, expires_at=excluded.expires_at;
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync(new CommandDefinition(sql, new { Hash = LoginHash(phone, citizenId), Mabn = mabn, Payload = JsonSerializer.Serialize(data, JsonOptions) }, cancellationToken: cancellationToken));
    }

    public async Task<long> MarkQueuedAsync(SyncRequest request, CancellationToken cancellationToken)
    {
        const string sql = """
            insert into portal_sync_jobs(mabn, resource_name, mavaovien, status, requested_by)
            values (@Mabn, @ResourceName, @ResourceId, 'queued', @RequestedBy) returning job_id;
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        return await connection.ExecuteScalarAsync<long>(new CommandDefinition(sql, request, cancellationToken: cancellationToken));
    }

    public async Task MarkStateAsync(SyncRequest request, long jobId, string status, string? error, DateTimeOffset? nextSync, CancellationToken cancellationToken)
    {
        const string stateSql = """
            insert into portal_sync_state(mabn, resource_name, mavaovien, maql, status, last_synced_at, next_sync_after, error_message)
            values (@Mabn, @ResourceName, @ResourceId, null, @Status,
              case when @Status='success' then now() else null end, @NextSync, @Error)
            on conflict (mabn, resource_name, (coalesce(mavaovien, '')), (coalesce(maql, ''))) do update set status=excluded.status,
              last_synced_at=coalesce(excluded.last_synced_at, portal_sync_state.last_synced_at),
              next_sync_after=excluded.next_sync_after, error_message=excluded.error_message, updated_at=now();
            update portal_sync_jobs set status=@Status, attempt_count=attempt_count+1,
              started_at=case when @Status='running' then now() else started_at end,
              finished_at=case when @Status in ('success','failed') then now() else null end,
              error_message=@Error, updated_at=now() where job_id=@JobId;
            """;
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.ExecuteAsync(new CommandDefinition(stateSql, new { request.Mabn, request.ResourceName, request.ResourceId, Status = status, NextSync = nextSync, Error = error, JobId = jobId }, cancellationToken: cancellationToken));
    }

    public async Task<IReadOnlyList<SyncStatusDto>> GetStatusesAsync(string mabn, CancellationToken cancellationToken)
    {
        const string sql = "select resource_name as ResourceName, mavaovien as ResourceId, status as Status, last_synced_at as LastSyncedAt, next_sync_after as NextSyncAfter, error_message as ErrorMessage from portal_sync_state where mabn=@Mabn order by resource_name, mavaovien";
        await using var connection = new NpgsqlConnection(_connectionString);
        var rows = await connection.QueryAsync<StatusRow>(new CommandDefinition(sql, new { Mabn = mabn }, cancellationToken: cancellationToken));
        return rows.Select(x => new SyncStatusDto(x.ResourceName, x.ResourceId, x.Status, x.LastSyncedAt, x.NextSyncAfter, x.ErrorMessage)).ToList();
    }

    private static string CacheKey(string mabn, string resource, string? id) => $"{mabn}:{resource}:{id ?? "_"}";
    private static string LoginHash(string phone, string citizenId) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{Digits(phone)}|{Digits(citizenId)}"))).ToLowerInvariant();
    private static string Digits(string value) => new(value.Where(char.IsDigit).ToArray());

    private sealed record SnapshotRow(string PayloadJson, DateTimeOffset SyncedAt, DateTimeOffset ExpiresAt);
    private sealed record StatusRow(string ResourceName, string? ResourceId, string Status, DateTimeOffset? LastSyncedAt, DateTimeOffset? NextSyncAfter, string? ErrorMessage);
}

public sealed record AuthAttemptJob(Guid AttemptId, string LookupHash, string EncryptedPayload);
public sealed record SyncJob(long JobId, string Mabn, string ResourceName, string? ResourceId, string? Maql);
