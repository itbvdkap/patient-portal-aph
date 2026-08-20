import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { maskPhone } from "@/lib/auth/phone";
import { getDemoPatientSession } from "@/lib/auth/session";

export async function GET() {
  const session = getDemoPatientSession(await cookies());

  if (!session) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      sessionId: session.sessionId,
      accountId: session.accountId,
      accountKey: session.accountKey,
      phoneMasked: session.phone ? maskPhone(session.phone) : undefined,
      currentMabn: session.mabn || undefined,
      profiles: session.profiles,
    },
  });
}
