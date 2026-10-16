import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLanSwitch, buildLanTarget } from "@/app/admin/admin-lan-switch";

let host: HTMLDivElement;
let root: Root;
let probes: MockImage[];

class MockImage {
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { probes.push(this); }
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("Image", MockImage);
  probes = [];
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("Admin LAN switch", () => {
  it("preserves an admin detail path and query but never redirects outside admin", () => {
    expect(buildLanTarget("https://192.168.2.8:3014", "/admin/ksk", "?cohort=123"))
      .toBe("https://192.168.2.8:3014/admin/ksk?cohort=123");
    expect(buildLanTarget("https://192.168.2.8:3014", "/administrator", "?url=https://example.com"))
      .toBe("https://192.168.2.8:3014/admin");
  });

  it("keeps the public page in place and explains failed LAN/TLS checks", () => {
    act(() => root.render(<AdminLanSwitch baseUrl="https://192.168.2.8:3014" compact={false} />));
    const button = host.querySelector<HTMLButtonElement>("button")!;
    expect(button.textContent).toContain("Mở bản nội bộ CN1");
    act(() => button.click());
    expect(button.disabled).toBe(true);
    expect(probes).toHaveLength(1);
    expect(probes[0].src).toMatch(/^https:\/\/192\.168\.2\.8:3014\/admin\/lan-ready\.gif\?t=/);
    act(() => probes[0].onerror?.());
    expect(button.disabled).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Không kết nối được máy chủ nội bộ");
    expect(window.location.origin).not.toBe("https://192.168.2.8:3014");
  });
});
