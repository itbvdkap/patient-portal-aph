import { describe, expect, it } from "vitest";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { createPatientSessionCookie, getDemoPatientSession } from "@/lib/auth/session";

function makeCookies(value?: string) {
  return {
    get(name: string) {
      if (name !== demoSessionCookie || value === undefined) {
        return undefined;
      }

      return { name, value };
    },
  };
}

describe("patient session", () => {
  it("returns the signed patient session when the session cookie is valid", () => {
    process.env.PORTAL_SESSION_SECRET = "test-session-secret";
    const cookieValue = createPatientSessionCookie("23006552", 60);

    expect(getDemoPatientSession(makeCookies(cookieValue))).toMatchObject({
      patientId: "his-23006552",
      userId: "patient-23006552",
      mabn: "23006552",
      profiles: [{ mabn: "23006552", patientId: "his-23006552" }],
    });
  });

  it("rejects missing or invalid session cookies", () => {
    expect(getDemoPatientSession(makeCookies())).toBeNull();
    expect(getDemoPatientSession(makeCookies("false"))).toBeNull();
  });
});
