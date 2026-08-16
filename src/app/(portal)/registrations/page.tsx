import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { formatDateTime } from "@/utils/format";

function statusTone(status: string): "slate" | "green" | "amber" | "blue" {
  if (status === "Đã khám") return "green";
  if (status === "Đang gọi/đang khám") return "amber";
  if (status === "Chờ khám") return "blue";
  return "slate";
}

export default async function RegistrationsPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const registrations = await repository.getRegistrations(patient.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pendingRegistrations = registrations
    .filter((registration) => new Date(registration.registeredAt) >= today && registration.status !== "Đã khám")
    .sort((first, second) => new Date(first.registeredAt).getTime() - new Date(second.registeredAt).getTime());
  const nextPendingRegistration = pendingRegistrations[0];

  return (
    <>
      <PageHeader
        title="Lịch sử đăng ký"
        description="Theo dõi lượt tiếp đón, số thứ tự, phòng đăng ký và trạng thái xử lý."
        actions={
          <div className="flex flex-wrap gap-2">
            {pendingRegistrations.length > 0 && <Badge tone="amber">{pendingRegistrations.length} chưa khám</Badge>}
            <Badge tone="slate">{registrations.length} lượt</Badge>
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
        <SectionHeader title="Lượt đăng ký" />
        {registrations.length === 0 ? (
          <EmptyState text="Chưa có dữ liệu đăng ký từ HIS." />
        ) : (
          <div className="divide-y divide-slate-100">
            {registrations.map((registration) => (
              <a key={registration.id} href={`/visits/${registration.visitId}`} className="block py-3 transition hover:bg-primary-50 sm:px-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{formatDateTime(registration.registeredAt)}</p>
                    <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-700">Phòng: {registration.departmentName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      STT: {registration.ticketNumber || "Chưa ghi nhận"} · Mã lượt: {registration.visitId || registration.id}
                    </p>
                  </div>
                  <Badge tone={statusTone(registration.status)}>{registration.status}</Badge>
                </div>
                {(registration.reason || registration.notes) && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{[registration.reason, registration.notes].filter(Boolean).join(" · ")}</p>
                )}
              </a>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
