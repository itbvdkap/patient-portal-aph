import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { generateOtp, hashOtp, maskedOtpPhone, maxOtpAttempts, otpProvider, otpTtlMinutes, sendOtpMessage } from "@/lib/auth/otp";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const sendOtpSchema = z.object({
  phone: z.string().trim().min(9).max(20),
  cf_turnstile_response: z.string().trim().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const parsed = sendOtpSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại hợp lệ." }, { status: 400 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Số điện thoại không hợp lệ." }, { status: 400 });
  }

  try {
    const turnstile = await verifyTurnstileToken(parsed.data.cf_turnstile_response, request);
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.message }, { status: 403 });
    }

    const provider = otpProvider();
    const otp = generateOtp(provider);
    const sendResult = await sendOtpMessage(phone, otp, provider);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + otpTtlMinutes() * 60 * 1000).toISOString();
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("portal_otp_attempts").insert({
      phone,
      phone_masked: maskedOtpPhone(phone),
      otp_hash: hashOtp(phone, otp),
      provider,
      status: sendResult.sent ? "sent" : "failed",
      send_result: sendResult,
      expires_at: expiresAt,
      max_attempts: maxOtpAttempts(),
    });

    if (error) {
      console.error("OTP attempt insert failed", error);
      return NextResponse.json({ error: "Không ghi được phiên OTP. Vui lòng thử lại sau." }, { status: 502 });
    }

    if (!sendResult.sent) {
      return NextResponse.json({ error: sendResult.message ?? "Zalo chưa chấp nhận gửi OTP." }, { status: 502 });
    }

    return NextResponse.json({
      data: {
        phone,
        provider,
        expiresAt,
        testOtp: provider === "test" ? otp : undefined,
      },
    });
  } catch (error) {
    console.error("OTP send endpoint failed", error);
    return NextResponse.json({ error: "Hệ thống gửi OTP chưa sẵn sàng. Vui lòng kiểm tra cấu hình Zalo hoặc dùng AUTH_OTP_PROVIDER=test." }, { status: 503 });
  }
}
