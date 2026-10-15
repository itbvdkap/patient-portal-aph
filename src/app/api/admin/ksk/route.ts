import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { querySchema } from "@/lib/ksk/domain";
import { createKskRepository } from "@/lib/ksk/repository";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/ksk")) return NextResponse.json({ error: "Không có quyền xem hồ sơ đoàn khám." }, { status: 403, headers });
  const q = new URL(request.url).searchParams;
  const checked = querySchema.safeParse({ from: q.get("from"), to: q.get("to"), cohort: q.get("cohort") ?? "" });
  if (!checked.success) return NextResponse.json({ error: "Khoảng ngày hoặc mã đợt không hợp lệ (tối đa 93 ngày)." }, { status: 400, headers });
  try {
    const data = await createKskRepository().read(checked.data);
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu KSK. Kiểm tra agent và cấu hình chỉ đọc." }, { status: 503, headers });
  }
}
