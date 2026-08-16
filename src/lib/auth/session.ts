import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createHmac, timingSafeEqual } from "crypto";
import { demoPatientCode, demoSessionCookie } from "@/lib/auth/demo-auth";

export interface AuthenticatedPatientSession {
  patientId: string;
  userId: string;
}

interface PatientSessionPayload {
  mabn: string;
  exp: number;
}

export function createPatientSessionCookie(hisPatientCode: string, maxAgeSeconds: number) {
  const payload: PatientSessionPayload = {
    mabn: hisPatientCode,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function getDemoPatientSession(cookies: ReadonlyRequestCookies): AuthenticatedPatientSession | null {
  const cookieValue = cookies.get(demoSessionCookie)?.value?.trim();

  if (!cookieValue) {
    return null;
  }

  const hisPatientCode = readSignedMabn(cookieValue) ?? readDevelopmentMabn(cookieValue);

  if (!hisPatientCode) {
    return null;
  }

  return {
    patientId: `his-${hisPatientCode}`,
    userId: `patient-${hisPatientCode}`,
  };
}

function readSignedMabn(cookieValue: string) {
  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as PatientSessionPayload;

  if (!payload.mabn || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload.mabn;
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

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) {
    throw new Error("PORTAL_SESSION_SECRET is not configured.");
  }
  return secret;
}
