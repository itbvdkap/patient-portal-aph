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
import { isPatientBranchCode, patientBranchName, type PatientBranchCode } from "@anphu/patient-domain";

type SnapshotRow<T> = {
  payload_json: T;
  expires_at: string;
};

type SnapshotValue<T> = {
  data: T;
  fresh: boolean;
};

const missingSnapshotWaitMs = Math.max(0, Number(process.env.SUPABASE_PATIENT_SNAPSHOT_WAIT_MS ?? 8000));
const missingSnapshotPollMs = Math.max(250, Number(process.env.SUPABASE_PATIENT_SNAPSHOT_POLL_MS ?? 1000));

export class SupabasePatientRepository implements PatientRepository {
  async getCurrentPatient() {
    const ref = await this.getCurrentPatientRef();
    const patient = await this.getSnapshot<Patient | null>(ref.mabn, ref.branchCode, "patient_profile", undefined, null);
    if (!patient) {
      throw new Error("Patient profile is not synced yet.");
    }
    return patient;
  }

  async getSummary(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<PatientSummary>(ref.mabn, ref.branchCode, "summary", undefined, {
      visitsCount: 0,
      labResultsCount: 0,
      imagingResultsCount: 0,
      prescriptionsCount: 0,
      appointmentsCount: 0,
    });
  }

  async getPatientById(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<Patient | null>(ref.mabn, ref.branchCode, "patient_profile", undefined, null);
  }

  async getVisits(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<Visit[]>(ref.mabn, ref.branchCode, "visits", undefined, []);
  }

  async getVisitDetail(patientId: string, visitId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<VisitDetail | null>(ref.mabn, ref.branchCode, "visit_detail", visitId, null);
  }

  async getLabResults(patientId: string, visitId?: string) {
    const { mabn, branchCode } = this.patientIdToRef(patientId);

    if (!visitId) {
      return this.getSnapshot<LabResult[]>(mabn, branchCode, "lab_results", undefined, []);
    }

    const visitSnapshot = await this.readSnapshot<LabResult[]>(mabn, branchCode, "lab_results", visitId);
    if (visitSnapshot) {
      if (!visitSnapshot.fresh) {
        void enqueuePatientSync(mabn, "lab_results", visitId, branchCode).catch(() => undefined);
      }

      if (visitSnapshot.data.length > 0) {
        return visitSnapshot.data;
      }
    }

    const allSnapshot = await this.readSnapshot<LabResult[]>(mabn, branchCode, "lab_results", undefined);
    if (allSnapshot) {
      if (!allSnapshot.fresh) {
        void enqueuePatientSync(mabn, "lab_results", undefined, branchCode).catch(() => undefined);
      }

      const results = allSnapshot.data.filter((result) => result.visitId === visitId);
      if (results.length > 0) {
        if (!visitSnapshot) {
          void enqueuePatientSync(mabn, "lab_results", visitId, branchCode).catch(() => undefined);
        }
        return results;
      }
    }

    if (!visitSnapshot) {
      await enqueuePatientSync(mabn, "lab_results", visitId, branchCode);
    }

    return [];
  }

  async getImagingResults(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<ImagingResult[]>(ref.mabn, ref.branchCode, "imaging_results", undefined, []);
  }

  async getPrescriptions(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<Prescription[]>(ref.mabn, ref.branchCode, "prescriptions", undefined, []);
  }

  async getInsurance(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<InsuranceCard | null>(ref.mabn, ref.branchCode, "insurance", undefined, null);
  }

  async getAppointments(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    return this.getSnapshot<Appointment[]>(ref.mabn, ref.branchCode, "appointments", undefined, []);
  }

  async getTodayVisitStatus(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    const status = await this.getSnapshot<TodayVisitStatus>(ref.mabn, ref.branchCode, "today_visit", undefined, {
      hasActiveVisit: false,
      currentStep: "none",
      currentStepText: "Chưa ghi nhận lượt khám đang chờ hoặc đang khám hôm nay.",
      registration: null,
      services: [],
    });
    return normalizeTodayVisitStatus(status, ref.branchCode);
  }

  async getRegistrations(patientId: string) {
    const ref = this.patientIdToRef(patientId);
    const registrations = await this.getSnapshot<Registration[]>(ref.mabn, ref.branchCode, "registrations", undefined, []);
    return registrations.map((registration) => normalizeRegistrationBranch(registration, ref.branchCode));
  }

  private async getSnapshot<T>(mabn: string, branchCode: PatientBranchCode, resourceName: string, resourceId: string | undefined, fallback: T): Promise<T> {
    const snapshot = await this.readSnapshot<T>(mabn, branchCode, resourceName, resourceId);

    if (snapshot) {
      if (!snapshot.fresh) {
        void enqueuePatientSync(mabn, resourceName, resourceId, branchCode).catch(() => undefined);
      }
      return snapshot.data;
    }

    await enqueuePatientSync(mabn, resourceName, resourceId, branchCode);
    const syncedSnapshot = await this.waitForSnapshot<T>(mabn, branchCode, resourceName, resourceId);
    return syncedSnapshot?.data ?? fallback;
  }

  private async waitForSnapshot<T>(mabn: string, branchCode: PatientBranchCode, resourceName: string, resourceId: string | undefined) {
    if (missingSnapshotWaitMs <= 0) {
      return null;
    }

    const started = Date.now();
    while (Date.now() - started < missingSnapshotWaitMs) {
      await sleep(missingSnapshotPollMs);
      const snapshot = await this.readSnapshot<T>(mabn, branchCode, resourceName, resourceId);
      if (snapshot) {
        return snapshot;
      }
    }

    return null;
  }

  private async readSnapshot<T>(
    mabn: string,
    branchCode: PatientBranchCode,
    resourceName: string,
    resourceId: string | undefined
  ): Promise<SnapshotValue<T> | null> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("portal_resource_snapshots")
      .select("payload_json,expires_at")
      .eq("cache_key", this.cacheKey(mabn, branchCode, resourceName, resourceId))
      .maybeSingle<SnapshotRow<T>>();

    if (error) {
      throw new Error(`Supabase snapshot read failed: ${error.message}`);
    }

    if (data?.payload_json !== undefined) {
      return {
        data: data.payload_json,
        fresh: new Date(data.expires_at).getTime() > Date.now(),
      };
    }

    if (branchCode === "CN1") {
      return this.readLegacySnapshot<T>(mabn, resourceName, resourceId);
    }

    return null;
  }

  private async readLegacySnapshot<T>(
    mabn: string,
    resourceName: string,
    resourceId: string | undefined
  ): Promise<SnapshotValue<T> | null> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("portal_resource_snapshots")
      .select("payload_json,expires_at")
      .eq("cache_key", `${mabn}:${resourceName}:${resourceId ?? "_"}`)
      .maybeSingle<SnapshotRow<T>>();

    if (error) {
      throw new Error(`Supabase legacy snapshot read failed: ${error.message}`);
    }

    if (data?.payload_json !== undefined) {
      return {
        data: data.payload_json,
        fresh: new Date(data.expires_at).getTime() > Date.now(),
      };
    }

    return null;
  }

  private async getCurrentPatientRef() {
    const session = getDemoPatientSession(await cookies());
    if (!session) {
      throw new Error("Patient session is missing.");
    }
    return this.patientIdToRef(session.patientId || `his-${session.branchCode}-${session.mabn}`);
  }

  private patientIdToRef(patientId: string): { mabn: string; branchCode: PatientBranchCode } {
    const match = patientId.match(/^his-(CN[13])-(.+)$/);
    if (match) {
      return { branchCode: normalizeBranchCode(match[1]), mabn: match[2] };
    }

    return { branchCode: "CN1", mabn: patientId.startsWith("his-") ? patientId.slice("his-".length) : patientId };
  }

  private cacheKey(mabn: string, branchCode: PatientBranchCode, resourceName: string, resourceId?: string) {
    return `${branchCode}:${mabn}:${resourceName}:${resourceId ?? "_"}`;
  }
}

function normalizeBranchCode(value: unknown): PatientBranchCode {
  return isPatientBranchCode(value) ? value : "CN1";
}

function normalizeRegistrationBranch(registration: Registration, fallbackBranchCode: PatientBranchCode): Registration {
  const branchCode = normalizeBranchCode(registration.branchCode ?? fallbackBranchCode);
  return {
    ...registration,
    branchCode,
    branchName: patientBranchName(branchCode),
  };
}

function normalizeTodayVisitStatus(status: TodayVisitStatus, fallbackBranchCode: PatientBranchCode): TodayVisitStatus {
  const registration = status.registration ? normalizeRegistrationBranch(status.registration, fallbackBranchCode) : status.registration;
  const queueStatus = status.queueStatus
    ? {
        ...status.queueStatus,
        branchCode: normalizeBranchCode(status.queueStatus.branchCode ?? fallbackBranchCode),
        branchName: patientBranchName(normalizeBranchCode(status.queueStatus.branchCode ?? fallbackBranchCode)),
      }
    : status.queueStatus;

  return {
    ...status,
    registration,
    queueStatus,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
