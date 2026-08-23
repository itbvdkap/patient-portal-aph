import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminActionButton } from "@/app/admin/admin-action-button";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { getAdminProfileDetail } from "@/lib/admin/modules";

export default async function AdminProfileDetailPage({ params }: { params: Promise<{ mabn: string }> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/profiles")) redirect("/admin");

  const { mabn } = await params;
  const data = await getAdminProfileDetail(mabn);
  const canUnlink = canAdminPerformAction(session.role, "unlink_profile");
  const canRetry = canAdminPerformAction(session.role, "retry_sync");

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Chi tiết hồ sơ y tế"
        title={`Mã BN ${data.mabn || "?"}`}
        description="Theo dõi các tài khoản đang liên kết với MABN, snapshot dữ liệu đã đồng bộ và các job HIS liên quan."
        actions={<BackLink href="/admin/profiles" label="Quay lại hồ sơ" />}
      />

      {data.warnings.length > 0 && <WarningBox warnings={data.warnings} />}

      <DetailSection title="Tài khoản đang liên kết" count={data.links.length}>
        <div className="divide-y divide-cream-200">
          {data.links.map((item) => (
            <div key={`${item.account_id ?? item.account_key}-${item.mabn}`} className="grid gap-3 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="font-black text-ink">{String(item.display_name ?? item.patient_name ?? "Hồ sơ chưa có tên")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {String(item.relationship ?? "Chưa ghi quan hệ")} · {item.verified_at ? `Xác minh ${formatDate(item.verified_at)}` : "Chưa xác minh"}
                </p>
                <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">
                  Account {String(item.account_id ?? item.account_key ?? "?")} · Liên kết {formatDate(item.linked_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Boolean(item.is_active) && <AdminStatusBadge status="đang xem" />}
                {Boolean(item.is_default) && <AdminStatusBadge status="mặc định" />}
                {!Boolean(item.is_default) && canUnlink && (
                  <AdminActionButton
                    action="unlink_profile"
                    label="Gỡ liên kết"
                    tone="danger"
                    target={{
                      accountId: String(item.account_id ?? ""),
                      accountKey: String(item.account_key ?? ""),
                      mabn: String(item.mabn ?? ""),
                    }}
                    confirm="Gỡ liên kết hồ sơ y tế này khỏi tài khoản?"
                  />
                )}
              </div>
            </div>
          ))}
          {!data.links.length && <Empty text="Chưa có tài khoản nào liên kết MABN này." />}
        </div>
      </DetailSection>

      <DetailSection title="Snapshot đã đồng bộ" count={data.snapshots.length}>
        <SimpleRows
          rows={data.snapshots}
          primary="resource_name"
          secondary={["resource_id", "cache_key"]}
          date="updated_at"
          fallback="Chưa có snapshot dữ liệu."
        />
      </DetailSection>

      <DetailSection title="Sync jobs theo MABN" count={data.syncJobs.length}>
        <div className="divide-y divide-cream-200">
          {data.syncJobs.map((job) => (
            <div key={String(job.job_id)} className="grid gap-3 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <Link href={`/admin/sync/${job.job_id}`} className="font-black text-ink underline-offset-4 hover:text-primary-800 hover:underline">
                  Job #{String(job.job_id)} · {String(job.resource_name ?? "all")}
                </Link>
                <p className="mt-1 text-sm font-semibold text-slate-600">{String(job.error_message ?? job.requested_reason ?? "Không có lỗi")}</p>
                <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">Cập nhật {formatDate(job.updated_at)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge status={String(job.status ?? "queued")} />
                {canRetry && <AdminActionButton action="retry_sync" label="Retry" tone="primary" target={{ jobId: String(job.job_id ?? ""), mabn: data.mabn, resourceName: String(job.resource_name ?? "all") }} />}
              </div>
            </div>
          ))}
          {!data.syncJobs.length && <Empty text="Chưa có job đồng bộ cho MABN này." />}
        </div>
      </DetailSection>
    </AdminShell>
  );
}

function DetailSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-serif text-xl font-black text-ink">{title}</h3>
        <span className="clinical-mono text-sm font-black text-slate-500">{count}</span>
      </div>
      {children}
    </section>
  );
}

function SimpleRows({ rows, primary, secondary, date, fallback }: { rows: Record<string, unknown>[]; primary: string; secondary: string[]; date: string; fallback: string }) {
  if (!rows.length) return <Empty text={fallback} />;
  return (
    <div className="divide-y divide-cream-200">
      {rows.map((row) => (
        <div key={String(row.cache_key ?? row.job_id ?? row[primary])} className="py-3">
          <p className="font-black text-ink">{String(row[primary] ?? "Dữ liệu")}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-600">{secondary.map((key) => row[key]).filter(Boolean).join(" · ") || "Chưa ghi nhận"}</p>
          <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">Cập nhật {formatDate(row[date])}</p>
        </div>
      ))}
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm transition hover:bg-primary-50">
      {label}
    </Link>
  );
}

function WarningBox({ warnings }: { warnings: string[] }) {
  return (
    <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <p className="font-black">Một số dữ liệu chưa sẵn sàng</p>
      <ul className="mt-2 list-inside list-disc">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-cream-300 bg-cream-100/40 px-4 py-6 text-center text-sm font-semibold text-slate-500">{text}</p>;
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
