import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { managementCommandSchema, managementQuerySchema } from "@/lib/ksk/management-contract";
import { createManagementRepository, ManagementFailure } from "@/lib/ksk/management-repository";
import { executeManagement, loadManagementDrafts } from "@/lib/ksk/management-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
function failure(error: unknown) { return NextResponse.json({ error: error instanceof ManagementFailure ? error.message : "Không xử lý được quản lý HIS. Kiểm tra cấu hình/kho nháp; không tự tạo lệnh ghi mới khi chưa rõ kết quả." }, { status: error instanceof ManagementFailure ? error.status : 503, headers }); }
export async function GET(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/ksk-manage")) return NextResponse.json({ error: "Chưa được cấp menu Quản lý đoàn HIS." }, { status: 403, headers });
  const query = new URL(request.url).searchParams;
  try {
    const repo = createManagementRepository();
    if (query.has("patient")) return NextResponse.json({ error: "Tra mã BN dùng form POST riêng, không đặt mã bệnh nhân trên URL." }, { status: 400, headers });
    const checked = managementQuerySchema.safeParse({ from: query.get("from"), to: query.get("to"), cohort: query.get("cohort") || "" });
    if (!checked.success) return NextResponse.json({ error: "Ngày/đợt không hợp lệ, tối đa 93 ngày." }, { status: 400, headers });
    return NextResponse.json({ data: await repo.read(checked.data), drafts: await loadManagementDrafts() }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const session = await getAdminSession(await cookies());
  if (!session) return NextResponse.json({ error: "Cần đăng nhập quản trị." }, { status: 401, headers });
  if (!canAdminAccessPath(session, "/admin/ksk-manage")) return NextResponse.json({ error: "Thiếu quyền quản lý HIS." }, { status: 403, headers });
  let sameOrigin = false;
  try { const origin = new URL(request.headers.get("origin") || ""); sameOrigin = origin.host === request.headers.get("host") && ["http:", "https:"].includes(origin.protocol); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: "Yêu cầu không cùng nguồn ứng dụng." }, { status: 403, headers });
  const reader = request.body?.getReader(); if (!reader) return NextResponse.json({ error: "Thiếu nội dung." }, { status: 400, headers });
  let body = "", size = 0; const decoder = new TextDecoder();
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
      if (size > 120000) { await reader.cancel(); return NextResponse.json({ error: "Phiếu vượt giới hạn 120KB." }, { status: 413, headers }); }
      body += decoder.decode(chunk.value, { stream: true }); }
    body += decoder.decode();
  } catch { return NextResponse.json({ error: "Không đọc được nội dung." }, { status: 400, headers }); } finally { reader.releaseLock(); }
  let parsed;
  try { parsed = managementCommandSchema.safeParse(JSON.parse(body)); } catch {}
  if (!parsed?.success) return NextResponse.json({ error: "Phiếu không hợp lệ. Kiểm tra dữ liệu và lý do tối thiểu 5 ký tự." }, { status: 400, headers });
  try { return NextResponse.json({ drafts: await executeManagement(session, parsed.data, createManagementRepository()) }, { headers }); } catch (error) { return failure(error); }
}
