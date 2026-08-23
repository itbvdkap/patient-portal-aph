import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { HealthGuideArticleCard } from "@/components/health-guide-article";
import { PageHeader, Panel, SectionHeader } from "@/components/ui";
import { getHealthGuidePosts, serviceHighlights } from "@/lib/content/health-guide";

export default async function HealthGuidePage() {
  const posts = await getHealthGuidePosts();

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
        <SectionHeader title="Bài viết cẩm nang" meta={`${posts.length} bài`} />
        <div className="grid gap-3">
          {posts.map((post) => (
            <HealthGuideArticleCard key={post.slug} post={post} />
          ))}
        </div>
      </Panel>
    </>
  );
}
