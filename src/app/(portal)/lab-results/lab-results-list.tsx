"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Badge, EmptyState, Panel, SecureDataNotice } from "@/components/ui";
import type { LabResult, Visit } from "@/types/patient";
import { formatDate, formatDateTime } from "@/utils/format";

type LoadState =
  | { status: "idle"; items: LabResult[] }
  | { status: "loading"; items: LabResult[] }
  | { status: "ready"; items: LabResult[] }
  | { status: "error"; items: LabResult[]; message: string };

interface ApiEnvelope<T> {
  data: T;
}

export function LabResultsList({ visits }: { visits: Visit[] }) {
  const [openVisitId, setOpenVisitId] = useState(visits[0]?.id ?? "");
  const [cache, setCache] = useState<Record<string, LoadState>>({});

  useEffect(() => {
    if (openVisitId) {
      void loadVisit(openVisitId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVisitId]);

  async function loadVisit(visitId: string, force = false) {
    const current = cache[visitId];

    if (current?.status === "loading" || (!force && current?.status === "ready")) {
      return;
    }

    setCache((value) => ({ ...value, [visitId]: { status: "loading", items: current?.items ?? [] } }));

    try {
      const response = await fetch(`/api/me/lab-results?visitId=${encodeURIComponent(visitId)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = (await response.json()) as ApiEnvelope<LabResult[]>;
      setCache((value) => ({ ...value, [visitId]: { status: "ready", items: body.data } }));
    } catch (error) {
      setCache((value) => ({
        ...value,
        [visitId]: {
          status: "error",
          items: [],
          message: error instanceof Error ? error.message : "Không tải được dữ liệu.",
        },
      }));
    }
  }

  if (visits.length === 0) {
    return <EmptyState text="Chưa có dữ liệu lần khám." />;
  }

  return (
    <div className="space-y-3">
      <SecureDataNotice label="Kết quả xét nghiệm được bảo vệ trong phiên đăng nhập" />
      {visits.map((visit) => {
        const state = cache[visit.id] ?? { status: "idle", items: [] };
        const isOpen = openVisitId === visit.id;
        const forms = groupLabResults(state.items);

        return (
          <Panel key={visit.id} className="p-0 sm:p-0">
            <button
              type="button"
              onClick={() => setOpenVisitId(isOpen ? "" : visit.id)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-primary-50 sm:p-5"
            >
              <span className="min-w-0">
                <span className="clinical-mono block font-bold text-ink">{formatDate(visit.visitDate)}</span>
                <span className="mt-1 line-clamp-2 block text-sm leading-6 text-slate-600">{visit.primaryDiagnosis || visit.departmentName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {state.status === "ready" && forms.length > 0 && <Badge tone="blue">{forms.length} phiếu</Badge>}
                {state.status === "loading" && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary-700" />}
                <ChevronDown aria-hidden="true" className={`h-5 w-5 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 p-4 sm:p-5">
                {state.status === "loading" && <LoadingRows />}
                {state.status === "error" && (
                  <ReloadableEmptyState
                    text={`Không tải được kết quả xét nghiệm: ${state.message}`}
                    onReload={() => loadVisit(visit.id, true)}
                  />
                )}
                {state.status === "ready" && state.items.length === 0 && (
                  <ReloadableEmptyState
                    text="Chưa có kết quả xét nghiệm trong lần khám này."
                    onReload={() => loadVisit(visit.id, true)}
                  />
                )}
                {state.status === "ready" && state.items.length > 0 && <LabForms forms={forms} />}
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function ReloadableEmptyState({ text, onReload }: { text: string; onReload: () => void }) {
  return (
    <div className="space-y-3">
      <EmptyState text={text} />
      <button
        type="button"
        onClick={onReload}
        className="inline-flex items-center gap-2 rounded-md border border-primary-200 bg-white px-3 py-2 text-sm font-bold text-primary-800 shadow-sm transition hover:bg-primary-50"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Tải lại kết quả
      </button>
    </div>
  );
}

function LabForms({ forms }: { forms: ReturnType<typeof groupLabResults> }) {
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const abnormalCount = forms.reduce((total, form) => total + form.items.filter((item) => !isNormalLabFlag(item.flag)).length, 0);
  const groups = groupFormsByCategory(forms);

  return (
    <div className="space-y-4">
      {abnormalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/80 p-3">
          <div>
            <p className="text-sm font-black text-amber-950">{abnormalCount} chỉ số cần lưu ý</p>
            <p className="mt-0.5 text-xs font-semibold text-amber-900">Giá trị ngoài khoảng tham chiếu được đánh dấu màu để dễ nhận biết.</p>
          </div>
          <button
            type="button"
            onClick={() => setOnlyAbnormal((value) => !value)}
            className={`inline-flex min-h-9 items-center rounded-md px-3 text-xs font-black ${
              onlyAbnormal ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-white text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
            }`}
          >
            {onlyAbnormal ? "Hiện tất cả" : "Chỉ xem bất thường"}
          </button>
        </div>
      )}
      {groups.map((group) => (
        <details
          key={group.key}
          className="group overflow-hidden rounded-md border border-cream-200 bg-cream-50"
          open={group.abnormalCount > 0 || groups.length === 1}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-cream-100 px-3 py-3">
            <span className="min-w-0">
              <span className="block font-serif text-sm font-black text-ink">{group.title}</span>
              <span className="clinical-mono mt-0.5 block text-xs font-semibold text-slate-600">{group.formCount} phiếu · {group.indexCount} chỉ số</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {group.abnormalCount > 0 && <Badge tone="amber">{group.abnormalCount} bất thường</Badge>}
              <ChevronDown aria-hidden="true" className="h-5 w-5 text-slate-500 transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="details-reveal space-y-3 p-3">
            {group.forms.map((form) => (
              <LabFormSection key={form.key} form={form} onlyAbnormal={onlyAbnormal} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function LabFormSection({ form, onlyAbnormal }: { form: ReturnType<typeof groupLabResults>[number]; onlyAbnormal: boolean }) {
  const visibleItems = onlyAbnormal ? form.items.filter((item) => !isNormalLabFlag(item.flag)) : form.items;

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-md border border-cream-200 bg-cream-50">
          <div className="flex flex-col gap-2 bg-white/60 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-serif text-sm font-bold text-ink">{form.serviceName}</h3>
              <p className="clinical-mono mt-0.5 text-xs text-slate-600">{formatDateTime(form.performedAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {form.items.some((item) => !isNormalLabFlag(item.flag)) && <Badge tone="amber">{form.items.filter((item) => !isNormalLabFlag(item.flag)).length} bất thường</Badge>}
              <Badge>{form.items.length} chỉ số</Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[680px] text-left text-sm sm:min-w-full">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-bold">Tên chỉ số</th>
                  <th className="px-3 py-2 font-bold">Kết quả</th>
                  <th className="px-3 py-2 font-bold">Tham chiếu</th>
                  <th className="px-3 py-2 font-bold">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleItems.map((result) => (
                  <tr key={result.id} className={`align-top ${isNormalLabFlag(result.flag) ? "" : "bg-amber-50/55"}`}>
                    <td className="px-3 py-2 font-semibold text-ink">
                      <span className="flex items-start gap-2">
                        {!isNormalLabFlag(result.flag) && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />}
                        <span>{result.testName}</span>
                      </span>
                    </td>
                    <td className={`clinical-mono px-3 py-2 font-semibold ${isNormalLabFlag(result.flag) ? "text-slate-700" : "text-amber-900"}`}>
                      {result.result} {result.unit}
                    </td>
                    <td className="clinical-mono px-3 py-2 text-slate-600">{result.referenceRange || "-"}</td>
                    <td className="px-3 py-2">
                      <LabFlagBadge flag={result.flag} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
  );
}

function LabFlagBadge({ flag }: { flag: LabResult["flag"] | string }) {
  if (isNormalLabFlag(flag)) {
    return <Badge tone="green">Bình thường</Badge>;
  }

  const isLow = String(flag).toLowerCase().includes("thấp");
  const Icon = isLow ? ArrowDown : ArrowUp;

  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-black text-amber-900">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {flag}
    </span>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      <div className="h-16 animate-pulse rounded-md bg-slate-100" />
      <div className="h-16 animate-pulse rounded-md bg-slate-100" />
    </div>
  );
}

function groupLabResults(results: LabResult[]) {
  const formMap = new Map<string, LabResult[]>();

  for (const result of results) {
    const serviceName = result.serviceName || "Phiếu xét nghiệm";
    const key = `${result.visitId}-${serviceName}-${result.performedAt.slice(0, 16)}`;
    const items = formMap.get(key) ?? [];

    items.push(result);
    formMap.set(key, items);
  }

  return Array.from(formMap.entries()).map(([key, items]) => ({
    key,
    serviceName: items[0]?.serviceName || "Phiếu xét nghiệm",
    performedAt: items[0]?.performedAt ?? "",
    items,
  }));
}

function isNormalLabFlag(value: LabResult["flag"] | string) {
  return value === "Bình thường";
}

function groupFormsByCategory(forms: ReturnType<typeof groupLabResults>) {
  const map = new Map<
    string,
    {
      key: string;
      title: string;
      forms: typeof forms;
      formCount: number;
      indexCount: number;
      abnormalCount: number;
    }
  >();

  for (const form of forms) {
    const category = inferLabCategory(form.serviceName, form.items);
    const current = map.get(category.key) ?? {
      key: category.key,
      title: category.title,
      forms: [],
      formCount: 0,
      indexCount: 0,
      abnormalCount: 0,
    };

    current.forms.push(form);
    current.formCount += 1;
    current.indexCount += form.items.length;
    current.abnormalCount += form.items.filter((item) => !isNormalLabFlag(item.flag)).length;
    map.set(category.key, current);
  }

  return Array.from(map.values()).sort((first, second) => labCategoryOrder(first.key) - labCategoryOrder(second.key));
}

function inferLabCategory(serviceName: string, items: LabResult[]) {
  const haystack = `${serviceName} ${items.map((item) => item.testName).join(" ")}`.toLowerCase();

  if (/(rbc|wbc|hgb|hct|plt|mcv|mch|neut|lym|mono|eos|baso|huyết học|huyet hoc|công thức máu|cong thuc mau)/i.test(haystack)) {
    return { key: "hematology", title: "Huyết học" };
  }

  if (/(glucose|ure|creatinin|ast|alt|ggt|bilirubin|cholesterol|triglyceride|hdl|ldl|acid uric|sinh hóa|sinh hoa|đường huyết|duong huyet|men gan)/i.test(haystack)) {
    return { key: "biochemistry", title: "Sinh hóa" };
  }

  if (/(pt|aptt|inr|fibrinogen|d-dimer|dimer|đông máu|dong mau)/i.test(haystack)) {
    return { key: "coagulation", title: "Đông máu" };
  }

  if (/(tsh|ft4|hbsag|anti|crp|procalcitonin|troponin|probnp|nt-probnp|miễn dịch|mien dich|nội tiết|noi tiet)/i.test(haystack)) {
    return { key: "immunology", title: "Miễn dịch - nội tiết" };
  }

  if (/(nước tiểu|nuoc tieu|urine|protein niệu|bach cau nieu|hồng cầu niệu|hong cau nieu)/i.test(haystack)) {
    return { key: "urine", title: "Nước tiểu" };
  }

  return { key: "other", title: "Xét nghiệm khác" };
}

function labCategoryOrder(key: string) {
  return ["hematology", "biochemistry", "coagulation", "immunology", "urine", "other"].indexOf(key);
}
