// @vitest-environment node
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children) }));
import { KskWorkspace } from "@/app/admin/ksk/workspace";
import { demoKskSnapshot } from "@/lib/ksk/sample";

afterEach(() => vi.unstubAllGlobals());
describe("KSK CSKH read-only UI", () => {
  it("renders the note column and labeled company/CSKH filters without executing note markup", () => {
    vi.stubGlobal("React", React);
    const query = { from: "2026-10-01", to: "2026-10-14", cohort: "" };
    const data = demoKskSnapshot(query);
    data.cohorts[0].ghichu = '<script>alert("sample")</script>';
    const html = renderToStaticMarkup(React.createElement(KskWorkspace, { data, query }));
    expect(html).toContain('id="ksk-company"');
    expect(html).toContain('id="ksk-support"');
    expect(html).toContain("Phụ trách / CSKH");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<script>alert("sample")</script>');
  });
  it("shows the HIS note in cohort detail header and identifies blank notes", () => {
    vi.stubGlobal("React", React);
    const query = { from: "2026-10-01", to: "2026-10-14", cohort: "900001" };
    const data = demoKskSnapshot(query);
    data.cohorts[0].ghichu = "CSKH mẫu A\nGhi chú còn nguyên";
    const html = renderToStaticMarkup(React.createElement(KskWorkspace, { data, query }));
    expect(html).toContain("CSKH mẫu A\nGhi chú còn nguyên");
    data.cohorts[0].ghichu = null;
    expect(renderToStaticMarkup(React.createElement(KskWorkspace, { data, query }))).toContain("Chưa ghi phụ trách");
  });
});
