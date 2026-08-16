import { Badge, EmptyState, Field, PageHeader, Panel } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { formatDate } from "@/utils/format";

export default async function InsurancePage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const insurance = await repository.getInsurance(patient.id);

  return (
    <>
      <PageHeader title="Bảo hiểm y tế" description="Thông tin thẻ mới nhất theo dữ liệu khám bệnh." />
      {insurance ? (
        <Panel>
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Số thẻ BHYT</p>
              <p className="mt-1 break-all text-2xl font-black text-ink">{insurance.cardNumber || "Chưa ghi nhận"}</p>
            </div>
            <Badge tone={insurance.status === "Còn hiệu lực" ? "green" : "amber"}>{insurance.status}</Badge>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Mã quyền lợi" value={insurance.benefitCode || "Chưa ghi nhận"} />
            <Field label="Nơi đăng ký KCB ban đầu" value={insurance.registeredClinic || "Chưa ghi nhận"} />
            <Field label="Từ ngày" value={formatDate(insurance.validFrom)} />
            <Field label="Đến ngày" value={formatDate(insurance.validTo)} />
          </dl>
        </Panel>
      ) : (
        <EmptyState text="Chưa có thông tin thẻ BHYT." />
      )}
    </>
  );
}
