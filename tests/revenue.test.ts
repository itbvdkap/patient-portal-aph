// @vitest-environment node
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { revenueQuerySchema, revenueRows, revenueSummary, revenueComplete, filterRevenue, buildRevenueReport, type RevenueSnapshot } from "@/lib/revenue/domain";
import { reportXlsx } from "@/lib/ksk/report-export";
const scope = { reportType: "cashier" as const, version: 1 as const, mode: "his" as const, branch: "CN1" as const, from: "2026-10-01T08:00:00", to: "2026-10-01T17:00:00", asof: "2026-10-01T10:00:00Z", departmentPolicy: "receipt_header" as const, storagePolicy: "adjacent_months" as const };
const bill = (id: string, kind = "direct", gross = "100") => ({ source: "HGSOFT_BV1026.V_VIENPHILL", id, kind, occurredat: "2026-10-01T09:10:11", gross, insurance: "0", waiver: "0", debt: "0", advance: "0", discount: "0", deferred: "0", unsettled: "0", refunded: "0", linecount: "1", receiptno: id, book: "1", cashierid: "V:5", cashiername: "Thu ngân mẫu", departmentid: "V:01", departmentname: "Khoa mẫu" });
function sample(): RevenueSnapshot { return { scope, receipts: [bill("1")], sections: Object.fromEntries(["0926","1026","1126"].flatMap(m=>["direct", "settlement", "advance", "refund", "pharmacy"].map(k => [`HGSOFT_BV${m}:${k}`, true]))), warnings: [] }; }
const query = { from: scope.from, to: scope.to, cashier: "", department: "", kind: "" as const };
describe("Whole-hospital cash report", () => {
  it("rejects impossible dates, reversed times, timezone offsets and unbounded spans", () => {
    for (const change of [{from:"2026-02-30T01:00:00"},{to:"2026-10-01T07:59:59"},{to:"2026-11-01T08:00:00"},{from:scope.from+"Z"}]) expect(revenueQuerySchema.safeParse({...query,...change}).success).toBe(false);
    expect(revenueQuerySchema.safeParse(query).success).toBe(true);
  });
  it("deduplicates header receipts, subtracts deposits once, and refunds at the refund cashier", () => {
    const data=sample();data.receipts=[bill("1","advance","100"),{...bill("2","discharge","250"),advance:"100",insurance:"20",waiver:"10",debt:"5"}, {...bill("3","advance_refund","30"),cashierid:"V:6"}];
    data.receipts.push({...data.receipts[1]}); const rows=revenueRows(data);const total=revenueSummary(rows);
    expect(rows).toHaveLength(3);expect(rows[1].amount).toBe(115);expect(total.inflow).toBe(215);expect(total.outflow).toBe(-30);expect(total.net).toBe(185);
    expect(filterRevenue(rows,{...query,cashier:"V:6"})[0].amount).toBe(-30);
  });
  it("does not use cohort/registration evidence and separates pharmacy cashier IDs", () => {
    const data=sample();data.receipts.push({...bill("1","pharmacy","50"),source:"HGSOFT_BVD1026.D_NGTRULL",cashierid:"D:5",departmentid:"D:01",receiptno:"0",prescriptionno:"11"});
    const rows=revenueRows(data);expect(revenueSummary(rows).net).toBe(150);expect(filterRevenue(rows,{...query,department:"D:01"})).toHaveLength(1);
    expect(filterRevenue(rows,{...query,kind:"pharmacy"})).toHaveLength(1);
  });
  it("does not subtract deposits twice when HIS refunded the deposit and collected the full discharge bill", () => {
    const data=sample();data.receipts=[bill("1","advance","300"), {...bill("2","discharge","100"),advance:"300",returnedadvance:"300"},bill("3","advance_refund","300")];
    const rows=revenueRows(data);expect(rows[1].amount).toBe(100);expect(revenueSummary(rows).net).toBe(100);expect(revenueSummary(rows).unknown).toBe(0);
    data.receipts[1].returnedadvance="200";expect(revenueRows(data)[1].amount).toBeNull();
  });
  it("keeps conflicting, malformed, unclassified and extra-discount receipts unresolved", () => {
    for(const change of [{gross:"NaN"},{gross:"1e6"},{gross:"9007199254740992"},{kind:"unclassified"},{discount:"5"},{extrawaiver:"1"},{occurredat:"2026-09-30T09:00:00"},{receiptno:"0"}]) {
      const data=sample();data.receipts=[{...bill("1"),...change}];expect(revenueRows(data)[0].amount).toBeNull();expect(revenueSummary(revenueRows(data)).unknown).toBe(1);
    }
    const data=sample();data.receipts.push({...bill("1"),gross:"99"});expect(revenueRows(data)[0].amount).toBeNull();
  });
  it("retains historical receipts that were refunded later and shows deferred as zero cash", () => {
    const data=sample();data.receipts=[{...bill("1"),refunded:"1"},{...bill("2"),deferred:"1"}];const rows=revenueRows(data);
    expect(rows[0].amount).toBe(100);expect(rows[0].notes.join()).toContain("ngày");expect(rows[1].amount).toBe(0);
  });
  it("requires every source and every requested month before calling a report complete", () => {
    const data=sample();expect(revenueComplete(data)).toBe(true);data.sections["HGSOFT_BV1026:pharmacy"]=false;expect(revenueComplete(data)).toBe(false);
    data.sections["HGSOFT_BV1026:pharmacy"]=true;data.scope={...data.scope,to:"2026-11-01T01:00:00"};expect(revenueComplete(data)).toBe(false);
  });
  it("exports summary and all filtered receipts with literal Excel strings and numeric money", async () => {
    const data=sample();data.receipts[0].cashiername='=HYPERLINK("https://invalid")';const rows=revenueRows(data);
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await reportXlsx(buildRevenueReport(data,rows,query)) as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("Chi tiết phiếu")?.getCell("K2").value).toBe(100);
    expect(workbook.getWorksheet("Tổng hợp theo thu ngân")?.getCell("B2").type).toBe(ExcelJS.ValueType.String);
    expect(workbook.getWorksheet("Chi tiết phiếu")?.rowCount).toBe(2);
  });
});
