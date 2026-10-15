import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { canAdminAccessPath, canAdminPerformAction, type AdminSession } from "@/lib/admin/session";
import { changeCommandSchema, changeDraftAction, changeProposalSchema, type ChangeCommand, type ChangeDraft, type ChangeLabSnapshot, type LabTarget } from "./change-contract";
import { labCatalog, labGroups, seedLabTargets } from "./change-lab-seed";

export class ChangeLabError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const eventSchema = z.object({ actor: z.string().max(120), at: z.string().datetime(), action: z.string().max(40), reason: z.string().max(500), proposal: changeProposalSchema.optional() }).strict();
const targetSchema = z.object({ id: z.string(), hasVisit: z.boolean(), value: changeProposalSchema }).strict();
const draftSchema = z.object({ id: z.string().uuid(), revision: z.number().int().positive(), state: z.enum(["draft", "submitted", "approved", "rejected", "simulated"]),
  targetId: z.string(), sourceHash: z.string().regex(/^[a-f0-9]{64}$/), before: changeProposalSchema.nullable(), after: changeProposalSchema,
  author: z.string().max(120), reviewer: z.string().max(120).optional(), appliedBy: z.string().max(120).optional(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  reason: z.string().max(500), history: z.array(eventSchema).max(100) }).strict();
const storeSchema = z.object({ version: z.literal(1), mode: z.literal("simulation"), targets: z.array(targetSchema).max(1000), drafts: z.array(draftSchema).max(500) }).strict();
type Store = z.infer<typeof storeSchema>;
function location() {
  if (process.env.VERCEL || process.env.KSK_CHANGE_LAB_ENABLED !== "true") throw new ChangeLabError("LAB thay đổi chưa bật trên máy chủ nội bộ; HIS thật không bị thay đổi.", 503);
  const file = process.env.KSK_CHANGE_STORE_PATH;
  if (!file || !path.isAbsolute(file) || !existsSync(path.dirname(file))) throw new ChangeLabError("Chưa cấu hình thư mục lưu LAB riêng có phân quyền bảo vệ.", 503);
  const relative = path.relative(path.resolve(process.cwd(), "public"), path.resolve(file));
  if (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new ChangeLabError("Không lưu LAB dưới thư mục public.", 503);
  return file;
}
function load(file: string): Store {
  if (!existsSync(file)) return { version: 1, mode: "simulation", targets: seedLabTargets(), drafts: [] };
  if (statSync(file).size > 10000000) throw new ChangeLabError("Kho LAB vượt giới hạn. Dừng thử và liên hệ quản trị.", 503);
  const store = storeSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  if (new Set(store.targets.map(t => t.id)).size !== store.targets.length || new Set(store.drafts.map(d => d.id)).size !== store.drafts.length) throw new Error("Duplicate LAB keys");
  return store;
}
function snapshot(store: Store): ChangeLabSnapshot { return { mode: "simulation", realHisWriteEnabled: false, sourceVersion: fingerprint(store), targets: store.targets, drafts: store.drafts.slice().reverse(), catalog: labCatalog, groups: labGroups }; }
export function readChangeLab() { return snapshot(load(location())); }
function fingerprint(store: Store) {
  // Conservative LAB-wide version: any simulated source change invalidates pending baselines.
  return createHash("sha256").update(JSON.stringify(store.targets)).digest("hex");
}
function locked(store: Store, target: LabTarget) {
  return target.hasVisit || (target.value.kind === "package" && store.targets.some(t => t.hasVisit && t.value.kind === "member" && t.value.packageId === target.id));
}
function validateTarget(store: Store, draft: Pick<ChangeDraft, "targetId" | "before" | "after">) {
  const target = store.targets.find(t => t.id === draft.targetId);
  if (draft.before === null) {
    if (draft.after.kind !== "member" || target) throw new ChangeLabError("Đối tượng thêm mới không hợp lệ.");
  } else if (!target || target.value.kind !== draft.after.kind || locked(store, target)) throw new ChangeLabError("Đối tượng đã tiếp nhận/được sử dụng hoặc không còn tồn tại; không được sửa.");
  if (draft.after.kind === "member") {
    const after = draft.after;
    if (!labGroups.some(g => g.id === after.groupId) || !store.targets.some(t => t.id === after.packageId && t.value.kind === "package")) throw new ChangeLabError("Nhóm/gói không thuộc nguồn LAB.", 400);
    if (after.birthYear > new Date().getFullYear()) throw new ChangeLabError("Năm sinh không được ở tương lai.", 400);
    if (after.employeeCode && store.targets.some(t => t.id !== draft.targetId && t.value.kind === "member" && t.value.groupId === after.groupId && t.value.employeeCode.toLowerCase() === after.employeeCode.toLowerCase())) throw new ChangeLabError("Trùng mã nhân viên trong nhóm LAB.", 400);
  } else if (draft.after.services.some(s => !labCatalog.some(c => c.id === s.serviceId))) throw new ChangeLabError("Dịch vụ không thuộc danh mục LAB.", 400);
}
function requireAction(session: AdminSession, action: string) {
  if (!canAdminAccessPath(session, "/admin/ksk-changes") || !canAdminPerformAction(session, action)) throw new ChangeLabError("Không có quyền thực hiện thao tác phiếu thay đổi này.", 403);
}
function sameUser(a: string, b: string) { return a.toLowerCase() === b.toLowerCase(); }

export function executeChangeLab(session: AdminSession, raw: ChangeCommand) {
  const command = changeCommandSchema.parse(raw);
  // Check role before reading or locking the store, not only before rendering buttons.
  if (command.action === "create") requireAction(session, changeDraftAction(command.after.kind));
  else if (command.action === "approve" || command.action === "reject") requireAction(session, "ksk_change_approve");
  else if (command.action === "apply_simulation" || command.action === "apply_his") requireAction(session, "ksk_change_apply");
  else if (!canAdminAccessPath(session, "/admin/ksk-changes")) throw new ChangeLabError("Không có quyền xem LAB.", 403);
  if (command.action === "apply_his") throw new ChangeLabError("Ghi HIS thật CHƯA TRIỂN KHAI. Chỉ được áp dụng vào HIS giả lập, không có kết nối Oracle ghi.", 501);
  const file = location(), lockPath = `${file}.lock`;
  let lock: number;
  try { lock = openSync(lockPath, "wx", 0o600); } catch { throw new ChangeLabError("Kho LAB đang được cập nhật hoặc còn khóa sau sự cố; thử lại/liên hệ quản trị.", 423); }
  let temporary: string | undefined;
  try {
    const store = load(file), now = new Date().toISOString();
    if (command.action === "create") {
      if (command.sourceVersion !== fingerprint(store)) throw new ChangeLabError("Nguồn LAB đã đổi. Làm mới và kiểm tra lại nội dung trước khi lập phiếu.");
      if (store.drafts.length >= 500) throw new ChangeLabError("Đã đạt giới hạn 500 phiếu thử.");
      const source = store.targets.find(t => t.id === command.targetId), id = randomUUID();
      if (command.targetId !== "NEW" && !source) throw new ChangeLabError("Không tìm thấy đối tượng LAB.", 404);
      const draft: ChangeDraft = { id, revision: 1, state: "draft", targetId: command.targetId === "NEW" ? `LAB-M-${id.slice(0, 8).toUpperCase()}` : command.targetId,
        sourceHash: fingerprint(store), before: source?.value ?? null, after: command.after, author: session.username,
        createdAt: now, updatedAt: now, reason: command.reason, history: [{ actor: session.username, at: now, action: "create", reason: command.reason, proposal: command.after }] };
      validateTarget(store, draft);
      if (JSON.stringify(draft.before) === JSON.stringify(draft.after)) throw new ChangeLabError("Chưa có thay đổi so với dữ liệu nguồn.", 400);
      store.drafts.push(draft);
    } else {
      const draft = store.drafts.find(d => d.id === command.id);
      if (!draft) throw new ChangeLabError("Không tìm thấy phiếu.", 404);
      if (command.revision !== draft.revision) throw new ChangeLabError("Phiếu đã thay đổi. Làm mới trước khi tiếp tục.");
      if (draft.history.length >= 100) throw new ChangeLabError("Phiếu đã đạt giới hạn lịch sử; lập phiếu mới.");
      if (command.action === "save" || command.action === "submit") {
        requireAction(session, changeDraftAction(draft.after.kind));
        if (!sameUser(draft.author, session.username)) throw new ChangeLabError("Chỉ người lập được sửa/gửi phiếu của mình.", 403);
        if (!["draft", "rejected"].includes(draft.state)) throw new ChangeLabError("Chỉ sửa/gửi phiếu nháp hoặc bị từ chối.");
      }
      if (command.action !== "reject") {
        if (draft.sourceHash !== fingerprint(store)) throw new ChangeLabError("Nguồn LAB đã đổi từ khi lập phiếu. Lập phiếu mới từ dữ liệu đã làm mới; không ghi đè.");
        validateTarget(store, draft);
      }
      if (command.action === "save") {
        if (command.after.kind !== draft.after.kind) throw new ChangeLabError("Không đổi loại đối tượng trong một phiếu.", 400);
        validateTarget(store, { ...draft, after: command.after });
        draft.after = command.after; draft.reason = command.reason; draft.state = "draft";
        delete draft.reviewer;
      } else if (command.action === "submit") {
        if (JSON.stringify(draft.before) === JSON.stringify(draft.after)) throw new ChangeLabError("Phiếu chưa có nội dung thay đổi.", 400);
        draft.state = "submitted";
      } else if (command.action === "approve" || command.action === "reject") {
        if (draft.state !== "submitted") throw new ChangeLabError("Chỉ duyệt/từ chối phiếu đang chờ duyệt.");
        if (sameUser(draft.author, session.username)) throw new ChangeLabError("Người lập không được tự duyệt hoặc tự từ chối; cần người kiểm soát thứ hai.", 403);
        draft.state = command.action === "approve" ? "approved" : "rejected";
        draft.reviewer = session.username;
      } else if (command.action === "apply_simulation") {
        if (draft.state !== "approved" || !draft.reviewer || sameUser(draft.author, draft.reviewer)) throw new ChangeLabError("Phiếu chưa được người khác duyệt hoặc đã áp dụng.");
        const target = store.targets.find(t => t.id === draft.targetId);
        if (target) target.value = draft.after;
        else { if (store.targets.length >= 1000) throw new ChangeLabError("Đã đạt giới hạn người trong LAB."); store.targets.push({ id: draft.targetId, hasVisit: false, value: draft.after }); }
        draft.state = "simulated"; draft.appliedBy = session.username;
      }
      draft.revision++; draft.updatedAt = now;
      draft.history.push({ actor: session.username, at: now, action: command.action, reason: command.reason,
        ...(command.action === "save" ? { proposal: command.after } : {}) });
    }
    // A single atomic commit contains mock-HIS changes, status and audit; no external side effects.
    const content = JSON.stringify(storeSchema.parse(store), null, 2);
    if (Buffer.byteLength(content) > 10000000) throw new ChangeLabError("Kho LAB vượt giới hạn.", 503);
    temporary = `${file}.tmp-${randomUUID()}`;
    writeFileSync(temporary, content, { flag: "wx", mode: 0o600 });
    renameSync(temporary, file); temporary = undefined;
    return snapshot(store);
  } finally {
    if (temporary && existsSync(temporary)) unlinkSync(temporary);
    closeSync(lock); unlinkSync(lockPath);
  }
}
