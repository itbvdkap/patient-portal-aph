import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  errors: new Set<string>(),
  count: 0 as number | null,
  throws: false,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => ({
      select: (_columns: string, options?: { count?: string }) => {
        if (store.throws) throw new Error("private-connection-detail");
        const result = {
          error: store.errors.has(table)
            ? { message: "exceed_egress_quota private-detail" }
            : null,
          data: [],
          count: store.count,
        };
        if (options?.count) {
          const query = Object.assign(Promise.resolve(result), {
            is: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          });
          return query;
        }
        return { order: () => ({ limit: () => Promise.resolve(result) }) };
      },
    }),
  }),
}));
vi.mock("pg", () => ({ Pool: vi.fn() }));
import { getAdminDashboardData } from "@/lib/admin/dashboard";

describe("admin overview read failures", () => {
  beforeEach(() => {
    store.errors.clear();
    store.count = 0;
    store.throws = false;
    vi.stubEnv("BOOKING_DATABASE_URL", "");
  });

  it("preserves real zero counts and marks an unconfigured booking source unknown", async () => {
    const result = await getAdminDashboardData();
    expect(result.metrics[0].value).toBe("0");
    expect(result.metrics[0].hint).not.toBe("Chưa đọc được");
    expect(result.metrics.at(-1)).toMatchObject({
      value: "—",
      hint: "Chưa đọc được",
      tone: "slate",
    });
  });

  it("keeps partial failures separate from successful sources and recovers on a later read", async () => {
    store.errors.add("portal_accounts");
    const result = await getAdminDashboardData();
    expect(result.metrics[0]).toMatchObject({
      value: "—",
      hint: "Chưa đọc được",
      tone: "slate",
    });
    expect(result.metrics[1].value).toBe("0");
    expect(result.unavailableSources).toContain("portal_accounts");
    expect(result.warnings.join(" ")).not.toMatch(
      /private-detail|exceed_egress_quota/,
    );
    store.errors.clear();
    store.count = 12;
    const recovered = await getAdminDashboardData();
    expect(recovered.metrics[0].value).toBe("12");
    expect(recovered.unavailableSources).not.toContain("portal_accounts");
  });

  it("does not display green or zero when all cloud reads throw", async () => {
    store.throws = true;
    const result = await getAdminDashboardData();
    expect(
      result.metrics.every(
        (metric) => metric.value === "—" && metric.tone === "slate",
      ),
    ).toBe(true);
    expect(result.unavailableSources).toContain("portal_sync_jobs");
  });

  it("does not convert a missing count into zero", async () => {
    store.count = null;
    const result = await getAdminDashboardData();
    expect(result.metrics[0].value).toBe("—");
    expect(result.unavailableSources).toContain("portal_accounts");
  });
});
