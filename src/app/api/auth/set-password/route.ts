import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setPortalAccountPassword } from "@/lib/account/portal-account";
import { validatePassword } from "@/lib/auth/password";
import { getDemoPatientSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session?.accountId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập trước khi đặt mật khẩu." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  const validationError = validatePassword(password);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    await setPortalAccountPassword(session.accountId, password);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("Set password failed", error);
    return NextResponse.json({ error: "Không lưu được mật khẩu. Vui lòng thử lại sau." }, { status: 503 });
  }
}
