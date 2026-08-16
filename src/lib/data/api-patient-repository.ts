import { cookies } from "next/headers";
import { getDemoPatientSession } from "@/lib/auth/session";
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
import type { PatientRepository } from "@/lib/data/patient-repository";

interface ApiEnvelope<T> {
  data: T;
}

export class ApiPatientRepository implements PatientRepository {
  private readonly baseUrl: string;
  private readonly serverToken?: string;

  constructor(baseUrl = process.env.PATIENT_API_BASE_URL, serverToken = process.env.PATIENT_API_SERVER_TOKEN) {
    if (!baseUrl) {
      throw new Error("PATIENT_API_BASE_URL is not configured.");
    }

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.serverToken = serverToken;
  }

  async getCurrentPatient() {
    return this.fetchData<Patient>("/api/me", await this.getCurrentSessionPatientId());
  }

  async getSummary(patientId: string) {
    return this.fetchData<PatientSummary>("/api/me/summary", patientId);
  }

  async getPatientById(patientId: string) {
    const patient = await this.fetchData<Patient>("/api/me", patientId);
    return patient.id === patientId ? patient : null;
  }

  async getVisits(patientId: string) {
    return this.fetchData<Visit[]>("/api/me/visits", patientId);
  }

  async getVisitDetail(patientId: string, visitId: string) {
    const response = await this.fetchRaw<ApiEnvelope<VisitDetail>>(`/api/me/visits/${encodeURIComponent(visitId)}`, patientId);

    if (response.status === 404) {
      return null;
    }

    return response.body.data;
  }

  async getLabResults(patientId: string, visitId?: string) {
    const query = visitId ? `?visitId=${encodeURIComponent(visitId)}` : "";
    return this.fetchData<LabResult[]>(`/api/me/lab-results${query}`, patientId);
  }

  async getImagingResults(patientId: string) {
    return this.fetchData<ImagingResult[]>("/api/me/imaging", patientId);
  }

  async getPrescriptions(patientId: string) {
    return this.fetchData<Prescription[]>("/api/me/prescriptions", patientId);
  }

  async getInsurance(patientId: string) {
    return this.fetchData<InsuranceCard | null>("/api/me/insurance", patientId);
  }

  async getAppointments(patientId: string) {
    return this.fetchData<Appointment[]>("/api/me/appointments", patientId);
  }

  async getTodayVisitStatus(patientId: string) {
    return this.fetchData<TodayVisitStatus>("/api/me/today-visit", patientId);
  }

  async getRegistrations(patientId: string) {
    return this.fetchData<Registration[]>("/api/me/registrations", patientId);
  }

  private async fetchData<T>(path: string, patientId?: string) {
    const response = await this.fetchRaw<ApiEnvelope<T>>(path, patientId);
    return response.body.data;
  }

  private async getCurrentSessionPatientId() {
    return getDemoPatientSession(await cookies())?.patientId;
  }

  private async fetchRaw<T>(path: string, patientId?: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const hisPatientCode = patientId?.startsWith("his-") ? patientId.slice("his-".length) : undefined;

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(this.serverToken ? { Authorization: `Bearer ${this.serverToken}` } : {}),
          ...(hisPatientCode ? { "X-His-Patient-Code": hisPatientCode } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Patient API request failed with status ${response.status}.`);
      }

      return {
        status: response.status,
        body: (await response.json()) as T,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
