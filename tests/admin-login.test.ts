// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ configured: vi.fn(), verify: vi.fn(), cookie: vi.fn() }));
vi.mock("@/lib/admin/session", () => ({ adminSessionCookie: "aph_admin_session", isAdminConfigured: mock.configured, verifyAdminCredentials: mock.verify, resolveAdminCredentials: mock.verify, createAdminSessionCookie: mock.cookie }));
import { POST } from "@/app/api/admin/login/route";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
const request = (name: string, origin = "https://192.168.2.8:3443") => new Request("https://192.168.2.8:3443/api/admin/login", { method: "POST", headers: { origin, host: "192.168.2.8:3443" }, body: JSON.stringify({ username: name, password: "TestingOnly12345" }) });
describe("Internal admin login controls", () => {
  it("rejects cross-origin sign-in before credential verification", async () => {
    const response = await POST(request("cross-origin", "https://other.invalid"));
    expect(response.status).toBe(403); expect(mock.verify).not.toHaveBeenCalled();
  });
  it("sets a secure HttpOnly session and includes staff revision only inside the signed cookie", async () => {
    vi.stubEnv("NODE_ENV", "development"); mock.configured.mockReturnValue(true);
    mock.verify.mockReturnValue({ username: "staff-login", role: "staff", revision: "opaque-revision" }); mock.cookie.mockReturnValue("signed-session");
    const response = await POST(request("staff-login"));
    expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly"); expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(mock.cookie).toHaveBeenCalledWith("staff-login", "staff", 28800, "opaque-revision");
    expect(await response.text()).not.toContain("opaque-revision");
  });
  it("throttles repeated failed logins instead of running unlimited password work", async () => {
    mock.configured.mockReturnValue(true); mock.verify.mockReturnValue(null);
    for (let i = 0; i < 8; i++) expect((await POST(request("unique-throttle-user"))).status).toBe(401);
    const blocked = await POST(request("unique-throttle-user"));
    expect(blocked.status).toBe(429); expect(mock.verify).toHaveBeenCalledTimes(8);
  });
});
