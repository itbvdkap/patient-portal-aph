import { NextResponse } from "next/server";
import { z } from "zod";
import { adminSessionCookie, createAdminSessionCookie, isAdminConfigured, verifyAdminCredentials } from "@/lib/admin/session";

const schema = z.object({
  username: z.string().trim().min(1).default("admin"),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình ADMIN_PASSWORD hoặc PORTAL_ADMIN_PASSWORD." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập tài khoản và mật khẩu quản trị." }, { status: 400 });
  }

  const admin = verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!admin) {
    return NextResponse.json({ error: "Tài khoản hoặc mật khẩu quản trị không đúng." }, { status: 401 });
  }

  const maxAge = 60 * 60 * 8;
  const response = NextResponse.json({ ok: true, role: admin.role });
  response.cookies.set(adminSessionCookie, createAdminSessionCookie(admin.username, admin.role, maxAge), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return response;
}
