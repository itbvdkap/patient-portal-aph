import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { canAdminAccessPath, canAdminPerformAction, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { adminActions } from "@/lib/admin/permissions";
import { ChangeLabError, readChangeLab } from "@/lib/ksk/change-lab-store";
import { ChangeWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export default async function ChangePage() {
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session, "/admin/ksk-changes")) redirect("/admin");
  let data = null, error = "";
  try { data = readChangeLab(); } catch (e) { error = e instanceof ChangeLabError ? e.message : "Không đọc được kho LAB; không có thay đổi HIS thật."; }
  return <AdminShell username={session.username} role={session.role} menus={session.menus}>
    <AdminPageHeader eyebrow="Thử nghiệp vụ · không ghi Oracle" title="Phiếu thay đổi gói / danh sách khám" description="Bản nháp → người khác duyệt → áp dụng vào HIS GIẢ LẬP. Dữ liệu độc lập với CN1/CN3 thật." />
    {error && <p role="alert" className="mb-4 rounded border border-amber-300 bg-amber-50 p-4">{error}</p>}
    {data && <ChangeWorkspace initialData={data} username={session.username} actions={adminActions.filter(a => canAdminPerformAction(session, a))} />}
  </AdminShell>;
}
