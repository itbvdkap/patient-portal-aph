using PatientApi.Models;
using PatientApi.Sync;

namespace PatientApi.Repositories;

public sealed class ReportingPatientRepository(ReportingStore store, PatientSyncCoordinator sync) : IPatientRepository
{
    public async Task<PatientLoginVerificationDto?> VerifyLoginAsync(string phone, string citizenId, CancellationToken ct)
    {
        var cached = await store.GetLoginAsync<PatientLoginVerificationDto>(phone, citizenId, ct);
        if (cached is not null) return cached;
        await sync.QueueAsync(new SyncRequest("auth", "login", Phone: phone, CitizenId: citizenId), true, ct);
        return await store.GetLoginAsync<PatientLoginVerificationDto>(phone, citizenId, ct);
    }

    public Task<PatientLoginVerificationDto?> VerifyLinkedProfileAsync(string hisPatientCode, string phone, string citizenId, DateOnly birthDate, CancellationToken ct)
        => Task.FromResult<PatientLoginVerificationDto?>(null);

    public Task<PatientDto?> GetPatientAsync(string mabn, CancellationToken ct) => ReadAsync<PatientDto?>(mabn, "patient_profile", null, ct);
    public Task<PatientSummaryDto> GetSummaryAsync(string mabn, CancellationToken ct) => ReadAsync<PatientSummaryDto>(mabn, "summary", null, ct);
    public Task<IReadOnlyList<VisitDto>> GetVisitsAsync(string mabn, CancellationToken ct) => ReadListAsync<VisitDto>(mabn, "visits", null, ct);
    public Task<VisitDetailDto?> GetVisitDetailAsync(string mabn, string visitId, CancellationToken ct) => ReadAsync<VisitDetailDto?>(mabn, "visit_detail", visitId, ct);
    public Task<IReadOnlyList<LabResultDto>> GetLabResultsAsync(string mabn, CancellationToken ct, string? visitId = null) => ReadListAsync<LabResultDto>(mabn, "lab_results", visitId, ct);
    public Task<IReadOnlyList<ImagingResultDto>> GetImagingResultsAsync(string mabn, CancellationToken ct) => ReadListAsync<ImagingResultDto>(mabn, "imaging_results", null, ct);
    public Task<IReadOnlyList<PrescriptionDto>> GetPrescriptionsAsync(string mabn, CancellationToken ct) => ReadListAsync<PrescriptionDto>(mabn, "prescriptions", null, ct);
    public Task<InsuranceCardDto?> GetInsuranceAsync(string mabn, CancellationToken ct) => ReadAsync<InsuranceCardDto?>(mabn, "insurance", null, ct);
    public Task<IReadOnlyList<AppointmentDto>> GetAppointmentsAsync(string mabn, CancellationToken ct) => ReadListAsync<AppointmentDto>(mabn, "appointments", null, ct);
    public Task<TodayVisitStatusDto> GetTodayVisitStatusAsync(string mabn, CancellationToken ct) => ReadAsync<TodayVisitStatusDto>(mabn, "today_visit", null, ct);
    public Task<IReadOnlyList<RegistrationDto>> GetRegistrationsAsync(string mabn, CancellationToken ct) => ReadListAsync<RegistrationDto>(mabn, "registrations", null, ct);

    private async Task<IReadOnlyList<T>> ReadListAsync<T>(string mabn, string resource, string? id, CancellationToken ct)
        => await ReadAsync<List<T>>(mabn, resource, id, ct) ?? [];

    private async Task<T> ReadAsync<T>(string mabn, string resource, string? id, CancellationToken ct)
    {
        var snapshot = await store.GetAsync<T>(mabn, resource, id, ct);
        if (snapshot is not null)
        {
            if (!snapshot.IsFresh) _ = sync.QueueAsync(new SyncRequest(mabn, resource, id), false, CancellationToken.None);
            return snapshot.Data;
        }

        await sync.QueueAsync(new SyncRequest(mabn, resource, id), true, ct);
        var refreshed = await store.GetAsync<T>(mabn, resource, id, ct);
        return refreshed is null ? default! : refreshed.Data;
    }
}
