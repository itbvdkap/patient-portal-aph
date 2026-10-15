import "server-only";
import { z } from "zod";
import { managementSnapshotSchema, type ManagementSnapshot, type ManagementProposal, type ManagementRow } from "./management-contract";
import type { KskQuery } from "./domain";
import { kskCloudEnabled, createCloudManagementRepository } from "./cloud-repository";
export interface ApplyEnvelope { commandId: string; cohortId: string; from: string; to: string; expectedVersion: string; proposal: ManagementProposal; author: string; reviewer: string; appliedBy: string; reason: string }
export interface ManagementRepository { read(query: KskQuery): Promise<ManagementSnapshot>; patient(mabn: string): Promise<ManagementRow>; validate(input: ApplyEnvelope): Promise<void>; apply(input: ApplyEnvelope): Promise<ManagementRow> }
export class ManagementFailure extends Error { constructor(message: string, public status = 409) { super(message); } }
export function managementEnabled() { return process.env.KSK_MANAGEMENT_ENABLED === "true" && (!process.env.VERCEL || kskCloudEnabled()); }
export function createManagementRepository(): ManagementRepository {
  if (!managementEnabled()) throw new ManagementFailure("Quản lý HIS chưa mở trên máy chủ nội bộ.", 503);
  if (kskCloudEnabled()) return createCloudManagementRepository();
  const token = process.env.KSK_MANAGEMENT_TOKEN, base = process.env.KSK_API_BASE_URL;
  if (!token || token.length < 32 || !base) throw new ManagementFailure("Thiếu cấu hình API quản lý riêng.", 503);
  const url = new URL(base);
  if (url.username || url.password || url.hash || url.search || !["https:", "http:"].includes(url.protocol) || (url.protocol !== "https:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) throw new ManagementFailure("Địa chỉ agent quản lý không hợp lệ; khác máy phải HTTPS.", 503);
  async function request(suffix: string, body?: ApplyEnvelope | { mabn: string }) {
    const endpoint = new URL(`${url.pathname.replace(/\/$/, "")}/api/internal/ksk-management${suffix}`, url.origin);
    let response;
    try { response = await fetch(endpoint, { method: body ? "POST" : "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(50000),
      headers: { "X-Ksk-Management-Token": token!, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw new ManagementFailure("Mất kết nối agent. Nếu đang áp dụng, phải kiểm tra/lặp lại đúng mã lệnh, không lập lệnh mới.", 503); }
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new ManagementFailure(typeof result?.error === "string" && result.error.length < 500 ? result.error : `Agent quản lý chưa sẵn sàng (HTTP ${response.status}).`, response.status === 403 ? 503 : response.status);
    return result;
  }
  return {
    async read(query) {
      const result = managementSnapshotSchema.safeParse(await request(`?${new URLSearchParams({ ...query })}`));
      if (!result.success || result.data.branch !== (process.env.KSK_MANAGEMENT_BRANCH || "CN1") || result.data.cohortId !== query.cohort
        || (query.cohort && (result.data.cohorts.length !== 1 || result.data.cohorts[0].id !== query.cohort))) throw new ManagementFailure("Agent trả sai chi nhánh/phạm vi hoặc thiếu dữ liệu quản lý.", 503);
      return result.data;
    },
    async patient(mabn) { return z.record(z.string()).parse(await request("/patient", { mabn })); },
    async validate(input) { const result = await request("/validate", input); if (result?.valid !== true || result?.applied !== false) throw new ManagementFailure("Chưa xác nhận được kiểm tra trước ghi.", 503); },
    async apply(input) {
      const result = await request("/apply", input);
      if (result?.commandId !== input.commandId || result?.applied !== true || result?.branch !== (process.env.KSK_MANAGEMENT_BRANCH || "CN1")) throw new ManagementFailure("Chưa xác nhận được kết quả ghi; không tạo lệnh khác.", 503);
      return Object.fromEntries(Object.entries(result).map(([k, v]) => [k, String(v)]));
    },
  };
}
