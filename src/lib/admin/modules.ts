import { Pool } from "pg";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { AdminRow, AdminRowAction } from "@/lib/admin/dashboard";

export interface AdminModuleResult {
  rows: AdminRow[];
  warnings: string[];
}

export interface AdminBookingsQuery {
  q?: string;
  status?: string;
  ops?: string;
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  branch?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminAccountsQuery {
  q?: string;
  status?: string;
  phoneVerified?: string;
  passwordSet?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminProfilesQuery {
  q?: string;
  relationship?: string;
  verified?: string;
  active?: string;
  multiAccount?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminSyncJobsQuery {
  q?: string;
  status?: string;
  resourceName?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminAuditLogsQuery {
  q?: string;
  admin?: string;
  action?: string;
  targetType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminOtpEventsQuery {
  q?: string;
  source?: string;
  status?: string;
  provider?: string;
  device?: string;
  ip?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminContentQuery {
  q?: string;
  status?: string;
  category?: string;
  featured?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminContentCategory {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
}

export interface AdminContentPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  categoryName: string;
  coverImageUrl: string;
  status: string;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string;
  updatedAt: string;
  createdAt: string;
}

export interface AdminContentResult extends AdminModuleResult {
  posts: AdminContentPost[];
  categories: AdminContentCategory[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: Required<Omit<AdminContentQuery, "page" | "pageSize">>;
  options: {
    statuses: string[];
    categories: AdminContentCategory[];
  };
}

export interface AdminSettingEntry {
  key: string;
  value: string;
  displayValue: string;
  group: string;
  groupLabel: string;
  label: string;
  description: string;
  isSecret: boolean;
  isEditable: boolean;
  updatedBy: string;
  updatedAt: string;
  status: "ok" | "missing" | "secret";
  inputType: "text" | "number" | "boolean" | "select" | "url" | "textarea";
  options: string[];
  validationHint: string;
}

export interface AdminSettingsResult {
  entries: AdminSettingEntry[];
  warnings: string[];
  groups: Array<{ id: string; label: string; count: number; missing: number }>;
}

export interface AdminAccountsResult extends AdminModuleResult {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: Required<Omit<AdminAccountsQuery, "page" | "pageSize">>;
  options: {
    statuses: string[];
  };
}

export interface AdminProfilesResult extends AdminModuleResult {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: Required<Omit<AdminProfilesQuery, "page" | "pageSize">>;
  options: {
    relationships: string[];
  };
  duplicateMabns: string[];
}

export interface AdminBookingsResult extends AdminModuleResult {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: Required<Omit<AdminBookingsQuery, "page" | "pageSize">>;
  stats: {
    unmatched: number;
    matchedUnsentZalo: number;
    zaloError: number;
    slaOver30: number;
    slaOver120: number;
    avgWaitMinutes: number;
  };
  options: {
    statuses: string[];
    departments: string[];
    branches: string[];
  };
}

export interface AdminSyncJobsResult extends AdminModuleResult {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: Required<Omit<AdminSyncJobsQuery, "page" | "pageSize">>;
  options: {
    statuses: string[];
    resources: string[];
  };
  failedCount: number;
}

export interface AdminAuditEntry {
  id: string;
  adminUsername: string;
  action: string;
  actionLabel: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  detailText: string;
  detailJson: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface AdminAuditLogsResult {
  entries: AdminAuditEntry[];
  warnings: string[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: Required<Omit<AdminAuditLogsQuery, "page" | "pageSize">>;
  options: {
    admins: string[];
    actions: string[];
    targetTypes: string[];
  };
}

export interface AdminOtpEventEntry {
  id: string;
  source: "login" | "otp";
  phoneLabel: string;
  title: string;
  status: string;
  provider: string;
  deviceLabel: string;
  ipAddress: string;
  attemptText: string;
  message: string;
  technicalJson: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

export interface AdminOtpEventsResult {
  entries: AdminOtpEventEntry[];
  warnings: string[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: Required<Omit<AdminOtpEventsQuery, "page" | "pageSize">>;
  options: {
    statuses: string[];
    providers: string[];
    eventTypes: string[];
  };
  failedOtpCount: number;
}

export interface AdminAccountDetail {
  account: Record<string, unknown> | null;
  profiles: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  loginEvents: Record<string, unknown>[];
  warnings: string[];
}

export interface AdminBookingDetail {
  booking: Record<string, unknown> | null;
  history: Record<string, unknown>[];
  matches: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  warnings: string[];
}

export interface AdminProfileDetail {
  mabn: string;
  links: Record<string, unknown>[];
  branchMappings: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  syncJobs: Record<string, unknown>[];
  warnings: string[];
}

export interface AdminSyncJobDetail {
  job: Record<string, unknown> | null;
  relatedJobs: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  warnings: string[];
}

let bookingPool: Pool | null = null;

type AccountQueryBuilder = {
  or: (value: string) => AccountQueryBuilder;
  eq: (column: string, value: string) => AccountQueryBuilder;
  not: (column: string, operator: string, value: null) => AccountQueryBuilder;
  is: (column: string, value: null) => AccountQueryBuilder;
  order: (column: string, options: { ascending: boolean; nullsFirst: boolean }) => AccountQueryBuilder;
  range: (from: number, to: number) => Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
    count: number | null;
  }>;
};

type ProfileQueryBuilder = {
  or: (value: string) => ProfileQueryBuilder;
  eq: (column: string, value: string | boolean) => ProfileQueryBuilder;
  not: (column: string, operator: string, value: null) => ProfileQueryBuilder;
  is: (column: string, value: null) => ProfileQueryBuilder;
  in: (column: string, values: string[]) => ProfileQueryBuilder;
  order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => ProfileQueryBuilder;
  range: (from: number, to: number) => Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
    count: number | null;
  }>;
};

type SyncQueryBuilder = {
  or: (value: string) => SyncQueryBuilder;
  eq: (column: string, value: string | number) => SyncQueryBuilder;
  gte: (column: string, value: string) => SyncQueryBuilder;
  lte: (column: string, value: string) => SyncQueryBuilder;
  order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => SyncQueryBuilder;
  range: (from: number, to: number) => Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
    count: number | null;
  }>;
};

type AuditQueryBuilder = {
  or: (value: string) => AuditQueryBuilder;
  eq: (column: string, value: string | number) => AuditQueryBuilder;
  gte: (column: string, value: string) => AuditQueryBuilder;
  lte: (column: string, value: string) => AuditQueryBuilder;
  order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => AuditQueryBuilder;
  range: (from: number, to: number) => Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
    count: number | null;
  }>;
};

type ContentQueryBuilder = {
  or: (value: string) => ContentQueryBuilder;
  eq: (column: string, value: string | boolean) => ContentQueryBuilder;
  order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => ContentQueryBuilder;
  range: (from: number, to: number) => Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
    count: number | null;
  }>;
};

export async function getAdminAccounts(query: AdminAccountsQuery = {}): Promise<AdminAccountsResult> {
  const warnings: string[] = [];
  const filters = normalizeAccountFilters(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = clamp(Math.floor(query.pageSize ?? 20), 10, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = createSupabaseServiceClient();
    const baseQuery = supabase
      .from("portal_accounts")
      .select("account_key,id,phone_masked,phone,full_name,display_name,status,primary_mabn,phone_verified_at,password_set_at,last_login_at,created_at,locked_at,locked_by,locked_reason,deleted_at,deleted_by,deleted_reason", {
        count: "exact",
      });
    const dataQuery = applyAccountFilters(baseQuery as unknown as AccountQueryBuilder, filters)
      .order("created_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    const [{ data, error, count }, statusResult] = await Promise.all([
      dataQuery,
      supabase.from("portal_accounts").select("status").not("status", "is", null).limit(500),
    ]);

    if (error) {
      return emptyAccountsResult(filters, page, pageSize, [`portal_accounts: ${error.message}`]);
    }
    if (statusResult.error) {
      warnings.push(`portal_accounts status: ${statusResult.error.message}`);
    }

    const total = count ?? 0;
    return {
      warnings,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      filters,
      options: {
        statuses: [...new Set((statusResult.data ?? []).map((row) => String(row.status ?? "")).filter(Boolean))].sort(),
      },
      rows: mapAccountRows((data ?? []) as unknown as Record<string, unknown>[]),
    };
  } catch (error) {
    return emptyAccountsResult(filters, page, pageSize, [`portal_accounts: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`]);
  }
}

export async function getAdminAccountsModule(): Promise<AdminModuleResult> {
  const result = await getAdminAccounts({ pageSize: 100 });
  return { rows: result.rows, warnings: result.warnings };
}

export async function getAdminProfiles(query: AdminProfilesQuery = {}): Promise<AdminProfilesResult> {
  const warnings: string[] = [];
  const filters = normalizeProfileFilters(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = clamp(Math.floor(query.pageSize ?? 20), 10, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = createSupabaseServiceClient();
    const [duplicateResult, relationshipResult] = await Promise.all([
      supabase.from("portal_account_profiles").select("mabn,account_id,account_key").limit(5000),
      supabase.from("portal_account_profiles").select("relationship").not("relationship", "is", null).limit(1000),
    ]);

    if (duplicateResult.error) warnings.push(`portal_account_profiles duplicate: ${duplicateResult.error.message}`);
    if (relationshipResult.error) warnings.push(`portal_account_profiles relationship: ${relationshipResult.error.message}`);

    const duplicateMabns = findDuplicateMabns((duplicateResult.data ?? []) as unknown as Record<string, unknown>[]);
    if (filters.multiAccount === "yes" && duplicateMabns.length === 0) {
      return emptyProfilesResult(filters, page, pageSize, warnings, [], duplicateMabns);
    }

    const matchingAccounts = filters.q ? await findMatchingProfileAccounts(supabase, filters.q, warnings) : { accountIds: [], accountKeys: [] };
    const baseQuery = supabase
      .from("portal_account_profiles")
      .select("account_key,account_id,mabn,display_name,patient_name,relationship,is_default,is_active,verified_at,linked_at,last_selected_at", {
        count: "exact",
      });

    const { data, error, count } = await applyProfileFilters(baseQuery as unknown as ProfileQueryBuilder, filters, duplicateMabns, matchingAccounts)
      .order("linked_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      return emptyProfilesResult(filters, page, pageSize, [`portal_account_profiles: ${error.message}`], uniqueRelationshipOptions(relationshipResult.data), duplicateMabns);
    }

    const total = count ?? 0;
    return {
      warnings,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      filters,
      options: {
        relationships: uniqueRelationshipOptions(relationshipResult.data),
      },
      duplicateMabns,
      rows: mapProfileRows((data ?? []) as unknown as Record<string, unknown>[], duplicateMabns),
    };
  } catch (error) {
    return emptyProfilesResult(filters, page, pageSize, [`portal_account_profiles: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`], [], []);
  }
}

export async function getAdminProfilesModule(): Promise<AdminModuleResult> {
  const result = await getAdminProfiles({ pageSize: 150 });
  return { rows: result.rows, warnings: result.warnings };
}

export async function getAdminSyncJobs(query: AdminSyncJobsQuery = {}): Promise<AdminSyncJobsResult> {
  const warnings: string[] = [];
  const filters = normalizeSyncFilters(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = clamp(Math.floor(query.pageSize ?? 20), 10, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = createSupabaseServiceClient();
    const baseQuery = supabase
      .from("portal_sync_jobs")
      .select("job_id,mabn,resource_name,resource_id,maql,status,attempt_count,max_attempts,requested_by,requested_reason,error_message,run_after,updated_at,created_at", {
        count: "exact",
      });
    const dataQuery = applySyncFilters(baseQuery as unknown as SyncQueryBuilder, filters)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    const [{ data, error, count }, optionsResult, failedResult] = await Promise.all([
      dataQuery,
      supabase.from("portal_sync_jobs").select("status,resource_name").limit(1000),
      supabase.from("portal_sync_jobs").select("job_id", { count: "exact", head: true }).in("status", ["failed", "error"]),
    ]);

    if (error) {
      return emptySyncResult(filters, page, pageSize, [`portal_sync_jobs: ${error.message}`]);
    }
    if (optionsResult.error) warnings.push(`portal_sync_jobs options: ${optionsResult.error.message}`);
    if (failedResult.error) warnings.push(`portal_sync_jobs failed count: ${failedResult.error.message}`);

    const optionRows = (optionsResult.data ?? []) as unknown as Record<string, unknown>[];
    const total = count ?? 0;
    return {
      warnings,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      filters,
      options: {
        statuses: [...new Set(optionRows.map((row) => cleanText(row.status)).filter(Boolean))].sort(),
        resources: [...new Set(optionRows.map((row) => cleanText(row.resource_name)).filter(Boolean))].sort(),
      },
      failedCount: failedResult.count ?? 0,
      rows: mapSyncRows((data ?? []) as unknown as Record<string, unknown>[]),
    };
  } catch (error) {
    return emptySyncResult(filters, page, pageSize, [`portal_sync_jobs: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`]);
  }
}

export async function getAdminSyncJobsModule(): Promise<AdminModuleResult> {
  const result = await getAdminSyncJobs({ pageSize: 150 });
  return { rows: result.rows, warnings: result.warnings };
}

export async function getAdminOtpEvents(query: AdminOtpEventsQuery = {}): Promise<AdminOtpEventsResult> {
  const warnings: string[] = [];
  const filters = normalizeOtpFilters(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = clamp(Math.floor(query.pageSize ?? 20), 10, 100);

  try {
    const supabase = createSupabaseServiceClient();
    const includeLogin = filters.source !== "otp";
    const includeOtp = filters.source !== "login";

    const [loginResult, otpResult, loginOptions, otpOptions, failedOtpResult] = await Promise.all([
      includeLogin ? fetchLoginEventRows(supabase, filters) : Promise.resolve({ data: [], error: null }),
      includeOtp ? fetchOtpAttemptRows(supabase, filters) : Promise.resolve({ data: [], error: null }),
      supabase.from("portal_login_events").select("event_type").limit(500),
      supabase.from("portal_otp_attempts").select("status,provider").limit(500),
      supabase.from("portal_otp_attempts").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);

    if (loginResult.error) warnings.push(`portal_login_events: ${loginResult.error.message}`);
    if (otpResult.error) warnings.push(`portal_otp_attempts: ${otpResult.error.message}`);
    if (loginOptions.error) warnings.push(`portal_login_events options: ${loginOptions.error.message}`);
    if (otpOptions.error) warnings.push(`portal_otp_attempts options: ${otpOptions.error.message}`);
    if (failedOtpResult.error) warnings.push(`portal_otp_attempts failed count: ${failedOtpResult.error.message}`);

    const entries = [
      ...((loginResult.data ?? []) as unknown as Record<string, unknown>[]).map(mapLoginEventEntry),
      ...((otpResult.data ?? []) as unknown as Record<string, unknown>[]).map(mapOtpAttemptEntry),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = entries.length;
    const from = (page - 1) * pageSize;
    const optionOtpRows = (otpOptions.data ?? []) as unknown as Record<string, unknown>[];
    const optionLoginRows = (loginOptions.data ?? []) as unknown as Record<string, unknown>[];

    return {
      warnings,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      filters,
      options: {
        statuses: [...new Set(optionOtpRows.map((row) => cleanText(row.status)).filter(Boolean))].sort(),
        providers: [...new Set(optionOtpRows.map((row) => cleanText(row.provider)).filter(Boolean))].sort(),
        eventTypes: [...new Set(optionLoginRows.map((row) => cleanText(row.event_type)).filter(Boolean))].sort(),
      },
      failedOtpCount: failedOtpResult.count ?? 0,
      entries: entries.slice(from, from + pageSize),
    };
  } catch (error) {
    return emptyOtpResult(filters, page, pageSize, [`OTP/Login events: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`]);
  }
}

export async function getAdminOtpEventsModule(): Promise<AdminModuleResult> {
  const result = await getAdminOtpEvents({ pageSize: 120 });
  return {
    warnings: result.warnings,
    rows: result.entries.map((entry) => ({
      id: entry.id,
      primary: entry.phoneLabel,
      secondary: [entry.title, entry.provider, entry.deviceLabel, entry.ipAddress, entry.message].filter(Boolean).join(" · "),
      meta: formatDate(entry.createdAt),
      status: entry.status,
    })),
  };
}

export async function getAdminSettings(): Promise<AdminSettingsResult> {
  const warnings: string[] = [];
  const rows = await readSupabaseRows(
    "portal_app_settings",
    "setting_key,setting_value,setting_group,label,description,is_secret,updated_by,updated_at",
    "updated_at",
    warnings,
    100,
  );

  const entries = mergeDefaultSettings(rows.map(mapSettingEntry)).sort((a, b) => `${groupOrder(a.group)}-${a.key}`.localeCompare(`${groupOrder(b.group)}-${b.key}`));
  return {
    warnings,
    entries,
    groups: settingGroups(entries),
  };
}

export async function getAdminSettingsModule(): Promise<AdminModuleResult> {
  const result = await getAdminSettings();
  return {
    warnings: result.warnings,
    rows: result.entries.map((entry) => ({
      id: entry.key,
      primary: entry.label,
      secondary: [entry.key, entry.description].filter(Boolean).join(" · "),
      meta: entry.updatedAt ? `Cập nhật ${formatDate(entry.updatedAt)}` : "Chưa cập nhật",
      status: entry.status,
      target: {
        settingKey: entry.key,
        settingValue: entry.isSecret ? "" : entry.value,
      },
      actions: entry.isEditable ? [{ action: "edit_setting", label: "Sửa", tone: "neutral" }] : [],
    })),
  };
}

export async function getAdminContent(query: AdminContentQuery = {}): Promise<AdminContentResult> {
  const warnings: string[] = [];
  const filters = normalizeContentFilters(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = clamp(Math.floor(query.pageSize ?? 20), 10, 80);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = createSupabaseServiceClient();
    const [categoryResult, postOptionsResult] = await Promise.all([
      supabase
        .from("portal_content_categories")
        .select("id,name,description,sort_order,is_active,updated_at")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("portal_content_posts").select("status,category").limit(1000),
    ]);

    if (categoryResult.error) warnings.push(`portal_content_categories: ${categoryResult.error.message}`);
    if (postOptionsResult.error) warnings.push(`portal_content_posts options: ${postOptionsResult.error.message}`);

    const categories = ((categoryResult.data ?? []) as unknown as Record<string, unknown>[]).map(mapContentCategory);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const baseQuery = supabase
      .from("portal_content_posts")
      .select("id,slug,title,excerpt,body,category,cover_image_url,status,is_featured,sort_order,published_at,updated_at,created_at", { count: "exact" });

    const { data, error, count } = await applyContentFilters(baseQuery as unknown as ContentQueryBuilder, filters)
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) return emptyContentResult(filters, page, pageSize, categories, [`portal_content_posts: ${error.message}`]);

    const optionRows = (postOptionsResult.data ?? []) as unknown as Record<string, unknown>[];
    const posts = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => mapContentPost(row, categoryNames));
    const total = count ?? 0;
    return {
      warnings,
      posts,
      categories,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      filters,
      options: {
        statuses: [...new Set(optionRows.map((row) => cleanText(row.status)).filter(Boolean))].sort(),
        categories,
      },
      rows: posts.map((post) => ({
        id: post.id,
        primary: post.title || "Bài viết chưa có tiêu đề",
        secondary: [post.slug, post.categoryName || post.category, post.isFeatured ? "nổi bật" : ""].filter(Boolean).join(" · "),
        meta: post.updatedAt ? `Cập nhật ${formatDate(post.updatedAt)}` : `Tạo ${formatDate(post.createdAt)}`,
        status: post.status,
        target: {
          postId: post.id,
        },
        actions:
          post.status === "published"
            ? [{ action: "archive_content", label: "Ẩn", tone: "neutral" }]
            : [{ action: "publish_content", label: "Xuất bản", tone: "primary" }],
      })),
    };
  } catch (error) {
    return emptyContentResult(filters, page, pageSize, [], [`portal_content_posts: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`]);
  }
}

export async function getAdminContentPost(id: string): Promise<{
  post: AdminContentPost | null;
  categories: AdminContentCategory[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const cleanId = cleanText(id);

  try {
    const supabase = createSupabaseServiceClient();
    const [categoryResult, postResult] = await Promise.all([
      supabase
        .from("portal_content_categories")
        .select("id,name,description,sort_order,is_active,updated_at")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("portal_content_posts")
        .select("id,slug,title,excerpt,body,category,cover_image_url,status,is_featured,sort_order,published_at,updated_at,created_at")
        .eq("id", cleanId)
        .maybeSingle(),
    ]);

    if (categoryResult.error) warnings.push(`portal_content_categories: ${categoryResult.error.message}`);
    if (postResult.error) warnings.push(`portal_content_posts: ${postResult.error.message}`);

    const categories = ((categoryResult.data ?? []) as unknown as Record<string, unknown>[]).map(mapContentCategory);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const post = postResult.data ? mapContentPost(postResult.data as unknown as Record<string, unknown>, categoryNames) : null;
    return { post, categories, warnings };
  } catch (error) {
    return {
      post: null,
      categories: [],
      warnings: [`portal_content_posts: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`],
    };
  }
}

function normalizeContentFilters(query: AdminContentQuery): Required<Omit<AdminContentQuery, "page" | "pageSize">> {
  return {
    q: cleanText(query.q),
    status: cleanText(query.status),
    category: cleanText(query.category),
    featured: cleanText(query.featured),
  };
}

function applyContentFilters(query: ContentQueryBuilder, filters: Required<Omit<AdminContentQuery, "page" | "pageSize">>) {
  let next = query;
  if (filters.q) {
    const keyword = filters.q.replace(/[%,()]/g, " ").trim();
    if (keyword) next = next.or(`title.ilike.%${keyword}%,slug.ilike.%${keyword}%,excerpt.ilike.%${keyword}%`);
  }
  if (filters.status) next = next.eq("status", filters.status);
  if (filters.category) next = next.eq("category", filters.category);
  if (filters.featured === "yes") next = next.eq("is_featured", true);
  if (filters.featured === "no") next = next.eq("is_featured", false);
  return next;
}

function mapContentCategory(row: Record<string, unknown>): AdminContentCategory {
  return {
    id: cleanText(row.id),
    name: cleanText(row.name) || cleanText(row.id) || "Chuyên mục",
    description: cleanText(row.description),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: row.is_active !== false,
    updatedAt: cleanText(row.updated_at),
  };
}

function mapContentPost(row: Record<string, unknown>, categoryNames: Map<string, string>): AdminContentPost {
  const category = cleanText(row.category);
  return {
    id: String(row.id ?? ""),
    slug: cleanText(row.slug),
    title: cleanText(row.title),
    excerpt: cleanText(row.excerpt),
    body: cleanText(row.body),
    category,
    categoryName: categoryNames.get(category) ?? category,
    coverImageUrl: cleanText(row.cover_image_url),
    status: cleanText(row.status) || "draft",
    isFeatured: row.is_featured === true,
    sortOrder: Number(row.sort_order ?? 0),
    publishedAt: cleanText(row.published_at),
    updatedAt: cleanText(row.updated_at),
    createdAt: cleanText(row.created_at),
  };
}

function emptyContentResult(
  filters: Required<Omit<AdminContentQuery, "page" | "pageSize">>,
  page: number,
  pageSize: number,
  categories: AdminContentCategory[],
  warnings: string[],
): AdminContentResult {
  return {
    rows: [],
    posts: [],
    categories,
    warnings,
    total: 0,
    page,
    pageSize,
    pageCount: 1,
    filters,
    options: {
      statuses: [],
      categories,
    },
  };
}

export async function getAdminAuditLogs(query: AdminAuditLogsQuery = {}): Promise<AdminAuditLogsResult> {
  const warnings: string[] = [];
  const filters = normalizeAuditFilters(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = clamp(Math.floor(query.pageSize ?? 20), 10, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = createSupabaseServiceClient();
    const baseQuery = supabase
      .from("portal_admin_audit_logs")
      .select("id,admin_username,action,target_type,target_id,detail_json,ip_address,user_agent,created_at", { count: "exact" });

    const dataQuery = applyAuditFilters(baseQuery as unknown as AuditQueryBuilder, filters)
      .order("created_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    const [{ data, error, count }, optionsResult] = await Promise.all([
      dataQuery,
      supabase.from("portal_admin_audit_logs").select("admin_username,action,target_type").limit(1000),
    ]);

    if (error) {
      return emptyAuditResult(filters, page, pageSize, [`portal_admin_audit_logs: ${error.message}`]);
    }
    if (optionsResult.error) warnings.push(`portal_admin_audit_logs options: ${optionsResult.error.message}`);

    const optionRows = (optionsResult.data ?? []) as unknown as Record<string, unknown>[];
    const total = count ?? 0;
    return {
      warnings,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      filters,
      options: {
        admins: [...new Set(optionRows.map((row) => cleanText(row.admin_username)).filter(Boolean))].sort(),
        actions: [...new Set(optionRows.map((row) => cleanText(row.action)).filter(Boolean))].sort(),
        targetTypes: [...new Set(optionRows.map((row) => cleanText(row.target_type)).filter(Boolean))].sort(),
      },
      entries: mapAuditEntries((data ?? []) as unknown as Record<string, unknown>[]),
    };
  } catch (error) {
    return emptyAuditResult(filters, page, pageSize, [`portal_admin_audit_logs: ${error instanceof Error ? error.message : "Không đọc được dữ liệu"}`]);
  }
}

export async function getAdminAuditLogsModule(): Promise<AdminModuleResult> {
  const result = await getAdminAuditLogs({ pageSize: 150 });
  return {
    warnings: result.warnings,
    rows: result.entries.map((entry) => ({
      id: entry.id,
      primary: `${entry.adminUsername} · ${entry.actionLabel}`,
      secondary: [entry.targetLabel, entry.ipAddress].filter(Boolean).join(" · "),
      meta: formatDate(entry.createdAt),
      status: "audit",
    })),
  };
}

export async function getAdminBookings(query: AdminBookingsQuery = {}): Promise<AdminBookingsResult> {
  const warnings: string[] = [];
  const connectionString = process.env.BOOKING_DATABASE_URL;
  const filters = normalizeBookingFilters(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = clamp(Math.floor(query.pageSize ?? 20), 10, 100);
  const offset = (page - 1) * pageSize;

  if (!connectionString) {
    return emptyBookingsResult(filters, page, pageSize, ["BOOKING_DATABASE_URL chưa cấu hình nên chưa đọc được đăng ký khám."]);
  }

  try {
    const pool = getBookingPool();
    const { whereSql, params } = buildBookingWhere(filters);

    const fromSql = bookingOperationsFromSql();
    const [countResult, rowsResult, optionsResult, statsResult] = await Promise.all([
      pool.query<{ count: string }>(`select count(*)::text as count ${fromSql} ${whereSql}`, params),
      pool.query<{
      id: string;
      patient_code: string | null;
      ma_lich_hen: string | null;
      ho_ten: string | null;
      so_dien_thoai: string | null;
      ngay_kham: string | null;
      gio_kham: string | null;
      khoa_kham: string | null;
      chi_nhanh: string | null;
      status: string | null;
      ngay_tao: string | null;
      his_match_status: string | null;
      his_stt_kham: string | null;
      his_department_name: string | null;
      his_matched_at: string | null;
      his_maql: string | null;
      zalo_confirm_sent_at: string | null;
      outbox_id: string | null;
      outbox_status: string | null;
      outbox_error: string | null;
    }>(
      `
        select
          l.id, l.patient_code, l.ma_lich_hen, l.ho_ten, l.so_dien_thoai, l.ngay_kham::text,
          l.gio_kham, l.khoa_kham, l.chi_nhanh, l.status, l.ngay_tao::text,
          l.his_match_status, l.his_stt_kham, l.his_department_name, l.his_matched_at::text, l.his_maql,
          l.zalo_confirm_sent_at::text,
          n.id::text as outbox_id,
          n.status as outbox_status,
          n.last_error as outbox_error
        ${fromSql}
        ${whereSql}
        order by l.ngay_tao desc nulls last, l.ngay_kham desc nulls last, l.id desc
        limit $${params.length + 1}
        offset $${params.length + 2}
      `,
        [...params, pageSize, offset],
      ),
      pool.query<{
        type: "status" | "department" | "branch";
        value: string | null;
      }>(
        `
          select 'status'::text as type, status as value from portal.lich_hen_kham where status is not null group by status
          union all
          select 'department'::text as type, khoa_kham as value from portal.lich_hen_kham where khoa_kham is not null and trim(khoa_kham) <> '' group by khoa_kham
          union all
          select 'branch'::text as type, chi_nhanh as value from portal.lich_hen_kham where chi_nhanh is not null and trim(chi_nhanh) <> '' group by chi_nhanh
          order by type, value
        `,
      ),
      pool.query<{
        unmatched: string | null;
        matched_unsent_zalo: string | null;
        zalo_error: string | null;
        sla_over_30: string | null;
        sla_over_120: string | null;
        avg_wait_minutes: string | null;
      }>(
        `
          select
            count(*) filter (
              where coalesce(l.his_match_status, 'PENDING') <> 'MATCHED'
                and coalesce(l.status, '') <> 'DA_HUY'
            )::text as unmatched,
            count(*) filter (
              where l.his_match_status = 'MATCHED'
                and l.zalo_confirm_sent_at is null
                and coalesce(n.status, '') <> 'sent'
            )::text as matched_unsent_zalo,
            count(*) filter (
              where coalesce(n.status, '') in ('failed', 'retry')
                 or nullif(n.last_error, '') is not null
            )::text as zalo_error,
            count(*) filter (
              where coalesce(l.his_match_status, 'PENDING') <> 'MATCHED'
                and coalesce(l.status, '') <> 'DA_HUY'
                and l.ngay_tao <= now() - interval '30 minutes'
            )::text as sla_over_30,
            count(*) filter (
              where coalesce(l.his_match_status, 'PENDING') <> 'MATCHED'
                and coalesce(l.status, '') <> 'DA_HUY'
                and l.ngay_tao <= now() - interval '120 minutes'
            )::text as sla_over_120,
            coalesce(round(avg(extract(epoch from (now() - l.ngay_tao)) / 60) filter (
              where coalesce(l.his_match_status, 'PENDING') <> 'MATCHED'
                and coalesce(l.status, '') <> 'DA_HUY'
            )), 0)::text as avg_wait_minutes
          ${fromSql}
        `,
      ),
    ]);

    const total = Number(countResult.rows[0]?.count ?? 0);
    const statsRow = statsResult.rows[0];
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const options = {
      statuses: optionsResult.rows.filter((row) => row.type === "status" && row.value).map((row) => String(row.value)),
      departments: optionsResult.rows.filter((row) => row.type === "department" && row.value).map((row) => String(row.value)),
      branches: optionsResult.rows.filter((row) => row.type === "branch" && row.value).map((row) => String(row.value)),
    };

    return {
      warnings,
      total,
      page,
      pageSize,
      pageCount,
      filters,
      stats: {
        unmatched: Number(statsRow?.unmatched ?? 0),
        matchedUnsentZalo: Number(statsRow?.matched_unsent_zalo ?? 0),
        zaloError: Number(statsRow?.zalo_error ?? 0),
        slaOver30: Number(statsRow?.sla_over_30 ?? 0),
        slaOver120: Number(statsRow?.sla_over_120 ?? 0),
        avgWaitMinutes: Number(statsRow?.avg_wait_minutes ?? 0),
      },
      options,
      rows: rowsResult.rows.map((row) => ({
        id: row.id,
        primary: row.ho_ten || "Chưa có tên",
        secondary: [
          row.ma_lich_hen,
          row.khoa_kham,
          row.ngay_kham,
          row.gio_kham,
          row.chi_nhanh,
          row.his_match_status ? `HIS ${row.his_match_status}` : "",
          row.his_stt_kham ? `STT ${row.his_stt_kham}` : "",
          row.outbox_status ? `Zalo ${row.outbox_status}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        meta: [
          row.ngay_tao ? `Tạo ${formatDate(row.ngay_tao)}` : "",
          maskPhone(row.so_dien_thoai),
          row.zalo_confirm_sent_at ? `ZNS ${formatDate(row.zalo_confirm_sent_at)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/admin/bookings/${row.id}`,
        status: row.his_match_status === "MATCHED" ? "MATCHED HIS" : row.status ?? "CHO_DUYET",
        entity: "booking",
        target: {
          bookingId: row.id,
          bookingCode: row.ma_lich_hen ?? "",
          outboxId: row.outbox_id ?? "",
        },
        details: {
          bookingCode: row.ma_lich_hen ?? "",
          patientCode: row.patient_code ?? "",
          phone: maskPhone(row.so_dien_thoai),
          rawPhone: row.so_dien_thoai ?? "",
          appointmentDate: row.ngay_kham ?? "",
          appointmentTime: row.gio_kham ?? "",
          department: row.khoa_kham ?? "",
          branch: row.chi_nhanh ?? "",
          createdAt: row.ngay_tao ? formatDate(row.ngay_tao) : "",
          hisStatus: row.his_match_status ?? "",
          hisTicket: row.his_stt_kham ?? "",
          hisDepartment: row.his_department_name ?? "",
          hisMaql: row.his_maql ?? "",
          hisMatchedAt: row.his_matched_at ? formatDate(row.his_matched_at) : "",
          zaloSentAt: row.zalo_confirm_sent_at ? formatDate(row.zalo_confirm_sent_at) : "",
          outboxId: row.outbox_id ?? "",
          outboxStatus: row.outbox_status ?? "",
          outboxError: row.outbox_error ?? "",
        },
        actions: bookingActionsForRow({
          status: row.status,
          hisMatchStatus: row.his_match_status,
          outboxId: row.outbox_id,
          outboxStatus: row.outbox_status,
        }),
      })),
    };
  } catch (error) {
    return emptyBookingsResult(filters, page, pageSize, [`portal.lich_hen_kham: ${error instanceof Error ? error.message : "Không đọc được booking DB"}`]);
  }
}

function bookingActionsForRow(row: { status: string | null; hisMatchStatus: string | null; outboxId: string | null; outboxStatus: string | null }): AdminRowAction[] {
  const actions: AdminRowAction[] = [];
  const status = row.status ?? "";
  const hisStatus = row.hisMatchStatus ?? "";
  const outboxStatus = row.outboxStatus ?? "";

  if (["CHO_DUYET", "CHO_DUYET_LAI"].includes(status)) {
    actions.push(
      { action: "approve_booking", label: "Xác nhận", tone: "primary" },
      { action: "cancel_booking", label: "Hủy", tone: "danger", confirm: "Hủy lịch đăng ký khám này?" },
    );
  }

  if (hisStatus && hisStatus !== "MATCHED") {
    actions.push({ action: "retry_booking_match", label: "Retry HIS", tone: "neutral" });
  }

  if (row.outboxId && outboxStatus !== "sent") {
    actions.push({ action: "send_booking_zalo", label: "Gửi Zalo", tone: "primary" });
  } else if (!row.outboxId && hisStatus === "MATCHED") {
    actions.push({ action: "send_booking_zalo", label: "Tạo Zalo", tone: "primary" });
  }

  return actions;
}

function normalizeAccountFilters(query: AdminAccountsQuery): Required<Omit<AdminAccountsQuery, "page" | "pageSize">> {
  return {
    q: cleanText(query.q),
    status: cleanText(query.status),
    phoneVerified: cleanText(query.phoneVerified),
    passwordSet: cleanText(query.passwordSet),
  };
}

function applyAccountFilters(
  query: AccountQueryBuilder,
  filters: Required<Omit<AdminAccountsQuery, "page" | "pageSize">>,
) {
  let next = query;
  if (filters.q) {
    const search = sanitizePostgrestSearch(filters.q);
    next = next.or(
      [
        `full_name.ilike.%${search}%`,
        `display_name.ilike.%${search}%`,
        `phone_masked.ilike.%${search}%`,
        `phone.ilike.%${search}%`,
        `primary_mabn.ilike.%${search}%`,
      ].join(","),
    );
  }
  if (filters.status) next = next.eq("status", filters.status);
  if (filters.phoneVerified === "yes") next = next.not("phone_verified_at", "is", null);
  if (filters.phoneVerified === "no") next = next.is("phone_verified_at", null);
  if (filters.passwordSet === "yes") next = next.not("password_set_at", "is", null);
  if (filters.passwordSet === "no") next = next.is("password_set_at", null);
  return next;
}

function mapAccountRows(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => ({
    id: String(row.id ?? row.account_key ?? crypto.randomUUID()),
    primary: String(row.full_name ?? row.display_name ?? "Tài khoản chưa đặt tên"),
    secondary: [
      `SĐT ${row.phone_masked ?? maskPhone(row.phone)}`,
      row.primary_mabn ? `MABN ${row.primary_mabn}` : "",
      row.phone_verified_at ? "đã xác minh SĐT" : "chưa xác minh SĐT",
      row.password_set_at ? "đã đặt mật khẩu" : "chưa đặt mật khẩu",
    ]
      .filter(Boolean)
      .join(" · "),
    meta: row.last_login_at ? `Đăng nhập ${formatDate(row.last_login_at)}` : `Tạo ${formatDate(row.created_at)}`,
    href: `/admin/accounts/${encodeURIComponent(String(row.id ?? row.account_key ?? ""))}`,
    status: String(row.status ?? "active"),
    entity: "account",
    target: {
      accountId: String(row.id ?? ""),
      accountKey: String(row.account_key ?? ""),
    },
    actions: accountActionsForStatus(String(row.status ?? "active")),
  }));
}

function accountActionsForStatus(status: string): AdminRowAction[] {
  if (status === "deleted") return [];
  if (status === "locked") return [{ action: "unlock_account", label: "Mở khóa", tone: "primary" }];
  return [
    { action: "lock_account", label: "Khóa", tone: "danger" },
    { action: "delete_account", label: "Xóa mềm", tone: "danger" },
  ];
}

function emptyAccountsResult(
  filters: Required<Omit<AdminAccountsQuery, "page" | "pageSize">>,
  page: number,
  pageSize: number,
  warnings: string[],
): AdminAccountsResult {
  return {
    rows: [],
    warnings,
    total: 0,
    page,
    pageSize,
    pageCount: 1,
    filters,
    options: { statuses: [] },
  };
}

function normalizeProfileFilters(query: AdminProfilesQuery): Required<Omit<AdminProfilesQuery, "page" | "pageSize">> {
  return {
    q: cleanText(query.q),
    relationship: cleanText(query.relationship),
    verified: cleanText(query.verified),
    active: cleanText(query.active),
    multiAccount: cleanText(query.multiAccount),
  };
}

function applyProfileFilters(
  query: ProfileQueryBuilder,
  filters: Required<Omit<AdminProfilesQuery, "page" | "pageSize">>,
  duplicateMabns: string[],
  matchingAccounts: { accountIds: string[]; accountKeys: string[] },
) {
  let next = query;
  if (filters.q) {
    const search = sanitizePostgrestSearch(filters.q);
    const orFilters = [`mabn.ilike.%${search}%`, `display_name.ilike.%${search}%`, `patient_name.ilike.%${search}%`, `account_key.ilike.%${search}%`];
    if (matchingAccounts.accountIds.length > 0) orFilters.push(`account_id.in.(${matchingAccounts.accountIds.join(",")})`);
    if (matchingAccounts.accountKeys.length > 0) orFilters.push(`account_key.in.(${matchingAccounts.accountKeys.map(sanitizePostgrestSearch).join(",")})`);
    next = next.or(orFilters.join(","));
  }
  if (filters.relationship) next = next.eq("relationship", filters.relationship);
  if (filters.verified === "yes") next = next.not("verified_at", "is", null);
  if (filters.verified === "no") next = next.is("verified_at", null);
  if (filters.active === "yes") next = next.eq("is_active", true);
  if (filters.active === "no") next = next.eq("is_active", false);
  if (filters.multiAccount === "yes") next = next.in("mabn", duplicateMabns);
  return next;
}

function mapProfileRows(rows: Record<string, unknown>[], duplicateMabns: string[]): AdminRow[] {
  const duplicateSet = new Set(duplicateMabns);
  return rows.map((row) => {
    const mabn = String(row.mabn ?? "");
    const duplicated = duplicateSet.has(mabn);
    return {
      id: `${row.account_id ?? row.account_key ?? "account"}-${mabn || crypto.randomUUID()}`,
      primary: String(row.display_name ?? row.patient_name ?? "Hồ sơ chưa có tên"),
      secondary: [
        `Mã BN ${mabn || "?"}`,
        row.relationship ?? "Chưa ghi quan hệ",
        row.verified_at ? "đã xác minh" : "chưa xác minh",
        row.account_key ? `TK ${row.account_key}` : "",
        duplicated ? "liên kết nhiều tài khoản" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      meta: row.last_selected_at ? `Chọn ${formatDate(row.last_selected_at)}` : `Liên kết ${formatDate(row.linked_at)}`,
      href: `/admin/profiles/${encodeURIComponent(mabn)}`,
      status: duplicated ? "nhiều tài khoản" : row.is_active ? "đang xem" : row.is_default ? "mặc định" : undefined,
      entity: "profile" as const,
      target: {
        accountId: String(row.account_id ?? ""),
        accountKey: String(row.account_key ?? ""),
        mabn,
      },
      actions: row.is_default ? [] : [{ action: "unlink_profile", label: "Gỡ", tone: "danger" as const }],
    };
  });
}

function findDuplicateMabns(rows: Record<string, unknown>[]) {
  const accountsByMabn = new Map<string, Set<string>>();
  for (const row of rows) {
    const mabn = cleanText(row.mabn);
    if (!mabn) continue;
    const account = cleanText(row.account_id) || cleanText(row.account_key);
    if (!account) continue;
    const accounts = accountsByMabn.get(mabn) ?? new Set<string>();
    accounts.add(account);
    accountsByMabn.set(mabn, accounts);
  }
  return [...accountsByMabn.entries()]
    .filter(([, accounts]) => accounts.size > 1)
    .map(([mabn]) => mabn)
    .sort();
}

function uniqueRelationshipOptions(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return [...new Set(rows.map((row) => cleanText((row as Record<string, unknown>).relationship)).filter(Boolean))].sort();
}

async function findMatchingProfileAccounts(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  value: string,
  warnings: string[],
) {
  const search = sanitizePostgrestSearch(value);
  const { data, error } = await supabase
    .from("portal_accounts")
    .select("id,account_key")
    .or([`full_name.ilike.%${search}%`, `display_name.ilike.%${search}%`, `phone_masked.ilike.%${search}%`, `phone.ilike.%${search}%`, `account_key.ilike.%${search}%`].join(","))
    .limit(200);

  if (error) {
    warnings.push(`portal_accounts search: ${error.message}`);
    return { accountIds: [], accountKeys: [] };
  }

  return {
    accountIds: [...new Set((data ?? []).map((row) => cleanText(row.id)).filter(isUuid))],
    accountKeys: [...new Set((data ?? []).map((row) => cleanText(row.account_key)).filter(Boolean))],
  };
}

function emptyProfilesResult(
  filters: Required<Omit<AdminProfilesQuery, "page" | "pageSize">>,
  page: number,
  pageSize: number,
  warnings: string[],
  relationships: string[],
  duplicateMabns: string[],
): AdminProfilesResult {
  return {
    rows: [],
    warnings,
    total: 0,
    page,
    pageSize,
    pageCount: 1,
    filters,
    options: { relationships },
    duplicateMabns,
  };
}

function normalizeSyncFilters(query: AdminSyncJobsQuery): Required<Omit<AdminSyncJobsQuery, "page" | "pageSize">> {
  return {
    q: cleanText(query.q),
    status: cleanText(query.status),
    resourceName: cleanText(query.resourceName),
    dateFrom: cleanDate(query.dateFrom),
    dateTo: cleanDate(query.dateTo),
  };
}

function applySyncFilters(query: SyncQueryBuilder, filters: Required<Omit<AdminSyncJobsQuery, "page" | "pageSize">>) {
  let next = query;
  if (filters.q) {
    const search = sanitizePostgrestSearch(filters.q);
    const orFilters = [
      `mabn.ilike.%${search}%`,
      `resource_name.ilike.%${search}%`,
      `resource_id.ilike.%${search}%`,
      `maql.ilike.%${search}%`,
      `requested_reason.ilike.%${search}%`,
      `error_message.ilike.%${search}%`,
    ];
    if (/^\d+$/.test(filters.q)) orFilters.push(`job_id.eq.${Number(filters.q)}`);
    next = next.or(orFilters.join(","));
  }
  if (filters.status) next = next.eq("status", filters.status);
  if (filters.resourceName) next = next.eq("resource_name", filters.resourceName);
  if (filters.dateFrom) next = next.gte("updated_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) next = next.lte("updated_at", `${filters.dateTo}T23:59:59`);
  return next;
}

function mapSyncRows(rows: Record<string, unknown>[]): AdminRow[] {
  return rows.map((row) => {
    const status = String(row.status ?? "queued");
    const error = summarizeSyncError(row.error_message);
    const attempt = Number(row.attempt_count ?? 0);
    const maxAttempt = Number(row.max_attempts ?? 3);
    return {
      id: String(row.job_id ?? crypto.randomUUID()),
      primary: `${row.mabn ?? "?"} · ${syncResourceLabel(row.resource_name)}`,
      secondary: [
        row.resource_id ? `ID ${row.resource_id}` : "",
        row.maql ? `MAQL ${row.maql}` : "",
        `Thử ${attempt}/${maxAttempt}`,
        error ? `Lỗi: ${error}` : row.requested_reason ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
      meta: row.updated_at ? `Cập nhật ${formatDate(row.updated_at)}` : `Tạo ${formatDate(row.created_at)}`,
      href: `/admin/sync/${encodeURIComponent(String(row.job_id ?? ""))}`,
      status,
      entity: "sync" as const,
      target: {
        jobId: String(row.job_id ?? ""),
        mabn: String(row.mabn ?? ""),
        resourceName: String(row.resource_name ?? "all"),
        resourceId: String(row.resource_id ?? ""),
        maql: String(row.maql ?? ""),
      },
      actions: shouldShowRetry(status, attempt, maxAttempt) ? [{ action: "retry_sync", label: "Retry", tone: "primary" as const }] : [],
    };
  });
}

function shouldShowRetry(status: string, attempt: number, maxAttempt: number) {
  const normalized = status.toLowerCase();
  return normalized.includes("fail") || normalized.includes("error") || normalized.includes("stuck") || attempt >= maxAttempt;
}

function syncResourceLabel(value: unknown) {
  const text = cleanText(value) || "all";
  const labels: Record<string, string> = {
    patient_profile: "Hồ sơ bệnh nhân",
    visits: "Lịch sử khám",
    today_visit: "Khám hôm nay",
    lab_results: "Xét nghiệm",
    imaging: "CĐHA",
    prescriptions: "Đơn thuốc",
    appointments: "Lịch hẹn",
    registrations: "Đăng ký khám",
    insurance: "BHYT",
    all: "Tất cả dữ liệu",
  };
  return labels[text] ?? text;
}

export function summarizeSyncError(value: unknown) {
  const text = cleanText(value);
  if (!text) return "";
  const compact = text.replace(/\s+/g, " ").trim();
  const lowered = compact.toLowerCase();
  if (lowered.includes("ora-01017")) return "Sai tài khoản hoặc mật khẩu Oracle";
  if (lowered.includes("ora-12154")) return "Không resolve được TNS/Oracle service";
  if (lowered.includes("ora-12514") || lowered.includes("ora-12541")) return "Không kết nối được Oracle listener/service";
  if (lowered.includes("timeout")) return "Quá thời gian chờ khi đồng bộ";
  if (lowered.includes("permission") || lowered.includes("privilege")) return "Thiếu quyền đọc dữ liệu nguồn";
  if (lowered.includes("duplicate")) return "Dữ liệu trùng khóa khi ghi snapshot";
  if (lowered.includes("network") || lowered.includes("connection")) return "Lỗi mạng/kết nối tới hệ thống nguồn";
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

function emptySyncResult(
  filters: Required<Omit<AdminSyncJobsQuery, "page" | "pageSize">>,
  page: number,
  pageSize: number,
  warnings: string[],
): AdminSyncJobsResult {
  return {
    rows: [],
    warnings,
    total: 0,
    page,
    pageSize,
    pageCount: 1,
    filters,
    options: { statuses: [], resources: [] },
    failedCount: 0,
  };
}

function normalizeAuditFilters(query: AdminAuditLogsQuery): Required<Omit<AdminAuditLogsQuery, "page" | "pageSize">> {
  return {
    q: cleanText(query.q),
    admin: cleanText(query.admin),
    action: cleanText(query.action),
    targetType: cleanText(query.targetType),
    dateFrom: cleanDate(query.dateFrom),
    dateTo: cleanDate(query.dateTo),
  };
}

function applyAuditFilters(query: AuditQueryBuilder, filters: Required<Omit<AdminAuditLogsQuery, "page" | "pageSize">>) {
  let next = query;
  if (filters.q) {
    const search = sanitizePostgrestSearch(filters.q);
    const orFilters = [
      `admin_username.ilike.%${search}%`,
      `action.ilike.%${search}%`,
      `target_type.ilike.%${search}%`,
      `target_id.ilike.%${search}%`,
      `ip_address.ilike.%${search}%`,
    ];
    if (/^\d+$/.test(filters.q)) orFilters.push(`id.eq.${Number(filters.q)}`);
    next = next.or(orFilters.join(","));
  }
  if (filters.admin) next = next.eq("admin_username", filters.admin);
  if (filters.action) next = next.eq("action", filters.action);
  if (filters.targetType) next = next.eq("target_type", filters.targetType);
  if (filters.dateFrom) next = next.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) next = next.lte("created_at", `${filters.dateTo}T23:59:59`);
  return next;
}

function mapAuditEntries(rows: Record<string, unknown>[]): AdminAuditEntry[] {
  return rows.map((row) => {
    const detailJson = toPlainObject(row.detail_json);
    const action = cleanText(row.action) || "action";
    const targetType = cleanText(row.target_type) || "target";
    const targetId = cleanText(row.target_id);
    return {
      id: String(row.id ?? crypto.randomUUID()),
      adminUsername: cleanText(row.admin_username) || "admin",
      action,
      actionLabel: auditActionLabel(action),
      targetType,
      targetId,
      targetLabel: auditTargetLabel(targetType, targetId, detailJson),
      detailText: auditDetailText(action, detailJson),
      detailJson,
      ipAddress: cleanText(row.ip_address) || "Không ghi IP",
      userAgent: cleanText(row.user_agent) || "Không ghi thiết bị",
      createdAt: cleanText(row.created_at),
    };
  });
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    lock_account: "Khóa tài khoản",
    unlock_account: "Mở khóa tài khoản",
    unlink_profile: "Gỡ hồ sơ liên kết",
    retry_sync: "Retry sync",
    approve_booking: "Xác nhận lịch khám",
    cancel_booking: "Hủy lịch khám",
    retry_booking_match: "Retry đối soát HIS",
    send_booking_zalo: "Gửi Zalo",
    test_zns_template: "Test ZNS template",
    edit_setting: "Sửa cấu hình",
    publish_content: "Xuất bản bài viết",
    archive_content: "Ẩn bài viết",
    create_content: "Tạo bài viết",
    update_content: "Sửa bài viết",
    upsert_content_category: "Sửa chuyên mục",
  };
  return labels[action] ?? action;
}

function auditTargetLabel(targetType: string, targetId: string, detail: Record<string, unknown>) {
  const labels: Record<string, string> = {
    account: "Tài khoản",
    profile: "Hồ sơ",
    sync_job: "Sync job",
    booking: "Lịch khám",
    notification: "Tin nhắn",
    setting: "Cấu hình",
    content: "Bài viết",
    content_category: "Chuyên mục",
  };
  const id =
    targetId ||
    cleanText(detail.bookingId) ||
    cleanText(detail.jobId) ||
    cleanText(detail.mabn) ||
    cleanText(detail.accountId) ||
    cleanText(detail.accountKey) ||
    cleanText(detail.settingKey) ||
    cleanText(detail.postId) ||
    cleanText(detail.categoryId);
  return [labels[targetType] ?? targetType, id].filter(Boolean).join(" · ");
}

function auditDetailText(action: string, detail: Record<string, unknown>) {
  const note = cleanText(detail.note);
  if (note) return note;
  if (action === "retry_sync") {
    return [`MABN ${cleanText(detail.mabn) || "?"}`, `Resource ${cleanText(detail.resourceName) || "all"}`, cleanText(detail.resourceId) ? `ID ${cleanText(detail.resourceId)}` : "", cleanText(detail.maql) ? `MAQL ${cleanText(detail.maql)}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  if (action === "lock_account" || action === "unlock_account") {
    return [cleanText(detail.accountId), cleanText(detail.accountKey)].filter(Boolean).join(" · ") || "Thao tác tài khoản";
  }
  if (action === "unlink_profile") {
    return [`MABN ${cleanText(detail.mabn) || "?"}`, cleanText(detail.accountId) || cleanText(detail.accountKey)].filter(Boolean).join(" · ");
  }
  if (action === "approve_booking" || action === "cancel_booking") {
    return [cleanText(detail.bookingCode), cleanText(detail.bookingId)].filter(Boolean).join(" · ") || "Thao tác lịch khám";
  }
  if (action === "create_content" || action === "update_content" || action === "upsert_content_category") {
    return [cleanText(detail.title) || cleanText(detail.name), cleanText(detail.status), cleanText(detail.isFeatured) === "true" ? "nổi bật" : ""].filter(Boolean).join(" · ") || "Thao tác nội dung";
  }
  return "Không có ghi chú chi tiết.";
}

function toPlainObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function emptyAuditResult(
  filters: Required<Omit<AdminAuditLogsQuery, "page" | "pageSize">>,
  page: number,
  pageSize: number,
  warnings: string[],
): AdminAuditLogsResult {
  return {
    entries: [],
    warnings,
    total: 0,
    page,
    pageSize,
    pageCount: 1,
    filters,
    options: { admins: [], actions: [], targetTypes: [] },
  };
}

function normalizeOtpFilters(query: AdminOtpEventsQuery): Required<Omit<AdminOtpEventsQuery, "page" | "pageSize">> {
  return {
    q: cleanText(query.q),
    source: cleanText(query.source),
    status: cleanText(query.status),
    provider: cleanText(query.provider),
    device: cleanText(query.device),
    ip: cleanText(query.ip),
    dateFrom: cleanDate(query.dateFrom),
    dateTo: cleanDate(query.dateTo),
  };
}

async function fetchLoginEventRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  filters: Required<Omit<AdminOtpEventsQuery, "page" | "pageSize">>,
) {
  let query = supabase.from("portal_login_events").select("id,phone_masked,event_type,device_label,user_agent,ip_address,created_at");
  if (filters.q) {
    const search = sanitizePostgrestSearch(filters.q);
    query = query.or([`phone_masked.ilike.%${search}%`, `event_type.ilike.%${search}%`, `device_label.ilike.%${search}%`, `ip_address.ilike.%${search}%`, `user_agent.ilike.%${search}%`].join(","));
  }
  if (filters.status) query = query.eq("event_type", filters.status);
  if (filters.device) query = query.or([`device_label.ilike.%${sanitizePostgrestSearch(filters.device)}%`, `user_agent.ilike.%${sanitizePostgrestSearch(filters.device)}%`].join(","));
  if (filters.ip) query = query.ilike("ip_address", `%${sanitizePostgrestSearch(filters.ip)}%`);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
  return query.order("created_at", { ascending: false, nullsFirst: false }).limit(1000);
}

async function fetchOtpAttemptRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  filters: Required<Omit<AdminOtpEventsQuery, "page" | "pageSize">>,
) {
  let query = supabase.from("portal_otp_attempts").select("id,phone_masked,phone,purpose,provider,status,send_result,attempt_count,max_attempts,created_at,expires_at,consumed_at");
  if (filters.q) {
    const search = sanitizePostgrestSearch(filters.q);
    query = query.or([`phone.ilike.%${search}%`, `phone_masked.ilike.%${search}%`, `purpose.ilike.%${search}%`, `provider.ilike.%${search}%`, `status.ilike.%${search}%`].join(","));
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.provider) query = query.eq("provider", filters.provider);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
  return query.order("created_at", { ascending: false, nullsFirst: false }).limit(1000);
}

function mapLoginEventEntry(row: Record<string, unknown>): AdminOtpEventEntry {
  return {
    id: `login-${String(row.id ?? crypto.randomUUID())}`,
    source: "login",
    phoneLabel: cleanText(row.phone_masked) || "Tài khoản",
    title: loginEventLabel(row.event_type),
    status: cleanText(row.event_type) || "login",
    provider: "session",
    deviceLabel: cleanText(row.device_label) || summarizeUserAgent(row.user_agent),
    ipAddress: cleanText(row.ip_address) || "Không ghi IP",
    attemptText: "",
    message: "Tạo phiên đăng nhập portal.",
    technicalJson: {
      event_type: row.event_type,
      device_label: row.device_label,
      user_agent: row.user_agent,
      ip_address: row.ip_address,
    },
    createdAt: cleanText(row.created_at),
    expiresAt: "",
  };
}

function mapOtpAttemptEntry(row: Record<string, unknown>): AdminOtpEventEntry {
  const sendResult = toPlainObject(row.send_result);
  return {
    id: `otp-${String(row.id ?? crypto.randomUUID())}`,
    source: "otp",
    phoneLabel: cleanText(row.phone_masked) || maskPhone(row.phone),
    title: `OTP ${cleanText(row.purpose) || "login"}`,
    status: cleanText(row.status) || "pending",
    provider: cleanText(row.provider) || "test",
    deviceLabel: "",
    ipAddress: "",
    attemptText: `${String(row.attempt_count ?? 0)}/${String(row.max_attempts ?? 5)}`,
    message: summarizeOtpSendResult(sendResult, row.status),
    technicalJson: {
      purpose: row.purpose,
      provider: row.provider,
      status: row.status,
      send_result: sendResult,
      attempt_count: row.attempt_count,
      max_attempts: row.max_attempts,
      consumed_at: row.consumed_at,
    },
    createdAt: cleanText(row.created_at),
    expiresAt: cleanText(row.expires_at),
  };
}

function loginEventLabel(value: unknown) {
  const text = cleanText(value) || "login";
  const labels: Record<string, string> = {
    login: "Đăng nhập",
    otp_login: "Đăng nhập OTP",
    password_login: "Đăng nhập mật khẩu",
    logout: "Đăng xuất",
    logout_all: "Đăng xuất tất cả",
  };
  return labels[text] ?? text;
}

function summarizeUserAgent(value: unknown) {
  const text = cleanText(value);
  if (!text) return "Không ghi thiết bị";
  if (/iphone|ipad|ios/i.test(text)) return "iOS / Safari";
  if (/android/i.test(text)) return "Android";
  if (/windows/i.test(text)) return "Windows";
  if (/macintosh|mac os/i.test(text)) return "macOS";
  return text.length > 42 ? `${text.slice(0, 39)}...` : text;
}

function summarizeOtpSendResult(sendResult: Record<string, unknown>, status: unknown) {
  const statusText = cleanText(status);
  const message = cleanText(sendResult.message) || cleanText(sendResult.error) || cleanText(sendResult.error_message);
  const code = cleanText(sendResult.error_code) || cleanText(sendResult.code);
  if (statusText === "verified") return "OTP đã xác minh thành công.";
  if (statusText === "sent") return message || "OTP đã gửi thành công.";
  if (statusText === "failed") {
    if (code) return `Gửi OTP lỗi ${code}${message ? `: ${message}` : ""}`;
    return message || "Gửi OTP thất bại.";
  }
  if (message) return message;
  return "Đang chờ xử lý OTP.";
}

function emptyOtpResult(
  filters: Required<Omit<AdminOtpEventsQuery, "page" | "pageSize">>,
  page: number,
  pageSize: number,
  warnings: string[],
): AdminOtpEventsResult {
  return {
    entries: [],
    warnings,
    total: 0,
    page,
    pageSize,
    pageCount: 1,
    filters,
    options: { statuses: [], providers: [], eventTypes: [] },
    failedOtpCount: 0,
  };
}

function mapSettingEntry(row: Record<string, unknown>): AdminSettingEntry {
  const key = cleanText(row.setting_key);
  const value = String(row.setting_value ?? "");
  const isSecret = Boolean(row.is_secret) || looksLikeSecretKey(key);
  const group = settingDisplayGroup(key, cleanText(row.setting_group));
  const meta = settingInputMeta(key);
  return {
    key,
    value: isSecret ? "" : value,
    displayValue: isSecret ? "Đã ẩn bảo mật" : value || "Chưa cấu hình",
    group,
    groupLabel: settingGroupLabel(group),
    label: cleanText(row.label) || key || "Cấu hình",
    description: cleanText(row.description) || settingDescription(key),
    isSecret,
    isEditable: !isSecret,
    updatedBy: cleanText(row.updated_by) || "system",
    updatedAt: cleanText(row.updated_at),
    status: isSecret ? "secret" : value ? "ok" : "missing",
    inputType: meta.inputType,
    options: meta.options,
    validationHint: meta.validationHint,
  };
}

function mergeDefaultSettings(entries: AdminSettingEntry[]) {
  const existing = new Set(entries.map((entry) => entry.key));
  const defaults: AdminSettingEntry[] = [
    {
      key: "booking.zalo_auto_send_enabled",
      value: "false",
      displayValue: "false",
      group: "booking",
      groupLabel: settingGroupLabel("booking"),
      label: "Tự động gửi Zalo khi HIS xác nhận",
      description: "OFF: chỉ tạo tin nhắn pending để admin kiểm tra và gửi thủ công. ON: worker tự gửi khi booking đã match HIS.",
      isSecret: false,
      isEditable: true,
      updatedBy: "default",
      updatedAt: "",
      status: "missing",
      inputType: "boolean",
      options: ["true", "false"],
      validationHint: "Khuyến nghị để false trong lúc Zalo template đang chờ duyệt.",
    },
    {
      key: "zalo.template.booking_his_confirmed",
      value: "",
      displayValue: "Chưa cấu hình",
      group: "zalo",
      groupLabel: settingGroupLabel("zalo"),
      label: "Template Zalo xác nhận HIS",
      description: "Template ID dùng cho tin nhắn xác nhận đăng ký đã vào HIS, có STT và phòng khám.",
      isSecret: false,
      isEditable: true,
      updatedBy: "default",
      updatedAt: "",
      status: "missing",
      inputType: "number",
      options: [],
      validationHint: "Nhập Template ID đã được Zalo duyệt, ví dụ 628108.",
    },
  ];
  return [...entries, ...defaults.filter((entry) => !existing.has(entry.key))];
}

function settingGroups(entries: AdminSettingEntry[]) {
  const knownGroups = ["auth", "zalo", "booking", "sync", "content"];
  const extraGroups = [...new Set(entries.map((entry) => entry.group).filter((group) => !knownGroups.includes(group)))].sort();
  return [...knownGroups, ...extraGroups].map((id) => {
    const items = entries.filter((entry) => entry.group === id);
    return {
      id,
      label: settingGroupLabel(id),
      count: items.length,
      missing: items.filter((entry) => entry.status === "missing").length,
    };
  });
}

function settingDisplayGroup(key: string, storedGroup: string) {
  const text = `${key} ${storedGroup}`.toLowerCase();
  if (text.includes("zalo") || text.includes("zns")) return "zalo";
  if (text.includes("booking") || text.includes("lich_hen") || text.includes("appointment")) return "booking";
  if (text.includes("sync") || text.includes("patient_api") || text.includes("patientapi") || text.includes("data_mode")) return "sync";
  if (text.includes("content") || text.includes("guide") || text.includes("hospital")) return "content";
  if (text.includes("auth") || text.includes("otp") || text.includes("turnstile") || text.includes("security")) return "auth";
  return storedGroup || "general";
}

function settingGroupLabel(group: string) {
  const labels: Record<string, string> = {
    auth: "Auth / Bảo mật",
    zalo: "Zalo ZNS",
    booking: "Booking",
    sync: "Sync HIS",
    content: "Content",
    support: "Hỗ trợ",
    security: "Bảo mật",
    general: "Chung",
  };
  return labels[group] ?? group;
}

function groupOrder(group: string) {
  const order = ["auth", "zalo", "booking", "sync", "content", "support", "security", "general"];
  const index = order.indexOf(group);
  return String(index === -1 ? 99 : index).padStart(2, "0");
}

function settingInputMeta(key: string): Pick<AdminSettingEntry, "inputType" | "options" | "validationHint"> {
  if (key === "auth.otp_provider") return { inputType: "select", options: ["test", "zalo", "off"], validationHint: "Chọn test, zalo hoặc off." };
  if (key === "auth.otp_ttl_minutes") return { inputType: "number", options: [], validationHint: "Nhập số phút từ 1 đến 30." };
  if (key === "booking.zalo_auto_send_enabled") return { inputType: "boolean", options: ["true", "false"], validationHint: "Khuyến nghị false khi template Zalo đang chờ duyệt." };
  if (key === "zalo.template.booking_his_confirmed") return { inputType: "number", options: [], validationHint: "Nhập Template ID đã được Zalo duyệt, ví dụ 628108." };
  if (key.includes("enabled")) return { inputType: "boolean", options: ["true", "false"], validationHint: "Chọn true hoặc false." };
  if (key.includes("url") || key.includes("endpoint")) return { inputType: "url", options: [], validationHint: "Nhập URL bắt đầu bằng http:// hoặc https://." };
  if (key.includes("template_id") || key.includes("max_attempts") || key.includes("ttl")) return { inputType: "number", options: [], validationHint: "Nhập số nguyên hợp lệ." };
  if (key.includes("description") || key.includes("message") || key.includes("notice")) return { inputType: "textarea", options: [], validationHint: "Nhập nội dung hiển thị cho người dùng." };
  return { inputType: "text", options: [], validationHint: "Nhập giá trị cấu hình." };
}

function settingDescription(key: string) {
  const descriptions: Record<string, string> = {
    "auth.otp_provider": "Nhà cung cấp OTP dùng cho portal.",
    "auth.otp_ttl_minutes": "Thời hạn OTP còn hiệu lực, tính bằng phút.",
    "security.turnstile_enabled": "Bật/tắt xác thực chống bot ở form nhạy cảm.",
    "support.hotline_primary": "Hotline chính hiển thị ở nút hỗ trợ.",
  };
  return descriptions[key] ?? "Cấu hình vận hành của portal.";
}

function looksLikeSecretKey(key: string) {
  return /(secret|token|password|key|service_role|connection_string)/i.test(key);
}

function sanitizePostgrestSearch(value: string) {
  return value.replace(/[,%]/g, " ").trim();
}

export async function getAdminBookingsModule(): Promise<AdminModuleResult> {
  const result = await getAdminBookings({ pageSize: 150 });
  return { rows: result.rows, warnings: result.warnings };
}

function normalizeBookingFilters(query: AdminBookingsQuery): Required<Omit<AdminBookingsQuery, "page" | "pageSize">> {
  return {
    q: cleanText(query.q),
    status: cleanText(query.status),
    ops: cleanText(query.ops),
    dateFrom: cleanDate(query.dateFrom),
    dateTo: cleanDate(query.dateTo),
    department: cleanText(query.department),
    branch: cleanText(query.branch),
  };
}

function buildBookingWhere(filters: Required<Omit<AdminBookingsQuery, "page" | "pageSize">>) {
  const where: string[] = [];
  const params: string[] = [];
  const add = (value: string, sql: string) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (filters.q) {
    const search = `%${filters.q}%`;
    params.push(search, search, search, search);
    const index = params.length - 3;
    where.push(`(l.ho_ten ilike $${index} or l.so_dien_thoai ilike $${index + 1} or l.ma_lich_hen ilike $${index + 2} or l.patient_code ilike $${index + 3})`);
  }
  if (filters.status) add(filters.status, "l.status = ?");
  if (filters.ops === "unmatched") {
    where.push(`coalesce(l.his_match_status, 'PENDING') <> 'MATCHED' and coalesce(l.status, '') <> 'DA_HUY'`);
  } else if (filters.ops === "matched_unsent_zalo") {
    where.push(`l.his_match_status = 'MATCHED' and l.zalo_confirm_sent_at is null and coalesce(n.status, '') <> 'sent'`);
  } else if (filters.ops === "zalo_error") {
    where.push(`(coalesce(n.status, '') in ('failed', 'retry') or nullif(n.last_error, '') is not null)`);
  }
  if (filters.department) add(filters.department, "l.khoa_kham = ?");
  if (filters.branch) add(filters.branch, "l.chi_nhanh = ?");
  if (filters.dateFrom) add(filters.dateFrom, "l.ngay_kham >= ?::date");
  if (filters.dateTo) add(filters.dateTo, "l.ngay_kham <= ?::date");

  return {
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
    params,
  };
}

function bookingOperationsFromSql() {
  return `
    from portal.lich_hen_kham l
    left join lateral (
      select id, status, last_error, created_at
      from portal.notification_outbox
      where appointment_id = l.id
      order by created_at desc nulls last, id desc
      limit 1
    ) n on true
  `;
}

function emptyBookingsResult(
  filters: Required<Omit<AdminBookingsQuery, "page" | "pageSize">>,
  page: number,
  pageSize: number,
  warnings: string[],
): AdminBookingsResult {
  return {
    rows: [],
    warnings,
    total: 0,
    page,
    pageSize,
    pageCount: 1,
    filters,
    stats: {
      unmatched: 0,
      matchedUnsentZalo: 0,
      zaloError: 0,
      slaOver30: 0,
      slaOver120: 0,
      avgWaitMinutes: 0,
    },
    options: { statuses: [], departments: [], branches: [] },
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value: unknown) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export async function getAdminAccountDetail(identifier: string): Promise<AdminAccountDetail> {
  const warnings: string[] = [];
  const supabase = createSupabaseServiceClient();
  const key = decodeURIComponent(identifier).trim();
  if (!key) return { account: null, profiles: [], sessions: [], loginEvents: [], warnings: ["Thiếu định danh tài khoản."] };

  const account = await findAccount(supabase, key, warnings);
  if (!account) return { account: null, profiles: [], sessions: [], loginEvents: [], warnings };

  const accountId = String(account.id ?? "");
  const accountKey = String(account.account_key ?? "");
  const accountFilter = accountId ? { column: "account_id", value: accountId } : { column: "account_key", value: accountKey };

  const [profiles, sessions, loginEvents] = await Promise.all([
    readFilteredSupabaseRows(
      "portal_account_profiles",
      "account_key,account_id,mabn,display_name,patient_name,relationship,is_default,is_active,verified_at,linked_at,last_selected_at",
      accountFilter.column,
      accountFilter.value,
      "linked_at",
      warnings,
      50,
    ),
    readFilteredSupabaseRows(
      "portal_account_sessions",
      "session_id,account_key,account_id,current_mabn,device_label,user_agent,ip_address,signed_in_at,last_seen_at,expires_at,revoked_at",
      accountFilter.column,
      accountFilter.value,
      "signed_in_at",
      warnings,
      12,
    ),
    account.phone_masked
      ? readFilteredSupabaseRows(
          "portal_login_events",
          "id,phone_masked,event_type,device_label,ip_address,user_agent,created_at",
          "phone_masked",
          String(account.phone_masked),
          "created_at",
          warnings,
          40,
        )
      : Promise.resolve([]),
  ]);

  return { account, profiles, sessions, loginEvents, warnings };
}

export async function getAdminBookingDetail(bookingId: string): Promise<AdminBookingDetail> {
  const warnings: string[] = [];
  const key = decodeURIComponent(bookingId).trim();
  if (!key) return { booking: null, history: [], matches: [], notifications: [], warnings: ["Thiếu mã đăng ký khám."] };

  try {
    const pool = getBookingPool();
    const [bookingResult, historyResult, matchResult, notificationResult] = await Promise.all([
      pool.query("select * from portal.lich_hen_kham where id = $1 limit 1", [key]),
      pool.query(
        `
          select *
          from portal.lich_hen_kham_history
          where appointment_id = $1
          order by created_at desc nulls last
          limit 80
        `,
        [key],
      ),
      pool.query(
        `
          select *
          from portal.booking_his_matches
          where appointment_id = $1
          order by created_at desc nulls last, id desc
          limit 20
        `,
        [key],
      ),
      pool.query(
        `
          select *
          from portal.notification_outbox
          where appointment_id = $1
          order by created_at desc nulls last, id desc
          limit 20
        `,
        [key],
      ),
    ]);

    return {
      booking: (bookingResult.rows[0] ?? null) as Record<string, unknown> | null,
      history: historyResult.rows as Record<string, unknown>[],
      matches: matchResult.rows as Record<string, unknown>[],
      notifications: notificationResult.rows as Record<string, unknown>[],
      warnings,
    };
  } catch (error) {
    return {
      booking: null,
      history: [],
      matches: [],
      notifications: [],
      warnings: [`portal.lich_hen_kham: ${error instanceof Error ? error.message : "Không đọc được booking DB"}`],
    };
  }
}

export async function getAdminProfileDetail(mabn: string): Promise<AdminProfileDetail> {
  const warnings: string[] = [];
  const key = decodeURIComponent(mabn).trim();
  if (!key) return { mabn: "", links: [], branchMappings: [], snapshots: [], syncJobs: [], warnings: ["Thiếu mã bệnh nhân."] };

  const [links, branchMappings, snapshots, syncJobs] = await Promise.all([
    readFilteredSupabaseRows(
      "portal_account_profiles",
      "account_key,account_id,mabn,display_name,patient_name,relationship,is_default,is_active,verified_at,linked_at,last_selected_at",
      "mabn",
      key,
      "linked_at",
      warnings,
      80,
    ),
    readFilteredSupabaseRows(
      "portal_patient_branch_mappings",
      "id,account_key,identity_hash,branch_code,his_mabn,patient_name,source,verified_at,last_seen_at,created_at,updated_at",
      "his_mabn",
      key,
      "updated_at",
      warnings,
      80,
    ),
    readFilteredSupabaseRows(
      "portal_resource_snapshots",
      "cache_key,mabn,resource_name,resource_id,synced_at,expires_at,created_at,updated_at",
      "mabn",
      key,
      "updated_at",
      warnings,
      120,
    ),
    readFilteredSupabaseRows(
      "portal_sync_jobs",
      "job_id,mabn,resource_name,resource_id,maql,status,attempt_count,max_attempts,requested_by,requested_reason,error_message,run_after,started_at,finished_at,updated_at,created_at",
      "mabn",
      key,
      "updated_at",
      warnings,
      120,
    ),
  ]);

  return { mabn: key, links, branchMappings, snapshots, syncJobs, warnings };
}

export async function getAdminSyncJobDetail(jobId: string): Promise<AdminSyncJobDetail> {
  const warnings: string[] = [];
  const key = decodeURIComponent(jobId).trim();
  if (!key) return { job: null, relatedJobs: [], snapshots: [], warnings: ["Thiếu mã sync job."] };

  const jobRows = await readFilteredSupabaseRows(
    "portal_sync_jobs",
    "job_id,mabn,resource_name,resource_id,maql,status,attempt_count,max_attempts,requested_by,requested_reason,error_message,run_after,started_at,finished_at,locked_by,locked_until,updated_at,created_at",
    "job_id",
    key,
    "updated_at",
    warnings,
    1,
  );
  const job = jobRows[0] ?? null;
  if (!job) return { job: null, relatedJobs: [], snapshots: [], warnings: [...warnings, "Không tìm thấy sync job."] };

  const mabn = String(job.mabn ?? "");
  const [relatedJobs, snapshots] = await Promise.all([
    readFilteredSupabaseRows(
      "portal_sync_jobs",
      "job_id,mabn,resource_name,resource_id,maql,status,attempt_count,max_attempts,requested_by,requested_reason,error_message,run_after,started_at,finished_at,updated_at,created_at",
      "mabn",
      mabn,
      "updated_at",
      warnings,
      30,
    ),
    readFilteredSupabaseRows(
      "portal_resource_snapshots",
      "cache_key,mabn,resource_name,resource_id,synced_at,expires_at,created_at,updated_at",
      "mabn",
      mabn,
      "updated_at",
      warnings,
      40,
    ),
  ]);

  return { job, relatedJobs, snapshots, warnings };
}

async function findAccount(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  key: string,
  warnings: string[],
): Promise<Record<string, unknown> | null> {
  const columns = "account_key,id,phone_masked,phone,full_name,display_name,status,primary_mabn,phone_verified_at,password_set_at,last_login_at,created_at,updated_at,locked_at,locked_by,locked_reason,deleted_at,deleted_by,deleted_reason";
  const queries: Array<{ column: string; value: string }> = isUuid(key)
    ? [
        { column: "id", value: key },
        { column: "account_key", value: key },
      ]
    : [{ column: "account_key", value: key }];

  for (const item of queries) {
    const { data, error } = await supabase.from("portal_accounts").select(columns).eq(item.column, item.value).limit(1);
    if (error) {
      warnings.push(`portal_accounts: ${error.message}`);
      return null;
    }
    if (data?.[0]) return data[0] as unknown as Record<string, unknown>;
  }

  warnings.push("Không tìm thấy tài khoản portal.");
  return null;
}

async function readSupabaseRows(
  table: string,
  columns: string,
  orderColumn: string,
  warnings: string[],
  limit: number,
) {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from(table).select(columns).order(orderColumn, { ascending: false, nullsFirst: false }).limit(limit);
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

async function readFilteredSupabaseRows(
  table: string,
  columns: string,
  filterColumn: string,
  filterValue: string,
  orderColumn: string,
  warnings: string[],
  limit: number,
) {
  if (!filterValue) return [];
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq(filterColumn, filterValue)
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .limit(limit);
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

function maskPhone(value: unknown) {
  const text = String(value ?? "");
  if (text.length < 7) return text || "Chưa có SĐT";
  return `${text.slice(0, 3)}****${text.slice(-3)}`;
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
