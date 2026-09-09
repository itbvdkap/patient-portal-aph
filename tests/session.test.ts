import { describe, expect, it } from "vitest";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { createPatientSessionCookie, getDemoPatientSession } from "@/lib/auth/session";

function makeCookies(value?: string) {
  return {
    [Symbol.iterator]: function* () {
      if (value !== undefined) yield [demoSessionCookie, { name: demoSessionCookie, value }] as const;
    },
    size: value === undefined ? 0 : 1,
    get(name: string) {
      if (name !== demoSessionCookie || value === undefined) {
        return undefined;
      }

      return { name, value };
    },
    getAll() {
      return value === undefined ? [] : [{ name: demoSessionCookie, value }];
    },
    has(name: string) {
      return name === demoSessionCookie && value !== undefined;
    },
  } as Parameters<typeof getDemoPatientSession>[0];
}

describe("patient session", () => {
  it("returns the signed patient session when the session cookie is valid", () => {
    process.env.PORTAL_SESSION_SECRET = "test-session-secret";
    const cookieValue = createPatientSessionCookie("23006552", 60);

    expect(getDemoPatientSession(makeCookies(cookieValue))).toMatchObject({
      patientId: "his-CN1-23006552",
      userId: "patient-23006552",
      mabn: "23006552",
      branchCode: "CN1",
      profiles: [{ mabn: "23006552", branchCode: "CN1", patientId: "his-CN1-23006552" }],
    });
  });

  it("rejects missing or invalid session cookies", () => {
    expect(getDemoPatientSession(makeCookies())).toBeNull();
    expect(getDemoPatientSession(makeCookies("false"))).toBeNull();
  });
});
