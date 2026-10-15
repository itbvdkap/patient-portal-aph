import { createHash } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { querySchema, snapshotSchema, type KskQuery } from "./domain";
import { collectionQuerySchema, type CollectionQuery } from "./collections";
import type { ManagementRepository } from "./management-repository";
import { managementSnapshotSchema } from "./management-contract";
import { z } from "zod";
export const kskCloudEnabled = () => process.env.KSK_DATA_MODE === "supabase";
export function cloudBranch() { const branch = process.env.KSK_MANAGEMENT_BRANCH || "CN1"; if (!["CN1", "CN3"].includes(branch)) throw new Error("Invalid KSK branch."); return branch; }
export async function cloudKskRequest(operation: "report" | "management" | "patient" | "validate", input: unknown): Promise<unknown> {
  const db = createSupabaseServiceClient(), branch = cloudBranch();
  const hash = createHash("sha256").update(JSON.stringify({ branch, operation, input })).digest("hex");
  const queued = await db.rpc("portal_ksk_enqueue", { p_branch: branch, p_operation: operation, p_input: input, p_hash: hash });
  if (queued.error || typeof queued.data !== "string") throw new Error("Chưa kết nối được hàng đợi KSK cloud.");
  const until = Date.now() + 35000;
  do {
    const result = await db.from("portal_ksk_jobs").select("status,result,expires_at").eq("id", queued.data).eq("branch", branch).maybeSingle();
    if (result.error || !result.data) throw new Error("Không đọc được trạng thái đồng bộ KSK.");
    if (result.data.status === "done" && Date.parse(result.data.expires_at) > Date.now()) return result.data.result;
    if (result.data.status === "failed") throw new Error("Agent chưa đọc/kiểm tra được HIS. Kiểm tra agent và làm mới sau.");
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (Date.now() < until);
  throw new Error("Đang chờ agent bệnh viện đồng bộ KSK. Chờ khoảng 30 giây rồi Đọc/Làm mới; không có lệnh ghi HIS.");
}
export function createCloudKskRepository() {
  async function read(query: KskQuery, collections?: CollectionQuery) {
    const checked = querySchema.parse(query), extra = collections ? collectionQuerySchema.parse(collections) : null;
    const input = { ...checked, ...(extra ? { all: "1", collectedFrom: extra.collectedFrom, collectedTo: extra.collectedTo } : {}) };
    const data = snapshotSchema.parse(await cloudKskRequest("report", input));
    if (data.scope.branch !== cloudBranch() || data.scope.mode !== "his" || data.scope.from !== checked.from || data.scope.to !== checked.to
      || (checked.cohort && data.cohorts.some(c => c.id !== checked.cohort)) || (extra && (data.scope.collections !== true || data.scope.episodePolicy !== 2 || data.scope.collectedFrom !== extra.collectedFrom || data.scope.collectedTo !== extra.collectedTo))) throw new Error("Sai phạm vi dữ liệu KSK cloud.");
    if (checked.cohort && data.cohorts.length === 0
      && [data.members, data.visits, data.charges, data.clinical, data.labs, data.imaging].some(rows => rows.length > 0))
      throw new Error("Không có đợt tương ứng với dữ liệu chi tiết KSK cloud.");
    return data;
  }
  return { read, readCollections: (query: CollectionQuery) => read({ from: query.from, to: query.to, cohort: "" }, query) };
}
export function createCloudManagementRepository(): ManagementRepository {
  return {
    async read(query) {
      const data = managementSnapshotSchema.parse(await cloudKskRequest("management", query));
      if (data.branch !== cloudBranch() || data.cohortId !== query.cohort || data.writeEnabled || (query.cohort && (data.cohorts.length !== 1 || data.cohorts[0].id !== query.cohort))) throw new Error("Sai phạm vi quản lý KSK cloud.");
      return data;
    },
    async patient(mabn) { if (!/^\d{8}$/.test(mabn)) throw new Error("Mã BN cần đủ 8 số."); return z.record(z.string()).parse(await cloudKskRequest("patient", { mabn })); },
    async validate(input) { const result = await cloudKskRequest("validate", input) as { valid?: boolean; applied?: boolean }; if (result?.valid !== true || result?.applied !== false) throw new Error("Chưa kiểm tra được phiếu HIS."); },
    async apply() { throw new Error("Bản cloud chỉ đọc và lưu nháp; không hỗ trợ ghi HIS."); },
  };
}
