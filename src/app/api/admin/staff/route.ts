import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveAdminSession as getAdminSession, reservedAdminNames } from "@/lib/admin/session";
import { publicStaffUsers, saveStaffUser, staffFormSchema } from "@/lib/admin/staff-store";
import { runCloudState } from "@/lib/admin/cloud-state";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export async function GET() {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (session.role !== "super_admin") return NextResponse.json({ error: "Chỉ quản trị được quản lý nhân viên." }, { status: 403, headers });
  try { return NextResponse.json({ users: await runCloudState("staff", { version: 1, users: [] }, publicStaffUsers) }, { headers }); }
  catch { return NextResponse.json({ error: "Chưa mở hoặc chưa đọc được kho nhân viên nội bộ." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (session.role !== "super_admin") return NextResponse.json({ error: "Chỉ quản trị được thay đổi quyền nhân viên." }, { status: 403, headers });
  // Browser writes must originate at this exact host, including LAN HTTPS port.
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try { const url = new URL(origin || ""); sameOrigin = url.host === request.headers.get("host") && ["http:", "https:"].includes(url.protocol); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: "Yêu cầu không cùng nguồn ứng dụng." }, { status: 403, headers });
  const body = await request.text();
  if (body.length > 8192) return NextResponse.json({ error: "Dữ liệu nhân viên quá lớn." }, { status: 400, headers });
  let parsed;
  try { parsed = staffFormSchema.safeParse(JSON.parse(body)); } catch { parsed = null; }
  if (!parsed?.success) return NextResponse.json({ error: "Thông tin nhân viên/menu không hợp lệ hoặc mật khẩu nhập lại không khớp." }, { status: 400, headers });
  const input = { username: parsed.data.username, displayName: parsed.data.displayName, password: parsed.data.password,
    enabled: parsed.data.enabled, menus: parsed.data.menus, ...(parsed.data.actions ? { actions: parsed.data.actions } : {}) };
  try { return NextResponse.json({ users: await runCloudState("staff", { version: 1, users: [] }, () => saveStaffUser(input, session.username, reservedAdminNames())) }, { headers }); }
  catch (e) {
    const permitted = ["Không dùng tên tài khoản quản trị cấu hình server cho nhân viên.", "Mật khẩu mới tối thiểu 12 ký tự, có chữ và số.", "Đã đạt giới hạn 200 nhân viên.", "Tài khoản đã xóa. Chọn tên khác hoặc nhờ quản trị khôi phục từ bản sao lưu."];
    return NextResponse.json({ error: e instanceof Error && permitted.includes(e.message) ? e.message : "Không lưu được tài khoản. Kiểm tra cấu hình/quyền file nội bộ; không có thay đổi HIS." }, { status: 400, headers });
  }
}
