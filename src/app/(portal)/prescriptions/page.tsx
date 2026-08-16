import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import type { PrescriptionItem } from "@/types/patient";
import { formatDate } from "@/utils/format";

export default async function PrescriptionsPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const prescriptions = await repository.getPrescriptions(patient.id);

  return (
    <>
      <PageHeader title="Đơn thuốc" description="Danh sách đơn thuốc theo từng ngày khám, tách riêng BHYT và thu phí." />
      <div className="space-y-4">
        {prescriptions.length === 0 && <EmptyState text="Chưa có đơn thuốc." />}
        {prescriptions.map((prescription) => {
          const groups = groupPrescriptionItems(prescription.items);

          return (
            <Panel key={prescription.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-ink">{formatDate(prescription.prescribedAt)}</h2>
                  {prescription.doctorName && <p className="mt-1 text-sm text-slate-600">{prescription.doctorName}</p>}
                </div>
                <Badge tone="slate">{prescription.items.length} thuốc</Badge>
              </div>
              <div className="mt-4 space-y-4">
                {groups.map((group) => (
                  <section key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-ink">{group.title}</h3>
                      <Badge tone={group.key === "bhyt" ? "green" : "slate"}>{group.items.length} thuốc</Badge>
                    </div>
                    <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
                      {group.items.map((item) => (
                        <MedicineRow key={item.id} item={item} isBhyt={group.key === "bhyt"} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}

function MedicineRow({ item, isBhyt }: { item: PrescriptionItem; isBhyt: boolean }) {
  return (
    <div className="p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-bold leading-6 text-ink">{item.medicineName}</p>
        {item.payerType && <Badge tone={isBhyt ? "green" : "slate"}>{item.payerType}</Badge>}
      </div>
      {(item.activeIngredient || item.strength || item.route) && (
        <p className="mt-1 text-sm text-slate-600">{[item.activeIngredient, item.strength, item.route].filter(Boolean).join(" · ")}</p>
      )}
      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-[120px_1fr]">
        <p className="font-semibold text-ink">SL: {item.quantity || "-"}</p>
        <p className="leading-6 text-slate-700">{item.instruction || item.dosage || "Chưa ghi nhận cách dùng"}</p>
      </div>
    </div>
  );
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
