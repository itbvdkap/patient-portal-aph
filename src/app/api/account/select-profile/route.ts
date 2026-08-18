import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { selectAccountProfile } from "@/lib/account/portal-account";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { createPatientSessionCookie, getDemoPatientSession } from "@/lib/auth/session";

const selectProfileSchema = z.object({
  mabn: z.string().trim().min(1).max(20),
});

export async function POST(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });
  }

  const parsed = selectProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mã bệnh nhân không hợp lệ." }, { status: 400 });
  }

  const profiles = await selectAccountProfile(session, parsed.data.mabn).catch(() => null);
  if (!profiles) {
    return NextResponse.json({ error: "Hồ sơ này chưa được liên kết với tài khoản." }, { status: 403 });
  }

  const maxAge = 60 * 60 * 8;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    demoSessionCookie,
    createPatientSessionCookie(parsed.data.mabn, maxAge, {
      sessionId: session.sessionId,
      accountId: session.accountId,
      accountKey: session.accountKey,
      phone: session.phone,
      profiles,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    },
  );

  return response;
}
