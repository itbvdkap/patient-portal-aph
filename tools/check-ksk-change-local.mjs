// Non-mutating verification of the operator's local LAB. No account/draft writes.
import nextEnv from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, true);
const base = "http://127.0.0.1:3014";
const configured = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = configured.length ? configured.find(u => u.role === "super_admin") : { username: "admin", password: process.env.ADMIN_PASSWORD ?? process.env.PORTAL_ADMIN_PASSWORD };
if (!admin?.password) throw new Error("Existing local admin is not configured.");
const anonymous = await fetch(`${base}/api/admin/ksk-changes`, { signal: AbortSignal.timeout(60000) });
if (anonymous.status !== 401) throw new Error("Anonymous LAB access was not rejected.");
const login = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: admin.username, password: admin.password }), signal: AbortSignal.timeout(30000) });
if (!login.ok) throw new Error(`Existing admin login failed: HTTP ${login.status}; no secrets logged.`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("No local session cookie.");
try {
  const api = await fetch(`${base}/api/admin/ksk-changes`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(60000) });
  if (!api.ok) throw new Error(`Local LAB not ready: HTTP ${api.status}`);
  const data = await api.json();
  if (data.mode !== "simulation" || data.realHisWriteEnabled !== false || data.targets.some(t => !t.id.startsWith("LAB-"))) throw new Error("Unexpected LAB source/mode.");
  const page = await fetch(`${base}/admin/ksk-changes`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(60000) });
  const html = await page.text();
  if (!page.ok || !html.includes("Ghi HIS thật đang khóa và chưa triển khai") || !html.includes("Lưu bản nháp")) throw new Error("LAB page not rendered.");
  console.log(JSON.stringify({ status: "passed", anonymousStatus: anonymous.status, apiStatus: api.status, pageStatus: page.status,
    noStore: api.headers.get("cache-control")?.includes("no-store"), mode: data.mode, targets: data.targets.length, drafts: data.drafts.length,
    realHisWriteEnabled: false, noStaffOrDraftMutations: true }));
} finally { await fetch(`${base}/api/admin/logout`, { method: "POST", headers: { Cookie: cookie }, redirect: "manual" }); }
