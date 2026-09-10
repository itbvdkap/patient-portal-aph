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
    "retry_booking_match",
    "send_booking_zalo",
    "test_zns_template",
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
      case "retry_booking_match":
        await retryBookingMatch(parsed.data.target);
        break;
      case "send_booking_zalo":
        await sendBookingZaloNow(parsed.data.target);
        break;
      case "test_zns_template":
        await queueZnsTemplateTest(parsed.data.target);
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
  if (!setting && !isKnownEditableSetting(settingKey)) throw new Error("Không tìm thấy cấu hình cần sửa.");
  if (setting?.is_secret || looksLikeSecretKey(settingKey)) {
    throw new Error("Cấu hình bảo mật/secret chỉ được đổi bằng biến môi trường server hoặc Vercel.");
  }
  validateSettingValue(settingKey, settingValue);

  const { error } = await supabase
    .from("portal_app_settings")
    .upsert({
      setting_key: settingKey,
      setting_value: settingValue,
      setting_group: settingGroupFor(settingKey),
      label: settingLabelFor(settingKey),
      description: settingDescriptionFor(settingKey),
      is_secret: false,
      updated_by: adminUsername,
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });

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
  if ((settingKey.includes("template_id") || settingKey.startsWith("zalo.template.") || settingKey.includes("max_attempts") || settingKey.includes("ttl")) && settingValue && !/^\d+$/.test(settingValue)) {
    throw new Error("Giá trị này phải là số nguyên.");
  }
}

function looksLikeSecretKey(key: string) {
  return /(secret|token|password|key|service_role|connection_string)/i.test(key);
}

function isKnownEditableSetting(key: string) {
  return [
    "booking.zalo_auto_send_enabled",
    "zalo.template.booking_his_confirmed",
  ].includes(key);
}

function settingGroupFor(key: string) {
  if (key.startsWith("booking.")) return "booking";
  if (key.startsWith("zalo.")) return "zalo";
  if (key.startsWith("auth.")) return "auth";
  return "general";
}

function settingLabelFor(key: string) {
  const labels: Record<string, string> = {
    "booking.zalo_auto_send_enabled": "Tự động gửi Zalo khi HIS xác nhận",
    "zalo.template.booking_his_confirmed": "Template Zalo xác nhận HIS",
  };
  return labels[key] ?? key;
}

function settingDescriptionFor(key: string) {
  const descriptions: Record<string, string> = {
    "booking.zalo_auto_send_enabled": "OFF: chỉ tạo tin nhắn pending để admin kiểm tra và gửi thủ công. ON: worker tự gửi khi booking đã match HIS.",
    "zalo.template.booking_his_confirmed": "Template ID dùng cho tin nhắn xác nhận đăng ký đã vào HIS, có STT và phòng khám.",
  };
  return descriptions[key] ?? "Cấu hình vận hành của portal.";
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

async function retryBookingMatch(target: Record<string, string>) {
  const bookingId = clean(target.bookingId);
  if (!bookingId) throw new Error("Thiếu mã đăng ký khám.");

  const pool = getBookingPool();
  const { rowCount } = await pool.query(
    `
      update portal.lich_hen_kham
      set his_match_status='RETRY',
          his_match_next_check_at=now(),
          his_match_checked_at=null
      where id=$1
    `,
    [bookingId],
  );
  if (!rowCount) throw new Error("Không tìm thấy đăng ký khám.");
}

async function queueManualZaloSend(target: Record<string, string>) {
  const bookingId = clean(target.bookingId);
  const outboxId = clean(target.outboxId);
  if (!bookingId && !outboxId) throw new Error("Thiếu tin nhắn Zalo cần gửi.");

  const pool = getBookingPool();
  const result = outboxId
    ? await pool.query(
        `
          update portal.notification_outbox
          set status='pending',
              run_after=now(),
              locked_by=null,
              locked_until=null,
              last_error=null,
              payload_json=jsonb_set(payload_json, '{manual_send_requested}', 'true'::jsonb, true),
              updated_at=now()
          where id=$1
            and status <> 'sent'
        `,
        [Number(outboxId)],
      )
    : await pool.query(
        `
          update portal.notification_outbox
          set status='pending',
              run_after=now(),
              locked_by=null,
              locked_until=null,
              last_error=null,
              payload_json=jsonb_set(payload_json, '{manual_send_requested}', 'true'::jsonb, true),
              updated_at=now()
          where appointment_id=$1
            and channel='zalo'
            and status <> 'sent'
        `,
        [bookingId],
      );
  if (result.rowCount) return;

  if (!bookingId) throw new Error("Không tìm thấy tin nhắn Zalo pending/retry để gửi.");

  const inserted = await pool.query(
    `
      insert into portal.notification_outbox (
        channel,
        recipient_phone,
        template_key,
        appointment_id,
        payload_json,
        status,
        run_after
      )
      select
        'zalo',
        l.so_dien_thoai,
        'booking_his_confirmed',
        l.id,
        jsonb_build_object(
          'manual_send_requested', true,
          'booking_code', l.ma_lich_hen,
          'full_name', l.ho_ten,
          'appointment_date', l.ngay_kham::text,
          'appointment_time', l.gio_kham,
          'department_name', coalesce(nullif(l.his_department_name, ''), l.khoa_kham),
          'doctor_name', l.his_doctor_name,
          'ticket_number', l.his_stt_kham,
          'mabn', coalesce(nullif(l.his_mabn, ''), nullif(l.old_patient_code, ''), nullif(l.patient_code, '')),
          'mavaovien', l.his_mavaovien,
          'maql', l.his_maql,
          'registered_at', l.his_registered_at
        ),
        'pending',
        now()
      from portal.lich_hen_kham l
      where l.id=$1
        and nullif(l.so_dien_thoai, '') is not null
    `,
    [bookingId],
  );

  if (!inserted.rowCount) throw new Error("Chưa tạo được tin Zalo. Vui lòng kiểm tra số điện thoại của lịch khám.");
}

async function sendBookingZaloNow(target: Record<string, string>) {
  const item = await prepareManualZaloSend(target);
  const config = await readZaloConfig(item.templateId);
  const firstResult = await postZaloTemplate(config, item);
  const result = firstResult.isAccessTokenInvalid && config.refreshToken ? await retryWithRefreshedToken(config, item) : firstResult;

  const pool = getBookingPool();
  if (result.success) {
    await pool.query(
      `
        update portal.notification_outbox
        set status='sent',
            attempt_count=attempt_count + 1,
            locked_by=null,
            locked_until=null,
            last_error=null,
            sent_at=now(),
            updated_at=now(),
            payload_json=jsonb_set(payload_json, '{zalo_send_result}', $2::jsonb, true)
        where id=$1
      `,
      [
        item.id,
        JSON.stringify({ sent_at: new Date().toISOString(), zalo_error: numberValue(result.raw.error, 0), message_id: getZaloMessageId(result.raw) }),
      ],
    );
    await pool.query(
      `
        update portal.lich_hen_kham
        set zalo_confirm_sent_at=now()
        where id=$1
      `,
      [item.appointmentId],
    );
    return;
  }

  await pool.query(
    `
      update portal.notification_outbox
      set status='failed',
          attempt_count=attempt_count + 1,
          locked_by=null,
          locked_until=null,
          last_error=$2,
          updated_at=now(),
          payload_json=jsonb_set(payload_json, '{zalo_send_result}', $3::jsonb, true)
      where id=$1
    `,
    [item.id, result.message, JSON.stringify(result.raw ?? { message: result.message })],
  );

  throw new Error(`Zalo chưa gửi được: ${result.message}`);
}

async function prepareManualZaloSend(target: Record<string, string>) {
  await queueManualZaloSend(target);

  const bookingId = clean(target.bookingId);
  const outboxId = clean(target.outboxId);
  const pool = getBookingPool();
  const result = outboxId
    ? await pool.query<ManualZaloItem>(
        `
          select
            n.id,
            n.appointment_id as "appointmentId",
            n.recipient_phone as "recipientPhone",
            n.template_id as "templateId",
            n.payload_json::text as "payloadJson"
          from portal.notification_outbox n
          where n.id=$1
            and n.channel='zalo'
            and n.status <> 'sent'
          limit 1
        `,
        [Number(outboxId)],
      )
    : await pool.query<ManualZaloItem>(
        `
          select
            n.id,
            n.appointment_id as "appointmentId",
            n.recipient_phone as "recipientPhone",
            n.template_id as "templateId",
            n.payload_json::text as "payloadJson"
          from portal.notification_outbox n
          where n.appointment_id=$1
            and n.channel='zalo'
            and n.status <> 'sent'
          order by n.id desc
          limit 1
        `,
        [bookingId],
      );

  const item = result.rows[0];
  if (!item) throw new Error("Không tìm thấy tin Zalo cần gửi.");
  if (!normalizeZaloPhone(item.recipientPhone)) throw new Error("Số điện thoại nhận Zalo không hợp lệ.");
  return item;
}

type ManualZaloItem = {
  id: number;
  appointmentId: string;
  recipientPhone: string;
  templateId: string | null;
  payloadJson: string;
};

type ZaloConfig = {
  endpoint: string;
  tokenEndpoint: string;
  appId: string;
  secretKey: string;
  accessToken: string;
  refreshToken: string;
  templateId: string;
};

type ZaloPostResult = {
  success: boolean;
  isAccessTokenInvalid: boolean;
  message: string;
  raw: Record<string, unknown>;
};

async function readZaloConfig(templateIdOverride: string | null): Promise<ZaloConfig> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("portal_app_settings")
    .select("setting_key,setting_value")
    .in("setting_key", [
      "zalo.zns_endpoint",
      "zalo.token_endpoint",
      "zalo.app_id",
      "zalo.secret_key",
      "zalo.access_token",
      "zalo.refresh_token",
      "zalo.template.booking_his_confirmed",
    ]);
  if (error) throw new Error(`Không đọc được cấu hình Zalo: ${error.message}`);

  const settings = new Map((data ?? []).map((row) => [String(row.setting_key), String(row.setting_value ?? "")]));
  const config = {
    endpoint: firstNonEmpty(settings.get("zalo.zns_endpoint"), process.env.ZALO_ZNS_ENDPOINT, "https://business.openapi.zalo.me/message/template"),
    tokenEndpoint: firstNonEmpty(settings.get("zalo.token_endpoint"), process.env.ZALO_TOKEN_ENDPOINT, "https://oauth.zaloapp.com/v4/oa/access_token"),
    appId: firstNonEmpty(settings.get("zalo.app_id"), process.env.ZALO_APP_ID),
    secretKey: firstNonEmpty(settings.get("zalo.secret_key"), process.env.ZALO_SECRET_KEY),
    accessToken: firstNonEmpty(settings.get("zalo.access_token"), process.env.ZALO_ACCESS_TOKEN),
    refreshToken: firstNonEmpty(settings.get("zalo.refresh_token"), process.env.ZALO_REFRESH_TOKEN),
    templateId: firstNonEmpty(templateIdOverride, settings.get("zalo.template.booking_his_confirmed"), process.env.ZALO_BOOKING_CONFIRMED_TEMPLATE_ID, "628108"),
  };

  if (!config.endpoint || !config.templateId) throw new Error("Thiếu endpoint hoặc template ID Zalo.");
  if (!config.accessToken && !config.refreshToken) throw new Error("Thiếu access token/refresh token Zalo.");
  return config;
}

async function retryWithRefreshedToken(config: ZaloConfig, item: ManualZaloItem) {
  if (!config.appId || !config.secretKey || !config.refreshToken) {
    return { success: false, isAccessTokenInvalid: true, message: "Access token hết hạn và thiếu app id/secret/refresh token để làm mới.", raw: {} };
  }

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      secret_key: config.secretKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      app_id: config.appId,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  });
  const token = await response.json().catch(() => ({}));
  const accessToken = stringValue((token as Record<string, unknown>).access_token);
  if (!response.ok || !accessToken) {
    return { success: false, isAccessTokenInvalid: true, message: stringValue((token as Record<string, unknown>).message) || "Không làm mới được access token Zalo.", raw: token as Record<string, unknown> };
  }

  const tokenRecord = token as Record<string, unknown>;
  const nextRefreshToken = stringValue(tokenRecord.refresh_token) || config.refreshToken;
  await persistZaloTokens(accessToken, nextRefreshToken, tokenRecord.expires_in, tokenRecord.refresh_expires_in);
  return postZaloTemplate({ ...config, accessToken, refreshToken: nextRefreshToken }, item);
}

async function persistZaloTokens(accessToken: string, refreshToken: string, expiresIn?: unknown, refreshExpiresIn?: unknown) {
  const now = Date.now();
  const rows = [
    settingRow("zalo.access_token", accessToken, true, "Zalo access token"),
    settingRow("zalo.refresh_token", refreshToken, true, "Zalo refresh token"),
  ];
  const accessExpiresAt = expiryIso(now, expiresIn);
  if (accessExpiresAt) rows.push(settingRow("zalo.access_token_expires_at", accessExpiresAt, false, "Zalo access token hết hạn"));
  const refreshExpiresAt = expiryIso(now, refreshExpiresIn);
  if (refreshExpiresAt) rows.push(settingRow("zalo.refresh_token_expires_at", refreshExpiresAt, false, "Zalo refresh token hết hạn"));

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("portal_app_settings").upsert(rows, { onConflict: "setting_key" });
  if (error) throw new Error(`Không lưu được token Zalo mới: ${error.message}`);
}

function settingRow(setting_key: string, setting_value: string, is_secret: boolean, label: string) {
  return {
    setting_key,
    setting_value,
    setting_group: "zalo",
    label,
    is_secret,
    updated_by: "portal-admin-manual-zalo",
    updated_at: new Date().toISOString(),
  };
}

function expiryIso(nowMillis: number, value: unknown) {
  const seconds = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const millis = seconds > 10_000 ? seconds : seconds * 1000;
  return new Date(nowMillis + millis).toISOString();
}

async function postZaloTemplate(config: ZaloConfig, item: ManualZaloItem): Promise<ZaloPostResult> {
  const phone = normalizeZaloPhone(item.recipientPhone);
  const templateData = buildZaloTemplateData(JSON.parse(item.payloadJson || "{}"));
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: config.accessToken,
    },
    body: JSON.stringify({
      phone,
      template_id: config.templateId,
      template_data: templateData,
    }),
  });

  const raw = await response.json().catch(async () => ({ message: await response.text().catch(() => "") }));
  const rawRecord = raw as Record<string, unknown>;
  const errorCode = rawRecord.error;
  const success = response.ok && (errorCode === 0 || errorCode == null);
  return {
    success,
    isAccessTokenInvalid: errorCode === -124 || String(rawRecord.message ?? "").toLowerCase().includes("access token invalid"),
    message: stringValue(rawRecord.message ?? rawRecord.error_message) || (success ? "Success" : `Zalo HTTP ${response.status}`),
    raw: rawRecord,
  };
}

function buildZaloTemplateData(payload: Record<string, unknown>) {
  return {
    customer_name: stringValue(payload.customer_name ?? payload.full_name ?? payload.patient_name ?? payload.ho_ten ?? payload.name ?? "Quý khách"),
    id_booking: stringValue(payload.id_booking ?? payload.booking_code ?? payload.ma_lich_hen ?? payload.appointment_code),
    patient_code: stringValue(payload.patient_code ?? payload.mabn ?? payload.ma_bn),
    date_code: formatZaloDate(payload.date_code ?? payload.appointment_date ?? payload.ngay_kham),
    schedule_time: stringValue(payload.schedule_time ?? payload.appointment_time ?? payload.gio_kham),
    department_name: stringValue(payload.department_name ?? payload.room_name ?? payload.phong_kham ?? payload.clinic_name),
    ticket_number: stringValue(payload.ticket_number ?? payload.stt ?? payload.so_thu_tu),
  };
}

function formatZaloDate(value: unknown) {
  const text = stringValue(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return text;
}

function normalizeZaloPhone(value: string) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+84${digits}`;
}

function stringValue(value: unknown) {
  return value == null ? "" : String(value);
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function getZaloMessageId(raw: Record<string, unknown>) {
  const data = raw.data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  return stringValue(record.msg_id ?? record.message_id) || null;
}

async function queueZnsTemplateTest(target: Record<string, string>) {
  const phone = normalizePhone(clean(target.phone));
  const templateId = clean(target.templateId);
  if (!phone) throw new Error("Vui lòng nhập số điện thoại nhận tin test.");
  if (templateId && !/^\d+$/.test(templateId)) throw new Error("Template ID phải là số.");

  const pool = getBookingPool();
  const { rowCount } = await pool.query(
    `
      insert into portal.notification_outbox (
        channel,
        recipient_phone,
        template_key,
        template_id,
        payload_json,
        status,
        run_after
      )
      values (
        'zalo',
        $1,
        'booking_his_confirmed',
        nullif($2, ''),
        jsonb_build_object(
          'manual_send_requested', true,
          'is_test', true,
          'booking_code', 'APTEST001',
          'id_booking', 'APTEST001',
          'full_name', 'Khách hàng test',
          'customer_name', 'Khách hàng test',
          'appointment_date', to_char(current_date, 'YYYY-MM-DD'),
          'date_code', to_char(current_date, 'YYYY-MM-DD'),
          'appointment_time', '08:00',
          'schedule_time', '08:00',
          'department_name', 'Pk Nội 1',
          'phong_kham', 'Pk Nội 1',
          'ticket_number', '01',
          'stt_kham', '01',
          'mabn', 'TEST0001',
          'patient_code', 'TEST0001',
          'address', '05 Đường 22 Tháng 12, P. An Phú, TP. Hồ Chí Minh'
        ),
        'pending',
        now()
      )
    `,
    [phone, templateId],
  );

  if (!rowCount) throw new Error("Chưa queue được tin test ZNS.");
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
      target_type: action === "test_zns_template" || target.outboxId ? "notification" : target.bookingId ? "booking" : target.jobId ? "sync_job" : target.mabn ? "profile" : target.settingKey ? "setting" : target.postId ? "content" : "account",
      target_id: action === "test_zns_template" ? target.phone || target.templateId || null : target.outboxId || target.bookingId || target.jobId || target.mabn || target.settingKey || target.postId || target.accountId || target.accountKey || null,
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

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}
