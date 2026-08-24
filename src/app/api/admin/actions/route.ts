import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Pool } from "pg";
import { z } from "zod";
import { canAdminPerformAction, getAdminSession } from "@/lib/admin/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum([
    "lock_account",
    "unlock_account",
    "edit_account",
    "delete_account",
    "unlink_profile",
    "retry_sync",
    "approve_booking",
    "cancel_booking",
    "edit_setting",
    "publish_content",
    "archive_content",
  ]),
  target: z.record(z.string()).optional().default({}),
});

let bookingPool: Pool | null = null;

export async function POST(request: Request) {
  const session = getAdminSession(await cookies());
  if (!session) {
    return NextResponse.json({ error: "Phiên quản trị đã hết hạn." }, { status: 401 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thao tác quản trị không hợp lệ." }, { status: 400 });
  }
  if (!canAdminPerformAction(session.role, parsed.data.action)) {
    return NextResponse.json({ error: "Tài khoản quản trị không có quyền thực hiện thao tác này." }, { status: 403 });
  }

  try {
    switch (parsed.data.action) {
      case "lock_account":
        await setAccountStatus(parsed.data.target, "locked", session.username);
        break;
      case "unlock_account":
        await setAccountStatus(parsed.data.target, "active", session.username);
        break;
      case "edit_account":
        await updateAccountInfo(parsed.data.target);
        break;
      case "delete_account":
        await softDeleteAccount(parsed.data.target, session.username);
        break;
      case "unlink_profile":
        await unlinkProfile(parsed.data.target);
        break;
      case "retry_sync":
        await retrySync(parsed.data.target);
        break;
      case "approve_booking":
        await updateBooking(parsed.data.target, "DA_XAC_NHAN", true, session.username);
        break;
      case "cancel_booking":
        await updateBooking(parsed.data.target, "DA_HUY", false, session.username);
        break;
      case "edit_setting":
        await updateSetting(parsed.data.target, session.username);
        break;
      case "publish_content":
        await updateContentStatus(parsed.data.target, "published");
        break;
      case "archive_content":
        await updateContentStatus(parsed.data.target, "archived");
        break;
    }

    await writeAuditLog({
      adminUsername: session.username,
      action: parsed.data.action,
      target: parsed.data.target,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thực hiện được thao tác." }, { status: 400 });
  }
}

async function updateSetting(target: Record<string, string>, adminUsername: string) {
  const settingKey = clean(target.settingKey);
  const settingValue = clean(target.settingValue);
  if (!settingKey) throw new Error("Thiếu khóa cấu hình.");

  const supabase = createSupabaseServiceClient();
  const { data: setting, error: readError } = await supabase
    .from("portal_app_settings")
    .select("setting_key,is_secret")
    .eq("setting_key", settingKey)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!setting) throw new Error("Không tìm thấy cấu hình cần sửa.");
  if (setting.is_secret || looksLikeSecretKey(settingKey)) {
    throw new Error("Cấu hình bảo mật/secret chỉ được đổi bằng biến môi trường server hoặc Vercel.");
  }
  validateSettingValue(settingKey, settingValue);

  const { error } = await supabase
    .from("portal_app_settings")
    .update({
      setting_value: settingValue,
      updated_by: adminUsername,
      updated_at: new Date().toISOString(),
    })
    .eq("setting_key", settingKey)
    .eq("is_secret", false);

  if (error) throw new Error(error.message);
}

function validateSettingValue(settingKey: string, settingValue: string) {
  if (settingKey === "auth.otp_provider" && !["test", "zalo", "off"].includes(settingValue)) {
    throw new Error("Nhà cung cấp OTP chỉ được là test, zalo hoặc off.");
  }
  if (settingKey === "auth.otp_ttl_minutes") {
    const minutes = Number(settingValue);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) {
      throw new Error("Thời hạn OTP phải là số phút từ 1 đến 30.");
    }
  }
  if (settingKey.includes("enabled") && !["true", "false"].includes(settingValue.toLowerCase())) {
    throw new Error("Giá trị bật/tắt phải là true hoặc false.");
  }
  if ((settingKey.includes("url") || settingKey.includes("endpoint")) && settingValue && !/^https?:\/\/\S+$/i.test(settingValue)) {
    throw new Error("URL phải bắt đầu bằng http:// hoặc https://.");
  }
  if ((settingKey.includes("template_id") || settingKey.includes("max_attempts") || settingKey.includes("ttl")) && settingValue && !/^\d+$/.test(settingValue)) {
    throw new Error("Giá trị này phải là số nguyên.");
  }
}

function looksLikeSecretKey(key: string) {
  return /(secret|token|password|key|service_role|connection_string)/i.test(key);
}

async function updateContentStatus(target: Record<string, string>, status: "published" | "archived") {
  const postId = clean(target.postId);
  if (!postId) throw new Error("Thiếu mã bài viết.");

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("portal_content_posts")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) throw new Error(error.message);

}

async function setAccountStatus(target: Record<string, string>, status: "active" | "locked", adminUsername: string) {
  const supabase = createSupabaseServiceClient();
  const accountId = clean(target.accountId);
  const accountKey = clean(target.accountKey);
  const note = clean(target.note);

  if (!accountId && !accountKey) {
    throw new Error("Thiếu định danh tài khoản.");
  }
  if (status === "locked" && !note) {
    throw new Error("Vui lòng nhập lý do khóa tài khoản.");
  }

  const now = new Date().toISOString();
  const accountQuery = supabase.from("portal_accounts").update({
    status,
    updated_at: now,
    ...(status === "locked"
      ? { locked_at: now, locked_by: adminUsername, locked_reason: note }
      : { locked_at: null, locked_by: null, locked_reason: null }),
  });
  const accountResult = accountId ? await accountQuery.eq("id", accountId) : await accountQuery.eq("account_key", accountKey);
  if (accountResult.error) throw new Error(accountResult.error.message);

  if (status === "locked") {
    const sessionQuery = supabase
      .from("portal_account_sessions")
      .update({ revoked_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
      .is("revoked_at", null);
    const sessionResult = accountId ? await sessionQuery.eq("account_id", accountId) : await sessionQuery.eq("account_key", accountKey);
    if (sessionResult.error) throw new Error(sessionResult.error.message);
  }
}

async function updateAccountInfo(target: Record<string, string>) {
  const supabase = createSupabaseServiceClient();
  const accountId = clean(target.accountId);
  const accountKey = clean(target.accountKey);
  const fullName = clean(target.fullName);
  const displayName = clean(target.displayName);
  const phoneVerified = clean(target.phoneVerified);

  if (!accountId && !accountKey) {
    throw new Error("Thiếu định danh tài khoản.");
  }
  if (!fullName && !displayName) {
    throw new Error("Vui lòng nhập họ tên hoặc tên hiển thị.");
  }
  if (fullName.length > 120 || displayName.length > 120) {
    throw new Error("Tên tài khoản không được vượt quá 120 ký tự.");
  }
  if (phoneVerified && !["yes", "no"].includes(phoneVerified)) {
    throw new Error("Trạng thái xác minh SĐT không hợp lệ.");
  }

  const now = new Date().toISOString();
  let nextPhoneVerifiedAt: string | null | undefined;
  if (phoneVerified) {
    const readQuery = supabase.from("portal_accounts").select("phone_verified_at").limit(1);
    const readResult = accountId ? await readQuery.eq("id", accountId).maybeSingle() : await readQuery.eq("account_key", accountKey).maybeSingle();
    if (readResult.error) throw new Error(readResult.error.message);

    const desiredVerified = phoneVerified === "yes";
    const currentVerified = Boolean(readResult.data?.phone_verified_at);
    if (desiredVerified !== currentVerified) {
      nextPhoneVerifiedAt = desiredVerified ? now : null;
    }
  }

  const updatePayload: Record<string, string | null> = {
    full_name: fullName || displayName,
    display_name: displayName || fullName,
    updated_at: now,
  };
  if (nextPhoneVerifiedAt !== undefined) {
    updatePayload.phone_verified_at = nextPhoneVerifiedAt;
  }

  const accountQuery = supabase.from("portal_accounts").update(updatePayload);
  const accountResult = accountId ? await accountQuery.eq("id", accountId) : await accountQuery.eq("account_key", accountKey);
  if (accountResult.error) throw new Error(accountResult.error.message);
}

async function softDeleteAccount(target: Record<string, string>, adminUsername: string) {
  const supabase = createSupabaseServiceClient();
  const accountId = clean(target.accountId);
  const accountKey = clean(target.accountKey);
  const note = clean(target.note);

  if (!accountId && !accountKey) {
    throw new Error("Thiếu định danh tài khoản.");
  }
  if (!note) {
    throw new Error("Vui lòng nhập lý do xóa tài khoản.");
  }

  const now = new Date().toISOString();
  const accountQuery = supabase.from("portal_accounts").update({
    status: "deleted",
    deleted_at: now,
    deleted_by: adminUsername,
    deleted_reason: note,
    updated_at: now,
  });
  const accountResult = accountId ? await accountQuery.eq("id", accountId) : await accountQuery.eq("account_key", accountKey);
  if (accountResult.error) throw new Error(accountResult.error.message);

  const sessionQuery = supabase
    .from("portal_account_sessions")
    .update({ revoked_at: now, last_seen_at: now })
    .is("revoked_at", null);
  const sessionResult = accountId ? await sessionQuery.eq("account_id", accountId) : await sessionQuery.eq("account_key", accountKey);
  if (sessionResult.error) throw new Error(sessionResult.error.message);
}

async function unlinkProfile(target: Record<string, string>) {
  const supabase = createSupabaseServiceClient();
  const accountId = clean(target.accountId);
  const accountKey = clean(target.accountKey);
  const mabn = clean(target.mabn);
  const note = clean(target.note);

  if ((!accountId && !accountKey) || !mabn) {
    throw new Error("Thiếu thông tin hồ sơ cần gỡ.");
  }
  if (!note) {
    throw new Error("Vui lòng nhập lý do gỡ liên kết hồ sơ.");
  }

  const accountFilter = accountId ? { column: "account_id", value: accountId } : { column: "account_key", value: accountKey };
  const { data, error } = await supabase
    .from("portal_account_profiles")
    .select("mabn,is_active,is_default,linked_at,last_selected_at")
    .eq(accountFilter.column, accountFilter.value)
    .order("is_default", { ascending: false })
    .order("last_selected_at", { ascending: false, nullsFirst: false })
    .order("linked_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.some((profile) => profile.mabn === mabn)) throw new Error("Không tìm thấy hồ sơ liên kết.");
  if (data.length <= 1) throw new Error("Không thể gỡ hồ sơ cuối cùng của tài khoản.");
  if (data.find((profile) => profile.mabn === mabn)?.is_default) throw new Error("Không nên gỡ hồ sơ mặc định từ dashboard nhanh.");

  const deletingCurrent = Boolean(data.find((profile) => profile.mabn === mabn)?.is_active);
  const nextProfile = data.find((profile) => profile.mabn !== mabn);

  const deleteResult = await supabase.from("portal_account_profiles").delete().eq(accountFilter.column, accountFilter.value).eq("mabn", mabn);
  if (deleteResult.error) throw new Error(deleteResult.error.message);

  if (deletingCurrent && nextProfile) {
    const clearResult = await supabase.from("portal_account_profiles").update({ is_active: false }).eq(accountFilter.column, accountFilter.value);
    if (clearResult.error) throw new Error(clearResult.error.message);

    const activateResult = await supabase
      .from("portal_account_profiles")
      .update({ is_active: true, last_selected_at: new Date().toISOString() })
      .eq(accountFilter.column, accountFilter.value)
      .eq("mabn", nextProfile.mabn);
    if (activateResult.error) throw new Error(activateResult.error.message);
  }
}

async function retrySync(target: Record<string, string>) {
  const supabase = createSupabaseServiceClient();
  const jobId = clean(target.jobId);

  if (!jobId) {
    throw new Error("Thiếu mã sync job.");
  }

  const { error } = await supabase
    .from("portal_sync_jobs")
    .update({
      status: "queued",
      attempt_count: 0,
      run_after: new Date().toISOString(),
      started_at: null,
      finished_at: null,
      locked_by: null,
      locked_until: null,
      error_message: null,
      requested_by: "admin",
      requested_reason: "manual retry from portal admin",
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", Number(jobId));

  if (error) throw new Error(error.message);
}

async function updateBooking(target: Record<string, string>, status: "DA_XAC_NHAN" | "DA_HUY", trangThai: boolean, adminUsername: string) {
  const bookingId = clean(target.bookingId);
  const note = clean(target.note);
  if (!bookingId) throw new Error("Thiếu mã đăng ký khám.");

  const pool = getBookingPool();
  const current = await pool.query<{ status: string | null }>("select status from portal.lich_hen_kham where id = $1", [bookingId]);
  if (!current.rows[0]) throw new Error("Không tìm thấy đăng ký khám.");

  await pool.query(
    `
      update portal.lich_hen_kham
      set status = $2,
          trang_thai = $3
      where id = $1
    `,
    [bookingId, status, trangThai],
  );

  await pool.query(
    `
      insert into portal.lich_hen_kham_history (
        appointment_id,
        action,
        performed_by,
        old_status,
        new_status,
        changed_fields
      )
      values ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      bookingId,
      status === "DA_XAC_NHAN" ? "XAC_NHAN" : "HUY",
      `ADMIN:${adminUsername}`,
      current.rows[0].status,
      status,
      JSON.stringify({ source: "portal_admin", note }),
    ],
  );
}

async function writeAuditLog({
  adminUsername,
  action,
  target,
  request,
}: {
  adminUsername: string;
  action: string;
  target: Record<string, string>;
  request: Request;
}) {
  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from("portal_admin_audit_logs").insert({
      admin_username: adminUsername,
      action,
      target_type: target.bookingId ? "booking" : target.jobId ? "sync_job" : target.mabn ? "profile" : target.settingKey ? "setting" : target.postId ? "content" : "account",
      target_id: target.bookingId || target.jobId || target.mabn || target.settingKey || target.postId || target.accountId || target.accountKey || null,
      detail_json: target,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
      user_agent: request.headers.get("user-agent"),
    });
  } catch {
    // Audit should not block the admin action if the migration has not been applied yet.
  }
}

function getBookingPool() {
  const connectionString = process.env.BOOKING_DATABASE_URL;
  if (!connectionString) throw new Error("BOOKING_DATABASE_URL chưa cấu hình.");

  bookingPool ??= new Pool({
    connectionString,
    max: 2,
    ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  return bookingPool;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
