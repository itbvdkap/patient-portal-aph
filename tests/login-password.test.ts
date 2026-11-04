import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  lookup: vi.fn(),
  verify: vi.fn(),
  record: vi.fn(),
  access: vi.fn(),
}));
vi.mock("@/lib/account/portal-account", () => ({
  getPortalAccountByPhone: account.lookup,
  verifyPortalAccountPassword: account.verify,
  recordPortalPasswordLogin: account.record,
  portalAccountAccessError: account.access,
}));
vi.mock("@/lib/supabase/portal-sync", () => ({ enqueuePatientSync: vi.fn() }));
import { POST } from "@/app/api/auth/login-password/route";

const request = () =>
  new Request("https://example.invalid/api/auth/login-password", {
    method: "POST",
    body: JSON.stringify({
      phone: "0000000000",
      password: "synthetic-password",
    }),
  });

describe("password login availability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    account.access.mockReturnValue(null);
    account.lookup.mockResolvedValue(null);
  });

  it.each(["lookup", "verify", "record"] as const)(
    "fails closed when %s is unavailable without exposing upstream details",
    async (stage) => {
      account.verify.mockResolvedValue({ accountId: "fake-account" });
      account[stage].mockRejectedValue(
        new Error("exceed_egress_quota private-upstream-detail"),
      );
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const result = await POST(request());
        expect(result.status).toBe(503);
        expect(result.headers.get("set-cookie")).toBeNull();
        expect(result.headers.get("retry-after")).toBe("60");
        const body = await result.json();
        expect(body.error).toContain("tạm gián đoạn");
        expect(body.error).not.toContain("private-upstream-detail");
        expect(log).toHaveBeenCalledWith(
          "Patient password login service unavailable.",
        );
        if (stage !== "record") expect(account.record).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
    },
  );

  it("retains the invalid-password response when the database is available", async () => {
    account.verify.mockResolvedValue(null);
    const result = await POST(request());
    expect(result.status).toBe(401);
    expect(account.record).not.toHaveBeenCalled();
  });

  it("does not grant access to a locked account", async () => {
    account.access.mockReturnValue("Tài khoản đang tạm khóa.");
    const result = await POST(request());
    expect(result.status).toBe(403);
    expect(account.verify).not.toHaveBeenCalled();
    expect(account.record).not.toHaveBeenCalled();
  });

  it("issues a session after valid credentials and a successful session write", async () => {
    vi.stubEnv("PORTAL_SESSION_SECRET", "synthetic-login-test-secret");
    account.verify.mockResolvedValue({ accountId: "fake-account" });
    account.record.mockResolvedValue({ sessionId: "fake-session", accountKey: "fake-account", mabn: "", branchCode: "CN1", profiles: [] });
    try {
      const result = await POST(request());
      expect(result.status).toBe(200);
      expect(result.headers.get("set-cookie")).toContain("HttpOnly");
      expect((await result.json()).data.hasLinkedProfile).toBe(false);
      expect(account.record).toHaveBeenCalledOnce();
    } finally { vi.unstubAllEnvs(); }
  });
});
