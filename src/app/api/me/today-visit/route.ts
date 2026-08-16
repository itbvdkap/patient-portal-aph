import { cookies } from "next/headers";
import { okResponse, unauthorizedResponse } from "@/lib/api/responses";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";

export async function GET() {
  const session = getDemoPatientSession(await cookies());

  if (!session) {
    return unauthorizedResponse();
  }

  let status;

  try {
    status = await createPatientRepository().getTodayVisitStatus(session.patientId);
  } catch {
    status = {
      hasActiveVisit: false,
      currentStep: "ERROR",
      currentStepText: "Chưa tải được dữ liệu hôm nay",
      registration: null,
      services: [],
    };
  }

  return okResponse(status);
}
