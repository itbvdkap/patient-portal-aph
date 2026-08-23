import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canAdminAccessPath, getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const bucketName = "portal-content-covers";
const maxBytes = 2 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  const session = getAdminSession(await cookies());
  if (!session) {
    return NextResponse.json({ error: "Phiên quản trị đã hết hạn." }, { status: 401 });
  }
  if (!canAdminAccessPath(session.role, "/admin/content")) {
    return NextResponse.json({ error: "Tài khoản quản trị không có quyền quản lý nội dung." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn file ảnh cover." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Ảnh cover chỉ hỗ trợ JPG, PNG, WebP hoặc GIF." }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "Ảnh cover tối đa 2MB để tải nhanh trên điện thoại." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  await ensureCoverBucket(supabase);

  const now = new Date();
  const ext = extensions[file.type] ?? "jpg";
  const safeName = slugify(file.name.replace(/\.[^.]+$/, "")) || "cover";
  const path = [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}.${ext}`,
  ].join("/");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage.from(bucketName).upload(path, bytes, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);

  await writeAuditLog({
    adminUsername: session.username,
    action: "upload_content_cover",
    targetType: "content_cover",
    targetId: path,
    detailJson: {
      bucket: bucketName,
      path,
      size: file.size,
      type: file.type,
    },
    request,
  });

  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}

async function ensureCoverBucket(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data } = await supabase.storage.getBucket(bucketName);
  if (data) return;

  await supabase.storage.createBucket(bucketName, {
    public: true,
    allowedMimeTypes: Array.from(allowedTypes),
    fileSizeLimit: maxBytes,
  });
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
    // Upload should still succeed if audit storage is temporarily unavailable.
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
    .slice(0, 64);
}
