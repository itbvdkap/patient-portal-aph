import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAdminAccessPath, getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const postSchema = z.object({
  kind: z.literal("post").default("post"),
  id: z.string().trim().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Vui lòng nhập tiêu đề."),
  slug: z.string().trim().optional().default(""),
  category: z.string().trim().min(1, "Vui lòng chọn chuyên mục."),
  excerpt: z.string().trim().max(500, "Tóm tắt không nên quá 500 ký tự.").optional().default(""),
  body: z.string().trim().max(20000, "Nội dung quá dài.").optional().default(""),
  coverImageUrl: z.string().trim().optional().default(""),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isFeatured: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
});

const categorySchema = z.object({
  kind: z.literal("category"),
  id: z.string().trim().optional().default(""),
  name: z.string().trim().min(2, "Vui lòng nhập tên chuyên mục."),
  description: z.string().trim().max(500).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const schema = z.discriminatedUnion("kind", [postSchema, categorySchema]);

export async function POST(request: Request) {
  const session = getAdminSession(await cookies());
  if (!session) {
    return NextResponse.json({ error: "Phiên quản trị đã hết hạn." }, { status: 401 });
  }
  if (!canAdminAccessPath(session.role, "/admin/content")) {
    return NextResponse.json({ error: "Tài khoản quản trị không có quyền quản lý nội dung." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu nội dung chưa hợp lệ." }, { status: 400 });
  }

  if (parsed.data.kind === "category") {
    return upsertCategory(parsed.data, session.username, request);
  }

  return upsertPost(parsed.data, session.username, request);
}

async function upsertPost(data: z.infer<typeof postSchema>, adminUsername: string, request: Request) {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const id = clean(data.id);
  const slug = clean(data.slug) || `${slugify(data.title)}-${Date.now().toString(36)}`;
  const payload = {
    slug,
    title: data.title,
    excerpt: data.excerpt || null,
    body: data.body || data.excerpt || "",
    category: data.category,
    cover_image_url: data.coverImageUrl || null,
    status: data.status,
    is_featured: data.isFeatured,
    sort_order: data.sortOrder,
    published_at: data.status === "published" ? now : null,
    updated_at: now,
  };

  const query = id
    ? supabase.from("portal_content_posts").update(payload).eq("id", id).select("id,slug")
    : supabase
        .from("portal_content_posts")
        .insert({
          ...payload,
          created_at: now,
        })
        .select("id,slug");

  const { data: saved, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!saved?.id) {
    return NextResponse.json({ error: "Không tìm thấy bài viết cần cập nhật." }, { status: 404 });
  }

  await writeAuditLog({
    adminUsername,
    action: id ? "update_content" : "create_content",
    targetType: "content",
    targetId: String(saved.id),
    detailJson: {
      postId: String(saved.id),
      slug: String(saved.slug ?? slug),
      title: data.title,
      category: data.category,
      status: data.status,
      isFeatured: data.isFeatured,
    },
    request,
  });

  return NextResponse.json({ ok: true, id: saved.id });
}

async function upsertCategory(data: z.infer<typeof categorySchema>, adminUsername: string, request: Request) {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const id = slugify(data.id || data.name).slice(0, 60);
  if (!id) {
    return NextResponse.json({ error: "Không tạo được mã chuyên mục." }, { status: 400 });
  }

  const { data: saved, error } = await supabase
    .from("portal_content_categories")
    .upsert(
      {
        id,
        name: data.name,
        description: data.description || null,
        sort_order: data.sortOrder,
        is_active: data.isActive,
        updated_at: now,
      },
      { onConflict: "id" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog({
    adminUsername,
    action: "upsert_content_category",
    targetType: "content_category",
    targetId: String(saved?.id ?? id),
    detailJson: {
      categoryId: String(saved?.id ?? id),
      name: data.name,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
    request,
  });

  return NextResponse.json({ ok: true, id: saved?.id ?? id });
}

async function writeAuditLog({
  adminUsername,
  action,
  targetType,
  targetId,
  detailJson,
  request,
}: {
  adminUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  detailJson: Record<string, unknown>;
  request: Request;
}) {
  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from("portal_admin_audit_logs").insert({
      admin_username: adminUsername,
      action,
      target_type: targetType,
      target_id: targetId,
      detail_json: detailJson,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
      user_agent: request.headers.get("user-agent"),
    });
  } catch {
    // Audit should not block content editing if the admin foundation migration is not ready yet.
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
