import { PageHeader } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { buildVisitClinicalMarkers } from "@/lib/medical/insights";
import { VisitsList } from "@/app/(portal)/visits/visits-list";

export default async function VisitsPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const [visitsResult, labsResult, imagingResult] = await Promise.allSettled([
    repository.getVisits(patient.id),
    repository.getLabResults(patient.id),
    repository.getImagingResults(patient.id),
  ]);
  const visits = visitsResult.status === "fulfilled" ? visitsResult.value : [];
  const labs = labsResult.status === "fulfilled" ? labsResult.value : [];
  const imaging = imagingResult.status === "fulfilled" ? imagingResult.value : [];
  const clinicalMarkers = Array.from(buildVisitClinicalMarkers(labs, imaging).values());

  return (
    <>
      <PageHeader title="Lịch sử khám" description="Tra cứu theo ngày, phòng khám, bác sĩ và nội dung chẩn đoán." />
      <VisitsList visits={visits} clinicalMarkers={clinicalMarkers} />
    </>
  );
}
