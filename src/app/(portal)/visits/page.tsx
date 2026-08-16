import { PageHeader } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { VisitsList } from "@/app/(portal)/visits/visits-list";

export default async function VisitsPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const visits = await repository.getVisits(patient.id);

  return (
    <>
      <PageHeader title="Lịch sử khám" description="Tra cứu theo ngày, phòng khám, bác sĩ và nội dung chẩn đoán." />
      <VisitsList visits={visits} />
    </>
  );
}
