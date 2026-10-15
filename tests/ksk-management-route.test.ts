// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn(), patient: vi.fn(), execute: vi.fn(), drafts: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/admin/session", async () => ({ ...await vi.importActual<typeof import("@/lib/admin/session")>("@/lib/admin/session"), getAdminSession: mocks.session, resolveAdminSession: mocks.session }));
vi.mock("@/lib/ksk/management-repository", async () => ({ ...await vi.importActual<typeof import("@/lib/ksk/management-repository")>("@/lib/ksk/management-repository"), createManagementRepository: () => ({ read: mocks.read, patient: mocks.patient }) }));
vi.mock("@/lib/ksk/management-store", () => ({ executeManagement: mocks.execute, readManagementDrafts: mocks.drafts, loadManagementDrafts: mocks.drafts }));
import { GET, POST } from "@/app/api/admin/ksk-manage/route";
import { POST as lookup } from "@/app/api/admin/ksk-manage/patient/route";
const actor = { username: "maker", role: "staff", menus: ["ksk_manage"], actions: ["ksk_manage_roster"] };
const url = "https://192.168.2.8:3443/api/admin/ksk-manage";
const query = "?from=2026-10-01&to=2026-10-14&cohort=2";
const body = { action: "create", query: { from: "2026-10-01", to: "2026-10-14", cohort: "2" }, version: "a".repeat(64), proposal: { kind: "customer", key: "NEW", fields: { ten: "Mẫu", stt: "1" }, items: [] }, reason: "Kiểm tra tạo nháp" };
function post(value: unknown = body, origin = "https://192.168.2.8:3443") { return new Request(url, { method: "POST", headers: { origin, host: "192.168.2.8:3443" }, body: JSON.stringify(value) }); }
afterEach(() => vi.resetAllMocks());
describe("Real management route perimeter", () => {
  it("does not let old report or LAB menus access the new API", async () => {
    mocks.session.mockReturnValue(null); expect((await GET(new Request(url + query))).status).toBe(401); expect((await POST(post())).status).toBe(401);
    for (const menus of [["ksk"], ["ksk_changes"], ["ksk_collections"]]) { mocks.session.mockReturnValue({ ...actor, menus }); expect((await GET(new Request(url + query))).status).toBe(403); expect((await POST(post())).status).toBe(403); }
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("requires a specific action for patient lookup and validates query/calendar", async () => {
    mocks.session.mockReturnValue({ ...actor, actions: [] }); expect((await lookup(post({ mabn: "26000001" }))).status).toBe(403);
    mocks.session.mockReturnValue(actor); expect((await lookup(post({ mabn: "2601" }))).status).toBe(400);
    mocks.patient.mockResolvedValue({ mabn: "26000001", hoten: "Mẫu" }); expect((await lookup(post({ mabn: "26000001" }))).status).toBe(200);
    expect((await GET(new Request(url + "?patient=26000001"))).status).toBe(400);
    expect((await GET(new Request(url + "?from=2026-02-30&to=2026-03-01"))).status).toBe(400);
  });
  it("rejects CSRF, oversized/forged payload and redacts unexpected errors", async () => {
    mocks.session.mockReturnValue(actor);
    expect((await POST(post(body, "https://evil.invalid"))).status).toBe(403);
    expect((await POST(post({ ...body, author: "admin" }))).status).toBe(400);
    expect((await POST(post({ reason: "x".repeat(130000) }))).status).toBe(413);
    mocks.execute.mockRejectedValue(new Error("secret-key oracle password")); const fail = await POST(post()); expect(fail.status).toBe(503); expect(await fail.text()).not.toContain("oracle password");
  });
  it("serves no-store snapshots and delegates only strict typed commands", async () => {
    mocks.session.mockReturnValue(actor); mocks.read.mockResolvedValue({ branch: "CN1" }); mocks.drafts.mockReturnValue([]); mocks.execute.mockResolvedValue([]);
    const read = await GET(new Request(url + query)); expect(read.status).toBe(200); expect(read.headers.get("cache-control")).toContain("no-store");
    expect((await POST(post())).status).toBe(200); expect(mocks.execute).toHaveBeenCalledWith(actor, body, expect.objectContaining({ read: mocks.read }));
  });
});
