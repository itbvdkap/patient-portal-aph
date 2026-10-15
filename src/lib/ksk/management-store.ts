import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { canAdminAccessPath, canAdminPerformAction, type AdminSession } from "@/lib/admin/session";
import { draftPermission, managementCommandSchema, managementProposalSchema, managementQuerySchema, managementRows, managementKey, managementStates, proposalFromRow, type ManagementCommand, type ManagementDraft } from "./management-contract";
import { ManagementFailure, managementEnabled, type ApplyEnvelope, type ManagementRepository } from "./management-repository";
import { cloudState, replaceCloudState, runCloudState, adminCloudEnabled } from "@/lib/admin/cloud-state";
const cloudScope = () => `management:${process.env.KSK_MANAGEMENT_BRANCH || "CN1"}`;
const proposal = managementProposalSchema;
const draftSchema = z.object({ id: z.string().uuid(), revision: z.number().int().positive(), branch: z.string(), query: managementQuerySchema, version: z.string().regex(/^[a-f0-9]{64}$/), state: z.enum(Object.keys(managementStates) as [keyof typeof managementStates, ...Array<keyof typeof managementStates>]),
  proposal, before: z.object({ kind: z.enum(["customer", "cohort", "group", "member", "package"]), key: z.string(), fields: z.record(z.string()), items: z.array(z.record(z.string())) }).nullable(), author: z.string(), reviewer: z.string().optional(), reason: z.string(), updatedAt: z.string().datetime(), appliedBy: z.string().optional(), applyReason: z.string().optional(), result: z.record(z.string()).optional(),
  history: z.array(z.object({ actor: z.string(), action: z.string(), at: z.string().datetime(), reason: z.string(), proposal: proposal.optional() }).strict()).max(100) }).strict();
const storeSchema = z.object({ version: z.literal(1), drafts: z.array(draftSchema).max(500) }).strict();
function location() {
  if (!managementEnabled()) throw new ManagementFailure("Quản lý HIS chưa bật.", 503);
  const file = process.env.KSK_MANAGEMENT_STORE_PATH, secret = process.env.KSK_MANAGEMENT_STORE_SECRET || process.env.PORTAL_SESSION_SECRET || "";
  if (!file || !path.isAbsolute(file) || !existsSync(path.dirname(file)) || secret.length < 32) throw new ManagementFailure("Thiếu kho nháp mã hóa nội bộ hoặc khóa bảo vệ tối thiểu 32 ký tự.", 503);
  const relative = path.relative(path.resolve("public"), path.resolve(file));
  if (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new ManagementFailure("Không lưu nháp dưới public.", 503);
  return { file, key: createHmac("sha256", secret).update("aph-ksk-management-draft-v1").digest() };
}
function read() {
  const cloud = cloudState(cloudScope()); if (cloud) return storeSchema.parse(cloud.data);
  const { file, key } = location();
  if (!existsSync(file)) return { version: 1 as const, drafts: [] as ManagementDraft[] };
  if (statSync(file).size > 15000000) throw new ManagementFailure("Kho nháp vượt giới hạn.", 503);
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 4).toString() !== "KSM1") throw new ManagementFailure("Sai định dạng kho nháp; không tự thay dữ liệu.", 503);
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(4, 16)); decipher.setAuthTag(bytes.subarray(16, 32));
  return storeSchema.parse(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(32)), decipher.final()]).toString("utf8")));
}
function write(store: ReturnType<typeof read>) {
  if (cloudState(cloudScope())) { replaceCloudState(cloudScope(), storeSchema.parse(store)); return; }
  const { file, key } = location(), nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce);
  const content = Buffer.from(JSON.stringify(storeSchema.parse(store)));
  if (content.length > 14000000) throw new ManagementFailure("Kho nháp vượt giới hạn.", 503);
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]), temp = `${file}.tmp-${randomUUID()}`;
  try { writeFileSync(temp, Buffer.concat([Buffer.from("KSM1"), nonce, cipher.getAuthTag(), encrypted]), { mode: 0o600, flag: "wx" }); renameSync(temp, file); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
}
export function readManagementDrafts() { return read().drafts.slice().reverse(); }
export async function loadManagementDrafts() { return runCloudState(cloudScope(), { version: 1, drafts: [] }, readManagementDrafts); }
function permit(session: AdminSession, action: string) {
  if (!canAdminAccessPath(session, "/admin/ksk-manage") || !canAdminPerformAction(session, action)) throw new ManagementFailure("Không có quyền thao tác quản lý HIS này.", 403);
}
function envelope(d: ManagementDraft, session: AdminSession, reason: string): ApplyEnvelope {
  return { commandId: d.id, cohortId: d.query.cohort, from: d.query.from, to: d.query.to, expectedVersion: d.version, proposal: d.proposal,
    author: d.author, reviewer: d.reviewer || (d.author === "preflight-review" ? "preflight-check" : "preflight-review"), appliedBy: d.appliedBy || session.username, reason: d.applyReason || reason };
}
export async function executeManagement(session: AdminSession, raw: ManagementCommand, repo: ManagementRepository) {
  if (adminCloudEnabled() && raw.action === "apply") throw new ManagementFailure("Bản cloud chỉ đọc/lưu nháp, không cho ghi HIS.", 403);
  return runCloudState(cloudScope(), { version: 1, drafts: [] }, () => executeInStore(session, raw, repo));
}
async function executeInStore(session: AdminSession, raw: ManagementCommand, repo: ManagementRepository) {
  const input = managementCommandSchema.parse(raw);
  if (input.action === "create" || input.action === "check") permit(session, draftPermission(input.proposal.kind));
  else if (input.action === "approve" || input.action === "reject") permit(session, "ksk_manage_approve");
  else if (input.action === "apply") permit(session, "ksk_manage_apply");
  else if (!canAdminAccessPath(session, "/admin/ksk-manage")) throw new ManagementFailure("Thiếu quyền quản lý.", 403);
  const file = cloudState(cloudScope()) ? null : location().file; let lock: number | undefined;
  try { if (file) lock = openSync(`${file}.lock`, "wx", 0o600); } catch { throw new ManagementFailure("Kho nháp đang được xử lý hoặc còn khóa sau sự cố. Thử lại/liên hệ quản trị.", 423); }
  try {
    const store = read(), now = new Date().toISOString();
    if (input.action === "create" || input.action === "check") {
      if (store.drafts.length >= 500) throw new ManagementFailure("Đã đạt giới hạn 500 phiếu.");
      const data = await repo.read(input.query);
      if (data.version !== input.version) throw new ManagementFailure("Nguồn HIS đã thay đổi. Làm mới trước khi lập phiếu.");
      const source = input.proposal.key === "NEW" ? null : managementRows(data, input.proposal.kind).find(r => managementKey(input.proposal.kind, r) === input.proposal.key);
      if (input.proposal.key !== "NEW" && !source) throw new ManagementFailure("Đối tượng không thuộc phạm vi đã đọc.");
      const before = source ? proposalFromRow(data, input.proposal.kind, source) : null;
      if (JSON.stringify(before) === JSON.stringify(input.proposal)) throw new ManagementFailure("Chưa có thay đổi nội dung.", 400);
      const draft: ManagementDraft = { id: randomUUID(), revision: 1, branch: data.branch, query: input.query, version: data.version, state: "draft", proposal: input.proposal, before,
        author: session.username, reason: input.reason, updatedAt: now, history: [{ actor: session.username, action: "create", at: now, reason: input.reason, proposal: input.proposal }] };
      await repo.validate(envelope(draft, session, input.reason)); // READ ONLY preflight; never apply here.
      if (input.action === "check") return store.drafts.slice().reverse();
      store.drafts.push(draft);
    } else {
      const draft = store.drafts.find(d => d.id === input.id);
      if (!draft || draft.revision !== input.revision) throw new ManagementFailure("Phiếu không tồn tại hoặc phiên bản đã đổi. Làm mới.");
      if (draft.branch !== (process.env.KSK_MANAGEMENT_BRANCH || "CN1")) throw new ManagementFailure("Phiếu thuộc chi nhánh khác.", 403);
      if (draft.history.length >= 98) throw new ManagementFailure("Phiếu vượt giới hạn lịch sử.");
      if (input.action === "submit") {
        permit(session, draftPermission(draft.proposal.kind));
        if (draft.author.toLowerCase() !== session.username.toLowerCase() || !["draft", "rejected"].includes(draft.state)) throw new ManagementFailure("Chỉ người lập gửi phiếu nháp/từ chối của mình.", 403);
        delete draft.reviewer; await repo.validate(envelope(draft, session, input.reason)); draft.state = "submitted";
      } else if (input.action === "approve" || input.action === "reject") {
        if (draft.state !== "submitted") throw new ManagementFailure("Phiếu không ở trạng thái chờ duyệt.");
        if (draft.author.toLowerCase() === session.username.toLowerCase()) throw new ManagementFailure("Người lập không được tự duyệt.", 403);
        draft.reviewer = session.username;
        if (input.action === "approve") await repo.validate(envelope(draft, session, input.reason));
        draft.state = input.action === "approve" ? "approved" : "rejected";
      } else if (input.action === "apply") {
        if (!["approved", "uncertain", "applying"].includes(draft.state) || !draft.reviewer || draft.author.toLowerCase() === draft.reviewer.toLowerCase()) throw new ManagementFailure("Phiếu chưa duyệt hoặc đã ghi.");
        // Persist an immutable apply identity before the network call. Recovery uses the SAME UUID/body.
        if (!draft.appliedBy) {
          const current = await repo.read(draft.query);
          if (!current.writeEnabled) throw new ManagementFailure("Agent chưa mở ghi. Phiếu đã duyệt được giữ nguyên; không có lệnh ghi được gửi.", 503);
          draft.appliedBy = session.username; draft.applyReason = input.reason;
        }
        draft.state = "applying"; draft.revision++; draft.updatedAt = now;
        draft.history.push({ actor: session.username, action: "apply_started", reason: input.reason, at: now }); write(store);
        try { draft.result = await repo.apply(envelope(draft, session, input.reason)); draft.state = "applied"; }
        catch (error) {
          draft.state = "uncertain"; draft.revision++; draft.updatedAt = new Date().toISOString();
          draft.history.push({ actor: session.username, action: "apply_uncertain", reason: "Chưa nhận xác nhận chắc chắn. Giữ nguyên mã lệnh; không tự tạo phiếu mới.", at: draft.updatedAt }); write(store); throw error;
        }
      }
      draft.revision++; draft.updatedAt = new Date().toISOString();
      draft.history.push({ actor: session.username, action: input.action, at: draft.updatedAt, reason: input.reason });
    }
    write(store); return store.drafts.slice().reverse();
  } finally { if (lock !== undefined && file) { closeSync(lock); unlinkSync(`${file}.lock`); } }
}
