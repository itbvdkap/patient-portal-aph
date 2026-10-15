// @vitest-environment node
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildKskReport, memberResultState } from "@/lib/ksk/reports";
import { reportFilename, reportPrintHtml, reportXlsx } from "@/lib/ksk/report-export";
import { demoKskSnapshot } from "@/lib/ksk/sample";

const query = { from: "2026-10-01", to: "2026-10-14", cohort: "900001" };
const sample = () => demoKskSnapshot(query);
describe("KSK report datasets", () => {
  it("formats receipt/refund times in the cohort report without mutating the source", () => {
    const data = sample();
    data.payments = [{ source: "DEMO", kind: "DIRECT", receiptid: "501", mabn: "DEMO001", maql: "1001", mavaovien: "1001", date: "2026-10-14T08:35:42", refunddate: "2026-10-15T00:00:00" }];
    const before = JSON.stringify(data);
    const report = buildKskReport(data, data.members, "collections", "");
    expect(report.sheets[1].rows[0][10]).toBe("14/10/2026 08:35:42");
    expect(report.sheets[1].rows[0][16]).toBe("15/10/2026 00:00:00");
    expect(report.sheets[0].rows[0][6]).toBe("01/10/2026 (chưa có giờ)");
    expect(JSON.stringify(data)).toBe(before);
  });
  it("builds per-person collection, source receipt and charge sheets without treating unknown cash as zero", () => {
    const data = sample(); const before = JSON.stringify(data);
    const report = buildKskReport(data, data.members, "collections", "Toàn bộ đợt");
    expect(report.sheets.map(s => s.name)).toEqual(["Danh sách và thu", "Chứng từ nguồn", "Chi phí chỉ định"]);
    expect(report.sheets[0].rows).toHaveLength(3); expect(report.sheets[2].rows).toHaveLength(3);
    expect(report.sheets[0].rows[1][10]).toBe("Chưa xác định");
    expect(report.sheets[0].rows[2][9]).toBe(0);
    expect(report.metadata).toContainEqual(["Số người chưa đối chiếu được - không cộng vào tổng", "1"]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("uses the full filtered subset and canonical member identity, not forged fields or paginated slices", () => {
    const data = sample();
    const report = buildKskReport(data, [{ ...data.members[0], name: "Forged" }, data.members[0]], "collections", "Nhóm văn phòng");
    expect(report.memberCount).toBe(1); expect(report.sheets[0].rows[0][3]).toBe(data.members[0].name);
    expect(() => buildKskReport(data, [{ groupid: "999", mabn: "other" }], "results", "")).toThrow("không thuộc");
  });
  it("requires a selected cohort and a complete member roster", () => {
    const data = sample(); data.sections.members = false;
    expect(() => buildKskReport(data, data.members, "results", "")).toThrow("Chưa đọc đủ");
    data.cohorts = [];
    expect(() => buildKskReport(data, [], "results", "")).toThrow("Chọn một đợt");
  });
  it("reports unknown source states rather than complete or empty results", () => {
    const data = sample();
    expect(memberResultState(data, data.members[0])).toBe("has");
    expect(memberResultState(data, data.members[1])).toBe("empty");
    expect(memberResultState(data, data.members[2])).toBe("no_visit");
    data.sections.labs = false;
    expect(memberResultState(data, data.members[0])).toBe("unknown");
    const report = buildKskReport(data, data.members, "results", "");
    expect(report.sheets[0].rows[0][7]).toBe("Chưa xác định");
    expect(report.sheets[1].rows[1][6]).toBe("Chưa xác định");
  });
  it("preserves repeat observations and separates identically named parameters with different IDs/units", () => {
    const data = sample();
    const first = data.labs[0];
    data.labs.push({ ...first }, { ...first, id: "202", value: "6.2" }, { ...first, parameterid: "other", unit: "g/L", value: "3.3" });
    data.labs.push({ ...first, maql: "UNRELATED", value: "99.9" });
    const report = buildKskReport(data, data.members, "results", "");
    const matrix = report.sheets.find(s => s.name === "XN theo danh sách")!;
    const details = report.sheets.find(s => s.name === "XN chi tiết")!;
    expect(matrix.headers).toHaveLength(9); expect(details.rows).toHaveLength(4);
    const repeated = matrix.rows[0].find(c => typeof c === "string" && c.includes("Phiếu 202")) as string;
    expect(repeated).toContain("5.1"); expect(repeated).toContain("6.2");
    expect(JSON.stringify(report)).not.toContain("99.9");
  });
  it("retains raw CLS RTF in Excel data, while the print companion identifies its source instead of inventing text", () => {
    const data = sample(); const raw = "{\\rtf1\\ansi Nội dung mẫu}";
    data.imaging = [{ kind: "SA_BNCDHA_CT", id: "501", maql: "1001", serviceid: "90", name: "Siêu âm mẫu", value: raw }];
    const report = buildKskReport(data, data.members, "results", "");
    expect(report.sheets.find(s => s.name === "CLS chi tiết")?.rows[0][11]).toBe(raw);
    expect(report.sheets.find(s => s.name === "CLS bản in")?.rows[0][7]).toContain("RTF nguồn");
  });
  it("returns a valid empty filtered report, not all members by fallback", () => {
    const report = buildKskReport(sample(), [], "results", "Không khớp");
    expect(report.memberCount).toBe(0); expect(report.sheets.every(s => !s.rows.length)).toBe(true);
  });
});

describe("KSK Excel and printable output", () => {
  it("the installed browser bundle can write and read Vietnamese workbook values", async () => {
    const browserPath = "exceljs/dist/exceljs.min.js";
    const browser = (await import(browserPath)).default;
    const workbook = new browser.Workbook(); workbook.addWorksheet("Mẫu").addRow(["Thông số mẫu", "000001"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const loaded = new browser.Workbook(); await loaded.xlsx.load(buffer);
    expect(loaded.getWorksheet("Mẫu").getCell("A1").value).toBe("Thông số mẫu");
    expect(loaded.getWorksheet("Mẫu").getCell("B1").value).toBe("000001");
  });
  it("round-trips real XLSX, keeps IDs and numeric money types, and never promotes source strings to formulas", async () => {
    const data = sample(); data.members[0].mabn = "000001"; data.visits[0].mabn = "000001";
    data.charges.filter(c => c.maql === "1001").forEach(c => c.mabn = "000001");
    data.members[0].name = '=HYPERLINK("https://untrusted.invalid")';
    const report = buildKskReport(data, data.members, "collections", "Toàn bộ đợt");
    const bytes = await reportXlsx(report); expect([...bytes.slice(0, 2)]).toEqual([80, 75]);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("Danh sách và thu")!;
    expect(sheet.getCell("B2").value).toBe("000001"); expect(sheet.getCell("D2").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("D2").formula).toBeUndefined(); expect(sheet.getCell("I2").value).toBe(150000);
    expect(workbook.getWorksheet("Phạm vi và cảnh báo")?.rowCount).toBeGreaterThan(10);
    expect(reportFilename(report)).toBe("ksk-DEMO-danh-sach-thu-900001.xlsx");
  });
  it("preserves long source text in indexed chunks without breaking Unicode", async () => {
    const report = buildKskReport(sample(), [], "results", "");
    const text = "a".repeat(29999) + "😀" + "Thông tin nguồn mẫu".repeat(3000);
    report.sheets = [{ name: "CLS chi tiết", headers: ["Kết quả"], rows: [[text]] }];
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await reportXlsx(report) as unknown as ExcelJS.Buffer);
    const long = workbook.getWorksheet("Nội dung dài")!;
    const parts: string[] = []; for (let i = 2; i <= long.rowCount; i++) parts.push(String(long.getCell(i, 3).value));
    expect(parts.join("")).toBe(text); expect(parts.every(p => p.length <= 30000)).toBe(true);
    expect(workbook.getWorksheet("CLS chi tiết")?.getCell("A2").value).toContain("Nội dung dài");
  });
  it("escapes hostile text in printable output and includes scope/warnings and every row", () => {
    const data = sample(); data.members[0].name = '<img src="https://untrusted.invalid" onerror="alert(1)">';
    const report = buildKskReport(data, data.members, "collections", "Toàn bộ đợt");
    const html = reportPrintHtml(report, 0);
    expect(html).toContain("&lt;img"); expect(html).not.toContain('<img src=');
    expect(html).toContain("default-src 'none'"); expect(html.toLocaleLowerCase("vi")).toContain("không phải");
    expect(html).toContain("Người khám mẫu C"); expect(html).toContain("900001");
  });
  it("does not silently omit columns or long raw results when printing", () => {
    const report = buildKskReport(sample(), [], "results", "");
    report.sheets = [{ name: "Rộng", headers: Array(15).fill("Cột"), rows: [] }];
    expect(() => reportPrintHtml(report, 0)).toThrow("quá rộng");
    report.sheets = [{ name: "RTF", headers: ["Kết quả"], rows: [["{\\rtf1 nguồn}"]] }];
    expect(() => reportPrintHtml(report, 0)).toThrow("RTF");
    expect(() => reportPrintHtml(report, 1)).toThrow("không hợp lệ");
  });
});
