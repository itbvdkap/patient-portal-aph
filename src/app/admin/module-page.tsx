import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminTable } from "@/app/admin/admin-table";
import { getAdminSession } from "@/lib/admin/session";
import { canAdminAccessPath, canAdminPerformAction } from "@/lib/admin/session";
import type { AdminModuleResult } from "@/lib/admin/modules";

export async function AdminModulePage({
  eyebrow,
  title,
  description,
  empty,
  loader,
  actions,
  permissionPath,
}: {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  loader: () => Promise<AdminModuleResult>;
  actions?: React.ReactNode;
  permissionPath?: string;
}) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (permissionPath && !canAdminAccessPath(session.role, permissionPath)) redirect("/admin");

  const data = await loader();
  const rows = data.rows.map((row) => ({
    ...row,
    actions: row.actions?.filter((item) => canAdminPerformAction(session.role, item.action)),
  }));

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {data.warnings.length > 0 && (
        <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">Một số dữ liệu chưa sẵn sàng</p>
          <ul className="mt-2 list-inside list-disc">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
      <AdminTable rows={rows} empty={empty} />
    </AdminShell>
  );
}
