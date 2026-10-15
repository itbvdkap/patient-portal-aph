import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/admin/admin-shell-client", () => ({ AdminShellClient: ({ nav, children }: { nav: import("@/app/admin/admin-shell-client").AdminShellNavItem[]; children: React.ReactNode }) => <><nav>{nav.map(n => "children" in n ? <section key={n.id}><h3>{n.label}</h3>{n.children.map(child => <a key={child.href} href={child.href}>{child.label}</a>)}</section> : <a key={n.href} href={n.href}>{n.label}</a>)}</nav>{children}</> }));
const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
import { AdminShell } from "@/app/admin/admin-shell";
import { StaffEditor } from "@/app/admin/staff/staff-editor";
import { PasswordForm } from "@/app/admin/password/password-form";
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
const staff = { username: "sample", displayName: "Mẫu", enabled: false, menus: ["ksk" as const], updatedAt: "2026-10-14", updatedBy: "admin" };
function enter(input: HTMLInputElement, value: string) {
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
describe("Staff menu display matches access", () => {
  it("requires the separate LAB menu before new action checkboxes can be enabled", () => {
    act(() => root.render(<StaffEditor initialUsers={[]} />));
    const actionFieldset = [...host.querySelectorAll("fieldset")].find(f => f.querySelector(":scope > legend")?.textContent === "Quyền thao tác phiếu thay đổi · LAB")!;
    expect(actionFieldset.disabled).toBe(true);
    const menuLabel = [...host.querySelectorAll("label")].find(l => l.textContent === "Phiếu thay đổi gói / danh sách · LAB")!;
    act(() => menuLabel.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(actionFieldset.disabled).toBe(false);
    expect(actionFieldset.querySelectorAll('input[type="checkbox"]')).toHaveLength(4);
    expect([...actionFieldset.querySelectorAll<HTMLInputElement>('input')].every(i => !i.checked)).toBe(true);
  });
  it("shows only landing and granted staff menus, no management or unrelated modules", () => {
    const html = renderToStaticMarkup(<AdminShell username="sample" role="staff" menus={["ksk"]}>Mẫu</AdminShell>);
    expect(html).toContain('href="/admin/ksk"'); expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/password"');
    expect(html).toContain("Quản lý khám sức khoẻ");
    for (const p of ["/admin/ksk-collections", "/admin/ksk-changes", "/admin/ksk-manage"]) expect(html).not.toContain(`href="${p}"`);
    for (const p of ["/admin/staff", "/admin/accounts", "/admin/sync", "/admin/settings"]) expect(html).not.toContain(`href="${p}"`);
    const legacy = renderToStaticMarkup(<AdminShell username="sample" role="support">Mẫu</AdminShell>);
    expect(legacy).toContain('href="/admin/accounts"'); expect(legacy).not.toContain('href="/admin/content"');
  });
  it("hides the health-check parent when none of its children are granted", () => {
    const html = renderToStaticMarkup(<AdminShell username="sample" role="staff" menus={["accounts"]}>Mẫu</AdminShell>);
    expect(html).not.toContain("Quản lý khám sức khoẻ");
  });
  it("groups all four health-check modules without adding a parent grant", () => {
    const html = renderToStaticMarkup(<AdminShell username="admin">Mẫu</AdminShell>);
    expect(html.match(/Quản lý khám sức khoẻ/g)).toHaveLength(1);
    for (const p of ["/admin/ksk", "/admin/ksk-collections", "/admin/ksk-changes", "/admin/ksk-manage"]) expect(html.match(new RegExp(`href="${p}"`, "g"))).toHaveLength(1);
    act(() => root.render(<StaffEditor initialUsers={[]} />));
    const group = host.querySelector('fieldset[aria-label="Phân quyền quản lý khám sức khoẻ"]')!;
    expect(group.querySelectorAll('input[type="checkbox"]')).toHaveLength(12);
    expect(group.textContent).toContain("Menu cha chỉ gom nhóm");
  });
  it("removes action selections when their menu is unchecked without touching sibling menus", () => {
    act(() => root.render(<StaffEditor initialUsers={[]} />));
    const label = [...host.querySelectorAll("label")].find(l => l.textContent === "Phiếu thay đổi gói / danh sách · LAB")!;
    const menu = label.querySelector<HTMLInputElement>('input')!;
    act(() => menu.click());
    const fieldset = [...host.querySelectorAll("fieldset")].find(f => f.querySelector(":scope > legend")?.textContent === "Quyền thao tác phiếu thay đổi · LAB")!;
    const action = fieldset.querySelector<HTMLInputElement>('input')!;
    act(() => action.click()); expect(action.checked).toBe(true);
    act(() => menu.click()); expect(action.checked).toBe(false); expect(fieldset.disabled).toBe(true);
    act(() => menu.click()); expect(action.checked).toBe(false);
    expect([...host.querySelectorAll("label")].find(l => l.textContent === "Khám đoàn và báo cáo XN / CLS")!.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
  });
  it("has lock/menu controls and requires a separate strong new staff password", () => {
    act(() => root.render(<StaffEditor initialUsers={[]} />));
    expect(host.textContent).toContain("Cho phép vào trang admin"); expect(host.textContent).toContain("Menu được phép xem");
    expect(host.querySelector<HTMLInputElement>('input[type="password"]')?.minLength).toBe(12);
    expect(host.querySelector<HTMLInputElement>('input[type="password"]')?.required).toBe(true);
    expect(host.querySelectorAll('input[type="password"]')).toHaveLength(2);
    const save = [...host.querySelectorAll("button")].find(b => b.textContent === "Lưu nhân viên")!;
    expect(save.closest(".sticky")).not.toBeNull();
    expect(host.querySelector("form")!.querySelector("button")!.textContent).toBe("Lưu nhân viên");
  });
  it("editing locks username, reflects enabled/menu state and allows unchanged password", () => {
    act(() => root.render(<StaffEditor initialUsers={[staff]} />));
    const edit = host.querySelector<HTMLButtonElement>('button[aria-label="Sửa sample"]')!;
    act(() => edit.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.querySelector<HTMLInputElement>('input[pattern]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[type="password"]')?.required).toBe(false);
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
  });
  it("does not submit mismatched staff passwords", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    act(() => root.render(<StaffEditor initialUsers={[]} />));
    enter(host.querySelectorAll<HTMLInputElement>('input[type="password"]')[0], "TestingOnly12345");
    enter(host.querySelectorAll<HTMLInputElement>('input[type="password"]')[1], "DifferentOnly12345");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("không khớp"); expect(fetch).not.toHaveBeenCalled();
  });
  it("requires username confirmation for deletion and removes the deleted row", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [] }) }); vi.stubGlobal("fetch", fetch);
    act(() => root.render(<StaffEditor initialUsers={[staff]} />));
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Xóa sample"]')!.click());
    const confirm = [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Xác nhận xóa")!;
    expect(confirm.disabled).toBe(true);
    enter(host.querySelector<HTMLInputElement>('section[aria-label="Xác nhận xóa nhân viên"] input')!, "sample");
    expect(confirm.disabled).toBe(false);
    await act(async () => confirm.click());
    expect(fetch).toHaveBeenCalledWith("/api/admin/staff/delete", expect.objectContaining({ body: JSON.stringify({ username: "sample", confirmUsername: "sample" }) }));
    expect(host.querySelector('button[aria-label="Sửa sample"]')).toBeNull(); expect(host.textContent).toContain("Đã xóa tài khoản");
  });
  it("requires current/new/confirmed passwords and sends only self-service fields", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }); vi.stubGlobal("fetch", fetch);
    act(() => root.render(<PasswordForm />));
    expect(host.querySelectorAll('input[type="password"][required]')).toHaveLength(3);
    enter(host.querySelector<HTMLInputElement>('input[name="currentPassword"]')!, "TestingOnly12345");
    enter(host.querySelector<HTMLInputElement>('input[name="newPassword"]')!, "NewTestingOnly54321");
    enter(host.querySelector<HTMLInputElement>('input[name="confirmPassword"]')!, "DifferentTesting54321");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetch).not.toHaveBeenCalled();
    enter(host.querySelector<HTMLInputElement>('input[name="confirmPassword"]')!, "NewTestingOnly54321");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(fetch).toHaveBeenCalledWith("/api/admin/password", expect.objectContaining({ body: JSON.stringify({ currentPassword: "TestingOnly12345", newPassword: "NewTestingOnly54321", confirmPassword: "NewTestingOnly54321" }) }));
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
    expect(host.querySelector<HTMLInputElement>('input[name="currentPassword"]')!.value).toBe("");
  });
});
