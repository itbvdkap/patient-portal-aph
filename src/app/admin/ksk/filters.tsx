"use client";

import { useMemo, useState } from "react";
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
  const supports = useMemo(() => {
    const byNote = new Map<string, KskRow>();
    for (const c of [...rows].sort((a, b) => a.id!.localeCompare(b.id!)))
      if (!byNote.has(cohortSupportKey(c))) byNote.set(cohortSupportKey(c), c);
    // Preserve a previously selected reference ID if it belongs to the same note.
    const chosen = rows.find(c => c.id === support);
    if (chosen) byNote.set(cohortSupportKey(chosen), chosen);
    return [...byNote.values()].map(c => [c.id!, cohortSupportLabel(c)] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rows, support]);
  const narrowed = filterChoices(rows, { company, support });
  return <form className="mb-5 rounded-md border border-cream-200 bg-white p-4" action="/admin/ksk">
    <div className="grid min-w-0 items-end gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <label className="grid gap-1 text-sm">Từ ngày<input className="min-w-0 rounded border p-2" type="date" name="from" defaultValue={query.from} required /></label>
      <label className="grid gap-1 text-sm">Đến ngày<input className="min-w-0 rounded border p-2" type="date" name="to" defaultValue={query.to} required /></label>
      <SearchSelect id="ksk-company" label="Công ty" name="company" value={company} options={companies} all="Tất cả công ty" onChange={v => { setCompany(v); setCohort(""); }} />
      <SearchSelect id="ksk-support" label="Nhân viên phụ trách / CSKH" name="support" value={support} options={supports} all="Tất cả phụ trách / CSKH" onChange={v => { setSupport(v); setCohort(""); }} />
      <SearchSelect id="ksk-cohort" label="Đợt khám" value={cohort} options={narrowed.map(c => [c.id!, `${c.name} · ${c.date?.slice(0, 10) ?? ""}`])}
        all="Danh sách đợt khám" onChange={setCohort} />
      <button className="rounded bg-primary-800 px-4 py-2 font-bold text-white">Đọc / Làm mới</button>
    </div>
    <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-600">Lọc nâng cao</summary>
      <label className="mt-2 grid max-w-xs gap-1">ID đợt khám<input className="rounded border p-2" name="cohort" value={cohort} onChange={e => setCohort(e.target.value)} inputMode="numeric" pattern="[0-9]{1,24}" placeholder="Không bắt buộc nhập mã" /></label>
    </details>
    {!narrowed.some(c => c.id === cohort) && cohort && <p className="mt-2 text-xs text-amber-800">Đợt đã chọn không thuộc bộ lọc danh sách; chọn lại đợt để thu hẹp phạm vi.</p>}
    <p className="mt-3 text-xs text-slate-500">Tối đa 93 ngày. Danh sách theo ngày đợt; chi tiết theo ngày tiếp nhận. Phụ trách / CSKH lấy nguyên ghi chú đợt khám, không phải mã nhân viên.</p>
    <a className="mt-2 inline-block text-xs font-bold text-primary-800 underline" href={`/admin/ksk?${new URLSearchParams({ from: query.from, to: query.to })}`}>Xóa bộ lọc công ty / phụ trách / đợt</a>
  </form>;
}

function SearchSelect({ id, label, name, value, options, all, onChange }: {
  id: string; label: string; name?: string; value: string; options: [string, string][]; all: string; onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const shown = options.filter(([id, text]) => id === value || text.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  return <div className="grid min-w-0 gap-1 text-sm">
    <label htmlFor={id}>{label}</label>
    <label className="sr-only" htmlFor={`${id}-search`}>Tìm {label.toLocaleLowerCase("vi")}</label>
    <input id={`${id}-search`} type="search" className="min-w-0 rounded border p-2 text-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder="Gõ để tìm…" />
    <select id={id} name={name} className="min-w-0 w-full rounded border bg-white p-2" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{all}</option>{shown.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  </div>;
}
