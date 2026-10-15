"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Filter, RotateCcw, Search } from "lucide-react";
import { cohortSupportKey, cohortSupportLabel, type KskQuery, type KskRow } from "@/lib/ksk/domain";

export interface KskFilters { company: string; support: string }
export function filterChoices(rows: KskRow[], filters: KskFilters) {
  // The URL carries a representative cohort ID, never the free-text HIS note.
  const reference = rows.find(c => c.id === filters.support);
  return rows.filter(c => (!filters.company || c.customerid === filters.company)
    && (!filters.support || (reference && cohortSupportKey(c) === cohortSupportKey(reference))));
}

export function KskFilterBar({ query, rows, filters }: { query: KskQuery; rows: KskRow[]; filters: KskFilters }) {
  const [company, setCompany] = useState(filters.company);
  const [support, setSupport] = useState(filters.support);
  const [cohort, setCohort] = useState(query.cohort);
  const companies = useMemo(() => [...new Map(rows.filter(c => c.customerid).map(c => [c.customerid!, c.customer || "Chưa có tên công ty"])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "vi")), [rows]);
  const supportRows = useMemo(() => rows.filter(c => !company || c.customerid === company), [rows, company]);
  const supports = useMemo(() => {
    const byNote = new Map<string, KskRow>();
    for (const c of [...supportRows].sort((a, b) => a.id!.localeCompare(b.id!)))
      if (!byNote.has(cohortSupportKey(c))) byNote.set(cohortSupportKey(c), c);
    const chosen = rows.find(c => c.id === support);
    if (chosen && supportRows.some(c => cohortSupportKey(c) === cohortSupportKey(chosen))) byNote.set(cohortSupportKey(chosen), chosen);
    return [...byNote.values()].map(c => [c.id!, cohortSupportLabel(c)] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rows, support, supportRows]);
  const narrowed = filterChoices(rows, { company, support });
  const cohorts: [string, string][] = narrowed.map(c => [c.id!, `${c.name || "Đợt chưa có tên"} · ${c.date?.slice(0, 10) || "chưa có ngày"} · #${c.id}`]);
  const selected = [
    company && companies.find(([id]) => id === company)?.[1],
    support && supports.find(([id]) => id === support)?.[1],
    cohort && cohorts.find(([id]) => id === cohort)?.[1],
  ].filter(Boolean) as string[];

  return <form className="mb-5 rounded-md border border-cream-200 bg-white p-4 shadow-sm" action="/admin/ksk">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-cream-100 pb-3">
      <div>
        <h2 className="flex items-center gap-2 font-bold text-primary-900"><Filter size={18} />Tìm đoàn khám</h2>
        <p className="mt-1 text-xs text-slate-500">Chọn lần lượt thời gian, công ty, phụ trách rồi đợt khám. Có thể gõ trực tiếp để tìm.</p>
      </div>
      <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-800" aria-live="polite">{narrowed.length} đợt phù hợp</span>
    </div>

    <div className="grid min-w-0 items-start gap-3 md:grid-cols-2 xl:grid-cols-12">
      <fieldset className="grid min-w-0 grid-cols-2 gap-2 md:col-span-2 xl:col-span-4">
        <legend className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500"><CalendarDays size={14} />1. Khoảng ngày</legend>
        <label className="grid gap-1 text-sm">Từ ngày<input className="min-w-0 rounded border p-2.5" type="date" name="from" defaultValue={query.from} required /></label>
        <label className="grid gap-1 text-sm">Đến ngày<input className="min-w-0 rounded border p-2.5" type="date" name="to" defaultValue={query.to} required /></label>
      </fieldset>
      <div className="xl:col-span-3"><SearchSelect id="ksk-company" label="2. Công ty" name="company" value={company} options={companies}
        placeholder="Gõ tên công ty…" all="Tất cả công ty" onChange={v => { setCompany(v); setSupport(""); setCohort(""); }} /></div>
      <div className="xl:col-span-2"><SearchSelect key={`support:${company}`} id="ksk-support" label="3. Phụ trách / CSKH" name="support" value={support} options={supports}
        placeholder="Gõ người phụ trách…" all="Tất cả phụ trách" onChange={v => { setSupport(v); setCohort(""); }} /></div>
      <div className="xl:col-span-3"><SearchSelect key={`cohort:${company}:${support}`} id="ksk-cohort" label="4. Đợt khám" value={cohort} options={cohorts}
        placeholder="Gõ tên đợt khám…" all="Tất cả đợt phù hợp" onChange={setCohort} /></div>
    </div>

    <input type="hidden" name="cohort" value={cohort} />
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button className="inline-flex items-center gap-2 rounded bg-primary-800 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-primary-900"><Search size={16} />Áp dụng & đọc HIS</button>
      <a className="inline-flex items-center gap-2 rounded border px-4 py-2.5 text-sm font-bold text-primary-800 hover:bg-primary-50"
        href={`/admin/ksk?${new URLSearchParams({ from: query.from, to: query.to })}`}><RotateCcw size={15} />Xóa lựa chọn</a>
      <details className="ml-auto text-sm"><summary className="cursor-pointer text-slate-600">Lọc nâng cao</summary>
        <label className="mt-2 grid max-w-xs gap-1">ID đợt khám<input className="rounded border p-2" value={cohort} onChange={e => setCohort(e.target.value.replace(/\D/g, "").slice(0, 24))} inputMode="numeric" placeholder="Nhập ID khi cần hỗ trợ kỹ thuật" /></label>
      </details>
    </div>

    {selected.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" aria-label="Bộ lọc đang chọn"><span className="font-bold text-slate-600">Đang chọn:</span>
      {selected.map(value => <span key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-900"><Check size={12} /><span className="truncate">{value}</span></span>)}</div>}
    {!narrowed.some(c => c.id === cohort) && cohort && <p className="mt-2 text-xs font-semibold text-amber-800">Đợt đã chọn không còn thuộc công ty/phụ trách hiện tại. Hãy chọn lại từ danh sách gợi ý.</p>}
    <p className="mt-3 text-xs text-slate-500">Phạm vi tối đa 93 ngày. Phụ trách / CSKH được lấy nguyên từ ghi chú đợt khám trong HIS.</p>
  </form>;
}

function SearchSelect({ id, label, name, value, options, all, placeholder, onChange }: {
  id: string; label: string; name?: string; value: string; options: [string, string][]; all: string; placeholder: string; onChange: (value: string) => void;
}) {
  const selectedText = options.find(([key]) => key === value)?.[1] || "";
  const [text, setText] = useState(selectedText);
  const byText = useMemo(() => new Map(options.map(([key, option]) => [option.toLocaleLowerCase("vi"), key])), [options]);
  const unresolved = Boolean(text.trim()) && !byText.has(text.trim().toLocaleLowerCase("vi"));
  return <div className="grid min-w-0 gap-1 text-sm">
    <label className="font-bold text-slate-700" htmlFor={id}>{label}</label>
    <div className="relative">
      <input id={id} list={`${id}-options`} type="search" autoComplete="off" className={`min-w-0 w-full rounded border p-2.5 pr-8 ${unresolved ? "border-amber-400 bg-amber-50" : "bg-white"}`}
        value={text} placeholder={placeholder} onChange={e => { const next = e.target.value; setText(next); onChange(byText.get(next.trim().toLocaleLowerCase("vi")) || ""); }} />
      {text && <button type="button" aria-label={`Xóa ${label.toLocaleLowerCase("vi")}`} className="absolute right-2 top-1/2 -translate-y-1/2 text-lg text-slate-400 hover:text-slate-700"
        onClick={() => { setText(""); onChange(""); }}>×</button>}
    </div>
    <datalist id={`${id}-options`}>{options.map(([key, option]) => <option key={key} value={option} />)}</datalist>
    <input type="hidden" name={name} value={value} />
    <span className={`text-[11px] ${unresolved ? "font-semibold text-amber-800" : "text-slate-500"}`}>{unresolved ? "Chọn một giá trị trong danh sách gợi ý" : value ? "Đã chọn" : all}</span>
  </div>;
}
