import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalAccountByPhone } from "@/lib/account/portal-account";
import { createOtpAttempt } from "@/lib/auth/otp-attempts";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const schema = z.object({
  phone: z.string().trim().min(9).max(20),
  cf_turnstile_response: z.string().trim().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại hợp lệ." }, { status: 400 });
  }

  const turnstile = await verifyTurnstileToken(parsed.data.cf_turnstile_response, request);
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.message }, { status: 403 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);
  const account = await getPortalAccountByPhone(phone);
  if (!account?.phoneVerified) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản đã xác minh với số điện thoại này." }, { status: 404 });
  }

  try {
    const data = await createOtpAttempt(phone, "reset_password");
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Forgot password failed", error);
    return NextResponse.json({ error: "Chưa gửi được OTP. Vui lòng thử lại sau." }, { status: 503 });
  }
}
