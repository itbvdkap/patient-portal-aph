import Link from "next/link";
import {
  BadgeDollarSign,
  Building2,
  CircleHelp,
  Clock3,
  ExternalLink,
  Hospital,
  ListChecks,
  MapPinned,
  MessageCircle,
  Navigation,
  PhoneCall,
  Stethoscope,
} from "lucide-react";
import { Badge, PageHeader, Panel, SectionHeader } from "@/components/ui";
import {
  hospitalBranches,
  hospitalEmail,
  hospitalFaqs,
  hospitalHotlines,
  hospitalServicesUrl,
  hospitalSpecialties,
  hospitalWebsiteUrl,
  hospitalWorkingHours,
  hospitalZaloUrl,
} from "@/lib/content/hospital-info";

const quickLinks = [
  { href: "#gioi-thieu", label: "Giới thiệu", icon: Hospital },
  { href: "#chuyen-khoa", label: "Chuyên khoa", icon: Stethoscope },
  { href: "#dich-vu", label: "Dịch vụ", icon: BadgeDollarSign },
  { href: "#huong-dan", label: "Đi khám", icon: ListChecks },
  { href: "#dia-chi", label: "Bản đồ", icon: MapPinned },
  { href: "#faq", label: "FAQ", icon: CircleHelp },
];

export default function HospitalInfoPage() {
  return (
    <>
      <PageHeader
        title="Thông tin bệnh viện"
        description="Thông tin nhanh về Bệnh viện Đa khoa An Phú, chuyên khoa, giờ làm việc, địa chỉ, hotline và các hướng dẫn cần trước khi đi khám."
        actions={
          <Link
            href="/booking"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary-700 px-3 text-sm font-bold text-white shadow-sm hover:bg-primary-900"
          >
            Đăng ký khám
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      />

      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {quickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-md border border-cream-200 bg-cream-50 px-2 text-center text-xs font-black text-ink shadow-[0_8px_18px_rgba(7,60,57,0.045)] transition hover:border-primary-200 hover:bg-primary-50"
            >
              <Icon aria-hidden="true" className="h-5 w-5 text-primary-700" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </section>

      <Panel id="gioi-thieu" className="mt-4 scroll-mt-24 overflow-hidden bg-primary-900 p-0 text-white">
        <div className="bg-[linear-gradient(135deg,rgba(0,91,85,0.96),rgba(7,60,57,0.96)),repeating-linear-gradient(135deg,rgba(255,255,255,0.12)_0_1px,transparent_1px_14px)] p-4 sm:p-5">
          <Badge tone="green">An Phú Care</Badge>
          <h2 className="mt-3 font-serif text-2xl font-black leading-8">Bệnh viện Đa khoa An Phú</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
            Trang này gom các thông tin cần tra cứu nhanh khi đi khám: chuyên khoa, giờ làm việc, địa chỉ chi nhánh, hotline, Zalo và hướng dẫn chuẩn bị hồ sơ.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <a href={hospitalWebsiteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-white/12 px-3 text-sm font-black text-white ring-1 ring-white/20 hover:bg-white/18">
              Website
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
            <a href={hospitalZaloUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-white/12 px-3 text-sm font-black text-white ring-1 ring-white/20 hover:bg-white/18">
              Zalo hỗ trợ
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
            </a>
            <a href={`mailto:${hospitalEmail}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-white/12 px-3 text-sm font-black text-white ring-1 ring-white/20 hover:bg-white/18">
              Email
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Panel>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <Panel id="chuyen-khoa" className="scroll-mt-24">
          <SectionHeader title="Chuyên khoa" meta={`${hospitalSpecialties.length} mục`} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {hospitalSpecialties.map((specialty) => (
              <span key={specialty} className="rounded-md border border-primary-100 bg-primary-50 px-3 py-2 text-sm font-bold text-primary-900">
                {specialty}
              </span>
            ))}
          </div>
        </Panel>

        <Panel id="gio-lam-viec" className="scroll-mt-24">
          <SectionHeader title="Giờ làm việc" />
          <div className="space-y-2">
            {hospitalWorkingHours.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-md border border-cream-200 bg-cream-100/60 p-3">
                <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                <div>
                  <p className="text-sm font-black text-ink">{item.label}</p>
                  <p className="clinical-mono mt-0.5 text-sm font-semibold text-slate-700">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel id="dich-vu" className="mt-4 scroll-mt-24">
        <SectionHeader title="Bảng giá / dịch vụ" />
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoAction
            icon={BadgeDollarSign}
            title="Tra cứu dịch vụ"
            description="Mở trang dịch vụ chính thức để xem thông tin dịch vụ và bảng giá tham khảo."
            href={hospitalServicesUrl}
            external
          />
          <InfoAction
            icon={Stethoscope}
            title="Đăng ký khám"
            description="Đăng ký trong app để dùng hồ sơ đã liên kết, hoặc mở form đăng ký trên website bệnh viện."
            href="/booking"
          />
        </div>
        <p className="mt-3 rounded-md bg-cream-100 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
          Chi phí thực tế có thể thay đổi theo chỉ định bác sĩ, quyền lợi BHYT và tình trạng hồ sơ. Anh/chị nên liên hệ hotline để xác nhận khi cần.
        </p>
      </Panel>

      <Panel id="huong-dan" className="mt-4 scroll-mt-24">
        <SectionHeader title="Hướng dẫn đi khám" />
        <ol className="grid gap-2 sm:grid-cols-2">
          {[
            "Chuẩn bị CCCD/CMND, thẻ BHYT nếu có và kết quả khám cũ.",
            "Đăng ký trước trong app hoặc qua website để bệnh viện tiếp nhận thông tin.",
            "Đến đúng chi nhánh/phòng khám đã chọn và theo dõi Khám hôm nay trong app.",
            "Sau khi bác sĩ chỉ định, xem xét nghiệm, CĐHA, đơn thuốc và lịch hẹn tái khám trong hồ sơ.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3 rounded-md border border-cream-200 bg-cream-100/60 p-3">
              <span className="clinical-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-700 text-xs font-black text-white">
                {index + 1}
              </span>
              <span className="text-sm font-semibold leading-6 text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel id="dia-chi" className="mt-4 scroll-mt-24">
        <SectionHeader title="Địa chỉ / bản đồ" meta={`${hospitalBranches.length} cơ sở`} />
        <div className="grid gap-3">
          {hospitalBranches.map((branch) => (
            <div key={branch.name} className="rounded-md border border-cream-200 bg-cream-100/60 p-3">
              <div className="flex items-start gap-3">
                <Building2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-black text-ink">{branch.name}</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{branch.address}</p>
                </div>
              </div>
              <a href={branch.mapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-primary-100 bg-white px-3 text-sm font-black text-primary-800 hover:bg-primary-50">
                Mở bản đồ
                <Navigation aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </Panel>

      <Panel id="hotline" className="mt-4 scroll-mt-24">
        <SectionHeader title="Hotline / Zalo" />
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={hospitalZaloUrl} target="_blank" rel="noreferrer" className="flex min-h-16 flex-col justify-center rounded-md border border-sky-100 bg-sky-50 px-3 text-sky-700 hover:bg-sky-100">
            <span className="clinical-mono text-base font-black">Zalo</span>
            <span className="mt-1 text-xs font-bold">Chat hỗ trợ trực tuyến</span>
          </a>
          {hospitalHotlines.map((item) => (
            <a
              key={`${item.label}-${item.number}`}
              href={`tel:${item.number}`}
              className={`flex min-h-16 flex-col justify-center rounded-md border px-3 transition ${
                item.urgent
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "border-cream-200 bg-white/70 text-ink hover:border-primary-200 hover:bg-primary-50"
              }`}
            >
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${item.urgent ? "uppercase text-rose-600" : "text-slate-500"}`}>
                <PhoneCall aria-hidden="true" className="h-3.5 w-3.5" />
                {item.label}
              </span>
              <span className="clinical-mono mt-1 text-base font-black">{item.display}</span>
            </a>
          ))}
        </div>
      </Panel>

      <Panel id="faq" className="mt-4 scroll-mt-24">
        <SectionHeader title="Câu hỏi thường gặp" />
        <div className="divide-y divide-cream-200">
          {hospitalFaqs.map((faq) => (
            <details key={faq.question} className="group py-3 first:pt-0 last:pb-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-ink">
                {faq.question}
                <CircleHelp aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-700" />
              </summary>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </Panel>
    </>
  );
}

function InfoAction({
  icon: Icon,
  title,
  description,
  href,
  external,
}: {
  icon: typeof Hospital;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  const className = "group block rounded-md border border-cream-200 bg-cream-100/60 p-3 transition hover:border-primary-200 hover:bg-primary-50";
  const content = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-700 ring-1 ring-primary-100">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-sm font-black text-ink">{title}</h2>
      <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-black text-primary-700">
        Mở
        <ExternalLink aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </>
  );

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
