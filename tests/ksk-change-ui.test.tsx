import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeWorkspace } from "@/app/admin/ksk-changes/workspace";
import { seedLabTargets, labCatalog, labGroups } from "@/lib/ksk/change-lab-seed";
import type { ChangeDraft, ChangeLabSnapshot } from "@/lib/ksk/change-contract";
let host: HTMLDivElement, root: Root;
const source = (): ChangeLabSnapshot => ({ mode: "simulation", realHisWriteEnabled: false, sourceVersion: "a".repeat(64), targets: seedLabTargets(), drafts: [], catalog: labCatalog, groups: labGroups });
function draft(state: ChangeDraft["state"]): ChangeDraft {
  return { id: "00000000-0000-4000-8000-000000000001", revision: 2, state, targetId: "LAB-P01", sourceHash: "a".repeat(64), before: seedLabTargets()[0].value,
    after: { ...seedLabTargets()[0].value, name: "Gói đề nghị GIẢ LẬP" }, author: "maker", ...(state === "approved" ? { reviewer: "checker" } : {}),
    createdAt: "2026-10-15T01:02:03Z", updatedAt: "2026-10-15T01:02:03Z", reason: "Thử nghiệp vụ", history: [] };
}
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function choose(value: string) {
  act(() => { const select = host.querySelector<HTMLSelectElement>('select[aria-label="Đối tượng LAB"]')!; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
function open() { act(() => [...host.querySelectorAll("button")].find(b => b.textContent === "Xem / xử lý phiếu")!.click()); }
function reason() {
  act(() => { const input = host.querySelector<HTMLTextAreaElement>('[aria-label="Chi tiết phiếu thay đổi"] textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Đã đối chiếu mẫu"); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
describe("LAB draft/approval UI", () => {
  it("shows simulation prominently and does not enable writes for a view-only user", () => {
    act(() => root.render(<ChangeWorkspace initialData={source()} username="reader" actions={[]} />));
    expect(host.textContent).toContain("Ghi HIS thật đang khóa và chưa triển khai");
    expect(host.querySelector('form fieldset')?.hasAttribute("disabled")).toBe(true);
    expect(host.textContent).toContain("Chưa được cấp quyền");
    expect(host.textContent).not.toContain("Ghi vào CN1");
  });
  it("enables roster editing separately and locks already registered source objects", () => {
    act(() => root.render(<ChangeWorkspace initialData={source()} username="maker" actions={["ksk_roster_draft"]} />));
    expect(host.querySelector('form fieldset')?.hasAttribute("disabled")).toBe(true);
    choose("NEW"); expect(host.querySelector('form fieldset')?.hasAttribute("disabled")).toBe(false);
    expect(host.textContent).toContain("Năm sinh"); expect(host.textContent).toContain("Mã nhân viên");
    choose("LAB-M02"); expect(host.querySelector('form fieldset')?.hasAttribute("disabled")).toBe(true);
    expect(host.textContent).toContain("Đã có tiếp nhận");
  });
  it("prevents the author from approving even if the UI is given the approval action", () => {
    const data = source(); data.drafts = [draft("submitted")];
    act(() => root.render(<ChangeWorkspace initialData={data} username="maker" actions={["ksk_change_approve"]} />)); open();
    expect(host.textContent).toContain("Không được tự duyệt");
    expect([...host.querySelectorAll("button")].find(b => b.textContent === "Duyệt phiếu")).toBeUndefined();
    expect(host.querySelector('[aria-label="Chi tiết phiếu thay đổi"]')?.textContent).toContain("Trước — nguồn lúc lập phiếu");
  });
  it("requires a reason before another user can approve, and sends the exact reviewed revision", async () => {
    const data = source(); data.drafts = [draft("submitted")];
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...data, drafts: [draft("approved")] }) }); vi.stubGlobal("fetch", fetch);
    act(() => root.render(<ChangeWorkspace initialData={data} username="checker" actions={["ksk_change_approve"]} />)); open();
    const approve = [...host.querySelectorAll("button")].find(b => b.textContent === "Duyệt phiếu")!;
    expect(approve.disabled).toBe(true); reason(); expect(approve.disabled).toBe(false);
    await act(async () => approve.click());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ action: "approve", id: data.drafts[0].id, revision: 2, reason: "Đã đối chiếu mẫu" });
  });
  it("requires explicit mock-apply confirmation and never offers a real-HIS button", async () => {
    const data = source(); data.drafts = [draft("approved")];
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...data, drafts: [draft("simulated")] }) }); vi.stubGlobal("fetch", fetch);
    act(() => root.render(<ChangeWorkspace initialData={data} username="checker" actions={["ksk_change_apply"]} />)); open(); reason();
    const apply = [...host.querySelectorAll("button")].find(b => b.textContent === "Áp dụng HIS GIẢ LẬP")!;
    expect(apply.disabled).toBe(true);
    act(() => host.querySelector<HTMLInputElement>('[aria-label="Chi tiết phiếu thay đổi"] input[type="checkbox"]')!.click());
    expect(apply.disabled).toBe(false); await act(async () => apply.click());
    expect(JSON.parse(fetch.mock.calls[0][1].body).action).toBe("apply_simulation");
    expect(host.textContent).toContain("Oracle thật không bị thay đổi");
  });
});
