import { AlertTriangle, Eye } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import type { ImagingResult } from "@/types/patient";
import { formatDate, formatDateTime } from "@/utils/format";

export default async function ImagingPage() {
  const repository = createPatientRepository();
  let results: ImagingResult[] = [];
  let loadError = "";

  try {
    const patient = await repository.getCurrentPatient();
    results = await repository.getImagingResults(patient.id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Không tải được dữ liệu chẩn đoán hình ảnh.";
  }

  const groups = groupImagingResults(results);

  return (
    <>
      <PageHeader title="Chẩn đoán hình ảnh" description="Kết quả CĐHA lấy từ HIS, nhóm theo ngày thực hiện." />

      {loadError && (
        <Panel className="mb-4 border-amber-200 bg-amber-50/80 shadow-none">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
              <AlertTriangle aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-amber-950">Chưa tải được dữ liệu CĐHA</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                HIS đang trả lỗi cho dữ liệu chẩn đoán hình ảnh của bệnh nhân này. Các mục khác vẫn có thể xem bình thường.
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="space-y-5">
        {!loadError && groups.length === 0 && <EmptyState text="Chưa có dữ liệu chẩn đoán hình ảnh." />}

        {groups.map((group) => (
          <section key={group.dateKey} className="space-y-3">
            <div>
              <h2 className="clinical-mono text-base font-bold text-ink">{formatDate(group.dateKey)}</h2>
              <p className="clinical-mono text-sm text-slate-600">{group.items.length} kết quả</p>
            </div>

            {group.items.map((result) => (
              <Panel key={result.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-ink">{result.techniqueName}</h3>
                    <p className="clinical-mono mt-1 text-sm text-slate-600">
                      {formatDateTime(result.date)} · {result.doctorName || "Chưa ghi nhận bác sĩ"}
                    </p>
                  </div>
                  <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-md bg-primary-50 px-3 text-sm font-bold text-primary-700">
                    <Eye aria-hidden="true" className="h-4 w-4" />
                    Kết quả
                  </span>
                </div>

                {result.conclusion && (
                  <div className="mt-3 rounded-md border border-primary-100 bg-primary-50 p-3 text-sm font-bold leading-6 text-primary-900">
                    <Badge tone="green">Kết luận</Badge>
                    <p className="mt-2 whitespace-pre-line">{result.conclusion}</p>
                  </div>
                )}

                {result.description && (
                  <details className="group mt-3">
                    <summary className="cursor-pointer text-sm font-bold text-primary-700">Xem mô tả chi tiết</summary>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{result.description}</p>
                  </details>
                )}
              </Panel>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

function groupImagingResults(results: ImagingResult[]) {
  const dateMap = new Map<string, ImagingResult[]>();

  for (const result of results) {
    const dateKey = result.date.slice(0, 10);
    const items = dateMap.get(dateKey) ?? [];

    items.push(result);
    dateMap.set(dateKey, items);
  }

  return Array.from(dateMap.entries()).map(([dateKey, items]) => ({
    dateKey,
    items,
  }));
}
