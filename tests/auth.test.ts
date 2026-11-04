import { beforeEach, describe, expect, it, vi } from "vitest";
import { canRequestDemoOtp, verifyDemoOtp } from "@/lib/auth/demo-auth";
import {
  getPortalAccountByPhone,
  verifyPortalAccountPassword,
} from "@/lib/account/portal-account";

const accountStore = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: accountStore.read }) }),
    }),
  }),
}));

describe("demo authentication", () => {
  it("accepts demo phone and OTP", () => {
    expect(canRequestDemoOtp("0901234567")).toBe(true);
    expect(verifyDemoOtp("0901234567", "123456")).toBe(true);
  });

  it("rejects wrong patient or OTP", () => {
    expect(canRequestDemoOtp("000000")).toBe(false);
    expect(verifyDemoOtp("23006552", "000000")).toBe(false);
  });
});

describe("account lookup during service outages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("distinguishes an unavailable account store from an unknown account", async () => {
    accountStore.read.mockResolvedValue({
      data: null,
      error: { message: "exceed_egress_quota" },
    });
    await expect(getPortalAccountByPhone("0000000000", { failOnReadError: true })).rejects.toThrow(
      "Account lookup unavailable.",
    );
    await expect(
      verifyPortalAccountPassword("0000000000", "synthetic-password"),
    ).rejects.toThrow("Password verification unavailable.");
    accountStore.read.mockResolvedValue({ data: null, error: null });
    await expect(getPortalAccountByPhone("0000000000")).resolves.toBeNull();
    await expect(
      verifyPortalAccountPassword("0000000000", "synthetic-password"),
    ).resolves.toBeNull();
  });
});
