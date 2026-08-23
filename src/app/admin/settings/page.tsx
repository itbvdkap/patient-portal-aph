import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LockKeyhole, RotateCcw, Settings2, ShieldCheck } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { SettingEditButton } from "@/app/admin/settings/setting-edit-button";
import { canAdminAccessPath, getAdminSession } from "@/lib/admin/session";
import { getAdminSettings, type AdminSettingEntry } from "@/lib/admin/modules";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/settings")) redirect("/admin");

  const rawParams = await searchParams;
  const group = one(rawParams.group) || "auth";
  const data = await getAdminSettings();
  const visibleEntries = data.entries.filter((entry) => entry.group === group);

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Cấu hình"
        title="Thông số vận hành"
        description="Chỉnh các cấu hình không bí mật trong portal_app_settings. Secret thật vẫn phải đặt bằng biến môi trường server/Vercel."
        actions={
          <Link href="/admin/settings" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Về Auth
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

      <section className="mb-5 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
        <div className="mb-4 flex items-start gap-3 rounded-md bg-primary-50 px-3 py-3 text-sm leading-6 text-primary-900">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Audit log tự ghi khi thay đổi cấu hình.</p>
            <p className="font-semibold">Các key chứa token, secret, password, key, connection string sẽ bị ẩn và không cho sửa trong UI.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.groups.map((item) => (
            <Link
              key={item.id}
              href={`/admin/settings?group=${encodeURIComponent(item.id)}`}
              className={`rounded-md px-3 py-2 text-xs font-black transition ${
                group === item.id ? "bg-primary-700 text-white" : "border border-cream-200 bg-cream-100 text-slate-700 hover:bg-primary-50 hover:text-primary-800"
              }`}
            >
              {item.label}
              <span className="ml-2 clinical-mono opacity-80">{item.count}</span>
              {item.missing > 0 && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-900">{item.missing} thiếu</span>}
            </Link>
          ))}
        </div>
      </section>

      <SettingsGroup groupLabel={data.groups.find((item) => item.id === group)?.label ?? group} entries={visibleEntries} />
    </AdminShell>
  );
}

function SettingsGroup({ groupLabel, entries }: { groupLabel: string; entries: AdminSettingEntry[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="flex flex-col gap-2 border-b border-cream-200 bg-cream-100/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Settings2 aria-hidden="true" className="h-5 w-5 text-primary-700" />
          <h2 className="font-serif text-xl font-black text-ink">{groupLabel}</h2>
        </div>
        <p className="clinical-mono text-xs font-black text-slate-500">{entries.length} cấu hình</p>
      </div>

      {entries.length ? (
        <div className="divide-y divide-cream-200">
          {entries.map((entry) => (
            <article key={entry.key} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_240px_130px] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-sm font-black text-ink">{entry.label}</p>
                  <AdminStatusBadge status={statusLabel(entry.status)} />
                  {entry.isSecret && <LockKeyhole aria-label="Secret" className="h-4 w-4 text-slate-500" />}
                </div>
                <p className="mt-1 break-words clinical-mono text-xs font-bold text-slate-500">{entry.key}</p>
                <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-600">{entry.description}</p>
              </div>

              <div className="rounded-md border border-cream-200 bg-white/70 px-3 py-2">
                <p className="text-[11px] font-black uppercase text-slate-500">Giá trị</p>
                <p className="mt-1 break-words clinical-mono text-sm font-black text-ink">{entry.displayValue}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {entry.updatedBy} · {formatDate(entry.updatedAt)}
                </p>
              </div>

              <div className="flex justify-start lg:justify-end">
                <SettingEditButton setting={entry} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="font-serif text-xl font-black text-ink">Chưa có cấu hình trong nhóm này</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Có thể thêm seed/migration cho nhóm này sau khi chốt danh sách thông số vận hành.</p>
        </div>
      )}
    </section>
  );
}

function statusLabel(status: AdminSettingEntry["status"]) {
  if (status === "ok") return "Đã cấu hình";
  if (status === "secret") return "Secret";
  return "Thiếu";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
