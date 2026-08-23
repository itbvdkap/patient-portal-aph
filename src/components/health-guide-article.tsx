import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import type { HealthGuidePost } from "@/lib/content/health-guide";

export function HealthGuideArticleCard({ post, compact = false }: { post: HealthGuidePost; compact?: boolean }) {
  const Icon = post.icon;

  return (
    <article
      id={post.slug}
      className="scroll-mt-24 overflow-hidden rounded-md border border-cream-200 shadow-[0_8px_18px_rgba(7,60,57,0.045)]"
      style={{ background: post.coverImageUrl ? undefined : post.background }}
    >
      {post.coverImageUrl ? (
        <div className="relative h-32 bg-cover bg-center sm:h-40" style={{ backgroundImage: `url(${post.coverImageUrl})` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-primary-950/65 via-primary-950/12 to-transparent" />
          <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-xs font-bold text-slate-700">{post.category}</span>
        </div>
      ) : null}
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ring-1 ${post.tone}`}>
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {!post.coverImageUrl && <Badge tone="slate">{post.category}</Badge>}
              <span className="clinical-mono inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                {post.readMinutes} phút đọc
              </span>
            </div>
            <h2 className={`${compact ? "mt-1 text-base" : "mt-2 text-lg"} font-serif font-black leading-6 text-ink`}>{post.title}</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{post.summary}</p>
          </div>
        </div>

        {!compact && (
          <ul className="mt-3 space-y-2">
            {post.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-sm font-medium leading-6 text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        <Link href={`/health-guide/${post.slug}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-primary-700 hover:text-primary-800">
          Xem chi tiết
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export function HealthGuideArticleView({ post, backHref = "/health-guide" }: { post: HealthGuidePost; backHref?: string }) {
  const paragraphs = (post.body || post.summary)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <article>
      <Link href={backHref} className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 text-sm font-black text-primary-800 hover:bg-primary-50">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Quay lại
      </Link>

      <Panel className="overflow-hidden p-0 sm:p-0">
        {post.coverImageUrl ? (
          <div className="relative h-48 bg-cover bg-center sm:h-64" style={{ backgroundImage: `url(${post.coverImageUrl})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950/70 via-primary-950/15 to-transparent" />
          </div>
        ) : (
          <div className="h-24" style={{ background: post.background }} />
        )}
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="slate">{post.category}</Badge>
            {post.featured && <Badge tone="amber">Nổi bật</Badge>}
            <span className="clinical-mono inline-flex items-center gap-1 text-xs font-bold text-slate-500">
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
              {post.readMinutes} phút đọc
            </span>
          </div>
          <h1 className="mt-3 font-serif text-3xl font-black leading-tight text-ink">{post.title}</h1>
          <p className="mt-3 text-base font-semibold leading-7 text-slate-600">{post.summary}</p>
          <div className="mt-5 space-y-4 text-sm font-semibold leading-7 text-slate-700">
            {paragraphs.map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 28)}-${index}`} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
          <Link href={post.ctaHref} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-black text-white hover:bg-primary-900">
            {post.ctaLabel}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </Panel>
    </article>
  );
}
