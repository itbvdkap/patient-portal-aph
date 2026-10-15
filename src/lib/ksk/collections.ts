import { z } from "zod";
import { cohortSupportKey, cohortSupportLabel, memberVisits, querySchema, sectionComplete, type KskRow, type KskSnapshot } from "./domain";
import { memberPayment, paymentLinksCharge, paymentReferencesCharge, receiptEpisodeState } from "./payment";
import type { KskReport } from "./reports";
import { formatHisDateTime, hisDateTimeNotice } from "./datetime";

const id = z.string().regex(/^\d{1,24}$/).or(z.literal("")).default("");
export const collectionQuerySchema = z.object({ from: z.string(), to: z.string(), collectedFrom: z.string(), collectedTo: z.string(),
  company: id, support: id, cashier: id.or(z.literal("unknown")), status: z.enum(["", "received", "deferred", "unknown"]).default("") }).strict()
  .refine(q => querySchema.safeParse({ from: q.from, to: q.to }).success && querySchema.safeParse({ from: q.collectedFrom, to: q.collectedTo }).success
    && (Math.max(Date.parse(q.to), Date.parse(q.collectedTo)) - Math.min(Date.parse(q.from), Date.parse(q.collectedFrom))) / 86400000 <= 185,
  "Mỗi khoảng ngày tối đa 93 ngày; toàn bộ phạm vi không quá 186 ngày.");
export type CollectionQuery = z.infer<typeof collectionQuerySchema>;
export interface CollectionRow {
  key: string; bill: KskRow; companyId: string; company: string; cohortId: string; cohort: string; supportKey: string; support: string;
  cashierId: string; cashier: string; patient: string; name: string; registered: string[]; received: number | null;
  appliedAdvance: number | null; status: "received" | "deferred" | "unknown"; notes: string[];
}
function amount(value: string | null | undefined) {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const n = Number(value); return Number.isSafeInteger(Math.round(n * 100)) ? n : null;
}
export function collectionRows(data: KskSnapshot): CollectionRow[] {
  const bills = new Map<string, KskRow[]>();
  for (const line of data.payments) {
    const key = `${line.source}:${line.kind}:${line.receiptid}`;
    const lines = bills.get(key) || []; lines.push(line); bills.set(key, lines);
  }
  const members = [...new Map(data.members.map(m => [`${m.groupid}:${m.mabn}`, m])).values()];
  const chargeCandidates = new Map<string, KskRow[]>();
  const chargeIdentities = new Map<string, string>(), conflictingCharges = new Set<string>();
  for (const charge of data.charges) {
    const identity = `${charge.source}:${charge.id}`, content = JSON.stringify(Object.entries(charge).sort(([a], [b]) => a.localeCompare(b)));
    if (chargeIdentities.has(identity) && chargeIdentities.get(identity) !== content) conflictingCharges.add(identity);
    chargeIdentities.set(identity, content);
    const key = `${charge.id}:${charge.serviceid}`;
    const candidates = chargeCandidates.get(key) || []; candidates.push(charge); chargeCandidates.set(key, candidates);
  }
  const claimed = new Map<string, Set<string>>(), receiptCharges = new Map<string, KskRow[]>();
  for (const [key, lines] of bills) {
    const linked = new Map<string, KskRow>();
    for (const line of lines) for (const charge of chargeCandidates.get(`${line.chargeid}:${line.serviceid}`) || []) {
      if (!paymentReferencesCharge(line, charge)) continue;
      const chargeKey = `${charge.source}:${charge.id}`, receipts = claimed.get(chargeKey) || new Set<string>();
      receipts.add(key); claimed.set(chargeKey, receipts);
      if (paymentLinksCharge(line, charge)) linked.set(chargeKey, charge);
    }
    receiptCharges.set(key, [...linked.values()]);
  }
  const visitsByMember = new Map(members.map(m => [`${m.groupid}:${m.mabn}`, memberVisits(data, m)]));
  return [...bills].flatMap<CollectionRow>(([key, lines]) => {
    const bill = lines[0];
    const linked = receiptCharges.get(key)!;
    const candidates = members.filter(m => m.mabn === bill.mabn && visitsByMember.get(`${m.groupid}:${m.mabn}`)!.some(v => v.maql === bill.maql || v.episodeid === bill.maql || linked.some(c => c.maql === v.maql)));
    const member = candidates.length === 1 ? candidates[0] : null;
    const visits = member ? visitsByMember.get(`${member.groupid}:${member.mabn}`)!.filter(v => v.maql === bill.maql || v.episodeid === bill.maql || linked.some(c => c.maql === v.maql)) : [];
    const cohortIds = [...new Set([member?.cohortid, ...visits.map(v => v.cohortid)].filter(Boolean))];
    const cohort = cohortIds.length === 1 ? data.cohorts.find(c => c.id === cohortIds[0]) : null;
    if (member && lines.every(line => line.mavaovien === bill.mavaovien
      && receiptEpisodeState(line, visitsByMember.get(`${member.groupid}:${member.mabn}`)!) === "outside")) return [];
    let received: number | null = null, status: CollectionRow["status"] = "unknown", notes = ["Chưa nối duy nhất phiếu thu với người khám/đoàn."];
    const appliedAdvance = amount(bill.advance);
    const registered = [...new Set(visits.map(v => v.registereddate).filter((d): d is string => Boolean(d)))].sort();
    const duplicateReceipt = linked.some(c => (claimed.get(`${c.source}:${c.id}`)?.size || 0) > 1);
    const cashierConflict = lines.some(l => l.cashierid !== bill.cashierid || l.cashiername !== bill.cashiername);
    if (linked.some(c => conflictingCharges.has(`${c.source}:${c.id}`))) notes = ["Chỉ định trùng khóa nhưng khác nội dung; chưa đối chiếu được."];
    else if (duplicateReceipt) notes = ["Một chỉ định nối nhiều phiếu thu; chưa đối chiếu hủy/thay phiếu, không cộng lặp."];
    else if (cashierConflict) notes = ["Thông tin thu ngân trên phiếu không nhất quán."];
    else if (member && cohort && sectionComplete(data, "members") && registered.length && bill.date) {
      const payment = memberPayment({ ...data, charges: linked, payments: lines }, member);
      notes = payment.notes;
      if (payment.net !== null && appliedAdvance !== null && bill.deferred === "1") { status = "deferred"; received = 0; }
      else if (payment.net !== null && appliedAdvance !== null) {
        // Patient settlement includes prior advances; today's collection must NOT count them again.
        const cents = Math.round(payment.net * 100) - Math.round(appliedAdvance * 100);
        if (cents >= 0 && Number.isSafeInteger(cents)) { status = "received"; received = cents / 100; }
        if (appliedAdvance > 0) notes = [...notes, "Không cộng lại tạm ứng đã áp dụng vào tiền thu ngày phiếu."];
      }
    }
    return [{ key, bill, companyId: cohort?.customerid || "", company: cohort?.customer || "Chưa nối công ty", cohortId: cohort?.id || "",
      cohort: cohort?.name || "Chưa nối đoàn", supportKey: cohort ? cohortSupportKey(cohort) : "unknown", support: cohort ? cohortSupportLabel(cohort) : "Chưa nối phụ trách",
      cashierId: bill.cashierid || "unknown", cashier: bill.cashiername || (bill.cashierid ? `Mã HIS ${bill.cashierid} · chưa đọc tên` : "Chưa đọc được thu ngân"),
      patient: bill.mabn || "", name: member?.name || "Chưa nối người khám", registered, received, appliedAdvance, status, notes }];
  }).sort((a, b) => (b.bill.date || "").localeCompare(a.bill.date || "") || a.key.localeCompare(b.key));
}
export function filterCollections(rows: CollectionRow[], data: KskSnapshot, query: CollectionQuery) {
  const support = data.cohorts.find(c => c.id === query.support);
  return rows.filter(r => (!query.company || r.companyId === query.company)
    && (!query.support || (support && r.supportKey === cohortSupportKey(support)))
    && (!query.cashier || r.cashierId === query.cashier) && (!query.status || r.status === query.status)
    && (!r.bill.date || (r.bill.date.slice(0, 10) >= query.collectedFrom && r.bill.date.slice(0, 10) <= query.collectedTo)));
}
export function collectionSummary(data: KskSnapshot, rows: CollectionRow[]) {
  const complete = ["cohorts", "members", "visits", "charges", "payments"].every(s => sectionComplete(data, s));
  const known = rows.filter(r => r.status === "received" && r.received !== null);
  const cents = known.reduce((sum, r) => sum + Math.round(r.received! * 100), 0);
  return { complete, count: complete ? rows.length : null, received: complete && Number.isSafeInteger(cents) ? cents / 100 : null,
    verified: known.length, unknown: rows.filter(r => r.status === "unknown").length, deferred: rows.filter(r => r.status === "deferred").length };
}
export function buildCollectionReport(data: KskSnapshot, rows: CollectionRow[], query: CollectionQuery): KskReport {
  const summary = collectionSummary(data, rows);
  if (!summary.complete) throw new Error("Nguồn dữ liệu chưa đầy đủ; không xuất báo cáo bị cắt hoặc tổng chưa xác định.");
  return { kind: "collections", title: "Báo cáo thu tiền khám đoàn tổng hợp", memberCount: new Set(rows.map(r => r.patient)).size,
    metadata: [["Nguồn", `${data.scope.mode === "demo" ? "GIẢ LẬP" : "HIS"} ${data.scope.branch} · Chỉ đọc`],
      ["Ngày đăng ký", `${query.from} → ${query.to}`], ["Ngày thu", `${query.collectedFrom} → ${query.collectedTo}`], ["Đọc lúc", data.scope.asof],
      ["Bộ lọc", `Công ty ${query.company || "tất cả"}; phụ trách ID đợt đại diện ${query.support || "tất cả"}; thu ngân ${query.cashier || "tất cả"}; trạng thái ${query.status || "tất cả"}`],
      ["Tiền thu đối chiếu được (đ)", summary.received === null ? "Chưa xác định" : String(summary.received)], ["Phiếu chưa đối chiếu", String(summary.unknown)]],
    warnings: [...data.warnings, hisDateTimeNotice, "Tổng chỉ gồm phiếu đối chiếu được. Không phải tiền công ty trả hợp đồng; không bao gồm thu tạm ứng riêng. Không cộng lại tiền tạm ứng áp dụng vào quyết toán.",
      "Phiếu hủy/hoàn hoặc thiếu liên kết giữ Chưa xác định, không tự tính tổng thu ròng theo ngày hoàn. Dữ liệu cá nhân: chỉ chia sẻ với người có quyền."],
    sheets: [{ name: "Phiếu thu tổng hợp", headers: ["Công ty", "Đoàn khám", "Phụ trách / CSKH", "Thu ngân HIS", "Mã BN", "Họ tên", "Ngày giờ đăng ký (HIS)", "Ngày giờ thu (HIS)", "Nguồn / loại", "ID phiếu", "Quyển", "Số biên lai", "Tiền gốc cả phiếu (đ)", "Miễn giảm nguồn (đ)", "Trả thiếu nguồn (đ)", "Tạm ứng áp dụng (đ)", "Thu ngày phiếu đối chiếu (đ)", "Trạng thái", "Ghi chú"], moneyColumns: [12, 13, 14, 15, 16],
      rows: rows.map(r => [r.company, r.cohort, r.support, r.cashier, r.patient, r.name, r.registered.map(formatHisDateTime).join("\n") || "Chưa xác định", formatHisDateTime(r.bill.date), `${r.bill.source} · ${r.bill.kind}`, r.bill.receiptid, r.bill.book, r.bill.number,
        amount(r.bill.gross), amount(r.bill.waiver), amount(r.bill.debt), r.appliedAdvance, r.received ?? "Chưa xác định", r.status === "received" ? "Đối chiếu được" : r.status === "deferred" ? "Trả sau — chưa nhận tiền" : "Chưa xác định", r.notes.join(" · ")]) },
      { name: "Bản in thu tiền", headers: ["Công ty / đoàn", "Phụ trách", "Thu ngân", "Mã BN / họ tên", "Ngày giờ đăng ký (HIS)", "Ngày giờ thu (HIS)", "Quyển / số phiếu", "Thu đối chiếu (đ)", "Trạng thái / ghi chú"], moneyColumns: [7],
        rows: rows.map(r => [`${r.company}\n${r.cohort}`, r.support, r.cashier, `${r.patient}\n${r.name}`, r.registered.map(formatHisDateTime).join("\n") || "Chưa xác định", formatHisDateTime(r.bill.date),
          `${r.bill.source}\n${r.bill.book}/${r.bill.number}`, r.received ?? "Chưa xác định", `${r.status === "received" ? "Đối chiếu được" : r.status === "deferred" ? "Trả sau" : "Chưa xác định"}\n${r.notes.join(" · ")}`]) }] };
}
