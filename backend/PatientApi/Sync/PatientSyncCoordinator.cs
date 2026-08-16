using PatientApi.Models;
using PatientApi.Repositories;
using System.Collections.Concurrent;
using System.Threading.Channels;

namespace PatientApi.Sync;

public sealed class PatientSyncCoordinator(
    ReportingStore store,
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<PatientSyncCoordinator> logger) : BackgroundService
{
    private readonly Channel<QueuedSync> _queue = Channel.CreateBounded<QueuedSync>(new BoundedChannelOptions(1000)
    {
        FullMode = BoundedChannelFullMode.Wait,
        SingleReader = false,
        SingleWriter = false
    });
    private readonly ConcurrentDictionary<string, TaskCompletionSource<bool>> _active = new();

    public async Task QueueAsync(SyncRequest request, bool waitForCompletion, CancellationToken cancellationToken)
    {
        var key = Key(request);
        var created = false;
        var completion = _active.GetOrAdd(key, _ =>
        {
            created = true;
            return new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        });
        if (created)
        {
            var jobId = await store.MarkQueuedAsync(request, cancellationToken);
            await _queue.Writer.WriteAsync(new QueuedSync(request, jobId, completion), cancellationToken);
        }

        if (!waitForCompletion) return;
        var seconds = Math.Clamp(configuration.GetValue("PatientPortal:InitialSyncWaitSeconds", 20), 1, 60);
        await completion.Task.WaitAsync(TimeSpan.FromSeconds(seconds), cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await store.EnsureSchemaAsync(stoppingToken);
        var concurrency = Math.Clamp(configuration.GetValue("PatientPortal:SyncWorkerConcurrency", 3), 1, 5);
        await Task.WhenAll(Enumerable.Range(0, concurrency).Select(_ => ConsumeAsync(stoppingToken)));
    }

    private async Task ConsumeAsync(CancellationToken cancellationToken)
    {
        await foreach (var queued in _queue.Reader.ReadAllAsync(cancellationToken))
        {
            try
            {
                await store.MarkStateAsync(queued.Request, queued.JobId, "running", null, null, cancellationToken);
                using var scope = scopeFactory.CreateScope();
                var source = scope.ServiceProvider.GetRequiredService<OracleHisPatientRepository>();
                await SyncResourceAsync(source, queued.Request, cancellationToken);
                await store.MarkStateAsync(queued.Request, queued.JobId, "success", null, DateTimeOffset.UtcNow.Add(Ttl(queued.Request.ResourceName)), cancellationToken);
                queued.Completion.TrySetResult(true);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Patient sync failed for {Mabn}/{Resource}/{ResourceId}", queued.Request.Mabn, queued.Request.ResourceName, queued.Request.ResourceId);
                await store.MarkStateAsync(queued.Request, queued.JobId, "failed", ex.Message, null, cancellationToken);
                queued.Completion.TrySetException(ex);
            }
            finally
            {
                _active.TryRemove(Key(queued.Request), out _);
            }
        }
    }

    private async Task SyncResourceAsync(OracleHisPatientRepository source, SyncRequest request, CancellationToken ct)
    {
        var ttl = Ttl(request.ResourceName);
        switch (request.ResourceName)
        {
            case "login":
                var login = await source.VerifyLoginAsync(request.Phone!, request.CitizenId!, ct);
                if (login is not null) await store.PutLoginAsync(request.Phone!, request.CitizenId!, login.HisPatientCode, login, ct);
                break;
            case "patient_profile": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetPatientAsync(request.Mabn, ct), ttl, ct); break;
            case "summary": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetSummaryAsync(request.Mabn, ct), ttl, ct); break;
            case "visits": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetVisitsAsync(request.Mabn, ct), ttl, ct); break;
            case "visit_detail": await store.PutAsync(request.Mabn, request.ResourceName, request.ResourceId, await source.GetVisitDetailAsync(request.Mabn, request.ResourceId!, ct), ttl, ct); break;
            case "lab_results": await store.PutAsync(request.Mabn, request.ResourceName, request.ResourceId, await source.GetLabResultsAsync(request.Mabn, ct, request.ResourceId), ttl, ct); break;
            case "imaging_results": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetImagingResultsAsync(request.Mabn, ct), ttl, ct); break;
            case "prescriptions": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetPrescriptionsAsync(request.Mabn, ct), ttl, ct); break;
            case "insurance": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetInsuranceAsync(request.Mabn, ct), ttl, ct); break;
            case "appointments": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetAppointmentsAsync(request.Mabn, ct), ttl, ct); break;
            case "today_visit": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetTodayVisitStatusAsync(request.Mabn, ct), ttl, ct); break;
            case "registrations": await store.PutAsync(request.Mabn, request.ResourceName, null, await source.GetRegistrationsAsync(request.Mabn, ct), ttl, ct); break;
            case "all":
                foreach (var resource in new[] { "patient_profile", "summary", "visits", "lab_results", "imaging_results", "prescriptions", "insurance", "appointments", "today_visit", "registrations" })
                    await SyncResourceAsync(source, request with { ResourceName = resource }, ct);
                break;
            default: throw new InvalidOperationException($"Unknown sync resource: {request.ResourceName}");
        }
    }

    public static TimeSpan Ttl(string resource) => resource switch
    {
        "patient_profile" => TimeSpan.FromHours(24),
        "insurance" => TimeSpan.FromHours(6),
        "today_visit" => TimeSpan.FromSeconds(45),
        "appointments" => TimeSpan.FromMinutes(3),
        "summary" or "visits" or "registrations" => TimeSpan.FromMinutes(10),
        _ => TimeSpan.FromMinutes(10)
    };

    private static string Key(SyncRequest request) => $"{request.Mabn}:{request.ResourceName}:{request.ResourceId ?? "_"}";
    private sealed record QueuedSync(SyncRequest Request, long JobId, TaskCompletionSource<bool> Completion);
}
