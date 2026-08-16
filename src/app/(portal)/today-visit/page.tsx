import { Activity, CheckCircle2, Clock3 } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import type { ActiveService, Registration, TodayVisitStatus } from "@/types/patient";
import { formatDateTime } from "@/utils/format";

type StepCode = "REGISTERED" | "WAITING_EXAM" | "IN_EXAM" | "CLS" | "DONE";

const progressSteps: Array<{ code: StepCode; label: string }> = [
  { code: "REGISTERED", label: "Đăng ký" },
  { code: "WAITING_EXAM", label: "Chờ khám" },
  { code: "IN_EXAM", label: "Đang khám" },
  { code: "CLS", label: "Cận lâm sàng" },
  { code: "DONE", label: "Hoàn tất" },
];

function statusTone(status?: string): "slate" | "green" | "amber" | "blue" {
  if (!status) return "slate";
  if (status === "Đã khám" || status === "Đã có kết quả" || status === "Hoàn tất") return "green";
  if (status.includes("Đang") || status.includes("chưa hoàn tất")) return "amber";
  if (status.includes("Chờ") || status.includes("Chưa")) return "blue";
  return "slate";
}

function currentProgressStep(currentStep: string): StepCode | null {
  if (currentStep === "WAITING_EXAM") return "WAITING_EXAM";
  if (currentStep === "IN_EXAM") return "IN_EXAM";
  if (currentStep === "WAITING_CLS" || currentStep === "DOING_CLS") return "CLS";
  if (currentStep === "DONE") return "DONE";
  return null;
}

function completedStepCount(currentStep: string) {
  if (currentStep === "WAITING_EXAM") return 1;
  if (currentStep === "IN_EXAM") return 2;
  if (currentStep === "WAITING_CLS" || currentStep === "DOING_CLS") return 3;
  if (currentStep === "DONE") return 5;
  return 0;
}

export default async function TodayVisitPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  let loadError = "";
  let status: TodayVisitStatus = {
    hasActiveVisit: false,
    currentStep: "ERROR",
    currentStepText: "Chưa tải được dữ liệu hôm nay",
    registration: null,
    services: [],
  };

  try {
    status = await repository.getTodayVisitStatus(patient.id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Không tải được dữ liệu khám hôm nay.";
  }

  const registration = status.registration;
  const services = status.services ?? [];

  return (
    <>
      <PageHeader
        title="Khám hôm nay"
        description="Theo dõi lượt đăng ký, trạng thái chờ khám, đang gọi và các bước cận lâm sàng trong ngày."
        actions={<Badge tone={status.hasActiveVisit ? "amber" : "slate"}>{status.currentStepText || "Chưa có lượt đăng ký hôm nay"}</Badge>}
      />

      {status.hasActiveVisit && registration && (
        <Panel className="mb-4 border-amber-200 bg-amber-50/80 shadow-none">
          <p className="text-sm font-bold text-amber-950">Lượt khám hôm nay chưa hoàn tất</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            {registration.departmentName || "Chưa ghi nhận phòng"} · {registration.status || "Chưa ghi nhận trạng thái"}
            {registration.ticketNumber ? ` · STT ${registration.ticketNumber}` : ""}
          </p>
        </Panel>
      )}

      {loadError && (
        <Panel className="mb-4 border-amber-200 bg-amber-50/80 shadow-none">
          <p className="text-sm font-bold text-amber-950">Chưa tải được dữ liệu khám hôm nay</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            Hệ thống HIS chưa trả dữ liệu cho bệnh nhân này. Các mục khác vẫn có thể xem bình thường.
          </p>
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <SectionHeader title="Trạng thái hiện tại" />
          {registration ? (
            <div className="flex gap-3 rounded-md bg-slate-50 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                <Clock3 aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-ink">{registration.departmentName || "Chưa ghi nhận phòng"}</p>
                  <Badge tone={statusTone(registration.status)}>{registration.status || "Chưa ghi nhận"}</Badge>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Đăng ký: {formatDateTime(registration.registeredAt)} · STT: {registration.ticketNumber || "Chưa ghi nhận"}
                </p>
                {registration.reason && <p className="mt-2 text-sm leading-6 text-slate-700">{registration.reason}</p>}
              </div>
            </div>
          ) : (
            <EmptyState text="Chưa có lượt đăng ký khám hôm nay." />
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Tiến trình" />
          <ProgressTimeline currentStep={status.currentStep} registration={registration} services={services} />
        </Panel>
      </div>

      <Panel className="mt-4">
        <SectionHeader title="Cận lâm sàng hôm nay" meta={`${services.length} dịch vụ`} />
        {services.length === 0 ? (
          <EmptyState text="Chưa có chỉ định cận lâm sàng hôm nay." />
        ) : (
          <div className="divide-y divide-slate-100">
            {services.map((service) => (
              <div key={service.id} className="py-3 sm:px-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{service.serviceName || "Dịch vụ chưa ghi tên"}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {service.serviceGroup || "Dịch vụ"} · {service.departmentName || "Chưa ghi nhận phòng"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Chỉ định: {formatDateTime(service.orderedAt)}</p>
                  </div>
                  <Badge tone={statusTone(service.status)}>{service.status || "Chưa ghi nhận"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function ProgressTimeline({
  currentStep,
  registration,
  services,
}: {
  currentStep: string;
  registration?: Registration | null;
  services: ActiveService[];
}) {
  const activeStep = currentProgressStep(currentStep);
  const completedCount = completedStepCount(currentStep);
  const timestamps = getProgressTimestamps(registration, services);

  return (
    <div className="space-y-2">
      {progressSteps.map((step, index) => {
        const isDone = index < completedCount || currentStep === "DONE";
        const isActive = activeStep === step.code && currentStep !== "DONE";
        const classes = isDone
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : isActive
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-slate-200 bg-white text-slate-600";

        return (
          <div key={step.code} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${classes}`}>
            {isDone ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Activity aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? "text-amber-600" : "text-slate-400"}`} />
            )}
            <span className="min-w-0">
              <span className="block">{step.label}</span>
              {timestamps[step.code] && <span className="mt-0.5 block text-xs font-semibold opacity-75">{timestamps[step.code]}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getProgressTimestamps(registration: Registration | null | undefined, services: ActiveService[]) {
  const firstOrdered = minDate(services.map((service) => service.orderedAt));
  const firstStarted = minDate(services.map((service) => service.startedAt).filter(Boolean) as string[]);
  const lastResult = maxDate(services.map((service) => service.resultAt).filter(Boolean) as string[]);

  const timestamps: Partial<Record<StepCode, string>> = {};

  if (registration?.registeredAt) {
    timestamps.REGISTERED = formatDateTime(registration.registeredAt);
    timestamps.WAITING_EXAM = "Sau đăng ký";
  }

  if (registration?.status?.includes("Đang")) {
    timestamps.IN_EXAM = "Đang xử lý";
  }

  if (firstStarted) {
    timestamps.CLS = `Thực hiện: ${formatDateTime(firstStarted)}`;
  } else if (firstOrdered) {
    timestamps.CLS = `Chỉ định: ${formatDateTime(firstOrdered)}`;
  }

  if (lastResult) {
    timestamps.DONE = `KQ cuối: ${formatDateTime(lastResult)}`;
  }

  return timestamps;
}

function minDate(values: string[]) {
  const dates = values.filter(Boolean).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()));
  if (dates.length === 0) return "";
  return new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString();
}

function maxDate(values: string[]) {
  const dates = values.filter(Boolean).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()));
  if (dates.length === 0) return "";
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}
