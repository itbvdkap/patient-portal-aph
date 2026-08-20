import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/utils/format";
import { normalizeDisplayText } from "../packages/patient-domain/src/format";

describe("visit formatting", () => {
  it("formats Vietnamese date strings", () => {
    expect(formatDate("2026-08-12T08:30:00+07:00")).toBe("12/08/2026");
    expect(formatDateTime("2026-08-12T08:30:00+07:00")).toContain("12/08/2026");
  });

  it("normalizes Vietnamese combining marks from legacy HIS text", () => {
    expect(normalizeDisplayText("b\u0301nh thường")).toBe("bình thường");
    expect(normalizeDisplayText("B\u0300NH THƯỜNG")).toBe("BÌNH THƯỜNG");
    expect(normalizeDisplayText(undefined)).toBe("");
  });
});
