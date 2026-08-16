import { ApiPatientRepository } from "@/lib/data/api-patient-repository";
import { MockPatientRepository } from "@/lib/data/mock-patient-repository";
import type { PatientRepository } from "@/lib/data/patient-repository";
import { SupabasePatientRepository } from "@/lib/data/supabase-patient-repository";

export function createPatientRepository(): PatientRepository {
  if (process.env.PATIENT_DATA_MODE === "supabase") {
    return new SupabasePatientRepository();
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return new ApiPatientRepository();
  }

  return new MockPatientRepository();
}
