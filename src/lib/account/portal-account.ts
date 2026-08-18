import type { AuthenticatedPatientSession } from "@/lib/auth/session";
import { maskPhone } from "@/lib/auth/phone";
import { accountIdFromPhone } from "@/lib/auth/otp";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { enqueuePatientSync } from "@/lib/supabase/portal-sync";
import type { Patient } from "@/types/patient";

export interface AccountPatientProfile {
  mabn: string;
  patientId: string;
  fullName: string;
  phone?: string;
  relationship?: string;
  isCurrent: boolean;
  isDefault: boolean;
  lastSelectedAt?: string;
}

export interface AccountDeviceSession {
  sessionId: string;
  mabn: string;
  deviceLabel: string;
  userAgent?: string;
  ipAddress?: string;
  signedInAt: string;
  lastSeenAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  isCurrent: boolean;
}

export interface AccountOverview {
  profiles: AccountPatientProfile[];
  sessions: AccountDeviceSession[];
  accountReady: boolean;
}

export interface LinkedAccountProfile {
  mabn: string;
  fullName?: string;
  isActive?: boolean;
  lastSelectedAt?: string;
}

export interface PortalAccountAuthState {
  accountId: string;
  phone: string;
  fullName?: string;
  hasPassword: boolean;
  phoneVerified: boolean;
  status: string;
}

export async function getPortalAccountByPhone(phone: string): Promise<PortalAccountAuthState | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("portal_accounts")
    .select("id,phone,full_name,display_name,password_hash,phone_verified_at,status")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data) return null;

  return {
    accountId: data.id ?? accountIdFromPhone(phone),
    phone: data.phone ?? phone,
    fullName: data.full_name ?? data.display_name ?? undefined,
    hasPassword: Boolean(data.password_hash),
    phoneVerified: Boolean(data.phone_verified_at),
    status: data.status ?? "active",
  };
}

export async function upsertVerifiedPortalAccount({
  phone,
  fullName,
}: {
  phone: string;
  fullName: string;
}) {
  const accountId = accountIdFromPhone(phone);
  const now = new Date().toISOString();
  const supabase = createSupabaseServiceClient();

  await throwOnError(
    supabase.from("portal_accounts").upsert({
      account_key: accountId,
      id: accountId,
      phone,
      phone_masked: maskPhone(phone),
      full_name: fullName,
      display_name: fullName,
      phone_verified_at: now,
      status: "active",
      updated_at: now,
    }),
    "upsert verified portal account",
  );

  return { accountId };
}

export async function setPortalAccountPassword(accountId: string, password: string) {
  const now = new Date().toISOString();
  const supabase = createSupabaseServiceClient();

  await throwOnError(
    supabase
      .from("portal_accounts")
      .update({
        password_hash: hashPassword(password),
        password_set_at: now,
        updated_at: now,
      })
      .eq("id", accountId),
    "set portal account password",
  );
}

export async function verifyPortalAccountPassword(phone: string, password: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("portal_accounts")
    .select("id,phone,full_name,display_name,password_hash,phone_verified_at,status")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data || data.status === "locked" || data.status === "disabled") {
    return null;
  }

  if (!data.phone_verified_at || !verifyPassword(password, data.password_hash)) {
    return null;
  }

  return {
    accountId: data.id ?? accountIdFromPhone(phone),
    phone: data.phone ?? phone,
    fullName: data.full_name ?? data.display_name ?? undefined,
  };
}

export async function recordPortalPasswordLogin({
  accountId,
  phone,
  request,
  maxAgeSeconds,
  eventType = "password_login",
}: {
  accountId: string;
  phone: string;
  request: Request;
  maxAgeSeconds: number;
  eventType?: string;
}) {
  const profiles = await getLinkedProfilesForAccount(accountId);
  const currentProfile = profiles.find((profile) => profile.isActive) ?? profiles[0];
  const mabn = currentProfile?.mabn ?? "";
  const { sessionId, accountKey } = await recordPortalOtpLogin({
    accountId,
    phone,
    mabn,
    request,
    maxAgeSeconds,
    eventType,
  });

  return { sessionId, accountKey, mabn, profiles };
}

export async function recordPortalLoginSession({
  accountId,
  accountKey,
  sessionId,
  mabn,
  fullName,
  phone,
  profiles,
  request,
  maxAgeSeconds,
}: {
  accountId?: string;
  accountKey: string;
  sessionId: string;
  mabn: string;
  fullName: string;
  phone: string;
  profiles?: Array<{ mabn: string; fullName?: string; relationship?: string }>;
  request: Request;
  maxAgeSeconds: number;
}) {
  const supabase = createSupabaseServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000).toISOString();
  const normalizedAccountKey = accountKeyFromSession(accountId, accountKey);

  await throwOnError(
    supabase.from("portal_accounts").upsert({
      account_key: normalizedAccountKey,
      id: accountId,
      phone,
      phone_masked: maskPhone(phone),
      primary_mabn: mabn,
      last_login_at: now.toISOString(),
      updated_at: now.toISOString(),
    }),
    "upsert portal account",
  );

  const linkedProfiles = normalizeLinkedProfiles(profiles, mabn, fullName);
  if (linkedProfiles.length) {
    await throwOnError(
      supabase.from("portal_account_profiles").upsert(
        linkedProfiles.map((profile, index) => ({
          account_key: normalizedAccountKey,
          account_id: accountId,
          mabn: profile.mabn,
          display_name: profile.fullName,
          patient_name: profile.fullName,
          relationship: index === 0 ? "Bản thân" : profile.relationship ?? "Liên quan",
          is_default: index === 0,
          is_active: profile.mabn === mabn,
          verified_at: now.toISOString(),
          last_selected_at: profile.mabn === mabn ? now.toISOString() : null,
        })),
      ),
      "upsert account profiles",
    );
  }

  await throwOnError(
    supabase.from("portal_account_sessions").upsert({
      session_id: sessionId,
      account_key: normalizedAccountKey,
      account_id: accountId,
      mabn,
      current_mabn: mabn,
      device_label: deviceLabel(request.headers.get("user-agent")),
      user_agent: request.headers.get("user-agent"),
      ip_address: clientIp(request.headers),
      signed_in_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
    }),
    "record account session",
  );

  await supabase.from("portal_login_events").insert({
    account_id: accountId,
    session_id: sessionId,
    phone_masked: maskPhone(phone),
    event_type: "login",
    device_label: deviceLabel(request.headers.get("user-agent")),
    user_agent: request.headers.get("user-agent"),
    ip_address: clientIp(request.headers),
  });
}

export async function recordPortalOtpLogin({
  accountId,
  phone,
  mabn = "",
  request,
  maxAgeSeconds,
  eventType = "otp_login",
}: {
  accountId: string;
  phone: string;
  mabn?: string;
  request: Request;
  maxAgeSeconds: number;
  eventType?: string;
}) {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000).toISOString();
  const supabase = createSupabaseServiceClient();
  const accountKey = accountKeyFromSession(accountId);

  await throwOnError(
    supabase.from("portal_accounts").upsert({
      account_key: accountKey,
      id: accountId,
      phone,
      phone_masked: maskPhone(phone),
      last_login_at: now.toISOString(),
      updated_at: now.toISOString(),
    }),
    "upsert Supabase auth portal account",
  );

  await throwOnError(
    supabase.from("portal_account_sessions").upsert({
      session_id: sessionId,
      account_key: accountKey,
      account_id: accountId,
      mabn,
      current_mabn: mabn || null,
      device_label: deviceLabel(request.headers.get("user-agent")),
      user_agent: request.headers.get("user-agent"),
      ip_address: clientIp(request.headers),
      signed_in_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
    }),
    "record Supabase auth portal session",
  );

  await supabase.from("portal_login_events").insert({
    account_id: accountId,
    session_id: sessionId,
    phone_masked: maskPhone(phone),
    event_type: eventType,
    device_label: deviceLabel(request.headers.get("user-agent")),
    user_agent: request.headers.get("user-agent"),
    ip_address: clientIp(request.headers),
  });

  return { sessionId, accountKey };
}

export async function getLinkedProfilesForAccount(accountId: string): Promise<LinkedAccountProfile[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("portal_account_profiles")
    .select("mabn,display_name,patient_name,is_active,last_selected_at")
    .eq("account_id", accountId)
    .order("is_active", { ascending: false })
    .order("last_selected_at", { ascending: false, nullsFirst: false })
    .order("linked_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    mabn: row.mabn,
    fullName: row.display_name ?? row.patient_name ?? undefined,
    isActive: Boolean(row.is_active),
    lastSelectedAt: row.last_selected_at ?? undefined,
  }));
}

export async function getAccountOverview(session: AuthenticatedPatientSession, currentPatient?: Patient): Promise<AccountOverview> {
  const currentMabn = currentPatient?.hisPatientCode;
  const fallbackProfiles = session.profiles.map((profile) => ({
    mabn: profile.mabn,
    patientId: profile.patientId,
    fullName: profile.fullName || (profile.mabn === currentMabn && currentPatient ? currentPatient.fullName : `Mã BN ${profile.mabn}`),
    phone: profile.mabn === currentMabn && currentPatient ? currentPatient.phone : undefined,
    relationship: profile.mabn === currentMabn ? "Bản thân" : undefined,
    isCurrent: profile.mabn === session.mabn,
    isDefault: profile.mabn === currentMabn,
  }));

  const accountFilter = accountQuery(session);

  if (!accountFilter) {
    return { profiles: fallbackProfiles, sessions: [], accountReady: false };
  }

  try {
    const supabase = createSupabaseServiceClient();
    const [profileRows, sessionRows] = await Promise.all([
      supabase
        .from("portal_account_profiles")
        .select("mabn,display_name,relationship,is_default,last_selected_at")
        .match(accountFilter)
        .order("is_default", { ascending: false })
        .order("linked_at", { ascending: true }),
      supabase
        .from("portal_account_sessions")
        .select("session_id,mabn,current_mabn,device_label,user_agent,ip_address,signed_in_at,last_seen_at,expires_at,revoked_at")
        .match(accountFilter)
        .order("signed_in_at", { ascending: false })
        .limit(20),
    ]);

    if (profileRows.error || sessionRows.error) {
      return { profiles: fallbackProfiles, sessions: [], accountReady: false };
    }

    const profiles =
      profileRows.data?.map((row) => ({
        mabn: row.mabn,
        patientId: `his-${row.mabn}`,
        fullName: row.display_name || (row.mabn === currentMabn && currentPatient ? currentPatient.fullName : `Mã BN ${row.mabn}`),
        phone: row.mabn === currentMabn && currentPatient ? currentPatient.phone : undefined,
        relationship: row.relationship,
        isCurrent: row.mabn === session.mabn,
        isDefault: Boolean(row.is_default),
        lastSelectedAt: row.last_selected_at,
      })) ?? fallbackProfiles;

    const sessions =
      sessionRows.data?.map((row) => ({
        sessionId: row.session_id,
        mabn: row.current_mabn || row.mabn,
        deviceLabel: row.device_label || deviceLabel(row.user_agent),
        userAgent: row.user_agent ?? undefined,
        ipAddress: row.ip_address ?? undefined,
        signedInAt: row.signed_in_at,
        lastSeenAt: row.last_seen_at ?? undefined,
        expiresAt: row.expires_at ?? undefined,
        revokedAt: row.revoked_at ?? undefined,
        isCurrent: row.session_id === session.sessionId,
      })) ?? [];

    return { profiles, sessions, accountReady: true };
  } catch {
    return { profiles: fallbackProfiles, sessions: [], accountReady: false };
  }
}

export async function selectAccountProfile(session: AuthenticatedPatientSession, mabn: string) {
  const accountFilter = accountQuery(session);

  if (!accountFilter) {
    return session.profiles.some((profile) => profile.mabn === mabn) ? session.profiles : null;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("portal_account_profiles").select("mabn,display_name").match(accountFilter);

  if (error || !data?.some((profile) => profile.mabn === mabn)) {
    return null;
  }

  await supabase
    .from("portal_account_profiles")
    .update({ is_active: false })
    .match(accountFilter);

  await supabase
    .from("portal_account_profiles")
    .update({ is_active: true, last_selected_at: new Date().toISOString() })
    .match(accountFilter)
    .eq("mabn", mabn);

  if (session.sessionId) {
    await supabase
      .from("portal_account_sessions")
      .update({ current_mabn: mabn, last_seen_at: new Date().toISOString() })
      .eq("session_id", session.sessionId);
  }

  void enqueuePatientSync(mabn, "all").catch(() => undefined);
  return data.map((profile) => ({ mabn: profile.mabn, fullName: profile.display_name ?? undefined }));
}

export async function linkAccountProfile(
  session: AuthenticatedPatientSession,
  profile: { mabn: string; fullName: string; relationship?: string },
) {
  const accountFilter = accountQuery(session);

  if (!accountFilter) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  await throwOnError(
    supabase.from("portal_account_profiles").upsert({
      account_key: accountKeyFromSession(session.accountId, session.accountKey),
      account_id: session.accountId,
      mabn: profile.mabn,
      display_name: profile.fullName,
      patient_name: profile.fullName,
      relationship: profile.relationship ?? "Người thân",
      is_default: false,
      is_active: true,
      verified_at: now,
      last_selected_at: now,
    }),
    "link account profile",
  );

  await supabase.from("portal_account_profiles").update({ is_active: false }).match(accountFilter).neq("mabn", profile.mabn);

  const { data, error } = await supabase
    .from("portal_account_profiles")
    .select("mabn,display_name")
    .match(accountFilter)
    .order("is_default", { ascending: false })
    .order("linked_at", { ascending: true });

  if (error || !data) {
    return null;
  }

  void enqueuePatientSync(profile.mabn, "all").catch(() => undefined);
  return data.map((row) => ({ mabn: row.mabn, fullName: row.display_name ?? undefined }));
}

export async function revokeAllAccountSessions(session: AuthenticatedPatientSession) {
  const accountFilter = accountQuery(session);
  if (!accountFilter) return;

  const supabase = createSupabaseServiceClient();
  await supabase
    .from("portal_account_sessions")
    .update({ revoked_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .match(accountFilter)
    .is("revoked_at", null);
}

export async function revokeCurrentAccountSession(session: AuthenticatedPatientSession) {
  if (!session.sessionId) return;

  const supabase = createSupabaseServiceClient();
  await supabase
    .from("portal_account_sessions")
    .update({ revoked_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .eq("session_id", session.sessionId);
}

export async function isPortalSessionActive(session: AuthenticatedPatientSession) {
  if (!session.sessionId || !accountQuery(session)) return true;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("portal_account_sessions")
      .select("revoked_at,expires_at")
      .eq("session_id", session.sessionId)
      .maybeSingle();

    if (error || !data) return true;
    if (data.revoked_at) return false;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return false;

    await supabase.from("portal_account_sessions").update({ last_seen_at: new Date().toISOString() }).eq("session_id", session.sessionId);
    return true;
  } catch {
    return true;
  }
}

function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? undefined;
}

function accountKeyFromSession(accountId?: string, accountKey?: string) {
  return accountId ?? accountKey ?? "";
}

function accountQuery(session: AuthenticatedPatientSession) {
  if (session.accountId) return { account_id: session.accountId };
  if (session.accountKey) return { account_key: session.accountKey };
  return null;
}

function deviceLabel(userAgent: string | null) {
  const ua = userAgent ?? "";
  if (/iPhone|iPad/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  return "Thiết bị";
}

function normalizeLinkedProfiles(
  profiles: Array<{ mabn: string; fullName?: string; relationship?: string }> | undefined,
  primaryMabn: string,
  primaryFullName: string,
) {
  const source = profiles?.length ? profiles : [{ mabn: primaryMabn, fullName: primaryFullName, relationship: "Bản thân" }];
  const seen = new Set<string>();
  const normalized: Array<{ mabn: string; fullName: string; relationship?: string }> = [];

  for (const profile of [{ mabn: primaryMabn, fullName: primaryFullName, relationship: "Bản thân" }, ...source]) {
    const mabn = profile.mabn?.trim();
    if (!mabn || seen.has(mabn)) continue;
    seen.add(mabn);
    normalized.push({
      mabn,
      fullName: profile.fullName || (mabn === primaryMabn ? primaryFullName : `Mã BN ${mabn}`),
      relationship: profile.relationship,
    });
  }

  return normalized;
}

async function throwOnError(promise: PromiseLike<{ error: { message: string } | null }>, action: string) {
  const result = await promise;
  if (result.error) {
    throw new Error(`Cannot ${action}: ${result.error.message}`);
  }
}
