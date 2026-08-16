using PatientApi.Models;

namespace PatientApi.Repositories;

public interface IPatientRepository
{
    Task<PatientLoginVerificationDto?> VerifyLoginAsync(string phone, string citizenId, CancellationToken cancellationToken);
    Task<PatientLoginVerificationDto?> VerifyLinkedProfileAsync(string hisPatientCode, string phone, string citizenId, DateOnly birthDate, CancellationToken cancellationToken);
    Task<PatientDto?> GetPatientAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<PatientSummaryDto> GetSummaryAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<IReadOnlyList<VisitDto>> GetVisitsAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<VisitDetailDto?> GetVisitDetailAsync(string hisPatientCode, string visitId, CancellationToken cancellationToken);
    Task<IReadOnlyList<LabResultDto>> GetLabResultsAsync(string hisPatientCode, CancellationToken cancellationToken, string? visitId = null);
    Task<IReadOnlyList<ImagingResultDto>> GetImagingResultsAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<IReadOnlyList<PrescriptionDto>> GetPrescriptionsAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<InsuranceCardDto?> GetInsuranceAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<IReadOnlyList<AppointmentDto>> GetAppointmentsAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<TodayVisitStatusDto> GetTodayVisitStatusAsync(string hisPatientCode, CancellationToken cancellationToken);
    Task<IReadOnlyList<RegistrationDto>> GetRegistrationsAsync(string hisPatientCode, CancellationToken cancellationToken);
}
