import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { changeCommandSchema } from "@/lib/ksk/change-contract";
import { ChangeLabError, executeChangeLab, readChangeLab } from "@/lib/ksk/change-lab-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof ChangeLabError ? error.message : "Không đọc/lưu được kho LAB. Không có thay đổi HIS thật." }, { status: error instanceof ChangeLabError ? error.status : 503, headers });
}
export async function GET() {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/ksk-changes")) return NextResponse.json({ error: "Chưa được cấp menu Phiếu thay đổi." }, { status: 403, headers });
  try { return NextResponse.json(readChangeLab(), { headers }); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/ksk-changes")) return NextResponse.json({ error: "Chưa được cấp menu Phiếu thay đổi." }, { status: 403, headers });
  let sameOrigin = false;
  try { const origin = new URL(request.headers.get("origin") || ""); sameOrigin = origin.host === request.headers.get("host") && ["http:", "https:"].includes(origin.protocol); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: "Yêu cầu không cùng nguồn ứng dụng." }, { status: 403, headers });
  // Bounded stream, not an unbounded request.text allocation.
  let body = "", bytes = 0;
  const reader = request.body?.getReader(), decoder = new TextDecoder();
  if (!reader) return NextResponse.json({ error: "Thiếu nội dung phiếu." }, { status: 400, headers });
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 24000) { await reader.cancel(); return NextResponse.json({ error: "Phiếu vượt giới hạn dung lượng." }, { status: 413, headers }); }
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
  } catch { return NextResponse.json({ error: "Không đọc được nội dung phiếu." }, { status: 400, headers }); }
  finally { reader.releaseLock(); }
  let parsed;
  try { parsed = changeCommandSchema.safeParse(JSON.parse(body)); } catch {}
  if (!parsed?.success) return NextResponse.json({ error: "Nội dung phiếu không hợp lệ. Kiểm tra trường bắt buộc, số lượng/đơn giá và lý do tối thiểu 5 ký tự." }, { status: 400, headers });
  try { return NextResponse.json(executeChangeLab(session, parsed.data), { headers }); } catch (error) { return failure(error); }
}
