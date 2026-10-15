import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ManagementWorkspace } from "@/app/admin/ksk-manage/workspace";
import type { ManagementDraft, ManagementSnapshot } from "@/lib/ksk/management-contract";
let host: HTMLDivElement, root: Root;
const query = { from: "2026-10-01", to: "2026-10-14", cohort: "2" };
function fixture(): ManagementSnapshot { return { branch: "CN1", version: "a".repeat(64), writeEnabled: false, cohortId: "2", customers: [{ id: "1", ten: "Công ty MẪU", stt: "1" }], cohorts: [{ id: "2", ten: "Đợt MẪU", done: "0" }], groups: [], members: [], packages: [], items: [], services: [], hasVisits: false, visitedMembers: [], visitedGroups: [] }; }
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function button(text: string) { return [...host.querySelectorAll("button")].find(b => b.textContent === text)!; }
describe("HIS management UI is separate from synthetic LAB", () => {
  it("shows real-data/write-off status and all five entity editors without enabling mutation for viewers", () => {
    act(() => root.render(<ManagementWorkspace initialData={fixture()} initialDrafts={[]} query={query} username="viewer" actions={[]} />));
    expect(host.textContent).toContain("Dữ liệu thật"); expect(host.textContent).toContain("Ghi đang tắt");
    expect(host.querySelectorAll('[aria-label="Phân hệ quản lý"] button')).toHaveLength(5);
    expect(button("Thêm đợt khám").disabled).toBe(true);
    expect(host.querySelector('[aria-label="Soạn thay đổi HIS"]')).toBeNull();
  });
  it("lets permitted users draft a real cohort while keeping identity keys server controlled", () => {
    act(() => root.render(<ManagementWorkspace initialData={fixture()} initialDrafts={[]} query={query} username="maker" actions={["ksk_manage_roster"]} />));
    act(() => button("Thêm đợt khám").click());
    const form = host.querySelector('[aria-label="Soạn thay đổi HIS"]')!;
    expect(form.textContent).toContain("Công ty / khách hàng"); expect(form.textContent).toContain("Ghi chú / CSKH");
    expect(form.textContent).toContain("Lưu bản nháp — chưa ghi HIS");
    expect(form.textContent).not.toContain("USERID");
  });
  it("locks existing registered cohorts and never offers an enabled apply button while writes are off", () => {
    const data = fixture(); data.hasVisits = true;
    const draft: ManagementDraft = { id: "00000000-0000-4000-8000-000000000001", revision: 3, branch: "CN1", query, version: data.version, state: "approved", proposal: { kind: "customer", key: "1", fields: { ten: "Tên mẫu đổi", stt: "1" }, items: [] }, before: null, author: "maker", reviewer: "reviewer", reason: "Lý do mẫu", updatedAt: "2026-10-15T00:00:00Z", history: [] };
    act(() => root.render(<ManagementWorkspace initialData={data} initialDrafts={[draft]} query={query} username="reviewer" actions={["ksk_manage_roster", "ksk_manage_apply"]} />));
    expect(button("Khóa: đã tiếp nhận").disabled).toBe(true);
    act(() => button("Xem / xử lý").click()); expect(button("Áp dụng vào HIS thật").disabled).toBe(true);
    expect(host.textContent).toContain("Tôi xác nhận nội dung đã duyệt");
  });
});
