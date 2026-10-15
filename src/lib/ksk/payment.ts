import { chargeTotal, memberRecords, positiveEpisode, sectionComplete, type KskRow, type KskSnapshot } from "./domain";

export const paymentStates = {
  paid: { label: "Đã thanh toán đủ", color: "border-green-300 bg-green-50 text-green-900" },
  unpaid: { label: "Chưa thanh toán", color: "border-red-300 bg-red-50 text-red-900" },
  partial: { label: "Thanh toán một phần", color: "border-orange-300 bg-orange-50 text-orange-900" },
  none: { label: "Chưa phát sinh chi phí", color: "border-slate-200 bg-slate-50 text-slate-700" },
  unknown: { label: "Chưa xác định ⚠", color: "border-slate-300 bg-slate-100 text-slate-800" },
} as const;
export type PaymentState = keyof typeof paymentStates;
export interface PaymentSummary {
  status: PaymentState; due: number | null; net: number | null; outstanding: number | null;
  notes: string[]; receipts: KskRow[];
}

// Oracle NUMBER may carry decimals. Work in integer hundredths; never accept exponent,
// NaN, missing values, fractional cents or unsafe integers for financial comparisons.
function cents(value: string | null | undefined): number | null {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(n) ? n : null;
}
function zeroFlag(value: string | null | undefined) { return value === "0" || value == null; }
function tableMatches(row: KskRow, charge: KskRow) {
  // TABLE_X must identify the physical source. Bare names cannot prove cross-month links.
  const table = row.chargetable?.trim().toUpperCase();
  // CN1 leaves TABLE_X empty. Require the bidirectional IDTTRV / IDCHIDINH link
  // in the SAME physical month and visit; the patient is independently checked.
  if (!table) return row.source === charge.source && row.maql === charge.maql
    && charge.idttrv === row.receiptid && charge.idttrv !== "0";
  return table === `${charge.source}.V_CHIDINH` || table === `${charge.source?.slice(-4)}.V_CHIDINH`
    || (row.source === charge.source && table === "V_CHIDINH");
}
export function paymentLinksCharge(row: KskRow, charge: KskRow) {
  return charge.id === row.chargeid && charge.serviceid === row.serviceid && charge.mabn === row.mabn
    && positiveEpisode(charge.mavaovien) && charge.idttrv === row.receiptid && tableMatches(row, charge);
}
// Evidence of competing receipts is deliberately broader than an approval link:
// a stale IDTTRV must not hide a second receipt claiming the same directive.
export function paymentReferencesCharge(row: KskRow, charge: KskRow) {
  return charge.id === row.chargeid && charge.serviceid === row.serviceid && charge.mabn === row.mabn
    && positiveEpisode(charge.mavaovien) && (row.chargetable?.trim() ? tableMatches(row, charge)
      : row.source === charge.source && row.maql === charge.maql);
}

export function receiptEpisodeState(bill: KskRow, visits: KskRow[]): "match" | "legacy" | "outside" | "unknown" {
  const anchors = visits.filter(v => v.mabn === bill.mabn && positiveEpisode(v.episodeid));
  if (positiveEpisode(bill.mavaovien))
    return anchors.some(v => v.episodeid === bill.mavaovien) ? "match" : anchors.length ? "outside" : "unknown";
  if (bill.mavaovien === "0" && anchors.some(v => v.maql === bill.maql)) return "legacy";
  return "unknown";
}
function decimalKey(value: string | null | undefined) {
  if (!value || value.length > 128 || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "")}`;
}

export function memberPayment(data: KskSnapshot, member: KskRow): PaymentSummary {
  const records = memberRecords(data, member);
  const candidateRows = data.payments.filter(r => r.mabn === member.mabn &&
    (records.visits.some(v => v.maql === r.maql || v.episodeid === r.maql)
      || records.charges.some(c => c.id === r.chargeid && tableMatches(r, c))));
  const byReceipt = new Map<string, KskRow[]>();
  const receiptKey = (r: KskRow) => `${r.source}:${r.kind}:${r.receiptid}`;
  for (const row of candidateRows) { const key = receiptKey(row), rows = byReceipt.get(key) || []; rows.push(row); byReceipt.set(key, rows); }
  const outside = new Set([...byReceipt].filter(([, rows]) => rows.every(r => r.mavaovien === rows[0].mavaovien
    && receiptEpisodeState(r, records.visits) === "outside")).map(([key]) => key));
  const receiptRows = candidateRows.filter(r => !outside.has(receiptKey(r)));
  const bills = [...new Map(receiptRows.map(r => [`${r.source}:${r.kind}:${r.receiptid}`, r])).values()];
  const fail = (note: string): PaymentSummary => ({ status: "unknown", due: null, net: null, outstanding: null,
    notes: [note], receipts: bills });
  if (data.scope.episodePolicy !== 2) return fail("Agent chưa hỗ trợ đối chiếu MAVAOVIEN phiên bản 2; cần cập nhật agent trước khi tính tài chính.");
  if (!sectionComplete(data, "visits") || !sectionComplete(data, "charges")) return fail("Chưa đọc đủ lượt/chỉ định.");
  if (records.visits.some(v => !positiveEpisode(v.episodeid))) return fail("Lượt tiếp nhận chưa có MAVAOVIEN hợp lệ để xác định đợt khám.");
  const scopeNotes: string[] = [];
  if (records.excludedCharges.length) scopeNotes.push(`Đã loại ${records.excludedCharges.length} chỉ định không khớp MAVAOVIEN của đợt (gồm mã 0/trống).`);
  if (outside.size) scopeNotes.push(`Đã loại ${outside.size} phiếu có MAVAOVIEN khác đợt khám.`);
  const gross = chargeTotal(records.charges);
  if (gross === null || gross < 0) return fail("Thành tiền chỉ định chưa xác định.");
  if (!records.charges.length && !receiptRows.length) return { status: "none", due: 0, net: 0, outstanding: 0,
    notes: [...scopeNotes, records.visits.length ? "Chưa có chỉ định trong phạm vi." : "Chưa có lượt khám trong phạm vi."], receipts: [] };
  if (!sectionComplete(data, "payments")) return fail("Chưa đọc đủ nguồn chứng từ, miễn giảm và hủy/hoàn.");
  if (records.charges.length && data.visits.some(v => v.mabn === member.mabn && v.groupid !== member.groupid && records.visits.some(own => own.maql === v.maql)))
    return fail("Cùng lượt khám xuất hiện ở nhiều nhóm; chưa phân bổ người chịu chi phí.");
  const charges = [...new Map(records.charges.map(c => [`${c.source}:${c.id}`, c])).values()];
  if (charges.some(c => new Set(receiptRows.filter(r => paymentReferencesCharge(r, c)).map(receiptKey)).size > 1))
    return fail("Một chỉ định nối nhiều chứng từ; cần đối chiếu hủy/thay phiếu.");
  if (charges.some(c => c.madoituong === "1")) return fail("Có khoản BHYT; chưa phân bổ đầy đủ phần quỹ và người bệnh chịu.");
  const chargeAmounts = charges.map(c => cents(c.amount));
  if (chargeAmounts.some(v => v === null)) return fail("Số tiền chỉ định không hợp lệ.");
  let due = chargeAmounts.reduce<number>((s, v) => s + v!, 0), net = 0;
  if (!Number.isSafeInteger(due)) return fail("Tổng tiền vượt giới hạn đối chiếu.");
  const claimed = new Set<string>(), notes: string[] = [...scopeNotes];
  for (const bill of bills) {
    const episodeState = receiptEpisodeState(bill, records.visits);
    if (episodeState === "unknown") return fail("Phiếu chưa đủ MAVAOVIEN/MAQL để xác minh thuộc đợt.");
    const rows = receiptRows.filter(r => r.source === bill.source && r.kind === bill.kind && r.receiptid === bill.receiptid);
    // Duplicate join rows are tolerated only when all fields agree; no double collection.
    const lines = new Map<string, KskRow>();
    for (const row of rows) {
      const existing = lines.get(row.lineid ?? "");
      if (existing && JSON.stringify(existing) !== JSON.stringify(row)) return fail("Chi tiết chứng từ trùng khóa nhưng khác nội dung.");
      lines.set(row.lineid ?? "", row);
      for (const field of ["gross", "waiver", "debt", "insurance", "advance", "verifiedadvance", "linegross", "supplies", "linecount", "number", "book", "deferred", "refunded", "refundamount", "refundcount", "unsettled", "headerdiscount", "extrawaiver", "refunddetailamount", "refunddate", "date", "mabn", "maql", "mavaovien"])
        if (row[field] !== bill[field]) return fail("Thông tin đầu phiếu không nhất quán.");
    }
    if (!bill.book || !/^\d+$/.test(bill.book) || Number(bill.book) <= 0 || !bill.number || !/^\d+$/.test(bill.number) || Number(bill.number) <= 0)
      return fail("Phiếu chưa có số biên lai hợp lệ hoặc đã hủy.");
    if (!zeroFlag(bill.refunded) || bill.refundcount !== "0" || bill.refundamount !== "0")
      return fail(`Phiếu ${bill.number}: có hủy/hoàn (${bill.refundamount ?? "?"} đ); chưa phân bổ lại từng dịch vụ.`);
    if (bill.refunddetailamount !== "0" || bill.extrawaiver !== "0")
      return fail(`Phiếu ${bill.number}: chi tiết hoàn/miễn thêm cần đối chiếu phân bổ.`);
    if (!["0", "1", null].includes(bill.deferred ?? null) || !zeroFlag(bill.unsettled))
      return fail(`Phiếu ${bill.number}: chưa xác định tình trạng thu/duyệt.`);
    const amounts = ["gross", "waiver", "debt", "insurance", "advance", "verifiedadvance", "linegross", "supplies", "headerdiscount"].map(k => cents(bill[k]));
    if (amounts.some(v => v === null)) return fail("Thiếu giá trị tiền trên chứng từ.");
    const [bGross, waiver, debt, insurance, advance, verifiedAdvance, lineGross, supplies, discount] = amounts as number[];
    if (supplies > 0 || discount > 0 || insurance > 0 || advance !== verifiedAdvance)
      return fail(`Phiếu ${bill.number}: vật tư/miễn giảm/BHYT/tạm ứng cần đối chiếu phân bổ.`);
    if (bill.deferred === "1" && advance > 0) return fail("Phiếu trả sau có sử dụng tạm ứng; cần đối chiếu khoản đã nhận.");
    let matched = 0;
    for (const row of lines.values()) {
      const c = charges.find(c => paymentLinksCharge(row, c));
      if (!row.lineid || !c) return fail(`Phiếu ${bill.number}: có dịch vụ ngoài phạm vi hoặc thiếu liên kết chỉ định.`);
      if (episodeState === "match" && c.mavaovien !== bill.mavaovien) return fail("Phiếu chứa chi tiết thuộc lần vào viện khác.");
      if (episodeState === "legacy" && c.maql !== bill.maql) return fail("Phiếu MAVAOVIEN=0 có chi tiết không cùng MAQL tiếp nhận.");
      if (decimalKey(row.linequantity) === null || decimalKey(row.lineprice) === null
        || decimalKey(row.linequantity) !== decimalKey(c.quantity) || decimalKey(row.lineprice) !== decimalKey(c.price))
        return fail("Số lượng/đơn giá chi tiết phiếu không khớp chỉ định.");
      const key = `${c.source}:${c.id}`;
      if (claimed.has(key)) return fail("Một chỉ định nối nhiều chứng từ; cần đối chiếu hủy/thay phiếu.");
      if (cents(row.lineamount) !== cents(c.amount)) return fail("Đơn giá/số lượng phiếu thu khác chỉ định.");
      if (cents(row.linediscount) !== 0) return fail("Miễn giảm chi tiết cần đối chiếu với miễn giảm đầu phiếu.");
      claimed.add(key); matched += cents(c.amount)!;
    }
    if (String(lines.size) !== bill.linecount || matched !== lineGross || bGross !== lineGross)
      return fail("Chưa đối chiếu đủ tổng tiền và tất cả dịch vụ của phiếu.");
    if (episodeState === "legacy") notes.push(`Phiếu ${bill.number}: MAVAOVIEN=0, đã xác minh qua MAQL và toàn bộ chi tiết đúng lần vào viện của đợt.`);
    if (waiver > bGross || debt > bGross - waiver || advance > bGross - waiver - debt)
      return fail("Miễn giảm/trả thiếu/tạm ứng vượt số phải thu.");
    due -= waiver;
    if (bill.deferred === "1") notes.push(`Phiếu ${bill.number}: trả sau; chưa coi là tiền đã nhận.`);
    else {
      net += bGross - waiver - debt;
      if (advance) notes.push(`Đã đối chiếu tạm ứng ${advance / 100} đ trong phiếu ${bill.number}.`);
    }
    if (waiver) notes.push(`Miễn giảm ${waiver / 100} đ theo chứng từ HIS.`);
    if (debt) notes.push(`Phiếu ${bill.number}: còn khoản trả thiếu ${debt / 100} đ.`);
  }
  for (const c of charges) {
    if (claimed.has(`${c.source}:${c.id}`)) continue;
    if (c.paid !== "0" || (c.idttrv && c.idttrv !== "0") || c.madoituong === "1")
      return fail("Có chỉ định chưa nối được phiếu thu/miễn giảm (có thể khác tháng); không suy ra từ PAID.");
  }
  if (!Number.isSafeInteger(net) || due < 0 || net > due) return fail("Tổng đối chiếu không hợp lệ.");
  const outstanding = due - net;
  const status: PaymentState = due === 0 ? "none" : outstanding === 0 ? "paid" : net === 0 ? "unpaid" : "partial";
  if (status === "partial") notes.unshift("Thanh toán một phần, còn khoản chưa thu.");
  if (status === "none" && gross > 0) notes.unshift("Không còn khoản phải thu sau miễn giảm; không phải tiền đã thu.");
  return { status, due: due / 100, net: net / 100, outstanding: outstanding / 100, notes, receipts: bills };
}

export function paymentDashboard(data: KskSnapshot) {
  const members = [...new Map(data.members.map(m => [`${m.groupid}:${m.mabn}`, m])).values()];
  const payments = new Map(members.map(m => [`${m.groupid}:${m.mabn}`, memberPayment(data, m)]));
  const counts = Object.fromEntries(Object.keys(paymentStates).map(s => [s, sectionComplete(data, "members")
    ? [...payments.values()].filter(p => p.status === s).length : null])) as Record<PaymentState, number | null>;
  return { payments, counts };
}
