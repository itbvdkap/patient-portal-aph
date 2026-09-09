import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { changePortalAccountPassword } from "@/lib/account/portal-account";
import { validatePassword } from "@/lib/auth/password";
import { getDemoPatientSession } from "@/lib/auth/session";

const schema = z.object({
  currentPassword: z.string().optional().default(""),
  newPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session?.accountId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập trước khi đổi mật khẩu." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập mật khẩu mới." }, { status: 400 });
  }

  const validationError = validatePassword(parsed.data.newPassword);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await changePortalAccountPassword(session.accountId, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("Change password failed", error);
    return NextResponse.json({ error: "Không đổi được mật khẩu. Vui lòng thử lại sau." }, { status: 503 });
  }
}
