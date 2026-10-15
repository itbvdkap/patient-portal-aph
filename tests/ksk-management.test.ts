// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { executeManagement, readManagementDrafts } from "@/lib/ksk/management-store";
import { createManagementRepository, type ManagementRepository } from "@/lib/ksk/management-repository";
import { managementCommandSchema, managementProposalSchema, proposalFromRow, type ManagementDraft, type ManagementProposal, type ManagementSnapshot } from "@/lib/ksk/management-contract";
import { canAdminPerformAction, type AdminSession } from "@/lib/admin/session";
const query = { from: "2026-10-01", to: "2026-10-14", cohort: "2" };
function fixture(): ManagementSnapshot { return { branch: "CN1", version: "a".repeat(64), writeEnabled: true, cohortId: "2", customers: [{ id: "1", ten: "Công ty giả lập", stt: "1" }], cohorts: [{ id: "2", done: "0" }], groups: [], members: [], packages: [], items: [], services: [], hasVisits: false, visitedMembers: [], visitedGroups: [] }; }
const maker: AdminSession = { username: "maker", role: "staff", exp: 9999999999, menus: ["ksk_manage"], actions: ["ksk_manage_roster"] };
const reviewer: AdminSession = { username: "reviewer", role: "staff", exp: 9999999999, menus: ["ksk_manage"], actions: ["ksk_manage_approve", "ksk_manage_apply"] };
const proposal: ManagementProposal = { kind: "customer", key: "1", fields: { ten: "Công ty đề nghị giả lập", stt: "1" }, items: [] };
let temporary: string, data: ManagementSnapshot, repo: ManagementRepository;
beforeEach(() => {
  temporary = mkdtempSync(path.join(os.tmpdir(), "aph-management-test-"));
  vi.stubEnv("VERCEL", ""); vi.stubEnv("KSK_MANAGEMENT_ENABLED", "true"); vi.stubEnv("KSK_MANAGEMENT_BRANCH", "CN1");
  vi.stubEnv("KSK_MANAGEMENT_STORE_PATH", path.join(temporary, "drafts.enc")); vi.stubEnv("KSK_MANAGEMENT_STORE_SECRET", "synthetic-test-secret-of-at-least-32-characters");
  data = fixture(); repo = { read: vi.fn(async () => data), patient: vi.fn(), validate: vi.fn(async () => {}), apply: vi.fn(async () => ({ applied: "true", key: "1" })) };
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); if (path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith("aph-management-test-")) throw new Error("Unsafe cleanup"); rmSync(temporary, { recursive: true }); });
async function create() { return (await executeManagement(maker, { action: "create", query, version: data.version, proposal, reason: "Đổi công ty thử nghiệm" }, repo))[0]; }
async function step(draft: ManagementDraft, action: "submit" | "approve" | "reject" | "apply", actor = reviewer) { return (await executeManagement(actor, { action, id: draft.id, revision: draft.revision, reason: "Kiểm tra thử nghiệm" }, repo))[0]; }
describe("Real management workflow using an isolated fake repository", () => {
  it("encrypts drafts and reads them back without exposing names in the file", async () => {
    const draft = await create(); const bytes = readFileSync(path.join(temporary, "drafts.enc"));
    expect(bytes.subarray(0, 4).toString()).toBe("KSM1"); expect(bytes.includes(Buffer.from(proposal.fields.ten))).toBe(false);
    expect(readManagementDrafts()[0].before?.fields.ten).toBe("Công ty giả lập");
    expect(draft.author).toBe("maker"); expect(repo.apply).not.toHaveBeenCalled();
  });
  it("runs read-only preflight without saving a draft or calling apply", async () => {
    const rows = await executeManagement(maker, { action: "check", query, version: data.version, proposal, reason: "Kiểm tra trước khi lưu" }, repo);
    expect(rows).toEqual([]); expect(repo.validate).toHaveBeenCalledOnce(); expect(repo.apply).not.toHaveBeenCalled(); expect(readManagementDrafts()).toEqual([]);
  });
  it("requires explicit real-management rights, not LAB rights or menu visibility alone", async () => {
    expect(canAdminPerformAction({ ...maker, menus: ["ksk_changes"] }, "ksk_manage_roster")).toBe(false);
    await expect(executeManagement({ ...maker, actions: [] }, { action: "create", query, version: data.version, proposal, reason: "Thử phân quyền" }, repo)).rejects.toThrow("Không có quyền");
    await expect(executeManagement({ ...maker, menus: ["ksk_changes"], actions: ["ksk_roster_draft"] }, { action: "create", query, version: data.version, proposal, reason: "Thử phân quyền" }, repo)).rejects.toThrow();
  });
  it("rejects stale source, missing targets, validation errors and forged SQL fields", async () => {
    await expect(executeManagement(maker, { action: "create", query, version: "b".repeat(64), proposal, reason: "Nguồn phiên bản cũ" }, repo)).rejects.toThrow("Nguồn HIS đã thay đổi");
    data.customers = []; await expect(create()).rejects.toThrow("Đối tượng không thuộc");
    data = fixture(); vi.mocked(repo.validate).mockRejectedValueOnce(new Error("readonly validation failed")); await expect(create()).rejects.toThrow(); expect(readManagementDrafts()).toHaveLength(0);
    expect(managementProposalSchema.safeParse({ ...proposal, fields: { ...proposal.fields, userid: "1" } }).success).toBe(false);
    expect(managementCommandSchema.safeParse({ action: "create", query, version: data.version, proposal, reason: "Thử tạo", author: "admin" }).success).toBe(false);
  });
  it("requires another person to approve and revalidates source before submit/approval", async () => {
    const d = await create(); await expect(step(d, "submit", { ...maker, username: "other" })).rejects.toThrow("Chỉ người lập");
    const submitted = await step(d, "submit", maker);
    await expect(step(submitted, "approve", { ...maker, actions: ["ksk_manage_approve"] })).rejects.toThrow("không được tự duyệt");
    const approved = await step(submitted, "approve"); expect(approved.reviewer).toBe("reviewer"); expect(repo.validate).toHaveBeenCalledTimes(3); expect(repo.apply).not.toHaveBeenCalled();
  });
  it("leaves an approved draft unchanged if agent writes are disabled", async () => {
    const approved = await step(await step(await create(), "submit", maker), "approve"); data.writeEnabled = false;
    await expect(step(approved, "apply")).rejects.toThrow("Agent chưa mở ghi"); expect(repo.apply).not.toHaveBeenCalled(); expect(readManagementDrafts()[0].state).toBe("approved");
  });
  it("applies once and never accepts stale revision or direct apply of a draft", async () => {
    const d = await create(); await expect(step(d, "apply")).rejects.toThrow("Phiếu chưa duyệt");
    const approved = await step(await step(d, "submit", maker), "approve"), applied = await step(approved, "apply");
    expect(applied.state).toBe("applied"); expect(repo.apply).toHaveBeenCalledOnce();
    await expect(step(approved, "apply")).rejects.toThrow("phiên bản đã đổi"); await expect(step(applied, "apply")).rejects.toThrow();
  });
  it("persists uncertainty and recovers with exactly the same command/body after a lost response", async () => {
    const approved = await step(await step(await create(), "submit", maker), "approve");
    vi.mocked(repo.apply).mockRejectedValueOnce(new Error("lost response after database commit"));
    await expect(step(approved, "apply")).rejects.toThrow("lost response"); const uncertain = readManagementDrafts()[0]; expect(uncertain.state).toBe("uncertain");
    const firstBody = vi.mocked(repo.apply).mock.calls[0][0];
    const applied = (await executeManagement({ ...reviewer, username: "recovery-operator" }, { action: "apply", id: uncertain.id, revision: uncertain.revision, reason: "Lý do khôi phục khác" }, repo))[0];
    expect(applied.state).toBe("applied"); expect(vi.mocked(repo.apply).mock.calls[1][0]).toEqual(firstBody);
  });
  it("does not interpret KSKMUC row IDs as group codes or invent quantities", () => {
    const s = fixture(); s.items = [{ id: "900000000000000001", mavp: "5", stt: "1", gia_nv: "100", gia_ngv: "200", ghichu: "" }];
    const row = { id: "900000000000000001", stt: "1", phai: "0", tt: "", namsinh: "", ghichu: "Mẫu", namsinh_tu: "1900", namsinh_den: "9999", id_goi_kskmuc: "7", tinhtrang_honnhan: "2" };
    const p = proposalFromRow(s, "package", row); expect(p.fields.id_goi_kskmuc).toBe("7"); expect(p.key).toBe(row.id); expect(p.items[0]).not.toHaveProperty("quantity");
  });
  it("fails closed for wrong encryption secret, disabled module and public deployment", async () => {
    await create(); vi.stubEnv("KSK_MANAGEMENT_STORE_SECRET", "a-different-test-secret-with-at-least-32-chars"); expect(() => readManagementDrafts()).toThrow();
    vi.stubEnv("KSK_MANAGEMENT_ENABLED", "false"); expect(() => createManagementRepository()).toThrow("chưa mở");
    vi.stubEnv("KSK_MANAGEMENT_ENABLED", "true"); vi.stubEnv("VERCEL", "1"); expect(() => createManagementRepository()).toThrow();
  });
});
