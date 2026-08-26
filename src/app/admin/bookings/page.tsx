import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, ChevronRight, Clock3, Filter, MessageCircle, Phone, RotateCcw, Search, Stethoscope, UserRound } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminActionButton } from "@/app/admin/admin-action-button";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { AdminZnsTestForm } from "./zns-test-form";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { getAdminBookings, type AdminBookingsQuery } from "@/lib/admin/modules";
import type { AdminRow } from "@/lib/admin/dashboard";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/bookings")) redirect("/admin");

  const rawParams = await searchParams;
  const query = parseBookingQuery(rawParams);
  const data = await getAdminBookings(query);
  const rows = data.rows.map((row) => ({
    ...row,
    actions: row.actions?.filter((item) => canAdminPerformAction(session.role, item.action)),
  }));

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Đăng ký khám"
        title="Phiếu đăng ký khám"
        description="Lọc nhanh theo trạng thái, ngày khám, khoa, chi nhánh và tìm theo họ tên, SĐT, mã lịch hoặc MABN."
        actions={
          <Link href="/admin/bookings" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
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

      <BookingOperationsSummary data={data} canTestZns={canAdminPerformAction(session.role, "test_zns_template")} />
      <BookingToolbar data={data} rawParams={rawParams} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">
          Hiển thị <span className="clinical-mono text-ink">{rows.length}</span> / <span className="clinical-mono text-ink">{data.total}</span> phiếu
        </p>
        <p className="clinical-mono text-xs font-black text-slate-500">
          Trang {data.page}/{data.pageCount}
        </p>
      </div>

      <BookingOperationsList rows={rows} />

      <Pagination page={data.page} pageCount={data.pageCount} rawParams={rawParams} />
    </AdminShell>
  );
}

function BookingOperationsSummary({ data, canTestZns }: { data: Awaited<ReturnType<typeof getAdminBookings>>; canTestZns: boolean }) {
  const cards = [
    {
      label: "Chưa đối soát HIS",
      value: data.stats.unmatched,
      hint: `SLA TB ${formatMinutes(data.stats.avgWaitMinutes)}`,
      tone: data.stats.slaOver30 ? "warn" : "ok",
      icon: <Stethoscope aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: "Match chưa gửi Zalo",
      value: data.stats.matchedUnsentZalo,
      hint: "Cần gửi thủ công hoặc bật auto-send",
      tone: data.stats.matchedUnsentZalo ? "warn" : "ok",
      icon: <MessageCircle aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: "Zalo lỗi/retry",
      value: data.stats.zaloError,
      hint: "Kiểm tra token/template/SĐT",
      tone: data.stats.zaloError ? "bad" : "ok",
      icon: <AlertTriangle aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: "Quá SLA",
      value: data.stats.slaOver120,
      hint: `${data.stats.slaOver30} phiếu > 30 phút`,
      tone: data.stats.slaOver120 ? "bad" : data.stats.slaOver30 ? "warn" : "ok",
      icon: <Clock3 aria-hidden="true" className="h-4 w-4" />,
    },
  ] as const;

  return (
    <section className="mb-5 grid gap-3 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-md border p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)] ${summaryToneClass(card.tone)}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em]">
                {card.icon}
                {card.label}
              </p>
              <span className="clinical-mono rounded-md bg-white/75 px-2 py-1 text-[11px] font-black">{card.value}</span>
            </div>
            <p className="mt-3 text-xs font-bold leading-5 opacity-85">{card.hint}</p>
          </div>
        ))}
      </div>
      {canTestZns ? <AdminZnsTestForm /> : null}
    </section>
  );
}

function summaryToneClass(tone: "ok" | "warn" | "bad") {
  if (tone === "bad") return "border-rose-200 bg-rose-50 text-rose-800";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-primary-100 bg-primary-50 text-primary-900";
}

function formatMinutes(value: number) {
  if (!value) return "0 phút";
  if (value < 60) return `${value} phút`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

function BookingOperationsList({ rows }: { rows: AdminRow[] }) {
  if (!rows.length) {
    return (
      <section className="rounded-md border border-cream-200 bg-cream-50 px-4 py-8 text-center text-sm font-semibold text-slate-500 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
        Không có phiếu đăng ký khám phù hợp bộ lọc.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {rows.map((row) => {
        const details = row.details ?? {};
        return (
          <article key={`booking-${row.id}`} className="rounded-md border border-cream-200 bg-cream-50 p-3 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
            <div className="grid gap-3 xl:grid-cols-[minmax(240px,1.1fr)_minmax(190px,0.8fr)_minmax(190px,0.8fr)_minmax(180px,auto)] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge status={row.status ?? "CHO_DUYET"} />
                  {details.bookingCode && <span className="clinical-mono rounded-md bg-primary-50 px-2 py-1 text-[11px] font-black text-primary-800">{details.bookingCode}</span>}
                </div>
                <Link href={row.href ?? "#"} className="mt-2 block break-words font-serif text-xl font-black leading-tight text-ink underline-offset-4 hover:text-primary-800 hover:underline">
                  {row.primary}
                </Link>
                <div className="mt-2 grid gap-1 text-xs font-bold leading-5 text-slate-600 sm:grid-cols-2">
                  <InlineInfo icon={<Phone className="h-3.5 w-3.5" />} value={details.phone || row.meta} />
                  <InlineInfo icon={<UserRound className="h-3.5 w-3.5" />} value={details.patientCode ? `MABN ${details.patientCode}` : "Chưa có MABN"} />
                </div>
              </div>

              <StatusPanel
                title="Lịch khám"
                icon={<CalendarDays className="h-4 w-4" />}
                tone="neutral"
                lines={[
                  [details.appointmentDate, details.appointmentTime].filter(Boolean).join(" · ") || "Chưa chọn ngày giờ",
                  details.department || "Chưa có khoa/phòng",
                  details.branch || "Chưa có chi nhánh",
                ]}
              />

              <StatusPanel
                title="Đối soát HIS"
                icon={<Stethoscope className="h-4 w-4" />}
                tone={details.hisStatus === "MATCHED" ? "ok" : details.hisStatus ? "warn" : "neutral"}
                badge={details.hisStatus || "PENDING"}
                lines={[
                  details.hisTicket ? `STT ${details.hisTicket}` : "Chưa có STT",
                  details.hisDepartment || "Chưa khớp phòng khám",
                  details.hisMaql ? `MAQL ${details.hisMaql}` : details.hisMatchedAt ? `Khớp ${details.hisMatchedAt}` : "Đang chờ agent đối soát",
                ]}
              />

              <StatusPanel
                title="Tin Zalo"
                icon={<MessageCircle className="h-4 w-4" />}
                tone={details.zaloSentAt || details.outboxStatus === "sent" ? "ok" : details.outboxError ? "bad" : details.outboxStatus ? "warn" : "neutral"}
                badge={details.zaloSentAt ? "Đã gửi" : details.outboxStatus || "Chưa có"}
                lines={[
                  details.zaloSentAt ? `Gửi ${details.zaloSentAt}` : details.outboxStatus ? `Outbox ${details.outboxStatus}` : "Chưa tạo tin nhắn",
                  details.outboxError ? shortText(details.outboxError, 52) : "Auto-send có thể tắt để gửi thủ công",
                ]}
              />
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-cream-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="clinical-mono text-xs font-bold text-slate-500">{details.createdAt ? `Tạo ${details.createdAt}` : row.meta}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={row.href ?? "#"} className="inline-flex items-center gap-1 rounded-md border border-cream-200 bg-white px-2.5 py-1 text-xs font-black text-primary-800 transition hover:bg-primary-50">
                  Xem chi tiết
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
                {row.actions?.map((item) => (
                  <AdminActionButton key={`${row.id}-${item.action}`} action={item.action} label={item.label} target={row.target} confirm={item.confirm} tone={item.tone} />
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function StatusPanel({
  title,
  icon,
  lines,
  badge,
  tone,
}: {
  title: string;
  icon: ReactNode;
  lines: string[];
  badge?: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const styles = {
    ok: "border-primary-100 bg-primary-50 text-primary-900",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    bad: "border-rose-200 bg-rose-50 text-rose-800",
    neutral: "border-cream-200 bg-white text-slate-700",
  };

  return (
    <div className={`min-h-32 rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em]">
          {icon}
          {title}
        </p>
        {badge && <span className="clinical-mono rounded-md bg-white/70 px-2 py-1 text-[10px] font-black uppercase">{badge}</span>}
      </div>
      <div className="mt-3 space-y-1.5 text-xs font-bold leading-5">
        {lines.filter(Boolean).map((line, index) => (
          <p key={`${title}-${index}`} className={index === 0 ? "text-sm font-black text-ink" : ""}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function InlineInfo({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="text-primary-700">{icon}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function shortText(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1).trim()}...` : value;
}

function BookingToolbar({ data, rawParams }: { data: Awaited<ReturnType<typeof getAdminBookings>>; rawParams: SearchParams }) {
  const today = new Date().toISOString().slice(0, 10);
  const tabs = [
    { label: "Tất cả", href: buildHref(rawParams, { status: "", ops: "", page: "1" }), active: !data.filters.status && !data.filters.ops && !isTodayFilter(data.filters.dateFrom, data.filters.dateTo, today) },
    { label: "Chưa đối soát", href: buildHref(rawParams, { status: "", ops: "unmatched", page: "1" }), active: data.filters.ops === "unmatched", count: data.stats.unmatched },
    { label: "Match chưa gửi Zalo", href: buildHref(rawParams, { status: "", ops: "matched_unsent_zalo", page: "1" }), active: data.filters.ops === "matched_unsent_zalo", count: data.stats.matchedUnsentZalo },
    { label: "Zalo lỗi", href: buildHref(rawParams, { status: "", ops: "zalo_error", page: "1" }), active: data.filters.ops === "zalo_error", count: data.stats.zaloError },
    { label: "Chờ duyệt", href: buildHref(rawParams, { status: "CHO_DUYET", ops: "", page: "1" }), active: data.filters.status === "CHO_DUYET" },
    { label: "Đã xác nhận", href: buildHref(rawParams, { status: "DA_XAC_NHAN", ops: "", page: "1" }), active: data.filters.status === "DA_XAC_NHAN" },
    { label: "Hôm nay", href: buildHref(rawParams, { status: "", ops: "", dateFrom: today, dateTo: today, page: "1" }), active: isTodayFilter(data.filters.dateFrom, data.filters.dateTo, today) },
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
            {"count" in tab && tab.count ? <span className="clinical-mono ml-1 rounded bg-white/70 px-1.5 py-0.5 text-[10px]">{tab.count}</span> : null}
          </Link>
        ))}
      </div>

      <form action="/admin/bookings" className="grid gap-3 lg:grid-cols-[1.3fr_160px_160px_1fr_1fr_120px_auto] lg:items-end">
        <label className="block text-sm font-bold text-ink">
          Tìm kiếm
          <span className="mt-2 flex items-center gap-2 rounded-md border border-cream-200 bg-white px-3 py-2.5 ring-primary-100 focus-within:ring-4">
            <Search aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              name="q"
              defaultValue={data.filters.q}
              placeholder="Họ tên, SĐT, mã lịch, MABN"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </span>
        </label>

        <Select name="status" label="Trạng thái" value={data.filters.status} options={data.options.statuses} allLabel="Tất cả" />

        <Select name="pageSize" label="Số dòng" value={String(data.pageSize)} options={["10", "20", "50", "100"]} allLabel="" />

        <label className="block text-sm font-bold text-ink">
          Từ ngày
          <input name="dateFrom" type="date" defaultValue={data.filters.dateFrom} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 clinical-mono text-sm font-bold outline-none ring-primary-100 focus:ring-4" />
        </label>

        <label className="block text-sm font-bold text-ink">
          Đến ngày
          <input name="dateTo" type="date" defaultValue={data.filters.dateTo} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 clinical-mono text-sm font-bold outline-none ring-primary-100 focus:ring-4" />
        </label>

        <Select name="department" label="Khoa" value={data.filters.department} options={data.options.departments} allLabel="Tất cả" />
        <Select name="branch" label="Chi nhánh" value={data.filters.branch} options={data.options.branches} allLabel="Tất cả" />

        <input type="hidden" name="ops" value={data.filters.ops} />
        <input type="hidden" name="page" value="1" />
        <button className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-primary-900">
          <Filter aria-hidden="true" className="h-4 w-4" />
          Lọc
        </button>
      </form>
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

      <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600">
        <CalendarDays aria-hidden="true" className="h-4 w-4 text-primary-700" />
        <span className="clinical-mono">
          {page} / {pageCount}
        </span>
      </div>

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

function parseBookingQuery(params: SearchParams): AdminBookingsQuery {
  return {
    q: one(params.q),
    status: one(params.status),
    ops: one(params.ops),
    dateFrom: one(params.dateFrom),
    dateTo: one(params.dateTo),
    department: one(params.department),
    branch: one(params.branch),
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
  return query ? `/admin/bookings?${query}` : "/admin/bookings";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | string[] | undefined, fallback: number) {
  const number = Number(one(value));
  return Number.isFinite(number) ? number : fallback;
}

function isTodayFilter(from: string, to: string, today: string) {
  return from === today && to === today;
}
