import { describe, expect, it } from "vitest";
import { demoKskSnapshot } from "@/lib/ksk/sample";
import { memberPayment, paymentDashboard } from "@/lib/ksk/payment";

function fixture() {
  const data = demoKskSnapshot({ from: "2026-10-01", to: "2026-10-14", cohort: "900001" });
  const member = data.members[0];
  data.members = [member]; data.visits = [data.visits[0]];
  data.charges = [{ ...data.charges[0], paid: "1", idttrv: "501" }];
  data.payments = [{ source: "DEMO", kind: "DIRECT", receiptid: "501", mabn: member.mabn!, maql: "1001", mavaovien: "1001", linequantity: "1", lineprice: "100000", book: "9", number: "21", date: "2026-10-01",
    deferred: "0", refunded: "0", headerdiscount: "0", gross: "100000", waiver: "0", debt: "0", insurance: "0", advance: "0", verifiedadvance: "0",
    linegross: "100000", supplies: "0", linecount: "1", refundamount: "0", refundcount: "0", refunddate: null, refunddetailamount: "0", extrawaiver: "0", unsettled: "0",
    lineid: "1", chargeid: "1", chargetable: "V_CHIDINH", serviceid: "1", lineamount: "100000", linediscount: "0" }];
  const bill = data.payments[0];
  return { data, member, bill, payment: () => memberPayment(data, member) };
}

describe("KSK receipt reconciliation, not PAID inference", () => {
  it("excludes mirror directives with episode 0 without dropping real type 0 services", () => {
    const f = fixture(); f.bill.mavaovien = "0"; f.data.charges[0].loai = "0";
    f.data.charges.push({ ...f.data.charges[0], id: "mirror", mavaovien: "0" });
    expect(f.payment()).toMatchObject({ status: "paid", due: 100000, net: 100000, outstanding: 0 });
    expect(f.payment().notes.join(" ")).toContain("Đã loại 1");
    expect(f.payment().notes.join(" ")).toContain("đã xác minh qua MAQL");
  });
  it("requires an explicit modern episode contract; old snapshots cannot produce financial totals", () => {
    const f = fixture(); delete f.data.scope.episodePolicy;
    expect(f.payment()).toMatchObject({ status: "unknown", due: null, net: null });
  });
  it("excludes charges from a different or missing episode even when patient and MAQL agree", () => {
    for (const episode of ["999", "0", null]) {
      const f = fixture(); f.data.payments = []; f.data.charges[0].mavaovien = episode;
      expect(f.payment()).toMatchObject({ status: "none", due: 0, net: 0 });
    }
  });
  it("does not turn a missing reception episode into an empty/no-cost visit", () => {
    const f = fixture(); f.data.visits[0].episodeid = "0";
    expect(f.payment()).toMatchObject({ status: "unknown", due: null });
  });
  it("excludes positive foreign-episode receipts instead of using same-patient/MAQL fallback", () => {
    const f = fixture(); f.bill.mavaovien = "999";
    expect(f.payment().net).toBeNull(); expect(f.payment().receipts).toHaveLength(0);
  });
  it("legacy header episode 0 needs exact MAQL and every linked original directive", () => {
    const f = fixture(); f.bill.mavaovien = "0";
    expect(f.payment().status).toBe("paid");
    f.bill.maql = "different"; expect(f.payment().status).toBe("unknown");
    f.bill.maql = "1001"; f.data.charges[0].mavaovien = "999"; expect(f.payment().status).toBe("unknown");
  });
  it("does not infer missing header MAVAOVIEN or accept conflicting episode values for the same receipt", () => {
    const f = fixture(); delete f.bill.mavaovien; expect(f.payment().status).toBe("unknown");
    f.bill.mavaovien = "0"; f.data.payments.push({ ...f.bill, mavaovien: "999" }); expect(f.payment().status).toBe("unknown");
  });
  it("checks separate quantity/price, not only the resulting amount", () => {
    const f = fixture(); f.bill.mavaovien = "0"; f.bill.linequantity = "2"; f.bill.lineprice = "50000";
    expect(f.payment().status).toBe("unknown");
    f.bill.linequantity = "1.00"; f.bill.lineprice = "100000.00"; expect(f.payment().status).toBe("paid");
  });
  it("will not approve a legacy receipt with one line outside the cohort episode", () => {
    const f = fixture(); f.bill.mavaovien = "0"; f.bill.linecount = "2"; f.bill.gross = f.bill.linegross = "200000";
    f.data.charges.push({ ...f.data.charges[0], id: "2", mavaovien: "999" });
    f.data.payments.push({ ...f.bill, lineid: "2", chargeid: "2" });
    expect(f.payment().status).toBe("unknown");
  });
  it("recognizes a verified full receipt even if PAID differs", () => {
    const f = fixture(); f.data.charges[0].paid = "0";
    expect(f.payment()).toMatchObject({ status: "paid", due: 100000, net: 100000, outstanding: 0 });
  });
  it("does not infer collection from PAID=1 without a receipt", () => {
    const f = fixture(); f.data.payments = [];
    expect(f.payment().status).toBe("unknown");
  });
  it("classifies unbilled charges as unpaid only with complete financial sources", () => {
    const f = fixture(); f.data.payments = []; f.data.charges[0].paid = "0"; f.data.charges[0].idttrv = "0";
    expect(f.payment()).toMatchObject({ status: "unpaid", due: 100000, net: 0, outstanding: 100000 });
    f.data.sections["payments:MISSING"] = false;
    expect(f.payment().status).toBe("unknown");
  });
  it("does not put a person without a visit/charge into unpaid", () => {
    const f = fixture(); f.data.visits = []; f.data.charges = []; f.data.payments = [];
    expect(f.payment()).toMatchObject({ status: "none", due: 0, net: 0, outstanding: 0 });
  });
  it("missing charge/visit data is unknown, not zero/no-charges", () => {
    const f = fixture(); f.data.charges = []; f.data.sections["charges:MISSING"] = false;
    expect(f.payment()).toMatchObject({ status: "unknown", due: null, net: null, outstanding: null });
  });
  it("calculates part-payment and combines a new unbilled charge", () => {
    const f = fixture(); f.bill.debt = "25000";
    f.data.charges.push({ ...f.data.charges[0], id: "2", paid: "0", idttrv: "0", amount: "50000" });
    expect(f.payment()).toMatchObject({ status: "partial", due: 150000, net: 75000, outstanding: 75000 });
  });
  it("excludes a verified waiver from both due and cash collection", () => {
    const f = fixture(); f.bill.waiver = "20000";
    expect(f.payment()).toMatchObject({ status: "paid", due: 80000, net: 80000 });
    f.bill.waiver = "100000";
    expect(f.payment()).toMatchObject({ status: "none", due: 0, net: 0 });
  });
  it("deferred receipts are not cash received", () => {
    const f = fixture(); f.bill.deferred = "1";
    expect(f.payment()).toMatchObject({ status: "unpaid", net: 0, outstanding: 100000 });
    expect(f.payment().notes.join(" ")).toContain("trả sau");
  });
  it.each(["refundamount", "refundcount", "refunded", "refunddetailamount"])("does not allocate ambiguous refund/cancel evidence: %s", key => {
    const f = fixture(); f.bill[key] = "1";
    expect(f.payment().status).toBe("unknown");
  });
  it.each(["headerdiscount", "linediscount", "supplies", "insurance", "extrawaiver", "unsettled"])("requires reconciliation for %s", key => {
    const f = fixture(); f.bill[key] = "1";
    expect(f.payment().status).toBe("unknown");
  });
  it("validates advance receipts, without counting an advance twice", () => {
    const f = fixture(); f.bill.kind = "SETTLEMENT"; f.bill.advance = "25000";
    expect(f.payment().status).toBe("unknown");
    f.bill.verifiedadvance = "25000";
    expect(f.payment()).toMatchObject({ status: "paid", net: 100000 });
  });
  it("requires a positive book/receipt number and handles negative cancelled receipts", () => {
    const f = fixture(); f.bill.number = "-1";
    expect(f.payment().status).toBe("unknown");
    f.bill.number = "1"; f.bill.book = "0";
    expect(f.payment().status).toBe("unknown");
  });
  it("refuses a receipt that includes unmapped/out-of-scope services", () => {
    const f = fixture(); f.bill.linecount = "2"; f.bill.gross = "200000";
    expect(f.payment().status).toBe("unknown");
  });
  it("requires the CN1 legacy bidirectional link when TABLE_X is blank", () => {
    const f = fixture(); f.bill.chargetable = null;
    expect(f.payment().status).toBe("paid");
    f.data.charges[0].idttrv = "502";
    expect(f.payment().status).toBe("unknown");
  });
  it("does not conflate same IDs from another month, service or patient", () => {
    for (const [key, value] of [["source", "OTHER"], ["serviceid", "999"], ["mabn", "OTHER-PATIENT"]]) {
      const f = fixture(); f.bill[key] = value;
      expect(f.payment().status).toBe("unknown");
    }
  });
  it("does not double-count duplicate join rows, or accept conflicting lines/headers", () => {
    const f = fixture(); f.data.payments.push({ ...f.bill });
    expect(f.payment().net).toBe(100000);
    f.data.payments[1].lineamount = "50000";
    expect(f.payment().status).toBe("unknown");
  });
  it("refuses double receipts for the same service", () => {
    const f = fixture(); f.data.payments.push({ ...f.bill, receiptid: "502", number: "22" });
    expect(f.payment().status).toBe("unknown");
  });
  it.each(["1e5", "NaN", "", "-1", "0.001", "9007199254740993"])("rejects unsafe financial values %s", value => {
    const f = fixture(); f.bill.gross = value;
    expect(f.payment().status).toBe("unknown");
  });
  it("compares decimal values with integer cents", () => {
    const f = fixture(); f.bill.gross = f.bill.linegross = f.bill.lineamount = f.data.charges[0].amount = "0.30"; f.bill.debt = "0.10";
    expect(f.payment()).toMatchObject({ status: "partial", due: 0.3, net: 0.2, outstanding: 0.1 });
  });
  it("dashboard counts unique membership keys and marks incomplete totals unknown", () => {
    const f = fixture(); f.data.members.push({ ...f.member });
    expect(paymentDashboard(f.data).counts).toEqual({ paid: 1, unpaid: 0, partial: 0, none: 0, unknown: 0 });
    f.data.sections.members = false;
    expect(Object.values(paymentDashboard(f.data).counts).every(v => v === null)).toBe(true);
  });
  it("does not allocate the same visit to two different member groups", () => {
    const f = fixture(); f.data.visits.push({ ...f.data.visits[0], groupid: "102" });
    expect(f.payment().status).toBe("unknown");
  });
  it("does not treat BHYT deductions or deferred advance payments as verified cash", () => {
    const f = fixture(); f.data.charges[0].madoituong = "1";
    expect(f.payment().status).toBe("unknown");
    f.data.charges[0].madoituong = "2"; f.bill.deferred = "1"; f.bill.advance = f.bill.verifiedadvance = "10000";
    expect(f.payment().status).toBe("unknown");
  });
});
