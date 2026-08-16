import { cookies } from "next/headers";
import { okResponse, unauthorizedResponse } from "@/lib/api/responses";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";

export async function GET() {
  const session = getDemoPatientSession(await cookies());

  if (!session) {
    return unauthorizedResponse();
  }

  const patient = await createPatientRepository().getPatientById(session.patientId);
  return okResponse(patient);
}
