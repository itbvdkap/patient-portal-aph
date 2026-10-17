// Local read-only integration; credentials, patient data and generated workbooks stay in RAM.
import nextEnv from "@next/env";
import { build } from "esbuild";
import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); nextEnv.loadEnvConfig(root, true);
const base = "http://127.0.0.1:3014";
const configured = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = configured.length ? configured.find(u => u.role === "super_admin") : { username: "admin", password: process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD };
if (!admin?.password) throw new Error("Existing test admin credential missing.");
const params = new URLSearchParams({ from: "2026-10-14T00:00:00", to: "2026-10-14T23:59:59", cashier: "", department: "", kind: "" });
const login = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify(admin) });
const cookie = login.headers.get("set-cookie")?.split(";")[0]; if (!login.ok || !cookie) throw new Error("Test login failed; secret output withheld.");
try {
  const anonymous = await fetch(`${base}/api/admin/vienphi-revenue?${params}`); if (anonymous.status !== 401) throw new Error("Anonymous revenue read not blocked.");
  const response = await fetch(`${base}/api/admin/vienphi-revenue?${params}`, { headers: { Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(65000) });
  if (!response.ok) throw new Error(`Revenue API HTTP ${response.status}; payload withheld.`);
  const data = await response.json();
  const compiled = await build({ entryPoints: [path.join(root, "src/lib/revenue/domain.ts")], bundle: true, write: false, format: "esm", platform: "node" });
  const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
  domain.revenueSnapshotSchema.parse(data); if (!domain.revenueComplete(data)) throw new Error("Revenue sources incomplete.");
  const rows = domain.revenueRows(data), query = Object.fromEntries(params), summary = domain.revenueSummary(rows);
  const compiledExport = await build({ entryPoints: [path.join(root, "src/lib/ksk/report-export.ts")], bundle: true, write: false, format: "esm", platform: "node", external: ["exceljs"] });
  const code = compiledExport.outputFiles[0].text.replaceAll('import("exceljs")', `import(${JSON.stringify(pathToFileURL(path.join(root, "node_modules/exceljs/excel.js")).href)})`);
  const exporter = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const report = domain.buildRevenueReport(data, rows, query); const bytes = await exporter.reportXlsx(report); const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
  if (workbook.getWorksheet("Chi tiết phiếu")?.rowCount !== rows.length + 1) throw new Error("Receipt export incomplete.");
  exporter.reportPrintHtml(report, 0);
  const page = await fetch(`${base}/admin/vienphi-revenue?${params}`, { headers: { Cookie: cookie } }); const html = await page.text();
  if (!page.ok || !html.includes("Doanh thu viện phí theo thu ngân") || !html.includes("Khoa/phòng trên phiếu")) throw new Error("Revenue page missing.");
  for (const field of ["cashier", "department", "kind"]) { const key = field === "cashier" ? "cashierId" : field === "department" ? "departmentId" : "kind"; const value = rows[0]?.[key]; if (value && domain.filterRevenue(rows, { ...query, [field]: value }).some(r => r[key] !== value)) throw new Error("Revenue filter mismatch."); }
  console.log(JSON.stringify({ status: "passed", branch: data.scope.branch, receipts: rows.length, unresolved: summary.unknown, sourcesComplete: true, excelRows: workbook.getWorksheet("Chi tiết phiếu").rowCount - 1, printVerified: true, pageStatus: page.status, noStore: response.headers.get("cache-control")?.includes("no-store"), anonymousStatus: anonymous.status }));
} finally { await fetch(`${base}/api/admin/logout`, { method: "POST", headers: { Cookie: cookie, Origin: base }, redirect: "manual" }); }
