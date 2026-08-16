import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiPatientRepository } from "@/lib/data/api-patient-repository";

describe("api patient repository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses /api/me endpoints and does not send patient id in list routes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response);

    const repository = new ApiPatientRepository("https://patient-api.example.test", "server-token");
    await repository.getVisits("patient-id-from-ui");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://patient-api.example.test/api/me/visits",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer server-token",
        }),
      }),
    );
  });

  it("returns null for missing visit detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Resource not found." }),
    } as Response);

    const repository = new ApiPatientRepository("https://patient-api.example.test");
    await expect(repository.getVisitDetail("current-patient", "missing")).resolves.toBeNull();
  });
});
