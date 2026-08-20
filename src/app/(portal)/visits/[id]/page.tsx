import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Field, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import type { ImagingResult, LabResult, PrescriptionItem, Service } from "@/types/patient";
import { formatDate, formatDateTime } from "@/utils/format";
import { normalizeDisplayText } from "@anphu/patient-domain";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  const prescriptionGroups = groupPrescriptionItems(visit.prescription?.items ?? []);
  const hasVitalSigns = Boolean(
    visit.vitalSigns.bloodPressure ||
      visit.vitalSigns.pulse ||
      visit.vitalSigns.temperature ||
      visit.vitalSigns.weight ||
      visit.vitalSigns.height ||
      visit.vitalSigns.bmi,
  );

  return (
    <>
      <Link href="/visits" className="mb-3 inline-flex min-h-9 items-center rounded-md border border-cream-200 bg-cream-50 px-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-cream-100">
        ← Quay lại lịch sử khám
      </Link>
      <PageHeader
        title="Chi tiết lần khám"
        description={`${formatDateTime(visit.visitDate)} - ${visit.departmentName || "Tiếp đón/KCB"}`}
        actions={<Badge tone="blue">{visit.status || "Đã ghi nhận"}</Badge>}
      />

      <div className="space-y-4">
        <Panel>
          <SectionHeader title="Tổng quan" />
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Ngày khám" value={formatDateTime(visit.visitDate)} />
            <Field label="Phòng" value={emptyText(visit.departmentName)} />
            <Field label="Bác sĩ" value={emptyText(normalizeDisplayText(visit.doctorName))} />
            <Field label="Mã lượt" value={visit.hisVisitId} />
            <Field label="Hẹn tái khám" value={visit.followUpDate ? formatDate(visit.followUpDate) : "Chưa ghi nhận"} />
          </dl>
        </Panel>

        <Panel>
          <SectionHeader title="Chẩn đoán" />
          <div className="space-y-2">
            <InfoLine label="CD ra viện" value={visit.primaryDiagnosis} />
            {visit.secondaryDiagnosis && <InfoLine label="Chẩn đoán kèm theo" value={visit.secondaryDiagnosis} />}
          </div>
          {visit.notes && <p className="mt-3 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{visit.notes}</p>}
        </Panel>

        {hasVitalSigns && (
          <Panel>
            <SectionHeader title="Dấu hiệu sinh tồn" />
            <dl className="grid gap-2 sm:grid-cols-3">
              <Field label="Huyết áp" value={emptyText(visit.vitalSigns.bloodPressure)} />
              <Field label="Mạch" value={visit.vitalSigns.pulse ? `${visit.vitalSigns.pulse} lần/phút` : "Chưa ghi nhận"} />
              <Field label="Nhiệt độ" value={visit.vitalSigns.temperature ? `${visit.vitalSigns.temperature}°C` : "Chưa ghi nhận"} />
              <Field label="Cân nặng" value={visit.vitalSigns.weight ? `${visit.vitalSigns.weight} kg` : "Chưa ghi nhận"} />
              <Field label="Chiều cao" value={visit.vitalSigns.height ? `${visit.vitalSigns.height} cm` : "Chưa ghi nhận"} />
              <Field label="BMI" value={visit.vitalSigns.bmi ? String(visit.vitalSigns.bmi) : "Chưa ghi nhận"} />
            </dl>
          </Panel>
        )}

        <Panel>
          <SectionHeader title="Chỉ định" meta={`${visit.services.length} dịch vụ`} />
          {serviceGroups.length > 0 ? (
            <div className="space-y-3">
              {serviceGroups.map((group) => (
                <section key={group.dateKey}>
                  <p className="mb-2 text-sm font-bold text-slate-700">{group.title}</p>
                  <div className="space-y-2">
                    {group.items.map((service) => (
                      <ServiceRow key={service.id} service={service} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState text="Chưa có chỉ định dịch vụ." />
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Kết quả xét nghiệm" meta={`${labGroups.length} phiếu`} />
          {labGroups.length > 0 ? (
            <div className="space-y-2">
              {labGroups.map((group) => (
                <details key={group.key} className="group rounded-md border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">{group.serviceName}</span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {formatDateTime(group.performedAt)} · {group.items.length} chỉ số
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {group.abnormalCount > 0 && <Badge tone="amber">{group.abnormalCount} bất thường</Badge>}
                      <span className="text-xs font-bold text-primary-700 group-open:hidden">Xem</span>
                      <span className="hidden text-xs font-bold text-primary-700 group-open:inline">Thu gọn</span>
                    </span>
                  </summary>
                  <LabResultTable items={group.items} />
                </details>
              ))}
            </div>
          ) : (
            <EmptyState text="Chưa có kết quả xét nghiệm trong lần khám này." />
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Chẩn đoán hình ảnh" meta={`${visit.imagingResults.length} kết quả`} />
          {imagingGroups.length > 0 ? (
            <div className="space-y-3">
              {imagingGroups.map((group) => (
                <section key={group.dateKey}>
                  <p className="mb-2 text-sm font-bold text-slate-700">{group.title}</p>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <ImagingDetails key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState text="Chưa có kết quả chẩn đoán hình ảnh trong lần khám này." />
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Đơn thuốc" meta={visit.prescription ? `${visit.prescription.items.length} thuốc` : undefined} />
          {visit.prescription && visit.prescription.items.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Ngày kê: {formatDateTime(visit.prescription.prescribedAt)}
                {visit.prescription.doctorName ? ` - ${visit.prescription.doctorName}` : ""}
              </p>
              {prescriptionGroups.map((group) => (
                <PrescriptionGroup key={group.key} group={group} />
              ))}
            </div>
          ) : (
            <EmptyState text="Không có đơn thuốc trong lần khám này." />
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Lời dặn bác sĩ" />
          {visit.doctorAdvice ? <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{visit.doctorAdvice}</p> : <EmptyState text="Chưa có lời dặn." />}
        </Panel>
      </div>
    </>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-ink">{emptyText(value)}</p>
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-slate-200 p-3">
      <div className="min-w-0">
        <p className="font-semibold leading-6 text-ink">{service.serviceName}</p>
        <p className="mt-1 text-xs text-slate-500">{formatDateTime(service.performedAt)}</p>
      </div>
      <Badge tone={service.status === "Có kết quả" ? "green" : "slate"}>{service.status}</Badge>
    </div>
  );
}

function LabResultTable({ items }: { items: LabResult[] }) {
  return (
    <div className="overflow-x-auto border-t border-slate-100">
      <table className="min-w-[680px] text-left text-sm sm:min-w-full">
        <thead className="border-b border-cream-200 bg-cream-100 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 font-bold">Tên chỉ số</th>
            <th className="px-3 py-2 font-bold">Kết quả</th>
            <th className="px-3 py-2 font-bold">Tham chiếu</th>
            <th className="px-3 py-2 font-bold">Đánh giá</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-3 py-2 font-semibold leading-5 text-ink">{item.testName}</td>
              <td className="clinical-mono px-3 py-2 font-semibold text-slate-700">
                {item.result} {item.unit || ""}
              </td>
              <td className="clinical-mono px-3 py-2 text-slate-600">{item.referenceRange || "-"}</td>
              <td className="px-3 py-2">
                <Badge tone={isNormalLabFlag(item.flag) ? "green" : "amber"}>{item.flag}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrescriptionGroup({ group }: { group: PrescriptionGroupData }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">{group.title}</h3>
        <Badge tone={group.key === "bhyt" ? "green" : "slate"}>{group.items.length} thuốc</Badge>
      </div>
      <div className="space-y-2">
        {group.items.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold text-ink">{item.medicineName}</p>
              {item.payerType && <Badge tone={group.key === "bhyt" ? "green" : "slate"}>{item.payerType}</Badge>}
            </div>
            {(item.activeIngredient || item.strength || item.route) && (
              <p className="mt-1 text-sm text-slate-600">{[item.activeIngredient, item.strength, item.route].filter(Boolean).join(" · ")}</p>
            )}
            <p className="mt-2 text-sm font-semibold text-ink">SL: {emptyText(item.quantity)}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{item.instruction || item.dosage || "Chưa ghi nhận cách dùng"}</p>
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
        <span className="shrink-0 text-xs font-bold text-primary-700 group-open:hidden">Xem</span>
        <span className="hidden shrink-0 text-xs font-bold text-primary-700 group-open:inline">Thu gọn</span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-3 text-sm leading-6">
        {item.description && (
          <div>
            <p className="font-bold text-slate-600">Mô tả</p>
            <p className="mt-1 whitespace-pre-line text-slate-700">{item.description}</p>
          </div>
        )}
        {item.conclusion && (
          <div>
            <p className="font-bold text-slate-600">Kết luận</p>
                <p className="mt-1 whitespace-pre-line font-semibold text-ink">{normalizeDisplayText(item.conclusion)}</p>
          </div>
        )}
      </div>
    </details>
  );
}

function groupByDate<T>(items: T[], getDate: (item: T) => string) {
  const groups = new Map<string, { dateKey: string; title: string; items: T[] }>();

  for (const item of items) {
    const value = getDate(item);
    const dateKey = formatDate(value);
    const current = groups.get(dateKey) ?? { dateKey, title: dateKey, items: [] };
    current.items.push(item);
    groups.set(dateKey, current);
  }

  return Array.from(groups.values());
}

function groupLabResults(items: LabResult[]) {
  const groups = new Map<string, { key: string; serviceName: string; performedAt: string; abnormalCount: number; items: LabResult[] }>();

  for (const item of items) {
    const serviceName = item.serviceName || "Xét nghiệm";
    const key = `${formatDateTime(item.performedAt)}-${serviceName}`;
    const current = groups.get(key) ?? { key, serviceName, performedAt: item.performedAt, abnormalCount: 0, items: [] };
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

function groupPrescriptionItems(items: PrescriptionItem[]): PrescriptionGroupData[] {
  const bhytItems = items.filter((item) => isBhytPayer(item.payerType));
  const serviceItems = items.filter((item) => !isBhytPayer(item.payerType));
  const groups: PrescriptionGroupData[] = [];

  if (bhytItems.length > 0) {
    groups.push({ key: "bhyt", title: "Đơn thuốc BHYT", items: bhytItems });
  }

  if (serviceItems.length > 0) {
    groups.push({ key: "service", title: "Đơn thuốc thu phí", items: serviceItems });
  }

  return groups;
}

function isBhytPayer(value?: string) {
  return value?.toUpperCase().includes("BHYT") ?? false;
}

function isNormalLabFlag(value: LabResult["flag"] | string) {
  return value === "Bình thường";
}

function emptyText(value?: string) {
  return value?.trim() ? value : "Chưa ghi nhận";
}
