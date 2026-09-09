import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { updatePortalAccountIdentity } from "@/lib/account/portal-account";
import { getDemoPatientSession } from "@/lib/auth/session";

const accountProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
});

export async function PATCH(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session?.accountId && !session?.accountKey) {
    return NextResponse.json({ error: "Phiên đăng nhập không hỗ trợ sửa tài khoản." }, { status: 401 });
  }

  const parsed = accountProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập tên tài khoản hợp lệ." }, { status: 400 });
  }

  let updated;
  try {
    updated = await updatePortalAccountIdentity(session, parsed.data);
  } catch (error) {
    console.error("Update portal account profile failed", error);
    return NextResponse.json({ error: "Chưa cập nhật được thông tin tài khoản." }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Chưa cập nhật được thông tin tài khoản." }, { status: 400 });
  }

  return NextResponse.json({ data: updated });
}
