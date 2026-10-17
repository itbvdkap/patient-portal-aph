import { z } from "zod";
import { formatHisDateTime } from "@/lib/ksk/datetime";
import type { KskReport } from "@/lib/ksk/reports";

export const revenueKinds = {
  direct: "Thu trực tiếp", threshold: "Thu vượt ngưỡng / đồng chi trả", advance: "Thu tạm ứng",
  advance_refund: "Hoàn tạm ứng", discharge: "Thu thanh toán ra viện", pharmacy: "Thu thuốc",
  other_refund: "Hoàn thu khác", unclassified: "Chưa phân loại",
} as const;
export type RevenueKind = keyof typeof revenueKinds;
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).refine(s => {
  const date = new Date(s + "Z"); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === s && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 9998;
});
export const revenueQuerySchema = z.object({ from: timestamp, to: timestamp,
  cashier: z.string().max(80).default(""), department: z.string().max(80).default(""),
  kind: z.enum(["", "direct", "threshold", "advance", "advance_refund", "discharge", "pharmacy", "other_refund", "unclassified"]).default(""),
}).strict().refine(q => q.to >= q.from && Date.parse(q.to + "Z") - Date.parse(q.from + "Z") < 31 * 86400000, "Khoảng ngày giờ tối đa 31 ngày.");
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;
export function defaultRevenueQuery(now = new Date()): RevenueQuery {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { from: day + "T00:00:00", to: day + "T23:59:59", cashier: "", department: "", kind: "" };
}
export const revenueSnapshotSchema = z.object({
  scope: z.object({ reportType: z.literal("cashier"), version: z.literal(1), mode: z.literal("his"), branch: z.enum(["CN1", "CN3"]), from: timestamp, to: timestamp, asof: z.string(), departmentPolicy: z.literal("receipt_header"), storagePolicy: z.literal("adjacent_months") }),
  receipts: z.array(z.record(z.string().nullable()).refine(r => ["source", "id", "kind"].every(k => !!r[k]?.trim()) && ["occurredat", "gross", "insurance", "waiver", "debt", "advance", "discount", "deferred", "unsettled", "refunded", "linecount"].every(k => k in r))).max(20000),
  sections: z.record(z.boolean()), warnings: z.array(z.string()),
});
export type RevenueSnapshot = z.infer<typeof revenueSnapshotSchema>;
export type RevenueRow = { key: string; kind: RevenueKind; cashierId: string; cashier: string; departmentId: string; department: string;
  at: string; patient: string; name: string; receipt: string; gross: number | null; advance: number | null; amount: number | null; notes: string[] };
function cents(value: string | null | undefined) {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split("."); const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}
function positiveNumber(value: string | null | undefined) { return !!value && /^\d+$/.test(value) && /[1-9]/.test(value); }
export function revenueRows(data: RevenueSnapshot): RevenueRow[] {
  const bills = new Map<string, RevenueSnapshot["receipts"]>();
  for (const row of data.receipts) { const key = `${row.source}:${row.id}`; bills.set(key, [...(bills.get(key) || []), row]); }
  return [...bills].map(([key, copies]) => {
    const r = copies[0]; const kind = Object.hasOwn(revenueKinds, r.kind || "") ? r.kind as RevenueKind : "unclassified";
    const notes: string[] = []; let amount: number | null = null;
    const values = [r.gross, r.insurance, r.waiver, r.debt, r.advance, r.discount].map(cents);
    const [gross, insurance, waiver, debt, advance, discount] = values;
    const returnedAdvance = cents(r.returnedadvance ?? "0");
    const refund = kind === "advance_refund" || kind === "other_refund";
    const conflict = copies.some(c => JSON.stringify(Object.entries(c).sort()) !== JSON.stringify(Object.entries(r).sort()));
    if (conflict) notes.push("Trùng mã phiếu nhưng khác dữ liệu; cần đối chiếu.");
    else if (kind === "unclassified") notes.push("Chưa phân loại được phiếu theo HIS.");
    else if (r.occurredat! < data.scope.from || r.occurredat! > data.scope.to || !timestamp.safeParse(r.occurredat).success) notes.push("Ngày giờ phiếu ngoài phạm vi hoặc không hợp lệ.");
    else if (values.some(v => v === null) || !Number.isSafeInteger(values.reduce<number>((n, v) => n + (v || 0), 0))) notes.push("Thiếu hoặc sai số tiền trên phiếu.");
    else if (!positiveNumber(r.receiptno) && !(kind === "pharmacy" && positiveNumber(r.prescriptionno))) notes.push("Chưa có số biên lai/toa hợp lệ.");
    else if (!/^[1-9]\d*$/.test(r.linecount || "")) notes.push("Không có chi tiết phiếu.");
    else if ([r.deferred, r.unsettled, r.refunded].some(f => f != null && f !== "0" && f !== "1")) notes.push("Trạng thái phiếu chưa xác định.");
    else if (cents(r.extrawaiver ?? "0") !== 0 || (discount! > 0 && discount !== waiver)) notes.push("Miễn giảm bổ sung cần đối chiếu.");
    else if (returnedAdvance === null || returnedAdvance > advance! || (returnedAdvance > 0 && returnedAdvance !== advance)) notes.push("Chưa đối chiếu đủ tạm ứng đã hoàn liên kết với thanh toán.");
    else if (r.deferred === "1" || r.unsettled === "1") { amount = 0; notes.push("Trả sau / chưa thanh toán, chưa ghi nhận tiền thu."); }
    else {
      // CN1 can refund ALL deposits with LOAI_HT=4, IDTTRV, same patient/day/cashier,
      // then collect the full patient portion. Do not subtract those deposits twice.
      const received = gross! - insurance! - waiver! - debt! - (advance! - returnedAdvance!);
      if (received < 0) notes.push("Khấu trừ lớn hơn tổng phiếu; cần đối chiếu khoản hoàn khi ra viện.");
      else amount = (refund ? -received : received) / 100;
    }
    if (r.refunded === "1") notes.push("Phiếu có cờ hoàn; khoản hoàn được ghi theo ngày và người lập phiếu hoàn.");
    if (returnedAdvance) notes.push("Tạm ứng đã hoàn bằng phiếu liên kết; không khấu trừ lần nữa ở phiếu thanh toán.");
    else if (advance) notes.push("Đã trừ tạm ứng sử dụng khỏi tiền thu tại thời điểm thanh toán.");
    return { key, kind, cashierId: /^[VD]:\d+$/.test(r.cashierid || "") ? r.cashierid! : "unknown", cashier: r.cashiername || "Chưa đọc tên thu ngân", departmentId: /^[VD]:.+$/.test(r.departmentid || "") ? r.departmentid! : "unknown", department: r.departmentname || "Chưa đọc khoa/phòng",
      at: r.occurredat || "", patient: r.mabn || "", name: r.patientname || "", receipt: `${r.book || "—"}/${Number(r.receiptno) > 0 ? r.receiptno : r.prescriptionno || "—"}`,
      gross: gross === null ? null : gross / 100, advance: advance === null ? null : advance / 100, amount, notes };
  }).sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
}
export function filterRevenue(rows: RevenueRow[], query: RevenueQuery) { return rows.filter(r => (!query.cashier || r.cashierId === query.cashier) && (!query.department || r.departmentId === query.department) && (!query.kind || r.kind === query.kind)); }
export function revenueSummary(rows: RevenueRow[]) {
  const sum = (selected: RevenueRow[]) => { const total = selected.reduce((n, r) => n + Math.round((r.amount || 0) * 100), 0); return Number.isSafeInteger(total) ? total / 100 : null; };
  return { count: rows.length, unknown: rows.filter(r => r.amount === null).length, inflow: sum(rows.filter(r => r.amount !== null && r.amount >= 0)), outflow: sum(rows.filter(r => r.amount !== null && r.amount < 0)), net: sum(rows),
    byKind: Object.fromEntries(Object.keys(revenueKinds).map(kind => [kind, sum(rows.filter(r => r.kind === kind))])) as Record<RevenueKind, number | null> };
}
export function revenueComplete(data: RevenueSnapshot) {
  // Every requested month must have all five sources, even when a source has no rows.
  const suffixes = new Set<string>();
  const start = new Date(data.scope.from + "Z"), end = new Date(data.scope.to + "Z"); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0); start.setUTCMonth(start.getUTCMonth()-1); end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth()+1);
  while (start <= end) { suffixes.add(String(start.getUTCMonth() + 1).padStart(2, "0") + String(start.getUTCFullYear()).slice(-2)); start.setUTCMonth(start.getUTCMonth() + 1); }
  return [...suffixes].every(month => ["direct", "settlement", "advance", "refund", "pharmacy"].every(part =>
    Object.entries(data.sections).some(([key, complete]) => key.endsWith(`${month}:${part}`) && complete)));
}
export function cashierGroups(rows: RevenueRow[]) {
  return [...new Set(rows.map(r => r.cashierId))].map(id => ({ id, name: rows.find(r => r.cashierId === id)!.cashier, summary: revenueSummary(rows.filter(r => r.cashierId === id)) }));
}
export function buildRevenueReport(data: RevenueSnapshot, rows: RevenueRow[], query: RevenueQuery): KskReport {
  const totals = revenueSummary(rows);
  return { kind: "revenue", title: "Doanh thu viện phí theo thu ngân", memberCount: rows.length,
    metadata: [["Nguồn", `HIS ${data.scope.branch}`], ["Từ ngày giờ", formatHisDateTime(query.from)], ["Đến ngày giờ (bao gồm)", formatHisDateTime(query.to)], ["Đọc lúc", data.scope.asof],
      ["Thu ngân", query.cashier || "Tất cả"], ["Khoa/phòng trên phiếu", query.department || "Tất cả"], ["Loại thu", query.kind ? revenueKinds[query.kind] : "Tất cả"], ["Số phiếu cần đối chiếu", String(totals.unknown)], ["Đọc đủ nguồn", revenueComplete(data) ? "Có" : "Chưa đủ — tổng toàn bộ chưa xác định"]],
    warnings: [...data.warnings, "Ngày giờ HIS giữ nguyên. Thuốc liên kết phiếu viện phí chỉ tính tại phiếu viện phí. Ra viện: trừ ứng sử dụng; nếu đã hoàn đủ bằng phiếu liên kết cùng người bệnh/ngày/thu ngân thì không trừ lại.", "Tạm ứng là dòng tiền nhận trước, được trình bày riêng với thu dịch vụ. Hoàn thu tính âm theo ngày và thu ngân hoàn."],
    sheets: [
      { name: "Tổng hợp theo thu ngân", headers: ["Mã thu ngân", "Thu ngân", "Số phiếu", ...Object.values(revenueKinds), "Thu ròng đã xác định (đ)", "Phiếu cần đối chiếu"], moneyColumns: [3,4,5,6,7,8,9,10,11], rows: cashierGroups(rows).map(g => [g.id, g.name, g.summary.count, ...Object.keys(revenueKinds).map(k => g.summary.byKind[k as RevenueKind]), g.summary.net, g.summary.unknown]) },
      { name: "Chi tiết phiếu", headers: ["Ngày giờ", "Thu ngân", "Mã thu ngân", "Khoa/phòng", "Loại thu", "Quyển / số", "Mã BN", "Họ tên", "Tổng phiếu (đ)", "Tạm ứng trên phiếu (đ)", "Thu / hoàn (đ)", "Ghi chú"], moneyColumns: [8,9,10], rows: rows.map(r => [formatHisDateTime(r.at), r.cashier, r.cashierId, r.department, revenueKinds[r.kind], r.receipt, r.patient, r.name, r.gross, r.advance, r.amount ?? "Chưa xác định", r.notes.join(" · ")]) },
    ] };
}
