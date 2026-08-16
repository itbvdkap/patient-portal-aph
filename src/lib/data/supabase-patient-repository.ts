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
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { enqueuePatientSync } from "@/lib/supabase/portal-sync";

type SnapshotRow<T> = {
  payload_json: T;
  expires_at: string;
};

export class SupabasePatientRepository implements PatientRepository {
  async getCurrentPatient() {
    const patient = await this.getSnapshot<Patient | null>(await this.getCurrentMabn(), "patient_profile", undefined, null);
    if (!patient) {
      throw new Error("Patient profile is not synced yet.");
    }
    return patient;
  }

  async getSummary(patientId: string) {
    return this.getSnapshot<PatientSummary>(this.patientIdToMabn(patientId), "summary", undefined, {
      visitsCount: 0,
      labResultsCount: 0,
      imagingResultsCount: 0,
      prescriptionsCount: 0,
      appointmentsCount: 0,
    });
  }

  async getPatientById(patientId: string) {
    return this.getSnapshot<Patient | null>(this.patientIdToMabn(patientId), "patient_profile", undefined, null);
  }

  async getVisits(patientId: string) {
    return this.getSnapshot<Visit[]>(this.patientIdToMabn(patientId), "visits", undefined, []);
  }

  async getVisitDetail(patientId: string, visitId: string) {
    return this.getSnapshot<VisitDetail | null>(this.patientIdToMabn(patientId), "visit_detail", visitId, null);
  }

  async getLabResults(patientId: string, visitId?: string) {
    return this.getSnapshot<LabResult[]>(this.patientIdToMabn(patientId), "lab_results", visitId, []);
  }

  async getImagingResults(patientId: string) {
    return this.getSnapshot<ImagingResult[]>(this.patientIdToMabn(patientId), "imaging_results", undefined, []);
  }

  async getPrescriptions(patientId: string) {
    return this.getSnapshot<Prescription[]>(this.patientIdToMabn(patientId), "prescriptions", undefined, []);
  }

  async getInsurance(patientId: string) {
    return this.getSnapshot<InsuranceCard | null>(this.patientIdToMabn(patientId), "insurance", undefined, null);
  }

  async getAppointments(patientId: string) {
    return this.getSnapshot<Appointment[]>(this.patientIdToMabn(patientId), "appointments", undefined, []);
  }

  async getTodayVisitStatus(patientId: string) {
    return this.getSnapshot<TodayVisitStatus>(this.patientIdToMabn(patientId), "today_visit", undefined, {
      hasActiveVisit: false,
      currentStep: "none",
      currentStepText: "Chưa ghi nhận lượt khám đang chờ hoặc đang khám hôm nay.",
      registration: null,
      services: [],
    });
  }

  async getRegistrations(patientId: string) {
    return this.getSnapshot<Registration[]>(this.patientIdToMabn(patientId), "registrations", undefined, []);
  }

  private async getSnapshot<T>(mabn: string, resourceName: string, resourceId: string | undefined, fallback: T): Promise<T> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("portal_resource_snapshots")
      .select("payload_json,expires_at")
      .eq("cache_key", this.cacheKey(mabn, resourceName, resourceId))
      .maybeSingle<SnapshotRow<T>>();

    if (error) {
      throw new Error(`Supabase snapshot read failed: ${error.message}`);
    }

    if (data?.payload_json !== undefined) {
      if (new Date(data.expires_at).getTime() <= Date.now()) {
        void enqueuePatientSync(mabn, resourceName, resourceId).catch(() => undefined);
      }
      return data.payload_json;
    }

    await enqueuePatientSync(mabn, resourceName, resourceId);
    return fallback;
  }

  private async getCurrentMabn() {
    const session = getDemoPatientSession(await cookies());
    if (!session) {
      throw new Error("Patient session is missing.");
    }
    return this.patientIdToMabn(session.patientId);
  }

  private patientIdToMabn(patientId: string) {
    return patientId.startsWith("his-") ? patientId.slice("his-".length) : patientId;
  }

  private cacheKey(mabn: string, resourceName: string, resourceId?: string) {
    return `${mabn}:${resourceName}:${resourceId ?? "_"}`;
  }
}
