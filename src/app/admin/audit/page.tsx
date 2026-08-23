import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FileSearch, Filter, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { canAdminAccessPath, getAdminSession } from "@/lib/admin/session";
import { getAdminAuditLogs, type AdminAuditEntry, type AdminAuditLogsQuery } from "@/lib/admin/modules";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/audit")) redirect("/admin");

  const rawParams = await searchParams;
  const query = parseAuditQuery(rawParams);
  const data = await getAdminAuditLogs(query);

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Audit"
        title="Nhật ký quản trị"
        description="Truy vết thao tác khóa tài khoản, gỡ hồ sơ, retry sync, duyệt hoặc hủy đăng ký khám theo admin, action, target và thời gian."
        actions={
          <Link href="/admin/audit" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
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

      <AuditToolbar data={data} rawParams={rawParams} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">
          Hiển thị <span className="clinical-mono text-ink">{data.entries.length}</span> / <span className="clinical-mono text-ink">{data.total}</span> log
        </p>
        <p className="clinical-mono text-xs font-black text-slate-500">
          Trang {data.page}/{data.pageCount}
        </p>
      </div>

      <AuditRows entries={data.entries} />

      <Pagination page={data.page} pageCount={data.pageCount} rawParams={rawParams} />
    </AdminShell>
  );
}

function AuditToolbar({ data, rawParams }: { data: Awaited<ReturnType<typeof getAdminAuditLogs>>; rawParams: SearchParams }) {
  const tabs = [
    { label: "Tất cả", href: buildHref(rawParams, { action: "", targetType: "", page: "1" }), active: !data.filters.action && !data.filters.targetType },
    { label: "Khóa tài khoản", href: buildHref(rawParams, { action: "lock_account", page: "1" }), active: data.filters.action === "lock_account" },
    { label: "Gỡ hồ sơ", href: buildHref(rawParams, { action: "unlink_profile", page: "1" }), active: data.filters.action === "unlink_profile" },
    { label: "Retry sync", href: buildHref(rawParams, { action: "retry_sync", page: "1" }), active: data.filters.action === "retry_sync" },
    { label: "Lịch khám", href: buildHref(rawParams, { targetType: "booking", page: "1" }), active: data.filters.targetType === "booking" },
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

      <form action="/admin/audit" className="grid gap-3 lg:grid-cols-[1.3fr_150px_170px_150px_1fr_1fr_120px_auto] lg:items-end">
        <label className="block text-sm font-bold text-ink">
          Tìm kiếm
          <span className="mt-2 flex items-center gap-2 rounded-md border border-cream-200 bg-white px-3 py-2.5 ring-primary-100 focus-within:ring-4">
            <Search aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              name="q"
              defaultValue={data.filters.q}
              placeholder="Admin, action, target, IP"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </span>
        </label>

        <Select name="admin" label="Admin" value={data.filters.admin} options={data.options.admins} allLabel="Tất cả" />
        <Select name="action" label="Action" value={data.filters.action} options={data.options.actions} allLabel="Tất cả" labels={ACTION_LABELS} />
        <Select name="targetType" label="Target" value={data.filters.targetType} options={data.options.targetTypes} allLabel="Tất cả" labels={TARGET_LABELS} />

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
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        Audit log dùng để đối soát thao tác quản trị. Các ghi chú như lý do khóa, lý do gỡ hồ sơ, ghi chú duyệt/hủy lịch được ưu tiên hiển thị.
      </div>
    </section>
  );
}

function AuditRows({ entries }: { entries: AdminAuditEntry[] }) {
  if (!entries.length) {
    return <p className="rounded-md border border-dashed border-cream-300 bg-cream-100/40 px-4 py-8 text-center text-sm font-semibold text-slate-500">Không có audit log phù hợp bộ lọc.</p>;
  }

  return (
    <section className="overflow-hidden rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="hidden grid-cols-[1fr_180px_190px] gap-3 border-b border-cream-200 bg-cream-100/70 px-4 py-3 text-xs font-black uppercase text-slate-500 lg:grid">
        <span>Thao tác</span>
        <span>Target</span>
        <span>Thời gian</span>
      </div>
      <div className="divide-y divide-cream-200">
        {entries.map((entry) => (
          <article key={entry.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_180px_190px] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-black text-ink">{entry.adminUsername}</p>
                <AdminStatusBadge status={entry.actionLabel} />
              </div>
              <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-700">{entry.detailText}</p>
              <details className="mt-2 rounded-md border border-cream-200 bg-white/70 px-3 py-2">
                <summary className="cursor-pointer text-xs font-black uppercase text-primary-800">
                  <FileSearch aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                  Chi tiết kỹ thuật
                </summary>
                <dl className="mt-2 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
                  <Info label="IP" value={entry.ipAddress} />
                  <Info label="Thiết bị" value={entry.userAgent} />
                </dl>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-cream-100 p-3 clinical-mono text-xs font-bold text-slate-700">
                  {JSON.stringify(entry.detailJson, null, 2)}
                </pre>
              </details>
            </div>

            <div>
              <p className="text-sm font-black text-ink">{entry.targetLabel}</p>
              <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">{entry.targetType}</p>
            </div>

            <p className="clinical-mono text-xs font-bold text-slate-500">{formatDate(entry.createdAt)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-black uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words clinical-mono text-slate-700">{value}</dd>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
  allLabel,
  labels = {},
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  labels?: Record<string, string>;
}) {
  return (
    <label className="block text-sm font-bold text-ink">
      {label}
      <select name={name} defaultValue={value} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm font-bold outline-none ring-primary-100 focus:ring-4">
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={`${name}-${option}`} value={option}>
            {labels[option] ?? option}
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

function parseAuditQuery(params: SearchParams): AdminAuditLogsQuery {
  return {
    q: one(params.q),
    admin: one(params.admin),
    action: one(params.action),
    targetType: one(params.targetType),
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
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | string[] | undefined, fallback: number) {
  const number = Number(one(value));
  return Number.isFinite(number) ? number : fallback;
}

function formatDate(value: unknown) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const ACTION_LABELS: Record<string, string> = {
  lock_account: "Khóa tài khoản",
  unlock_account: "Mở khóa tài khoản",
  unlink_profile: "Gỡ hồ sơ",
  retry_sync: "Retry sync",
  approve_booking: "Xác nhận lịch",
  cancel_booking: "Hủy lịch",
  edit_setting: "Sửa cấu hình",
  publish_content: "Xuất bản bài",
  archive_content: "Ẩn bài",
};

const TARGET_LABELS: Record<string, string> = {
  account: "Tài khoản",
  profile: "Hồ sơ",
  sync_job: "Sync job",
  booking: "Lịch khám",
  setting: "Cấu hình",
  content: "Bài viết",
};
