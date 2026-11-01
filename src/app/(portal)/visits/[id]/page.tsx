import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Info,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Badge, EmptyState, SectionHeader } from "@/components/ui";
import { PatientVisitTabs } from "@/components/patient-visit-tabs";
import { createPatientRepository } from "@/lib/data";
import type {
  ImagingResult,
  LabResult,
  PrescriptionItem,
  Service,
} from "@/types/patient";
import { formatDate, formatDateTime } from "@/utils/format";
import { normalizeDisplayText } from "@anphu/patient-domain";

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const visit = await repository.getVisitDetail(patient.id, id);

  if (!visit) {
    notFound();
  }

  const labGroups = groupLabResults(visit.labResults);
  const imagingGroups = groupByDate(visit.imagingResults, (item) => item.date);
  const serviceGroups = groupByDate(visit.services, (item) => item.performedAt);
  const prescriptionGroups = groupPrescriptionItems(
    visit.prescription?.items ?? [],
  );
  const hasVitalSigns = Boolean(
    visit.vitalSigns.bloodPressure ||
    visit.vitalSigns.pulse ||
    visit.vitalSigns.temperature ||
    visit.vitalSigns.weight ||
    visit.vitalSigns.height ||
    visit.vitalSigns.bmi,
  );

  const sections = {
    overview: (
      <>
        <section className="patient-card patient-summary">
          <SectionHeader title="Tổng quan" />
          <dl>
            <div>
              <dt>Ngày khám</dt>
              <dd>{formatDateTime(visit.visitDate)}</dd>
            </div>
            <div>
              <dt>Phòng khám</dt>
              <dd>{emptyText(visit.departmentName)}</dd>
            </div>
            <div>
              <dt>Bác sĩ</dt>
              <dd>{emptyText(normalizeDisplayText(visit.doctorName))}</dd>
            </div>
            <div>
              <dt>Mã lượt</dt>
              <dd>{visit.hisVisitId}</dd>
            </div>
            <div>
              <dt>Hẹn tái khám</dt>
              <dd>
                {visit.followUpDate
                  ? formatDate(visit.followUpDate)
                  : "Chưa ghi nhận"}
              </dd>
            </div>
          </dl>
        </section>
        <section className="patient-card">
          <SectionHeader title="Chẩn đoán" />
          <InfoLine label="Chẩn đoán ra viện" value={visit.primaryDiagnosis} />
          {visit.secondaryDiagnosis && (
            <InfoLine
              label="Chẩn đoán kèm theo"
              value={visit.secondaryDiagnosis}
            />
          )}
          {visit.notes && (
            <p className="mt-3 whitespace-pre-line text-sm leading-7">
              {visit.notes}
            </p>
          )}
        </section>
        {hasVitalSigns && (
          <section className="patient-card patient-summary">
            <SectionHeader title="Dấu hiệu sinh tồn" />
            <dl>
              <div>
                <dt>Huyết áp</dt>
                <dd>{emptyText(visit.vitalSigns.bloodPressure)}</dd>
              </div>
              <div>
                <dt>Mạch</dt>
                <dd>
                  {visit.vitalSigns.pulse
                    ? `${visit.vitalSigns.pulse} lần/phút`
                    : "Chưa ghi nhận"}
                </dd>
              </div>
              <div>
                <dt>Nhiệt độ</dt>
                <dd>
                  {visit.vitalSigns.temperature
                    ? `${visit.vitalSigns.temperature}°C`
                    : "Chưa ghi nhận"}
                </dd>
              </div>
              <div>
                <dt>Cân nặng</dt>
                <dd>
                  {visit.vitalSigns.weight
                    ? `${visit.vitalSigns.weight} kg`
                    : "Chưa ghi nhận"}
                </dd>
              </div>
              <div>
                <dt>Chiều cao</dt>
                <dd>
                  {visit.vitalSigns.height
                    ? `${visit.vitalSigns.height} cm`
                    : "Chưa ghi nhận"}
                </dd>
              </div>
              <div>
                <dt>BMI</dt>
                <dd>
                  {visit.vitalSigns.bmi
                    ? String(visit.vitalSigns.bmi)
                    : "Chưa ghi nhận"}
                </dd>
              </div>
            </dl>
          </section>
        )}
        <section className="patient-card">
          <SectionHeader
            title="Chỉ định"
            meta={`${visit.services.length} dịch vụ`}
          />
          {serviceGroups.length ? (
            serviceGroups.map((group) => (
              <div key={group.dateKey} className="mb-4">
                <p className="patient-subtitle mb-2">{group.title}</p>
                <div className="space-y-2">
                  {group.items.map((service) => (
                    <ServiceRow key={service.id} service={service} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="Chưa có chỉ định dịch vụ." />
          )}
        </section>
        <section className="patient-card">
          <SectionHeader title="Lời dặn bác sĩ" />
          {visit.doctorAdvice ? (
            <p className="whitespace-pre-line text-sm leading-7">
              {visit.doctorAdvice}
            </p>
          ) : (
            <EmptyState text="Chưa có lời dặn." />
          )}
        </section>
      </>
    ),
    labs: (
      <section aria-label="Kết quả xét nghiệm">
        <h2 className="patient-heading mb-2">Kết quả xét nghiệm</h2>
        {labGroups.length ? (
          labGroups.map((group) => (
            <details
              key={group.key}
              open={labGroups.length === 1}
              className="group border-b border-slate-200"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3">
                <span>
                  <span className="block text-sm font-semibold">
                    {group.serviceName}
                  </span>
                  <span className="patient-subtitle">
                    {formatDateTime(group.performedAt)} · {group.items.length}{" "}
                    chỉ số
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-primary-700 transition group-open:rotate-180"
                />
              </summary>
              <LabResultList items={group.items} />
            </details>
          ))
        ) : (
          <EmptyState text="Chưa có kết quả xét nghiệm trong lần khám này." />
        )}
        {labGroups.length > 0 && (
          <p className="patient-notice">
            <Info aria-hidden="true" />
            <span>
              Cờ theo phiếu xét nghiệm. Trao đổi với bác sĩ để được giải thích.
            </span>
          </p>
        )}
      </section>
    ),
    imaging: (
      <section aria-label="Kết quả chẩn đoán hình ảnh">
        <h2 className="patient-heading mb-3">Chẩn đoán hình ảnh</h2>
        {imagingGroups.length ? (
          imagingGroups.map((group) => (
            <div key={group.dateKey} className="mb-4">
              <p className="patient-subtitle mb-2">{group.title}</p>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <ImagingDetails key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="Chưa có kết quả chẩn đoán hình ảnh trong lần khám này." />
        )}
      </section>
    ),
    medications: (
      <section aria-label="Đơn thuốc của lần khám">
        <h2 className="patient-heading mb-3">
          Đơn thuốc
          {visit.prescription?.items.length
            ? ` · ${visit.prescription.items.length} thuốc`
            : ""}
        </h2>
        {visit.prescription?.items.length ? (
          <>
            <p className="patient-subtitle mb-4">
              Ngày kê: {formatDateTime(visit.prescription.prescribedAt)}
              {visit.prescription.doctorName
                ? ` · ${visit.prescription.doctorName}`
                : ""}
            </p>
            <div className="space-y-5">
              {prescriptionGroups.map((group) => (
                <PrescriptionGroup key={group.key} group={group} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState text="Không có đơn thuốc trong lần khám này." />
        )}
      </section>
    ),
  };
  return (
    <article aria-label="Chi tiết lần khám của bệnh nhân">
      <div className="flex items-center gap-3">
        <Link
          href="/visits"
          aria-label="Quay lại lịch sử khám"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-primary-700"
        >
          <ArrowLeft aria-hidden="true" className="h-6 w-6" />
        </Link>
        <h1 className="patient-title">Chi tiết lần khám</h1>
      </div>
      <header className="patient-card mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-lg break-words">{patient.fullName}</p>
            <p className="patient-subtitle mt-1">BN {patient.hisPatientCode}</p>
          </div>
          <Badge tone="blue">{visit.status || "Đã ghi nhận"}</Badge>
        </div>
        <div className="visit-context border-t border-slate-100 pt-3">
          <div>
            <CalendarDays aria-hidden="true" />
            <span>{formatDateTime(visit.visitDate)}</span>
          </div>
          <div>
            <Stethoscope aria-hidden="true" />
            <span>{visit.departmentName || "Chưa ghi nhận phòng khám"}</span>
          </div>
          <div>
            <UserRound aria-hidden="true" />
            <span>{emptyText(normalizeDisplayText(visit.doctorName))}</span>
          </div>
        </div>
      </header>
      <PatientVisitTabs
        key={visit.id}
        sections={sections}
        hasLabs={labGroups.length > 0}
        imagingCount={visit.imagingResults.length}
        medicineCount={visit.prescription?.items.length ?? 0}
      />
    </article>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-ink">
        {emptyText(value)}
      </p>
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-slate-200 p-3">
      <div className="min-w-0">
        <p className="font-semibold leading-6 text-ink">
          {service.serviceName}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {formatDateTime(service.performedAt)}
        </p>
      </div>
      <Badge tone={service.status === "Có kết quả" ? "green" : "slate"}>
        {service.status}
      </Badge>
    </div>
  );
}

function LabResultList({ items }: { items: LabResult[] }) {
  return (
    <dl className="patient-lab-list">
      {items.map((item) => (
        <div key={item.id} className="patient-lab-row">
          <div className="patient-lab-top">
            <dt>{item.testName}</dt>
            <dd>
              {item.result}
              <span className="font-medium">
                {item.unit ? ` ${item.unit}` : ""}
              </span>
            </dd>
            {item.flag && <LabFlagBadge flag={item.flag} />}
          </div>
          <div className="patient-reference">
            <span>Tham chiếu: </span>
            {item.referenceRange || "Chưa ghi nhận"}
          </div>
        </div>
      ))}
    </dl>
  );
}

function PrescriptionGroup({ group }: { group: PrescriptionGroupData }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">{group.title}</h3>
        <Badge tone={group.key === "bhyt" ? "green" : "slate"}>
          {group.items.length} thuốc
        </Badge>
      </div>
      <div className="space-y-2">
        {group.items.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold text-ink">{item.medicineName}</p>
              {item.payerType && (
                <Badge tone={group.key === "bhyt" ? "green" : "slate"}>
                  {item.payerType}
                </Badge>
              )}
            </div>
            {(item.activeIngredient || item.strength || item.route) && (
              <p className="mt-1 text-sm text-slate-600">
                {[item.activeIngredient, item.strength, item.route]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <p className="mt-2 text-sm font-semibold text-ink">
              SL: {emptyText(item.quantity)}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {item.instruction || item.dosage || "Chưa ghi nhận cách dùng"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImagingDetails({ item }: { item: ImagingResult }) {
  return (
    <details className="group rounded-md border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3">
        <span className="min-w-0">
          <span className="block font-bold text-ink">{item.techniqueName}</span>
          <span className="mt-1 block text-sm text-slate-600">
            {formatDateTime(item.date)}
            {item.doctorName ? ` · ${item.doctorName}` : ""}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary-700">
          <span className="group-open:hidden">Xem</span>
          <span className="hidden group-open:inline">Thu gọn</span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 transition group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="details-reveal border-t border-slate-100">
        <div className="space-y-3 p-3 text-sm leading-6">
          {item.description && (
            <div>
              <p className="font-bold text-slate-600">Mô tả</p>
              <p className="mt-1 whitespace-pre-line text-slate-700">
                {item.description}
              </p>
            </div>
          )}
          {item.conclusion && (
            <div>
              <p className="font-bold text-slate-600">Kết luận</p>
              <p className="mt-1 whitespace-pre-line font-semibold text-ink">
                {normalizeDisplayText(item.conclusion)}
              </p>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

function groupByDate<T>(items: T[], getDate: (item: T) => string) {
  const groups = new Map<
    string,
    { dateKey: string; title: string; items: T[] }
  >();

  for (const item of items) {
    const value = getDate(item);
    const dateKey = formatDate(value);
    const current = groups.get(dateKey) ?? {
      dateKey,
      title: dateKey,
      items: [],
    };
    current.items.push(item);
    groups.set(dateKey, current);
  }

  return Array.from(groups.values());
}

function groupLabResults(items: LabResult[]) {
  const groups = new Map<
    string,
    {
      key: string;
      serviceName: string;
      performedAt: string;
      abnormalCount: number;
      items: LabResult[];
    }
  >();

  for (const item of items) {
    const serviceName = item.serviceName || "Xét nghiệm";
    const key = `${formatDateTime(item.performedAt)}-${serviceName}`;
    const current = groups.get(key) ?? {
      key,
      serviceName,
      performedAt: item.performedAt,
      abnormalCount: 0,
      items: [],
    };
    current.items.push(item);
    if (!isNormalLabFlag(item.flag)) {
      current.abnormalCount += 1;
    }
    groups.set(key, current);
  }

  return Array.from(groups.values());
}

interface PrescriptionGroupData {
  key: "bhyt" | "service";
  title: string;
  items: PrescriptionItem[];
}

function groupPrescriptionItems(
  items: PrescriptionItem[],
): PrescriptionGroupData[] {
  const bhytItems = items.filter((item) => isBhytPayer(item.payerType));
  const serviceItems = items.filter((item) => !isBhytPayer(item.payerType));
  const groups: PrescriptionGroupData[] = [];

  if (bhytItems.length > 0) {
    groups.push({ key: "bhyt", title: "Đơn thuốc BHYT", items: bhytItems });
  }

  if (serviceItems.length > 0) {
    groups.push({
      key: "service",
      title: "Đơn thuốc thu phí",
      items: serviceItems,
    });
  }

  return groups;
}

function isBhytPayer(value?: string) {
  return value?.toUpperCase().includes("BHYT") ?? false;
}

function isNormalLabFlag(value: LabResult["flag"] | string) {
  return value === "Bình thường";
}

function LabFlagBadge({ flag }: { flag: LabResult["flag"] | string }) {
  const tone = getLabFlagTone(flag);
  return (
    <span className="patient-result-label" data-tone={tone}>
      {tone === "low" ? (
        <ArrowDown aria-hidden="true" className="h-3 w-3" />
      ) : tone === "high" ? (
        <ArrowUp aria-hidden="true" className="h-3 w-3" />
      ) : null}
      {flag}
    </span>
  );
}

function getLabFlagTone(flag: LabResult["flag"] | string) {
  if (isNormalLabFlag(flag)) return "normal";

  const text = String(flag ?? "").trim().toLocaleLowerCase("vi");
  if (["thấp", "low", "↓"].includes(text)) return "low";
  if (["cao", "high", "↑"].includes(text)) return "high";
  return "unknown";
}

function emptyText(value?: string) {
  return value?.trim() ? value : "Chưa ghi nhận";
}
