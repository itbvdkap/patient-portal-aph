// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),read:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({})}));
vi.mock("@/lib/admin/session",async()=>({...await vi.importActual<typeof import("@/lib/admin/session")>("@/lib/admin/session"),resolveAdminSession:mocks.session}));
vi.mock("@/lib/revenue/repository",()=>({readRevenue:mocks.read}));
import { GET } from "@/app/api/admin/vienphi-revenue/route";
const url="http://localhost/api/admin/vienphi-revenue?from=2026-10-01T00:00:00&to=2026-10-01T23:59:59";
afterEach(()=>vi.resetAllMocks());
describe("Revenue access",()=>{
  it("requires the separate whole-hospital finance permission",async()=>{
    mocks.session.mockReturnValue(null);expect((await GET(new Request(url))).status).toBe(401);
    for(const menus of [["ksk"],["ksk_collections"],[]]){mocks.session.mockReturnValue({username:"staff",role:"staff",menus});expect((await GET(new Request(url))).status).toBe(403);}
    expect(mocks.read).not.toHaveBeenCalled();mocks.session.mockReturnValue({username:"staff",role:"staff",menus:["revenue"]});mocks.read.mockResolvedValue({});expect((await GET(new Request(url))).status).toBe(200);
  });
  it("validates time before reading, sends no-store and hides internal errors",async()=>{
    mocks.session.mockReturnValue({username:"admin",role:"super_admin"});expect((await GET(new Request(url+"&cohort=99"))).status).toBe(400);expect(mocks.read).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue({});expect((await GET(new Request(url))).headers.get("cache-control")).toContain("no-store");
    mocks.read.mockRejectedValue(new Error("sensitive Oracle SQL"));const response=await GET(new Request(url));expect(response.status).toBe(503);expect(await response.text()).not.toContain("sensitive");
  });
});
