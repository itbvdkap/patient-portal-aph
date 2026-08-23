import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertCircle, DatabaseZap, Filter, RotateCcw, Search } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminTable } from "@/app/admin/admin-table";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { getAdminSyncJobs, type AdminSyncJobsQuery } from "@/lib/admin/modules";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminSyncPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/sync")) redirect("/admin");

  const rawParams = await searchParams;
  const query = parseSyncQuery(rawParams);
  const data = await getAdminSyncJobs(query);
  const rows = data.rows.map((row) => ({
    ...row,
    actions: row.actions?.filter((item) => canAdminPerformAction(session.role, item.action)),
  }));

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Đồng bộ HIS"
        title="Sync jobs"
        description="Theo dõi hàng đợi đồng bộ on-demand theo bệnh nhân, resource, trạng thái lỗi và thời gian cập nhật."
        actions={
          <Link href="/admin/sync" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Xóa lọc
          </Link>
        }
      />

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

      {data.failedCount > 0 && (
        <section className="mb-5 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Có {data.failedCount} sync job đang lỗi.</p>
            <p className="font-semibold">Mở tab “Đang lỗi” để xem nguyên nhân đã được rút gọn và retry từng resource khi cần.</p>
          </div>
        </section>
      )}

      <SyncToolbar data={data} rawParams={rawParams} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">
          Hiển thị <span className="clinical-mono text-ink">{rows.length}</span> / <span className="clinical-mono text-ink">{data.total}</span> job
        </p>
        <p className="clinical-mono text-xs font-black text-slate-500">
          Trang {data.page}/{data.pageCount}
        </p>
      </div>

      <AdminTable rows={rows} empty="Không có sync job phù hợp bộ lọc." columns={["Sync job", "Trạng thái", "Cập nhật"]} />

      <Pagination page={data.page} pageCount={data.pageCount} rawParams={rawParams} />
    </AdminShell>
  );
}

function SyncToolbar({ data, rawParams }: { data: Awaited<ReturnType<typeof getAdminSyncJobs>>; rawParams: SearchParams }) {
  const tabs = [
    { label: "Tất cả", href: buildHref(rawParams, { status: "", page: "1" }), active: !data.filters.status },
    { label: "Đang chờ", href: buildHref(rawParams, { status: "queued", page: "1" }), active: data.filters.status === "queued" },
    { label: "Đang chạy", href: buildHref(rawParams, { status: "running", page: "1" }), active: data.filters.status === "running" },
    { label: "Đang lỗi", href: buildHref(rawParams, { status: "failed", page: "1" }), active: data.filters.status === "failed" },
    { label: "Hoàn tất", href: buildHref(rawParams, { status: "completed", page: "1" }), active: data.filters.status === "completed" },
  ];

  return (
    <section className="mb-5 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`rounded-md px-3 py-2 text-xs font-black transition ${
              tab.active ? "bg-primary-700 text-white" : "border border-cream-200 bg-cream-100 text-slate-700 hover:bg-primary-50 hover:text-primary-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form action="/admin/sync" className="grid gap-3 lg:grid-cols-[1.3fr_150px_180px_1fr_1fr_120px_auto] lg:items-end">
        <label className="block text-sm font-bold text-ink">
          Tìm kiếm
          <span className="mt-2 flex items-center gap-2 rounded-md border border-cream-200 bg-white px-3 py-2.5 ring-primary-100 focus-within:ring-4">
            <Search aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              name="q"
              defaultValue={data.filters.q}
              placeholder="MABN, job, resource, lỗi"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </span>
        </label>

        <Select name="status" label="Trạng thái" value={data.filters.status} options={data.options.statuses} allLabel="Tất cả" />
        <Select name="resourceName" label="Resource" value={data.filters.resourceName} options={data.options.resources} allLabel="Tất cả" />

        <label className="block text-sm font-bold text-ink">
          Từ ngày
          <input name="dateFrom" type="date" defaultValue={data.filters.dateFrom} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 clinical-mono text-sm font-bold outline-none ring-primary-100 focus:ring-4" />
        </label>

        <label className="block text-sm font-bold text-ink">
          Đến ngày
          <input name="dateTo" type="date" defaultValue={data.filters.dateTo} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 clinical-mono text-sm font-bold outline-none ring-primary-100 focus:ring-4" />
        </label>

        <Select name="pageSize" label="Số dòng" value={String(data.pageSize)} options={["10", "20", "50", "100"]} allLabel="" />

        <input type="hidden" name="page" value="1" />
        <button className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-primary-900">
          <Filter aria-hidden="true" className="h-4 w-4" />
          Lọc
        </button>
      </form>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-primary-50 px-3 py-2 text-xs font-bold leading-5 text-primary-900">
        <DatabaseZap aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        Nút Retry chỉ hiện cho job lỗi, kẹt hoặc đã hết số lần thử. Mở chi tiết job để xem snapshot và các resource cùng MABN.
      </div>
    </section>
  );
}

function Select({ name, label, value, options, allLabel }: { name: string; label: string; value: string; options: string[]; allLabel: string }) {
  return (
    <label className="block text-sm font-bold text-ink">
      {label}
      <select name={name} defaultValue={value} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm font-bold outline-none ring-primary-100 focus:ring-4">
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={`${name}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pagination({ page, pageCount, rawParams }: { page: number; pageCount: number; rawParams: SearchParams }) {
  return (
    <nav className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={buildHref(rawParams, { page: String(Math.max(1, page - 1)) })}
        aria-disabled={page <= 1}
        className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-black ${
          page <= 1 ? "pointer-events-none border-cream-200 bg-cream-100 text-slate-400" : "border-cream-200 bg-cream-50 text-primary-800 hover:bg-primary-50"
        }`}
      >
        Trang trước
      </Link>

      <p className="clinical-mono text-center text-xs font-black text-slate-500">
        {page} / {pageCount}
      </p>

      <Link
        href={buildHref(rawParams, { page: String(Math.min(pageCount, page + 1)) })}
        aria-disabled={page >= pageCount}
        className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-black ${
          page >= pageCount ? "pointer-events-none border-cream-200 bg-cream-100 text-slate-400" : "border-cream-200 bg-cream-50 text-primary-800 hover:bg-primary-50"
        }`}
      >
        Trang sau
      </Link>
    </nav>
  );
}

function parseSyncQuery(params: SearchParams): AdminSyncJobsQuery {
  return {
    q: one(params.q),
    status: one(params.status),
    resourceName: one(params.resourceName),
    dateFrom: one(params.dateFrom),
    dateTo: one(params.dateTo),
    page: toNumber(params.page, 1),
    pageSize: toNumber(params.pageSize, 20),
  };
}

function buildHref(params: SearchParams, patch: Record<string, string>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = Array.isArray(value) ? value[0] : value;
    if (item) next.set(key, item);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const query = next.toString();
  return query ? `/admin/sync?${query}` : "/admin/sync";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | string[] | undefined, fallback: number) {
  const number = Number(one(value));
  return Number.isFinite(number) ? number : fallback;
}
