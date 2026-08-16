namespace PatientApi.Sync;

public sealed record SyncRequest(
    string Mabn,
    string ResourceName,
    string? ResourceId = null,
    string? Phone = null,
    string? CitizenId = null,
    string RequestedBy = "portal");

public sealed record SyncStatusDto(
    string ResourceName,
    string? ResourceId,
    string Status,
    DateTimeOffset? LastSyncedAt,
    DateTimeOffset? NextSyncAfter,
    string? ErrorMessage);

public sealed record ReportingSnapshot<T>(T Data, DateTimeOffset SyncedAt, DateTimeOffset ExpiresAt)
{
    public bool IsFresh => ExpiresAt > DateTimeOffset.UtcNow;
}
