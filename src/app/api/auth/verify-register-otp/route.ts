import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertVerifiedPortalAccount, recordPortalPasswordLogin } from "@/lib/account/portal-account";
import { consumeOtpAttempt } from "@/lib/auth/otp-attempts";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { createPatientSessionCookie } from "@/lib/auth/session";
import { demoSessionCookie } from "@/lib/auth/demo-auth";

const schema = z.object({
  phone: z.string().trim().min(9).max(20),
  fullName: z.string().trim().min(2).max(120),
  otp: z.string().trim().regex(/^\d{6,8}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập đủ thông tin và mã OTP hợp lệ." }, { status: 400 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);
  const consumed = await consumeOtpAttempt(phone, parsed.data.otp, "register");
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error }, { status: consumed.status });
  }

  try {
    const { accountId } = await upsertVerifiedPortalAccount({ phone, fullName: parsed.data.fullName });
    const maxAge = 60 * 60 * 24 * 30;
    const { sessionId, accountKey, profiles } = await recordPortalPasswordLogin({
      accountId,
      phone,
      request,
      maxAgeSeconds: maxAge,
      eventType: "register_otp_verified",
    });
    const response = NextResponse.json({ data: { accountId, phone, needsPassword: true } });

    response.cookies.set(
      demoSessionCookie,
      createPatientSessionCookie("", maxAge, {
        sessionId,
        accountId,
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

    return response;
  } catch (error) {
    console.error("Verify register OTP failed", error);
    return NextResponse.json({ error: "Không tạo được tài khoản. Vui lòng thử lại sau." }, { status: 503 });
  }
}
