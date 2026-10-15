import { NextResponse } from "next/server";
import { z } from "zod";
import { adminSessionCookie, createAdminSessionCookie, isAdminConfigured, resolveAdminCredentials as verifyAdminCredentials } from "@/lib/admin/session";
import { cloudRateLimit } from "@/lib/admin/cloud-state";

const schema = z.object({
  username: z.string().trim().min(1).max(50).default("admin"),
  password: z.string().min(1).max(128),
});
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Yêu cầu đăng nhập không cùng nguồn." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Nguồn đăng nhập không hợp lệ." }, { status: 403 }); }
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình ADMIN_PASSWORD hoặc PORTAL_ADMIN_PASSWORD." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập tài khoản và mật khẩu quản trị." }, { status: 400 });
  }
  const name = parsed.data.username.toLowerCase();
  if (!await cloudRateLimit(`login:${name}`)) return NextResponse.json({ error: "Đã thử nhiều lần. Thử lại sau 15 phút." }, { status: 429, headers: { "Retry-After": "900" } });
  const now = Date.now();
  for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
  const attempt = attempts.get(name);
  if ((attempt && attempt.count >= 8) || (!attempt && attempts.size >= 2000))
    return NextResponse.json({ error: "Đã thử đăng nhập nhiều lần. Thử lại sau 15 phút." }, { status: 429, headers: { "Retry-After": "900" } });

  const admin = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!admin) {
    attempts.set(name, { count: (attempt?.count || 0) + 1, until: attempt?.until || now + 15 * 60 * 1000 });
    return NextResponse.json({ error: "Tài khoản hoặc mật khẩu quản trị không đúng." }, { status: 401 });
  }
  attempts.delete(name);

  const maxAge = 60 * 60 * 8;
  const response = NextResponse.json({ ok: true, role: admin.role });
  response.cookies.set(adminSessionCookie, createAdminSessionCookie(admin.username, admin.role, maxAge, admin.revision), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge,
  });

  return response;
}
