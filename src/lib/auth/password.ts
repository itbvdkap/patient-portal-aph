import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const keyLength = 64;

export function validatePassword(password: string) {
  const value = password.trim();
  if (value.length < 6) {
    return "Mật khẩu cần tối thiểu 6 ký tự.";
  }
  if (value.length > 128) {
    return "Mật khẩu quá dài.";
  }
  return "";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, keyLength).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const derived = Buffer.from(scryptSync(password, salt, keyLength).toString("hex"));
  const expected = Buffer.from(hash);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
