"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, Edit3, Eye, Filter, ImagePlus, Plus, Save, Search, Star, Tags, X } from "lucide-react";
import { AdminActionButton } from "@/app/admin/admin-action-button";
import { AdminStatusBadge } from "@/app/admin/admin-table";
import type { AdminContentCategory, AdminContentPost, AdminContentResult } from "@/lib/admin/modules";

type SearchParams = Record<string, string | string[] | undefined>;

export function ContentToolbar({ data, rawParams }: { data: AdminContentResult; rawParams: SearchParams }) {
  const tabs = [
    { label: "Tất cả", href: buildHref(rawParams, { status: "", featured: "", page: "1" }), active: !data.filters.status && !data.filters.featured },
    { label: "Nháp", href: buildHref(rawParams, { status: "draft", featured: "", page: "1" }), active: data.filters.status === "draft" },
    { label: "Đã xuất bản", href: buildHref(rawParams, { status: "published", featured: "", page: "1" }), active: data.filters.status === "published" },
    { label: "Nổi bật", href: buildHref(rawParams, { status: "", featured: "yes", page: "1" }), active: data.filters.featured === "yes" },
    { label: "Đã lưu trữ", href: buildHref(rawParams, { status: "archived", featured: "", page: "1" }), active: data.filters.status === "archived" },
  ];

  return (
    <section className="mb-5 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`rounded-md px-3 py-2 text-xs font-black transition ${
              tab.active ? "bg-primary-700 text-white" : "border border-cream-200 bg-cream-100 text-slate-700 hover:bg-primary-50 hover:text-primary-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form action="/admin/content" className="grid gap-3 lg:grid-cols-[1.4fr_180px_140px_120px_auto] lg:items-end">
        <label className="block text-sm font-bold text-ink">
          Tìm kiếm
          <span className="mt-2 flex items-center gap-2 rounded-md border border-cream-200 bg-white px-3 py-2.5 ring-primary-100 focus-within:ring-4">
            <Search aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input name="q" defaultValue={data.filters.q} placeholder="Tiêu đề, slug, tóm tắt" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
          </span>
        </label>

        <Select name="category" label="Chuyên mục" value={data.filters.category} options={data.options.categories.map((item) => ({ value: item.id, label: item.name }))} allLabel="Tất cả" />
        <Select
          name="status"
          label="Trạng thái"
          value={data.filters.status}
          options={[
            { value: "draft", label: "Nháp" },
            { value: "published", label: "Đã xuất bản" },
            { value: "archived", label: "Lưu trữ" },
          ]}
          allLabel="Tất cả"
        />
        <Select name="pageSize" label="Số dòng" value={String(data.pageSize)} options={["10", "20", "50", "80"].map((value) => ({ value, label: value }))} allLabel="" />

        <input type="hidden" name="featured" value={data.filters.featured} />
        <input type="hidden" name="page" value="1" />
        <button className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-primary-900">
          <Filter aria-hidden="true" className="h-4 w-4" />
          Lọc
        </button>
      </form>
    </section>
  );
}

export function ContentActions({ categories }: { categories: AdminContentCategory[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ContentPostEditor categories={categories} />
      <ContentCategoryManager categories={categories} />
    </div>
  );
}

export function ContentPostList({
  posts,
  categories,
  canPublish,
}: {
  posts: AdminContentPost[];
  categories: AdminContentCategory[];
  canPublish: boolean;
}) {
  if (!posts.length) {
    return <p className="rounded-md border border-cream-200 bg-cream-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">Không có bài viết phù hợp bộ lọc.</p>;
  }

  return (
    <section className="overflow-hidden rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="hidden grid-cols-[1fr_150px_160px_220px] gap-3 border-b border-cream-200 bg-cream-100/70 px-4 py-3 text-xs font-black uppercase text-slate-500 lg:grid">
        <span>Bài viết</span>
        <span>Chuyên mục</span>
        <span>Trạng thái</span>
        <span>Cập nhật</span>
      </div>
      <div className="divide-y divide-cream-200">
        {posts.map((post) => (
          <article key={post.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_150px_160px_220px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/content/${post.id}`} className="break-words text-sm font-black text-ink underline-offset-4 hover:text-primary-800 hover:underline">
                  {post.title}
                </Link>
                {post.isFeatured && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-900"><Star aria-hidden="true" className="h-3 w-3 fill-current" /> Nổi bật</span>}
              </div>
              <p className="clinical-mono mt-1 break-words text-xs font-bold text-slate-500">{post.slug || "chua-co-slug"}</p>
              {post.excerpt && <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{post.excerpt}</p>}
            </div>
            <p className="text-xs font-black text-slate-700">{post.categoryName || "Chưa phân loại"}</p>
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge status={contentStatusLabel(post.status)} />
              {canPublish &&
                (post.status === "published" ? (
                  <AdminActionButton action="archive_content" label="Lưu trữ" target={{ postId: post.id }} tone="neutral" />
                ) : (
                  <AdminActionButton action="publish_content" label="Xuất bản" target={{ postId: post.id }} tone="primary" />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <p className="clinical-mono mr-auto text-xs font-bold text-slate-500 lg:mr-0">{post.updatedAt ? formatDate(post.updatedAt) : formatDate(post.createdAt)}</p>
              <ContentPreviewButton post={post} />
              <ContentPostEditor post={post} categories={categories} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContentPagination({ page, pageCount, rawParams }: { page: number; pageCount: number; rawParams: SearchParams }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-5 flex items-center justify-between gap-3">
      <Link
        href={buildHref(rawParams, { page: String(Math.max(1, page - 1)) })}
        aria-disabled={page <= 1}
        className={`rounded-md border border-cream-200 px-3 py-2 text-sm font-black ${page <= 1 ? "pointer-events-none bg-cream-100 text-slate-400" : "bg-cream-50 text-primary-800 hover:bg-primary-50"}`}
      >
        Trang trước
      </Link>
      <span className="clinical-mono text-xs font-black text-slate-500">
        {page}/{pageCount}
      </span>
      <Link
        href={buildHref(rawParams, { page: String(Math.min(pageCount, page + 1)) })}
        aria-disabled={page >= pageCount}
        className={`rounded-md border border-cream-200 px-3 py-2 text-sm font-black ${page >= pageCount ? "pointer-events-none bg-cream-100 text-slate-400" : "bg-cream-50 text-primary-800 hover:bg-primary-50"}`}
      >
        Trang sau
      </Link>
    </nav>
  );
}

export function ContentPostEditor({ post, categories }: { post?: AdminContentPost; categories: AdminContentCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(() => postToForm(post, categories));

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "post",
          id: post?.id ?? "",
          title: form.title,
          slug: form.slug,
          category: form.category,
          excerpt: form.excerpt,
          body: form.body,
          coverImageUrl: form.coverImageUrl,
          status: form.status,
          isFeatured: form.isFeatured,
          sortOrder: form.sortOrder,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Không lưu được bài viết.");
        return;
      }
      setMessage("Đã lưu bài viết.");
      router.refresh();
      if (!post) setForm(postToForm(undefined, categories));
    } catch {
      setMessage("Không kết nối được API nội dung.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Vui lòng chọn file ảnh.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Ảnh cover tối đa 2MB để tải nhanh trên điện thoại.");
      return;
    }

    setCoverUploading(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/content/upload-cover", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        setMessage(payload.error ?? "Không upload được ảnh cover.");
        return;
      }
      update("coverImageUrl", payload.url);
      setMessage("Đã upload ảnh cover. Nhấn Lưu nội dung để cập nhật bài viết.");
    } catch {
      setMessage("Không kết nối được API upload ảnh cover.");
    } finally {
      setCoverUploading(false);
      event.target.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-black shadow-sm transition ${
          post ? "border-cream-200 bg-cream-100 text-slate-700 hover:bg-white" : "border-primary-700 bg-primary-700 text-white hover:bg-primary-900"
        }`}
      >
        {post ? <Edit3 aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
        {post ? "Sửa" : "Tạo bài viết"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-5">
          <form onSubmit={submit} className="mx-auto w-full max-w-4xl rounded-md border border-cream-200 bg-cream-50 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-cream-200 p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary-700">Cẩm nang sức khỏe</p>
                <h2 className="font-serif text-2xl font-black text-ink">{post ? "Sửa bài viết" : "Tạo bài viết mới"}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-cream-200 bg-white p-2 text-slate-600 hover:text-ink">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-cream-200 px-4 pt-4">
              <div className="flex gap-2">
                {(["edit", "preview"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={`rounded-t-md px-3 py-2 text-sm font-black ${tab === item ? "bg-white text-primary-800" : "text-slate-500 hover:text-ink"}`}
                  >
                    {item === "edit" ? "Biên tập" : "Preview"}
                  </button>
                ))}
              </div>
            </div>

            {tab === "edit" ? (
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <label className="block text-sm font-bold text-ink lg:col-span-2">
                  Tiêu đề
                  <input value={form.title} onChange={(event) => update("title", event.target.value)} required className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 outline-none ring-primary-100 focus:ring-4" />
                </label>
                <label className="block text-sm font-bold text-ink">
                  Slug
                  <input value={form.slug} onChange={(event) => update("slug", slugify(event.target.value))} placeholder="tu-dong-tao-neu-de-trong" className="clinical-mono mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary-100 focus:ring-4" />
                </label>
                <label className="block text-sm font-bold text-ink">
                  Chuyên mục
                  <select value={form.category} onChange={(event) => update("category", event.target.value)} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 outline-none ring-primary-100 focus:ring-4">
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-bold text-ink">
                  Trạng thái
                  <select value={form.status} onChange={(event) => update("status", event.target.value)} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 outline-none ring-primary-100 focus:ring-4">
                    <option value="draft">Nháp</option>
                    <option value="published">Xuất bản</option>
                    <option value="archived">Lưu trữ</option>
                  </select>
                </label>
                <label className="block text-sm font-bold text-ink">
                  Thứ tự
                  <input type="number" min={0} max={9999} value={form.sortOrder} onChange={(event) => update("sortOrder", Number(event.target.value))} className="clinical-mono mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary-100 focus:ring-4" />
                </label>
                <label className="block text-sm font-bold text-ink lg:col-span-2">
                  Ảnh cover
                  <input value={form.coverImageUrl} onChange={(event) => update("coverImageUrl", event.target.value)} placeholder="https://..." className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 outline-none ring-primary-100 focus:ring-4" />
                  <span className="mt-2 flex flex-col gap-2 rounded-md border border-dashed border-primary-200 bg-primary-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-semibold leading-5 text-primary-900">Dán URL ảnh hoặc upload JPG/PNG/WebP/GIF tối đa 2MB vào Supabase Storage.</span>
                    <span className={`relative inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 text-xs font-black text-primary-800 ring-1 ring-primary-200 hover:bg-primary-50 ${coverUploading ? "pointer-events-none opacity-70" : ""}`}>
                      <ImagePlus aria-hidden="true" className="h-4 w-4" />
                      {coverUploading ? "Đang upload..." : "Upload ảnh"}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseCover} className="absolute inset-0 cursor-pointer opacity-0" disabled={coverUploading} />
                    </span>
                  </span>
                  {form.coverImageUrl && <span className="mt-2 block h-32 rounded-md border border-cream-200 bg-cover bg-center" style={{ backgroundImage: `url(${form.coverImageUrl})` }} />}
                </label>
                <label className="block text-sm font-bold text-ink lg:col-span-2">
                  Tóm tắt
                  <textarea value={form.excerpt} onChange={(event) => update("excerpt", event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-md border border-cream-200 bg-white px-3 py-2.5 leading-6 outline-none ring-primary-100 focus:ring-4" />
                </label>
                <label className="block text-sm font-bold text-ink lg:col-span-2">
                  Nội dung
                  <textarea value={form.body} onChange={(event) => update("body", event.target.value)} rows={10} className="mt-2 w-full resize-y rounded-md border border-cream-200 bg-white px-3 py-2.5 leading-6 outline-none ring-primary-100 focus:ring-4" />
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-black text-ink">
                  <input type="checkbox" checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} className="h-4 w-4 rounded border-cream-300 text-primary-700" />
                  Bật nổi bật trên dashboard
                </label>
              </div>
            ) : (
              <ArticlePreview form={form} categories={categories} />
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-cream-200 p-4 sm:flex-row sm:items-center sm:justify-end">
              {message && <p className={`mr-auto rounded-md px-3 py-2 text-xs font-bold ${message.includes("Không") ? "bg-rose-50 text-rose-700" : "bg-primary-50 text-primary-800"}`}>{message}</p>}
              <button type="button" onClick={() => setOpen(false)} disabled={loading} className="rounded-md border border-cream-200 bg-cream-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-white disabled:opacity-60">
                Đóng
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-black text-white hover:bg-primary-900 disabled:cursor-wait disabled:bg-slate-300">
                <Save aria-hidden="true" className="h-4 w-4" />
                {loading ? "Đang lưu..." : "Lưu nội dung"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ContentPreviewButton({ post }: { post: AdminContentPost }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-100 px-3 py-2 text-sm font-black text-slate-700 hover:bg-white">
        <Eye aria-hidden="true" className="h-4 w-4" />
        Preview
      </button>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-5">
          <div className="mx-auto w-full max-w-3xl rounded-md border border-cream-200 bg-cream-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-cream-200 p-4">
              <h2 className="font-serif text-2xl font-black text-ink">Preview bài viết</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-cream-200 bg-white p-2 text-slate-600 hover:text-ink">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <ArticlePreview form={postToForm(post, [])} categories={[]} />
          </div>
        </div>
      )}
    </>
  );
}

function ContentCategoryManager({ categories }: { categories: AdminContentCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminContentCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(() => categoryToForm(null));

  function edit(category: AdminContentCategory | null) {
    setEditing(category);
    setForm(categoryToForm(category));
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "category",
          id: form.id,
          name: form.name,
          description: form.description,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Không lưu được chuyên mục.");
        return;
      }
      setMessage("Đã lưu chuyên mục.");
      edit(null);
      router.refresh();
    } catch {
      setMessage("Không kết nối được API nội dung.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-sm font-black text-primary-800 shadow-sm hover:bg-primary-50">
        <Tags aria-hidden="true" className="h-4 w-4" />
        Chuyên mục
      </button>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-5">
          <div className="mx-auto grid w-full max-w-4xl gap-4 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-2xl lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-primary-700">CMS</p>
                  <h2 className="font-serif text-2xl font-black text-ink">Chuyên mục</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-cream-200 bg-white p-2 text-slate-600 hover:text-ink">
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 divide-y divide-cream-200 overflow-hidden rounded-md border border-cream-200 bg-white">
                {categories.map((category) => (
                  <button key={category.id} type="button" onClick={() => edit(category)} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-primary-50">
                    <span>
                      <span className="block text-sm font-black text-ink">{category.name}</span>
                      <span className="clinical-mono block text-xs font-bold text-slate-500">{category.id}</span>
                    </span>
                    <AdminStatusBadge status={category.isActive ? "Đang dùng" : "Tạm ẩn"} />
                  </button>
                ))}
              </div>
            </div>
            <form onSubmit={submit} className="rounded-md border border-cream-200 bg-white p-4">
              <h3 className="font-serif text-xl font-black text-ink">{editing ? "Sửa chuyên mục" : "Thêm chuyên mục"}</h3>
              <label className="mt-4 block text-sm font-bold text-ink">
                Mã chuyên mục
                <input value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: slugify(event.target.value) }))} placeholder="tu-dong-tao-neu-de-trong" className="clinical-mono mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary-100 focus:ring-4" />
              </label>
              <label className="mt-4 block text-sm font-bold text-ink">
                Tên chuyên mục
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 outline-none ring-primary-100 focus:ring-4" />
              </label>
              <label className="mt-4 block text-sm font-bold text-ink">
                Mô tả
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-2 w-full resize-none rounded-md border border-cream-200 bg-white px-3 py-2.5 outline-none ring-primary-100 focus:ring-4" />
              </label>
              <label className="mt-4 block text-sm font-bold text-ink">
                Thứ tự
                <input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className="clinical-mono mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary-100 focus:ring-4" />
              </label>
              <label className="mt-4 inline-flex items-center gap-2 text-sm font-black text-ink">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-cream-300 text-primary-700" />
                Đang sử dụng
              </label>
              {message && <p className={`mt-3 rounded-md px-3 py-2 text-xs font-bold ${message.includes("Không") ? "bg-rose-50 text-rose-700" : "bg-primary-50 text-primary-800"}`}>{message}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-black text-white hover:bg-primary-900 disabled:cursor-wait disabled:bg-slate-300">
                  <Save aria-hidden="true" className="h-4 w-4" />
                  {loading ? "Đang lưu..." : "Lưu chuyên mục"}
                </button>
                {editing && (
                  <button type="button" onClick={() => edit(null)} className="rounded-md border border-cream-200 bg-cream-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-white">
                    Tạo mới
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function ArticlePreview({
  form,
  categories,
}: {
  form: ReturnType<typeof postToForm>;
  categories: AdminContentCategory[];
}) {
  const categoryName = useMemo(() => categories.find((category) => category.id === form.category)?.name ?? form.category, [categories, form.category]);
  const paragraphs = (form.body || form.excerpt || "Chưa có nội dung preview.").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return (
    <article className="p-4">
      <div className="overflow-hidden rounded-md border border-cream-200 bg-cream-50 shadow-[0_8px_18px_rgba(7,60,57,0.045)]">
        {form.coverImageUrl ? (
          <div className="relative h-52 bg-cover bg-center" style={{ backgroundImage: `url(${form.coverImageUrl})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950/70 via-primary-950/15 to-transparent" />
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center bg-primary-50 text-primary-700">
            <BookOpenText aria-hidden="true" className="h-8 w-8" />
          </div>
        )}
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-black text-primary-800">{categoryName || "Chuyên mục"}</span>
            {form.isFeatured && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-900">Nổi bật</span>}
            <span className="rounded-md bg-cream-100 px-2 py-1 text-xs font-black text-slate-600">{contentStatusLabel(form.status)}</span>
          </div>
          <h1 className="font-serif text-3xl font-black leading-tight text-ink">{form.title || "Tiêu đề bài viết"}</h1>
          {form.excerpt && <p className="mt-3 text-base font-semibold leading-7 text-slate-600">{form.excerpt}</p>}
          <div className="mt-5 space-y-4 text-sm font-semibold leading-7 text-slate-700">
            {paragraphs.map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 24)}-${index}`} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function Select({
  name,
  label,
  value,
  options,
  allLabel,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <label className="block text-sm font-bold text-ink">
      {label}
      <select name={name} defaultValue={value} className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none ring-primary-100 focus:ring-4">
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildHref(rawParams: SearchParams, updates: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else if (value) {
      params.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const text = params.toString();
  return text ? `/admin/content?${text}` : "/admin/content";
}

function postToForm(post: AdminContentPost | undefined, categories: AdminContentCategory[]) {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    category: post?.category || categories[0]?.id || "huong-dan-kham",
    excerpt: post?.excerpt ?? "",
    body: post?.body ?? "",
    coverImageUrl: post?.coverImageUrl ?? "",
    status: post?.status ?? "draft",
    isFeatured: post?.isFeatured ?? false,
    sortOrder: post?.sortOrder ?? 0,
  };
}

function categoryToForm(category: AdminContentCategory | null) {
  return {
    id: category?.id ?? "",
    name: category?.name ?? "",
    description: category?.description ?? "",
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
  };
}

function contentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Nháp",
    published: "Đã xuất bản",
    archived: "Lưu trữ",
  };
  return labels[status] ?? status;
}

function formatDate(value: string) {
  if (!value) return "Chưa ghi nhận";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
