import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminActionButton } from "@/app/admin/admin-action-button";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { getAdminSyncJobDetail, summarizeSyncError } from "@/lib/admin/modules";

export default async function AdminSyncJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/sync")) redirect("/admin");

  const { id } = await params;
  const data = await getAdminSyncJobDetail(id);
  const job = data.job;
  const canRetry = canAdminPerformAction(session.role, "retry_sync");

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Chi tiết sync job"
        title={job ? `Job #${String(job.job_id)}` : "Sync job"}
        description="Kiểm tra trạng thái, lỗi, thời gian lock và các snapshot liên quan trước khi retry."
        actions={<BackLink href="/admin/sync" label="Quay lại sync jobs" />}
      />

      {data.warnings.length > 0 && <WarningBox warnings={data.warnings} />}

      {job ? (
        <div className="grid gap-5">
          <section className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="clinical-mono text-xs font-black uppercase text-slate-500">Mã BN {String(job.mabn ?? "?")}</p>
                <h3 className="mt-1 font-serif text-2xl font-black text-ink">{String(job.resource_name ?? "all")}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{String(job.requested_reason ?? "Không có ghi chú yêu cầu")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge status={String(job.status ?? "queued")} />
                {canRetry && (
                  <AdminActionButton
                    action="retry_sync"
                    label="Retry job"
                    tone="primary"
                    target={{ jobId: String(job.job_id ?? ""), mabn: String(job.mabn ?? ""), resourceName: String(job.resource_name ?? "all") }}
                  />
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Resource ID" value={String(job.resource_id ?? "Không có")} />
              <Info label="MAQL" value={String(job.maql ?? "Không có")} />
              <Info label="Lần thử" value={`${String(job.attempt_count ?? 0)}/${String(job.max_attempts ?? 3)}`} />
              <Info label="Run after" value={formatDate(job.run_after)} />
              <Info label="Bắt đầu" value={formatDate(job.started_at)} />
              <Info label="Kết thúc" value={formatDate(job.finished_at)} />
              <Info label="Lock bởi" value={String(job.locked_by ?? "Không lock")} />
              <Info label="Cập nhật" value={formatDate(job.updated_at)} />
            </div>

            {Boolean(job.error_message) && (
              <ErrorPanel error={job.error_message} />
            )}
          </section>

          <DetailSection title="Snapshot cùng MABN" count={data.snapshots.length}>
            <SimpleRows rows={data.snapshots} primary="resource_name" secondary={["resource_id", "cache_key"]} date="updated_at" fallback="Chưa có snapshot liên quan." />
          </DetailSection>

          <DetailSection title="Job gần đây cùng MABN" count={data.relatedJobs.length}>
            <div className="divide-y divide-cream-200">
              {data.relatedJobs.map((item) => (
                <div key={String(item.job_id)} className="grid gap-3 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <Link href={`/admin/sync/${item.job_id}`} className="font-black text-ink underline-offset-4 hover:text-primary-800 hover:underline">
                      Job #{String(item.job_id)} · {String(item.resource_name ?? "all")}
                    </Link>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{summarizeSyncError(item.error_message) || String(item.requested_reason ?? "Không có lỗi")}</p>
                    <p className="mt-1 clinical-mono text-xs font-bold text-slate-500">Cập nhật {formatDate(item.updated_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge status={String(item.status ?? "queued")} />
                    {canRetry && shouldShowRetry(item) && (
                      <AdminActionButton
                        action="retry_sync"
                        label="Retry resource"
                        tone="primary"
                        target={{
                          jobId: String(item.job_id ?? ""),
                          mabn: String(item.mabn ?? ""),
                          resourceName: String(item.resource_name ?? "all"),
                          resourceId: String(item.resource_id ?? ""),
                          maql: String(item.maql ?? ""),
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
              {!data.relatedJobs.length && <Empty text="Chưa có job liên quan." />}
            </div>
          </DetailSection>
        </div>
      ) : (
        <Empty text="Không tìm thấy sync job." />
      )}
    </AdminShell>
  );
}

function ErrorPanel({ error }: { error: unknown }) {
  const friendly = summarizeSyncError(error);
  const raw = String(error ?? "");
  return (
    <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
      <p className="font-black">Lỗi gần nhất</p>
      <p className="mt-1 font-semibold">{friendly || "Không đọc được nội dung lỗi."}</p>
      {raw && raw !== friendly && (
        <details className="mt-2 rounded-md border border-rose-100 bg-white/60 px-3 py-2">
          <summary className="cursor-pointer text-xs font-black uppercase text-rose-700">Xem lỗi kỹ thuật</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words clinical-mono text-xs font-bold text-rose-900">{raw}</pre>
        </details>
      )}
    </div>
  );
}

function DetailSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cream-200 bg-cream-100/50 p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 clinical-mono break-words text-sm font-black text-ink">{value}</p>
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

function shouldShowRetry(job: Record<string, unknown>) {
  const status = String(job.status ?? "").toLowerCase();
  const attempt = Number(job.attempt_count ?? 0);
  const maxAttempt = Number(job.max_attempts ?? 3);
  return status.includes("fail") || status.includes("error") || status.includes("stuck") || attempt >= maxAttempt;
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
