import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const exporter = vi.hoisted(() => ({ xlsx: vi.fn() }));
vi.mock("@/lib/ksk/report-export", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ksk/report-export")>("@/lib/ksk/report-export");
  return { ...actual, reportXlsx: exporter.xlsx };
});
import { KskReports } from "@/app/admin/ksk/reports";
import { demoKskSnapshot } from "@/lib/ksk/sample";

let host: HTMLDivElement, root: Root;
const data = () => demoKskSnapshot({ from: "2026-10-01", to: "2026-10-14", cohort: "900001" });
beforeEach(() => {
  vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label)!;
const click = (label: string) => act(() => button(label).dispatchEvent(new MouseEvent("click", { bubbles: true })));
const select = (id: string, value: string) => act(() => { const node = host.querySelector<HTMLSelectElement>(`#${id}`)!; node.value = value; node.dispatchEvent(new Event("change", { bubbles: true })); });
function render() {
  const sample = data();
  act(() => root.render(<KskReports data={sample} allMembers={sample.members} filteredMembers={[sample.members[0]]} filterLabel="Theo bộ lọc mẫu" />));
}
describe("KSK reporting actions", () => {
  it("opens collection/results reports with the current filtered list, not only a pagination page", () => {
    render();
    expect([...host.querySelectorAll("button")].some(b => b.textContent?.includes("Xuất Excel XN + CLS (1 BN)"))).toBe(true);
    expect(host.textContent).toContain("mỗi bệnh nhân một hàng");
    click("Danh sách & thu tiền");
    expect(host.textContent).toContain("1 người · Danh sách và thu: 1 dòng");
    select("ksk-report-scope", "all"); expect(host.textContent).toContain("3 người");
    click("Kết quả XN / CLS"); select("ksk-report-results", "has");
    expect(host.textContent).toContain("1 người · Danh sách kết quả");
    select("ksk-report-sheet", "2"); expect(host.textContent).toContain("XN chi tiết: 2 dòng");
    click("Đóng báo cáo"); expect(host.querySelector("#ksk-report-sheet")).toBeNull();
  });
  it("opens escaped print content and invokes printing only on explicit click", () => {
    const write = vi.fn(), print = vi.fn();
    const popup = { opener: window, document: { open: vi.fn(), write, close: vi.fn() }, focus: vi.fn(), print };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    render(); click("Danh sách & thu tiền"); expect(print).not.toHaveBeenCalled();
    click("In bảng đang chọn / PDF");
    expect(print).toHaveBeenCalledOnce(); expect(write.mock.calls[0][0]).toContain("Theo bộ lọc mẫu"); expect(popup.opener).toBeNull();
  });
  it("explains blocked popups without silently losing the report", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    render(); click("Danh sách & thu tiền"); click("In bảng đang chọn / PDF");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("chặn cửa sổ in");
    expect(host.querySelector("#ksk-report-sheet")).not.toBeNull();
  });
  it("downloads only the chosen subset as XLSX using a temporary Blob URL", async () => {
    vi.useFakeTimers();
    exporter.xlsx.mockResolvedValue(new Uint8Array([80, 75]));
    const create = vi.fn().mockReturnValue("blob:report-test"), revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    render(); click("Kết quả XN / CLS");
    await act(async () => { button("Xuất Excel đầy đủ").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(exporter.xlsx.mock.calls[0][0].memberCount).toBe(1);
    expect(clicked[0].download).toBe("ksk-DEMO-xn-cls-900001.xlsx"); expect(create).toHaveBeenCalledOnce();
    expect(host.querySelector('a[download]')).toBeNull();
    act(() => vi.runAllTimers()); expect(revoke).toHaveBeenCalledWith("blob:report-test"); vi.useRealTimers();
  });
});
