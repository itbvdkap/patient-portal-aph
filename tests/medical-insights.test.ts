import { describe, expect, it } from "vitest";
import { buildLabTrendSeries, buildVisitClinicalMarkers, isPotentiallyAbnormalImaging } from "@/lib/medical/insights";
import type { ImagingResult, LabResult } from "@/types/patient";

describe("medical insights", () => {
  it("counts lab orders, imaging, and abnormal markers per visit", () => {
    const labs: LabResult[] = [
      { id: "l1", visitId: "v1", serviceName: "Sinh hóa", testName: "Glucose", result: 9.1, unit: "mmol/L", referenceRange: "3.9 - 6.4", performedAt: "2026-08-01T08:00:00+07:00", flag: "Cao" },
      { id: "l2", visitId: "v1", serviceName: "Sinh hóa", testName: "Creatinine", result: 80, unit: "umol/L", referenceRange: "60 - 110", performedAt: "2026-08-01T08:00:00+07:00", flag: "Bình thường" },
      { id: "l3", visitId: "v1", serviceName: "Huyết học", testName: "RBC", result: 4.2, unit: "T/L", referenceRange: "4 - 5", performedAt: "2026-08-01T08:15:00+07:00", flag: "Bình thường" },
    ];
    const imaging: ImagingResult[] = [
      { id: "i1", visitId: "v1", date: "2026-08-01T09:00:00+07:00", techniqueName: "Siêu âm", doctorName: "", description: "", conclusion: "Gan nhiễm mỡ độ I" },
    ];

    const marker = buildVisitClinicalMarkers(labs, imaging).get("v1");

    expect(marker?.labOrderCount).toBe(2);
    expect(marker?.abnormalLabCount).toBe(1);
    expect(marker?.imagingCount).toBe(1);
    expect(marker?.abnormalImagingCount).toBe(1);
  });

  it("treats reassuring imaging conclusion as non-abnormal", () => {
    expect(isPotentiallyAbnormalImaging("Điện tim bình thường")).toBe(false);
    expect(isPotentiallyAbnormalImaging("Trong giới hạn bình thường.")).toBe(false);
    expect(isPotentiallyAbnormalImaging("Không thấy tổn thương cấp tính trên phim.")).toBe(false);
    expect(isPotentiallyAbnormalImaging("Chưa phát hiện khối choán chỗ bất thường.")).toBe(false);
    expect(isPotentiallyAbnormalImaging("Gan nhiễm mỡ độ I.")).toBe(true);
  });

  it("builds tracked lab trend series from repeated or abnormal values", () => {
    const labs: LabResult[] = [
      { id: "l1", visitId: "v1", testName: "Glucose", result: "7.1", unit: "mmol/L", referenceRange: "", performedAt: "2026-01-01T08:00:00+07:00", flag: "Cao" },
      { id: "l2", visitId: "v2", testName: "Glucose", result: "6.2", unit: "mmol/L", referenceRange: "", performedAt: "2026-02-01T08:00:00+07:00", flag: "Bình thường" },
    ];

    const trends = buildLabTrendSeries(labs);

    expect(trends[0]?.key).toBe("glucose");
    expect(trends[0]?.points).toHaveLength(2);
    expect(trends[0]?.abnormalCount).toBe(1);
  });
});
