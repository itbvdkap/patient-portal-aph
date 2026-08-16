import type { AuthenticatedPatientSession } from "@/lib/auth/session";
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

export async function recordPortalLoginSession({
  accountKey,
  sessionId,
  mabn,
  fullName,
  phone,
  request,
  maxAgeSeconds,
}: {
  accountKey: string;
  sessionId: string;
  mabn: string;
  fullName: string;
  phone: string;
  request: Request;
  maxAgeSeconds: number;
}) {
  const supabase = createSupabaseServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000).toISOString();

  await throwOnError(
    supabase.from("portal_accounts").upsert({
      account_key: accountKey,
      phone_masked: maskPhone(phone),
      primary_mabn: mabn,
      last_login_at: now.toISOString(),
      updated_at: now.toISOString(),
    }),
    "upsert portal account",
  );

  await throwOnError(
    supabase.from("portal_account_profiles").upsert({
      account_key: accountKey,
      mabn,
      display_name: fullName,
      relationship: "Bản thân",
      is_default: true,
      last_selected_at: now.toISOString(),
    }),
    "upsert account profile",
  );

  await throwOnError(
    supabase.from("portal_account_sessions").upsert({
      session_id: sessionId,
      account_key: accountKey,
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
}

export async function getAccountOverview(session: AuthenticatedPatientSession, currentPatient: Patient): Promise<AccountOverview> {
  const fallbackProfiles = session.profiles.map((profile) => ({
    mabn: profile.mabn,
    patientId: profile.patientId,
    fullName: profile.fullName || (profile.mabn === currentPatient.hisPatientCode ? currentPatient.fullName : `Mã BN ${profile.mabn}`),
    phone: profile.mabn === currentPatient.hisPatientCode ? currentPatient.phone : undefined,
    relationship: profile.mabn === currentPatient.hisPatientCode ? "Bản thân" : undefined,
    isCurrent: profile.mabn === session.mabn,
    isDefault: profile.mabn === currentPatient.hisPatientCode,
  }));

  if (!session.accountKey) {
    return { profiles: fallbackProfiles, sessions: [], accountReady: false };
  }

  try {
    const supabase = createSupabaseServiceClient();
    const [profileRows, sessionRows] = await Promise.all([
      supabase
        .from("portal_account_profiles")
        .select("mabn,display_name,relationship,is_default,last_selected_at")
        .eq("account_key", session.accountKey)
        .order("is_default", { ascending: false })
        .order("linked_at", { ascending: true }),
      supabase
        .from("portal_account_sessions")
        .select("session_id,mabn,current_mabn,device_label,user_agent,ip_address,signed_in_at,last_seen_at,expires_at,revoked_at")
        .eq("account_key", session.accountKey)
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
        fullName: row.display_name || (row.mabn === currentPatient.hisPatientCode ? currentPatient.fullName : `Mã BN ${row.mabn}`),
        phone: row.mabn === currentPatient.hisPatientCode ? currentPatient.phone : undefined,
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
  if (!session.accountKey) {
    return session.profiles.some((profile) => profile.mabn === mabn) ? session.profiles : null;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("portal_account_profiles").select("mabn,display_name").eq("account_key", session.accountKey);

  if (error || !data?.some((profile) => profile.mabn === mabn)) {
    return null;
  }

  await supabase
    .from("portal_account_profiles")
    .update({ last_selected_at: new Date().toISOString() })
    .eq("account_key", session.accountKey)
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

export async function revokeAllAccountSessions(session: AuthenticatedPatientSession) {
  if (!session.accountKey) return;

  const supabase = createSupabaseServiceClient();
  await supabase
    .from("portal_account_sessions")
    .update({ revoked_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .eq("account_key", session.accountKey)
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
  if (!session.sessionId || !session.accountKey) return true;

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

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? undefined;
}

function deviceLabel(userAgent: string | null) {
  const ua = userAgent ?? "";
  if (/iPhone|iPad/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  return "Thiết bị";
}

async function throwOnError(promise: PromiseLike<{ error: { message: string } | null }>, action: string) {
  const result = await promise;
  if (result.error) {
    throw new Error(`Cannot ${action}: ${result.error.message}`);
  }
}
