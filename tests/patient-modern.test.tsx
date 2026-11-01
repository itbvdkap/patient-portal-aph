import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({
  repository: vi.fn(),
  pathname: "/dashboard",
  refresh: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) =>
    React.createElement("a", props, children),
}));
vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    ...props
  }: React.ComponentProps<"img"> & { priority?: boolean }) =>
    React.createElement("img", props),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocked.pathname,
  useRouter: () => ({
    refresh: mocked.refresh,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/data", () => ({ createPatientRepository: mocked.repository }));
vi.mock("@/lib/content/health-guide", () => ({
  getFeaturedHealthGuidePosts: async () => [],
}));
import Dashboard from "@/app/(portal)/dashboard/page";
import VisitDetail from "@/app/(portal)/visits/[id]/page";
import { MockPatientRepository } from "@/lib/data/mock-patient-repository";
import { PatientVisitTabs } from "@/components/patient-visit-tabs";
import { AppShell } from "@/components/app-shell";
import { PatientPageError } from "@/components/patient-page-states";

let host: HTMLDivElement, root: Root, repository: MockPatientRepository;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  repository = new MockPatientRepository();
  mocked.repository.mockReturnValue(repository);
  mocked.pathname = "/dashboard";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const click = (selector: string) =>
  act(() => host.querySelector<HTMLButtonElement>(selector)!.click());
const visiblePanel = () =>
  host.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!;

describe("patient design 2 — real components with synthetic data", () => {
  it("renders all existing home entry points without fake appointment or health claims", async () => {
    const page = await Dashboard();
    act(() => root.render(page));
    for (const href of [
      "/booking",
      "/visits",
      "/lab-results",
      "/imaging",
      "/prescriptions",
      "/insurance",
      "/hospital-info",
      "/health-guide",
      "/profile",
    ])
      expect(host.querySelector(`a[href="${href}"]`), href).not.toBeNull();
    expect(host.textContent).toContain("NGUYỄN VĂN AN");
    expect(host.textContent).toContain("23006552");
    expect(host.textContent).toContain("Chưa có lịch hẹn sắp tới.");
    expect(host.querySelector('a[href="/visits/v-20260812"]')).not.toBeNull();
    expect(host.textContent).not.toContain("03/11/2026");
  });
  it("keeps a failed source distinct from no records and offers reload", async () => {
    vi.spyOn(repository, "getVisits").mockRejectedValue(
      new Error("private source details"),
    );
    vi.spyOn(repository, "getSummary").mockRejectedValue(
      new Error("private source details"),
    );
    vi.spyOn(repository, "getAppointments").mockRejectedValue(
      new Error("private source details"),
    );
    const page = await Dashboard();
    act(() => root.render(page));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Tải lại trang",
    );
    expect(host.textContent).toContain("Chưa tải được số lượng");
    expect(host.textContent).not.toContain("private source details");
    expect(host.textContent).not.toContain("Chưa có lịch hẹn sắp tới.");
  });
  it("tabs use one visible panel, keyboard navigation and reversible show-all", () => {
    act(() =>
      root.render(
        <PatientVisitTabs
          sections={{
            overview: "overview",
            labs: "labs",
            imaging: "imaging",
            medications: "medications",
          }}
          hasLabs
          imagingCount={0}
          medicineCount={2}
        />,
      ),
    );
    expect(visiblePanel().textContent).toBe("labs");
    click('[role="tab"][id$="-tab-imaging"]');
    expect(visiblePanel().textContent).toBe("imaging");
    const current = host.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    )!;
    act(() =>
      current.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(visiblePanel().textContent).toBe("medications");
    expect(document.activeElement).toBe(
      host.querySelector('[role="tab"][aria-selected="true"]'),
    );
    click(".visit-show-all");
    expect(
      host.querySelectorAll('[role="tabpanel"]:not([hidden])'),
    ).toHaveLength(4);
    click(".visit-show-all");
    expect(visiblePanel().textContent).toBe("medications");
  });
  it("preserves test values, units and reference ranges; medicine items are not prescriptions", async () => {
    const page = await VisitDetail({
      params: Promise.resolve({ id: "v-20260812" }),
    });
    act(() => root.render(page));
    expect(visiblePanel().textContent).toContain("Glucose");
    expect(visiblePanel().textContent).toContain("8.2 mmol/L");
    expect(visiblePanel().textContent).toContain("3.9 - 6.4");
    expect(visiblePanel().textContent).toContain("Cờ theo phiếu xét nghiệm");
    expect(host.textContent).toContain("2 thuốc trong lần khám này");
    expect(host.textContent).not.toContain("2 đơn thuốc");
    click('[role="tab"][id$="-tab-medications"]');
    expect(visiblePanel().textContent).toContain("Metformin");
    click('[role="tab"][id$="-tab-overview"]');
    expect(visiblePanel().textContent).toContain("Lời dặn bác sĩ");
  });
  it("zero values and missing/unknown flags do not become inferred high results", async () => {
    const visit = structuredClone(
      (await repository.getVisitDetail(
        "11111111-1111-4111-8111-111111111111",
        "v-20260812",
      ))!,
    );
    visit.labResults[0] = {
      ...visit.labResults[0],
      result: 0,
      flag: "" as never,
    };
    visit.labResults[1] = {
      ...visit.labResults[1],
      flag: "Chờ xác nhận" as never,
    };
    vi.spyOn(repository, "getVisitDetail").mockResolvedValue(visit);
    const page = await VisitDetail({
      params: Promise.resolve({ id: visit.id }),
    });
    act(() => root.render(page));
    const rows = visiblePanel().querySelectorAll(".patient-lab-row");
    expect(rows[0].querySelector("dd")?.textContent).toBe("0 mmol/L");
    expect(rows[0].querySelector(".patient-result-label")).toBeNull();
    expect(
      rows[1].querySelector(".patient-result-label")?.getAttribute("data-tone"),
    ).toBe("unknown");
  });
  it("no labs defaults to overview, and imaging text is not diagnosed by keyword", async () => {
    const visit = structuredClone(
      (await repository.getVisitDetail(
        "11111111-1111-4111-8111-111111111111",
        "v-20260812",
      ))!,
    );
    visit.labResults = [];
    visit.imagingResults = [
      {
        id: "fake-image",
        visitId: visit.id,
        date: visit.visitDate,
        techniqueName: "Kết quả mẫu",
        doctorName: "Bác sĩ mẫu",
        description: "Mô tả mẫu",
        conclusion: "Chưa có kết luận cuối cùng",
      },
    ];
    vi.spyOn(repository, "getVisitDetail").mockResolvedValue(visit);
    const page = await VisitDetail({
      params: Promise.resolve({ id: visit.id }),
    });
    act(() => root.render(page));
    expect(
      host.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
    ).toBe("Tổng quan");
    click('[role="tab"][id$="-tab-imaging"]');
    expect(visiblePanel().textContent).toContain("Chưa có kết luận cuối cùng");
    expect(host.textContent).not.toContain("Có phát hiện cần lưu ý");
  });
  it("limits new shell styling to home/detail and keeps profile switching entry point", () => {
    const profiles = [
      {
        mabn: "23006552",
        patientId: "demo",
        branchCode: "CN1" as const,
        branchName: "CN1",
        fullName: "Nguyễn Văn An",
      },
    ];
    act(() =>
      root.render(
        <AppShell profiles={profiles} currentMabn="23006552">
          Demo
        </AppShell>,
      ),
    );
    expect(host.querySelector(".patient-modern")).not.toBeNull();
    click('button[aria-label="Đổi hồ sơ y tế đang xem"]');
    expect(
      host.querySelector('button[aria-label="Đóng đổi hồ sơ"]'),
    ).not.toBeNull();
    mocked.pathname = "/profile";
    act(() => root.render(<AppShell>Demo</AppShell>));
    expect(host.querySelector(".patient-modern")).toBeNull();
  });
  it("error state retries via existing router and reset without revealing errors", () => {
    const reset = vi.fn();
    act(() => root.render(<PatientPageError reset={reset} />));
    click("button");
    expect(reset).toHaveBeenCalledOnce();
    expect(mocked.refresh).toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
});
