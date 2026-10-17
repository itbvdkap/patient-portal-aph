import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RevenueWorkspace } from "@/app/admin/vienphi-revenue/workspace";
let host: HTMLDivElement, root: Root;
const query={from:"2026-10-14T08:00:00",to:"2026-10-14T17:00:00",cashier:"",department:"",kind:"" as const};
const bill=(id:string,cashierid:string,kind:string)=>({source:"HGSOFT_BV1026.V_VIENPHILL",id,kind,occurredat:"2026-10-14T09:00:00",gross:"100",insurance:"0",waiver:"0",debt:"0",advance:"0",discount:"0",deferred:"0",unsettled:"0",refunded:"0",linecount:"1",receiptno:id,cashierid,cashiername:cashierid,departmentid:"V:01",departmentname:"Khoa mẫu"});
const snapshot={scope:{...query,reportType:"cashier",version:1,mode:"his",branch:"CN1",asof:"2026-10-14T10:00:00Z",departmentPolicy:"receipt_header",storagePolicy:"adjacent_months"},receipts:[bill("1","V:1","direct"),bill("2","V:2","advance")],sections:Object.fromEntries(["0926","1026","1126"].flatMap(m=>["direct","settlement","advance","refund","pharmacy"].map(k=>[`HGSOFT_BV${m}:${k}`,true]))),warnings:[]};
beforeEach(()=>{vi.stubGlobal("React",React);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("Revenue reporting UI",()=>{
  it("loads only on request, uses all receipt sources and filters cashiers without a cohort",async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>snapshot});vi.stubGlobal("fetch",fetcher);act(()=>root.render(<RevenueWorkspace initialQuery={query}/>));expect(fetcher).not.toHaveBeenCalled();
    await act(async()=>{host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});
    expect(fetcher.mock.calls[0][0]).toContain("/api/admin/vienphi-revenue?");expect(fetcher.mock.calls[0][0]).not.toContain("cohort");expect(host.textContent).toContain("Chi tiết phiếu (2)");
    const cashier=host.querySelectorAll("select")[0];act(()=>{cashier.value="V:2";cashier.dispatchEvent(new Event("change",{bubbles:true}));});expect(host.textContent).toContain("Chi tiết phiếu (1)");expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("shows read errors without presenting zero receipt totals",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:"Cần cập nhật agent"})}));act(()=>root.render(<RevenueWorkspace initialQuery={query}/>));
    await act(async()=>{host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});expect(host.querySelector('[role="alert"]')?.textContent).toContain("Cần cập nhật agent");expect(host.textContent).not.toContain("Thu ròng đã xác định");
  });
});
