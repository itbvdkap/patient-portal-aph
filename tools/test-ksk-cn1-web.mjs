// Explicit CN1 local integration test. Never print credentials or patient payloads.
import nextEnv from "@next/env";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import ExcelJS from "exceljs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, true);
const base = "http://127.0.0.1:3014";
const configured = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = configured.length
  ? configured.find(user => user.role === "super_admin")
  : { username: "admin", password: process.env.ADMIN_PASSWORD ?? process.env.PORTAL_ADMIN_PASSWORD };
if (!admin?.password) throw new Error("No configured super_admin available for local integration test.");
const login = await fetch(`${base}/api/admin/login`, {
  method: "POST", redirect: "error", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: admin.username, password: admin.password }), signal: AbortSignal.timeout(30000),
});
if (!login.ok) throw new Error(`Local admin login failed (${login.status}); no credential output.`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("No local admin session cookie.");
const query = "from=2026-08-01&to=2026-10-14&cohort=260819155634396016";
const response = await fetch(`${base}/api/admin/ksk?${query}`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Web-to-agent CN1 read failed (${response.status}); no payload output.`);
const data = await response.json();
if (data.scope?.branch !== "CN1" || data.scope?.mode !== "his" || data.members.length !== 13)
  throw new Error("CN1 cohort scope/count mismatch.");
if (!Object.values(data.sections).every(Boolean)) throw new Error("One or more CN1 source sections are unavailable.");
if (!Array.isArray(data.payments) || !Object.keys(data.sections).some(k => k.startsWith("payments:")))
  throw new Error("Agent does not supply financial evidence sections.");
const compiled = await build({ entryPoints: [path.join(root, "src/lib/ksk/payment.ts")], bundle: true, write: false, format: "esm", platform: "node" });
const { paymentDashboard } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const finance = paymentDashboard(data);
if (Object.values(finance.counts).reduce((sum, count) => sum + count, 0) !== data.members.length)
  throw new Error("Payment dashboard totals do not cover unique members.");
if (!data.cohorts.every(cohort => Object.hasOwn(cohort, "ghichu") && Object.hasOwn(cohort, "customerid")))
  throw new Error("CN1 cohort payload is missing the HIS note/customer ID mapping.");
if (!response.headers.get("cache-control")?.includes("no-store")) throw new Error("API response is cacheable.");
const page = await fetch(`${base}/admin/ksk?${query}`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(60000) });
if (!page.ok) throw new Error(`CN1 dashboard SSR failed (${page.status}).`);
const html = await page.text();
if (!html.includes("Chi phí phát sinh") || !html.includes("HIS CN1")) throw new Error("Real CN1 dashboard content missing.");
if (!html.includes('id="ksk-payment"') || !html.includes("Thanh toán theo chứng từ HIS") || !html.includes("Đã thu ròng") || !html.includes("Lọc nâng cao"))
  throw new Error("New payment dashboard/filter/columns or advanced cohort filter missing.");
if (!html.includes("Phụ trách / CSKH") || !html.includes("Theo ghi chú đợt khám trong HIS."))
  throw new Error("CN1 note-based CSKH header missing.");
if (!html.includes("Danh sách &amp; thu tiền") || !html.includes("Kết quả XN / CLS"))
  throw new Error("CN1 reporting actions missing in dashboard HTML.");
if (!page.headers.get("cache-control")?.includes("no-store")) throw new Error("Page response is cacheable.");
const listPage = await fetch(`${base}/admin/ksk?from=2026-10-01&to=2026-10-14`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(60000) });
if (!listPage.ok) throw new Error(`CN1 cohort list SSR failed (${listPage.status}).`);
const listHtml = await listPage.text();
if (!listHtml.includes('id="ksk-company"') || !listHtml.includes('id="ksk-support"'))
  throw new Error("Company/CSKH list filters missing.");
const reportCode = await build({ entryPoints: [path.join(root, "src/lib/ksk/reports.ts")], bundle: true, write: false, format: "esm", platform: "node" });
const reportModule = await import(`data:text/javascript;base64,${Buffer.from(reportCode.outputFiles[0].text).toString("base64")}`);
const exportCode = await build({ entryPoints: [path.join(root, "src/lib/ksk/report-export.ts")], bundle: true, write: false, format: "esm", platform: "node", external: ["exceljs"] });
const exporterText = exportCode.outputFiles[0].text.replaceAll('import("exceljs")', `import(${JSON.stringify(pathToFileURL(path.join(root, "node_modules/exceljs/excel.js")).href)})`);
const exportModule = await import(`data:text/javascript;base64,${Buffer.from(exporterText).toString("base64")}`);
const reportCounts = {};
try {
  for (const kind of ["collections", "results"]) {
    const report = reportModule.buildKskReport(data, data.members, kind, "Toàn bộ đợt — kiểm thử chỉ đọc");
    const bytes = await exportModule.reportXlsx(report);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    if (report.memberCount !== data.members.length || workbook.worksheets.length < report.sheets.length + 1)
      throw new Error("Report shape mismatch.");
    if (kind === "collections" && report.sheets[0].rows.length !== 13) throw new Error("Collection count mismatch.");
    if (kind === "results" && report.sheets.find(s => s.name === "XN chi tiết").rows.length !== 540)
      throw new Error("Lab detail count mismatch.");
    reportCounts[kind] = { people: report.memberCount, sheets: workbook.worksheets.length,
      rowCounts: report.sheets.map(sheet => ({ sheet: sheet.name, rows: sheet.rows.length })), bytes: bytes.length };
  }
} catch { throw new Error("CN1 report dataset/XLSX round-trip failed; no patient values or workbook persisted."); }
console.log(JSON.stringify({ status: "passed", branch: data.scope.branch, mode: data.scope.mode,
  members: data.members.length, visits: data.visits.length, directives: data.charges.length,
  labParameters: data.labs.length, imagingRows: data.imaging.length,
  apiStatus: response.status, dashboardStatus: page.status, listStatus: listPage.status,
  noteMapping: true, companySupportFilters: true, noStore: true,
  receiptRows: data.payments.length, paymentCounts: finance.counts,
  receiptTableKeys: [...new Set(data.payments.map(row => row.chargetable))],
  chargePayerCodes: [...new Set(data.charges.map(row => row.madoituong))],
  evidence: {
    linkedChargeIds: data.payments.filter(r => data.charges.some(c => c.id === r.chargeid && c.source === r.source)).length,
    linkedReceiptIds: data.payments.filter(r => data.charges.some(c => c.id === r.chargeid && c.idttrv === r.receiptid && c.source === r.source && c.maql === r.maql)).length,
    deferredRows: data.payments.filter(r => r.deferred === "1").length,
    refundedRows: data.payments.filter(r => r.refundcount !== "0" || (r.refunded && r.refunded !== "0")).length,
    waiverRows: data.payments.filter(r => r.waiver !== "0" || r.headerdiscount !== "0").length,
  },
  reports: reportCounts,
  note: "Counts only; no clinical values or credentials logged."
}));
