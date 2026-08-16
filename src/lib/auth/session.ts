import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { demoPatientCode, demoSessionCookie } from "@/lib/auth/demo-auth";

export interface PatientSessionProfile {
  mabn: string;
  patientId: string;
  fullName?: string;
}

export interface AuthenticatedPatientSession {
  patientId: string;
  userId: string;
  mabn: string;
  sessionId?: string;
  accountKey?: string;
  profiles: PatientSessionProfile[];
}

interface PatientSessionPayload {
  mabn: string;
  exp: number;
  sid?: string;
  accountKey?: string;
  profiles?: Array<{ mabn: string; fullName?: string }>;
}

export function createPatientSessionCookie(
  hisPatientCode: string,
  maxAgeSeconds: number,
  options: { sessionId?: string; accountKey?: string; profiles?: Array<{ mabn: string; fullName?: string }> } = {},
) {
  const payload: PatientSessionPayload = {
    mabn: hisPatientCode,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    sid: options.sessionId ?? randomUUID(),
    accountKey: options.accountKey,
    profiles: normalizeProfiles(options.profiles ?? [{ mabn: hisPatientCode }]),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function getDemoPatientSession(cookies: ReadonlyRequestCookies): AuthenticatedPatientSession | null {
  const cookieValue = cookies.get(demoSessionCookie)?.value?.trim();

  if (!cookieValue) {
    return null;
  }

  const payload = readSignedPayload(cookieValue);
  const hisPatientCode = payload?.mabn ?? readDevelopmentMabn(cookieValue);

  if (!hisPatientCode) {
    return null;
  }

  const profiles = normalizeProfiles(payload?.profiles ?? [{ mabn: hisPatientCode }]).map((profile) => ({
    ...profile,
    patientId: `his-${profile.mabn}`,
  }));

  return {
    patientId: `his-${hisPatientCode}`,
    userId: payload?.accountKey ? `account-${payload.accountKey}` : `patient-${hisPatientCode}`,
    mabn: hisPatientCode,
    sessionId: payload?.sid,
    accountKey: payload?.accountKey,
    profiles,
  };
}

function readSignedPayload(cookieValue: string) {
  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  let payload: PatientSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as PatientSessionPayload;
  } catch {
    return null;
  }

  if (!payload.mabn || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function readDevelopmentMabn(cookieValue: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return null;
  }

  if (cookieValue === "true") {
    return demoPatientCode;
  }

  return decodeURIComponent(cookieValue);
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function verifySignature(value: string, signature: string) {
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizeProfiles(profiles: Array<{ mabn: string; fullName?: string }>) {
  const seen = new Set<string>();
  const result: Array<{ mabn: string; fullName?: string }> = [];

  for (const profile of profiles) {
    const mabn = profile.mabn?.trim();
    if (!mabn || seen.has(mabn)) continue;
    seen.add(mabn);
    result.push({ mabn, fullName: profile.fullName });
  }

  return result;
}

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) {
    throw new Error("PORTAL_SESSION_SECRET is not configured.");
  }
  return secret;
}
