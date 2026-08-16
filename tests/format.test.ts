import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/utils/format";

describe("visit formatting", () => {
  it("formats Vietnamese date strings", () => {
    expect(formatDate("2026-08-12T08:30:00+07:00")).toBe("12/08/2026");
    expect(formatDateTime("2026-08-12T08:30:00+07:00")).toContain("12/08/2026");
  });
});
