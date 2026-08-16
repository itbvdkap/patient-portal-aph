import { Field, PageHeader, Panel } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { formatDate } from "@/utils/format";

export default async function ProfilePage() {
  const patient = await createPatientRepository().getCurrentPatient();

  return (
    <>
      <PageHeader title="Tài khoản bệnh nhân" description="Thông tin hành chính và bảo hiểm của bệnh nhân." />
      <Panel>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Mã bệnh nhân" value={patient.hisPatientCode} />
          <Field label="Họ tên" value={patient.fullName} />
          <Field label="Ngày sinh" value={formatDate(patient.birthDate)} />
          <Field label="Giới tính" value={patient.gender} />
          <Field label="Điện thoại" value={patient.phone || "Chưa ghi nhận"} />
          <Field label="Địa chỉ" value={patient.address || "Chưa ghi nhận"} />
          <Field label="Số thẻ BHYT" value={patient.insurance.cardNumber || "Chưa ghi nhận"} />
          <Field label="Từ ngày" value={formatDate(patient.insurance.validFrom)} />
          <Field label="Đến ngày" value={formatDate(patient.insurance.validTo)} />
        </dl>
      </Panel>
    </>
  );
}
