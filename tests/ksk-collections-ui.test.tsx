import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionWorkspace } from "@/app/admin/ksk-collections/workspace";
import { demoKskSnapshot } from "@/lib/ksk/sample";

let host: HTMLDivElement, root: Root;
const query = { from: "2026-10-01", to: "2026-10-14", collectedFrom: "2026-10-01", collectedTo: "2026-10-14", company: "", support: "", cashier: "", status: "" as const };
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
describe("Global collection report controls", () => {
  it("renders full collection time and source-precision notice, preserving midnight", () => {
    const data = demoKskSnapshot({ from: query.from, to: query.to, cohort: "900001" });
    data.members[0].cohortid = "900001";
    data.visits[0].cohortid = "900001";
    data.visits[0].registereddate = "2026-10-01T08:35:42";
    data.payments = [{ source: "DEMO", kind: "DIRECT", receiptid: "501", mabn: "DEMO001", maql: "1001", mavaovien: "1001", date: "2026-10-14T00:00:00" }];
    act(() => root.render(<CollectionWorkspace data={data} query={query} />));
    const table = host.querySelector("table")!;
    expect(table.textContent).toContain("Ngày giờ thu (HIS)");
    expect(table.textContent).toContain("14/10/2026 00:00:00");
    expect(table.textContent).toContain("01/10/2026 08:35:42");
    expect(table.textContent).not.toContain("2026-10-14T");
    expect(host.textContent).toContain("chưa xác minh đây là giờ thu thực tế");
  });
  it("has independent registration/collection date ranges and all requested staff/company filters", () => {
    act(() => root.render(<CollectionWorkspace data={null} query={query} />));
    expect(host.querySelector('form')?.getAttribute("action")).toBe("/admin/ksk-collections");
    expect(host.querySelectorAll('input[type="date"]')).toHaveLength(4);
    for (const name of ["company", "support", "cashier", "status"]) expect(host.querySelector(`select[name="${name}"]`)).not.toBeNull();
    expect(host.textContent).toContain("Đọc / Làm mới HIS");
    expect(host.textContent).toContain("không phải ngày tạo đoàn");
  });
  it("does not enable export/print or present a financial total when source data is missing", () => {
    const data = demoKskSnapshot({ from: query.from, to: query.to, cohort: "900001" });
    data.sections["payments:missing"] = false;
    act(() => root.render(<CollectionWorkspace data={data} query={query} />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Chưa tính tổng");
    const buttons = [...host.querySelectorAll<HTMLButtonElement>("button")].filter(b => /Xuất Excel|In \/ PDF/.test(b.textContent || ""));
    expect(buttons).toHaveLength(2); expect(buttons.every(b => b.disabled)).toBe(true);
    expect(host.querySelector('[aria-label="Tổng hợp chứng từ thu"]')?.textContent).toContain("Chưa xác định");
  });
  it("shows complete empty evidence as no matching receipts, without requiring a cohort selection", () => {
    const data = demoKskSnapshot({ from: query.from, to: query.to, cohort: "900001" });
    act(() => root.render(<CollectionWorkspace data={data} query={query} />));
    expect(host.textContent).toContain("Không có phiếu khớp");
    expect(host.querySelector('select[name="cohort"]')).toBeNull();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("Ngày thu 2026-10-01 → 2026-10-14");
  });
});
