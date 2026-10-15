import { describe, expect, it } from "vitest";
import { demoKskSnapshot } from "@/lib/ksk/sample";
import { collectionQuerySchema, collectionRows, collectionSummary, filterCollections, buildCollectionReport } from "@/lib/ksk/collections";
import { reportPrintHtml } from "@/lib/ksk/report-export";
const query = { from: "2026-10-01", to: "2026-10-14", collectedFrom: "2026-10-01", collectedTo: "2026-10-14", company: "", support: "", cashier: "", status: "" as const };
function fixture() {
  const data = demoKskSnapshot({ from: query.from, to: query.to, cohort: "900001" });
  data.scope = { ...data.scope, collections: true, collectedFrom: query.collectedFrom, collectedTo: query.collectedTo };
  data.members = [{ ...data.members[0], cohortid: "900001" }]; data.visits = [{ ...data.visits[0], cohortid: "900001", registereddate: "2026-10-01T08:00:00" }];
  data.charges = [{ ...data.charges[0], paid: "1", idttrv: "501" }];
  data.payments = [{ source: "DEMO", kind: "DIRECT", receiptid: "501", mabn: "DEMO001", maql: "1001", mavaovien: "1001", linequantity: "1", lineprice: "100000", book: "9", number: "21", date: "2026-10-05T09:00:00", cashierid: "7", cashiername: "Thu ngân mẫu",
    deferred: "0", refunded: "0", headerdiscount: "0", gross: "100000", waiver: "0", debt: "0", insurance: "0", advance: "0", verifiedadvance: "0",
    linegross: "100000", supplies: "0", linecount: "1", refundamount: "0", refundcount: "0", refunddate: null, refunddetailamount: "0", extrawaiver: "0", unsettled: "0",
    lineid: "1", chargeid: "1", chargetable: "V_CHIDINH", serviceid: "1", lineamount: "100000", linediscount: "0" }];
  return data;
}
describe("Global KSK collections: receipt date, not patient paid flag", () => {
  it("includes a verified episode-0 header but excludes a positive foreign-episode header", () => {
    const data = fixture(); data.payments[0].mavaovien = "0";
    expect(collectionRows(data)[0]).toMatchObject({ status: "received", received: 100000 });
    data.payments[0].mavaovien = "999"; expect(collectionRows(data)).toHaveLength(0);
  });
  it("does not approve a receipt referencing a directive with episode 0", () => {
    const data = fixture(); data.payments[0].mavaovien = "0"; data.charges[0].mavaovien = "0";
    expect(collectionRows(data)[0].received).toBeNull();
  });
  it("separates registration and collection dates; deduplicates full receipt lines", () => {
    const data = fixture(); data.payments.push({ ...data.payments[0] });
    const rows = collectionRows(data); expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ received: 100000, status: "received", registered: ["2026-10-01T08:00:00"], cashierId: "7", companyId: "900" });
    expect(collectionSummary(data, rows)).toMatchObject({ complete: true, count: 1, received: 100000 });
    expect(filterCollections(rows, data, { ...query, collectedFrom: "2026-10-06" })).toHaveLength(0);
  });
  it("filters independently by company, full HIS support note, cashier and status", () => {
    const data = fixture(), rows = collectionRows(data);
    expect(filterCollections(rows, data, { ...query, company: "900", support: "900001", cashier: "7", status: "received" })).toHaveLength(1);
    for (const filter of [{ company: "901" }, { support: "900002" }, { cashier: "8" }, { status: "unknown" as const }]) expect(filterCollections(rows, data, { ...query, ...filter })).toHaveLength(0);
  });
  it("does not count prior applied advances again on the receipt date", () => {
    const data = fixture(); Object.assign(data.payments[0], { kind: "SETTLEMENT", advance: "25000", verifiedadvance: "25000" });
    expect(collectionRows(data)[0].received).toBe(75000);
    data.payments[0].verifiedadvance = "0"; expect(collectionRows(data)[0].received).toBeNull();
  });
  it("does not count deferred, cancelled or refunded receipts as collected cash", () => {
    const data = fixture(); data.payments[0].deferred = "1";
    expect(collectionRows(data)[0]).toMatchObject({ status: "deferred", received: 0 });
    data.payments[0].deferred = "0"; data.payments[0].refundamount = "10000";
    expect(collectionRows(data)[0]).toMatchObject({ status: "unknown", received: null });
    expect(collectionSummary(data, collectionRows(data)).received).toBe(0);
  });
  it("does not double-count multiple receipts linked to one directive", () => {
    const data = fixture(); data.payments.push({ ...data.payments[0], receiptid: "502", number: "22" });
    const rows = collectionRows(data); expect(rows).toHaveLength(2); expect(rows.every(r => r.received === null)).toBe(true);
  });
  it("requires exact patient/cohort/registration mapping and consistent cashier identity", () => {
    for (const mutate of [(d: ReturnType<typeof fixture>) => d.members[0].mabn = "OTHER", (d: ReturnType<typeof fixture>) => d.visits[0].registereddate = null,
      (d: ReturnType<typeof fixture>) => d.cohorts = [], (d: ReturnType<typeof fixture>) => d.payments.push({ ...d.payments[0], cashierid: "8" })]) {
      const data = fixture(); mutate(data); expect(collectionRows(data)[0].received).toBeNull();
    }
  });
  it("never turns missing/truncated sections into a complete total", () => {
    const data = fixture(); data.sections["payments:MISSING"] = false;
    expect(collectionSummary(data, collectionRows(data))).toMatchObject({ complete: false, count: null, received: null });
    expect(() => buildCollectionReport(data, collectionRows(data), query)).toThrow("chưa đầy đủ");
  });
  it("rejects conflicting directive rows instead of silently choosing one", () => {
    const data = fixture(); data.charges.push({ ...data.charges[0], amount: "200000" });
    expect(collectionRows(data)[0].received).toBeNull();
  });
  it("exports all filtered receipts and provides a printable narrow sheet", () => {
    const data = fixture(), report = buildCollectionReport(data, collectionRows(data), query);
    expect(report.sheets[0].rows).toHaveLength(1); expect(report.sheets[0].headers).toContain("Ngày giờ đăng ký (HIS)"); expect(report.sheets[0].headers).toContain("Ngày giờ thu (HIS)");
    expect(report.sheets[0].rows[0].slice(6, 8)).toEqual(["01/10/2026 08:00:00", "05/10/2026 09:00:00"]);
    expect(report.sheets[1].rows[0].slice(4, 6)).toEqual(["01/10/2026 08:00:00", "05/10/2026 09:00:00"]);
    expect(reportPrintHtml(report, 1)).toContain("Thu ngân mẫu");
    expect(reportPrintHtml(report, 1)).toContain("05/10/2026 09:00:00");
    expect(report.warnings.join(" ")).toContain("tạm ứng");
  });
  it("validates calendar dates, bounded ranges and identifier filters", () => {
    expect(collectionQuerySchema.safeParse(query).success).toBe(true);
    expect(collectionQuerySchema.safeParse({ ...query, collectedTo: "2027-01-01" }).success).toBe(true); // Exactly 93 inclusive days.
    for (const patch of [{ from: "2026-02-30" }, { collectedTo: "2027-01-02" }, { collectedFrom: "2026-01-01", collectedTo: "2026-01-10" }, { cashier: "7 OR 1=1" }, { company: "free text" }])
      expect(collectionQuerySchema.safeParse({ ...query, ...patch }).success, JSON.stringify(patch)).toBe(false);
  });
});
