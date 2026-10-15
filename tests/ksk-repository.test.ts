// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createKskRepository } from "@/lib/ksk/repository";
import { demoKskSnapshot } from "@/lib/ksk/sample";

const query = { from: "2026-10-01", to: "2026-10-14", cohort: "900001" };
function configure() {
  vi.stubEnv("KSK_ENABLED", "true"); vi.stubEnv("KSK_DATA_MODE", "his"); vi.stubEnv("VERCEL", "");
  vi.stubEnv("KSK_API_BASE_URL", "http://127.0.0.1:5080"); vi.stubEnv("KSK_API_SERVER_TOKEN", "x".repeat(32));
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("KSK repository security", () => {
  it("is disabled by default", () => { vi.stubEnv("KSK_ENABLED", "false"); expect(() => createKskRepository()).toThrow("chưa bật"); });
  it("blocks Vercel and non-loopback plaintext credentials", () => {
    configure(); vi.stubEnv("VERCEL", "1"); expect(() => createKskRepository()).toThrow("nội bộ");
    vi.stubEnv("VERCEL", ""); vi.stubEnv("KSK_API_BASE_URL", "http://192.168.50.250");
    expect(() => createKskRepository()).toThrow("HTTPS");
  });
  it("never falls back to fixture data on HIS failure", async () => {
    configure(); vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("secret connection string"));
    await expect(createKskRepository().read(query)).rejects.toThrow("Không kết nối");
  });
  it("requires a separate staff credential", () => {
    configure(); vi.stubEnv("KSK_API_SERVER_TOKEN", ""); vi.stubEnv("PATIENT_API_SERVER_TOKEN", "patient-token");
    expect(() => createKskRepository()).toThrow("token riêng");
  });
  it("uses no-store, disallows redirects and keeps the token out of URL", async () => {
    configure(); const data = demoKskSnapshot(query); data.scope.mode = "his";
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => data } as Response);
    await createKskRepository().read(query);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).not.toContain("xxxxxxxx");
    expect(init).toMatchObject({ cache: "no-store", redirect: "error", headers: { "X-Ksk-Token": "x".repeat(32) } });
  });
  it("refuses malformed, wrong-cohort and mock upstream responses", async () => {
    configure(); const fetcher = vi.spyOn(globalThis, "fetch");
    for (const data of [{}, demoKskSnapshot(query), { ...demoKskSnapshot(query), scope: { ...demoKskSnapshot(query).scope, mode: "his" }, cohorts: [{ id: "other" }] }]) {
      fetcher.mockResolvedValue({ ok: true, json: async () => data } as Response);
      await expect(createKskRepository().read(query)).rejects.toThrow();
    }
  });
  it("does not allow demo mode in production", () => {
    configure(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("KSK_DATA_MODE", "demo");
    expect(() => createKskRepository()).toThrow("KSK_DATA_MODE=his");
  });
  it("global collection reads require the new agent contract and separate registration/collection ranges", async () => {
    configure();
    const q = { from: query.from, to: query.to, collectedFrom: "2026-10-02", collectedTo: query.to, company: "", support: "", cashier: "", status: "" as const };
    const data = demoKskSnapshot(query); data.scope.mode = "his";
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => data } as Response);
    await expect(createKskRepository().readCollections(q)).rejects.toThrow("chưa hỗ trợ");
    data.scope = { ...data.scope, collections: true, collectedFrom: q.collectedFrom, collectedTo: q.collectedTo };
    await expect(createKskRepository().readCollections(q)).resolves.toBeDefined();
    const [url] = fetcher.mock.calls[1]; expect(String(url)).toContain("all=1"); expect(String(url)).toContain("collectedFrom=2026-10-02"); expect(String(url)).not.toContain("xxxxxxxx");
  });
});
