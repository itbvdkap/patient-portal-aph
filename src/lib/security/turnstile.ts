type TurnstileVerifyResult = {
  success: boolean;
  "error-codes"?: string[];
};

export function isTurnstileEnabled() {
  return process.env.TURNSTILE_ENABLED === "true";
}

export async function verifyTurnstileToken(token: string | null | undefined, request: Request) {
  if (!isTurnstileEnabled()) {
    return { ok: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[turnstile] Missing TURNSTILE_SECRET_KEY while TURNSTILE_ENABLED=true");
    return { ok: false, message: "Hệ thống chống bot chưa được cấu hình." };
  }

  if (!token) {
    return { ok: false, message: "Vui lòng xác thực chống bot trước khi gửi." };
  }

  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) {
    formData.append("remoteip", forwardedFor);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const outcome = (await response.json()) as TurnstileVerifyResult;

    if (outcome.success) {
      return { ok: true };
    }

    console.warn("[turnstile] Verification failed", outcome["error-codes"]);
    return { ok: false, message: "Xác thực chống bot thất bại, vui lòng tải lại trang và thử lại." };
  } catch (error) {
    console.error("[turnstile] Verification request failed", error);
    return { ok: false, message: "Không kết nối được hệ thống chống bot. Vui lòng thử lại sau." };
  }
}
