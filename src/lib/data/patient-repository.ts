import type {
  Appointment,
  ImagingResult,
  InsuranceCard,
  LabResult,
  Patient,
  PatientSummary,
  Prescription,
  Registration,
  TodayVisitStatus,
  Visit,
  VisitDetail,
} from "@/types/patient";

export interface PatientRepository {
  getCurrentPatient(): Promise<Patient>;
  getSummary(patientId: string): Promise<PatientSummary>;
  getPatientById(patientId: string): Promise<Patient | null>;
  getVisits(patientId: string): Promise<Visit[]>;
  getVisitDetail(patientId: string, visitId: string): Promise<VisitDetail | null>;
  getLabResults(patientId: string, visitId?: string): Promise<LabResult[]>;
  getImagingResults(patientId: string): Promise<ImagingResult[]>;
  getPrescriptions(patientId: string): Promise<Prescription[]>;
  getInsurance(patientId: string): Promise<InsuranceCard | null>;
  getAppointments(patientId: string): Promise<Appointment[]>;
  getTodayVisitStatus(patientId: string): Promise<TodayVisitStatus>;
  getRegistrations(patientId: string): Promise<Registration[]>;
}
