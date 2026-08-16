import { describe, expect, it } from "vitest";
import { MockPatientRepository, currentDemoPatientId } from "@/lib/data/mock-patient-repository";

describe("patient repository", () => {
  const repository = new MockPatientRepository();

  it("returns demo patient visits only for the requested patient", async () => {
    const visits = await repository.getVisits(currentDemoPatientId);
    expect(visits).toHaveLength(6);
    expect(visits.every((visit) => visit.patientId === currentDemoPatientId)).toBe(true);
  });

  it("prevents cross-patient visit detail access", async () => {
    await expect(repository.getVisitDetail("other-patient", "v-20260812")).resolves.toBeNull();
  });
});
