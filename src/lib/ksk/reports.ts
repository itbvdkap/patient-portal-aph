import { chargeTotal, cohortSupportLabel, hasValue, memberRecords, sectionComplete, type KskRow, type KskSnapshot } from "./domain";
import { paymentDashboard, paymentLinksCharge, paymentStates } from "./payment";
import { formatHisDateTime, hisDateTimeNotice } from "./datetime";

export type ReportKind = "collections" | "results";
export type ReportCell = string | number | null;
export interface ReportSheet { name: string; headers: string[]; rows: ReportCell[][]; moneyColumns?: number[] }
export interface KskReport {
  kind: ReportKind; title: string; memberCount: number; metadata: [string, string][];
  warnings: string[]; sheets: ReportSheet[];
}
export const resultStates = { has: "Có giá trị XN / CLS", empty: "Chưa có giá trị XN / CLS", no_visit: "Chưa có lượt trong phạm vi", unknown: "Chưa xác định nguồn kết quả" } as const;
export type ResultState = keyof typeof resultStates;
export function memberResultState(data: KskSnapshot, member: KskRow): ResultState {
  if (!["visits", "labs", "imaging"].every(s => sectionComplete(data, s))) return "unknown";
  const records = memberRecords(data, member);
  if (!records.visits.length) return "no_visit";
  return [...records.labs, ...records.imaging].some(r => hasValue(r.value)) ? "has" : "empty";
}
function distinct(rows: KskRow[]) {
  // Keep differing observations, including the same parameter on repeat visits.
  return [...new Map(rows.map(r => [JSON.stringify(Object.entries(r).sort(([a], [b]) => a.localeCompare(b))), r])).values()];
}
function numeric(value: string | null | undefined): ReportCell {
  if (!value?.trim() || !/^-?\d+(\.\d{1,2})?$/.test(value)) return value || "Chưa xác định";
  const n = Number(value);
  return Number.isFinite(n) && Number.isSafeInteger(Math.round(n * 100)) ? n : "Chưa xác định";
}
function labKey(r: KskRow) { return JSON.stringify([r.parameterid, r.name, r.unit]); }
function imagingKey(r: KskRow) { return JSON.stringify([r.kind, r.serviceid, r.name]); }
function readableResult(r: KskRow) {
  return r.value?.trim().startsWith("{\\rtf") ? `RTF nguồn — xem nội dung gốc ở bảng CLS chi tiết (phiếu ${r.id})` : r.value || "Chưa có giá trị";
}
export function buildKskReport(data: KskSnapshot, requested: KskRow[], kind: ReportKind, filterLabel: string): KskReport {
  if (data.cohorts.length !== 1) throw new Error("Chọn một đợt khám trước khi lập báo cáo.");
  if (!sectionComplete(data, "members")) throw new Error("Chưa đọc đủ danh sách thành viên để lập báo cáo.");
  const authorized = new Map(data.members.map(m => [`${m.groupid}:${m.mabn}`, m]));
  const members = [...new Map(requested.map(m => {
    const key = `${m.groupid}:${m.mabn}`;
    const canonical = authorized.get(key);
    if (!canonical) throw new Error("Thành viên không thuộc đợt đã đọc.");
    return [key, canonical] as const;
  })).values()];
  const cohort = data.cohorts[0];
  const report: KskReport = {
    kind, title: kind === "collections" ? "Danh sách người khám và thu tiền theo đoàn" : "Kết quả xét nghiệm / CLS theo danh sách khám",
    memberCount: members.length,
    metadata: [["Nguồn", `${data.scope.mode === "demo" ? "GIẢ LẬP — không phải HIS" : "HIS"} ${data.scope.branch} · Chỉ đọc`],
      ["Công ty", cohort.customer || "Chưa có tên"], ["Đợt khám", cohort.name || "—"], ["ID đợt", cohort.id!],
      ["Phụ trách / CSKH", cohortSupportLabel(cohort)], ["Phạm vi lượt", `${data.scope.from} → ${data.scope.to}`],
      ["Dữ liệu đọc lúc", data.scope.asof], ["Bộ lọc báo cáo", filterLabel], ["Số người", String(members.length)]],
    warnings: [...data.warnings, "Dữ liệu sức khỏe cá nhân: chỉ lưu/chia sẻ cho người có quyền, không tải lên dịch vụ công cộng.",
      "Báo cáo từ bản dữ liệu đã đọc, không tự làm mới HIS. Dùng Đọc/Làm mới trước khi chốt báo cáo."],
    sheets: [],
  };
  const finance = kind === "collections" ? paymentDashboard(data) : null;
  const prepared = members.map(m => ({ member: m, records: memberRecords(data, m) }));
  const baseHeaders = ["STT", "Mã BN", "Mã NV", "Họ tên", "Năm sinh", "Nhóm khám"];
  const identity = (m: KskRow, i: number): ReportCell[] => [i + 1, m.mabn!, m.manv || "", m.name || "", m.namsinh || "", m.groupname || ""];
  if (kind === "collections") {
    const list: ReportSheet = { name: "Danh sách và thu", headers: [...baseHeaders, "Ngày tiếp nhận", "Thanh toán HIS", "Phát sinh (đ)", "Phải thu (đ)", "Đã thu ròng (đ)", "Còn chưa thu (đ)", "Ghi chú"], rows: [], moneyColumns: [8, 9, 10, 11] };
    const receipts: ReportSheet = { name: "Chứng từ nguồn", headers: [...baseHeaders, "Nguồn / loại", "ID phiếu", "Quyển", "Số biên lai", "Ngày giờ thu (HIS)", "Tiền gốc cả phiếu (đ)", "Miễn giảm nguồn (đ)", "Trả thiếu nguồn (đ)", "Trả sau", "Hoàn nguồn (đ)", "Ngày giờ hoàn (HIS)", "Tạm ứng nguồn (đ)", "Dịch vụ liên kết", "Đối chiếu"], rows: [], moneyColumns: [11, 12, 13, 15, 17] };
    const charges: ReportSheet = { name: "Chi phí chỉ định", headers: [...baseHeaders, "Schema", "ID chỉ định", "MAQL", "Dịch vụ", "SL", "Đơn giá (đ)", "Thành tiền (đ)", "PAID nguồn - không xác nhận thu"], rows: [], moneyColumns: [11, 12] };
    let unknown = 0, knownNet = 0;
    prepared.forEach(({ member: m, records: r }, i) => {
      const payment = finance!.payments.get(`${m.groupid}:${m.mabn}`)!;
      if (payment.net === null) unknown++; else knownNet += Math.round(payment.net * 100);
      list.rows.push([...identity(m, i), sectionComplete(data, "visits") ? [...new Set(r.visits.map(v => formatHisDateTime(v.date)))].join("\n") || "Chưa có lượt" : "Chưa xác định",
        paymentStates[payment.status].label, sectionComplete(data, "charges") && sectionComplete(data, "visits") ? chargeTotal(r.charges) ?? "Chưa xác định" : "Chưa xác định",
        payment.due ?? "Chưa xác định", payment.net ?? "Chưa xác định", payment.outstanding ?? "Chưa xác định", payment.notes.join(" · ")]);
      for (const b of payment.receipts) {
        const linked = distinct(data.payments.filter(row => row.source === b.source && row.kind === b.kind && row.receiptid === b.receiptid));
        receipts.rows.push([...identity(m, i), `${b.source} · ${b.kind}`, b.receiptid, b.book, b.number, formatHisDateTime(b.date), numeric(b.gross), numeric(b.waiver), numeric(b.debt),
          b.deferred === "1" ? "Trả sau" : "Không đánh dấu trả sau", numeric(b.refundamount), formatHisDateTime(b.refunddate), numeric(b.advance),
          linked.map(row => `${r.charges.find(c => paymentLinksCharge(row, c))?.name || "Ngoài phạm vi / chưa nối"} · ID ${row.chargeid || "?"}`).join("\n"),
          paymentStates[payment.status].label]);
      }
      for (const c of distinct(r.charges)) charges.rows.push([...identity(m, i), c.source, c.id, c.maql, c.name, numeric(c.quantity), numeric(c.price), numeric(c.amount), c.paid]);
    });
    report.metadata.push(["Đã thu ròng ở các người đối chiếu được (đ)", Number.isSafeInteger(knownNet) ? String(knownNet / 100) : "Chưa xác định"], ["Số người chưa đối chiếu được - không cộng vào tổng", String(unknown)]);
    report.warnings.push(hisDateTimeNotice, "Thu theo chứng từ HIS, không phải tiền công ty đã trả hợp đồng. Tiền trên bảng chứng từ nguồn là cả phiếu, không cộng lại với bảng danh sách.");
    report.sheets = [list, receipts, charges];
  } else {
    const summary: ReportSheet = { name: "Danh sách kết quả", headers: [...baseHeaders, "Trạng thái nguồn kết quả", "Số giá trị XN đã đọc", "Số giá trị CLS đã đọc", "Kết luận nguồn / bác sĩ"], rows: [] };
    const labDetails: ReportSheet = { name: "XN chi tiết", headers: [...baseHeaders, "MAQL", "Phiếu XN", "Mã thông số", "Thông số", "Giá trị nguồn", "Đơn vị", "Cờ bất thường nguồn", "Duyệt kết quả"], rows: [] };
    const imaging: ReportSheet = { name: "CLS chi tiết", headers: [...baseHeaders, "MAQL", "Phiếu CLS", "Nguồn", "Mã dịch vụ", "Dịch vụ", "Kết quả nguồn", "Đề nghị", "Dạng nội dung", "Duyệt kết quả"], rows: [] };
    const labColumns = [...new Map(prepared.flatMap(p => distinct(p.records.labs)).map(r => [labKey(r), r])).entries()]
      .sort((a, b) => (a[1].name || "").localeCompare(b[1].name || "", "vi") || a[0].localeCompare(b[0]));
    const imagingColumns = [...new Map(prepared.flatMap(p => distinct(p.records.imaging)).map(r => [imagingKey(r), r])).entries()]
      .sort((a, b) => (a[1].name || "").localeCompare(b[1].name || "", "vi") || a[0].localeCompare(b[0]));
    // One member per row. Detailed source rows remain in companion sheets for traceability.
    const matrix: ReportSheet = { name: "KQ XN-CLS theo người", headers: [...baseHeaders,
      ...labColumns.map(([, r]) => `XN · ${r.name || "Thông số"} [${r.parameterid || "?"}]${r.unit ? ` (${r.unit})` : ""}`),
      ...imagingColumns.map(([, r]) => `CLS · ${r.name || "Dịch vụ"} [${r.serviceid || r.kind || "?"}]`)], rows: [] };
    prepared.forEach(({ member: m, records: r }, i) => {
      const labs = distinct(r.labs), cls = distinct(r.imaging);
      const byParameter = new Map<string, KskRow[]>();
      for (const lab of labs) { const key = labKey(lab); byParameter.set(key, [...(byParameter.get(key) || []), lab]); }
      const byImaging = new Map<string, KskRow[]>();
      for (const item of cls) { const key = imagingKey(item); byImaging.set(key, [...(byImaging.get(key) || []), item]); }
      summary.rows.push([...identity(m, i), resultStates[memberResultState(data, m)],
        sectionComplete(data, "labs") && sectionComplete(data, "visits") ? labs.filter(l => hasValue(l.value)).length : "Chưa xác định",
        sectionComplete(data, "imaging") && sectionComplete(data, "visits") ? cls.filter(c => hasValue(c.value)).length : "Chưa xác định",
        sectionComplete(data, "conclusions") && sectionComplete(data, "visits") ? distinct(r.clinical).filter(c => c.kind === "BASK_TONGKET" && hasValue(c.ketluan))
          .map(c => `${c.ketluan} · BS ${c.mabs || "chưa ghi"} · Lượt ${c.episodeid}`).join("\n") || "Chưa có kết luận nguồn" : "Chưa xác định"]);
      matrix.rows.push([...identity(m, i),
        ...labColumns.map(([key]) => (byParameter.get(key) || []).map(l => `${l.value || "Trống"} · Phiếu ${l.id || "?"} · MAQL ${l.maql || "?"}`).join("\n")
          || (!sectionComplete(data, "labs") || !sectionComplete(data, "visits") ? "Chưa xác định" : r.visits.length ? "Chưa có giá trị" : "Chưa có lượt")),
        ...imagingColumns.map(([key]) => (byImaging.get(key) || []).map(c => `${readableResult(c)} · Phiếu ${c.id || "?"} · MAQL ${c.maql || "?"}`).join("\n")
          || (!sectionComplete(data, "imaging") || !sectionComplete(data, "visits") ? "Chưa xác định" : r.visits.length ? "Chưa có kết quả" : "Chưa có lượt"))]);
      for (const l of labs) labDetails.rows.push([...identity(m, i), l.maql, l.id, l.parameterid, l.name, l.value || "Chưa có giá trị", l.unit,
        l.kq_batthuong === "1" ? "Có" : l.kq_batthuong === "0" ? "Không" : "Chưa xác định", "Chưa xác minh duyệt/ký"]);
      for (const c of cls) imaging.rows.push([...identity(m, i), c.maql, c.id, c.kind, c.serviceid, c.name, c.value || "Chưa có giá trị", c.denghi,
        c.value?.trim().startsWith("{\\rtf") ? "RTF gốc - chưa chuyển văn bản" : "Văn bản nguồn", "Chưa xác minh duyệt/ký"]);
    });
    // readableResult is used by the printable CLS companion; raw RTF stays in Excel.
    const clsPrint: ReportSheet = { name: "CLS bản in", headers: [...baseHeaders, "Dịch vụ", "Kết quả", "Đề nghị", "Phiếu / MAQL"], rows: [] };
    prepared.forEach(({ member: m, records: r }, i) => { for (const c of distinct(r.imaging)) clsPrint.rows.push([...identity(m, i), c.name, readableResult(c), c.denghi, `${c.id} / ${c.maql}`]); });
    report.warnings.push("Giá trị XN/CLS là dữ liệu nguồn, có kết quả không đồng nghĩa đủ dịch vụ hoặc đã duyệt/ký; số thông số không phải số dịch vụ.",
      "Không tự chọn giá trị cuối khi có nhiều phiếu/lượt. Bảng KQ XN-CLS theo người giữ mọi giá trị kèm phiếu/MAQL; không tự diễn giải lâm sàng.",
      "RTF không tự chuyển thành văn bản y khoa. Bảng CLS bản in ghi tham chiếu; nội dung gốc có ở CLS chi tiết trong Excel, cần đối chiếu HIS.");
    report.sheets = [summary, matrix, labDetails, imaging, clsPrint];
  }
  if (report.sheets.some(s => s.headers.length > 1000 || s.rows.length > 30000)) throw new Error("Báo cáo quá lớn; lọc theo nhóm/người để xuất, không trả bảng bị cắt.");
  report.warnings = [...new Set(report.warnings)];
  return report;
}
