namespace PatientApi.Models;

public sealed record PatientDto(
    string Id,
    string HisPatientCode,
    string FullName,
    DateOnly BirthDate,
    string Gender,
    string Phone,
    string Address,
    InsuranceCardDto Insurance,
    string CitizenId = "",
    DateOnly? CitizenIssueDate = null);

public sealed record InsuranceCardDto(
    string Id,
    string PatientId,
    string CardNumber,
    string BenefitCode,
    string RegisteredClinic,
    DateOnly ValidFrom,
    DateOnly ValidTo,
    string Status);

public sealed record VisitDto(
    string Id,
    string PatientId,
    string HisVisitId,
    DateTimeOffset VisitDate,
    string DepartmentName,
    string DoctorName,
    string Status,
    string PrimaryDiagnosis,
    string SecondaryDiagnosis,
    string Notes);

public sealed record VisitDetailDto(
    string Id,
    string PatientId,
    string HisVisitId,
    DateTimeOffset VisitDate,
    string DepartmentName,
    string DoctorName,
    string Status,
    string PrimaryDiagnosis,
    string SecondaryDiagnosis,
    string Notes,
    IReadOnlyList<DiagnosisDto> Diagnoses,
    VitalSignsDto VitalSigns,
    IReadOnlyList<ServiceDto> Services,
    PrescriptionDto? Prescription,
    IReadOnlyList<LabResultDto> LabResults,
    IReadOnlyList<ImagingResultDto> ImagingResults,
    string DoctorAdvice,
    DateTimeOffset? FollowUpDate);

public sealed record DiagnosisDto(string Id, string VisitId, string Icd10Code, string DiagnosisName, string DiagnosisType);
public sealed record VitalSignsDto(string BloodPressure, int Pulse, decimal Temperature, decimal Weight, decimal Height, decimal Bmi);
public sealed record ServiceDto(string Id, string VisitId, string ServiceName, DateTimeOffset PerformedAt, string Status);
public sealed record PrescriptionDto(string Id, string VisitId, DateTimeOffset PrescribedAt, string DoctorName, string PayerType, IReadOnlyList<PrescriptionItemDto> Items);
public sealed record PrescriptionItemDto(string Id, string MedicineName, string ActiveIngredient, string Strength, string Route, string Quantity, string Dosage, string Instruction, string PayerType);
public sealed record LabResultDto(string Id, string VisitId, string ServiceName, string TestName, string Result, string Unit, string ReferenceRange, DateTimeOffset PerformedAt, string Flag);
public sealed record ImagingResultDto(string Id, string VisitId, DateTimeOffset Date, string TechniqueName, string DoctorName, string Description, string Conclusion);
public sealed record AppointmentDto(string Id, string PatientId, DateTimeOffset AppointmentDate, string DepartmentName, string DoctorName, string Content);
public sealed record RegistrationDto(
    string Id,
    string PatientId,
    string VisitId,
    DateTimeOffset RegisteredAt,
    string TicketNumber,
    string DepartmentCode,
    string DepartmentName,
    string DoctorName,
    string Status,
    string Reason,
    string Notes);

public sealed record ActiveServiceDto(
    string Id,
    string VisitId,
    DateTimeOffset OrderedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? ResultAt,
    string DepartmentName,
    string ServiceName,
    string ServiceGroup,
    string Status);

public sealed record TodayVisitStatusDto(
    bool HasActiveVisit,
    string CurrentStep,
    string CurrentStepText,
    RegistrationDto? Registration,
    IReadOnlyList<ActiveServiceDto> Services);

public sealed record PatientSummaryDto(
    int VisitsCount,
    int LabResultsCount,
    int ImagingResultsCount,
    int PrescriptionsCount,
    int AppointmentsCount);

public sealed record PatientLoginVerificationDto(
    string HisPatientCode,
    string FullName,
    string Phone,
    IReadOnlyList<PatientLinkedProfileDto> Profiles);

public sealed record PatientLinkedProfileDto(
    string HisPatientCode,
    string FullName,
    string Relationship);

public sealed record PatientProfileLookupDto(
    string HisPatientCode,
    string PatientCodeMasked,
    string FullName,
    string PhoneMasked,
    string BirthDateMasked);
