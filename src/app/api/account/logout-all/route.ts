import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeAllAccountSessions } from "@/lib/account/portal-account";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { getDemoPatientSession } from "@/lib/auth/session";

export async function POST() {
  const session = getDemoPatientSession(await cookies());
  if (session) {
    await revokeAllAccountSessions(session).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoSessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
