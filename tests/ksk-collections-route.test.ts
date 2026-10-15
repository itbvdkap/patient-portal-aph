// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/admin/session", async () => ({ ...await vi.importActual<typeof import("@/lib/admin/session")>("@/lib/admin/session"), getAdminSession: mocks.session, resolveAdminSession: mocks.session }));
vi.mock("@/lib/ksk/repository", () => ({ createKskRepository: () => ({ readCollections: mocks.read }) }));
import { GET } from "@/app/api/admin/ksk-collections/route";
const parameters = { from: "2026-10-01", to: "2026-10-14", collectedFrom: "2026-10-01", collectedTo: "2026-10-14" };
const request = (query = parameters) => new Request(`http://localhost/api/admin/ksk-collections?${new URLSearchParams(query)}`);
afterEach(() => vi.resetAllMocks());
describe("Separate financial report access", () => {
  it("requires authentication and explicit collections menu, not ordinary KSK permission", async () => {
    mocks.session.mockReturnValue(null); expect((await GET(request())).status).toBe(401);
    mocks.session.mockReturnValue({ username: "staff", role: "staff", menus: ["ksk"] }); expect((await GET(request())).status).toBe(403);
    mocks.session.mockReturnValue({ username: "staff", role: "staff", menus: ["ksk_collections"] }); mocks.read.mockResolvedValue({});
    expect((await GET(request())).status).toBe(200);
  });
  it("rejects invalid dates before reading and uses private no-store responses", async () => {
    mocks.session.mockReturnValue({ username: "admin", role: "super_admin" });
    expect((await GET(request({ ...parameters, from: "invalid" }))).status).toBe(400); expect(mocks.read).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue({}); expect((await GET(request())).headers.get("cache-control")).toContain("no-store");
    mocks.read.mockRejectedValue(new Error("Oracle credential hidden")); const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("credential");
  });
});
