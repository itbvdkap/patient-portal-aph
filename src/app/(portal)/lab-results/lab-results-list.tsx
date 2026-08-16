"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge, EmptyState, Panel } from "@/components/ui";
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

  async function loadVisit(visitId: string) {
    const current = cache[visitId];

    if (current?.status === "loading" || current?.status === "ready") {
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
                {state.status === "error" && <EmptyState text={`Không tải được kết quả xét nghiệm: ${state.message}`} />}
                {state.status === "ready" && state.items.length === 0 && <EmptyState text="Chưa có kết quả xét nghiệm trong lần khám này." />}
                {state.status === "ready" && state.items.length > 0 && <LabForms forms={forms} />}
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function LabForms({ forms }: { forms: ReturnType<typeof groupLabResults> }) {
  return (
    <div className="space-y-4">
      {forms.map((form) => (
        <section key={form.key} className="overflow-hidden rounded-md border border-cream-200 bg-cream-50">
          <div className="flex flex-col gap-2 bg-cream-100 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-serif text-sm font-bold text-ink">{form.serviceName}</h3>
              <p className="clinical-mono mt-0.5 text-xs text-slate-600">{formatDateTime(form.performedAt)}</p>
            </div>
            <Badge>{form.items.length} chỉ số</Badge>
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
                {form.items.map((result) => (
                  <tr key={result.id} className="align-top">
                    <td className="px-3 py-2 font-semibold text-ink">{result.testName}</td>
                    <td className="clinical-mono px-3 py-2 text-slate-700">
                      {result.result} {result.unit}
                    </td>
                    <td className="clinical-mono px-3 py-2 text-slate-600">{result.referenceRange || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={result.flag === "Bình thường" ? "green" : "amber"}>{result.flag}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
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
