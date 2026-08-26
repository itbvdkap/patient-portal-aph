import { AlertTriangle } from "lucide-react";
import { PageHeader, Panel, SecureDataNotice } from "@/components/ui";
import { ImagingResultsList } from "@/app/(portal)/imaging/imaging-results-list";
import { createPatientRepository } from "@/lib/data";
import type { ImagingResult } from "@/types/patient";

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

  return (
    <>
      <PageHeader title="Chẩn đoán hình ảnh" description="Kết quả CĐHA lấy từ HIS, nhóm theo ngày thực hiện." />
      <SecureDataNotice label="Kết quả chẩn đoán hình ảnh được bảo vệ trong phiên đăng nhập" />

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

      {!loadError && <ImagingResultsList results={results} />}
    </>
  );
}
