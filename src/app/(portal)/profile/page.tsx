import { cookies } from "next/headers";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Bell, Building2, CalendarDays, ChevronDown, FileText, IdCard, KeyRound, LockKeyhole, LogOut, Phone, ShieldCheck, Smartphone, UserRound, UsersRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SectionHeader } from "@/components/ui";
import { AccountIdentityForm, ChangePasswordForm, DeviceSessions, LinkProfileForm, ProfileSwitcher } from "@/app/(portal)/profile/account-actions";
import { NotificationPreferences } from "@/app/(portal)/profile/notification-preferences";
import { getAccountOverview } from "@/lib/account/portal-account";
import { maskPhone } from "@/lib/auth/phone";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";
import { PATIENT_BRANCHES } from "@anphu/patient-domain";
import type { Patient } from "@/types/patient";
import { formatDate } from "@/utils/format";

export default async function ProfilePage() {
  const session = getDemoPatientSession(await cookies());
  const patientState = session?.mabn ? await getCurrentPatientSafe() : { patient: null, syncPending: false };
  const patient = patientState.patient;
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
  const hasPassword = Boolean(account.identity?.hasPassword || account.identity?.passwordSetAt);
  const passwordStatus = account.identity?.passwordSetAt ? `Đã thiết lập ${formatDate(account.identity.passwordSetAt)}` : hasPassword ? "Đã thiết lập" : "Chưa thiết lập";

  return (
    <div className="-mx-3 -mt-3 bg-slate-50/35 pb-4 sm:-mx-5 lg:mx-0 lg:mt-0 lg:bg-transparent">
      <AccountHero phone={displayPhone} accountReady={account.accountReady} />

      <div className="mx-auto grid max-w-3xl gap-4 px-3 pt-4 sm:px-5 lg:px-0">
        <AccountMenuSection title="Tài khoản">
          <AccountMenuDetails icon={UserRound} title="Thông tin cá nhân" meta={account.identity?.phoneMasked || (displayPhone ? maskPhone(displayPhone) : undefined)}>
            <AccountSummary
              name={accountName}
              phone={account.identity?.phoneMasked || (displayPhone ? maskPhone(displayPhone) : "Chưa ghi nhận")}
              status={account.identity?.status === "active" ? "Đang hoạt động" : account.identity?.status || "Đang hoạt động"}
              phoneVerifiedAt={account.identity?.phoneVerifiedAt ? formatDate(account.identity.phoneVerifiedAt) : "Chưa ghi nhận"}
              passwordStatus={passwordStatus}
              lastLoginAt={account.identity?.lastLoginAt ? formatDate(account.identity.lastLoginAt) : "Chưa ghi nhận"}
            />
            <AccountIdentityForm identity={account.identity} accountName={accountName} phone={displayPhone} />
          </AccountMenuDetails>

          <AccountMenuDetails icon={UsersRound} title="Hồ sơ y tế người thân" meta={`${account.profiles.length} hồ sơ`}>
          {patientState.syncPending ? (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
              Hồ sơ đang chờ đồng bộ dữ liệu y tế. Anh/chị vẫn có thể chọn hoặc thêm hồ sơ, dữ liệu khám sẽ tự cập nhật sau khi sync agent xử lý xong.
            </p>
          ) : null}
          {patient ? (
            <MedicalProfileCard patient={patient} />
          ) : (
            <p className="mb-4 rounded-md border border-dashed border-cream-200 bg-white/70 p-3 text-sm leading-6 text-slate-600">
              Dữ liệu y tế đang được cập nhật. Anh/chị vui lòng quay lại sau ít phút.
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

          <AccountMenuDetails icon={Building2} title="Đăng ký theo chi nhánh" meta="CN1 / CN3">
            <BranchBookingLinks />
          </AccountMenuDetails>

          <AccountMenuDetails icon={KeyRound} title="Thay đổi mật khẩu">
            <ChangePasswordForm hasPassword={hasPassword} />
          </AccountMenuDetails>

          <AccountMenuDetails icon={LockKeyhole} title="Passcode">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              Passcode mở nhanh app đang được chuẩn bị cho bản mobile. Hiện tại tài khoản vẫn được bảo vệ bằng phiên đăng nhập và mật khẩu.
            </p>
          </AccountMenuDetails>
        </AccountMenuSection>

        <AccountMenuSection title="Cài đặt">
          <AccountMenuDetails icon={Bell} title="Nhận thông báo" meta="Thiết bị này">
            <NotificationPreferences />
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

async function getCurrentPatientSafe(): Promise<{ patient: Patient | null; syncPending: boolean }> {
  try {
    return { patient: await createPatientRepository().getCurrentPatient(), syncPending: false };
  } catch (error) {
    if (error instanceof Error && error.message === "Patient profile is not synced yet.") {
      return { patient: null, syncPending: true };
    }

    throw error;
  }
}

function BranchBookingLinks() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PATIENT_BRANCHES.map((branch) => (
        <Link
          key={branch.code}
          href={`/booking?branch=${branch.code}`}
          className="rounded-md border border-cream-200 bg-white px-3 py-3 text-sm font-black text-ink transition hover:border-primary-200 hover:bg-primary-50"
        >
          <span className="block text-primary-800">{branch.shortName}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{branch.name}</span>
        </Link>
      ))}
    </div>
  );
}

function AccountSummary({
  name,
  phone,
  status,
  phoneVerifiedAt,
  passwordStatus,
  lastLoginAt,
}: {
  name: string;
  phone: string;
  status: string;
  phoneVerifiedAt: string;
  passwordStatus: string;
  lastLoginAt: string;
}) {
  return (
    <section className="rounded-md border border-primary-100 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <UserRound aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-black leading-6 text-ink">{name}</p>
          <p className="clinical-mono mt-1 text-sm font-bold text-slate-600">{phone}</p>
        </div>
        <StatusPill>{status}</StatusPill>
      </div>
      <dl className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <CompactInfo icon={BadgeCheck} label="Xác minh SĐT" value={phoneVerifiedAt} />
        <CompactInfo icon={KeyRound} label="Mật khẩu" value={passwordStatus} />
        <CompactInfo icon={Smartphone} label="Đăng nhập gần nhất" value={lastLoginAt} />
        <CompactInfo icon={ShieldCheck} label="Bảo vệ tài khoản" value="Phiên đăng nhập an toàn" />
      </dl>
    </section>
  );
}

function MedicalProfileCard({ patient }: { patient: Patient }) {
  return (
    <section className="mb-4 rounded-md border border-primary-100 bg-white">
      <div className="border-b border-slate-100 bg-primary-50/70 p-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-sm">
            <IdCard aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase text-slate-500">Hồ sơ đang xem</p>
            <h3 className="mt-0.5 font-serif text-lg font-black leading-6 text-ink">{patient.fullName}</h3>
            <p className="clinical-mono mt-1 text-sm font-bold text-slate-600">BN {patient.hisPatientCode}</p>
          </div>
        </div>
      </div>
      <dl className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <CompactInfo icon={CalendarDays} label="Ngày sinh" value={formatDate(patient.birthDate)} />
        <CompactInfo icon={UserRound} label="Giới tính" value={patient.gender || "Chưa ghi nhận"} />
        <CompactInfo icon={Phone} label="Điện thoại" value={patient.phone || "Chưa ghi nhận"} />
        <CompactInfo icon={ShieldCheck} label="BHYT" value={patient.insurance.cardNumber || "Chưa ghi nhận"} />
      </dl>
      <div className="border-t border-slate-100 p-3">
        <p className="text-xs font-bold uppercase text-slate-500">Địa chỉ</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-ink">{patient.address || "Chưa ghi nhận"}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MiniInfo label="BHYT từ ngày" value={formatDate(patient.insurance.validFrom)} />
          <MiniInfo label="BHYT đến ngày" value={formatDate(patient.insurance.validTo)} />
        </div>
      </div>
    </section>
  );
}

function CompactInfo({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-h-16 items-start gap-3 p-3">
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
        <dd className="clinical-mono mt-0.5 break-words text-sm font-bold leading-5 text-ink">{value}</dd>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-cream-50 px-3 py-2">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="clinical-mono mt-0.5 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 rounded-full bg-primary-700 px-2.5 py-1 text-[11px] font-bold leading-4 text-white">
      {children}
    </span>
  );
}

function AccountHero({ phone, accountReady }: { phone: string; accountReady: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-primary-900 via-primary-700 to-emerald-500 px-4 py-3 text-white shadow-[0_12px_28px_rgba(7,60,57,0.16)] lg:rounded-3xl">
      <div className="absolute -left-12 -top-16 h-36 w-36 rounded-full bg-white/10" />
      <div className="absolute -right-12 bottom-0 h-32 w-32 rounded-full bg-sky-300/10" />
      <div className="relative mx-auto flex max-w-3xl items-center gap-3">
        <BrandLogo size={48} className="ring-2 ring-white/80" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-white/75">An Phú Care</p>
          <h1 className="mt-0.5 font-serif text-xl font-black leading-6">Tài khoản</h1>
          <p className="clinical-mono mt-1 text-sm font-semibold text-white/90">{phone ? maskPhone(phone) : "Chưa có SĐT"}</p>
        </div>
        <span className="inline-flex max-w-[96px] shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-center text-[11px] font-bold leading-4 text-white ring-1 ring-white/25 sm:max-w-none">
          {accountReady ? "Đã bảo vệ phiên" : "Đang cập nhật tài khoản"}
        </span>
      </div>
    </section>
  );
}

function AccountMenuSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title ? <h2 className="mb-2 px-2 font-serif text-lg font-black text-ink">{title}</h2> : null}
      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white/90 shadow-[0_10px_30px_rgba(7,60,57,0.055)]">
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
      <summary className="flex min-h-[66px] cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${destructive ? "bg-rose-50 text-rose-600" : "bg-primary-50 text-primary-700"}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-base font-black leading-6 ${destructive ? "text-rose-700" : "text-ink"}`}>{title}</span>
          {meta ? <span className="clinical-mono mt-0.5 block text-xs font-semibold text-slate-500">{meta}</span> : null}
        </span>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-50 text-slate-400 transition group-open:rotate-180 group-open:text-primary-700">
          <ChevronDown aria-hidden="true" className="h-5 w-5" />
        </span>
      </summary>
      <div className="details-reveal border-t border-slate-100 bg-cream-50/75">
        <div className="px-4 py-4">{children}</div>
      </div>
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
