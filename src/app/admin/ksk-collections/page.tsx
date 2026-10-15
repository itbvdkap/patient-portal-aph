import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { defaultKskQuery, type KskSnapshot } from "@/lib/ksk/domain";
import { collectionQuerySchema } from "@/lib/ksk/collections";
import { createKskRepository } from "@/lib/ksk/repository";
import { CollectionWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export default async function CollectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session, "/admin/ksk-collections")) redirect("/admin");
  const raw = await searchParams, defaults = defaultKskQuery();
  const parsed = collectionQuerySchema.safeParse({ from: raw.from ?? defaults.from, to: raw.to ?? defaults.to,
    collectedFrom: raw.collectedFrom ?? defaults.from, collectedTo: raw.collectedTo ?? defaults.to,
    company: raw.company ?? "", support: raw.support ?? "", cashier: raw.cashier ?? "", status: raw.status ?? "" });
  let data: KskSnapshot | null = null, error = "";
  if (!parsed.success) error = "Bộ lọc không hợp lệ. Mỗi khoảng ngày tối đa 93 ngày; tổng phạm vi không quá 186 ngày.";
  else try { data = await createKskRepository().readCollections(parsed.data); } catch (e) { error = e instanceof Error ? e.message : "Không đọc được báo cáo."; }
  const query = parsed.success ? parsed.data : { from: defaults.from, to: defaults.to, collectedFrom: defaults.from, collectedTo: defaults.to, company: "", support: "", cashier: "", status: "" as const };
  return <AdminShell username={session.username} role={session.role} menus={session.menus}>
    <AdminPageHeader eyebrow="Tài chính khám đoàn · chỉ đọc HIS" title="Báo cáo thu tiền tổng hợp"
      description="Lọc nhiều công ty/đoàn cùng lúc. Tính theo từng phiếu thu HIS; không phải công nợ hợp đồng hoặc tiền công ty đã thanh toán." />
    {error && <p role="alert" className="mb-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{error} Không tự dùng dữ liệu mẫu hoặc số 0 thay cho nguồn lỗi.</p>}
    <CollectionWorkspace key={JSON.stringify(query)} data={data} query={query} />
  </AdminShell>;
}
