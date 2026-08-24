import Link from "next/link";
import { ArrowRight, Bell, BookOpenText, Building2, CalendarDays, ClipboardList, FileClock, FileText, HeartPulse, Pill, ShieldCheck, Stethoscope } from "lucide-react";
import { Badge, Panel, SectionHeader, StatBadge } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { createPatientRepository } from "@/lib/data";
import { getFeaturedHealthGuidePosts } from "@/lib/content/health-guide";
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
  const featuredHealthGuidePosts = await getFeaturedHealthGuidePosts(3);

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
    {
      href: "/health-guide",
      label: "Cẩm nang",
      value: "Hướng dẫn sức khỏe",
      count: 0,
      icon: BookOpenText,
      color: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    },
    {
      href: "/hospital-info",
      label: "Bệnh viện",
      value: "Hotline, bản đồ",
      count: 0,
      icon: Building2,
      color: "bg-primary-50 text-primary-700 ring-primary-100",
    },
  ];

  return (
    <>
      <header className="mb-3 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-900 via-primary-700 to-emerald-500 p-3 text-white shadow-[0_14px_34px_rgba(7,60,57,0.16)] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-white/75">Xin chào</p>
            <h1 className="mt-0.5 line-clamp-1 font-serif text-2xl font-black leading-7 text-white sm:text-3xl">{patient.fullName}</h1>
            <p className="mt-1 text-sm font-semibold text-white/85">
              Mã BN: <span className="clinical-mono font-black">{patient.hisPatientCode}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge tone={patient.insurance.status === "Còn hiệu lực" ? "green" : "amber"}>{patient.insurance.status}</Badge>
            <span className="hidden h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 sm:inline-flex">
              <Bell aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <HeroMetric label="Lần khám" value={summary.visitsCount} />
          <HeroMetric label="Phiếu XN" value={summary.labResultsCount} />
          <HeroMetric label="Lịch hẹn" value={summary.appointmentsCount} />
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel className={`rounded-2xl p-3 shadow-sm sm:p-4 ${todayStatus?.hasActiveVisit ? "border-amber-200 bg-amber-50/80" : "bg-white/85"}`}>
          <div className="flex items-start gap-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Stethoscope aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="font-serif text-lg font-black text-ink">Hôm nay</h2>
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
              <div className="mt-3">
                <Link href="/today-visit" className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary-700 px-3 text-sm font-black text-white shadow-sm hover:bg-primary-900">
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

      <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {shortcuts.map((item) => (
          <ShortcutCard key={item.href} {...item} />
        ))}
      </section>

      <HealthGuidePreview posts={featuredHealthGuidePosts} />

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

function HealthGuidePreview({ posts }: { posts: Awaited<ReturnType<typeof getFeaturedHealthGuidePosts>> }) {
  return (
    <Panel className="mt-4">
      <SectionHeader title="Cẩm nang sức khỏe" meta={`${posts.length} bài nổi bật`} />
      <div className="grid gap-2 sm:grid-cols-3">
        {posts.map((post) => {
          const Icon = post.icon;

          return (
            <Link
              key={post.slug}
              href={`/health-guide/${post.slug}`}
              className="group relative overflow-hidden rounded-md border border-cream-200 p-3 transition hover:-translate-y-0.5 hover:border-primary-200"
              style={post.coverImageUrl ? { backgroundImage: `linear-gradient(135deg, rgba(255,247,237,0.95), rgba(255,247,237,0.82)), url(${post.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: post.background }}
            >
              <div className="relative z-10 flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ${post.tone}`}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <Badge tone="slate">{post.category}</Badge>
              </div>
              <h3 className="relative z-10 mt-2 line-clamp-2 text-sm font-black leading-5 text-ink">{post.title}</h3>
              <p className="relative z-10 mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-600">{post.summary}</p>
              <span className="relative z-10 mt-2 inline-flex items-center gap-1 text-[11px] font-black text-primary-700">
                Mở hướng dẫn
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
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

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/14 px-3 py-2 ring-1 ring-white/16">
      <p className="clinical-mono text-lg font-black leading-5 text-white">{value}</p>
      <p className="mt-0.5 line-clamp-1 text-[11px] font-bold text-white/75">{label}</p>
    </div>
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
    <section className="overflow-hidden rounded-2xl border border-primary-800 bg-[linear-gradient(135deg,#005f56,#007c73_62%,#0f6ea8)] p-3 text-white shadow-[0_10px_24px_rgba(7,60,57,0.18)] sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/14 text-white ring-1 ring-white/20">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase leading-4 text-white/75">Ví sức khỏe</p>
            <h2 className="line-clamp-1 text-sm font-black sm:text-base">Thẻ BHYT điện tử</h2>
          </div>
        </div>
        <Badge tone={status === "Còn hiệu lực" ? "green" : "amber"}>{status}</Badge>
      </div>
      <p className="clinical-mono mt-3 break-all text-lg font-black tracking-normal text-white sm:text-xl">{cardNumber || "Chưa ghi nhận"}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase text-white/70">Từ ngày</p>
          <p className="clinical-mono mt-0.5 font-bold text-white">{formatOptionalDate(validFrom)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-white/70">Đến ngày</p>
          <p className="clinical-mono mt-0.5 font-bold text-white">{formatOptionalDate(validTo)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cardNumber && <CopyButton value={cardNumber} label="Copy số thẻ" variant="dark" />}
        <CopyButton value={patientCode} label="Copy mã BN" variant="dark" />
        <Link href="/insurance" className="inline-flex min-h-9 items-center rounded-md px-2.5 text-xs font-black text-white ring-1 ring-white/25 hover:bg-white/10">
          Chi tiết
        </Link>
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
    "relative min-h-[104px] rounded-2xl border border-cream-200 bg-white/86 p-3 shadow-[0_10px_24px_rgba(7,60,57,0.055)] transition hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50";

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
