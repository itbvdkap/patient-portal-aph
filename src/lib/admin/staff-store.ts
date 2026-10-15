import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { adminMenus, adminActions, actionMenu } from "./permissions";
import { cloudState, replaceCloudState } from "./cloud-state";

const username = z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const menu = z.enum(adminMenus as [typeof adminMenus[number], ...typeof adminMenus[number][]]);
const action = z.enum(adminActions as [typeof adminActions[number], ...typeof adminActions[number][]]);
const recordSchema = z.object({ username, displayName: z.string().trim().min(1).max(120), enabled: z.boolean(),
  menus: z.array(menu).max(adminMenus.length), actions: z.array(action).max(adminActions.length).optional(), passwordHash: z.string().regex(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/),
  revision: z.string().regex(/^[a-f0-9]{32}$/), updatedAt: z.string(), updatedBy: z.string(),
  deletedAt: z.string().optional(), deletedBy: z.string().optional() }).strict();
const storeSchema = z.object({ version: z.literal(1), users: z.array(recordSchema).max(200) }).strict();
export const staffInputSchema = z.object({ username, displayName: z.string().trim().min(1).max(120), enabled: z.boolean(),
  menus: z.array(menu).max(adminMenus.length), actions: z.array(action).max(adminActions.length).optional(), password: z.string().max(128).optional().default("") }).strict();
export const staffFormSchema = staffInputSchema.extend({ confirmPassword: z.string().max(128) }).refine(
  data => data.password === data.confirmPassword, { message: "Mật khẩu nhập lại không khớp.", path: ["confirmPassword"] });
export const staffDeleteSchema = z.object({ username, confirmUsername: z.string().max(50) }).strict().refine(
  data => data.username === data.confirmUsername, { message: "Nhập đúng tên tài khoản để xác nhận xóa." });
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128).regex(/[a-zA-Z]/).regex(/\d/), confirmPassword: z.string().max(128) }).strict().refine(
  data => data.newPassword === data.confirmPassword, { message: "Mật khẩu nhập lại không khớp.", path: ["confirmPassword"] });
export type StaffUser = z.infer<typeof recordSchema>;
export type StaffPublic = Omit<StaffUser, "passwordHash" | "revision">;
function location() {
  if (process.env.VERCEL || process.env.ADMIN_STAFF_ENABLED !== "true") throw new Error("Quản lý nhân viên chỉ bật trên máy chủ nội bộ.");
  const configured = process.env.ADMIN_STAFF_STORE_PATH;
  if (!configured || !path.isAbsolute(configured)) throw new Error("Chưa cấu hình file nhân viên nội bộ tuyệt đối.");
  return configured;
}
export function readStaffUsers(): StaffUser[] {
  const cloud = cloudState("staff");
  if (cloud) return storeSchema.parse(cloud.data).users;
  const file = location();
  if (!existsSync(file)) return [];
  if (statSync(file).size > 1000000) throw new Error("File nhân viên vượt giới hạn.");
  const users = storeSchema.parse(JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""))).users;
  if (new Set(users.map(u => u.username.toLowerCase())).size !== users.length) throw new Error("File nhân viên có tài khoản trùng.");
  return users;
}
export function findStaffUser(name: string) {
  if (process.env.ADMIN_STAFF_ENABLED !== "true") return null;
  return readStaffUsers().find(u => !u.deletedAt && u.username.toLowerCase() === name.trim().toLowerCase()) ?? null;
}
export function publicStaffUsers(): StaffPublic[] {
  return readStaffUsers().filter(user => !user.deletedAt).map(user => ({ username: user.username, displayName: user.displayName, enabled: user.enabled,
    menus: user.menus, actions: user.actions ?? [], updatedAt: user.updatedAt, updatedBy: user.updatedBy }));
}
export function verifyStaffPassword(user: StaffUser, password: string) {
  if (!user.enabled || user.deletedAt || password.length > 128) return false;
  const [, salt, hash] = user.passwordHash.split(":");
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, "hex"));
}
export function saveStaffUser(input: z.infer<typeof staffInputSchema>, actor: string, reservedNames: string[]) {
  const data = staffInputSchema.parse(input);
  if (reservedNames.some(name => name.toLowerCase() === data.username.toLowerCase())) throw new Error("Không dùng tên tài khoản quản trị cấu hình server cho nhân viên.");
  const users = readStaffUsers();
  const previous = users.find(u => u.username.toLowerCase() === data.username.toLowerCase());
  if (previous?.deletedAt) throw new Error("Tài khoản đã xóa. Chọn tên khác hoặc nhờ quản trị khôi phục từ bản sao lưu.");
  if ((!previous || data.password) && (data.password.length < 12 || !/[a-zA-Z]/.test(data.password) || !/\d/.test(data.password)))
    throw new Error("Mật khẩu mới tối thiểu 12 ký tự, có chữ và số.");
  if (!previous && users.length >= 200) throw new Error("Đã đạt giới hạn 200 nhân viên.");
  const salt = randomBytes(16).toString("hex");
  const user: StaffUser = {
    username: previous?.username || data.username, displayName: data.displayName, enabled: data.enabled,
    menus: [...new Set(data.menus)], actions: [...new Set(data.actions ?? [])].filter(a => data.menus.includes(actionMenu(a))), passwordHash: data.password ? `scrypt:${salt}:${scryptSync(data.password, salt, 64).toString("hex")}` : previous!.passwordHash,
    revision: randomBytes(16).toString("hex"), updatedAt: new Date().toISOString(), updatedBy: actor,
  };
  writeStaffUsers([...users.filter(u => u.username !== user.username), user]);
  return publicStaffUsers();
}

function writeStaffUsers(users: StaffUser[]) {
  if (cloudState("staff")) { replaceCloudState("staff", storeSchema.parse({ version: 1, users })); return; }
  const file = location(); mkdirSync(path.dirname(file), { recursive: true });
  // One local Node process, synchronous atomic replacement. Keep a recoverable backup.
  if (existsSync(file)) copyFileSync(file, `${file}.backup-${Date.now()}-${randomBytes(4).toString("hex")}`);
  const temporary = `${file}.tmp-${randomBytes(8).toString("hex")}`;
  writeFileSync(temporary, JSON.stringify(storeSchema.parse({ version: 1, users }), null, 2), { flag: "wx", mode: 0o600 });
  renameSync(temporary, file);
}

export function deleteStaffUser(input: z.infer<typeof staffDeleteSchema>, actor: string, reservedNames: string[]) {
  const data = staffDeleteSchema.parse(input);
  if (reservedNames.some(name => name.toLowerCase() === data.username.toLowerCase())) throw new Error("Không xóa tài khoản quản trị cấu hình server.");
  const users = readStaffUsers();
  const user = users.find(u => !u.deletedAt && u.username.toLowerCase() === data.username.toLowerCase());
  if (!user) throw new Error("Không tìm thấy nhân viên đang hoạt động.");
  // Recoverable tombstone; never delete HIS, patient data, or configured server admins.
  const now = new Date().toISOString();
  writeStaffUsers(users.map(u => u !== user ? u : { ...u, enabled: false, menus: [], actions: [], deletedAt: now, deletedBy: actor,
    updatedAt: now, updatedBy: actor, revision: randomBytes(16).toString("hex") }));
  return publicStaffUsers();
}

export function changeStaffPassword(name: string, revision: string, input: z.infer<typeof passwordChangeSchema>) {
  const data = passwordChangeSchema.parse(input);
  const users = readStaffUsers();
  const user = users.find(u => !u.deletedAt && u.username === name);
  if (!user?.enabled || user.revision !== revision) throw new Error("Phiên đã thay đổi. Vui lòng đăng nhập lại.");
  if (!verifyStaffPassword(user, data.currentPassword)) throw new Error("Mật khẩu hiện tại không đúng.");
  if (data.currentPassword === data.newPassword) throw new Error("Mật khẩu mới phải khác mật khẩu hiện tại.");
  const salt = randomBytes(16).toString("hex");
  writeStaffUsers(users.map(u => u !== user ? u : { ...u, passwordHash: `scrypt:${salt}:${scryptSync(data.newPassword, salt, 64).toString("hex")}`,
    revision: randomBytes(16).toString("hex"), updatedAt: new Date().toISOString(), updatedBy: name }));
}
