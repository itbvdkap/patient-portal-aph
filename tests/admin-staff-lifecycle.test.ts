// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const state = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined }) }));
import { POST as save } from "@/app/api/admin/staff/route";
import { POST as remove } from "@/app/api/admin/staff/delete/route";
import { POST as change } from "@/app/api/admin/password/route";
import { canAdminAccessPath, createAdminSessionCookie, verifyAdminCredentials } from "@/lib/admin/session";
import { changeStaffPassword, findStaffUser, publicStaffUsers, readStaffUsers, saveStaffUser } from "@/lib/admin/staff-store";

let directory: string;
const employee = { username: "staff-sample", displayName: "Nhân viên mẫu", enabled: true, menus: ["ksk" as const], password: "TestingOnly12345" };
const passwords = { currentPassword: employee.password, newPassword: "NewTestingOnly54321", confirmPassword: "NewTestingOnly54321" };
const deletion = { username: employee.username, confirmUsername: employee.username };
function request(body: unknown, origin = "https://192.168.2.8:3443") {
  return new Request("https://192.168.2.8:3443/api/admin/password", { method: "POST", headers: { host: "192.168.2.8:3443", origin }, body: JSON.stringify(body) });
}
function loginStaff() { const user = findStaffUser(employee.username)!; state.token = createAdminSessionCookie(user.username, "staff", 1000, user.revision); return user; }
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), "aph-staff-lifecycle-"));
  vi.stubEnv("ADMIN_STAFF_ENABLED", "true"); vi.stubEnv("ADMIN_STAFF_STORE_PATH", path.join(directory, "users.json")); vi.stubEnv("VERCEL", "");
  vi.stubEnv("PORTAL_SESSION_SECRET", "test-only-session-secret"); vi.stubEnv("ADMIN_USERS_JSON", ""); vi.stubEnv("ADMIN_PASSWORD", "EnvAdmin12345678");
  state.token = createAdminSessionCookie("admin", "super_admin");
});
afterEach(() => {
  vi.unstubAllEnvs(); state.token = "";
  if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("aph-staff-lifecycle-")) throw new Error("Unsafe temp cleanup");
  rmSync(directory, { recursive: true });
});
describe("Staff lifecycle through real session, routes and isolated file store", () => {
  it("requires matching passwords to create/reset; edits preserve the hash when both fields are empty", async () => {
    expect((await save(request(employee))).status).toBe(400);
    expect((await save(request({ ...employee, confirmPassword: "wrong" }))).status).toBe(400);
    expect(publicStaffUsers()).toEqual([]);
    const response = await save(request({ ...employee, confirmPassword: employee.password }));
    expect(response.status).toBe(200); expect(await response.text()).not.toMatch(/passwordHash|scrypt|revision/);
    const original = findStaffUser(employee.username)!;
    expect((await save(request({ ...employee, password: "", confirmPassword: "", displayName: "Tên mới" }))).status).toBe(200);
    expect(findStaffUser(employee.username)!.passwordHash).toBe(original.passwordHash);
    expect(findStaffUser(employee.username)!.revision).not.toBe(original.revision);
  });
  it("blocks staff deletion, cross-origin and wrong confirmation; soft deletion revokes login/session and is recoverable", async () => {
    saveStaffUser(employee, "admin", []); loginStaff(); const staffToken = state.token;
    expect((await remove(request(deletion))).status).toBe(403);
    state.token = createAdminSessionCookie("admin", "super_admin");
    expect((await remove(request(deletion, "https://evil.invalid"))).status).toBe(403);
    expect((await remove(request({ ...deletion, confirmUsername: "different" }))).status).toBe(400);
    expect((await remove(request({ username: "admin", confirmUsername: "admin" }))).status).toBe(400);
    const response = await remove(request(deletion)); expect(response.status).toBe(200);
    expect(publicStaffUsers()).toEqual([]); expect(findStaffUser(employee.username)).toBeNull();
    expect(readStaffUsers()[0].deletedBy).toBe("admin"); expect(readStaffUsers()[0].enabled).toBe(false);
    expect(verifyAdminCredentials(employee.username, employee.password)).toBeNull();
    state.token = staffToken; expect((await change(request(passwords))).status).toBe(401);
    expect(() => saveStaffUser(employee, "admin", [])).toThrow("đã xóa");
    const backup = readdirSync(directory).find(file => file.includes(".backup-"))!;
    expect(JSON.parse(readFileSync(path.join(directory, backup), "utf8")).users[0].deletedAt).toBeUndefined();
  });
  it("requires authenticated staff, same origin, current password and matching strong new password; cannot target another user", async () => {
    state.token = ""; expect((await change(request(passwords))).status).toBe(401);
    state.token = createAdminSessionCookie("admin", "super_admin"); expect((await change(request(passwords))).status).toBe(403);
    saveStaffUser(employee, "admin", []); const user = loginStaff();
    expect(canAdminAccessPath({ username: user.username, role: "staff", exp: 1, menus: [] }, "/admin/password")).toBe(true);
    expect((await change(request(passwords, "https://evil.invalid"))).status).toBe(403);
    expect((await change(request({ ...passwords, currentPassword: "wrong" }))).status).toBe(400);
    expect((await change(request({ ...passwords, confirmPassword: "mismatch" }))).status).toBe(400);
    expect((await change(request({ ...passwords, newPassword: "short", confirmPassword: "short" }))).status).toBe(400);
    expect((await change(request({ ...passwords, username: "another-user" }))).status).toBe(400);
    expect((await change(request({ ...passwords, newPassword: employee.password, confirmPassword: employee.password }))).status).toBe(400);
    expect(findStaffUser(user.username)!.revision).toBe(user.revision);
    const response = await change(request(passwords)); expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/aph_admin_session=;.*Max-Age=0/);
    expect(response.headers.get("set-cookie")).toContain("Secure"); expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect((await change(request(passwords))).status).toBe(401); // all old cookies revoked
    expect(verifyAdminCredentials(employee.username, employee.password)).toBeNull();
    expect(verifyAdminCredentials(employee.username, passwords.newPassword)?.role).toBe("staff");
    expect(findStaffUser(user.username)!.menus).toEqual(["ksk"]);
    expect(readFileSync(path.join(directory, "users.json"), "utf8")).not.toContain(passwords.newPassword);
  });
  it("rejects a stale revision and rate-limits incorrect current-password attempts without changing the hash", async () => {
    saveStaffUser(employee, "admin", []); const user = loginStaff();
    expect(() => changeStaffPassword(user.username, "stale", passwords)).toThrow("Phiên đã thay đổi");
    for (let i = 0; i < 8; i++) expect((await change(request({ ...passwords, currentPassword: "wrong" }))).status).toBe(400);
    const blocked = await change(request(passwords)); expect(blocked.status).toBe(429); expect(blocked.headers.get("retry-after")).toBe("900");
    expect(findStaffUser(user.username)!.passwordHash).toBe(user.passwordHash);
  });
});
