import { createHash, randomUUID } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface LoginVerificationResult {
  hisPatientCode: string;
  fullName: string;
  phone: string;
}

const authPollIntervalMs = Number(process.env.SUPABASE_AUTH_POLL_INTERVAL_MS ?? 1000);
const authWaitMs = Number(process.env.SUPABASE_AUTH_WAIT_MS ?? 25000);

export function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function loginLookupHash(phone: string, citizenId: string) {
  return createHash("sha256").update(`${normalizeDigits(phone)}|${normalizeDigits(citizenId)}`).digest("hex");
}

export async function requestOnDemandLoginSync(phone: string, citizenId: string): Promise<LoginVerificationResult | null> {
  const supabase = createSupabaseServiceClient();
  const lookupHash = loginLookupHash(phone, citizenId);

  const cached = await supabase
    .from("portal_login_lookup")
    .select("payload_json")
    .eq("lookup_hash", lookupHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (cached.error) {
    throw new Error(`Supabase login lookup failed: ${cached.error.message}`);
  }

  if (cached.data?.payload_json) {
    return cached.data.payload_json as LoginVerificationResult;
  }

  const attemptId = randomUUID();
  const encryptedPayload = await encryptAuthPayload({ phone: normalizeDigits(phone), citizenId: normalizeDigits(citizenId), attemptId });
  const created = await supabase.from("portal_auth_attempts").insert({
    attempt_id: attemptId,
    lookup_hash: lookupHash,
    encrypted_payload: encryptedPayload,
    status: "queued",
  });

  if (created.error) {
    throw new Error(`Supabase auth attempt enqueue failed: ${created.error.message}`);
  }

  const started = Date.now();
  while (Date.now() - started < authWaitMs) {
    await sleep(authPollIntervalMs);

    const attempt = await supabase
      .from("portal_auth_attempts")
      .select("status,result_json,error_message")
      .eq("attempt_id", attemptId)
      .maybeSingle();

    if (attempt.error) {
      throw new Error(`Supabase auth attempt polling failed: ${attempt.error.message}`);
    }

    if (attempt.data?.status === "success" && attempt.data.result_json) {
      return attempt.data.result_json as LoginVerificationResult;
    }

    if (attempt.data?.status === "failed") {
      return null;
    }
  }

  return null;
}

export async function enqueuePatientSync(mabn: string, resourceName = "all", resourceId?: string) {
  const supabase = createSupabaseServiceClient();
  const queued = await supabase.from("portal_sync_jobs").insert({
    mabn,
    resource_name: resourceName,
    resource_id: resourceId ?? null,
    status: "queued",
    requested_by: "portal",
    requested_reason: "on-demand patient access",
  });

  if (queued.error) {
    throw new Error(`Supabase sync enqueue failed: ${queued.error.message}`);
  }
}

async function encryptAuthPayload(payload: unknown) {
  const secret = process.env.AUTH_SYNC_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("AUTH_SYNC_ENCRYPTION_KEY is not configured.");
  }

  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));

  return [
    Buffer.from(salt).toString("base64url"),
    Buffer.from(iv).toString("base64url"),
    Buffer.from(encrypted).toString("base64url"),
  ].join(".");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
