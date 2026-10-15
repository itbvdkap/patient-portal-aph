// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chargeTotal, cohortCompanyKey, cohortSupportKey, cohortSupportLabel, filterCohorts, concluded, defaultKskQuery, memberRecords, querySchema, sectionComplete, snapshotSchema, summarize } from "@/lib/ksk/domain";
import { demoKskSnapshot } from "@/lib/ksk/sample";

const query = { from: "2026-10-01", to: "2026-10-14", cohort: "900001" };
const sample = () => demoKskSnapshot(query);
describe("KSK read-only domain", () => {
  it("validates synthetic contract and distinct progress axes", () => {
    const data = snapshotSchema.parse(sample());
    expect(summarize(data)).toEqual({ expected: 3, registered: 2, withResults: 1, concluded: 1, amount: 250000 });
  });
  it("fails closed when a modern agent omits episode evidence and excludes foreign/mirror costs", () => {
    const data = sample(); data.charges.push({ ...data.charges[0], id: "mirror", mavaovien: "0" }, { ...data.charges[0], id: "foreign", mavaovien: "999" });
    expect(summarize(data).amount).toBe(250000);
    delete data.charges[0].mavaovien; expect(snapshotSchema.safeParse(data).success).toBe(false);
    delete data.scope.episodePolicy; expect(snapshotSchema.safeParse(data).success).toBe(true); expect(summarize(data).amount).toBeNull();
  });
  it("does not multiply service cost by analyte count or duplicate charge rows", () => {
    const data = sample();
    data.charges.push({ ...data.charges[0] });
    data.labs.push({ ...data.labs[0], parameterid: "3" });
    expect(summarize(data).amount).toBe(250000);
  });
  it("preserves source/month identity for directive IDs", () => {
    const data = sample();
    data.charges.push({ ...data.charges[0], source: "OTHER_MONTH" });
    expect(chargeTotal(data.charges)).toBe(350000);
  });
  it("does not attach old results from another visit with the same patient code", () => {
    const data = sample();
    data.labs.push({ ...data.labs[0], maql: "old" });
    expect(memberRecords(data, data.members[0]).labs).toHaveLength(2);
  });
  it("separates the same patient enrolled in another group", () => {
    const data = sample();
    expect(memberRecords(data, { ...data.members[0], groupid: "999" }).visits).toHaveLength(0);
  });
  it("uses episode ID for clinical results instead of assuming MAQL equals episode", () => {
    const data = sample();
    data.visits[0].episodeid = "555";
    data.clinical[0].episodeid = "555";
    expect(concluded(memberRecords(data, data.members[0]).clinical)).toBe(true);
  });
  it("does not count initialized blank summary rows as conclusions", () => {
    expect(concluded([{ kind: "BASK_TONGKET", mabs: "", ketluan: "" }])).toBe(false);
    expect(concluded([{ kind: "BASK_TONGKET", mabs: "BS", ketluan: " " }])).toBe(false);
  });
  it("reports unknown rather than zero on a missing monthly visits source", () => {
    const data = sample(); data.sections["visits:MISSING"] = false;
    expect(sectionComplete(data, "visits")).toBe(false);
    expect(summarize(data).registered).toBeNull();
    expect(summarize(data).amount).toBeNull();
  });
  it("reports unknown when member list or a result source is incomplete", () => {
    const data = sample(); data.sections.members = false;
    expect(summarize(data).registered).toBeNull();
    data.sections.members = true; data.sections.labs = false;
    expect(summarize(data).withResults).toBeNull();
  });
  it("does not depend on unrelated specialty availability to count conclusions", () => {
    const data = sample(); data.sections["clinical:MISSING.BASK_SANPHU"] = false;
    expect(summarize(data).concluded).toBe(1);
    data.sections["conclusions:MISSING"] = false;
    expect(summarize(data).concluded).toBeNull();
  });
  it("refuses invalid, missing or unsafe monetary amounts", () => {
    expect(chargeTotal([{ source: "a", id: "1", amount: "" }])).toBeNull();
    expect(chargeTotal([{ source: "a", id: "1", amount: "1e8" }])).toBeNull();
    expect(chargeTotal([{ source: "a", id: "1", amount: "999999999999999999" }])).toBeNull();
    expect(chargeTotal([{ source: "a", id: "1", amount: "10" }, { source: "a", id: "1", amount: "11" }])).toBeNull();
  });
  it("bounds date ranges and rejects injections/invalid dates", () => {
    expect(querySchema.safeParse(query).success).toBe(true);
    for (const invalid of [{ from: "2026-02-30" }, { to: "2027-10-14" }, { cohort: "1 or 1=1" }, { to: "2026-09-30" }])
      expect(querySchema.safeParse({ ...query, ...invalid }).success).toBe(false);
  });
  it("uses Vietnam calendar date at UTC date boundaries", () => {
    expect(defaultKskQuery(new Date("2026-10-13T18:00:00Z")).to).toBe("2026-10-14");
  });
  it("uses the full HIS note, not creator, contact or cohort name, as CSKH label", () => {
    const row = { ghichu: " Chị A\nCSKH khu vực 1 ", userid: "10", nguoilienhe: "Khách hàng B", name: "Đoàn (Người C)" };
    expect(cohortSupportLabel(row)).toBe("Chị A\nCSKH khu vực 1");
    expect(cohortSupportKey(row)).toBe("note:Chị A CSKH khu vực 1");
    expect(row.ghichu).toBe(" Chị A\nCSKH khu vực 1 ");
  });
  it("separates blank notes from missing fields and never infers a staff name", () => {
    expect(cohortSupportKey({ ghichu: null })).toBe("blank");
    expect(cohortSupportLabel({ ghichu: " \n " })).toBe("Chưa ghi phụ trách");
    expect(cohortSupportKey({ userid: "1" })).toBe("unknown");
    expect(cohortSupportLabel({})).toBe("Chưa đọc được ghi chú");
  });
  it("filters notes by whole label, tolerating whitespace without substring guesses", () => {
    const rows = [{ id: "1", ghichu: "CSKH A\nnhóm 1" }, { id: "2", ghichu: "CSKH A nhóm 1" }, { id: "3", ghichu: "CSKH A" }];
    expect(filterCohorts(rows, "", "note:CSKH A nhóm 1").map(r => r.id)).toEqual(["1", "2"]);
    expect(filterCohorts(rows, "", "note:CSKH A").map(r => r.id)).toEqual(["3"]);
  });
  it("combines company and CSKH filters and keeps same-name customers separate by ID", () => {
    const rows = [{ id: "1", customerid: "11", customer: "Công ty A", ghichu: "CSKH mẫu" },
      { id: "2", customerid: "12", customer: "Công ty A", ghichu: "CSKH mẫu" },
      { id: "3", customerid: "11", customer: "Công ty A", ghichu: null }];
    expect(cohortCompanyKey(rows[0])).not.toBe(cohortCompanyKey(rows[1]));
    expect(filterCohorts(rows, "id:11", "note:CSKH mẫu").map(r => r.id)).toEqual(["1"]);
    expect(filterCohorts(rows, "id:11", "blank").map(r => r.id)).toEqual(["3"]);
  });
});
