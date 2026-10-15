import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminSessionCookie, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { changeStaffPassword, passwordChangeSchema } from "@/lib/admin/staff-store";
import { runCloudState, cloudRateLimit } from "@/lib/admin/cloud-state";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
// Local, single-process deployment only (the staff store is disabled on Vercel).
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập lại." }, { status: 401, headers });
  if (session.role !== "staff" || !session.revision) return NextResponse.json({ error: "Chức năng này dành cho tài khoản nhân viên nội bộ. Tài khoản cấu hình server do quản trị hệ thống đổi." }, { status: 403, headers });
  let sameOrigin = false;
  try { const origin = new URL(request.headers.get("origin") || ""); sameOrigin = origin.host === request.headers.get("host") && ["http:", "https:"].includes(origin.protocol); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: "Yêu cầu không cùng nguồn ứng dụng." }, { status: 403, headers });
  const body = await request.text();
  if (body.length > 2048) return NextResponse.json({ error: "Dữ liệu quá lớn." }, { status: 400, headers });
  let parsed;
  try { parsed = passwordChangeSchema.safeParse(JSON.parse(body)); } catch { parsed = null; }
  if (!parsed?.success) return NextResponse.json({ error: "Mật khẩu mới ít nhất 12 ký tự, có chữ và số; nhập lại phải khớp." }, { status: 400, headers });
  const now = Date.now(), key = `${session.username}:${session.revision}`;
  if (!await cloudRateLimit(`password:${key}`)) return NextResponse.json({ error: "Thử lại sau 15 phút." }, { status: 429, headers });
  for (const [name, item] of attempts) if (item.until <= now) attempts.delete(name);
  const previous = attempts.get(key);
  if ((previous && previous.count >= 8) || (!previous && attempts.size >= 2000))
    return NextResponse.json({ error: "Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút." }, { status: 429, headers: { ...headers, "Retry-After": "900" } });
  try { await runCloudState("staff", { version: 1, users: [] }, () => changeStaffPassword(session.username, session.revision!, parsed.data)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Mật khẩu hiện tại không đúng.") attempts.set(key, { count: (previous?.count || 0) + 1, until: previous?.until || now + 900000 });
    const permitted = ["Mật khẩu hiện tại không đúng.", "Mật khẩu mới phải khác mật khẩu hiện tại.", "Phiên đã thay đổi. Vui lòng đăng nhập lại."];
    return NextResponse.json({ error: permitted.includes(message) ? message : "Không đổi được mật khẩu. Liên hệ quản trị nội bộ." }, { status: message.startsWith("Phiên đã thay đổi") ? 401 : 400, headers });
  }
  attempts.delete(key);
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(adminSessionCookie, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0,
    secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" });
  return response;
}
