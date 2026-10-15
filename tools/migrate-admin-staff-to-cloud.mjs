import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

function envFile(path) {
  const result = {};
  for (const line of readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (match) result[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
  return result;
}
function key(secret) { return createHash("sha256").update(`aph-admin-cloud-v1:${secret}`).digest(); }
function seal(value, secret) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret), nonce);
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value))), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64");
}
function open(value, secret) {
  const data = Buffer.from(value, "base64"), decipher = createDecipheriv("aes-256-gcm", key(secret), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}
async function rpc(url, serviceKey, name, body) {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify(body), redirect: "error",
  });
  if (!response.ok) throw new Error(`Cloud RPC ${name} failed with HTTP ${response.status}.`);
  return response.json();
}

const [localEnvPath, privateEnvPath, staffPath] = process.argv.slice(2);
if (!localEnvPath || !privateEnvPath || !staffPath) throw new Error("Usage: node migrate-admin-staff-to-cloud.mjs <.env.local> <admin-cloud.env> <users.json>");
const local = envFile(localEnvPath), privateValues = envFile(privateEnvPath), staff = JSON.parse(readFileSync(staffPath, "utf8").replace(/^\uFEFF/, ""));
const url = local.SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = local.SUPABASE_SERVICE_ROLE_KEY || local.SUPABASE_SECRET_KEY;
const secret = privateValues.ADMIN_CLOUD_STORE_SECRET;
if (!url?.startsWith("https://") || !serviceKey || !secret || secret.length < 32) throw new Error("Missing protected Supabase/cloud settings.");
if (staff?.version !== 1 || !Array.isArray(staff.users) || staff.users.length > 200
  || new Set(staff.users.map(user => String(user.username).toLowerCase())).size !== staff.users.length
  || staff.users.some(user => !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(user.passwordHash || ""))) throw new Error("Local staff store validation failed.");

const current = await rpc(url, serviceKey, "portal_ksk_state_get", { p_key: "staff" });
if (current.revision === 0) {
  const saved = await rpc(url, serviceKey, "portal_ksk_state_cas", { p_key: "staff", p_revision: 0, p_payload: seal(staff, secret) });
  if (saved !== true) throw new Error("Cloud staff state changed concurrently; nothing overwritten.");
  console.log(`Migrated ${staff.users.length} staff account(s) to encrypted cloud state.`);
} else {
  const existing = open(current.payload, secret);
  if (JSON.stringify(existing) !== JSON.stringify(staff)) throw new Error("Cloud staff state already exists and differs; nothing overwritten.");
  console.log(`Encrypted cloud staff state already matches ${staff.users.length} local account(s).`);
}
