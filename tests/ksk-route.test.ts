// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn(), create: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/admin/session", async () => ({ ...await vi.importActual<typeof import("@/lib/admin/session")>("@/lib/admin/session"), getAdminSession: mocks.session, resolveAdminSession: mocks.session }));
vi.mock("@/lib/ksk/repository", () => ({ createKskRepository: mocks.create }));
import * as route from "@/app/api/admin/ksk/route";

const request = () => new Request("http://localhost/api/admin/ksk?from=2026-10-01&to=2026-10-14&cohort=900001");
afterEach(() => vi.resetAllMocks());
describe("KSK admin GET only", () => {
  it("does not expose mutation handlers", () => {
    expect(Object.keys(route)).not.toContain("POST"); expect(Object.keys(route)).not.toContain("DELETE");
  });
  it("rejects anonymous callers without accessing HIS", async () => {
    mocks.session.mockReturnValue(null);
    expect((await route.GET(request())).status).toBe(401); expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["booking_admin", "support", "auditor", "content_admin"])("rejects role %s", async role => {
    mocks.session.mockReturnValue({ username: "staff", role });
    expect((await route.GET(request())).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("validates parameters before using repository", async () => {
    mocks.session.mockReturnValue({ username: "admin", role: "super_admin" });
    expect((await route.GET(new Request("http://localhost/api/admin/ksk?from=oops&to=oops"))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("permits staff only with the explicitly granted KSK menu", async () => {
    mocks.session.mockReturnValue({ username: "staff", role: "staff", menus: [] });
    expect((await route.GET(request())).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled();
    mocks.session.mockReturnValue({ username: "staff", role: "staff", menus: ["ksk"] });
    mocks.create.mockReturnValue({ read: mocks.read }); mocks.read.mockResolvedValue({ cohorts: [] });
    expect((await route.GET(request())).status).toBe(200);
  });
  it("serves authorized data privately and redacts failures", async () => {
    mocks.session.mockReturnValue({ username: "admin", role: "super_admin" });
    mocks.create.mockReturnValue({ read: mocks.read }); mocks.read.mockResolvedValue({ cohorts: [] });
    const response = await route.GET(request());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store, private");
    mocks.read.mockRejectedValue(new Error("oracle-password"));
    const failed = await route.GET(request()); expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("oracle-password");
  });
});
