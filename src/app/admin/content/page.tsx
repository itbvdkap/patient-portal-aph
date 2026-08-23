import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BookOpen, RotateCcw } from "lucide-react";
import { AdminPageHeader, AdminShell } from "@/app/admin/admin-shell";
import { ContentActions, ContentPagination, ContentPostList, ContentToolbar } from "@/app/admin/content/content-admin-client";
import { getAdminContent, type AdminContentQuery } from "@/lib/admin/modules";
import { canAdminAccessPath, canAdminPerformAction, getAdminSession } from "@/lib/admin/session";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = getAdminSession(await cookies());
  if (!session) redirect("/admin/login");
  if (!canAdminAccessPath(session.role, "/admin/content")) redirect("/admin");

  const rawParams = await searchParams;
  const query = parseContentQuery(rawParams);
  const data = await getAdminContent(query);
  const canPublish = canAdminPerformAction(session.role, "publish_content") || canAdminPerformAction(session.role, "archive_content");

  return (
    <AdminShell username={session.username} role={session.role}>
      <AdminPageHeader
        eyebrow="Nội dung"
        title="Cẩm nang sức khỏe"
        description="Quản lý bài viết hướng dẫn bệnh nhân: tạo/sửa nội dung, phân chuyên mục, bật nổi bật, preview và xuất bản hoặc lưu trữ."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/health-guide" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              Xem portal
            </Link>
            <Link href="/admin/content" className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Xóa lọc
            </Link>
          </div>
        }
      />

      {data.warnings.length > 0 && (
        <section className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">Một số dữ liệu chưa sẵn sàng</p>
          <ul className="mt-2 list-inside list-disc">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-5 flex flex-col gap-3 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-ink">Thư viện nội dung</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            <span className="clinical-mono font-black text-ink">{data.total}</span> bài viết · <span className="clinical-mono font-black text-ink">{data.categories.length}</span> chuyên mục
          </p>
        </div>
        <ContentActions categories={data.categories} />
      </section>

      <ContentToolbar data={data} rawParams={rawParams} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">
          Hiển thị <span className="clinical-mono text-ink">{data.posts.length}</span> / <span className="clinical-mono text-ink">{data.total}</span> bài viết
        </p>
        <p className="clinical-mono text-xs font-black text-slate-500">
          Trang {data.page}/{data.pageCount}
        </p>
      </div>

      <ContentPostList posts={data.posts} categories={data.categories} canPublish={canPublish} />
      <ContentPagination page={data.page} pageCount={data.pageCount} rawParams={rawParams} />
    </AdminShell>
  );
}

function parseContentQuery(params: SearchParams): AdminContentQuery {
  return {
    q: first(params.q),
    status: first(params.status),
    category: first(params.category),
    featured: first(params.featured),
    page: toNumber(first(params.page), 1),
    pageSize: toNumber(first(params.pageSize), 20),
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
