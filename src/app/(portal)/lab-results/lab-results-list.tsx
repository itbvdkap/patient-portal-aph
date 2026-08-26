"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Loader2, RefreshCw, Search } from "lucide-react";
import { Badge, EmptyState, Panel, SecureDataNotice } from "@/components/ui";
import type { LabResult, Registration, Visit } from "@/types/patient";
import { formatDate, formatDateTime } from "@/utils/format";

type LoadState =
  | { status: "idle"; items: LabResult[] }
  | { status: "loading"; items: LabResult[] }
  | { status: "ready"; items: LabResult[] }
  | { status: "error"; items: LabResult[]; message: string };

interface ApiEnvelope<T> {
  data: T;
}

export function LabResultsList({ visits, registrations = [] }: { visits: Visit[]; registrations?: Registration[] }) {
  const [openVisitId, setOpenVisitId] = useState(visits[0]?.id ?? "");
  const [cache, setCache] = useState<Record<string, LoadState>>({});
  const [viewMode, setViewMode] = useState<"visits" | "indexes">("visits");
  const [allLabsState, setAllLabsState] = useState<LoadState>({ status: "idle", items: [] });
  const [indexQuery, setIndexQuery] = useState("");
  const payerByVisitId = buildPayerByVisitId(visits, registrations);

  useEffect(() => {
    if (viewMode === "visits" && openVisitId) {
      void loadVisit(openVisitId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVisitId, viewMode]);

  useEffect(() => {
    if (viewMode === "indexes") {
      void loadAllLabs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

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

  async function loadAllLabs(force = false) {
    if (allLabsState.status === "loading" || (!force && allLabsState.status === "ready")) {
      return;
    }

    setAllLabsState((value) => ({ status: "loading", items: value.items }));

    try {
      const response = await fetch("/api/me/lab-results", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = (await response.json()) as ApiEnvelope<LabResult[]>;
      setAllLabsState({ status: "ready", items: body.data });
    } catch (error) {
      setAllLabsState({
        status: "error",
        items: [],
        message: error instanceof Error ? error.message : "Không tải được dữ liệu.",
      });
    }
  }

  if (visits.length === 0) {
    return <EmptyState text="Chưa có dữ liệu lần khám." />;
  }

  return (
    <div className="space-y-3">
      <SecureDataNotice label="Kết quả xét nghiệm được bảo vệ trong phiên đăng nhập" />
      <div className="grid gap-2 rounded-md border border-primary-100 bg-primary-50/70 p-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setViewMode("visits")}
          className={`min-h-10 rounded-md px-3 text-sm font-black transition ${
            viewMode === "visits" ? "bg-primary-700 text-white shadow-sm" : "bg-white/80 text-primary-800 hover:bg-white"
          }`}
        >
          Theo lượt khám
        </button>
        <button
          type="button"
          onClick={() => setViewMode("indexes")}
          className={`min-h-10 rounded-md px-3 text-sm font-black transition ${
            viewMode === "indexes" ? "bg-primary-700 text-white shadow-sm" : "bg-white/80 text-primary-800 hover:bg-white"
          }`}
        >
          Theo chỉ số
        </button>
      </div>

      {viewMode === "indexes" ? (
        <LabIndexHistory
          state={allLabsState}
          visits={visits}
          payerByVisitId={payerByVisitId}
          query={indexQuery}
          onQueryChange={setIndexQuery}
          onReload={() => loadAllLabs(true)}
        />
      ) : visits.map((visit) => {
        const state = cache[visit.id] ?? { status: "idle", items: [] };
        const isOpen = openVisitId === visit.id;
        const forms = groupLabResults(state.items);
        const payerTypeName = payerByVisitId.get(visit.id);

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
                {payerTypeName ? <Badge tone={isBhytPayer(payerTypeName) ? "green" : "slate"}>{payerTypeName}</Badge> : null}
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
                {state.status === "ready" && state.items.length > 0 && <LabForms forms={forms} payerByVisitId={payerByVisitId} />}
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

function LabForms({ forms, payerByVisitId }: { forms: ReturnType<typeof groupLabResults>; payerByVisitId: Map<string, string> }) {
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
              <LabFormSection key={form.key} form={form} onlyAbnormal={onlyAbnormal} payerTypeName={payerByVisitId.get(form.visitId)} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function LabFormSection({ form, onlyAbnormal, payerTypeName }: { form: ReturnType<typeof groupLabResults>[number]; onlyAbnormal: boolean; payerTypeName?: string }) {
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
              {payerTypeName ? <Badge tone={isBhytPayer(payerTypeName) ? "green" : "slate"}>{payerTypeName}</Badge> : null}
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
                {visibleItems.map((result) => {
                  const flagTone = getLabFlagTone(result.flag);

                  return (
                  <tr key={result.id} className={`align-top ${flagTone === "normal" ? "" : flagTone === "low" ? "bg-sky-50/70" : "bg-rose-50/70"}`}>
                    <td className="px-3 py-2 font-semibold text-ink">
                      <span className="flex items-start gap-2">
                        {flagTone !== "normal" && <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${flagTone === "low" ? "bg-sky-500" : "bg-rose-500"}`} aria-hidden="true" />}
                        <span>{result.testName}</span>
                      </span>
                    </td>
                    <td className={`clinical-mono px-3 py-2 font-semibold ${flagTone === "normal" ? "text-slate-700" : flagTone === "low" ? "text-sky-900" : "text-rose-900"}`}>
                      {result.result} {result.unit}
                    </td>
                    <td className="clinical-mono px-3 py-2 text-slate-600">{result.referenceRange || "-"}</td>
                    <td className="px-3 py-2">
                      <LabFlagBadge flag={result.flag} />
                    </td>
                  </tr>
                );
                })}
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

  const tone = getLabFlagTone(flag);
  const isLow = tone === "low";
  const Icon = isLow ? ArrowDown : ArrowUp;

  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${
      isLow ? "bg-sky-100 text-sky-900" : "bg-rose-100 text-rose-900"
    }`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {flag}
    </span>
  );
}

function getLabFlagTone(flag: LabResult["flag"] | string) {
  if (isNormalLabFlag(flag)) return "normal";

  const text = String(flag ?? "").toLowerCase();
  if (/(thấp|low|giảm|down|↓|\bl\b)/i.test(text)) return "low";
  return "high";
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      <div className="h-16 animate-pulse rounded-md bg-slate-100" />
      <div className="h-16 animate-pulse rounded-md bg-slate-100" />
    </div>
  );
}

function LabIndexHistory({
  state,
  visits,
  payerByVisitId,
  query,
  onQueryChange,
  onReload,
}: {
  state: LoadState;
  visits: Visit[];
  payerByVisitId: Map<string, string>;
  query: string;
  onQueryChange: (value: string) => void;
  onReload: () => void;
}) {
  const visitMap = new Map(visits.map((visit) => [visit.id, visit]));
  const groups = groupLabResultsByIndex(state.items, visitMap, payerByVisitId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = normalizedQuery
    ? groups.filter((group) => `${group.testName} ${group.serviceNames.join(" ")}`.toLowerCase().includes(normalizedQuery))
    : groups;

  if (state.status === "loading" && state.items.length === 0) {
    return <LoadingRows />;
  }

  if (state.status === "error") {
    return <ReloadableEmptyState text={`Không tải được lịch sử chỉ số xét nghiệm: ${state.message}`} onReload={onReload} />;
  }

  if (state.status === "ready" && state.items.length === 0) {
    return <EmptyState text="Chưa có dữ liệu xét nghiệm để tổng hợp theo chỉ số." />;
  }

  return (
    <Panel className="p-0 sm:p-0">
      <div className="border-b border-cream-200 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-lg font-black text-ink">Biến động theo chỉ số</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Gom cùng tên chỉ số qua các lần khám để thấy xu hướng rõ hơn.</p>
          </div>
          <Badge tone="blue">{groups.length} chỉ số</Badge>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-md border border-cream-200 bg-white px-3 text-sm shadow-sm focus-within:border-primary-300">
          <Search aria-hidden="true" className="h-4 w-4 text-primary-700" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm Glucose, HbA1c, Creatinine..."
            className="min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      <div className="divide-y divide-cream-200">
        {filteredGroups.length ? (
          filteredGroups.map((group, index) => <LabIndexTrend key={group.key} group={group} open={index < 3} />)
        ) : (
          <div className="p-4">
            <EmptyState text="Không tìm thấy chỉ số phù hợp." />
          </div>
        )}
      </div>
    </Panel>
  );
}

interface LabIndexGroup {
  key: string;
  testName: string;
  unit: string;
  referenceRange: string;
  serviceNames: string[];
  items: Array<LabResult & { visitDate?: string; departmentName?: string; payerTypeName?: string }>;
  abnormalCount: number;
  numericValues: number[];
  delta?: number;
}

function LabIndexTrend({ group, open }: { group: LabIndexGroup; open: boolean }) {
  const latest = group.items[0];
  const previous = group.items[1];
  const trendTone = getTrendTone(group.delta);

  return (
    <details className="group" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden sm:px-4">
        <span className="min-w-0">
          <span className="block font-black leading-6 text-ink">{group.testName}</span>
          <span className="clinical-mono mt-0.5 block text-xs font-semibold text-slate-500">
            {group.items.length} lần đo · gần nhất {formatDate(latest.performedAt || latest.visitDate || "")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {group.abnormalCount > 0 && <Badge tone="amber">{group.abnormalCount} bất thường</Badge>}
          <span className={`clinical-mono hidden rounded-md px-2 py-1 text-xs font-black sm:inline-flex ${trendTone.className}`}>
            {formatTrendDelta(group.delta, group.unit)}
          </span>
          <ChevronDown aria-hidden="true" className="h-5 w-5 text-slate-500 transition group-open:rotate-180" />
        </span>
      </summary>

      <div className="details-reveal border-t border-cream-200 bg-cream-50/80 px-3 py-3 sm:px-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
          <div className="grid gap-2 sm:grid-cols-3">
            <LabValueCard label="Gần nhất" item={latest} />
            {previous ? <LabValueCard label="Lần trước" item={previous} /> : <SmallInfoCard label="Lần trước" value="Chưa có" />}
            <SmallInfoCard label="Xu hướng" value={formatTrendDelta(group.delta, group.unit)} tone={trendTone.tone} />
          </div>
          {group.numericValues.length >= 2 ? <MiniSparkline values={group.numericValues.slice().reverse()} abnormal={group.abnormalCount > 0} /> : null}
        </div>

        <div className="mt-3 overflow-hidden rounded-md border border-cream-200 bg-white/85">
          {group.items.map((item) => {
            const flagTone = getLabFlagTone(item.flag);
            return (
              <div key={item.id} className={`grid gap-2 border-b border-cream-200 px-3 py-3 last:border-b-0 sm:grid-cols-[118px_1fr_auto] sm:items-center ${flagTone === "normal" ? "" : flagTone === "low" ? "bg-sky-50/60" : "bg-rose-50/60"}`}>
                <span className="clinical-mono text-xs font-black text-slate-600">{formatDate(item.performedAt || item.visitDate || "")}</span>
                <span className="min-w-0 text-sm font-semibold text-slate-700">
                  {item.departmentName || item.serviceName || "Lượt khám"}
                  <span className="clinical-mono block text-xs text-slate-500">Tham chiếu: {item.referenceRange || group.referenceRange || "-"}</span>
                </span>
                <span className="flex items-center justify-between gap-2 sm:justify-end">
                  {item.payerTypeName ? <Badge tone={isBhytPayer(item.payerTypeName) ? "green" : "slate"}>{item.payerTypeName}</Badge> : null}
                  <span className={`clinical-mono font-black ${flagTone === "normal" ? "text-ink" : flagTone === "low" ? "text-sky-900" : "text-rose-900"}`}>
                    {item.result} {item.unit}
                  </span>
                  <LabFlagBadge flag={item.flag} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function LabValueCard({ label, item }: { label: string; item: LabResult }) {
  return (
    <SmallInfoCard
      label={label}
      value={`${item.result} ${item.unit}`.trim()}
      meta={formatDate(item.performedAt)}
      tone={isNormalLabFlag(item.flag) ? "normal" : "warn"}
    />
  );
}

function SmallInfoCard({ label, value, meta, tone = "normal" }: { label: string; value: string; meta?: string; tone?: "normal" | "warn" | "up" | "down" }) {
  const toneClass =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "up"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : tone === "down"
          ? "border-sky-200 bg-sky-50 text-sky-950"
          : "border-cream-200 bg-white/85 text-ink";

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="clinical-mono mt-1 text-base font-black">{value}</p>
      {meta ? <p className="mt-1 text-xs font-semibold text-slate-500">{meta}</p> : null}
    </div>
  );
}

function MiniSparkline({ values, abnormal }: { values: number[]; abnormal: boolean }) {
  const width = 220;
  const height = 56;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const path = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" role="img" aria-label="Biểu đồ biến động chỉ số">
      <path d={`M 0 ${height - 7} L ${width} ${height - 7}`} stroke="#eadfce" strokeWidth="1" />
      <path d={path} fill="none" stroke={abnormal ? "#d97706" : "#007c73"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
        const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * (height - 10) - 5;
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.5" fill={abnormal ? "#d97706" : "#007c73"} stroke="#fff" strokeWidth="2" />;
      })}
    </svg>
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
    visitId: items[0]?.visitId ?? "",
    serviceName: items[0]?.serviceName || "Phiếu xét nghiệm",
    performedAt: items[0]?.performedAt ?? "",
    items,
  }));
}

function isNormalLabFlag(value: LabResult["flag"] | string) {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || text === "." || text === "-" || /^(bình thường|binh thuong|normal|bt|n)$/i.test(text);
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

function groupLabResultsByIndex(results: LabResult[], visitMap: Map<string, Visit>, payerByVisitId: Map<string, string>): LabIndexGroup[] {
  const map = new Map<string, LabIndexGroup>();

  for (const item of results) {
    const key = normalizeLabIndexName(item.testName);
    const visit = visitMap.get(item.visitId);
    const current =
      map.get(key) ??
      ({
        key,
        testName: item.testName,
        unit: item.unit,
        referenceRange: item.referenceRange,
        serviceNames: [],
        items: [],
        abnormalCount: 0,
        numericValues: [],
      } satisfies LabIndexGroup);

    current.items.push({
      ...item,
      visitDate: visit?.visitDate,
      departmentName: visit?.departmentName,
      payerTypeName: payerByVisitId.get(item.visitId),
    });

    if (item.serviceName && !current.serviceNames.includes(item.serviceName)) {
      current.serviceNames.push(item.serviceName);
    }

    if (!isNormalLabFlag(item.flag)) {
      current.abnormalCount += 1;
    }

    const value = parseLabNumber(item.result);
    if (value !== null) {
      current.numericValues.push(value);
    }

    map.set(key, current);
  }

  return Array.from(map.values())
    .map((group) => {
      const sortedItems = group.items.sort((first, second) => {
        const firstTime = new Date(first.performedAt || first.visitDate || "").getTime();
        const secondTime = new Date(second.performedAt || second.visitDate || "").getTime();
        return secondTime - firstTime;
      });
      const latestNumber = parseLabNumber(sortedItems[0]?.result);
      const previousNumber = parseLabNumber(sortedItems[1]?.result);

      return {
        ...group,
        testName: sortedItems[0]?.testName || group.testName,
        unit: sortedItems[0]?.unit || group.unit,
        referenceRange: sortedItems[0]?.referenceRange || group.referenceRange,
        items: sortedItems,
        numericValues: sortedItems.map((item) => parseLabNumber(item.result)).filter((value): value is number => value !== null),
        delta: latestNumber !== null && previousNumber !== null ? latestNumber - previousNumber : undefined,
      };
    })
    .filter((group) => group.items.length > 0)
    .sort((first, second) => {
      if (first.abnormalCount !== second.abnormalCount) return second.abnormalCount - first.abnormalCount;
      if (first.items.length !== second.items.length) return second.items.length - first.items.length;
      return first.testName.localeCompare(second.testName, "vi");
    });
}

function normalizeLabIndexName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[.,;:]+$/g, "")
    .trim();
}

function parseLabNumber(value: LabResult["result"]) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "")
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTrendTone(delta: number | undefined) {
  if (delta === undefined || Math.abs(delta) < 0.000001) {
    return { tone: "normal" as const, className: "bg-slate-100 text-slate-700" };
  }

  if (delta > 0) {
    return { tone: "up" as const, className: "bg-rose-100 text-rose-900" };
  }

  return { tone: "down" as const, className: "bg-sky-100 text-sky-900" };
}

function formatTrendDelta(delta: number | undefined, unit: string) {
  if (delta === undefined || Math.abs(delta) < 0.000001) return "Không đổi";
  const sign = delta > 0 ? "+" : "";
  const rounded = Math.abs(delta) >= 10 ? delta.toFixed(0) : delta.toFixed(2).replace(/\.?0+$/g, "");
  return `${sign}${rounded}${unit ? ` ${unit}` : ""}`;
}

function buildPayerByVisitId(visits: Visit[], registrations: Registration[]) {
  const map = new Map<string, string>();
  const registrationsWithPayer = registrations.filter((registration) => registration.payerTypeName);
  const registrationByVisitId = new Map(registrationsWithPayer.map((registration) => [registration.visitId, registration.payerTypeName as string]));

  for (const visit of visits) {
    const direct = registrationByVisitId.get(visit.id) || registrationByVisitId.get(visit.hisVisitId);
    if (direct) {
      map.set(visit.id, direct);
      continue;
    }

    const visitDate = dateOnlyKey(visit.visitDate);
    const visitDepartment = normalizeTextKey(visit.departmentName);
    const matched = registrationsWithPayer.find((registration) => {
      const sameDate = dateOnlyKey(registration.registeredAt) === visitDate;
      const registrationDepartment = normalizeTextKey(registration.departmentName);

      return sameDate && (!visitDepartment || !registrationDepartment || visitDepartment === registrationDepartment);
    });

    if (matched?.payerTypeName) {
      map.set(visit.id, matched.payerTypeName);
    }
  }

  return map;
}

function dateOnlyKey(value: string) {
  if (!value) return "";
  const isoLike = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (isoLike) return isoLike[1];

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  return value.slice(0, 10);
}

function normalizeTextKey(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isBhytPayer(value: string) {
  return value.trim().toLowerCase() === "bhyt";
}
