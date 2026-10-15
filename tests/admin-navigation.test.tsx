import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ path: "/admin/ksk-manage" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
import { AdminShellClient, type AdminShellNavItem } from "@/app/admin/admin-shell-client";
let host: HTMLDivElement, root: Root;
const nav: AdminShellNavItem[] = [{ label: "Tổng quan", href: "/admin", icon: "activity" }, { id: "ksk_management", label: "Quản lý khám sức khoẻ", icon: "users", children: [{ label: "Khám đoàn · chỉ đọc", href: "/admin/ksk", icon: "users" }, { label: "Quản lý đoàn / gói HIS", href: "/admin/ksk-manage", icon: "users" }] }];
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); state.path = "/admin/ksk-manage"; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function render() { act(() => root.render(<AdminShellClient nav={nav} username="sample" roleLabel="Nhân viên">Mẫu</AdminShellClient>)); }
describe("Grouped admin navigation", () => {
  it("opens the active group and highlights only the exact child", () => {
    render();
    const parent = host.querySelector('button[aria-controls="admin-nav-ksk_management"]')!;
    expect(parent.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
    expect(host.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/admin/ksk-manage");
    act(() => (parent as HTMLButtonElement).click());
    expect(host.querySelector<HTMLDivElement>('#admin-nav-ksk_management')!.hidden).toBe(true);
  });
  it("starts unrelated groups closed and supports opening by button", () => {
    state.path = "/admin"; render();
    const parent = host.querySelector<HTMLButtonElement>('button[aria-controls="admin-nav-ksk_management"]')!;
    expect(parent.getAttribute("aria-expanded")).toBe("false");
    act(() => parent.click()); expect(parent.getAttribute("aria-expanded")).toBe("true");
  });
  it("expands the compact sidebar to show its children and keeps the mobile menu readable", () => {
    localStorage.setItem("aph-admin-sidebar-collapsed", "1"); render();
    const parent = host.querySelector<HTMLButtonElement>('button[aria-controls="admin-nav-ksk_management"]')!;
    expect(parent.getAttribute("aria-expanded")).toBe("false");
    act(() => parent.click()); expect(parent.getAttribute("aria-expanded")).toBe("true");
    expect(localStorage.getItem("aph-admin-sidebar-collapsed")).toBe("0");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Thu gọn menu quản trị"]')!.click());
    const mobile = [...host.querySelectorAll('button')].find(button => button.textContent === "Menu")!;
    act(() => mobile.click());
    expect(parent.querySelector('span')?.className).not.toBe("sr-only");
    expect(parent.getAttribute("aria-expanded")).toBe("true");
  });
});
