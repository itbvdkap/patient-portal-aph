"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Filter, ImageIcon, Search, TestTube2 } from "lucide-react";
import type { Visit } from "@/types/patient";
import { Badge, EmptyState } from "@/components/ui";
import type { VisitClinicalMarker } from "@/lib/medical/insights";
import { formatDate } from "@/utils/format";

export function VisitsList({ visits, clinicalMarkers }: { visits: Visit[]; clinicalMarkers?: VisitClinicalMarker[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const departments = Array.from(new Set(visits.map((visit) => visit.departmentName).filter(Boolean)));
  const markers = useMemo(() => new Map((clinicalMarkers ?? []).map((marker) => [marker.visitId, marker])), [clinicalMarkers]);

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const haystack = `${visit.departmentName} ${visit.doctorName} ${visit.primaryDiagnosis} ${visit.secondaryDiagnosis ?? ""}`.toLowerCase();
      const visitTime = new Date(visit.visitDate).getTime();
      const afterFrom = fromDate ? visitTime >= new Date(fromDate).getTime() : true;
      const beforeTo = toDate ? visitTime <= new Date(`${toDate}T23:59:59`).getTime() : true;
      return haystack.includes(query.toLowerCase()) && (!department || visit.departmentName === department) && afterFrom && beforeTo;
    });
  }, [department, fromDate, query, toDate, visits]);

  return (
    <div>
      <details className="rounded-md border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.045)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
            <Filter aria-hidden="true" className="h-4 w-4 text-primary-700" />
            Bộ lọc
          </span>
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            {filteredVisits.length}/{visits.length} lần khám
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          </span>
        </summary>
        <div className="grid gap-3 border-t border-slate-100 p-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="visit-search" className="text-sm font-semibold text-ink">
              Tìm kiếm
            </label>
            <div className="relative mt-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="visit-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 pl-9 pr-3 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
                placeholder="Phòng, bác sĩ, chẩn đoán"
              />
            </div>
          </div>
          <div>
            <label htmlFor="department" className="text-sm font-semibold text-ink">
              Khoa/phòng
            </label>
            <select
              id="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Tất cả</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="from-date" className="text-sm font-semibold text-ink">
                Từ ngày
              </label>
              <input id="from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label htmlFor="to-date" className="text-sm font-semibold text-ink">
                Đến ngày
              </label>
              <input id="to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100" />
            </div>
          </div>
        </div>
      </details>

      <div className="mt-4 grid gap-2">
        {filteredVisits.length === 0 && <EmptyState text="Không có lần khám phù hợp với bộ lọc." />}
        {filteredVisits.map((visit) => (
          <a
            key={visit.id}
            href={`/visits/${visit.id}`}
            className="group block rounded-md border border-cream-200 bg-white/85 p-3 shadow-[0_8px_18px_rgba(7,60,57,0.04)] transition hover:border-primary-200 hover:bg-primary-50 sm:p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="clinical-mono text-sm font-black text-ink">{formatDate(visit.visitDate)}</h2>
                <p className="mt-1 line-clamp-1 text-sm font-black text-slate-800">{visit.departmentName || "Chưa ghi nhận phòng"}</p>
                {visit.doctorName && <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-slate-500">BS: {visit.doctorName}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone="blue">{visit.status}</Badge>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary-700" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <VisitMarkerBadges marker={markers.get(visit.id)} compact />
            </div>
            <div className="min-w-0">
              <p className="mt-2 line-clamp-2 border-t border-cream-100 pt-2 text-sm font-semibold leading-5 text-ink">
                <span className="text-slate-500">CD ra viện: </span>
                {visit.primaryDiagnosis}
              </p>
              {visit.secondaryDiagnosis && (
                <p className="mt-1 line-clamp-1 text-sm font-medium leading-5 text-slate-700">
                  <span className="font-semibold text-slate-500">Chẩn đoán kèm theo: </span>
                  {visit.secondaryDiagnosis}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function VisitMarkerBadges({ marker, compact = false }: { marker?: VisitClinicalMarker; compact?: boolean }) {
  if (!marker) return null;

  const hasAbnormal = marker.abnormalLabCount > 0 || marker.abnormalImagingCount > 0;
  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <>
      {marker.labOrderCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-black text-violet-800">
          <TestTube2 aria-hidden="true" className={iconClass} />
          XN {marker.labOrderCount}
        </span>
      )}
      {marker.imagingCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs font-black text-sky-800">
          <ImageIcon aria-hidden="true" className={iconClass} />
          CĐHA {marker.imagingCount}
        </span>
      )}
      {hasAbnormal && (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-black text-amber-950">
          <Activity aria-hidden="true" className={iconClass} />
          Bất thường
        </span>
      )}
    </>
  );
}
