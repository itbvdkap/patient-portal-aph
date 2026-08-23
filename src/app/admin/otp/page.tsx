import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertCircle, Filter, KeyRound, RotateCcw, Search, Smartphone } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { canAdminAccessPath, getAdminSession } from "@/lib/admin/session";
import { getAdminOtpEvents, type AdminOtpEventEntry, type AdminOtpEventsQuery } from "@/lib/admin/modules";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminOtpPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/otp")) redirect("/admin");

  const rawParams = await searchParams;
  const query = parseOtpQuery(rawParams);
  const data = await getAdminOtpEvents(query);

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="OTP / Zalo"
        title="Đăng nhập và OTP"
        description="Lọc theo SĐT, trạng thái OTP, provider, thiết bị, IP và thời gian để kiểm tra lỗi đăng nhập hoặc Zalo OTP nhanh hơn."
        actions={
          <Link href="/admin/otp" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
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

      {data.failedOtpCount > 0 && (
        <section className="mb-5 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Có {data.failedOtpCount} phiên OTP gửi hoặc xác minh lỗi.</p>
            <p className="font-semibold">Mở tab “OTP lỗi” và xem chi tiết kỹ thuật để kiểm tra phản hồi từ Zalo/ZNS hoặc số lần nhập sai.</p>
          </div>
        </section>
      )}

      <OtpToolbar data={data} rawParams={rawParams} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">
          Hiển thị <span className="clinical-mono text-ink">{data.entries.length}</span> / <span className="clinical-mono text-ink">{data.total}</span> sự kiện
        </p>
        <p className="clinical-mono text-xs font-black text-slate-500">
          Trang {data.page}/{data.pageCount}
        </p>
      </div>

      <OtpRows entries={data.entries} />

      <Pagination page={data.page} pageCount={data.pageCount} rawParams={rawParams} />
    </AdminShell>
  );
}

function OtpToolbar({ data, rawParams }: { data: Awaited<ReturnType<typeof getAdminOtpEvents>>; rawParams: SearchParams }) {
  const tabs = [
    { label: "Tất cả", href: buildHref(rawParams, { source: "", status: "", page: "1" }), active: !data.filters.source && !data.filters.status },
    { label: "Login", href: buildHref(rawParams, { source: "login", status: "", page: "1" }), active: data.filters.source === "login" },
    { label: "OTP", href: buildHref(rawParams, { source: "otp", status: "", page: "1" }), active: data.filters.source === "otp" && !data.filters.status },
    { label: "OTP lỗi", href: buildHref(rawParams, { source: "otp", status: "failed", page: "1" }), active: data.filters.source === "otp" && data.filters.status === "failed" },
    { label: "Zalo", href: buildHref(rawParams, { source: "otp", provider: "zalo", page: "1" }), active: data.filters.provider === "zalo" },
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

      <form action="/admin/otp" className="grid gap-3 lg:grid-cols-[1.2fr_130px_150px_140px_1fr_1fr_1fr_120px_auto] lg:items-end">
        <label className="block text-sm font-bold text-ink">
          SĐT / từ khóa
          <span className="mt-2 flex items-center gap-2 rounded-md border border-cream-200 bg-white px-3 py-2.5 ring-primary-100 focus-within:ring-4">
            <Search aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              name="q"
              defaultValue={data.filters.q}
              placeholder="SĐT, trạng thái, thiết bị"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </span>
        </label>

        <Select name="source" label="Nguồn" value={data.filters.source} options={["login", "otp"]} labels={{ login: "Login", otp: "OTP" }} allLabel="Tất cả" />
        <Select name="status" label="Trạng thái" value={data.filters.status} options={[...data.options.statuses, ...data.options.eventTypes]} labels={STATUS_LABELS} allLabel="Tất cả" />
        <Select name="provider" label="Provider" value={data.filters.provider} options={data.options.providers} allLabel="Tất cả" />

        <label className="block text-sm font-bold text-ink">
          Thiết bị
          <input name="device" defaultValue={data.filters.device} placeholder="iPhone, Android..." className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm font-bold outline-none ring-primary-100 focus:ring-4" />
        </label>

        <label className="block text-sm font-bold text-ink">
          IP
          <input name="ip" defaultValue={data.filters.ip} placeholder="192.168..." className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 clinical-mono text-sm font-bold outline-none ring-primary-100 focus:ring-4" />
        </label>

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
        <KeyRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        Khi Zalo OTP không tới, lọc Provider = zalo và Trạng thái = failed để xem mã lỗi/response từ ZNS trong “Chi tiết kỹ thuật”.
      </div>
    </section>
  );
}

function OtpRows({ entries }: { entries: AdminOtpEventEntry[] }) {
  if (!entries.length) {
    return <p className="rounded-md border border-dashed border-cream-300 bg-cream-100/40 px-4 py-8 text-center text-sm font-semibold text-slate-500">Không có sự kiện phù hợp bộ lọc.</p>;
  }

  return (
    <section className="overflow-hidden rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="hidden grid-cols-[1fr_180px_190px] gap-3 border-b border-cream-200 bg-cream-100/70 px-4 py-3 text-xs font-black uppercase text-slate-500 lg:grid">
        <span>Sự kiện</span>
        <span>Thiết bị / IP</span>
        <span>Thời gian</span>
      </div>
      <div className="divide-y divide-cream-200">
        {entries.map((entry) => (
          <article key={entry.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_180px_190px] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="clinical-mono break-words text-sm font-black text-ink">{entry.phoneLabel}</p>
                <AdminStatusBadge status={STATUS_LABELS[entry.status] ?? entry.status} />
                <span className="rounded-md bg-cream-100 px-2 py-1 text-[11px] font-black uppercase text-slate-600">{entry.provider}</span>
              </div>
              <p className="mt-1 text-sm font-black text-ink">{entry.title}</p>
              <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-700">{entry.message}</p>
              {entry.attemptText && <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">Lần nhập {entry.attemptText}</p>}
              <details className="mt-2 rounded-md border border-cream-200 bg-white/70 px-3 py-2">
                <summary className="cursor-pointer text-xs font-black uppercase text-primary-800">Chi tiết kỹ thuật</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-cream-100 p-3 clinical-mono text-xs font-bold text-slate-700">
                  {JSON.stringify(entry.technicalJson, null, 2)}
                </pre>
              </details>
            </div>

            <div className="text-sm font-semibold leading-6 text-slate-700">
              <p className="flex items-center gap-2 font-black text-ink">
                <Smartphone aria-hidden="true" className="h-4 w-4 text-primary-700" />
                {entry.deviceLabel || "Không ghi thiết bị"}
              </p>
              <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">{entry.ipAddress || "Không ghi IP"}</p>
            </div>

            <div>
              <p className="clinical-mono text-xs font-bold text-slate-500">{formatDate(entry.createdAt)}</p>
              {entry.expiresAt && <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">Hết hạn {formatDate(entry.expiresAt)}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
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
  const uniqueOptions = [...new Set(options.filter(Boolean))];
  return (
    <label className="block text-sm font-bold text-ink">
      {label}
      <select name={name} defaultValue={value} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm font-bold outline-none ring-primary-100 focus:ring-4">
        {allLabel && <option value="">{allLabel}</option>}
        {uniqueOptions.map((option) => (
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

function parseOtpQuery(params: SearchParams): AdminOtpEventsQuery {
  return {
    q: one(params.q),
    source: one(params.source),
    status: one(params.status),
    provider: one(params.provider),
    device: one(params.device),
    ip: one(params.ip),
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
  return query ? `/admin/otp?${query}` : "/admin/otp";
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

const STATUS_LABELS: Record<string, string> = {
  sent: "Đã gửi",
  failed: "Lỗi",
  verified: "Đã xác minh",
  pending: "Đang chờ",
  login: "Đăng nhập",
  otp_login: "Đăng nhập OTP",
  password_login: "Đăng nhập mật khẩu",
  logout: "Đăng xuất",
  logout_all: "Đăng xuất tất cả",
};
