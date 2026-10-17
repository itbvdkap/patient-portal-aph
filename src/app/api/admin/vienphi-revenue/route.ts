import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAdminAccessPath, resolveAdminSession } from "@/lib/admin/session";
import { revenueQuerySchema } from "@/lib/revenue/domain";
import { readRevenue } from "@/lib/revenue/repository";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  const session = await resolveAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập nhân viên." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/vienphi-revenue")) return NextResponse.json({ error: "Chưa được cấp quyền doanh thu viện phí." }, { status: 403, headers });
  const parsed = revenueQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Ngày giờ không hợp lệ, tối đa 31 ngày." }, { status: 400, headers });
  try { return NextResponse.json(await readRevenue(parsed.data), { headers }); }
  catch { return NextResponse.json({ error: "Chưa đọc được báo cáo viện phí. Kiểm tra gói agent mới và kết nối HIS." }, { status: 503, headers }); }
}
