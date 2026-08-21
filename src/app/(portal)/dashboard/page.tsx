import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, FileClock, FileText, HeartPulse, Pill, Stethoscope } from "lucide-react";
import { Badge, Panel, SectionHeader, StatBadge } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { createPatientRepository } from "@/lib/data";
import { featuredHealthGuidePosts } from "@/lib/content/health-guide";
import { formatDate, formatDateTime } from "@/utils/format";
import type { Visit } from "@/types/patient";

const bookingUrl = "/booking";

export default async function DashboardPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const [visitsResult, summaryResult, appointmentsResult, registrationsResult, todayStatusResult] = await Promise.allSettled([
    repository.getVisits(patient.id),
    repository.getSummary(patient.id),
    repository.getAppointments(patient.id),
    repository.getRegistrations(patient.id),
    repository.getTodayVisitStatus(patient.id),
  ]);

  const visits = visitsResult.status === "fulfilled" ? visitsResult.value : [];
  const summary =
    summaryResult.status === "fulfilled"
      ? summaryResult.value
      : { visitsCount: 0, labResultsCount: 0, imagingResultsCount: 0, prescriptionsCount: 0, appointmentsCount: 0 };
  const appointments = appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
  const registrations = registrationsResult.status === "fulfilled" ? registrationsResult.value : [];
  const todayStatus = todayStatusResult.status === "fulfilled" ? todayStatusResult.value : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextAppointment = appointments
    .filter((appointment) => new Date(appointment.appointmentDate) >= today)
    .sort((first, second) => new Date(first.appointmentDate).getTime() - new Date(second.appointmentDate).getTime())[0];
  const nextPendingRegistration = registrations
    .filter((registration) => new Date(registration.registeredAt) >= today && registration.status !== "Đã khám")
    .sort((first, second) => new Date(first.registeredAt).getTime() - new Date(second.registeredAt).getTime())[0];

  const shortcuts = [
    {
      href: bookingUrl,
      label: "Đăng ký khám",
      value: "Đặt lịch nhanh",
      count: 0,
      icon: Stethoscope,
      color: "bg-amber-50 text-amber-700 ring-amber-100",
    },
    {
      href: "/visits",
      label: "Lịch sử khám",
      value: `${summary.visitsCount} lần`,
      count: summary.visitsCount,
      icon: ClipboardList,
      color: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    {
      href: "/lab-results",
      label: "Xét nghiệm",
      value: `${summary.labResultsCount} phiếu`,
      count: summary.labResultsCount,
      icon: HeartPulse,
      color: "bg-violet-50 text-violet-700 ring-violet-100",
    },
    {
      href: "/imaging",
      label: "CĐHA",
      value: `${summary.imagingResultsCount} kết quả`,
      count: summary.imagingResultsCount,
      icon: FileText,
      color: "bg-sky-50 text-sky-700 ring-sky-100",
    },
    {
      href: "/prescriptions",
      label: "Đơn thuốc",
      value: `${summary.prescriptionsCount} đơn`,
      count: summary.prescriptionsCount,
      icon: Pill,
      color: "bg-orange-50 text-orange-700 ring-orange-100",
    },
    {
      href: "/appointments",
      label: "Lịch hẹn",
      value: `${summary.appointmentsCount} lịch`,
      count: appointments.filter((appointment) => new Date(appointment.appointmentDate) >= today).length,
      icon: CalendarDays,
      color: "bg-rose-50 text-rose-700 ring-rose-100",
    },
  ];

  return (
    <>
      <header className="mb-2 flex items-start justify-between gap-3 border-b border-cream-200 pb-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-primary-700">Xin chào</p>
          <h1 className="mt-0.5 line-clamp-1 font-serif text-xl font-black leading-6 text-ink sm:text-2xl">{patient.fullName}</h1>
          <p className="mt-0.5 text-sm font-semibold text-slate-600">Mã BN: <span className="clinical-mono">{patient.hisPatientCode}</span></p>
        </div>
        <Badge tone={patient.insurance.status === "Còn hiệu lực" ? "green" : "amber"}>{patient.insurance.status}</Badge>
      </header>

      <section className="grid gap-2 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel className={`p-2.5 shadow-none sm:p-3 ${todayStatus?.hasActiveVisit ? "border-amber-200 bg-amber-50/80" : ""}`}>
          <div className="flex items-start gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
              <Stethoscope aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-ink">Hôm nay</h2>
                {todayStatus?.hasActiveVisit && <Badge tone="amber">{todayStatus.currentStepText}</Badge>}
              </div>
              {todayStatus?.hasActiveVisit ? (
                <div>
                  <p className="line-clamp-1 text-sm font-semibold leading-5 text-ink">{todayStatus.registration?.departmentName || "Đang có lượt khám hôm nay"}</p>
                  {todayStatus.registration?.ticketNumber && <p className="text-xs text-slate-700">STT: <span className="clinical-mono font-semibold">{todayStatus.registration.ticketNumber}</span></p>}
                </div>
              ) : nextPendingRegistration ? (
                <div>
                  <Badge tone="amber">Có lượt đăng ký chưa khám</Badge>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold leading-5 text-ink">{nextPendingRegistration.departmentName}</p>
                  <p className="clinical-mono text-xs text-slate-700">{formatDateTime(nextPendingRegistration.registeredAt)}</p>
                </div>
              ) : (
                <p className="line-clamp-2 text-sm font-medium leading-5 text-slate-600">Chưa có lịch khám nào hôm nay. Anh/chị có thể đăng ký nhanh từ ô Đăng ký khám bên dưới.</p>
              )}
              <div className="mt-2">
                <Link href="/today-visit" className="inline-flex min-h-8 w-full items-center justify-center rounded-md bg-primary-600 px-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary-700">
                  Khám hôm nay
                </Link>
              </div>
            </div>
          </div>
        </Panel>

        <InsuranceDigitalCard
          cardNumber={patient.insurance.cardNumber}
          status={patient.insurance.status}
          validFrom={patient.insurance.validFrom}
          validTo={patient.insurance.validTo}
          patientCode={patient.hisPatientCode}
        />
      </section>

      <section className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {shortcuts.map((item) => (
          <ShortcutCard key={item.href} {...item} />
        ))}
      </section>

      <HealthGuidePreview />

      {nextAppointment && (
        <Panel className="mt-4 border-primary-100 bg-primary-50/80 shadow-none">
          <SectionHeader title="Lịch hẹn sắp tới" />
          <Badge tone="blue">{formatDateTime(nextAppointment.appointmentDate)}</Badge>
          <p className="mt-3 text-sm font-semibold leading-6 text-ink">{nextAppointment.departmentName}</p>
          {nextAppointment.doctorName && <p className="mt-1 text-sm text-slate-700">{nextAppointment.doctorName}</p>}
        </Panel>
      )}

      <Panel className="mt-4">
        <SectionHeader title="Lần khám gần đây" meta={`${visits.length} lần khám`} />
        <div className="divide-y divide-slate-100">
          {visits.slice(0, 3).map((visit) => (
            <RecentVisitRow key={visit.id} visit={visit} />
          ))}
        </div>
      </Panel>
    </>
  );
}

function HealthGuidePreview() {
  return (
    <Panel className="mt-4">
      <SectionHeader title="Cẩm nang sức khỏe" meta="3 bài nổi bật" />
      <div className="grid gap-2 sm:grid-cols-3">
        {featuredHealthGuidePosts.map((post) => {
          const Icon = post.icon;

          return (
            <Link
              key={post.slug}
              href={`/health-guide#${post.slug}`}
              className="rounded-md border border-cream-200 bg-cream-100/70 p-3 transition hover:border-primary-200 hover:bg-primary-50"
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ${post.tone}`}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <Badge tone="slate">{post.category}</Badge>
              </div>
              <h3 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-ink">{post.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-600">{post.summary}</p>
            </Link>
          );
        })}
      </div>
      <Link href="/health-guide" className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-primary-700 hover:text-primary-800">
        Xem tất cả cẩm nang
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

function InsuranceDigitalCard({
  cardNumber,
  status,
  validFrom,
  validTo,
  patientCode,
}: {
  cardNumber: string;
  status: string;
  validFrom: string;
  validTo: string;
  patientCode: string;
}) {
  return (
      <section className="overflow-hidden rounded-md bg-gradient-to-br from-primary-950 via-primary-800 to-primary-700 p-2.5 text-white shadow-[0_10px_22px_rgba(0,91,85,0.22)] ring-1 ring-primary-900/10 sm:p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase leading-4 text-white/85">Ví sức khỏe</p>
          <h2 className="line-clamp-1 text-sm font-black sm:text-base">Thẻ BHYT điện tử</h2>
        </div>
        <Badge tone={status === "Còn hiệu lực" ? "green" : "amber"}>{status}</Badge>
      </div>
      <p className="clinical-mono mt-1.5 break-all text-base font-black tracking-normal text-white sm:text-lg">{cardNumber || "Chưa ghi nhận"}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase text-white/80">Từ ngày</p>
          <p className="clinical-mono mt-0.5 font-bold text-white">{formatOptionalDate(validFrom)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-white/80">Đến ngày</p>
          <p className="clinical-mono mt-0.5 font-bold text-white">{formatOptionalDate(validTo)}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {cardNumber && <CopyButton value={cardNumber} label="Copy số thẻ" />}
        <CopyButton value={patientCode} label="Copy mã BN" />
      </div>
    </section>
  );
}

function ShortcutCard({
  href,
  external,
  label,
  value,
  count,
  icon: Icon,
  color,
}: {
  href: string;
  external?: boolean;
  label: string;
  value: string;
  count: number;
  icon: typeof FileClock;
  color: string;
}) {
  const content = (
    <>
      {count > 0 && (
        <span className="absolute right-2 top-2">
          <StatBadge>{count > 99 ? "99+" : count}</StatBadge>
        </span>
      )}
      <span className={`flex h-9 w-9 items-center justify-center rounded-md ring-1 ${color}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="mt-2 text-sm font-black leading-4 text-ink">{label}</p>
      <p className="mt-1 line-clamp-1 text-xs font-semibold leading-4 text-slate-500">{value}</p>
    </>
  );
  const className =
    "relative min-h-[104px] rounded-md border border-cream-200 bg-cream-50 p-2.5 shadow-[0_8px_22px_rgba(7,60,57,0.055)] transition hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50";

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function RecentVisitRow({ visit }: { visit: Visit }) {
  return (
    <Link href={`/visits/${visit.id}`} className="block py-3 transition hover:bg-primary-50 sm:px-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="clinical-mono font-bold text-ink">{formatDate(visit.visitDate)}</p>
          <p className="mt-1 line-clamp-1 text-sm text-slate-600">
            {visit.departmentName}
            {visit.doctorName ? ` · ${visit.doctorName}` : ""}
          </p>
        </div>
        <Badge tone="blue">{visit.status}</Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-ink">{removeIcdPrefix(visit.primaryDiagnosis)}</p>
      <p className="mt-1 text-sm font-bold text-primary-700">Xem chi tiết</p>
    </Link>
  );
}

function removeIcdPrefix(value: string) {
  return value.replace(/^[A-Z][0-9][0-9](?:\.[0-9A-Z]+)?\s*-\s*/i, "").trim() || value;
}

function formatOptionalDate(value: string) {
  if (!value) return "Chưa ghi nhận";

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1900) {
    return "Chưa ghi nhận";
  }

  return formatDate(value);
}
