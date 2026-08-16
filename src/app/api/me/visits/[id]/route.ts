import { cookies } from "next/headers";
import { notFoundResponse, okResponse, unauthorizedResponse } from "@/lib/api/responses";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getDemoPatientSession(await cookies());

  if (!session) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const visit = await createPatientRepository().getVisitDetail(session.patientId, id);

  if (!visit) {
    return notFoundResponse();
  }

  return okResponse(visit);
}
