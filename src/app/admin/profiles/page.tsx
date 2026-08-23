import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle, Filter, RotateCcw, Search, UsersRound } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminTable } from "@/app/admin/admin-table";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { getAdminProfiles, type AdminProfilesQuery } from "@/lib/admin/modules";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminProfilesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/profiles")) redirect("/admin");

  const rawParams = await searchParams;
  const query = parseProfileQuery(rawParams);
  const data = await getAdminProfiles(query);
  const rows = data.rows.map((row) => ({
    ...row,
    actions: row.actions?.filter((item) => canAdminPerformAction(session.role, item.action)),
  }));

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Hồ sơ bệnh nhân"
        title="Hồ sơ y tế liên kết"
        description="Tìm kiếm theo MABN, họ tên, tài khoản; lọc quan hệ, xác minh, hồ sơ đang xem và rà soát hồ sơ liên kết nhiều tài khoản."
        actions={
          <Link href="/admin/profiles" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
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

      {data.duplicateMabns.length > 0 && (
        <section className="mb-5 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Có {data.duplicateMabns.length} MABN đang liên kết nhiều tài khoản.</p>
            <p className="font-semibold text-amber-900">Dùng tab “Nhiều tài khoản” để rà lại quan hệ người thân và gỡ liên kết sai nếu cần.</p>
          </div>
        </section>
      )}

      <ProfilesToolbar data={data} rawParams={rawParams} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">
          Hiển thị <span className="clinical-mono text-ink">{rows.length}</span> / <span className="clinical-mono text-ink">{data.total}</span> hồ sơ
        </p>
        <p className="clinical-mono text-xs font-black text-slate-500">
          Trang {data.page}/{data.pageCount}
        </p>
      </div>

      <AdminTable rows={rows} empty="Không có hồ sơ y tế phù hợp bộ lọc." columns={["Hồ sơ y tế", "Trạng thái", "Liên kết"]} />

      <Pagination page={data.page} pageCount={data.pageCount} rawParams={rawParams} />
    </AdminShell>
  );
}

function ProfilesToolbar({ data, rawParams }: { data: Awaited<ReturnType<typeof getAdminProfiles>>; rawParams: SearchParams }) {
  const tabs = [
    {
      label: "Tất cả",
      href: buildHref(rawParams, { relationship: "", verified: "", active: "", multiAccount: "", page: "1" }),
      active: !data.filters.relationship && !data.filters.verified && !data.filters.active && !data.filters.multiAccount,
    },
    { label: "Đang xem", href: buildHref(rawParams, { active: "yes", multiAccount: "", page: "1" }), active: data.filters.active === "yes" },
    { label: "Đã xác minh", href: buildHref(rawParams, { verified: "yes", multiAccount: "", page: "1" }), active: data.filters.verified === "yes" },
    { label: "Chưa xác minh", href: buildHref(rawParams, { verified: "no", multiAccount: "", page: "1" }), active: data.filters.verified === "no" },
    { label: "Nhiều tài khoản", href: buildHref(rawParams, { multiAccount: "yes", page: "1" }), active: data.filters.multiAccount === "yes" },
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

      <form action="/admin/profiles" className="grid gap-3 lg:grid-cols-[1.3fr_180px_160px_160px_120px_auto] lg:items-end">
        <label className="block text-sm font-bold text-ink">
          Tìm kiếm
          <span className="mt-2 flex items-center gap-2 rounded-md border border-cream-200 bg-white px-3 py-2.5 ring-primary-100 focus-within:ring-4">
            <Search aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              name="q"
              defaultValue={data.filters.q}
              placeholder="MABN, họ tên, tài khoản"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </span>
        </label>

        <Select name="relationship" label="Quan hệ" value={data.filters.relationship} options={data.options.relationships} allLabel="Tất cả" />
        <Select name="verified" label="Xác minh" value={data.filters.verified} options={["yes", "no"]} labels={{ yes: "Đã xác minh", no: "Chưa xác minh" }} allLabel="Tất cả" />
        <Select name="active" label="Đang xem" value={data.filters.active} options={["yes", "no"]} labels={{ yes: "Đang xem", no: "Không xem" }} allLabel="Tất cả" />
        <Select name="pageSize" label="Số dòng" value={String(data.pageSize)} options={["10", "20", "50", "100"]} allLabel="" />

        <input type="hidden" name="multiAccount" value={data.filters.multiAccount} />
        <input type="hidden" name="page" value="1" />
        <button className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-primary-900">
          <Filter aria-hidden="true" className="h-4 w-4" />
          Lọc
        </button>
      </form>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-primary-50 px-3 py-2 text-xs font-bold leading-5 text-primary-900">
        <UsersRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        Gỡ hồ sơ liên kết cần nhập lý do để lưu audit log. Không gỡ nhanh hồ sơ mặc định hoặc hồ sơ cuối cùng của tài khoản.
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

function parseProfileQuery(params: SearchParams): AdminProfilesQuery {
  return {
    q: one(params.q),
    relationship: one(params.relationship),
    verified: one(params.verified),
    active: one(params.active),
    multiAccount: one(params.multiAccount),
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
  return query ? `/admin/profiles?${query}` : "/admin/profiles";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | string[] | undefined, fallback: number) {
  const number = Number(one(value));
  return Number.isFinite(number) ? number : fallback;
}
