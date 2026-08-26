import Link from "next/link";
import { Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CalendarDays, ClipboardList, FileText, HeartPulse, Pill, ScanSearch, ShieldCheck, TestTube2 } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel, SectionHeader, SecureDataNotice } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { buildLabTrendSeries, buildVitalTrendSeries, isAbnormalLabFlag, labFlagDirection, type TrendSeries } from "@/lib/medical/insights";
import type { LabResult, Visit, VisitDetail } from "@/types/patient";
import { formatDate } from "@/utils/format";

const maxVisitsForVitals = 8;
const maxLabResultsForTrend = 300;

export default async function HealthTrackingPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const [visitsResult, labResult, summaryResult] = await Promise.allSettled([
    repository.getVisits(patient.id),
    repository.getLabResults(patient.id),
    repository.getSummary(patient.id),
  ]);
  const visits = visitsResult.status === "fulfilled" ? visitsResult.value : [];
  const labs = labResult.status === "fulfilled" ? labResult.value : [];
  const summary =
    summaryResult.status === "fulfilled"
      ? summaryResult.value
      : { visitsCount: 0, labResultsCount: 0, imagingResultsCount: 0, prescriptionsCount: 0, appointmentsCount: 0 };
  const recentVisits = visits
    .slice()
    .sort((first, second) => new Date(second.visitDate).getTime() - new Date(first.visitDate).getTime())
    .slice(0, maxVisitsForVitals);
  const detailsResult = await Promise.allSettled(recentVisits.map((visit) => repository.getVisitDetail(patient.id, visit.id)));
  const details = detailsResult
    .filter((result): result is PromiseFulfilledResult<VisitDetail | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((detail): detail is VisitDetail => Boolean(detail));
  const recentLabs = labs
    .slice()
    .sort((first, second) => new Date(second.performedAt).getTime() - new Date(first.performedAt).getTime())
    .slice(0, maxLabResultsForTrend);
  const labTrends = buildLabTrendSeries(recentLabs, 8);
  const vitalTrends = buildVitalTrendSeries(details, recentVisits);
  const abnormalLabs = recentLabs.filter((item) => isAbnormalLabFlag(item.flag)).slice(0, 8);
  const abnormalGroups = groupAbnormalLabsByVisit(recentLabs.filter((item) => isAbnormalLabFlag(item.flag)), visits);
  const allTrends = [...vitalTrends, ...labTrends];

  return (
    <>
      <PageHeader
        title="Theo dõi sức khỏe"
        description="Tổng hợp xu hướng chức năng sống và các chỉ số xét nghiệm cần lưu ý theo từng lần khám."
        actions={
          <Link href="/lab-results" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 text-sm font-black text-primary-800 hover:bg-primary-100">
            <TestTube2 aria-hidden="true" className="h-4 w-4" />
            Xem xét nghiệm
          </Link>
        }
      />

      <SecureDataNotice label="Biểu đồ sức khỏe chỉ hiển thị trong phiên đăng nhập đã xác thực" />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <HealthHubCard
          href="/visits"
          label="Lịch sử khám"
          value={`${summary.visitsCount} lần`}
          icon={ClipboardList}
          tone="bg-emerald-50 text-emerald-700 ring-emerald-100"
        />
        <HealthHubCard
          href="/lab-results"
          label="Xét nghiệm"
          value={`${summary.labResultsCount} phiếu`}
          icon={HeartPulse}
          tone="bg-violet-50 text-violet-700 ring-violet-100"
        />
        <HealthHubCard
          href="/imaging"
          label="CĐHA"
          value={`${summary.imagingResultsCount} kết quả`}
          icon={ScanSearch}
          tone="bg-sky-50 text-sky-700 ring-sky-100"
        />
        <HealthHubCard
          href="/prescriptions"
          label="Đơn thuốc"
          value={`${summary.prescriptionsCount} đơn`}
          icon={Pill}
          tone="bg-orange-50 text-orange-700 ring-orange-100"
        />
        <HealthHubCard
          href="/insurance"
          label="BHYT"
          value={patient.insurance.status}
          icon={ShieldCheck}
          tone="bg-emerald-50 text-emerald-700 ring-emerald-100"
        />
        <HealthHubCard
          href="#abnormal-labs"
          label="Bất thường"
          value={`${abnormalLabs.length} chỉ số`}
          icon={FileText}
          tone={abnormalLabs.length ? "bg-amber-50 text-amber-800 ring-amber-100" : "bg-primary-50 text-primary-700 ring-primary-100"}
        />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-3">
        <InsightMetric label="Lượt khám phân tích" value={recentVisits.length} hint={`Tối đa ${maxVisitsForVitals} lần gần nhất`} />
        <InsightMetric label="Chỉ số có xu hướng" value={allTrends.length} hint="Có từ 2 lần đo hoặc có bất thường" />
        <InsightMetric label="XN bất thường" value={abnormalLabs.length} hint="Chạm để xem theo lượt khám" tone={abnormalLabs.length ? "warn" : "ok"} href="#abnormal-labs" />
      </section>

      <Panel className="mt-4">
        <SectionHeader title="Chức năng sống" meta={`${vitalTrends.length} biểu đồ`} />
        {vitalTrends.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {vitalTrends.map((series) => (
              <TrendCard key={series.key} series={series} />
            ))}
          </div>
        ) : (
          <EmptyState text="Chưa có đủ dữ liệu chức năng sống để vẽ xu hướng. Hệ thống sẽ tự cập nhật khi snapshot lần khám được đồng bộ." />
        )}
      </Panel>

      <Panel className="mt-4">
        <SectionHeader title="Xét nghiệm theo dõi" meta={`${labTrends.length} biểu đồ`} />
        {labTrends.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {labTrends.map((series) => (
              <TrendCard key={series.key} series={series} />
            ))}
          </div>
        ) : (
          <EmptyState text="Chưa có đủ dữ liệu xét nghiệm lặp lại để vẽ xu hướng." />
        )}
      </Panel>

      <Panel id="abnormal-labs" className="mt-4 scroll-mt-24">
        <SectionHeader title="Chỉ số cần lưu ý gần đây" meta={`${abnormalLabs.length} chỉ số`} />
        {abnormalGroups.length ? <AbnormalLabList groups={abnormalGroups} /> : <EmptyState text="Chưa ghi nhận chỉ số xét nghiệm bất thường trong dữ liệu gần đây." />}
      </Panel>
    </>
  );
}

function HealthHubCard({
  href,
  label,
  value,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="group relative min-h-[92px] rounded-xl border border-cream-200 bg-white/86 p-2.5 shadow-[0_10px_24px_rgba(7,60,57,0.055)] transition hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50 sm:min-h-[104px] sm:rounded-2xl sm:p-3"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-md ring-1 ${tone}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="mt-2 text-sm font-black leading-4 text-ink">{label}</p>
      <p className="clinical-mono mt-1 line-clamp-1 text-xs font-semibold leading-4 text-slate-500">{value}</p>
      <ArrowRight aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-700" />
    </Link>
  );
}

function InsightMetric({ label, value, hint, tone = "ok", href }: { label: string; value: number; hint: string; tone?: "ok" | "warn"; href?: string }) {
  const content = (
    <Panel className={tone === "warn" ? "border-amber-200 bg-amber-50" : "border-primary-100 bg-primary-50/80"}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-white text-primary-700"}`}>
          <Activity aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <p className="clinical-mono text-2xl font-black leading-6 text-ink">{value}</p>
          <p className="mt-1 text-sm font-black text-ink">{label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{hint}</p>
        </div>
      </div>
    </Panel>
  );

  if (!href) return content;

  return (
    <a href={href} className="block rounded-md outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50">
      {content}
    </a>
  );
}

function TrendCard({ series }: { series: TrendSeries }) {
  return (
    <section className="rounded-md border border-cream-200 bg-white/85 p-3 shadow-[0_8px_22px_rgba(7,60,57,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-base font-black text-ink">{series.label}</p>
          <p className="clinical-mono mt-1 text-xs font-semibold text-slate-500">{series.points.length} lần ghi nhận</p>
        </div>
        <Badge tone={series.abnormalCount > 0 ? "amber" : "green"}>{series.abnormalCount > 0 ? `${series.abnormalCount} lưu ý` : "Ổn định"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_126px] items-center gap-3">
        <Sparkline points={series.points} abnormal={series.abnormalCount > 0} />
        <div className="text-right">
          <p className="clinical-mono text-lg font-black text-ink">{series.latestValue}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{series.latestDate ? formatDate(series.latestDate) : "Chưa ghi nhận"}</p>
        </div>
      </div>
      <Link href={series.kind === "lab" ? "/lab-results" : "/visits"} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-primary-700 hover:text-primary-900">
        Xem dữ liệu nguồn
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function Sparkline({ points, abnormal }: { points: TrendSeries["points"]; abnormal: boolean }) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 126;
  const height = 48;
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = max === min ? height / 2 : height - ((point.value - min) / (max - min)) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible" role="img" aria-label="Biểu đồ xu hướng">
      <path d="M 0 44 L 126 44" stroke="#eadfce" strokeWidth="1" />
      <path d={path} fill="none" stroke={abnormal ? "#d97706" : "#007c73"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {points.map((point, index) => {
        const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
        const y = max === min ? height / 2 : height - ((point.value - min) / (max - min)) * (height - 8) - 4;
        return <circle key={`${point.date}-${index}`} cx={x} cy={y} r={isAbnormalLabFlag(point.flag) ? 4 : 3} fill={isAbnormalLabFlag(point.flag) ? "#e11d48" : "#007c73"} stroke="#fff" strokeWidth="2" />;
      })}
    </svg>
  );
}

interface AbnormalLabOrderGroup {
  key: string;
  visitId: string;
  visitDate: string;
  departmentName: string;
  serviceName: string;
  performedAt: string;
  items: LabResult[];
}

function AbnormalLabList({ groups }: { groups: AbnormalLabOrderGroup[] }) {
  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <details key={group.key} className="group overflow-hidden rounded-md border border-cream-200 bg-white/85 shadow-[0_8px_22px_rgba(7,60,57,0.045)]" open={index === 0}>
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-black text-ink">
                <TestTube2 aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-700" />
                <span className="truncate">{group.serviceName}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                <span className="clinical-mono inline-flex items-center gap-1">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  {formatDate(group.performedAt || group.visitDate)}
                </span>
                {group.departmentName ? <span>{group.departmentName}</span> : null}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2">
              <Badge tone="amber">{group.items.length} bất thường</Badge>
              <ArrowRight aria-hidden="true" className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
            </span>
          </summary>
          <div className="divide-y divide-cream-200 border-t border-cream-200">
            {group.items.map((item) => (
              <div key={item.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-black leading-6 text-ink">{item.testName}</p>
                  <p className="clinical-mono mt-1 text-xs font-semibold text-slate-500">Tham chiếu: {item.referenceRange || "Không có tham chiếu"}</p>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="clinical-mono inline-flex items-center gap-1 font-black text-rose-800">
                    <LabFlagIcon flag={item.flag} />
                    {item.result} {item.unit}
                  </span>
                  <Badge tone="amber">{item.flag}</Badge>
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
      <Link href="/lab-results" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 text-sm font-black text-primary-800 hover:bg-primary-100">
        Mở toàn bộ phiếu xét nghiệm
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}

function LabFlagIcon({ flag }: { flag: LabResult["flag"] | string }) {
  const direction = labFlagDirection(flag);
  if (direction === "high") return <ArrowUp aria-hidden="true" className="h-4 w-4 text-rose-700" />;
  if (direction === "low") return <ArrowDown aria-hidden="true" className="h-4 w-4 text-sky-700" />;
  return <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-700" />;
}

function groupAbnormalLabsByVisit(results: LabResult[], visits: Visit[]): AbnormalLabOrderGroup[] {
  const visitMap = new Map(visits.map((visit) => [visit.id, visit]));
  const groupMap = new Map<string, AbnormalLabOrderGroup>();

  for (const item of results) {
    const visit = visitMap.get(item.visitId);
    const performedKey = item.performedAt ? item.performedAt.slice(0, 16) : "";
    const serviceName = item.serviceName?.trim() || "Phiếu xét nghiệm";
    const key = `${item.visitId}:${serviceName}:${performedKey}`;
    const group =
      groupMap.get(key) ??
      ({
        key,
        visitId: item.visitId,
        visitDate: visit?.visitDate ?? item.performedAt,
        departmentName: visit?.departmentName ?? "",
        serviceName,
        performedAt: item.performedAt,
        items: [],
      } satisfies AbnormalLabOrderGroup);

    group.items.push(item);
    groupMap.set(key, group);
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((first, second) => first.testName.localeCompare(second.testName, "vi")),
    }))
    .sort((first, second) => new Date(second.performedAt || second.visitDate).getTime() - new Date(first.performedAt || first.visitDate).getTime());
}
