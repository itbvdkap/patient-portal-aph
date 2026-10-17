import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { resolveAdminSession, canAdminAccessPath } from "@/lib/admin/session";
import { defaultRevenueQuery, revenueQuerySchema } from "@/lib/revenue/domain";
import { RevenueWorkspace } from "./workspace";
export const dynamic = "force-dynamic";
export default async function RevenuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await resolveAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session, "/admin/vienphi-revenue")) redirect("/admin");
  const raw = await searchParams; const defaults = defaultRevenueQuery();
  const parsed = revenueQuerySchema.safeParse({ ...defaults, ...raw });
  return <AdminShell username={session.username} role={session.role} menus={session.menus}>
    <AdminPageHeader eyebrow="Viện phí · Chỉ đọc HIS" title="Doanh thu viện phí theo thu ngân" description="Tổng hợp phiếu thu toàn viện theo ngày giờ và khoa/phòng trên phiếu. Bao gồm người bệnh ngoài đoàn khám." />
    <RevenueWorkspace initialQuery={parsed.success ? parsed.data : defaults} initialError={parsed.success ? "" : "Bộ lọc ngày giờ không hợp lệ. Chọn lại khoảng tối đa 31 ngày."} />
  </AdminShell>;
}
