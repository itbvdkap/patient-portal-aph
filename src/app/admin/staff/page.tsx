import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { publicStaffUsers } from "@/lib/admin/staff-store";
import { runCloudState } from "@/lib/admin/cloud-state";
import { StaffEditor } from "./staff-editor";

export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (session.role !== "super_admin") redirect("/admin");
  let users, error = "";
  try { users = await runCloudState("staff", { version: 1, users: [] }, publicStaffUsers); } catch { error = "Chưa bật hoặc chưa đọc được kho nhân viên."; }
  return <AdminShell username={session.username} role={session.role}>
    <AdminPageHeader eyebrow="Nhân viên" title="Tài khoản & phân quyền menu" description="Tài khoản nhân viên riêng. Quyền xem báo cáo, quản lý HIS thật và LAB cấp riêng; thao tác ghi cần mở server và phiếu được người khác duyệt." />
    {error ? <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">{error}</p> : <StaffEditor initialUsers={users!} />}
  </AdminShell>;
}
