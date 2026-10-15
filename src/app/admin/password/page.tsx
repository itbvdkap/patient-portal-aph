import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";
export default async function PasswordPage() {
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (session.role !== "staff") redirect("/admin");
  return <AdminShell username={session.username} role={session.role} menus={session.menus}>
    <AdminPageHeader eyebrow="Tài khoản nhân viên" title="Đổi mật khẩu" description={`Tài khoản: ${session.username}. Chỉ đổi mật khẩu của chính mình, không thay đổi quyền hoặc dữ liệu HIS.`} />
    <PasswordForm />
  </AdminShell>;
}
