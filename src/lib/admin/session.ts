import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createHmac, timingSafeEqual } from "crypto";
import { adminMenuOptions, adminActions, actionMenu, matchesAdminPath, type AdminMenu, type AdminAction } from "./permissions";
import { findStaffUser, verifyStaffPassword } from "./staff-store";
import { runCloudState } from "./cloud-state";

export async function resolveAdminSession(cookies: ReadonlyRequestCookies) {
  // No cross-request cache: grant removal/lock/revision is checked against cloud every request.
  if (!cookies.get("aph_admin_session")?.value) return null;
  try { return await runCloudState("staff", { version: 1, users: [] }, () => getAdminSession(cookies)); }
  catch { return null; }
}
export async function resolveAdminCredentials(username: string, password: string) {
  try { return await runCloudState("staff", { version: 1, users: [] }, () => verifyAdminCredentials(username, password)); }
  catch { return null; }
}

export const adminSessionCookie = "aph_admin_session";

export type AdminRole = "super_admin" | "booking_admin" | "support" | "content_admin" | "auditor" | "staff";

export interface AdminSession {
  username: string;
  role: AdminRole;
  exp: number;
  menus?: AdminMenu[];
  actions?: AdminAction[];
  revision?: string;
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_USERS_JSON || process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD);
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD ?? process.env.PORTAL_ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(password, expected);
}

export function verifyAdminCredentials(username: string, password: string): { username: string; role: AdminRole; revision?: string } | null {
  const users = getConfiguredUsers();
  const requestedUsername = username.trim() || "admin";

  if (users.length) {
    const user = users.find((item) => item.username.toLowerCase() === requestedUsername.toLowerCase());
    if (user) return safeEqual(password, user.password) ? { username: user.username, role: user.role } : null;
  }
  if (!process.env.ADMIN_USERS_JSON && requestedUsername.toLowerCase() === "admin" && verifyAdminPassword(password))
    return { username: "admin", role: "super_admin" };
  try {
    const staff = findStaffUser(requestedUsername);
    return staff && verifyStaffPassword(staff, password) ? { username: staff.username, role: "staff", revision: staff.revision } : null;
  } catch { return null; }
}

export function createAdminSessionCookie(username = "admin", role: AdminRole = "super_admin", maxAgeSeconds = 60 * 60 * 8, revision?: string) {
  const payload: AdminSession = {
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    ...(revision ? { revision } : {}),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function adminRoleLabel(role: AdminRole) {
  const labels: Record<AdminRole, string> = {
    super_admin: "Quản trị toàn quyền",
    booking_admin: "Điều phối lịch khám",
    support: "Hỗ trợ hồ sơ",
    content_admin: "Quản trị nội dung",
    auditor: "Kiểm tra nhật ký",
    staff: "Nhân viên · theo quyền được cấp",
  };
  return labels[role];
}

export function canAdminAccessPath(subject: AdminRole | AdminSession, path: string) {
  const role = typeof subject === "string" ? subject : subject.role;
  if (role === "staff") return path === "/admin" || path === "/admin/password" || (typeof subject !== "string" && adminMenuOptions.some(m => subject.menus?.includes(m.id) && matchesAdminPath(m.path, path)));
  if (role === "super_admin") return true;
  const allowed = rolePermissions[role]?.paths ?? [];
  return allowed.some((item) => matchesAdminPath(item, path));
}

export function canAdminPerformAction(subject: AdminRole | AdminSession, action: string) {
  const role = typeof subject === "string" ? subject : subject.role;
  if (role === "staff") return typeof subject !== "string"
    && adminActions.some(allowed => allowed === action && subject.menus?.includes(actionMenu(allowed)) && subject.actions?.includes(allowed));
  if (role === "super_admin") return true;
  return (rolePermissions[role]?.actions ?? []).includes(action);
}

export function getAdminSession(cookies: ReadonlyRequestCookies): AdminSession | null {
  const cookieValue = cookies.get(adminSessionCookie)?.value;
  if (!cookieValue) return null;

  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSession;
    if (!payload || typeof payload.username !== "string" || !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)
      || !["super_admin", "booking_admin", "support", "content_admin", "auditor", "staff"].includes(payload.role)) return null;
    if (payload.role === "staff") {
      const staff = findStaffUser(payload.username);
      if (!staff?.enabled || !payload.revision || staff.revision !== payload.revision) return null;
      return { username: staff.username, role: "staff", exp: payload.exp, revision: staff.revision, menus: staff.menus, actions: staff.actions ?? [] };
    }
    // Configured account deletion/role changes take effect on every server request.
    if (process.env.ADMIN_USERS_JSON) {
      const current = getConfiguredUsers().find(u => u.username === payload.username);
      if (!current || current.role !== payload.role) return null;
    } else if (payload.username !== "admin" || payload.role !== "super_admin" || !isAdminConfigured()) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function verifySignature(value: string, signature: string) {
  return safeEqual(sign(value), signature);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) {
    throw new Error("PORTAL_SESSION_SECRET is not configured.");
  }
  return secret;
}

const rolePermissions: Record<Exclude<AdminRole, "super_admin" | "staff">, { paths: string[]; actions: string[] }> = {
  booking_admin: {
    paths: ["/admin", "/admin/bookings", "/admin/profiles", "/admin/sync", "/admin/audit"],
    actions: ["approve_booking", "cancel_booking", "retry_sync", "retry_booking_match", "send_booking_zalo", "test_zns_template"],
  },
  support: {
    paths: ["/admin", "/admin/accounts", "/admin/profiles", "/admin/sync", "/admin/otp", "/admin/audit"],
    actions: ["edit_account", "unlink_profile", "retry_sync", "lock_account", "unlock_account"],
  },
  content_admin: {
    paths: ["/admin", "/admin/content", "/admin/settings", "/admin/audit"],
    actions: ["publish_content", "archive_content", "edit_setting"],
  },
  auditor: {
    paths: ["/admin", "/admin/audit", "/admin/accounts", "/admin/profiles", "/admin/bookings", "/admin/sync", "/admin/otp"],
    actions: [],
  },
};

function getConfiguredUsers(): Array<{ username: string; password: string; role: AdminRole }> {
  const raw = process.env.ADMIN_USERS_JSON;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Array<{ username?: unknown; password?: unknown; role?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        username: typeof item.username === "string" ? item.username.trim() : "",
        password: typeof item.password === "string" ? item.password : "",
        role: normalizeRole(item.role),
      }))
      .filter((item) => item.username && item.password && item.role !== "staff");
  } catch {
    return [];
  }
}

function normalizeRole(value: unknown): AdminRole {
  const text = typeof value === "string" ? value : "";
  if (["super_admin", "booking_admin", "support", "content_admin", "auditor"].includes(text)) {
    return text as AdminRole;
  }
  return "staff"; // invalid configured roles are rejected, never default to privileges
}

export function reservedAdminNames() {
  return ["admin", ...getConfiguredUsers().map(user => user.username)];
}
