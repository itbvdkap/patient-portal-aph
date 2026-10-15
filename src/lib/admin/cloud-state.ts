import { AsyncLocalStorage } from "node:async_hooks";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const adminCloudEnabled = () => process.env.ADMIN_DATA_MODE === "supabase";
type State = { scope: string; data: unknown; dirty: boolean };
const context = new AsyncLocalStorage<State>();
export function cloudState(scope: string) { const value = context.getStore(); return value?.scope === scope ? value : null; }
export function replaceCloudState(scope: string, data: unknown) {
  const value = cloudState(scope); if (!value) throw new Error("Missing cloud transaction context.");
  value.data = data; value.dirty = true;
}
function secret() {
  const value = process.env.ADMIN_CLOUD_STORE_SECRET || "";
  if (value.length < 32) throw new Error("Thiếu khóa mã hóa kho quản trị cloud.");
  return createHash("sha256").update(`aph-admin-cloud-v1:${value}`).digest();
}
export function sealCloudState(data: unknown) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", secret(), nonce);
  const clear = Buffer.from(JSON.stringify(data)); if (clear.length > 14000000) throw new Error("Kho cloud vượt giới hạn.");
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function openCloudState(data: string) {
  const bytes = Buffer.from(data, "base64"), decipher = createDecipheriv("aes-256-gcm", secret(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
export async function runCloudState<T>(scope: string, empty: unknown, work: () => T | Promise<T>): Promise<T> {
  if (!adminCloudEnabled()) return await work();
  if (!/^(staff|management:CN[13])$/.test(scope)) throw new Error("Unsupported cloud scope.");
  const db = createSupabaseServiceClient();
  const read = await db.rpc("portal_ksk_state_get", { p_key: scope });
  if (read.error || !Number.isSafeInteger(read.data?.revision)) throw new Error("Không đọc được kho quản trị cloud.");
  const state: State = { scope, data: read.data.payload ? openCloudState(read.data.payload) : empty, dirty: false };
  const result = await context.run(state, work);
  if (state.dirty) {
    const saved = await db.rpc("portal_ksk_state_cas", { p_key: scope, p_revision: read.data.revision, p_payload: sealCloudState(state.data) });
    if (saved.error || saved.data !== true) throw new Error("Kho quản trị đã thay đổi đồng thời. Làm mới và thử lại; chưa lưu thay đổi này.");
  }
  return result;
}
export async function cloudRateLimit(name: string) {
  if (!adminCloudEnabled()) return true;
  const key = createHash("sha256").update(name.toLowerCase()).digest("hex");
  const result = await createSupabaseServiceClient().rpc("portal_ksk_rate", { p_key: key });
  return !result.error && result.data === true;
}
