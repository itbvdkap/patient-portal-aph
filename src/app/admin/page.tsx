import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  CalendarCheck,
  ClipboardList,
  DatabaseZap,
  FileText,
  KeyRound,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminActionButton } from "@/app/admin/admin-action-button";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { getAdminDashboardData, type AdminMetric, type AdminRow, type AdminSettingStatus } from "@/lib/admin/dashboard";
import { canAdminPerformAction, getAdminSession } from "@/lib/admin/session";

export default async function AdminPage() {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");

  const data = await getAdminDashboardData();
  const filterRows = (rows: AdminRow[]) =>
    rows.map((row) => ({
      ...row,
      actions: row.actions?.filter((item) => canAdminPerformAction(session.role, item.action)),
    }));

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Tổng quan hệ thống"
        title="Trang quản trị"
        description="Dữ liệu y tế chỉ đọc từ reporting/snapshot. Các thao tác quản trị chỉ điều khiển portal, booking và hàng đợi sync."
        actions={
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-primary-50 px-3 py-2 text-xs font-black text-primary-800">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Phiên quản trị đã bảo vệ
          </span>
        }
      />

      {data.warnings.length > 0 && (
        <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">Một số nguồn dữ liệu chưa sẵn sàng</p>
          <ul className="mt-2 list-inside list-disc">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-5">
          <AdminPanel href="/admin/accounts" title="Tài khoản gần đây" icon={UserRound} rows={filterRows(data.accounts)} empty="Chưa có tài khoản portal." />
          <AdminPanel href="/admin/profiles" title="Hồ sơ y tế liên kết" icon={UsersRound} rows={filterRows(data.profiles)} empty="Chưa có hồ sơ liên kết." />
          <AdminPanel href="/admin/bookings" title="Đăng ký khám mới" icon={CalendarCheck} rows={filterRows(data.bookings)} empty="Chưa đọc được dữ liệu đăng ký khám." />
        </div>

        <div className="grid content-start gap-5">
          <AdminPanel href="/admin/sync" title="Sync HIS / Oracle" icon={DatabaseZap} rows={filterRows(data.syncJobs)} empty="Chưa có job sync." />
          <SettingsPanel settings={data.settings} />
          <AdminPanel href="/admin/otp" title="Đăng nhập / OTP gần đây" icon={KeyRound} rows={data.loginEvents} empty="Chưa có log đăng nhập." />
          <AdminPanel href="/admin/content" title="Cẩm nang / nội dung" icon={FileText} rows={filterRows(data.content)} empty="Chưa có bảng nội dung CMS." />
        </div>
      </div>

      <section className="mt-5 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
            <ClipboardList aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-serif text-lg font-black">Lộ trình admin tiếp theo</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Bước kế tiếp nên làm màn hình chi tiết từng tài khoản/booking, editor bài viết đầy đủ, phân quyền nhiều admin và ghi chú khi hủy/xác nhận lịch.
            </p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function MetricCard({ metric }: { metric: AdminMetric }) {
  const tones = {
    green: "bg-primary-50 text-primary-800",
    amber: "bg-amber-50 text-amber-900",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-800",
    slate: "bg-cream-100 text-slate-700",
  };

  return (
    <article className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <p className="text-xs font-black uppercase text-slate-500">{metric.label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="clinical-mono text-3xl font-black text-ink">{metric.value}</p>
        <span className={`rounded-md px-2 py-1 text-xs font-black ${tones[metric.tone ?? "slate"]}`}>{metric.hint}</span>
      </div>
    </article>
  );
}

function AdminPanel({
  href,
  title,
  icon: Icon,
  rows,
  empty,
}: {
  href: string;
  title: string;
  icon: typeof Activity;
  rows: AdminRow[];
  empty: string;
}) {
  return (
    <section className="rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-4 py-3">
        <Link href={href} className="flex items-center gap-2 font-serif text-lg font-black text-ink transition hover:text-primary-700">
          <Icon aria-hidden="true" className="h-5 w-5 text-primary-700" />
          {title}
        </Link>
        <Link href={href} className="clinical-mono rounded-md bg-cream-100 px-2 py-1 text-xs font-black text-slate-600 hover:bg-primary-50">
          {rows.length}
        </Link>
      </div>

      {rows.length ? (
        <div className="divide-y divide-cream-200">
          {rows.map((row, index) => (
            <article key={`${title}-${row.entity ?? "row"}-${row.id}-${index}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                {row.href ? (
                  <Link href={row.href} className="block truncate text-sm font-black text-ink underline-offset-4 hover:text-primary-800 hover:underline">
                    {row.primary}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-black text-ink">{row.primary}</p>
                )}
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{row.secondary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {row.status && <AdminStatusBadge status={row.status} />}
                <span className="clinical-mono text-xs font-bold text-slate-500">{row.meta}</span>
                {row.actions?.map((item) => (
                  <AdminActionButton
                    key={item.action}
                    action={item.action}
                    label={item.label}
                    target={row.target}
                    confirm={item.confirm}
                    tone={item.tone}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm font-semibold text-slate-500">{empty}</p>
      )}
    </section>
  );
}

function SettingsPanel({ settings }: { settings: AdminSettingStatus[] }) {
  return (
    <section className="rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-4 py-3">
        <Link href="/admin/settings" className="flex items-center gap-2 font-serif text-lg font-black text-ink transition hover:text-primary-700">
          <Settings aria-hidden="true" className="h-5 w-5 text-primary-700" />
          Cấu hình vận hành
        </Link>
      </div>
      <div className="grid gap-2 p-4">
        {settings.map((setting) => (
          <div key={setting.label} className="flex items-center justify-between gap-3 rounded-md bg-cream-100/70 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-black text-ink">{setting.label}</p>
              <p className="clinical-mono mt-0.5 truncate text-xs font-bold text-slate-600">{setting.value}</p>
            </div>
            <AdminStatusBadge status={setting.status} />
          </div>
        ))}
      </div>
    </section>
  );
}
