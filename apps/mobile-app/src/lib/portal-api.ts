import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  apiEnvelopeSchema,
  mobileSessionSchema,
  type Appointment,
  type ImagingResult,
  type LabResult,
  type MobileSession,
  type Patient,
  type PatientSummary,
  type Prescription,
  type Registration,
  type TodayVisitStatus,
  type Visit,
  type VisitDetail,
} from "@anphu/patient-domain";
import {
  clearStoredSessionCookie,
  getStoredSessionCookie,
  setStoredSessionCookie,
} from "@/lib/session-store";

const fallbackBaseUrl = "https://anphucare.benhvienanphu.vn";

function baseUrl() {
  const extra = Constants.expoConfig?.extra as
    { portalApiBaseUrl?: string } | undefined;

  // Keep local Expo Web requests on the local Next server so browser cookies work.
  if (Platform.OS === "web" && typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:3002`;
  }

  return extra?.portalApiBaseUrl || fallbackBaseUrl;
}

export async function portalFetch<T>(path: string, options: RequestInit = {}) {
  const cookie = await getStoredSessionCookie();
  const isWeb = Platform.OS === "web";
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    credentials: isWeb ? "include" : options.credentials,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(!isWeb && cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    await setStoredSessionCookie(setCookie);
  }

  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw new Error(`Portal API ${path} failed with ${response.status}`);
  }

  return payload;
}

export async function postPortal<T>(path: string, body: unknown) {
  return portalFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function loginWithPassword(
  phone: string,
  password: string,
  remember = true,
) {
  return postPortal<{
    data?: {
      accountId: string;
      hasLinkedProfile: boolean;
      currentMabn?: string | null;
    };
    error?: string;
  }>("/api/auth/login-password", {
    phone,
    password,
    remember,
  });
}

export async function sendOtp(phone: string) {
  return postPortal<{
    data?: {
      phone: string;
      expiresAt: string;
      provider: string;
      testOtp?: string;
    };
    error?: string;
  }>("/api/auth/send-otp", { phone });
}

export async function verifyOtp(phone: string, otp: string) {
  return postPortal<{
    data?: {
      accountId: string;
      hasLinkedProfile: boolean;
      currentMabn?: string | null;
    };
    error?: string;
  }>("/api/auth/verify", { phone, otp });
}

export async function startRegister(phone: string, fullName: string) {
  return postPortal<{
    data?: { expiresAt: string; provider: string; testOtp?: string };
    error?: string;
  }>("/api/auth/start-register", { phone, fullName });
}

export async function verifyRegisterOtp(
  phone: string,
  fullName: string,
  otp: string,
) {
  return postPortal<{
    data?: { accountId: string; needsPassword: boolean };
    error?: string;
  }>("/api/auth/verify-register-otp", { phone, fullName, otp });
}

export async function setPassword(password: string) {
  return postPortal<{ data?: { ok: boolean }; error?: string }>(
    "/api/auth/set-password",
    { password },
  );
}

export async function logout() {
  await portalFetch("/api/mobile/logout", { method: "POST" }).catch(
    () => undefined,
  );
  await clearStoredSessionCookie();
}

export async function selectProfile(mabn: string) {
  return postPortal<{ ok?: boolean; error?: string }>(
    "/api/account/select-profile",
    { mabn },
  );
}

export async function lookupProfile(
  mabn: string,
  verifier: { phone?: string; birthDate?: string },
) {
  return postPortal<{
    data?: {
      oldPatientCode: string;
      fullName: string;
      phone?: string;
      birthDate?: string;
      gender?: string;
      address?: string;
      soCCCD?: string;
      ngayCap?: string;
      hasInsurance?: boolean;
    };
    error?: string;
  }>("/api/account/lookup-profile", { mabn, ...verifier });
}

export async function linkProfile(input: {
  mabn: string;
  phone: string;
  birthDate: string;
  relationship: string;
  citizenId?: string;
}) {
  return postPortal<{
    data?: {
      mabn: string;
      fullName: string;
      profiles: MobileSession["profiles"];
    };
    error?: string;
  }>("/api/account/link-profile", input);
}

export async function unlinkProfile(mabn: string) {
  return postPortal<{
    data?: { currentMabn: string; profiles: MobileSession["profiles"] };
    error?: string;
  }>("/api/account/unlink-profile", { mabn });
}

export async function logoutAllDevices() {
  await portalFetch("/api/account/logout-all", { method: "POST" });
  await clearStoredSessionCookie();
}

export async function createMobileBooking(input: Record<string, unknown>) {
  return postPortal<{
    data?: { ma_lich_hen?: string; id?: string | number };
    message?: string;
    error?: string;
  }>("/api/mobile/booking", input);
}

export async function getCurrentSession(): Promise<MobileSession | null> {
  const payload = await portalFetch<unknown>("/api/mobile/session").catch(
    () => null,
  );
  if (!payload) return null;

  const parsed = apiEnvelopeSchema(mobileSessionSchema).safeParse(payload);
  return parsed.success ? (parsed.data.data ?? null) : null;
}

export async function getPatientSummary() {
  const payload = await portalFetch<{ data?: PatientSummary }>(
    "/api/me/summary",
  );
  return payload.data ?? null;
}

export async function getCurrentPatient() {
  const payload = await portalFetch<{ data?: Patient }>("/api/me");
  return payload.data ?? null;
}

export async function getTodayVisit() {
  const payload = await portalFetch<{ data?: TodayVisitStatus }>(
    "/api/me/today-visit",
  );
  return payload.data ?? null;
}

export async function getVisits() {
  const payload = await portalFetch<{ data?: Visit[] }>("/api/me/visits");
  return payload.data ?? [];
}

export async function getVisitDetail(id: string) {
  const payload = await portalFetch<{ data?: VisitDetail }>(`/api/me/visits/${encodeURIComponent(id)}`);
  return payload.data ?? null;
}

export async function getRegistrations() {
  const payload = await portalFetch<{ data?: Registration[] }>("/api/me/registrations");
  return payload.data ?? [];
}

export async function getLabResults() {
  const payload = await portalFetch<{ data?: LabResult[] }>(
    "/api/me/lab-results",
  );
  return payload.data ?? [];
}

export async function getImagingResults() {
  const payload = await portalFetch<{ data?: ImagingResult[] }>(
    "/api/me/imaging",
  );
  return payload.data ?? [];
}

export async function getPrescriptions() {
  const payload = await portalFetch<{ data?: Prescription[] }>(
    "/api/me/prescriptions",
  );
  return payload.data ?? [];
}

export async function getAppointments() {
  const payload = await portalFetch<{ data?: Appointment[] }>(
    "/api/me/appointments",
  );
  return payload.data ?? [];
}
