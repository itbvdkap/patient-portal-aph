// Read-only CN1 integration: metadata/counts only; no patient rows, credentials, workbooks persisted.
import nextEnv from "@next/env";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import ExcelJS from "exceljs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, true);
const base = "http://127.0.0.1:3014";
const configured = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = configured.length ? configured.find(u => u.role === "super_admin") : { username: "admin", password: process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD };
if (!admin?.password) throw new Error("Existing admin credentials not configured.");
const login = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ username: admin.username, password: admin.password }) });
if (!login.ok) throw new Error(`Login failed (${login.status}); credential output suppressed.`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Session cookie absent.");
const query = { from: process.env.KSK_TEST_FROM || "2026-10-01", to: process.env.KSK_TEST_TO || "2026-10-14",
  collectedFrom: process.env.KSK_TEST_COLLECTED_FROM || "2026-10-01", collectedTo: process.env.KSK_TEST_COLLECTED_TO || "2026-10-14", company: "", support: "", cashier: "", status: "" };
try {
  const params = new URLSearchParams(query);
  const anon = await fetch(`${base}/api/admin/ksk-collections?${params}`);
  if (anon.status !== 401) throw new Error("Anonymous financial API not blocked.");
  const response = await fetch(`${base}/api/admin/ksk-collections?${params}`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(65000) });
  if (!response.ok) throw new Error(`CN1 collection read unavailable (${response.status}); no response payload logged.`);
  const data = await response.json();
  if (data.scope?.branch !== "CN1" || data.scope.mode !== "his" || data.scope.collections !== true) throw new Error("Wrong financial report scope.");
  if (data.labs.length || data.imaging.length || data.clinical.length) throw new Error("Financial report loaded unrelated clinical results.");
  if (data.payments.some(r => r.date?.slice(0, 10) < query.collectedFrom || r.date?.slice(0, 10) > query.collectedTo)) throw new Error("Receipt date outside requested collection range.");
  const compiled = await build({ entryPoints: [path.join(root, "src/lib/ksk/collections.ts")], bundle: true, write: false, format: "esm", platform: "node" });
  const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
  const rows = domain.collectionRows(data), totals = domain.collectionSummary(data, rows);
  const page = await fetch(`${base}/admin/ksk-collections?${params}`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(65000) });
  if (!page.ok) throw new Error(`Financial report SSR failed (${page.status}).`);
  const html = await page.text();
  if (!html.includes("Báo cáo thu tiền tổng hợp") || !html.includes("Nhân viên thu ngân HIS") || !html.includes("Đăng ký từ ngày") || !html.includes("Thu từ ngày")) throw new Error("Financial filters/report not rendered.");
  let exportVerified = false;
  if (totals.complete) {
    const report = domain.buildCollectionReport(data, rows, query);
    const compiledExport = await build({ entryPoints: [path.join(root, "src/lib/ksk/report-export.ts")], bundle: true, write: false, format: "esm", platform: "node", external: ["exceljs"] });
    const code = compiledExport.outputFiles[0].text.replaceAll('import("exceljs")', `import(${JSON.stringify(pathToFileURL(path.join(root, "node_modules/exceljs/excel.js")).href)})`);
    const exporter = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    const bytes = await exporter.reportXlsx(report), workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    if (workbook.getWorksheet("Phiếu thu tổng hợp")?.rowCount !== rows.length + 1) throw new Error("Export receipt count mismatch.");
    // Check presentation against original HIS timestamps in RAM; never log patient rows.
    for (const [index, row] of rows.entries()) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(row.bill.date || "")) continue;
      const expected = row.bill.date.replace(/^(\d{4})-(\d{2})-(\d{2})T(.*)$/, "$3/$2/$1 $4");
      if (workbook.getWorksheet("Phiếu thu tổng hợp").getCell(index + 2, 8).value !== expected) throw new Error("Export collection timestamp mismatch.");
      if (index < 50 && !html.includes(expected)) throw new Error("SSR collection timestamp not formatted.");
    }
    if (rows.length <= 2000) exporter.reportPrintHtml(report, 1);
    exportVerified = true;
    for (const [field, value] of [["company", rows[0]?.companyId], ["support", rows[0]?.cohortId], ["cashier", rows[0]?.cashierId]]) {
      if (!value) continue;
      const filtered = domain.filterCollections(rows, data, { ...query, [field]: value });
      if (!filtered.length || (field === "company" && filtered.some(r => r.companyId !== value)) || (field === "cashier" && filtered.some(r => r.cashierId !== value))) throw new Error(`Filter mismatch: ${field}`);
    }
  }
  console.log(JSON.stringify({ status: totals.complete ? "passed" : "incomplete-source", branch: data.scope.branch, query, apiStatus: response.status, pageStatus: page.status,
    noStore: response.headers.get("cache-control")?.includes("no-store"), cohorts: data.cohorts.length, members: data.members.length, visits: data.visits.length,
    chargeRows: data.charges.length, receiptDetailRows: data.payments.length, receipts: rows.length, verified: totals.verified, unknown: totals.unknown, deferred: totals.deferred,
    cashierIdsPresent: rows.filter(r => r.cashierId !== "unknown").length, cashierNamesPresent: data.payments.filter(r => Boolean(r.cashiername)).length,
    incompleteSections: Object.entries(data.sections).filter(([, complete]) => !complete).map(([key]) => key), sourceWarnings: data.warnings, exportVerified, clinicalResultsLoaded: false, noHisMutations: true }));
  if (!totals.complete) process.exitCode = 2;
} finally { await fetch(`${base}/api/admin/logout`, { method: "POST", headers: { Cookie: cookie, Origin: base }, redirect: "manual" }); }
