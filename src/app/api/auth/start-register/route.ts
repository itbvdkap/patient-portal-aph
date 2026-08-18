import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalAccountByPhone } from "@/lib/account/portal-account";
import { createOtpAttempt } from "@/lib/auth/otp-attempts";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const schema = z.object({
  phone: z.string().trim().min(9).max(20),
  fullName: z.string().trim().min(2).max(120),
  cf_turnstile_response: z.string().trim().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập họ tên và số điện thoại hợp lệ." }, { status: 400 });
  }

  const turnstile = await verifyTurnstileToken(parsed.data.cf_turnstile_response, request);
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.message }, { status: 403 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Số điện thoại không hợp lệ." }, { status: 400 });
  }

  const account = await getPortalAccountByPhone(phone);
  if (account?.hasPassword) {
    return NextResponse.json({ error: "Số điện thoại này đã có tài khoản. Vui lòng đăng nhập bằng mật khẩu." }, { status: 409 });
  }

  try {
    const data = await createOtpAttempt(phone, "register");
    return NextResponse.json({ data: { ...data, fullName: parsed.data.fullName } });
  } catch (error) {
    console.error("Start register failed", error);
    return NextResponse.json({ error: "Chưa gửi được OTP. Vui lòng thử lại sau." }, { status: 503 });
  }
}
