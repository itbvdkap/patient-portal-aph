// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/admin/session", async () => ({ ...await vi.importActual<typeof import("@/lib/admin/session")>("@/lib/admin/session"), getAdminSession: mocks.session, resolveAdminSession: mocks.session }));
import { GET, POST } from "@/app/api/admin/ksk-changes/route";
import { readChangeLab } from "@/lib/ksk/change-lab-store";
let temporary: string;
beforeEach(() => {
  temporary = mkdtempSync(path.join(os.tmpdir(), "aph-ksk-route-lab-"));
  vi.stubEnv("KSK_CHANGE_LAB_ENABLED", "true"); vi.stubEnv("KSK_CHANGE_STORE_PATH", path.join(temporary, "lab.json")); vi.stubEnv("VERCEL", "");
});
afterEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs();
  if (path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith("aph-ksk-route-lab-")) throw new Error("Unsafe cleanup");
  rmSync(temporary, { recursive: true });
});
const actor = { username: "maker", role: "staff", menus: ["ksk_changes"], actions: ["ksk_package_draft"] };
function request(body: unknown, origin = "https://192.168.2.8:3443") {
  return new Request("https://192.168.2.8:3443/api/admin/ksk-changes", { method: "POST", headers: { origin, host: "192.168.2.8:3443" }, body: JSON.stringify(body) });
}
describe("LAB API authorization and persistence", () => {
  it("requires a current authenticated account with the exact new menu", async () => {
    mocks.session.mockReturnValue(null); expect((await GET()).status).toBe(401); expect((await POST(request({}))).status).toBe(401);
    mocks.session.mockReturnValue({ ...actor, menus: ["ksk"] }); expect((await GET()).status).toBe(403); expect((await POST(request({}))).status).toBe(403);
    mocks.session.mockReturnValue({ ...actor, actions: [] }); expect((await GET()).status).toBe(200);
    const source = readChangeLab(), command = { action: "create", targetId: "LAB-P01", sourceVersion: source.sourceVersion, after: { ...source.targets[0].value, name: "Tên mới" }, reason: "Thử API đúng" };
    expect((await POST(request(command))).status).toBe(403);
  });
  it("checks CSRF, size and strict schemas before any mutation", async () => {
    mocks.session.mockReturnValue(actor);
    expect((await POST(request({}, "https://evil.invalid"))).status).toBe(403);
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ reason: "x".repeat(25000) }))).status).toBe(413);
    expect(readChangeLab().drafts).toHaveLength(0);
  });
  it("returns private data, creates a draft, and exposes real-write refusal without raw errors", async () => {
    mocks.session.mockReturnValue(actor);
    const source = readChangeLab(), command = { action: "create", targetId: "LAB-P01", sourceVersion: source.sourceVersion, after: { ...source.targets[0].value, name: "Tên mới" }, reason: "Thử API đúng" };
    const response = await POST(request(command)); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    const payload = await response.json(); expect(payload.realHisWriteEnabled).toBe(false); expect(payload.drafts[0].author).toBe("maker");
    mocks.session.mockReturnValue({ ...actor, actions: ["ksk_change_apply"] });
    expect((await POST(request({ action: "apply_his", id: payload.drafts[0].id, revision: 1, reason: "Không được ghi thật" }))).status).toBe(501);
    vi.stubEnv("KSK_CHANGE_STORE_PATH", "relative-path-secret"); const failed = await GET();
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("relative-path-secret");
  });
});
