import { NextResponse } from "next/server";
import { z } from "zod";
import { recordPortalPasswordLogin, verifyPortalAccountPassword } from "@/lib/account/portal-account";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { createPatientSessionCookie } from "@/lib/auth/session";
import { enqueuePatientSync } from "@/lib/supabase/portal-sync";

const schema = z.object({
  phone: z.string().trim().min(9).max(20),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại và mật khẩu." }, { status: 400 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);
  const account = await verifyPortalAccountPassword(phone, parsed.data.password);
  if (!account) {
    return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu không đúng." }, { status: 401 });
  }

  const maxAge = parsed.data.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
  const { sessionId, accountKey, mabn, profiles } = await recordPortalPasswordLogin({
    accountId: account.accountId,
    phone,
    request,
    maxAgeSeconds: maxAge,
  });
  const response = NextResponse.json({
    data: {
      accountId: account.accountId,
      hasLinkedProfile: Boolean(mabn),
      currentMabn: mabn || null,
    },
  });

  response.cookies.set(
    demoSessionCookie,
    createPatientSessionCookie(mabn, maxAge, {
      sessionId,
      accountId: account.accountId,
      accountKey,
      phone,
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

  if (mabn && process.env.PATIENT_DATA_MODE === "supabase") {
    void enqueuePatientSync(mabn, "all").catch(() => undefined);
  }

  return response;
}
