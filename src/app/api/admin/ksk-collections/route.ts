import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { collectionQuerySchema } from "@/lib/ksk/collections";
import { createKskRepository } from "@/lib/ksk/repository";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập nhân viên." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/ksk-collections")) return NextResponse.json({ error: "Chưa được cấp quyền báo cáo thu tiền." }, { status: 403, headers });
  const parsed = collectionQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Bộ lọc/ngày không hợp lệ." }, { status: 400, headers });
  try { return NextResponse.json(await createKskRepository().readCollections(parsed.data), { headers }); }
  catch { return NextResponse.json({ error: "Agent chưa sẵn sàng cho báo cáo thu tiền tổng hợp." }, { status: 503, headers }); }
}
