import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 border-b border-cream-200 pb-4 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-xl font-bold tracking-normal text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-md border border-cream-200 bg-cream-50 p-3 shadow-[0_8px_22px_rgba(7,60,57,0.055)] sm:p-5 ${className}`}>{children}</section>;
}

export function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-serif text-base font-bold text-ink">{title}</h2>
      {meta && <span className="clinical-mono text-sm font-semibold text-slate-500">{meta}</span>}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "bg-cream-100 text-slate-700",
    green: "bg-primary-50 text-primary-700",
    amber: "bg-amber-100 text-amber-900",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
  };

  return <span className={`inline-flex w-fit items-center rounded-md px-2 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="clinical-mono inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-cream-200 bg-cream-100 px-1.5 text-[11px] font-black leading-none text-slate-600">
      {children}
    </span>
  );
}

export function StatCard({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-cream-200 bg-cream-50 p-3 shadow-[0_8px_22px_rgba(7,60,57,0.055)] transition hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50 sm:p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-600">{label}</span>
          <span className="clinical-mono mt-0.5 block text-base font-bold text-ink sm:text-lg">{value}</span>
        </span>
      </div>
    </Link>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cream-200 bg-cream-100/70 p-3">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="clinical-mono mt-1 break-words text-sm font-semibold leading-6 text-ink">{value}</dd>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-cream-200 bg-cream-50/70 p-5 text-center text-sm font-medium leading-6 text-slate-600">{text}</div>;
}

export function LoadingSkeleton() {
  return <div className="h-24 animate-pulse rounded-md bg-slate-100" aria-label="Đang tải dữ liệu" />;
}
