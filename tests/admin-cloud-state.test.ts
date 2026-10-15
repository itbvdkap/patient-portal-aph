// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { cloudState, openCloudState, replaceCloudState, runCloudState, sealCloudState } from "@/lib/admin/cloud-state";

describe("encrypted admin cloud state", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("encrypts state and saves it with compare-and-swap", async () => {
    vi.stubEnv("ADMIN_DATA_MODE", "supabase");
    vi.stubEnv("ADMIN_CLOUD_STORE_SECRET", "s".repeat(48));
    rpc.mockResolvedValueOnce({ data: { revision: 0, payload: null }, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });

    await runCloudState("staff", { users: [] }, () => {
      expect(cloudState("staff")?.data).toEqual({ users: [] });
      replaceCloudState("staff", { users: [{ username: "staff1" }] });
    });

    const save = rpc.mock.calls[1][1];
    expect(save.p_revision).toBe(0);
    expect(save.p_payload).not.toContain("staff1");
    expect(openCloudState(save.p_payload)).toEqual({ users: [{ username: "staff1" }] });
  });

  it("fails closed on concurrent writes and a changed encryption key", async () => {
    vi.stubEnv("ADMIN_DATA_MODE", "supabase");
    vi.stubEnv("ADMIN_CLOUD_STORE_SECRET", "a".repeat(48));
    const encrypted = sealCloudState({ users: [] });
    rpc.mockResolvedValueOnce({ data: { revision: 1, payload: encrypted }, error: null });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(runCloudState("staff", {}, () => replaceCloudState("staff", { users: [1] }))).rejects.toThrow("thay đổi đồng thời");

    vi.stubEnv("ADMIN_CLOUD_STORE_SECRET", "b".repeat(48));
    expect(() => openCloudState(encrypted)).toThrow();
  });
});
