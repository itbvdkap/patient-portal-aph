import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalAccountByPhone, setPortalAccountPassword } from "@/lib/account/portal-account";
import { consumeOtpAttempt } from "@/lib/auth/otp-attempts";
import { validatePassword } from "@/lib/auth/password";
import { normalizeVietnamPhone } from "@/lib/auth/phone";

const schema = z.object({
  phone: z.string().trim().min(9).max(20),
  otp: z.string().trim().regex(/^\d{6,8}$/),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại, OTP và mật khẩu mới." }, { status: 400 });
  }

  const validationError = validatePassword(parsed.data.password);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const phone = normalizeVietnamPhone(parsed.data.phone);
  const account = await getPortalAccountByPhone(phone);
  if (!account) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  }

  const consumed = await consumeOtpAttempt(phone, parsed.data.otp, "reset_password");
  if (!consumed.ok) {
    return NextResponse.json({ error: consumed.error }, { status: consumed.status });
  }

  try {
    await setPortalAccountPassword(account.accountId, parsed.data.password);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("Reset password failed", error);
    return NextResponse.json({ error: "Không đổi được mật khẩu. Vui lòng thử lại sau." }, { status: 503 });
  }
}
