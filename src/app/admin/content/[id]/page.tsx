import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarClock, Eye } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { ContentPostEditor } from "@/app/admin/content/content-admin-client";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import { getAdminContentPost } from "@/lib/admin/modules";
import { canAdminAccessPath, getAdminSession } from "@/lib/admin/session";

export default async function AdminContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/content")) redirect("/admin");

  const { id } = await params;
  const { post, categories, warnings } = await getAdminContentPost(id);
  if (!post) notFound();

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Chi tiết bài viết"
        title={post.title || "Bài viết chưa có tiêu đề"}
        description="Xem trạng thái xuất bản, preview nhanh và chỉnh sửa nội dung Cẩm nang sức khỏe."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/content" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Danh sách
            </Link>
            {post.status === "published" && post.slug ? (
              <Link href={`/health-guide/${post.slug}`} className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
                <BookOpen aria-hidden="true" className="h-4 w-4" />
                Xem ngoài portal
              </Link>
            ) : null}
            <ContentPostEditor post={post} categories={categories} />
          </div>
        }
      />

      {warnings.length > 0 && (
        <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">Một số dữ liệu chưa sẵn sàng</p>
          <ul className="mt-2 list-inside list-disc">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-3 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
          <Info label="Slug" value={post.slug || "chưa có"} mono />
          <Info label="Chuyên mục" value={post.categoryName || post.category || "Chưa phân loại"} />
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Trạng thái</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <AdminStatusBadge status={post.status} />
              {post.isFeatured && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-900">Nổi bật dashboard</span>}
            </div>
          </div>
          <Info label="Cập nhật" value={post.updatedAt || post.createdAt || "Chưa ghi nhận"} mono />
          <Info label="Xuất bản" value={post.publishedAt || "Chưa xuất bản"} mono />
        </aside>

        <article className="overflow-hidden rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
          {post.coverImageUrl ? (
            <div className="relative h-56 bg-cover bg-center" style={{ backgroundImage: `url(${post.coverImageUrl})` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-primary-950/65 via-primary-950/15 to-transparent" />
            </div>
          ) : null}
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-primary-800">
                <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                Preview
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-cream-100 px-2 py-1 text-slate-600">
                <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                {post.categoryName || post.category || "Chuyên mục"}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-black leading-tight text-ink">{post.title}</h1>
            {post.excerpt && <p className="mt-3 text-base font-semibold leading-7 text-slate-600">{post.excerpt}</p>}
            <div className="mt-5 space-y-4 text-sm font-semibold leading-7 text-slate-700">
              {(post.body || post.excerpt || "Chưa có nội dung.")
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={`${paragraph.slice(0, 28)}-${index}`} className="whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
            </div>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-black text-ink ${mono ? "clinical-mono" : ""}`}>{value}</p>
    </div>
  );
}
