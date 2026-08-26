"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Filter, ImageIcon } from "lucide-react";
import { normalizeDisplayText } from "@anphu/patient-domain";
import { Badge, EmptyState, Panel } from "@/components/ui";
import { isPotentiallyAbnormalImaging } from "@/lib/medical/insights";
import type { ImagingResult } from "@/types/patient";
import { formatDate, formatDateTime } from "@/utils/format";

type ImagingStatusFilter = "all" | "notable";
type ImagingModalityFilter = "all" | "functional" | "xray" | "ultrasound" | "ct" | "mri";

const modalityOptions: Array<{ value: ImagingModalityFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "functional", label: "Thăm dò" },
  { value: "xray", label: "X-quang" },
  { value: "ultrasound", label: "Siêu âm" },
  { value: "ct", label: "CT/Citi" },
  { value: "mri", label: "MRI" },
];

export function ImagingResultsList({ results }: { results: ImagingResult[] }) {
  const [statusFilter, setStatusFilter] = useState<ImagingStatusFilter>("all");
  const [modalityFilter, setModalityFilter] = useState<ImagingModalityFilter>("all");
  const notableCount = results.filter((result) => isPotentiallyAbnormalImaging(result.conclusion)).length;
  const modalityCounts = countModalities(results);
  const visibleResults = results.filter((result) => {
    const matchesStatus = statusFilter === "all" || isPotentiallyAbnormalImaging(result.conclusion);
    const matchesModality = modalityFilter === "all" || getImagingModality(result) === modalityFilter;
    return matchesStatus && matchesModality;
  });
  const groups = useMemo(() => groupImagingResults(visibleResults), [visibleResults]);

  if (results.length === 0) {
    return <EmptyState text="Chưa có dữ liệu chẩn đoán hình ảnh." />;
  }

  return (
    <div className="space-y-3">
      <Panel className="p-2.5 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
              <Filter aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-base font-black text-ink">Bộ lọc CĐHA</p>
              <p className="text-xs font-semibold leading-5 text-slate-600">
                {results.length} phiếu, trong đó {notableCount} phiếu cần lưu ý.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-primary-50 p-1 sm:w-auto">
            <FilterButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              Tất cả
            </FilterButton>
            <FilterButton active={statusFilter === "notable"} onClick={() => setStatusFilter("notable")}>
              Cần lưu ý
            </FilterButton>
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {modalityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setModalityFilter(option.value)}
              className={`clinical-mono inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-black transition ${
                modalityFilter === option.value ? "bg-primary-700 text-white shadow-sm" : "bg-white text-primary-800 ring-1 ring-primary-100 hover:bg-primary-50"
              }`}
            >
              {option.label}
              <span className={modalityFilter === option.value ? "text-white/80" : "text-slate-500"}>{option.value === "all" ? results.length : modalityCounts[option.value]}</span>
            </button>
          ))}
        </div>
      </Panel>

      {groups.length === 0 ? (
        <EmptyState text="Không có phiếu CĐHA phù hợp với bộ lọc." />
      ) : (
        groups.map((group) => (
          <section key={group.dateKey} className="space-y-1.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="clinical-mono text-sm font-black text-ink">{formatDate(group.dateKey)}</h2>
                <p className="clinical-mono text-xs text-slate-600">{group.items.length} phiếu CĐHA</p>
              </div>
              {group.notableCount > 0 ? <Badge tone="amber">{group.notableCount} cần lưu ý</Badge> : <Badge tone="green">Bình thường</Badge>}
            </div>

            <div className="grid gap-2">
              {group.items.map((result) => (
                <ImagingCompactCard key={result.id} result={result} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-md px-3 text-sm font-black transition ${
        active ? "bg-primary-700 text-white shadow-sm" : "bg-white/80 text-primary-800 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function ImagingCompactCard({ result }: { result: ImagingResult }) {
  const notable = isPotentiallyAbnormalImaging(result.conclusion);
  const conclusion = normalizeDisplayText(result.conclusion);
  const description = normalizeDisplayText(result.description);
  const modality = getImagingModality(result);

  return (
    <Panel className="p-0 sm:p-0">
      <details className="group">
        <summary className="grid min-h-[76px] cursor-pointer list-none gap-2 px-3 py-2.5 marker:hidden sm:grid-cols-[1fr_auto] sm:items-start sm:px-4">
          <div className="min-w-0">
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${notable ? "bg-amber-100 text-amber-800" : "bg-primary-50 text-primary-700"}`}>
                {notable ? <AlertTriangle aria-hidden="true" className="h-4 w-4" /> : <ImageIcon aria-hidden="true" className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="line-clamp-1 font-serif text-base font-black leading-5 text-ink">{normalizeDisplayText(result.techniqueName)}</h3>
                  <span className="clinical-mono inline-flex min-h-6 items-center rounded-md bg-slate-50 px-2 text-[11px] font-black text-slate-600 ring-1 ring-slate-100">
                    {getModalityLabel(modality)}
                  </span>
                </div>
                <p className="clinical-mono mt-0.5 text-xs font-semibold text-slate-600">
                  {formatDateTime(result.date)} · {normalizeDisplayText(result.doctorName) || "Chưa ghi nhận bác sĩ"}
                </p>
                {conclusion ? <p className={`mt-1 line-clamp-1 text-sm font-bold leading-5 ${notable ? "text-amber-950" : "text-primary-900"}`}>{conclusion}</p> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
          </div>
        </summary>

        <div className="details-reveal border-t border-cream-200 px-3 pb-3 sm:px-4">
          {notable ? (
            <div className="mt-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-950">
              Kết luận có nội dung cần lưu ý. Anh/chị nên trao đổi thêm với bác sĩ khi tái khám hoặc khi có triệu chứng bất thường.
            </div>
          ) : (
            <div className="mt-2.5 rounded-md border border-primary-100 bg-primary-50 px-3 py-2 text-sm font-semibold leading-6 text-primary-900">
              Nội dung hiện có không ghi nhận dấu hiệu bất thường rõ.
            </div>
          )}

          {conclusion ? (
            <section className="mt-3">
              <h4 className="text-sm font-black text-ink">Kết luận</h4>
              <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-800">{conclusion}</p>
            </section>
          ) : null}

          {description ? (
            <section className="mt-3">
              <h4 className="text-sm font-black text-ink">Mô tả chi tiết</h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{description}</p>
            </section>
          ) : null}
        </div>
      </details>
    </Panel>
  );
}

function groupImagingResults(results: ImagingResult[]) {
  const dateMap = new Map<string, ImagingResult[]>();

  for (const result of results) {
    const dateKey = result.date.slice(0, 10);
    const items = dateMap.get(dateKey) ?? [];

    items.push(result);
    dateMap.set(dateKey, items);
  }

  return Array.from(dateMap.entries())
    .map(([dateKey, items]) => ({
      dateKey,
      items: items.sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()),
      notableCount: items.filter((item) => isPotentiallyAbnormalImaging(item.conclusion)).length,
    }))
    .sort((first, second) => new Date(second.dateKey).getTime() - new Date(first.dateKey).getTime());
}

function getImagingModality(result: ImagingResult): ImagingModalityFilter {
  const text = normalizeSearchText(`${result.techniqueName} ${result.description} ${result.conclusion}`);

  if (/(mri|cong huong tu|chup cong huong tu)/.test(text)) return "mri";
  if (/(ct|citi|city|cat scanner|cat-scan|cat scan|msct|chup cat lop|cat lop|vi tinh)/.test(text)) return "ct";
  if (/(x quang|x-quang|xray|x ray|xq|dien quang)/.test(text)) return "xray";
  if (/(sieu am|ultrasound|doppler|echo)/.test(text)) return "ultrasound";
  if (/(dien tim|ecg|dien nao|dien co|holter|do loang xuong|loang xuong|do mat do xuong|noi soi|tham do chuc nang)/.test(text)) return "functional";

  return "functional";
}

function getModalityLabel(value: ImagingModalityFilter) {
  if (value === "functional") return "Thăm dò";
  if (value === "xray") return "X-quang";
  if (value === "ultrasound") return "Siêu âm";
  if (value === "ct") return "CT/Citi";
  if (value === "mri") return "MRI";
  return "CĐHA";
}

function countModalities(results: ImagingResult[]) {
  const initial: Record<Exclude<ImagingModalityFilter, "all">, number> = {
    functional: 0,
    xray: 0,
    ultrasound: 0,
    ct: 0,
    mri: 0,
  };

  for (const result of results) {
    const modality = getImagingModality(result);
    if (modality !== "all") {
      initial[modality] += 1;
    }
  }

  return initial;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
