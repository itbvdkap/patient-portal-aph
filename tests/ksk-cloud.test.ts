// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
const maybeSingle = vi.fn();
const eqBranch = vi.fn(() => ({ maybeSingle }));
const eqId = vi.fn(() => ({ eq: eqBranch }));
const select = vi.fn(() => ({ eq: eqId }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({ rpc, from: () => ({ select }) }),
}));

import { createKskRepository } from "@/lib/ksk/repository";
import { demoKskSnapshot } from "@/lib/ksk/sample";

const query = { from: "2026-10-01", to: "2026-10-14", cohort: "900001" };

describe("KSK Supabase outbound queue", () => {
  beforeEach(() => {
    vi.stubEnv("KSK_ENABLED", "true");
    vi.stubEnv("KSK_DATA_MODE", "supabase");
    vi.stubEnv("KSK_MANAGEMENT_BRANCH", "CN1");
    vi.stubEnv("VERCEL", "1");
    rpc.mockResolvedValue({ data: "75c7f4a8-970a-4477-a57f-af89d1590c3d", error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("reads verified HIS data on Vercel without an Oracle URL", async () => {
    const snapshot = demoKskSnapshot(query);
    snapshot.scope = { ...snapshot.scope, mode: "his", branch: "CN1" };
    maybeSingle.mockResolvedValue({ data: { status: "done", result: snapshot, expires_at: "2099-01-01T00:00:00Z" }, error: null });

    await expect(createKskRepository().read(query)).resolves.toMatchObject({ scope: { branch: "CN1", mode: "his" } });
    expect(rpc).toHaveBeenCalledWith("portal_ksk_enqueue", expect.objectContaining({ p_branch: "CN1", p_operation: "report" }));
  });

  it("rejects detail rows when the requested cohort is absent", async () => {
    const snapshot = demoKskSnapshot(query);
    snapshot.scope = { ...snapshot.scope, mode: "his", branch: "CN1" };
    snapshot.cohorts = [];
    maybeSingle.mockResolvedValue({ data: { status: "done", result: snapshot, expires_at: "2099-01-01T00:00:00Z" }, error: null });

    await expect(createKskRepository().read(query)).rejects.toThrow("Không có đợt tương ứng");
  });
});
