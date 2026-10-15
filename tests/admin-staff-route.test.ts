// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn(), save: vi.fn(), names: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/admin/session", () => ({ getAdminSession: mocks.session, resolveAdminSession: mocks.session, reservedAdminNames: mocks.names }));
vi.mock("@/lib/admin/staff-store", async () => ({ ...await vi.importActual<typeof import("@/lib/admin/staff-store")>("@/lib/admin/staff-store"), publicStaffUsers: mocks.read, saveStaffUser: mocks.save }));
import { GET, POST } from "@/app/api/admin/staff/route";
const input = { username: "sample-user", displayName: "Mẫu", enabled: true, menus: ["ksk"], password: "TestingOnly12345" };
const request = (body: unknown = { ...input, confirmPassword: input.password }, origin = "https://192.168.2.8:3443") => new Request("https://192.168.2.8:3443/api/admin/staff", { method: "POST", headers: { origin, host: "192.168.2.8:3443" }, body: JSON.stringify(body) });
afterEach(() => vi.resetAllMocks());
describe("Employee management server authorization", () => {
  it("requires an authenticated super admin for listing and writes", async () => {
    mocks.session.mockReturnValue(null); expect((await GET()).status).toBe(401); expect((await POST(request())).status).toBe(401);
    mocks.session.mockReturnValue({ role: "staff", menus: ["ksk"] }); expect((await GET()).status).toBe(403); expect((await POST(request())).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("checks same host origin and strict schema before saving", async () => {
    mocks.session.mockReturnValue({ role: "super_admin", username: "admin" });
    expect((await POST(request(input, "https://evil.invalid"))).status).toBe(403);
    expect((await POST(request({ ...input, menus: ["settings"] }))).status).toBe(400);
    expect((await POST(request({ ...input, role: "super_admin" } as never))).status).toBe(400);
    expect((await POST(request(input))).status).toBe(400);
    expect((await POST(request({ ...input, confirmPassword: "different" }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("returns only the public contract privately and preserves a redacted error", async () => {
    mocks.session.mockReturnValue({ role: "super_admin", username: "admin" }); mocks.names.mockReturnValue(["admin"]);
    mocks.read.mockReturnValue([{ username: "sample-user", menus: ["ksk"] }]);
    expect((await GET()).headers.get("cache-control")).toContain("no-store");
    mocks.save.mockReturnValue([]); const response = await POST(request()); expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(input, "admin", ["admin"]);
    mocks.save.mockImplementation(() => { throw new Error("secret file path and password"); });
    const failed = await POST(request()); expect(failed.status).toBe(400); expect(await failed.text()).not.toContain("secret file");
  });
});
