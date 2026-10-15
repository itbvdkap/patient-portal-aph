// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { adminActions } from "@/lib/admin/permissions";
import type { AdminSession } from "@/lib/admin/session";
import { executeChangeLab, readChangeLab } from "@/lib/ksk/change-lab-store";
import { type ChangeCommand, type ChangeDraft, type ChangeProposal } from "@/lib/ksk/change-contract";

let temporary: string, file: string;
const maker: AdminSession = { username: "maker", role: "staff", exp: 9999999999, menus: ["ksk_changes"], actions: ["ksk_package_draft", "ksk_roster_draft"] };
const checker: AdminSession = { username: "checker", role: "staff", exp: 9999999999, menus: ["ksk_changes"], actions: ["ksk_change_approve", "ksk_change_apply"] };
const admin: AdminSession = { username: "admin", role: "super_admin", exp: 9999999999 };
beforeEach(() => {
  temporary = mkdtempSync(path.join(os.tmpdir(), "aph-ksk-change-test-")); file = path.join(temporary, "lab.json");
  vi.stubEnv("KSK_CHANGE_LAB_ENABLED", "true"); vi.stubEnv("KSK_CHANGE_STORE_PATH", file); vi.stubEnv("VERCEL", "");
});
afterEach(() => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
  if (path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith("aph-ksk-change-test-")) throw new Error("Unsafe temp cleanup");
  rmSync(temporary, { recursive: true });
});
function create(actor = maker, targetId = "LAB-P01", patch: Partial<ChangeProposal> = {}) {
  const source = readChangeLab(), after = { ...source.targets.find(t => t.id === targetId)!.value, name: "Tên mới GIẢ LẬP", ...patch } as ChangeProposal;
  return executeChangeLab(actor, { action: "create", targetId, sourceVersion: source.sourceVersion, after, reason: "Lý do thử nghiệm" }).drafts[0];
}
function step(draft: ChangeDraft, action: Exclude<ChangeCommand["action"], "create" | "save">, actor = checker) {
  return executeChangeLab(actor, { action, id: draft.id, revision: draft.revision, reason: "Kiểm tra thử nghiệm" }).drafts.find(d => d.id === draft.id)!;
}
describe("Isolated draft → other-person approval → mock HIS commit", () => {
  it("keeps source unchanged until approval and atomically applies once with full audit", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const initial = readChangeLab(), draft = create();
    expect(readChangeLab().targets).toEqual(initial.targets);
    const submitted = step(draft, "submit", maker), approved = step(submitted, "approve");
    expect(readChangeLab().targets).toEqual(initial.targets);
    const applied = step(approved, "apply_simulation");
    expect(applied).toMatchObject({ state: "simulated", revision: 4, author: "maker", reviewer: "checker", appliedBy: "checker" });
    expect(applied.history.map(e => e.action)).toEqual(["create", "submit", "approve", "apply_simulation"]);
    expect(readChangeLab().targets[0].value.name).toBe("Tên mới GIẢ LẬP");
    const committed = readFileSync(file, "utf8");
    expect(() => step(approved, "apply_simulation")).toThrow("Phiếu đã thay đổi");
    expect(() => step(applied, "apply_simulation")).toThrow();
    expect(readFileSync(file, "utf8")).toBe(committed);
    expect(fetch).not.toHaveBeenCalled(); expect(readChangeLab().realHisWriteEnabled).toBe(false);
  });
  it("rejects self approval even for a super admin and blocks direct apply/edit of approved content", () => {
    const draft = create(admin), submitted = step(draft, "submit", admin);
    expect(() => step(submitted, "approve", admin)).toThrow("Người lập không được tự duyệt");
    expect(() => step(submitted, "apply_simulation")).toThrow("chưa được người khác duyệt");
    const approved = step(submitted, "approve");
    expect(() => executeChangeLab(admin, { action: "save", id: approved.id, revision: approved.revision, after: approved.after, reason: "Sửa sau duyệt" })).toThrow("Chỉ sửa/gửi");
  });
  it("allows only author edits and requires resubmission/reapproval after rejection", () => {
    const draft = create();
    expect(() => step(draft, "submit", { ...maker, username: "other" })).toThrow("Chỉ người lập");
    const rejected = step(step(draft, "submit", maker), "reject");
    expect(() => step(rejected, "apply_simulation")).toThrow();
    const saved = executeChangeLab(maker, { action: "save", id: draft.id, revision: rejected.revision, after: { ...draft.after, name: "Đã sửa GIẢ LẬP" }, reason: "Sửa theo góp ý" }).drafts[0];
    expect(saved.state).toBe("draft"); expect(saved.reviewer).toBeUndefined();
    expect(saved.history[0].proposal?.name).toBe("Tên mới GIẢ LẬP");
    expect(saved.history.at(-1)?.proposal?.name).toBe("Đã sửa GIẢ LẬP");
    expect(step(step(saved, "submit", maker), "approve").state).toBe("approved");
  });
  it("requires explicit menu plus exact action, never borrowing old report or unrelated mutation rights", () => {
    const source = readChangeLab(), command: ChangeCommand = { action: "create", targetId: "LAB-P01", sourceVersion: source.sourceVersion, after: { ...source.targets[0].value, name: "Đổi thử" }, reason: "Thử phân quyền" };
    for (const actor of [{ ...maker, actions: [] }, { ...maker, menus: ["ksk" as const], actions: adminActions }, { ...maker, role: "support" as const }, { ...maker, actions: ["ksk_roster_draft" as const] }]) expect(() => executeChangeLab(actor, command)).toThrow("Không có quyền");
    const draft = create();
    expect(() => step(draft, "approve", maker)).toThrow("Không có quyền");
    expect(() => step(draft, "submit", checker)).toThrow("Không có quyền");
  });
  it("blocks stale revision, stale create source and stale approved baseline rather than overwriting", () => {
    const oldSource = readChangeLab(), one = create(), two = create(maker, "LAB-M01");
    const submitted = step(one, "submit", maker);
    expect(() => step(one, "submit", maker)).toThrow("Phiếu đã thay đổi");
    step(step(submitted, "approve"), "apply_simulation");
    expect(() => step(two, "submit", maker)).toThrow("Nguồn LAB đã đổi");
    expect(() => executeChangeLab(maker, { action: "create", targetId: "LAB-M01", sourceVersion: oldSource.sourceVersion, after: { ...oldSource.targets[2].value, name: "Tên cũ" }, reason: "Nguồn cũ thử" })).toThrow("Nguồn LAB đã đổi");
  });
  it("locks visited members and packages; checks again if reception appears after approval", () => {
    expect(() => create(maker, "LAB-M02")).toThrow("đã tiếp nhận");
    expect(() => create(maker, "LAB-P02")).toThrow("đã tiếp nhận");
    const approved = step(step(create(), "submit", maker), "approve");
    const stored = JSON.parse(readFileSync(file, "utf8")); stored.targets[2].hasVisit = true;
    writeFileSync(file, JSON.stringify(stored));
    expect(() => step(approved, "apply_simulation")).toThrow("Nguồn LAB đã đổi");
  });
  it("adds a synthetic member only after approval and never creates a real patient", () => {
    const source = readChangeLab(), value = source.targets[2].value;
    const after = { ...value, name: "Người mới GIẢ LẬP", employeeCode: "TEST03" } as ChangeProposal;
    const draft = executeChangeLab(maker, { action: "create", targetId: "NEW", sourceVersion: source.sourceVersion, after, reason: "Thêm người thử" }).drafts[0];
    expect(draft.before).toBeNull(); expect(readChangeLab().targets).toHaveLength(4);
    step(step(step(draft, "submit", maker), "approve"), "apply_simulation");
    expect(readChangeLab().targets).toHaveLength(5);
    expect(readChangeLab().targets[4].id).toMatch(/^LAB-M-/);
  });
  it("validates service/member references, duplicate employee and strict untrusted payloads", () => {
    expect(() => create(maker, "LAB-P01", { services: [{ serviceId: "LAB-MISSING", quantity: 1, unitPrice: 10 }] } as never)).toThrow("Dịch vụ");
    expect(() => create(maker, "LAB-P01", { services: [{ serviceId: "LAB-S01", quantity: -1, unitPrice: 10 }] } as never)).toThrow();
    expect(() => create(maker, "LAB-M01", { packageId: "LAB-MISSING" } as never)).toThrow("Nhóm/gói");
    const source = readChangeLab(), after = { ...source.targets[2].value, name: "Khác tên" } as ChangeProposal;
    expect(() => executeChangeLab(maker, { action: "create", targetId: "NEW", sourceVersion: source.sourceVersion, after, reason: "Người trùng mã" })).toThrow("Trùng mã");
    expect(() => executeChangeLab(maker, { action: "create", targetId: "LAB-P01", sourceVersion: source.sourceVersion, after, reason: "Thử sửa", author: "someone" } as never)).toThrow();
  });
  it("always refuses real HIS writes, even with an apply permission and a writable environment", () => {
    const approved = step(step(create(), "submit", maker), "approve"), before = readFileSync(file, "utf8");
    vi.stubEnv("KSK_HIS_WRITE_ENABLED", "true");
    expect(() => step(approved, "apply_his")).toThrow("CHƯA TRIỂN KHAI");
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("fails closed when disabled/public, busy, corrupt, or configured inside public", () => {
    vi.stubEnv("KSK_CHANGE_LAB_ENABLED", "false"); expect(() => readChangeLab()).toThrow("chưa bật");
    vi.stubEnv("KSK_CHANGE_LAB_ENABLED", "true"); vi.stubEnv("VERCEL", "1"); expect(() => readChangeLab()).toThrow();
    vi.stubEnv("VERCEL", ""); writeFileSync(`${file}.lock`, "locked"); expect(() => create()).toThrow("đang được cập nhật");
    rmSync(`${file}.lock`); writeFileSync(file, "corrupt"); expect(() => readChangeLab()).toThrow();
    vi.stubEnv("KSK_CHANGE_STORE_PATH", path.resolve("public", "lab.json")); expect(() => readChangeLab()).toThrow();
  });
});
