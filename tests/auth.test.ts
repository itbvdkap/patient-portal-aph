import { describe, expect, it } from "vitest";
import { canRequestDemoOtp, verifyDemoOtp } from "@/lib/auth/demo-auth";

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
