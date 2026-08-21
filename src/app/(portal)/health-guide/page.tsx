import Link from "next/link";
import { ArrowRight, Clock3, ExternalLink } from "lucide-react";
import { Badge, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { healthGuidePosts, serviceHighlights } from "@/lib/content/health-guide";

export default function HealthGuidePage() {
  return (
    <>
      <PageHeader
        title="Cẩm nang sức khỏe"
        description="Các hướng dẫn ngắn giúp người bệnh chuẩn bị trước khi đi khám, làm xét nghiệm, dùng BHYT và theo dõi kết quả."
        actions={
          <Link
            href="/booking"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary-600 px-3 text-sm font-bold text-white shadow-sm hover:bg-primary-700"
          >
            Đăng ký khám
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      />

      <section className="grid gap-2.5 sm:grid-cols-3">
        {serviceHighlights.map((service) => {
          const Icon = service.icon;

          return (
            <Panel key={service.title} className="shadow-none">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-sm font-black leading-5 text-ink">{service.title}</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{service.summary}</p>
            </Panel>
          );
        })}
      </section>

      <Panel className="mt-4">
        <SectionHeader title="Bài viết mẫu" meta={`${healthGuidePosts.length} bài`} />
        <div className="grid gap-3">
          {healthGuidePosts.map((post) => {
            const Icon = post.icon;

            return (
              <article key={post.slug} id={post.slug} className="scroll-mt-24 rounded-md border border-cream-200 bg-cream-100/60 p-3">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ring-1 ${post.tone}`}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="slate">{post.category}</Badge>
                      <span className="clinical-mono inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                        <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                        {post.readMinutes} phút đọc
                      </span>
                    </div>
                    <h2 className="mt-2 font-serif text-lg font-black leading-6 text-ink">{post.title}</h2>
                    <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{post.summary}</p>
                  </div>
                </div>

                <ul className="mt-3 space-y-2">
                  {post.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-sm font-medium leading-6 text-slate-700">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <Link href={post.ctaHref} className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-primary-700 hover:text-primary-800">
                  {post.ctaLabel}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
