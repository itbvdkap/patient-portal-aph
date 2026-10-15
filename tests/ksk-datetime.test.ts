import { describe, expect, it } from "vitest";
import { formatHisDateTime } from "@/lib/ksk/datetime";

describe("HIS local date/time presentation", () => {
  it("shows day/month/year and every source time component without timezone conversion", () => {
    expect(formatHisDateTime("2026-10-14T08:35:42")).toBe("14/10/2026 08:35:42");
    expect(formatHisDateTime("2026-10-14T00:00:00")).toBe("14/10/2026 00:00:00");
    expect(formatHisDateTime("2026-12-31 23:59:59")).toBe("31/12/2026 23:59:59");
  });
  it("does not invent a time or seconds when the source omits them", () => {
    expect(formatHisDateTime("2026-10-14")).toBe("14/10/2026 (chưa có giờ)");
    expect(formatHisDateTime("2026-10-14T08:35")).toBe("14/10/2026 08:35 (chưa có giây)");
    for (const value of [null, undefined, "", "   "]) expect(formatHisDateTime(value)).toBe("Chưa xác định");
  });
  it("rejects invalid calendars, invalid times and UTC instants rather than shifting or normalizing them", () => {
    for (const value of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "0000-01-01", "2026-10-14T24:00:00", "2026-10-14T08:60:00", "2026-10-14T08:30:60", "2026-10-14T08:35:42Z", "2026-10-14T08:35:42+07:00", "invalid"])
      expect(formatHisDateTime(value), value).toBe("Ngày giờ nguồn không hợp lệ");
    expect(formatHisDateTime("2024-02-29T12:03:04")).toBe("29/02/2024 12:03:04");
    expect(formatHisDateTime("2100-02-29")).toBe("Ngày giờ nguồn không hợp lệ");
    expect(formatHisDateTime("2000-02-29")).toBe("29/02/2000 (chưa có giờ)");
  });
});
