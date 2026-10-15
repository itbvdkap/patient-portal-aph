import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveAdminSession as getAdminSession, reservedAdminNames } from "@/lib/admin/session";
import { deleteStaffUser, staffDeleteSchema } from "@/lib/admin/staff-store";
import { runCloudState } from "@/lib/admin/cloud-state";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (session.role !== "super_admin") return NextResponse.json({ error: "Chỉ quản trị được xóa nhân viên." }, { status: 403, headers });
  let sameOrigin = false;
  try { const origin = new URL(request.headers.get("origin") || ""); sameOrigin = origin.host === request.headers.get("host") && ["http:", "https:"].includes(origin.protocol); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: "Yêu cầu không cùng nguồn ứng dụng." }, { status: 403, headers });
  const body = await request.text();
  if (body.length > 1024) return NextResponse.json({ error: "Dữ liệu quá lớn." }, { status: 400, headers });
  let parsed;
  try { parsed = staffDeleteSchema.safeParse(JSON.parse(body)); } catch { parsed = null; }
  if (!parsed?.success) return NextResponse.json({ error: "Nhập đúng tên tài khoản để xác nhận xóa." }, { status: 400, headers });
  try { return NextResponse.json({ users: await runCloudState("staff", { version: 1, users: [] }, () => deleteStaffUser(parsed.data, session.username, reservedAdminNames())) }, { headers }); }
  catch { return NextResponse.json({ error: "Không xóa được nhân viên. Kiểm tra tài khoản và quyền file nội bộ." }, { status: 400, headers }); }
}
