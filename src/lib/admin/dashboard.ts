import { Pool } from "pg";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface AdminMetric {
  label: string;
  value: string;
  hint: string;
  tone?: "green" | "amber" | "red" | "blue" | "slate";
}

export interface AdminRow {
  id: string;
  primary: string;
  secondary: string;
  meta: string;
  href?: string;
  status?: string;
  entity?: "account" | "profile" | "booking" | "sync";
  target?: Record<string, string>;
  actions?: AdminRowAction[];
}

export interface AdminRowAction {
  action: string;
  label: string;
  confirm?: string;
  tone?: "primary" | "danger" | "neutral";
}

export interface AdminSettingStatus {
  label: string;
  value: string;
  status: "ok" | "warning" | "missing";
}

export interface AdminDashboardData {
  metrics: AdminMetric[];
  accounts: AdminRow[];
  profiles: AdminRow[];
  bookings: AdminRow[];
  syncJobs: AdminRow[];
  loginEvents: AdminRow[];
  settings: AdminSettingStatus[];
  content: AdminRow[];
  warnings: string[];
}

let bookingPool: Pool | null = null;

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const warnings: string[] = [];
  const supabase = createSupabaseServiceClient();

  const [accountCount, profileCount, activeSessionCount, syncPendingCount, syncFailedCount, accounts, profiles, syncJobs, loginEvents, otpAttempts, content, settings, bookings] =
    await Promise.all([
      countRows(supabase, "portal_accounts", warnings),
      countRows(supabase, "portal_account_profiles", warnings),
      countRows(supabase, "portal_account_sessions", warnings, { column: "revoked_at", value: null }),
      countRows(supabase, "portal_sync_jobs", warnings, { column: "status", value: "pending" }),
      countRows(supabase, "portal_sync_jobs", warnings, { column: "status", value: "failed" }),
      recentRows(
        supabase,
        "portal_accounts",
        "account_key,id,phone_masked,full_name,display_name,status,last_login_at,created_at",
        "created_at",
        warnings,
      ),
      recentRows(
        supabase,
        "portal_account_profiles",
        "account_key,account_id,mabn,display_name,patient_name,relationship,verified_at,linked_at,is_active,is_default",
        "linked_at",
        warnings,
      ),
      recentRows(
        supabase,
        "portal_sync_jobs",
        "job_id,mabn,resource_name,status,attempt_count,error_message,updated_at,created_at",
        "updated_at",
        warnings,
      ),
      recentRows(
        supabase,
        "portal_login_events",
        "id,phone_masked,event_type,device_label,ip_address,created_at",
        "created_at",
        warnings,
      ),
      recentRows(
        supabase,
        "portal_otp_attempts",
        "id,phone_masked,purpose,status,created_at,expires_at",
        "created_at",
        warnings,
      ),
      recentRows(
        supabase,
        "portal_content_posts",
        "id,title,category,status,is_featured,updated_at,created_at",
        "updated_at",
        warnings,
      ),
      recentRows(
        supabase,
        "portal_app_settings",
        "setting_key,setting_value,is_secret,updated_at",
        "updated_at",
        warnings,
      ),
      getRecentBookings(warnings),
    ]);

  const metrics: AdminMetric[] = [
    { label: "Tài khoản", value: formatCount(accountCount), hint: "Tài khoản portal", tone: "blue" },
    { label: "Hồ sơ liên kết", value: formatCount(profileCount), hint: "MABN đã xác minh", tone: "green" },
    { label: "Phiên đang mở", value: formatCount(activeSessionCount), hint: "Chưa đăng xuất", tone: "slate" },
    {
      label: "Sync đang chờ",
      value: formatCount(syncPendingCount),
      hint: "Job chờ agent xử lý",
      tone: syncPendingCount ? "amber" : "green",
    },
    {
      label: "Sync lỗi",
      value: formatCount(syncFailedCount),
      hint: "Cần kiểm tra agent/Oracle",
      tone: syncFailedCount ? "red" : "green",
    },
    { label: "Đăng ký khám", value: formatCount(bookings.count), hint: "Tổng trong booking DB", tone: "blue" },
  ];

  return {
    metrics,
    accounts: mapAccounts(accounts),
    profiles: mapProfiles(profiles),
    bookings: bookings.rows,
    syncJobs: mapSyncJobs(syncJobs),
    loginEvents: [...mapLoginEvents(loginEvents), ...mapOtpAttempts(otpAttempts)].slice(0, 10),
    settings: mapSettings(settings),
    content: mapContent(content),
    warnings: unique(warnings),
  };
}

async function countRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  table: string,
  warnings: string[],
  filter?: { column: string; value: string | null },
) {
  try {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    query = filter ? (filter.value === null ? query.is(filter.column, null) : query.eq(filter.column, filter.value)) : query;
    const { count, error } = await query;
    if (error) {
      warnings.push(`${table}: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  } catch (error) {
    warnings.push(`${table}: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`);
    return 0;
  }
}

async function recentRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  table: string,
  columns: string,
  orderColumn: string,
  warnings: string[],
) {
  try {
    const { data, error } = await supabase.from(table).select(columns).order(orderColumn, { ascending: false, nullsFirst: false }).limit(8);
    if (error) {
      warnings.push(`${table}: ${error.message}`);
      return [];
    }
    return (data ?? []) as unknown as Record<string, unknown>[];
  } catch (error) {
    warnings.push(`${table}: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`);
    return [];
  }
}

async function getRecentBookings(warnings: string[]): Promise<{ count: number; rows: AdminRow[] }> {
  const connectionString = process.env.BOOKING_DATABASE_URL;
  if (!connectionString) {
    warnings.push("BOOKING_DATABASE_URL chưa cấu hình nên chưa đọc được đăng ký khám.");
    return { count: 0, rows: [] as AdminRow[] };
  }

  try {
    bookingPool ??= new Pool({
      connectionString,
      max: 2,
      ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
    });

    const [countResult, rowsResult] = await Promise.all([
      bookingPool.query<{ count: string }>("select count(*)::text as count from portal.lich_hen_kham"),
      bookingPool.query<{
        id: string;
        ma_lich_hen: string | null;
        ho_ten: string | null;
        so_dien_thoai: string | null;
        ngay_kham: string | null;
        khoa_kham: string | null;
        status: string | null;
        ngay_tao: string | null;
      }>(
        `
          select id, ma_lich_hen, ho_ten, so_dien_thoai, ngay_kham::text, khoa_kham, status, ngay_tao::text
          from portal.lich_hen_kham
          order by ngay_tao desc nulls last, ngay_kham desc nulls last, id desc
          limit 8
        `,
      ),
    ]);

    return {
      count: Number(countResult.rows[0]?.count ?? 0),
      rows: rowsResult.rows.map((row): AdminRow => ({
        id: row.id,
        primary: row.ho_ten || "Chưa có tên",
        secondary: [row.ma_lich_hen, row.khoa_kham, row.ngay_kham].filter(Boolean).join(" · "),
        meta: maskPhone(row.so_dien_thoai),
        status: row.status ?? "CHO_DUYET",
        entity: "booking",
        href: `/admin/bookings/${row.id}`,
        target: {
          bookingId: row.id,
          bookingCode: row.ma_lich_hen ?? "",
        },
        actions: ["CHO_DUYET", "CHO_DUYET_LAI"].includes(row.status ?? "")
          ? [
              { action: "approve_booking", label: "Xác nhận", tone: "primary" },
              { action: "cancel_booking", label: "Hủy", tone: "danger", confirm: "Hủy lịch đăng ký khám này?" },
            ]
          : [],
      })),
    };
  } catch (error) {
    warnings.push(`portal.lich_hen_kham: ${error instanceof Error ? error.message : "Không đọc được booking DB"}`);
    return { count: 0, rows: [] as AdminRow[] };
  }
}

function mapAccounts(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => ({
    id: String(row.id ?? row.phone_masked ?? crypto.randomUUID()),
    primary: String(row.full_name ?? row.display_name ?? "Tài khoản chưa đặt tên"),
    secondary: String(row.phone_masked ?? "Chưa có SĐT"),
    meta: row.last_login_at ? `Đăng nhập ${formatDate(row.last_login_at)}` : `Tạo ${formatDate(row.created_at)}`,
    status: String(row.status ?? "active"),
    entity: "account",
    href: `/admin/accounts/${encodeURIComponent(String(row.id ?? row.account_key ?? ""))}`,
    target: {
      accountId: String(row.id ?? ""),
      accountKey: String(row.account_key ?? ""),
    },
    actions:
      String(row.status ?? "active") === "locked"
        ? [{ action: "unlock_account", label: "Mở khóa", tone: "primary" }]
        : [{ action: "lock_account", label: "Khóa", tone: "danger", confirm: "Khóa tài khoản này và thu hồi các phiên đang mở?" }],
  }));
}

function mapProfiles(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => ({
    id: String(row.mabn ?? crypto.randomUUID()),
    primary: String(row.display_name ?? row.patient_name ?? "Hồ sơ chưa có tên"),
    secondary: `Mã BN ${row.mabn ?? "?"}`,
    meta: [row.relationship, row.verified_at ? "đã xác minh" : "chưa xác minh"].filter(Boolean).join(" · "),
    status: row.is_active ? "đang xem" : undefined,
    entity: "profile",
    target: {
      accountId: String(row.account_id ?? ""),
      accountKey: String(row.account_key ?? ""),
      mabn: String(row.mabn ?? ""),
    },
    actions: row.is_default
      ? []
      : [{ action: "unlink_profile", label: "Gỡ", tone: "danger", confirm: "Gỡ liên kết hồ sơ y tế này khỏi tài khoản?" }],
  }));
}

function mapSyncJobs(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => ({
    id: String(row.job_id ?? crypto.randomUUID()),
    primary: `${row.mabn ?? "?"} · ${row.resource_name ?? "all"}`,
    secondary: String(row.error_message ?? `Số lần thử ${row.attempt_count ?? 0}`),
    meta: formatDate(row.updated_at ?? row.created_at),
    status: String(row.status ?? "pending"),
    entity: "sync",
    target: {
      jobId: String(row.job_id ?? ""),
      mabn: String(row.mabn ?? ""),
      resourceName: String(row.resource_name ?? "all"),
    },
    actions: [{ action: "retry_sync", label: "Retry", tone: "primary" }],
  }));
}

function mapLoginEvents(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => ({
    id: String(row.id ?? crypto.randomUUID()),
    primary: String(row.phone_masked ?? "Tài khoản"),
    secondary: [row.event_type, row.device_label, row.ip_address].filter(Boolean).join(" · "),
    meta: formatDate(row.created_at),
  }));
}

function mapOtpAttempts(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => ({
    id: `otp-${String(row.id ?? crypto.randomUUID())}`,
    primary: String(row.phone_masked ?? "OTP"),
    secondary: [row.purpose ?? "otp", row.status ?? "pending"].join(" · "),
    meta: formatDate(row.created_at),
    status: String(row.status ?? "pending"),
  }));
}

function mapSettings(rows: Record<string, unknown>[]): AdminSettingStatus[] {
  const envSettings: AdminSettingStatus[] = [
    settingStatus("OTP provider", process.env.AUTH_OTP_PROVIDER),
    settingStatus("Zalo template", process.env.ZALO_TEMPLATE_ID),
    settingStatus("Cloudflare Turnstile", process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    settingStatus("Patient data mode", process.env.PATIENT_DATA_MODE || "api/direct"),
    settingStatus("Booking DB", process.env.BOOKING_DATABASE_URL ? "Đã cấu hình" : ""),
    settingStatus("PatientApi", process.env.PATIENT_API_BASE_URL),
  ];

  const dbSettings = rows.map((row) => ({
    label: String(row.setting_key ?? "setting"),
    value: row.is_secret ? "Đã lưu bảo mật" : String(row.setting_value ?? "Chưa có giá trị"),
    status: row.setting_value ? "ok" : "missing",
  })) satisfies AdminSettingStatus[];

  return [...envSettings, ...dbSettings].slice(0, 12);
}

function mapContent(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => ({
    id: String(row.id ?? crypto.randomUUID()),
    primary: String(row.title ?? "Bài viết chưa có tiêu đề"),
    secondary: [row.category, row.is_featured ? "nổi bật" : ""].filter(Boolean).join(" · "),
    meta: formatDate(row.updated_at ?? row.created_at),
    status: String(row.status ?? "draft"),
  }));
}

function settingStatus(label: string, value: string | undefined): AdminSettingStatus {
  if (!value) return { label, value: "Chưa cấu hình", status: "missing" };
  if (value === "test" || value === "api/direct") return { label, value, status: "warning" };
  return { label, value: value.includes("secret") || value.length > 36 ? "Đã cấu hình" : value, status: "ok" };
}

function maskPhone(value: unknown) {
  const text = String(value ?? "");
  if (text.length < 7) return text || "Chưa có SĐT";
  return `${text.slice(0, 3)}****${text.slice(-3)}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: unknown) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function unique(values: string[]) {
  return [...new Set(values)].slice(0, 12);
}
