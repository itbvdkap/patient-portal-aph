import { createHash, createHmac, randomInt } from "crypto";
import { maskPhone } from "@/lib/auth/phone";

export type OtpProvider = "test" | "zalo";

export interface OtpSendResult {
  provider: OtpProvider;
  sent: boolean;
  message?: string;
  raw?: unknown;
}

type ZaloTemplateResponse = {
  error?: number;
  message?: string;
};

export function otpProvider(): OtpProvider {
  return process.env.AUTH_OTP_PROVIDER === "zalo" ? "zalo" : "test";
}

export function otpTtlMinutes() {
  const configured = Number(process.env.AUTH_OTP_TTL_MINUTES ?? 5);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
}

export function maxOtpAttempts() {
  const configured = Number(process.env.AUTH_OTP_MAX_ATTEMPTS ?? 5);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
}

export function generateOtp(provider = otpProvider()) {
  if (provider === "test") {
    return process.env.AUTH_TEST_OTP ?? "1234567";
  }

  return randomInt(100000, 1000000).toString();
}

export function hashOtp(phone: string, otp: string) {
  return createHmac("sha256", otpSecret()).update(`${phone}|${otp}`).digest("hex");
}

export function verifyOtpHash(phone: string, otp: string, hash: string) {
  return hashOtp(phone, otp) === hash;
}

export function accountIdFromPhone(phone: string) {
  const hex = createHash("sha256").update(`portal-account|${phone}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function sendOtpMessage(phone: string, otp: string, provider = otpProvider()): Promise<OtpSendResult> {
  if (provider === "test") {
    return {
      provider,
      sent: true,
      message: `OTP test la ${otp}`,
    };
  }

  return sendZaloOtp(phone, otp);
}

async function sendZaloOtp(phone: string, otp: string): Promise<OtpSendResult> {
  const endpoint = process.env.ZALO_ZNS_ENDPOINT;
  const accessToken = process.env.ZALO_ACCESS_TOKEN;
  const templateId = process.env.ZALO_TEMPLATE_ID;

  if (!endpoint || !accessToken || !templateId) {
    throw new Error("Zalo OTP is not configured. Missing ZALO_ZNS_ENDPOINT/ZALO_ACCESS_TOKEN/ZALO_TEMPLATE_ID.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      access_token: accessToken,
    },
    body: JSON.stringify({
      phone,
      template_id: templateId,
      template_data: {
        otp,
        code: otp,
        minutes: otpTtlMinutes().toString(),
      },
    }),
  });

  const raw = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(`Zalo OTP send failed with status ${response.status}.`);
  }

  const zaloResult = raw as ZaloTemplateResponse | null;
  if (zaloResult && typeof zaloResult.error === "number" && zaloResult.error !== 0) {
    throw new Error(`Zalo OTP send failed: ${zaloResult.message ?? `error ${zaloResult.error}`}`);
  }

  return {
    provider: "zalo",
    sent: true,
    raw,
  };
}

export function maskedOtpPhone(phone: string) {
  return maskPhone(phone);
}

function otpSecret() {
  const secret = process.env.AUTH_OTP_SECRET ?? process.env.PORTAL_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_OTP_SECRET or PORTAL_SESSION_SECRET is not configured.");
  }
  return secret;
}
