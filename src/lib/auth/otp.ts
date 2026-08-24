import { createHash, createHmac, randomInt } from "crypto";
import { maskPhone } from "@/lib/auth/phone";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

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

type ZaloConfig = {
  endpoint?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenEndpoint?: string;
  appId?: string;
  secretKey?: string;
  templateId?: string;
};

type ZaloTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  refresh_expires_in?: number | string;
  error?: number | string;
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
  let config = await readZaloConfig();

  if (!config.endpoint || !config.templateId) {
    throw new Error("Zalo OTP is not configured. Missing ZALO_ZNS_ENDPOINT/ZALO_TEMPLATE_ID.");
  }

  if (!config.accessToken && config.refreshToken) {
    config = { ...config, ...(await refreshAndPersistZaloToken(config)) };
  }

  if (!config.accessToken) {
    throw new Error("Zalo OTP is not configured. Missing ZALO_ACCESS_TOKEN or ZALO_REFRESH_TOKEN.");
  }

  let result = await postZaloTemplateMessage(config, phone, otp);

  if (!result.sent && isZaloAccessTokenInvalid(result.raw) && config.refreshToken) {
    const refreshed = await refreshAndPersistZaloToken(config);
    config = { ...config, ...refreshed };
    result = await postZaloTemplateMessage(config, phone, otp);
  }

  return result;
}

async function postZaloTemplateMessage(config: ZaloConfig, phone: string, otp: string): Promise<OtpSendResult> {
  const response = await fetch(config.endpoint!, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      access_token: config.accessToken!,
    },
    body: JSON.stringify({
      phone,
      template_id: config.templateId,
      template_data: {
        otp,
        code: otp,
        minutes: otpTtlMinutes().toString(),
      },
    }),
  });

  const raw = (await response.json().catch(() => null)) as unknown;
  const zaloResult = raw as ZaloTemplateResponse | null;
  if (!response.ok) {
    if (isZaloAccessTokenInvalid(raw)) {
      return {
        provider: "zalo",
        sent: false,
        message: zaloResult?.message ?? "Access token invalid",
        raw,
      };
    }

    throw new Error(`Zalo OTP send failed with status ${response.status}.`);
  }

  if (zaloResult && typeof zaloResult.error === "number" && zaloResult.error !== 0) {
    return {
      provider: "zalo",
      sent: false,
      message: zaloResult.message ?? `Zalo error ${zaloResult.error}`,
      raw,
    };
  }

  return {
    provider: "zalo",
    sent: true,
    raw,
  };
}

async function readZaloConfig(): Promise<ZaloConfig> {
  const settings = await readAppSettings([
    "zalo.zns_endpoint",
    "zalo.access_token",
    "zalo.refresh_token",
    "zalo.token_endpoint",
    "zalo.app_id",
    "zalo.secret_key",
    "zalo.template_id",
  ]);

  return {
    endpoint: firstSetting(settings, "zalo.zns_endpoint", process.env.ZALO_ZNS_ENDPOINT),
    accessToken: firstSetting(settings, "zalo.access_token", process.env.ZALO_ACCESS_TOKEN),
    refreshToken: firstSetting(settings, "zalo.refresh_token", process.env.ZALO_REFRESH_TOKEN),
    tokenEndpoint: firstSetting(settings, "zalo.token_endpoint", process.env.ZALO_TOKEN_ENDPOINT ?? "https://oauth.zaloapp.com/v4/oa/access_token"),
    appId: firstSetting(settings, "zalo.app_id", process.env.ZALO_APP_ID),
    secretKey: firstSetting(settings, "zalo.secret_key", process.env.ZALO_SECRET_KEY),
    templateId: firstSetting(settings, "zalo.template_id", process.env.ZALO_TEMPLATE_ID),
  };
}

async function refreshAndPersistZaloToken(config: ZaloConfig): Promise<Pick<ZaloConfig, "accessToken" | "refreshToken">> {
  if (!config.tokenEndpoint || !config.appId || !config.secretKey || !config.refreshToken) {
    throw new Error("Zalo token refresh is not configured. Missing ZALO_TOKEN_ENDPOINT/ZALO_APP_ID/ZALO_SECRET_KEY/ZALO_REFRESH_TOKEN.");
  }

  const body = new URLSearchParams({
    app_id: config.appId,
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
  });

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: config.secretKey,
    },
    body,
  });

  const raw = (await response.json().catch(() => null)) as ZaloTokenResponse | null;
  if (!response.ok || !raw || raw.error || !raw.access_token) {
    throw new Error(raw?.message ?? `Zalo token refresh failed with status ${response.status}.`);
  }

  const nextRefreshToken = raw.refresh_token || config.refreshToken;
  await persistZaloTokens(raw.access_token, nextRefreshToken, raw.expires_in, raw.refresh_expires_in);

  return {
    accessToken: raw.access_token,
    refreshToken: nextRefreshToken,
  };
}

async function readAppSettings(keys: string[]) {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("portal_app_settings")
      .select("setting_key,setting_value")
      .in("setting_key", keys);

    if (error) {
      console.warn("[zalo-otp] Could not read portal_app_settings", error.message);
      return new Map<string, string>();
    }

    return new Map((data ?? []).map((row) => [String(row.setting_key), String(row.setting_value ?? "")]));
  } catch (error) {
    console.warn("[zalo-otp] Supabase settings are unavailable", error instanceof Error ? error.message : error);
    return new Map<string, string>();
  }
}

async function persistZaloTokens(accessToken: string, refreshToken: string, expiresIn?: number | string, refreshExpiresIn?: number | string) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = Date.now();
    const accessExpiresAt = expiryIso(now, expiresIn);
    const refreshExpiresAt = expiryIso(now, refreshExpiresIn);
    const rows = [
      settingRow("zalo.access_token", accessToken, true, "Zalo access token"),
      settingRow("zalo.refresh_token", refreshToken, true, "Zalo refresh token"),
      ...(accessExpiresAt ? [settingRow("zalo.access_token_expires_at", accessExpiresAt, false, "Zalo access token hết hạn")] : []),
      ...(refreshExpiresAt ? [settingRow("zalo.refresh_token_expires_at", refreshExpiresAt, false, "Zalo refresh token hết hạn")] : []),
    ];

    const { error } = await supabase.from("portal_app_settings").upsert(rows, { onConflict: "setting_key" });
    if (error) {
      console.warn("[zalo-otp] Could not persist refreshed token", error.message);
    }
  } catch (error) {
    console.warn("[zalo-otp] Could not persist refreshed token", error instanceof Error ? error.message : error);
  }
}

function settingRow(setting_key: string, setting_value: string, is_secret: boolean, label: string) {
  return {
    setting_key,
    setting_value,
    setting_group: "zalo",
    label,
    is_secret,
    updated_by: "system:zalo-token-refresh",
    updated_at: new Date().toISOString(),
  };
}

function expiryIso(now: number, value?: number | string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const millis = parsed > 10_000 ? parsed : parsed * 1000;
  return new Date(now + millis).toISOString();
}

function firstSetting(settings: Map<string, string>, key: string, fallback?: string) {
  const value = settings.get(key);
  return value && value.trim() ? value.trim() : fallback;
}

function isZaloAccessTokenInvalid(raw: unknown) {
  const result = raw as ZaloTemplateResponse | null;
  return result?.error === -124 || (typeof result?.message === "string" && result.message.toLowerCase().includes("access token invalid"));
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
