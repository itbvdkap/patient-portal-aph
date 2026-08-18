import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDemoPatientSession } from "@/lib/auth/session";
import { requestOnDemandProfileLookupSync } from "@/lib/supabase/portal-sync";

const lookupProfileSchema = z.object({
  mabn: z.string().trim().min(1).max(20),
});

export async function POST(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session?.accountId && !session?.accountKey) {
    return NextResponse.json({ error: "Phiên đăng nhập không hỗ trợ tìm hồ sơ." }, { status: 401 });
  }

  const parsed = lookupProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập mã bệnh nhân." }, { status: 400 });
  }

  let profile;
  try {
    profile = await requestOnDemandProfileLookupSync(parsed.data.mabn);
  } catch (error) {
    console.error("Profile lookup failed", error);
    const message = error instanceof Error && error.message === "PROFILE_LOOKUP_TIMEOUT"
      ? "Sync agent nội bộ chưa xử lý yêu cầu tìm hồ sơ. Vui lòng kiểm tra Windows Service AnPhuPatientPortalSyncAgent."
      : "Hệ thống tìm hồ sơ chưa phản hồi. Vui lòng thử lại sau vài giây.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ với mã bệnh nhân đã nhập." }, { status: 404 });
  }

  return NextResponse.json({ data: profile });
}
