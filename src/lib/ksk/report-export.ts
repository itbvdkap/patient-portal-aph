import type { KskReport, ReportCell, ReportSheet } from "./reports";

export function reportFilename(report: KskReport) {
  const branch = report.metadata.find(([key]) => key === "Nguồn")?.[1].match(/\b(CN\d+|DEMO)\b/)?.[1] || "his";
  const cohort = report.metadata.find(([key]) => key === "ID đợt")?.[1].replace(/\D/g, "") || "doan";
  return `ksk-${branch}-${report.kind === "collections" ? "danh-sach-thu" : "xn-cls"}-${cohort}.xlsx`;
}
function textChunks(text: string, size = 30000) {
  const chunks: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + size, text.length);
    // Do not split a Unicode surrogate pair across XML strings.
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end])) end--;
    chunks.push(text.slice(start, end)); start = end;
  }
  return chunks;
}
export async function reportXlsx(report: KskReport): Promise<Uint8Array> {
  let cells = 0, characters = 0;
  for (const s of report.sheets) { cells += s.headers.length * (s.rows.length + 1); for (const row of s.rows) for (const cell of row) if (typeof cell === "string") characters += cell.length; }
  characters += report.metadata.reduce((n, row) => n + row.join("").length, 0) + report.warnings.join("").length;
  if (cells > 400000 || characters > 20000000) throw new Error("Báo cáo quá lớn để xuất trong trình duyệt. Lọc thêm theo nhóm/người; không xuất file bị cắt.");
  // Browser-compatible document writer; not loaded with the initial dashboard.
  const excel = await import("exceljs");
  const workbook = new (excel.default?.Workbook ?? excel.Workbook)();
  // Open the one-patient-per-row matrix first in Excel; retain source and scope sheets.
  if (report.kind === "results" && report.sheets.some(sheet => sheet.name === "KQ XN-CLS theo người"))
    workbook.views = [{ x: 0, y: 0, width: 12000, height: 8000, firstSheet: 0, activeTab: 2, visibility: "visible" }];
  workbook.creator = "An Phu · KSK chỉ đọc";
  workbook.created = new Date();
  workbook.subject = "Nội bộ · dữ liệu sức khỏe cá nhân · không phải công nợ hợp đồng";
  const overflow: ReportCell[][] = [];
  const scope: ReportSheet = { name: "Phạm vi và cảnh báo", headers: ["Mục", "Nội dung"], rows: [["Báo cáo", report.title], ...report.metadata, ...report.warnings.map(w => ["Cảnh báo", w])] };
  for (const s of [scope, ...report.sheets]) {
    const sheet = workbook.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1, xSplit: s === scope ? 0 : 4 }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    sheet.columns = s.headers.map((header, i) => ({ header, width: i === 0 ? 8 : header.includes("Họ tên") ? 28 : /Kết quả|Nội dung|Ghi chú|Đề nghị|Dịch vụ|Kết luận/.test(header) ? 48 : 22 }));
    s.rows.forEach((row, rowIndex) => {
      const values = row.map((value, columnIndex) => {
        if (typeof value !== "string") return value;
        if (value.length <= 30000) return value;
        const ref = `${s.name}!R${rowIndex + 2}C${columnIndex + 1}`;
        textChunks(value).forEach((chunk, i) => overflow.push([ref, i + 1, chunk]));
        return `Nội dung dài — xem sheet Nội dung dài, tham chiếu ${ref}. Không cắt dữ liệu gốc.`;
      });
      // Strings are typed literal strings, never formula or hyperlink objects.
      const added = sheet.addRow(values);
      added.alignment = { vertical: "top", wrapText: true };
      for (const column of s.moneyColumns || []) if (typeof values[column] === "number") added.getCell(column + 1).numFmt = '#,##0.##" đ"';
    });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF115E59" } };
    sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(1).height = 34;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: s.headers.length } };
    sheet.pageSetup.printTitlesRow = "1:1";
    sheet.headerFooter.oddHeader = "&CAn Phu · KSK chỉ đọc HIS";
    sheet.headerFooter.oddFooter = "&LNội bộ - không phải công nợ hợp đồng&RTrang &P / &N";
  }
  if (overflow.length) {
    const sheet = workbook.addWorksheet("Nội dung dài");
    sheet.addRow(["Tham chiếu ô", "Phần", "Nội dung gốc (ghép theo thứ tự phần)"]);
    for (const row of overflow) sheet.addRow(row);
    sheet.columns = [{ width: 45 }, { width: 8 }, { width: 100 }];
    sheet.getRow(1).font = { bold: true };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function escape(value: ReportCell) {
  return String(value ?? "—").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}
export function reportPrintHtml(report: KskReport, sheetIndex: number) {
  const sheet = report.sheets[sheetIndex];
  if (!sheet) throw new Error("Bảng báo cáo không hợp lệ.");
  if (sheet.headers.length > 14) throw new Error("Bảng quá rộng cho giấy A4. Chọn bảng chi tiết để in hoặc xuất Excel đầy đủ.");
  if (sheet.rows.length > 2000) throw new Error("Bảng quá dài để in. Lọc thêm theo nhóm/người hoặc xuất Excel.");
  if (sheet.rows.some(row => row.some(cell => typeof cell === "string" && (cell.length > 4000 || cell.trim().startsWith("{\\rtf")))))
    throw new Error("Bảng có nội dung dài/RTF gốc. Chọn CLS bản in hoặc xuất Excel để giữ nguyên nội dung.");
  const totals = sheet.rows.reduce((n, row) => n + row.map(c => String(c ?? "")).join("").length, 0);
  if (totals > 2000000) throw new Error("Nội dung quá lớn để in; lọc thêm hoặc xuất Excel.");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(report.title)}</title>
    <style>@page{size:A4 landscape;margin:10mm}body{font:11px Arial,sans-serif;color:#111}h1{font-size:18px}h2{font-size:14px}.meta{white-space:pre-wrap}.warn{font-size:10px;color:#444}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:5px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#e7f4f0}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body>
    <h1>${escape(report.title)}</h1><h2>${escape(sheet.name)}</h2><div class="meta">${report.metadata.map(([k, v]) => `${escape(k)}: ${escape(v)}`).join("\n")}</div>
    <ul class="warn">${report.warnings.map(w => `<li>${escape(w)}</li>`).join("")}</ul>
    <table><thead><tr>${sheet.headers.map(h => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${sheet.rows.length ? sheet.rows.map(row => `<tr>${row.map((c, i) => `<td>${escape(typeof c === "number" && sheet.moneyColumns?.includes(i) ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(c) + " đ" : c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${sheet.headers.length}">Không có dòng dữ liệu khớp phạm vi/bộ lọc.</td></tr>`}</tbody></table>
    <p>Nội bộ · Dữ liệu nguồn chưa thay thế nghiệm thu, duyệt/ký hoặc sổ công nợ hợp đồng.</p></body></html>`;
}
