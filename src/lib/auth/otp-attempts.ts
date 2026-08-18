import { generateOtp, hashOtp, maskedOtpPhone, maxOtpAttempts, otpProvider, otpTtlMinutes, sendOtpMessage, verifyOtpHash } from "@/lib/auth/otp";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function createOtpAttempt(phone: string, purpose: "register" | "reset_password") {
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
    purpose,
    status: sendResult.sent ? "sent" : "failed",
    send_result: sendResult,
    expires_at: expiresAt,
    max_attempts: maxOtpAttempts(),
  });

  if (error) {
    throw new Error(`Cannot create OTP attempt: ${error.message}`);
  }

  if (!sendResult.sent) {
    throw new Error(sendResult.message ?? "Zalo OTP send failed.");
  }

  return {
    phone,
    provider,
    expiresAt,
    testOtp: provider === "test" ? otp : undefined,
  };
}

export async function consumeOtpAttempt(phone: string, otp: string, purpose: "register" | "reset_password") {
  const supabase = createSupabaseServiceClient();
  const { data: attempt, error } = await supabase
    .from("portal_otp_attempts")
    .select("id,otp_hash,expires_at,consumed_at,attempt_count,max_attempts")
    .eq("phone", phone)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !attempt) {
    return { ok: false, status: 401, error: "Không tìm thấy mã OTP còn hiệu lực. Vui lòng gửi lại mã." };
  }

  if (attempt.consumed_at || new Date(attempt.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 401, error: "Mã OTP đã hết hạn. Vui lòng gửi lại mã." };
  }

  if (attempt.attempt_count >= attempt.max_attempts) {
    return { ok: false, status: 429, error: "Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng gửi lại mã." };
  }

  if (!verifyOtpHash(phone, otp, attempt.otp_hash)) {
    await supabase
      .from("portal_otp_attempts")
      .update({ attempt_count: attempt.attempt_count + 1, status: "failed" })
      .eq("id", attempt.id);
    return { ok: false, status: 401, error: "Mã OTP không đúng." };
  }

  await supabase
    .from("portal_otp_attempts")
    .update({ consumed_at: new Date().toISOString(), status: "verified", attempt_count: attempt.attempt_count + 1 })
    .eq("id", attempt.id);

  return { ok: true };
}
