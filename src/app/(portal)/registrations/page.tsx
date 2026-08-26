import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { formatDateTime } from "@/utils/format";

type SearchParams = Record<string, string | string[] | undefined>;

function statusTone(status: string): "slate" | "green" | "amber" | "blue" {
  if (status === "Đã khám") return "green";
  if (status === "Đang gọi/đang khám") return "amber";
  if (status === "Chờ khám") return "blue";
  return "slate";
}

function statusBucket(status: string, registeredAt: string, today: Date) {
  const normalized = status.trim().toLowerCase();
  const isFutureOrToday = new Date(registeredAt) >= today;

  if (normalized === "đã khám") return "done";
  if (normalized.includes("đang")) return "active";
  if (normalized.includes("chờ")) return "waiting";
  if (isFutureOrToday) return "pending";
  return "other";
}

function normalizeFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && ["all", "pending", "waiting", "active", "done", "other"].includes(raw) ? raw : "all";
}

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const rawParams = await searchParams;
  const filter = normalizeFilter(rawParams.status);
  const registrations = await repository.getRegistrations(patient.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const registrationsWithBucket = registrations.map((registration) => ({
    ...registration,
    statusBucket: statusBucket(registration.status, registration.registeredAt, today),
  }));
  const filteredRegistrations = registrationsWithBucket.filter((registration) => filter === "all" || registration.statusBucket === filter);
  const filterCounts = {
    all: registrationsWithBucket.length,
    pending: registrationsWithBucket.filter((registration) => registration.statusBucket === "pending").length,
    waiting: registrationsWithBucket.filter((registration) => registration.statusBucket === "waiting").length,
    active: registrationsWithBucket.filter((registration) => registration.statusBucket === "active").length,
    done: registrationsWithBucket.filter((registration) => registration.statusBucket === "done").length,
    other: registrationsWithBucket.filter((registration) => registration.statusBucket === "other").length,
  };
  const pendingRegistrations = registrations
    .filter((registration) => new Date(registration.registeredAt) >= today && registration.status !== "Đã khám")
    .sort((first, second) => new Date(first.registeredAt).getTime() - new Date(second.registeredAt).getTime());
  const nextPendingRegistration = pendingRegistrations[0];
  const filters = [
    { key: "all", label: "Tất cả", count: filterCounts.all },
    { key: "pending", label: "Chưa khám", count: filterCounts.pending },
    { key: "waiting", label: "Chờ khám", count: filterCounts.waiting },
    { key: "active", label: "Đang khám", count: filterCounts.active },
    { key: "done", label: "Đã khám", count: filterCounts.done },
    { key: "other", label: "Khác", count: filterCounts.other },
  ].filter((item) => item.key === "all" || item.count > 0);

  return (
    <>
      <PageHeader
        title="Lịch sử đăng ký"
        description="Theo dõi lượt tiếp đón, số thứ tự, phòng đăng ký và trạng thái xử lý."
        actions={
          <div className="flex flex-wrap gap-2">
            {pendingRegistrations.length > 0 && <Badge tone="amber">{pendingRegistrations.length} chưa khám</Badge>}
            <Link
              href="/booking"
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary-700 px-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-800"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Đăng ký khám
            </Link>
          </div>
        }
      />

      {nextPendingRegistration && (
        <Panel className="mb-4 border-amber-200 bg-amber-50/80 shadow-none">
          <p className="text-sm font-bold text-amber-950">Có lượt đăng ký chưa khám</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            {formatDateTime(nextPendingRegistration.registeredAt)} · {nextPendingRegistration.departmentName}
            {nextPendingRegistration.ticketNumber ? ` · STT ${nextPendingRegistration.ticketNumber}` : ""}
          </p>
        </Panel>
      )}

      <Panel>
        <SectionHeader title="Lượt đăng ký" meta={`${filteredRegistrations.length}/${registrations.length} lượt`} />
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <Link
              key={item.key}
              href={item.key === "all" ? "/registrations" : `/registrations?status=${item.key}`}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-black transition ${
                filter === item.key
                  ? "border-primary-700 bg-primary-700 text-white shadow-sm"
                  : "border-cream-200 bg-white/80 text-slate-700 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
              }`}
            >
              {item.label}
              <span className={filter === item.key ? "clinical-mono text-white/85" : "clinical-mono text-slate-500"}>{item.count}</span>
            </Link>
          ))}
        </div>
        {registrations.length === 0 ? (
          <EmptyState text="Chưa có dữ liệu đăng ký từ HIS." />
        ) : filteredRegistrations.length === 0 ? (
          <EmptyState text="Không có lượt đăng ký phù hợp với bộ lọc đang chọn." />
        ) : (
          <div className="grid gap-2">
            {filteredRegistrations.map((registration) => (
              <a
                key={registration.id}
                href={`/visits/${registration.visitId}`}
                className="block rounded-md border border-cream-200 bg-white/85 p-3 shadow-[0_8px_18px_rgba(7,60,57,0.04)] transition hover:border-primary-200 hover:bg-primary-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="clinical-mono text-sm font-black text-ink">{formatDateTime(registration.registeredAt)}</p>
                    <p className="mt-1 line-clamp-1 text-sm font-black text-slate-800">{registration.departmentName || "Chưa ghi nhận phòng"}</p>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                      STT: {registration.ticketNumber || "Chưa ghi nhận"}
                      {registration.reason || registration.notes ? ` · ${[registration.reason, registration.notes].filter(Boolean).join(" · ")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={statusTone(registration.status)}>{registration.status}</Badge>
                    {registration.payerTypeName ? <Badge tone={isBhytPayer(registration.payerTypeName) ? "green" : "slate"}>{registration.payerTypeName}</Badge> : null}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function isBhytPayer(value: string) {
  return value.trim().toLowerCase() === "bhyt";
}
