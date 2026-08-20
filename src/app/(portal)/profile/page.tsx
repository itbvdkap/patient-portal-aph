import { cookies } from "next/headers";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronDown, FileText, KeyRound, LockKeyhole, LogOut, Smartphone, UserRound, UsersRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Field, SectionHeader } from "@/components/ui";
import { DeviceSessions, LinkProfileForm, ProfileSwitcher } from "@/app/(portal)/profile/account-actions";
import { getAccountOverview } from "@/lib/account/portal-account";
import { maskPhone } from "@/lib/auth/phone";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";
import { formatDate } from "@/utils/format";

export default async function ProfilePage() {
  const session = getDemoPatientSession(await cookies());
  const patient = session?.mabn ? await createPatientRepository().getCurrentPatient() : null;
  const legalDocs = await loadLegalDocs();
  const account = session
    ? await getAccountOverview(session, patient ?? undefined)
    : {
        identity: undefined,
        profiles: [],
        sessions: [],
        accountReady: false,
      };

  const displayPhone = account.identity?.phone || session?.phone || "";
  const accountName = account.identity?.fullName || account.identity?.displayName || "Tài khoản An Phú Care";

  return (
    <div className="-mx-3 -mt-3 bg-slate-50/40 pb-4 sm:-mx-5 lg:mx-0 lg:mt-0 lg:bg-transparent">
      <AccountHero phone={displayPhone} accountReady={account.accountReady} />

      <div className="mx-auto grid max-w-3xl gap-5 px-3 pt-4 sm:px-5 lg:px-0">
        <AccountMenuSection title="Tài khoản">
          <AccountMenuDetails icon={UserRound} title="Thông tin cá nhân" meta={account.identity?.phoneMasked || (displayPhone ? maskPhone(displayPhone) : undefined)}>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Tên tài khoản" value={accountName} />
              <Field label="Số điện thoại" value={account.identity?.phoneMasked || (displayPhone ? maskPhone(displayPhone) : "Chưa ghi nhận")} />
              <Field label="Trạng thái" value={account.identity?.status === "active" ? "Đang hoạt động" : account.identity?.status || "Đang hoạt động"} />
              <Field label="Xác minh SĐT" value={account.identity?.phoneVerifiedAt ? formatDate(account.identity.phoneVerifiedAt) : "Chưa ghi nhận"} />
              <Field label="Mật khẩu" value={account.identity?.passwordSetAt ? `Đã thiết lập ${formatDate(account.identity.passwordSetAt)}` : "Chưa thiết lập"} />
              <Field label="Đăng nhập gần nhất" value={account.identity?.lastLoginAt ? formatDate(account.identity.lastLoginAt) : "Chưa ghi nhận"} />
            </dl>
          </AccountMenuDetails>

          <AccountMenuDetails icon={UsersRound} title="Hồ sơ y tế người thân" meta={`${account.profiles.length} hồ sơ`}>
          {patient ? (
            <section className="mb-4 rounded-md border border-primary-100 bg-primary-50/70 p-3">
              <SectionHeader title="Hồ sơ đang xem" meta={patient.hisPatientCode} />
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
            </section>
          ) : (
            <p className="mb-4 rounded-md border border-dashed border-cream-200 bg-white/70 p-3 text-sm leading-6 text-slate-600">
              Tài khoản đã đăng nhập bằng số điện thoại. Vui lòng thêm hồ sơ bằng mã bệnh nhân để xem kết quả khám, BHYT, đơn thuốc và lịch hẹn.
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <section>
              <SectionHeader title="Chọn hồ sơ đang xem" meta={`${account.profiles.length} hồ sơ`} />
              <ProfileSwitcher profiles={account.profiles} />
            </section>
            <section>
              <SectionHeader title="Thêm hồ sơ người thân" />
              <LinkProfileForm />
            </section>
          </div>
          </AccountMenuDetails>

          <AccountMenuDetails icon={KeyRound} title="Thay đổi mật khẩu">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              Mật khẩu hiện được thiết lập trong luồng đăng ký/khôi phục mật khẩu. Khi cần đổi mật khẩu, chọn “Quên mật khẩu” ở màn hình đăng nhập để nhận OTP Zalo và đặt mật khẩu mới.
            </p>
          </AccountMenuDetails>

          <AccountMenuDetails icon={LockKeyhole} title="Passcode">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              Passcode mở nhanh app sẽ triển khai sau khi hoàn thiện cơ chế bảo mật thiết bị. Hiện tại app vẫn bảo vệ bằng phiên đăng nhập và mật khẩu tài khoản.
            </p>
          </AccountMenuDetails>
        </AccountMenuSection>

        <AccountMenuSection title="Cài đặt">
          <AccountMenuDetails icon={Bell} title="Nhận thông báo" meta="Sắp triển khai">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              Mục này sẽ dùng cho nhắc lịch hẹn, kết quả mới và cảnh báo bảo mật. Trước khi bật production cần cấu hình push notification và xin quyền người dùng.
            </p>
          </AccountMenuDetails>

          <AccountMenuDetails icon={Smartphone} title="Lịch sử đăng nhập / thiết bị" meta={`${account.sessions.length} phiên`}>
          <DeviceSessions sessions={account.sessions} />
          </AccountMenuDetails>
        </AccountMenuSection>

        <AccountMenuSection title="Thông tin pháp lý">
            {legalDocs.map((doc) => (
            <LegalDocument key={doc.fileName} title={doc.title} content={doc.content} />
            ))}
        </AccountMenuSection>

        <AccountMenuSection>
          <AccountMenuDetails icon={LogOut} title="Đăng xuất" destructive>
            <p className="text-sm font-semibold leading-6 text-slate-600">
              Để đăng xuất thiết bị hiện tại, dùng nút đăng xuất trên thanh tiêu đề. Để đăng xuất tất cả thiết bị, mở mục “Lịch sử đăng nhập / thiết bị”.
            </p>
          </AccountMenuDetails>
        </AccountMenuSection>
      </div>
    </div>
  );
}

function AccountHero({ phone, accountReady }: { phone: string; accountReady: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-b-2xl bg-gradient-to-br from-primary-900 via-primary-700 to-sky-700 px-4 py-4 text-white shadow-[0_12px_28px_rgba(7,60,57,0.18)] lg:rounded-2xl">
      <div className="absolute -left-10 -top-14 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-sky-300/10" />
      <div className="relative mx-auto flex max-w-3xl items-center gap-3">
        <BrandLogo size={58} className="ring-2 ring-white/80" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-white/75">An Phú Care</p>
          <h1 className="mt-0.5 font-serif text-xl font-black leading-6">Tài khoản</h1>
          <p className="clinical-mono mt-1 text-sm font-semibold text-white/90">{phone ? maskPhone(phone) : "Chưa có SĐT"}</p>
        </div>
        <span className="inline-flex shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/25">
          {accountReady ? "Đã bật quản lý phiên" : "Chờ migration tài khoản"}
        </span>
      </div>
    </section>
  );
}

function AccountMenuSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title ? <h2 className="mb-3 px-2 text-lg font-black text-slate-500">{title}</h2> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(7,60,57,0.06)]">
        {children}
      </div>
    </section>
  );
}

function AccountMenuDetails({
  icon: Icon,
  title,
  meta,
  children,
  destructive = false,
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <details className="group border-b border-slate-100 last:border-b-0">
      <summary className="flex min-h-[76px] cursor-pointer list-none items-center gap-4 px-4 py-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${destructive ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-700"}`}>
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-lg font-semibold leading-6 ${destructive ? "text-rose-700" : "text-ink"}`}>{title}</span>
          {meta ? <span className="clinical-mono mt-0.5 block text-xs font-semibold text-slate-500">{meta}</span> : null}
        </span>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition group-open:rotate-180 group-open:text-primary-700">
          <ChevronDown aria-hidden="true" className="h-6 w-6" />
        </span>
      </summary>
      <div className="border-t border-slate-100 bg-cream-50/75 px-4 py-4">{children}</div>
    </details>
  );
}

function LegalDocument({ title, content }: { title: string; content: string }) {
  return (
    <AccountMenuDetails icon={FileText} title={title}>
      <MarkdownText content={content} />
    </AccountMenuDetails>
  );
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);

  return (
    <div className="space-y-2 text-sm leading-6 text-slate-700">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("# ")) {
          return <h3 key={index} className="font-serif text-lg font-black text-ink">{trimmed.replace(/^#\s+/, "")}</h3>;
        }
        if (trimmed.startsWith("## ")) {
          return <h4 key={index} className="pt-2 font-serif text-base font-black text-ink">{trimmed.replace(/^##\s+/, "")}</h4>;
        }
        if (trimmed.startsWith("### ")) {
          return <h5 key={index} className="pt-1 text-sm font-black text-ink">{trimmed.replace(/^###\s+/, "")}</h5>;
        }
        if (trimmed.startsWith("- ")) {
          return <p key={index} className="pl-3">• {trimmed.replace(/^-\s+/, "")}</p>;
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          return <p key={index} className="pl-3">{trimmed}</p>;
        }
        if (trimmed.startsWith(">")) {
          return <p key={index} className="rounded-md bg-amber-50 px-3 py-2 font-semibold text-amber-900">{trimmed.replace(/^>\s?/, "")}</p>;
        }
        return <p key={index}>{trimmed.replace(/\*\*/g, "").replace(/`/g, "")}</p>;
      })}
    </div>
  );
}

async function loadLegalDocs() {
  const docs = [
    { title: "Điều khoản dịch vụ", fileName: "TERMS_OF_SERVICE.md" },
    { title: "Chính sách bảo mật", fileName: "PRIVACY_POLICY.md" },
    { title: "Quy định sử dụng", fileName: "ACCEPTABLE_USE_POLICY.md" },
  ];

  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      content: await readFile(join(process.cwd(), "polici", doc.fileName), "utf8").catch(() => "Chưa tìm thấy nội dung pháp lý."),
    })),
  );
}
