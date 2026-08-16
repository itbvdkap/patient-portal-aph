import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { linkAccountProfile } from "@/lib/account/portal-account";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { createPatientSessionCookie, getDemoPatientSession } from "@/lib/auth/session";
import { requestOnDemandProfileLinkSync } from "@/lib/supabase/portal-sync";

const linkProfileSchema = z.object({
  mabn: z.string().trim().min(1).max(20),
  phone: z.string().trim().min(9).max(20),
  citizenId: z.string().trim().min(9).max(20),
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session?.accountKey) {
    return NextResponse.json({ error: "Phiên đăng nhập không hỗ trợ liên kết hồ sơ." }, { status: 401 });
  }

  const parsed = linkProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập đủ mã BN, SĐT, CCCD/CMND và ngày sinh." }, { status: 400 });
  }

  let verified;
  try {
    verified = await requestOnDemandProfileLinkSync(parsed.data);
  } catch (error) {
    console.error("Linked profile verification failed", error);
    return NextResponse.json({ error: "Hệ thống xác minh hồ sơ chưa phản hồi. Vui lòng thử lại sau vài giây." }, { status: 503 });
  }

  const profile = verified?.profiles?.[0] ?? verified;
  if (!profile) {
    return NextResponse.json({ error: "Không xác minh được hồ sơ với thông tin đã nhập." }, { status: 404 });
  }

  const mabn = "hisPatientCode" in profile ? profile.hisPatientCode : verified?.hisPatientCode;
  const fullName = "fullName" in profile ? profile.fullName : verified?.fullName;
  const relationship = "relationship" in profile ? profile.relationship : undefined;

  if (!mabn || !fullName) {
    return NextResponse.json({ error: "Kết quả xác minh hồ sơ không hợp lệ." }, { status: 502 });
  }

  const profiles = await linkAccountProfile(session, {
    mabn,
    fullName,
    relationship: relationship ?? "Người thân",
  });

  if (!profiles) {
    return NextResponse.json({ error: "Không ghi được hồ sơ vào tài khoản." }, { status: 500 });
  }

  const maxAge = 60 * 60 * 8;
  const response = NextResponse.json({ data: { mabn, fullName, profiles } });
  response.cookies.set(
    demoSessionCookie,
    createPatientSessionCookie(session.mabn, maxAge, {
      sessionId: session.sessionId,
      accountKey: session.accountKey,
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

  return response;
}
