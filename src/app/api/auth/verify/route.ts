import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { accountIdFromPhone, verifyOtpHash } from "@/lib/auth/otp";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { createPatientSessionCookie } from "@/lib/auth/session";
import { getLinkedProfilesForAccount, recordPortalOtpLogin } from "@/lib/account/portal-account";
import { enqueuePatientSync } from "@/lib/supabase/portal-sync";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const verifyOtpSchema = z.object({
  phone: z.string().trim().min(9).max(20),
  otp: z.string().trim().regex(/^\d{6,8}$/),
});

export async function POST(request: Request) {
  const parsed = verifyOtpSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại và mã OTP hợp lệ." }, { status: 400 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);

  try {
    const supabase = createSupabaseServiceClient();
    const { data: attempt, error } = await supabase
      .from("portal_otp_attempts")
      .select("id,otp_hash,expires_at,consumed_at,attempt_count,max_attempts")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !attempt) {
      return NextResponse.json({ error: "Không tìm thấy mã OTP còn hiệu lực. Vui lòng gửi lại mã." }, { status: 401 });
    }

    if (attempt.consumed_at || new Date(attempt.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Mã OTP đã hết hạn. Vui lòng gửi lại mã." }, { status: 401 });
    }

    if (attempt.attempt_count >= attempt.max_attempts) {
      return NextResponse.json({ error: "Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng gửi lại mã." }, { status: 429 });
    }

    if (!verifyOtpHash(phone, parsed.data.otp, attempt.otp_hash)) {
      await supabase
        .from("portal_otp_attempts")
        .update({ attempt_count: attempt.attempt_count + 1, status: "failed" })
        .eq("id", attempt.id);
      return NextResponse.json({ error: "Mã OTP không đúng." }, { status: 401 });
    }

    await supabase
      .from("portal_otp_attempts")
      .update({ consumed_at: new Date().toISOString(), status: "verified", attempt_count: attempt.attempt_count + 1 })
      .eq("id", attempt.id);

    const accountId = accountIdFromPhone(phone);
    const maxAge = 60 * 60 * 8;
    const profiles = await getLinkedProfilesForAccount(accountId);
    const currentProfile = profiles.find((profile) => profile.isActive) ?? profiles[0];
    const mabn = currentProfile?.mabn ?? "";
    const { sessionId, accountKey } = await recordPortalOtpLogin({ accountId, phone, mabn, request, maxAgeSeconds: maxAge });
    const response = NextResponse.json({
      data: {
        accountId,
        phone,
        hasLinkedProfile: Boolean(mabn),
        currentMabn: mabn || null,
      },
    });

    response.cookies.set(
      demoSessionCookie,
      createPatientSessionCookie(mabn, maxAge, {
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

    if (mabn && process.env.PATIENT_DATA_MODE === "supabase") {
      void enqueuePatientSync(mabn, "all").catch(() => undefined);
    }

    return response;
  } catch (error) {
    console.error("Portal OTP verification failed", error);
    return NextResponse.json({ error: "Không xác minh được OTP. Vui lòng thử lại sau." }, { status: 503 });
  }
}
