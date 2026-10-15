// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { canAdminAccessPath, canAdminPerformAction, createAdminSessionCookie, getAdminSession, verifyAdminCredentials } from "@/lib/admin/session";
import { findStaffUser, publicStaffUsers, saveStaffUser } from "@/lib/admin/staff-store";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

let temporary: string;
const cookieJar = (value: string) => ({ get: () => ({ value }) }) as unknown as ReadonlyRequestCookies;
const input = { username: "ksk-test", displayName: "Nhân viên mẫu", password: "TestingOnly12345", menus: ["ksk" as const], enabled: true };
beforeEach(() => {
  temporary = mkdtempSync(path.join(os.tmpdir(), "aph-staff-tests-"));
  vi.stubEnv("ADMIN_STAFF_ENABLED", "true"); vi.stubEnv("ADMIN_STAFF_STORE_PATH", path.join(temporary, "users.json")); vi.stubEnv("VERCEL", "");
  vi.stubEnv("PORTAL_SESSION_SECRET", "test-only-session-secret"); vi.stubEnv("ADMIN_USERS_JSON", ""); vi.stubEnv("ADMIN_PASSWORD", "EnvAdmin12345678");
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith("aph-staff-tests-")) throw new Error("Unsafe temp cleanup");
  rmSync(temporary, { recursive: true });
});
describe("Admin menu permissions", () => {
  it("requires a separate LAB menu plus explicit action; old menus and actionless users remain read-only", () => {
    const session = { username: "sample", role: "staff" as const, exp: 0, menus: ["ksk_changes" as const], actions: ["ksk_package_draft" as const] };
    expect(canAdminPerformAction(session, "ksk_package_draft")).toBe(true);
    expect(canAdminPerformAction(session, "ksk_change_approve")).toBe(false);
    expect(canAdminPerformAction(session, "retry_sync")).toBe(false);
    expect(canAdminPerformAction({ ...session, menus: ["ksk"] }, "ksk_package_draft")).toBe(false);
    expect(canAdminPerformAction({ ...session, actions: [] }, "ksk_package_draft")).toBe(false);
  });
  it("/admin does not grant descendants to a limited role", () => {
    expect(canAdminAccessPath("support", "/admin")).toBe(true);
    expect(canAdminAccessPath("support", "/admin/accounts/123")).toBe(true);
    expect(canAdminAccessPath("support", "/admin/content")).toBe(false);
    expect(canAdminAccessPath("support", "/admin/bookings")).toBe(false);
    expect(canAdminAccessPath("support", "/admin/ksk")).toBe(false);
    expect(canAdminAccessPath("support", "/admin/staff")).toBe(false);
    expect(canAdminAccessPath("support", "/admin/accounts-evil")).toBe(false);
  });
  it("staff menus protect direct paths and do not grant mutation actions", () => {
    const session = { username: "sample", role: "staff" as const, exp: 0, menus: ["ksk" as const] };
    expect(canAdminAccessPath(session, "/admin/ksk")).toBe(true);
    expect(canAdminAccessPath(session, "/admin/profiles")).toBe(false);
    expect(canAdminAccessPath(session, "/admin/settings")).toBe(false);
    expect(canAdminAccessPath(session, "/admin/staff")).toBe(false);
    expect(canAdminPerformAction(session, "retry_sync")).toBe(false);
    expect(canAdminAccessPath("staff", "/admin/ksk")).toBe(false);
  });
});
describe("Separate local employee credentials and revocable sessions", () => {
  it("saves new action grants separately, resolves current grants, and immediately revokes removed rights", () => {
    saveStaffUser({ ...input, menus: ["ksk_changes"], actions: ["ksk_package_draft"] }, "admin", []);
    const user = findStaffUser(input.username)!, token = createAdminSessionCookie(user.username, "staff", 1000, user.revision);
    expect(getAdminSession(cookieJar(token))?.actions).toEqual(["ksk_package_draft"]);
    saveStaffUser({ ...input, password: "", menus: ["ksk_changes"], actions: [] }, "admin", []);
    expect(getAdminSession(cookieJar(token))).toBeNull();
    expect(publicStaffUsers()[0].actions).toEqual([]);
    saveStaffUser({ ...input, password: "", actions: ["ksk_change_apply"] }, "admin", []);
    expect(publicStaffUsers()[0].actions).toEqual([]); // Missing LAB menu never retains actions.
  });
  it("stores scrypt hashes only, returns no hashes/revisions and creates a recoverable backup", () => {
    const publicRows = saveStaffUser(input, "admin", ["admin"]);
    expect(JSON.stringify(publicRows)).not.toContain("passwordHash"); expect(JSON.stringify(publicRows)).not.toContain("revision");
    const saved = readFileSync(path.join(temporary, "users.json"), "utf8");
    expect(saved).toContain("scrypt:"); expect(saved).not.toContain(input.password);
    saveStaffUser({ ...input, password: "", menus: [] }, "admin", ["admin"]);
    expect(readdirSync(temporary).some(f => f.includes(".backup-"))).toBe(true);
    expect(publicStaffUsers()[0].menus).toEqual([]);
  });
  it("requires a strong new password, rejects unknown menus/reserved names and cannot create a super admin", () => {
    expect(() => saveStaffUser({ ...input, password: "1234" }, "admin", [])).toThrow("12 ký tự");
    expect(() => saveStaffUser({ ...input, username: "ADMIN" }, "admin", ["admin"])).toThrow("quản trị");
    expect(() => saveStaffUser({ ...input, menus: ["settings"] } as never, "admin", [])).toThrow();
    expect(() => saveStaffUser({ ...input, role: "super_admin" } as never, "admin", [])).toThrow();
  });
  it("authenticates staff by username/password and never accepts the global admin password for an arbitrary username", () => {
    saveStaffUser(input, "admin", ["admin"]);
    expect(verifyAdminCredentials("ksk-test", "wrong")).toBeNull();
    expect(verifyAdminCredentials("ksk-test", input.password)?.role).toBe("staff");
    expect(verifyAdminCredentials("arbitrary", "EnvAdmin12345678")).toBeNull();
    expect(verifyAdminCredentials("admin", "EnvAdmin12345678")?.role).toBe("super_admin");
    vi.stubEnv("ADMIN_USERS_JSON", "invalid-json");
    expect(verifyAdminCredentials("admin", "EnvAdmin12345678")).toBeNull();
  });
  it("resolves current menus server-side and revokes old cookies when permission/password/lock changes", () => {
    saveStaffUser(input, "admin", []);
    const user = findStaffUser("ksk-test")!;
    const token = createAdminSessionCookie(user.username, "staff", 1000, user.revision);
    expect(getAdminSession(cookieJar(token))?.menus).toEqual(["ksk"]);
    expect(getAdminSession(cookieJar(createAdminSessionCookie(user.username, "staff")))).toBeNull();
    saveStaffUser({ ...input, password: "", menus: [] }, "admin", []);
    expect(getAdminSession(cookieJar(token))).toBeNull();
    const newUser = findStaffUser("ksk-test")!;
    const current = createAdminSessionCookie(newUser.username, "staff", 1000, newUser.revision);
    expect(getAdminSession(cookieJar(current))?.menus).toEqual([]);
    saveStaffUser({ ...input, password: "", enabled: false }, "admin", []);
    expect(getAdminSession(cookieJar(current))).toBeNull(); expect(verifyAdminCredentials(input.username, input.password)).toBeNull();
  });
  it("fails closed on disabled local store, Vercel, invalid/expired/tampered cookies", () => {
    saveStaffUser(input, "admin", []); const u = findStaffUser(input.username)!;
    const cookie = createAdminSessionCookie(u.username, "staff", 1000, u.revision);
    expect(getAdminSession(cookieJar(cookie + ".extra"))).toBeNull();
    expect(getAdminSession(cookieJar(cookie.slice(0, -2) + "xx"))).toBeNull();
    expect(getAdminSession(cookieJar(createAdminSessionCookie(u.username, "staff", -1, u.revision)))).toBeNull();
    vi.stubEnv("VERCEL", "1"); expect(getAdminSession(cookieJar(cookie))).toBeNull();
    expect(() => publicStaffUsers()).toThrow("nội bộ");
  });
});
