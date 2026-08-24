import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createHmac, timingSafeEqual } from "crypto";

export const adminSessionCookie = "aph_admin_session";

export type AdminRole = "super_admin" | "booking_admin" | "support" | "content_admin" | "auditor";

export interface AdminSession {
  username: string;
  role: AdminRole;
  exp: number;
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_USERS_JSON || process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD);
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD ?? process.env.PORTAL_ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(password, expected);
}

export function verifyAdminCredentials(username: string, password: string): { username: string; role: AdminRole } | null {
  const users = getConfiguredUsers();
  const requestedUsername = username.trim() || "admin";

  if (users.length) {
    const user = users.find((item) => item.username.toLowerCase() === requestedUsername.toLowerCase());
    if (!user || !safeEqual(password, user.password)) return null;
    return { username: user.username, role: user.role };
  }

  if (!verifyAdminPassword(password)) return null;
  return { username: requestedUsername, role: "super_admin" };
}

export function createAdminSessionCookie(username = "admin", role: AdminRole = "super_admin", maxAgeSeconds = 60 * 60 * 8) {
  const payload: AdminSession = {
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
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
  };
  return labels[role];
}

export function canAdminAccessPath(role: AdminRole, path: string) {
  if (role === "super_admin") return true;
  const allowed = rolePermissions[role]?.paths ?? [];
  return allowed.some((item) => path === item || path.startsWith(`${item}/`));
}

export function canAdminPerformAction(role: AdminRole, action: string) {
  if (role === "super_admin") return true;
  return (rolePermissions[role]?.actions ?? []).includes(action);
}

export function getAdminSession(cookies: ReadonlyRequestCookies): AdminSession | null {
  const cookieValue = cookies.get(adminSessionCookie)?.value;
  if (!cookieValue) return null;

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSession;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
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

const rolePermissions: Record<Exclude<AdminRole, "super_admin">, { paths: string[]; actions: string[] }> = {
  booking_admin: {
    paths: ["/admin", "/admin/bookings", "/admin/profiles", "/admin/sync", "/admin/audit"],
    actions: ["approve_booking", "cancel_booking", "retry_sync"],
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
      .filter((item) => item.username && item.password);
  } catch {
    return [];
  }
}

function normalizeRole(value: unknown): AdminRole {
  const text = typeof value === "string" ? value : "";
  if (["super_admin", "booking_admin", "support", "content_admin", "auditor"].includes(text)) {
    return text as AdminRole;
  }
  return "support";
}
