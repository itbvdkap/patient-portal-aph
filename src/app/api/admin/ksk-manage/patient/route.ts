import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdminAccessPath, canAdminPerformAction, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { createManagementRepository, ManagementFailure } from "@/lib/ksk/management-repository";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const schema = z.object({ mabn: z.string().regex(/^[0-9]{8}$/) }).strict();
export async function POST(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/ksk-manage") || !canAdminPerformAction(session, "ksk_manage_roster")) return NextResponse.json({ error: "Thiếu quyền tra mã BN để lập danh sách." }, { status: 403, headers });
  try { const origin = new URL(request.headers.get("origin") || ""); if (origin.host !== request.headers.get("host") || !["http:", "https:"].includes(origin.protocol)) throw new Error(); }
  catch { return NextResponse.json({ error: "Yêu cầu không cùng nguồn." }, { status: 403, headers }); }
  const reader = request.body?.getReader(); if (!reader) return NextResponse.json({ error: "Thiếu mã BN." }, { status: 400, headers });
  let body = "", size = 0; const decoder = new TextDecoder();
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 1024) { await reader.cancel(); return NextResponse.json({ error: "Dữ liệu quá lớn." }, { status: 413, headers }); } body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
  finally { reader.releaseLock(); }
  let input; try { input = schema.safeParse(JSON.parse(body)); } catch {}
  if (!input?.success) return NextResponse.json({ error: "Mã BN cần đủ 8 số." }, { status: 400, headers });
  try { return NextResponse.json(await createManagementRepository().patient(input.data.mabn), { headers }); }
  catch (error) { return NextResponse.json({ error: error instanceof ManagementFailure ? error.message : "Không tra được mã BN." }, { status: error instanceof ManagementFailure ? error.status : 503, headers }); }
}
