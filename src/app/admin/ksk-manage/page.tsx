import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { canAdminAccessPath, canAdminPerformAction, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { adminActions } from "@/lib/admin/permissions";
import { defaultKskQuery } from "@/lib/ksk/domain";
import { managementQuerySchema } from "@/lib/ksk/management-contract";
import { ManagementFailure, createManagementRepository } from "@/lib/ksk/management-repository";
import { loadManagementDrafts } from "@/lib/ksk/management-store";
import { ManagementWorkspace } from "./workspace";
export const dynamic = "force-dynamic";
export default async function ManagementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session, "/admin/ksk-manage")) redirect("/admin");
  const raw = await searchParams, defaults = defaultKskQuery();
  const parsed = managementQuerySchema.safeParse({ from: raw.from || defaults.from, to: raw.to || defaults.to, cohort: raw.cohort || "" });
  let content, error = "";
  try {
    if (!parsed.success) throw new ManagementFailure("Khoảng ngày/mã đợt không hợp lệ (tối đa 93 ngày).", 400);
    const data = await createManagementRepository().read(parsed.data), drafts = await loadManagementDrafts();
    content = <ManagementWorkspace key={JSON.stringify(parsed.data)} initialData={data} initialDrafts={drafts} query={parsed.data} username={session.username} actions={adminActions.filter(a => canAdminPerformAction(session, a))} />;
  } catch (e) { error = e instanceof ManagementFailure ? e.message : "Không đọc được dữ liệu quản lý hoặc kho nháp mã hóa. Không tự thay bằng dữ liệu mẫu."; }
  return <AdminShell username={session.username} role={session.role} menus={session.menus}>
    <AdminPageHeader eyebrow="Quản lý dữ liệu HIS thật · nội bộ" title="Đoàn khám · danh sách · gói dịch vụ" description="Đọc dữ liệu HIS, chỉnh trên web, lưu nháp → người khác duyệt → ghi HIS có kiểm soát. Không sửa chỉ định, kết quả hoặc phiếu thu đã phát sinh." />
    {error && <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">{error}</p>}{content}
  </AdminShell>;
}
