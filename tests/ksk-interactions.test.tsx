import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children) }));
import { KskWorkspace } from "@/app/admin/ksk/workspace";
import { KskFilterBar, filterChoices } from "@/app/admin/ksk/filters";
import { demoKskSnapshot } from "@/lib/ksk/sample";

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const query = { from: "2026-10-01", to: "2026-10-14", cohort: "900001" };
const select = (id: string, value: string) => act(() => { const node = host.querySelector<HTMLSelectElement>(`#${id}`)!; node.value = value; node.dispatchEvent(new Event("change", { bubbles: true })); });
const choose = (id: string, text: string) => act(() => { const node = host.querySelector<HTMLInputElement>(`#${id}`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, text);
  node.dispatchEvent(new Event("input", { bubbles: true })); });
const click = (button: HTMLButtonElement) => act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("KSK local UI interactions (DOM, no clinical data)", () => {
  it("payment cards filter members, toggle back, and the dropdown matches the same state", () => {
    const data = demoKskSnapshot(query);
    act(() => root.render(<KskWorkspace data={data} query={query} />));
    const none = [...host.querySelectorAll<HTMLButtonElement>('section[aria-label="Thanh toán theo chứng từ HIS"] button')].find(b => b.textContent?.includes("Chưa phát sinh"))!;
    click(none);
    expect(host.querySelector<HTMLSelectElement>("#ksk-payment")?.value).toBe("none");
    expect(host.textContent).toContain("1 người · Trang 1/1");
    expect(none.getAttribute("aria-pressed")).toBe("true");
    click(none);
    expect(host.textContent).toContain("3 người · Trang 1/1");
    select("ksk-payment", "unknown");
    expect(host.textContent).toContain("1 người · Trang 1/1");
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain("Chưa xác định");
  });
  it("opens receipt detail and closing a profile retains member filters", () => {
    const data = demoKskSnapshot(query);
    act(() => root.render(<KskWorkspace data={data} query={query} />));
    select("ksk-payment", "unpaid");
    click([...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Xem hồ sơ")!);
    expect(host.querySelector('[aria-label="Hồ sơ kết quả từng người"]')?.textContent).toContain("Chứng từ thanh toán");
    click([...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Đóng hồ sơ")!);
    expect(host.querySelector<HTMLSelectElement>("#ksk-payment")?.value).toBe("unpaid");
  });
  it("company selection narrows cohort choices and clears a stale cohort ID", () => {
    const data = demoKskSnapshot(query);
    const rows = [...data.cohorts, { ...data.cohorts[0], id: "900002", customerid: "901", customer: "Công ty mẫu B" }];
    act(() => root.render(<KskFilterBar query={query} rows={rows} filters={{ company: "", support: "" }} />));
    choose("ksk-company", "Công ty mẫu B");
    expect(host.querySelectorAll("#ksk-cohort-options option")).toHaveLength(1);
    expect(host.querySelector<HTMLOptionElement>("#ksk-cohort-options option")?.value).toContain("#900002");
    expect(host.querySelector<HTMLInputElement>('input[name="cohort"]')?.value).toBe("");
    choose("ksk-cohort", `${rows[1].name} · ${rows[1].date?.slice(0, 10)} · #900002`);
    expect(host.querySelector<HTMLInputElement>('input[name="cohort"]')?.value).toBe("900002");
    const form = host.querySelector("form")!;
    expect(new FormData(form).get("company")).toBe("901");
    expect(new FormData(form).getAll("cohort")).toEqual(["900002"]);
  });
  it("uses the entire note for staff grouping and preserves only IDs in detail/back links", () => {
    const data = demoKskSnapshot(query);
    const filters = { company: "900", support: "900001" };
    act(() => root.render(<KskWorkspace data={data} query={query} filters={filters} />));
    const back = [...host.querySelectorAll<HTMLAnchorElement>("a")].find(a => a.textContent?.includes("Danh sách đoàn"))!;
    expect(back.href).toContain("company=900"); expect(back.href).toContain("support=900001");
    expect(back.href).not.toContain("CSKH");
    const rows = [...data.cohorts, { ...data.cohorts[0], id: "900002", ghichu: "CSKH mẫu A — ghi chú khác" }];
    expect(filterChoices(rows, filters).map(c => c.id)).toEqual(["900001"]);
  });
});
