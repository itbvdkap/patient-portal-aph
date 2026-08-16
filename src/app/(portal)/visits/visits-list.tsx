"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Filter, Search } from "lucide-react";
import type { Visit } from "@/types/patient";
import { Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/utils/format";

export function VisitsList({ visits }: { visits: Visit[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const departments = Array.from(new Set(visits.map((visit) => visit.departmentName).filter(Boolean)));

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

      <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.045)]">
        {filteredVisits.length === 0 && <EmptyState text="Không có lần khám phù hợp với bộ lọc." />}
        {filteredVisits.map((visit) => (
          <a key={visit.id} href={`/visits/${visit.id}`} className="group grid gap-2 border-b border-slate-100 p-3 transition last:border-b-0 hover:bg-primary-50 sm:grid-cols-[132px_1fr_auto] sm:items-start sm:p-4">
            <div className="flex items-center justify-between gap-2 sm:block">
              <h2 className="text-base font-bold text-ink">{formatDate(visit.visitDate)}</h2>
              <Badge tone="blue">{visit.status}</Badge>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-700">
                <span className="text-slate-500">Phòng: </span>
                {visit.departmentName}
              </p>
              {visit.doctorName && (
                <p className="mt-0.5 text-sm text-slate-600">
                  <span className="font-semibold text-slate-500">Bác sĩ: </span>
                  {visit.doctorName}
                </p>
              )}
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-ink">
                <span className="text-slate-500">CD ra viện: </span>
                {visit.primaryDiagnosis}
              </p>
              {visit.secondaryDiagnosis && (
                <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-700">
                  <span className="font-semibold text-slate-500">Chẩn đoán kèm theo: </span>
                  {visit.secondaryDiagnosis}
                </p>
              )}
              <p className="mt-2 text-sm font-bold text-primary-700">Xem chi tiết</p>
            </div>
            <ChevronRight aria-hidden="true" className="hidden h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary-700 sm:block" />
          </a>
        ))}
      </div>
    </div>
  );
}
