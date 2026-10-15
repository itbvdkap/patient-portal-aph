import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { canAdminAccessPath, resolveAdminSession as getAdminSession } from "@/lib/admin/session";
import { defaultKskQuery, querySchema, type KskSnapshot } from "@/lib/ksk/domain";
import { createKskRepository } from "@/lib/ksk/repository";
import { KskWorkspace } from "./workspace";
import { KskFilterBar, type KskFilters } from "./filters";

export default async function KskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session, "/admin/ksk")) redirect("/admin");
  const raw = await searchParams;
  const defaults = defaultKskQuery();
  const parsed = querySchema.safeParse({ from: raw.from ?? defaults.from, to: raw.to ?? defaults.to, cohort: raw.cohort ?? "" });
  let data: KskSnapshot | null = null;
  let choices: KskSnapshot | null = null;
  const filters: KskFilters = {
    company: typeof raw.company === "string" && /^\d{1,24}$/.test(raw.company) ? raw.company : "",
    support: typeof raw.support === "string" && /^\d{1,24}$/.test(raw.support) ? raw.support : "",
  };
  let error = "";
  if (!parsed.success) error = "Khoảng ngày/mã đợt không hợp lệ. Chọn tối đa 93 ngày.";
  else {
    try {
      const repository = createKskRepository();
      const [detail, list] = await Promise.allSettled([
        repository.read(parsed.data),
        parsed.data.cohort ? repository.read({ ...parsed.data, cohort: "" }) : Promise.resolve(null),
      ]);
      if (detail.status === "rejected") throw detail.reason;
      data = detail.value;
      if (list.status === "fulfilled") choices = list.value;
      else data.warnings.push("Chưa đọc được danh sách lựa chọn công ty/đợt. Chi tiết đợt vẫn giữ nguyên.");
    }
    catch (e) { error = e instanceof Error ? e.message : "Không đọc được dữ liệu KSK."; }
  }
  const query = parsed.success ? parsed.data : defaults;
  return <AdminShell username={session.username} role={session.role} menus={session.menus}>
    <AdminPageHeader eyebrow="Khám sức khỏe theo đoàn" title="Đoàn khám & tiến độ"
      description="Chỉ đọc HIS · Theo dõi người khám, kết quả và chi phí phát sinh. Chưa đối soát công nợ hợp đồng." />
    {!data && <KskFilterBar query={query} rows={[]} filters={filters} />}
    {error && <section role="alert" className="rounded border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <h3 className="font-bold">Chưa có dữ liệu để hiển thị</h3><p className="mt-2 text-sm">{error}</p>
      <p className="mt-2 text-sm">Không thay bằng số 0 hoặc dữ liệu mẫu khi HIS chưa kết nối. Cần bật module trên máy chủ nội bộ và cấu hình tài khoản Oracle chỉ đọc riêng.</p>
    </section>}
    {data && <KskWorkspace key={`${data.scope.branch}:${query.cohort}:${query.from}:${query.to}:${filters.company}:${filters.support}`} data={data} query={query} filters={filters}
      choices={[...new Map([...(choices?.cohorts ?? []), ...data.cohorts].map(c => [c.id, c])).values()]} />}
  </AdminShell>;
}
