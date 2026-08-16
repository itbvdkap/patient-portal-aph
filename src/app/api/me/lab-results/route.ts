import { cookies } from "next/headers";
import { okResponse, unauthorizedResponse } from "@/lib/api/responses";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";

export async function GET(request: Request) {
  const session = getDemoPatientSession(await cookies());

  if (!session) {
    return unauthorizedResponse();
  }

  const visitId = new URL(request.url).searchParams.get("visitId") ?? undefined;
  const results = await createPatientRepository().getLabResults(session.patientId, visitId);
  return okResponse(results);
}
