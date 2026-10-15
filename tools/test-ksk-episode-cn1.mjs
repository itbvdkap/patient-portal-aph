// Read-only regression of an operator-specified CN1 cohort. No patient records written/logged.
import nextEnv from "@next/env";
import { build } from "esbuild";
nextEnv.loadEnvConfig(process.cwd(), true);
const [cohort, ...patients] = process.argv.slice(2);
if (!/^\d{1,24}$/.test(cohort || "") || patients.some(p => !/^\d{1,16}$/.test(p))) throw new Error("Provide cohort ID and optional patient codes.");
const configured = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = configured.length ? configured.find(u => u.role === "super_admin") : { username: "admin", password: process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD };
const base = "http://127.0.0.1:3014";
const login = await fetch(base + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ username: admin.username, password: admin.password }), signal: AbortSignal.timeout(20000) });
if (!login.ok) throw new Error("Local admin login failed; no secret output.");
const cookie = login.headers.get("set-cookie")?.split(";")[0];
try {
  const query = new URLSearchParams({ from: "2026-10-01", to: "2026-10-15", cohort });
  const response = await fetch(base + "/api/admin/ksk?" + query, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(65000) });
  if (!response.ok) throw new Error(`CN1 read failed: HTTP ${response.status}.`);
  const data = await response.json();
  if (data.scope?.branch !== "CN1" || data.scope.mode !== "his" || data.scope.episodePolicy !== 2) throw new Error("Wrong branch/episode contract.");
  const code = await build({ entryPoints: ["src/lib/ksk/payment.ts", "src/lib/ksk/domain.ts"], outdir: "unused", bundle: true, write: false, format: "esm", platform: "node" });
  async function module(name) { const file = code.outputFiles.find(f => f.path.endsWith(name + ".js")); return import("data:text/javascript;base64," + Buffer.from(file.text).toString("base64")); }
  const finance = await module("payment"), domain = await module("domain");
  if (!["members", "visits", "charges", "payments"].every(s => domain.sectionComplete(data, s))) throw new Error("Financial source unavailable.");
  const results = patients.map((patient, index) => {
    const member = data.members.find(m => m.mabn === patient); if (!member) throw new Error("Requested patient not found in cohort.");
    const records = domain.memberRecords(data, member), payment = finance.memberPayment(data, member);
    if (payment.status !== "paid" || payment.net !== 560000 || payment.due !== 560000 || payment.outstanding !== 0) throw new Error("Target payment not reconciled to expected amount.");
    if (records.charges.length !== 9 || records.excludedCharges.length !== 9 || !payment.notes.some(n => n.includes("MAVAOVIEN=0"))) throw new Error("Target episode/mirror evidence mismatch.");
    return { case: index + 1, status: payment.status, due: payment.due, net: payment.net, includedDirectives: records.charges.length, excludedDirectives: records.excludedCharges.length, legacyHeaderVerified: true };
  });
  const totals = domain.summarize(data), dashboard = finance.paymentDashboard(data);
  const page = await fetch(base + "/admin/ksk?" + query, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(65000) });
  const html = await page.text();
  if (!page.ok || !html.includes("MAVAOVIEN=0") || !html.includes("Đã loại")) throw new Error("Dashboard does not display episode audit notes.");
  console.log(JSON.stringify({ status: "passed", branch: "CN1", episodePolicy: 2, apiStatus: response.status, pageStatus: page.status,
    members: data.members.length, rawDirectives: data.charges.length, includedDirectives: domain.scopedCharges(data).length,
    cohortDue: totals.amount, paymentCounts: dashboard.counts, cases: results, noHisMutations: true }));
} finally { await fetch(base + "/api/admin/logout", { method: "POST", headers: { Cookie: cookie, Origin: base }, redirect: "manual" }); }
