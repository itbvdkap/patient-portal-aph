export type Gender = "Nam" | "Nữ" | "Khác";

export interface Patient {
  id: string;
  hisPatientCode: string;
  fullName: string;
  birthDate: string;
  gender: Gender;
  phone: string;
  address: string;
  citizenId?: string;
  citizenIssueDate?: string;
  soCCCD?: string;
  ngayCap?: string;
  insurance: InsuranceCard;
}

export interface InsuranceCard {
  id: string;
  patientId: string;
  cardNumber: string;
  benefitCode: string;
  registeredClinic: string;
  validFrom: string;
  validTo: string;
  status: "Còn hiệu lực" | "Hết hiệu lực";
}

export interface VitalSigns {
  bloodPressure: string;
  pulse: number;
  temperature: number;
  weight: number;
  height: number;
  bmi: number;
}

export interface Diagnosis {
  id: string;
  visitId: string;
  icd10Code: string;
  diagnosisName: string;
  diagnosisType: "Chính" | "Phụ";
}

export interface Service {
  id: string;
  visitId: string;
  serviceName: string;
  performedAt: string;
  status: string;
}

export interface PrescriptionItem {
  id: string;
  medicineName: string;
  activeIngredient: string;
  strength: string;
  route: string;
  quantity: string;
  dosage: string;
  instruction: string;
  payerType?: string;
}

export interface Prescription {
  id: string;
  visitId: string;
  prescribedAt: string;
  doctorName: string;
  payerType?: string;
  items: PrescriptionItem[];
}

export interface LabResult {
  id: string;
  visitId: string;
  serviceName?: string;
  testName: string;
  result: number | string;
  unit: string;
  referenceRange: string;
  performedAt: string;
  flag: "Cao" | "Thấp" | "Bình thường";
}

export interface ImagingResult {
  id: string;
  visitId: string;
  date: string;
  techniqueName: string;
  doctorName: string;
  description: string;
  conclusion: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  appointmentDate: string;
  departmentName: string;
  doctorName: string;
  content: string;
}

export interface Registration {
  id: string;
  patientId: string;
  visitId: string;
  registeredAt: string;
  ticketNumber: string;
  departmentCode: string;
  departmentName: string;
  doctorName: string;
  status: string;
  reason: string;
  notes: string;
}

export interface ActiveService {
  id: string;
  visitId: string;
  orderedAt: string;
  startedAt?: string;
  resultAt?: string;
  departmentName: string;
  serviceName: string;
  serviceGroup: string;
  status: string;
}

export interface TodayVisitStatus {
  hasActiveVisit: boolean;
  currentStep: string;
  currentStepText: string;
  registration?: Registration | null;
  services: ActiveService[];
}

export interface PatientSummary {
  visitsCount: number;
  labResultsCount: number;
  imagingResultsCount: number;
  prescriptionsCount: number;
  appointmentsCount: number;
}

export interface Visit {
  id: string;
  patientId: string;
  hisVisitId: string;
  visitDate: string;
  departmentName: string;
  doctorName: string;
  status: string;
  primaryDiagnosis: string;
  secondaryDiagnosis?: string;
  notes: string;
}

export interface VisitDetail extends Visit {
  diagnoses: Diagnosis[];
  vitalSigns: VitalSigns;
  services: Service[];
  prescription?: Prescription;
  labResults: LabResult[];
  imagingResults: ImagingResult[];
  doctorAdvice: string;
  followUpDate?: string;
}
