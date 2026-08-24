import { AdminActionButton } from "@/app/admin/admin-action-button";
import type { AdminRow } from "@/lib/admin/dashboard";
import Link from "next/link";

export function AdminTable({
  rows,
  empty,
  columns = ["Nội dung", "Trạng thái", "Cập nhật"],
}: {
  rows: AdminRow[];
  empty: string;
  columns?: [string, string, string];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="hidden grid-cols-[1fr_160px_190px] gap-3 border-b border-cream-200 bg-cream-100/70 px-4 py-3 text-xs font-black uppercase text-slate-500 lg:grid">
        <span>{columns[0]}</span>
        <span>{columns[1]}</span>
        <span>{columns[2]}</span>
      </div>

      {rows.length ? (
        <div className="divide-y divide-cream-200">
          {rows.map((row, index) => (
            <article key={`${row.entity ?? "row"}-${row.id}-${index}`} className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_160px_190px] lg:items-center">
              <div className="min-w-0">
                {row.href ? (
                  <Link href={row.href} className="break-words text-sm font-black text-ink underline-offset-4 hover:text-primary-800 hover:underline">
                    {row.primary}
                  </Link>
                ) : (
                  <p className="break-words text-sm font-black text-ink">{row.primary}</p>
                )}
                <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-600">{row.secondary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {row.status && <AdminStatusBadge status={row.status} />}
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

              <p className="clinical-mono text-xs font-bold text-slate-500">{row.meta}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-sm font-semibold text-slate-500">{empty}</p>
      )}
    </section>
  );
}

export function AdminStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes("fail") ||
    normalized.includes("missing") ||
    normalized.includes("locked") ||
    normalized.includes("deleted") ||
    normalized.includes("xóa") ||
    normalized.includes("thu hồi") ||
    normalized.includes("hết hạn") ||
    normalized.includes("huy") ||
    normalized.includes("thiếu") ||
    normalized.includes("lỗi")
      ? "bg-rose-50 text-rose-700"
      : normalized.includes("pending") || normalized.includes("warning") || normalized.includes("cho") || normalized.includes("queued") || normalized.includes("nhiều")
        ? "bg-amber-50 text-amber-900"
        : "bg-primary-50 text-primary-800";

  return <span className={`inline-flex w-fit rounded-md px-2 py-1 text-[11px] font-black uppercase ${tone}`}>{status}</span>;
}
