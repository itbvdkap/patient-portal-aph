import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { unlinkAccountProfile } from "@/lib/account/portal-account";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { createPatientSessionCookie, getDemoPatientSession } from "@/lib/auth/session";

const unlinkProfileSchema = z.object({
  mabn: z.string().trim().min(1).max(20),
});

export async function POST(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session?.accountId && !session?.accountKey) {
    return NextResponse.json({ error: "Phiên đăng nhập không hỗ trợ gỡ liên kết hồ sơ." }, { status: 401 });
  }

  const parsed = unlinkProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mã bệnh nhân không hợp lệ." }, { status: 400 });
  }

  let result;
  try {
    result = await unlinkAccountProfile(session, parsed.data.mabn);
  } catch (error) {
    if (error instanceof Error && error.message === "cannot_remove_last_profile") {
      return NextResponse.json({ error: "Tài khoản cần giữ ít nhất một hồ sơ y tế." }, { status: 409 });
    }
    console.error("Unlink profile failed", error);
    return NextResponse.json({ error: "Không gỡ được hồ sơ. Vui lòng thử lại sau." }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "Hồ sơ này chưa được liên kết với tài khoản." }, { status: 404 });
  }

  const maxAge = 60 * 60 * 8;
  const response = NextResponse.json({ data: result });
  response.cookies.set(
    demoSessionCookie,
    createPatientSessionCookie(result.currentMabn, maxAge, {
      sessionId: session.sessionId,
      accountId: session.accountId,
      accountKey: session.accountKey,
      phone: session.phone,
      profiles: result.profiles,
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
}
