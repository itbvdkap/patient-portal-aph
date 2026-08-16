import { PageHeader } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { LabResultsList } from "@/app/(portal)/lab-results/lab-results-list";

export default async function LabResultsPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const visits = await repository.getVisits(patient.id);

  return (
    <>
      <PageHeader title="Kết quả xét nghiệm" description="Dữ liệu xét nghiệm theo từng lần khám, tải chi tiết khi mở hồ sơ." />
      <LabResultsList visits={visits} />
    </>
  );
}
