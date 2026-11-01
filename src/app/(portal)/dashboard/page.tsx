import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  Hospital,
  Info,
  Pill,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Badge, Panel, SectionHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { createPatientRepository } from "@/lib/data";
import { getFeaturedHealthGuidePosts } from "@/lib/content/health-guide";
import { formatDate, formatDateTime } from "@/utils/format";
import type { Visit } from "@/types/patient";

const bookingUrl = "/booking";

export default async function DashboardPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const [
    visitsResult,
    summaryResult,
    appointmentsResult,
    registrationsResult,
    todayStatusResult,
  ] = await Promise.allSettled([
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
      : {
          visitsCount: 0,
          labResultsCount: 0,
          imagingResultsCount: 0,
          prescriptionsCount: 0,
          appointmentsCount: 0,
        };
  const appointments =
    appointmentsResult.status === "fulfilled" ? appointmentsResult.value : [];
  const registrations =
    registrationsResult.status === "fulfilled" ? registrationsResult.value : [];
  const todayStatus =
    todayStatusResult.status === "fulfilled" ? todayStatusResult.value : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextAppointment = appointments
    .filter((appointment) => new Date(appointment.appointmentDate) >= today)
    .sort(
      (first, second) =>
        new Date(first.appointmentDate).getTime() -
        new Date(second.appointmentDate).getTime(),
    )[0];
  const nextPendingRegistration = registrations
    .filter(
      (registration) =>
        new Date(registration.registeredAt) >= today &&
        registration.status !== "Đã khám",
    )
    .sort(
      (first, second) =>
        new Date(first.registeredAt).getTime() -
        new Date(second.registeredAt).getTime(),
    )[0];
  const recentVisits = [...visits].sort(
    (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime(),
  );
  const latestVisit = recentVisits[0];
  const failed = [
    visitsResult,
    summaryResult,
    appointmentsResult,
    registrationsResult,
    todayStatusResult,
  ].some((result) => result.status === "rejected");

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
      count: appointments.filter(
        (appointment) => new Date(appointment.appointmentDate) >= today,
      ).length,
      icon: CalendarDays,
      color: "bg-rose-50 text-rose-700 ring-rose-100",
    },
    {
      href: "/hospital-info",
      label: "Bệnh viện",
      value: "Thông tin hỗ trợ",
      count: 0,
      icon: Hospital,
      color: "bg-teal-50 text-teal-700 ring-teal-100",
    },
    {
      href: "/health-guide",
      label: "Cẩm nang",
      value: "Hướng dẫn sức khỏe",
      count: 0,
      icon: BookOpenText,
      color: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    },
  ];

  return (
    <div className="patient-home" aria-label="Trang chủ bệnh nhân">
      <header className="mb-6">
        <h1 className="patient-title">Xin chào!</h1>
        <p className="patient-subtitle mt-2">
          {patient.fullName} ·{" "}
          <span className="font-semibold">BN {patient.hisPatientCode}</span>
        </p>
      </header>
      {failed && (
        <div className="patient-notice patient-error" role="alert">
          <Info aria-hidden="true" />
          <p>
            Một số thông tin chưa tải được. Các mục đã tải vẫn xem được.{" "}
            <Link href="/dashboard">Tải lại trang</Link>
          </p>
        </div>
      )}
      <div className="patient-home-grid">
        <section
          className="patient-card"
          aria-labelledby="next-appointment-heading"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="next-appointment-heading" className="patient-heading">
              Lịch hẹn sắp tới
            </h2>
            <Link
              href="/appointments"
              className="text-sm font-semibold text-primary-700 inline-flex min-h-11 items-center"
            >
              Xem tất cả
            </Link>
          </div>
          {nextAppointment ? (
            <Link href="/appointments" className="patient-row mb-4">
              <DateTile value={nextAppointment.appointmentDate} />
              <div>
                <p className="font-bold">{nextAppointment.departmentName}</p>
                <p className="patient-subtitle mt-1">
                  {formatDateTime(nextAppointment.appointmentDate)}
                </p>
                {nextAppointment.doctorName && (
                  <p className="patient-subtitle">
                    {nextAppointment.doctorName}
                  </p>
                )}
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <p className="patient-subtitle mb-4">
              {appointmentsResult.status === "rejected"
                ? "Chưa tải được lịch hẹn."
                : "Chưa có lịch hẹn sắp tới."}
            </p>
          )}
          <Link href={bookingUrl} className="patient-primary">
            <CalendarDays aria-hidden="true" />
            Đăng ký khám
            <ArrowRight className="ml-auto" aria-hidden="true" />
          </Link>
        </section>
        <div className="mt-4 md:mt-0 grid gap-3 content-start">
          {latestVisit ? (
            <Link
              href={`/visits/${latestVisit.id}`}
              className="patient-card patient-row"
            >
              <FileText aria-hidden="true" />
              <div>
                <p className="font-bold">Kết quả lần khám</p>
                <p className="patient-subtitle mt-1">
                  {formatDate(latestVisit.visitDate)} ·{" "}
                  {latestVisit.departmentName}
                </p>
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <div className="patient-card patient-row">
              <FileText aria-hidden="true" />
              <p className="patient-subtitle">
                {visitsResult.status === "rejected"
                  ? "Chưa tải được lịch sử khám."
                  : "Chưa có lần khám để xem kết quả."}
              </p>
            </div>
          )}
          {(todayStatus?.hasActiveVisit ||
            nextPendingRegistration ||
            todayStatusResult.status === "rejected") && (
            <Link href="/today-visit" className="patient-row patient-card">
              <Stethoscope aria-hidden="true" />
              <div>
                <p className="font-bold">Khám hôm nay</p>
                <p className="patient-subtitle mt-1">
                  {todayStatus?.hasActiveVisit
                    ? `${todayStatus.registration?.departmentName || "Đang có lượt khám"}${todayStatus.registration?.ticketNumber ? ` · STT ${todayStatus.registration.ticketNumber}` : ""}`
                    : nextPendingRegistration
                      ? `${nextPendingRegistration.departmentName} · ${formatDateTime(nextPendingRegistration.registeredAt)}`
                      : "Chưa tải được thông tin hôm nay."}
                </p>
                {todayStatus?.hasActiveVisit && (
                  <Badge tone="amber">{todayStatus.currentStepText}</Badge>
                )}
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <nav className="patient-shortcuts" aria-label="Tra cứu hồ sơ sức khỏe">
        {shortcuts
          .filter((item) =>
            ["/visits", "/lab-results", "/imaging", "/prescriptions"].includes(
              item.href,
            ),
          )
          .map((item) => (
            <Link href={item.href} key={item.href} className="patient-shortcut">
              <item.icon aria-hidden="true" />
              <span>
                <strong>
                  {item.href === "/imaging" ? "Chẩn đoán hình ảnh" : item.label}
                </strong>
                <small>
                  {summaryResult.status === "rejected"
                    ? "Chưa tải được số lượng"
                    : item.value}
                </small>
              </span>
            </Link>
          ))}
      </nav>
      <section
        className="patient-section"
        aria-labelledby="recent-visits-heading"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 id="recent-visits-heading" className="patient-heading">
            Lần khám gần đây
          </h2>
          <Link
            href="/visits"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-700"
          >
            Xem tất cả
          </Link>
        </div>
        {recentVisits.length ? (
          recentVisits
            .slice(0, 3)
            .map((visit) => <RecentVisitRow key={visit.id} visit={visit} />)
        ) : (
          <p className="patient-subtitle py-4">
            {visitsResult.status === "rejected"
              ? "Chưa tải được lịch sử khám."
              : "Chưa có lịch sử khám."}
          </p>
        )}
      </section>
      <nav className="patient-more" aria-label="Tiện ích bệnh nhân">
        <Link href="/insurance">
          <ShieldCheck aria-hidden="true" />
          Thẻ BHYT
        </Link>
        <Link href="/hospital-info">
          <Hospital aria-hidden="true" />
          Bệnh viện
        </Link>
        <Link href="/health-guide">
          <BookOpenText aria-hidden="true" />
          Cẩm nang
        </Link>
        <Link href="/profile">
          <ClipboardList aria-hidden="true" />
          Hồ sơ & người thân
        </Link>
      </nav>
      <div className="patient-section">
        <InsuranceDigitalCard
          cardNumber={patient.insurance.cardNumber}
          status={patient.insurance.status}
          validFrom={patient.insurance.validFrom}
          validTo={patient.insurance.validTo}
          patientCode={patient.hisPatientCode}
        />
      </div>
      {featuredHealthGuidePosts.length > 0 && (
        <HealthGuidePreview posts={featuredHealthGuidePosts} />
      )}
    </div>
  );
}

function DateTile({ value }: { value: string }) {
  const parts = formatDate(value).split("/");
  return (
    <span className="patient-date" aria-hidden="true">
      <strong>{parts[0]}</strong>
      <span>TH{parts[1]}</span>
    </span>
  );
}

function HealthGuidePreview({
  posts,
}: {
  posts: Awaited<ReturnType<typeof getFeaturedHealthGuidePosts>>;
}) {
  return (
    <Panel className="mt-4">
      <SectionHeader
        title="Cẩm nang sức khỏe"
        meta={`${posts.length} bài nổi bật`}
      />
      <div className="grid gap-2 sm:grid-cols-3">
        {posts.map((post) => {
          const Icon = post.icon;

          return (
            <Link
              key={post.slug}
              href={`/health-guide/${post.slug}`}
              className="group relative overflow-hidden rounded-md border border-cream-200 p-3 transition hover:-translate-y-0.5 hover:border-primary-200"
              style={
                post.coverImageUrl
                  ? {
                      backgroundImage: `linear-gradient(135deg, rgba(255,247,237,0.95), rgba(255,247,237,0.82)), url(${post.coverImageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : { background: post.background }
              }
            >
              <div className="relative z-10 flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ${post.tone}`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <Badge tone="slate">{post.category}</Badge>
              </div>
              <h3 className="relative z-10 mt-2 line-clamp-2 text-sm font-black leading-5 text-ink">
                {post.title}
              </h3>
              <p className="relative z-10 mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-600">
                {post.summary}
              </p>
              <span className="relative z-10 mt-2 inline-flex items-center gap-1 text-[11px] font-black text-primary-700">
                Mở hướng dẫn
                <ArrowRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          );
        })}
      </div>
      <Link
        href="/health-guide"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-primary-700 hover:text-primary-800"
      >
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
    <details className="group patient-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <ShieldCheck
            aria-hidden="true"
            className="h-5 w-5 text-primary-700"
          />
          <span className="font-bold">Thẻ BHYT điện tử</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Badge tone={status === "Còn hiệu lực" ? "green" : "amber"}>
            {status || "Chưa ghi nhận"}
          </Badge>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 transition group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="border-t border-slate-100 pt-3 mt-2">
        <p className="break-all font-semibold">
          {cardNumber || "Chưa ghi nhận số thẻ"}
        </p>
        <dl className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div>
            <dt className="text-slate-600">Từ ngày</dt>
            <dd className="font-semibold mt-1">
              {formatOptionalDate(validFrom)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-600">Đến ngày</dt>
            <dd className="font-semibold mt-1">
              {formatOptionalDate(validTo)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {cardNumber && (
            <CopyButton value={cardNumber} label="Sao chép số thẻ" />
          )}
          <CopyButton value={patientCode} label="Sao chép mã BN" />
          <Link
            href="/insurance"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-700"
          >
            Chi tiết thẻ BHYT
          </Link>
        </div>
      </div>
    </details>
  );
}

function RecentVisitRow({ visit }: { visit: Visit }) {
  return (
    <Link href={`/visits/${visit.id}`} className="patient-visit-row">
      <DateTile value={visit.visitDate} />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">{visit.departmentName || "Lần khám"}</p>
          <Badge tone="blue">{visit.status || "Đã ghi nhận"}</Badge>
        </div>
        {visit.doctorName && (
          <p className="patient-subtitle mt-1">{visit.doctorName}</p>
        )}
        <p className="patient-subtitle mt-1">
          {formatDateTime(visit.visitDate)}
        </p>
        {visit.primaryDiagnosis && (
          <p className="patient-subtitle mt-1">
            {removeIcdPrefix(visit.primaryDiagnosis)}
          </p>
        )}
      </div>
      <ChevronRight aria-label="Xem chi tiết lần khám" />
    </Link>
  );
}

function removeIcdPrefix(value: string) {
  return (
    value.replace(/^[A-Z][0-9][0-9](?:\.[0-9A-Z]+)?\s*-\s*/i, "").trim() ||
    value
  );
}

function formatOptionalDate(value: string) {
  if (!value) return "Chưa ghi nhận";

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1900) {
    return "Chưa ghi nhận";
  }

  return formatDate(value);
}
