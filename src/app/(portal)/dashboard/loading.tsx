import { Panel } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-3" aria-label="Đang tải trang chủ">
      <header className="flex items-start justify-between gap-3 border-b border-cream-200 pb-2">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-20 animate-pulse rounded bg-primary-100" />
          <div className="mt-2 h-7 w-56 max-w-full animate-pulse rounded bg-cream-200" />
          <div className="mt-2 h-4 w-28 animate-pulse rounded bg-cream-200" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-md bg-primary-50" />
      </header>

      <section className="grid gap-2 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel className="p-3 shadow-none">
          <div className="flex gap-3">
            <div className="h-9 w-9 animate-pulse rounded-md bg-primary-50" />
            <div className="flex-1">
              <div className="h-4 w-24 animate-pulse rounded bg-cream-200" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-cream-200" />
              <div className="mt-3 h-9 w-full animate-pulse rounded-md bg-primary-100" />
            </div>
          </div>
        </Panel>

        <section className="rounded-md bg-primary-900 p-3">
          <div className="h-3 w-24 animate-pulse rounded bg-white/20" />
          <div className="mt-3 h-5 w-36 animate-pulse rounded bg-white/25" />
          <div className="mt-3 h-5 w-52 animate-pulse rounded bg-white/25" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="h-4 animate-pulse rounded bg-white/20" />
            <div className="h-4 animate-pulse rounded bg-white/20" />
          </div>
        </section>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="min-h-[104px] animate-pulse rounded-md border border-cream-200 bg-cream-50" />
        ))}
      </section>
    </div>
  );
}
