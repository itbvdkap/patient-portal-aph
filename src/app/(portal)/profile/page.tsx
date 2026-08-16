import { cookies } from "next/headers";
import { Badge, Field, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { DeviceSessions, LinkProfileForm, ProfileSwitcher } from "@/app/(portal)/profile/account-actions";
import { getAccountOverview } from "@/lib/account/portal-account";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";
import { formatDate } from "@/utils/format";

export default async function ProfilePage() {
  const session = getDemoPatientSession(await cookies());
  const patient = await createPatientRepository().getCurrentPatient();
  const account = session
    ? await getAccountOverview(session, patient)
    : {
        profiles: [],
        sessions: [],
        accountReady: false,
      };

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Quản lý hồ sơ bệnh nhân đang xem, thiết bị đăng nhập và bảo mật tài khoản."
        actions={<Badge tone={account.accountReady ? "green" : "amber"}>{account.accountReady ? "Đã bật quản lý phiên" : "Chờ migration tài khoản"}</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <Panel>
          <SectionHeader title="Hồ sơ đang xem" />
          <dl className="grid gap-3 sm:grid-cols-2">
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

        <Panel>
          <SectionHeader title="Chọn hồ sơ đang xem" meta={`${account.profiles.length} hồ sơ`} />
          <ProfileSwitcher profiles={account.profiles} />
        </Panel>
      </div>

      <Panel className="mt-4">
        <SectionHeader title="Thêm hồ sơ người thân" />
        <LinkProfileForm />
      </Panel>

      <Panel className="mt-4">
        <SectionHeader title="Lịch sử đăng nhập / thiết bị" meta={`${account.sessions.length} phiên`} />
        <DeviceSessions sessions={account.sessions} />
      </Panel>

      <Panel className="mt-4">
        <SectionHeader title="Lộ trình tài khoản" />
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Giai đoạn 1" value="Một tài khoản - nhiều hồ sơ theo SĐT + CCCD" />
          <Field label="Giai đoạn 2" value="Liên kết thêm người thân sau xác minh" />
          <Field label="Giai đoạn 3" value="Thông báo bảo mật khi đăng nhập thiết bị mới" />
        </dl>
      </Panel>
    </>
  );
}
