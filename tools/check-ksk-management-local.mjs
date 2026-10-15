// Real CN1 read/preflight only. No draft/staff/HIS writes, no PHI/credentials in logs.
import nextEnv from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";
nextEnv.loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), true);
const base = "http://127.0.0.1:3014";
const users = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = users.length ? users.find(u => u.role === "super_admin") : { username: "admin", password: process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD };
if (!admin?.password) throw new Error("Configured operator admin not available.");
const anonymous = await fetch(`${base}/api/admin/ksk-manage?from=2026-10-01&to=2026-10-14`, { signal: AbortSignal.timeout(60000) });
if (anonymous.status !== 401) throw new Error("Anonymous management access not rejected.");
const login = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: admin.username, password: admin.password }) });
const cookie = login.headers.get("set-cookie")?.split(";")[0]; if (!login.ok || !cookie) throw new Error("Operator login unavailable; no secrets printed.");
const headers = { Cookie: cookie };
try {
  const query = { from: "2026-08-01", to: "2026-10-14", cohort: "260819155634396016" };
  const response = await fetch(`${base}/api/admin/ksk-manage?${new URLSearchParams(query)}`, { headers, signal: AbortSignal.timeout(60000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Real management unavailable (${response.status}): ${payload.error || "no raw records logged"}`);
  const data = payload.data;
  if (data.branch !== "CN1" || data.writeEnabled !== false || data.cohortId !== query.cohort) throw new Error("Wrong management scope/write state.");
  const page = await fetch(`${base}/admin/ksk-manage?${new URLSearchParams(query)}`, { headers, signal: AbortSignal.timeout(60000) });
  if (!page.ok || !(await page.text()).includes("Ghi đang tắt")) throw new Error("Management SSR not ready.");
  // A synthetic new customer proposal is VALIDATED only: no create/save/apply action.
  const check = await fetch(`${base}/api/admin/ksk-manage`, { method: "POST", headers: { ...headers, "Content-Type": "application/json", Origin: base }, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ action: "check", query, version: data.version, proposal: { kind: "customer", key: "NEW", fields: { ten: "KHACH HANG KIEM TRA KHONG LUU", stt: "1" }, items: [] }, reason: "Kiem tra API READ ONLY, khong luu" }) });
  const checked = await check.json();
  if (!check.ok) throw new Error(`READ ONLY preflight failed (${check.status}): ${checked.error || "no raw records logged"}`);
  if (checked.drafts.length !== payload.drafts.length) throw new Error("Preflight unexpectedly changed draft count.");
  console.log(JSON.stringify({ status: "passed", branch: data.branch, anonymousStatus: anonymous.status, apiStatus: response.status, pageStatus: page.status, preflightStatus: check.status,
    writeEnabled: false, customers: data.customers.length, cohorts: data.cohorts.length, groups: data.groups.length, members: data.members.length, packages: data.packages.length,
    packageItems: data.items.length, serviceCatalog: data.services.length, hasVisits: data.hasVisits, draftsUnchanged: true, noHisOrStaffOrDraftMutations: true }));
} finally { await fetch(`${base}/api/admin/logout`, { method: "POST", headers, redirect: "manual" }); }
