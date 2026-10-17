"use client";
import { useMemo, useRef, useState } from "react";
import { buildRevenueReport, cashierGroups, filterRevenue, revenueComplete, revenueKinds, revenueQuerySchema, revenueRows, revenueSnapshotSchema, revenueSummary, type RevenueQuery, type RevenueSnapshot, type RevenueKind } from "@/lib/revenue/domain";
import { money } from "@/lib/ksk/domain";
import { formatHisDateTime } from "@/lib/ksk/datetime";
import { reportFilename, reportPrintHtml, reportXlsx } from "@/lib/ksk/report-export";

export function RevenueWorkspace({ initialQuery, initialError = "" }: { initialQuery: RevenueQuery; initialError?: string }) {
  const [query, setQuery] = useState(initialQuery), [loadedQuery, setLoadedQuery] = useState<RevenueQuery | null>(null);
  const [data, setData] = useState<RevenueSnapshot | null>(null), [busy, setBusy] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState(initialError), [page, setPage] = useState(0);
  const requestId = useRef(0);
  const all = useMemo(() => data ? revenueRows(data) : [], [data]);
  const rows = useMemo(() => filterRevenue(all, query), [all, query]);
  const summary = useMemo(() => revenueSummary(rows), [rows]);
  const groups = useMemo(() => cashierGroups(rows), [rows]);
  const choices = (key: "cashier" | "department") => [...new Map(all.map(r => key === "cashier" ? [r.cashierId, r.cashier] : [r.departmentId, r.department])).entries()].sort((a,b) => a[1].localeCompare(b[1], "vi"));
  const stale = !!loadedQuery && (loadedQuery.from !== query.from || loadedQuery.to !== query.to);
  const ready = !!data && !!loadedQuery && !stale && !busy;
  const complete = !!data && revenueComplete(data);
  async function load(event: React.FormEvent) {
    event.preventDefault(); const checked = revenueQuerySchema.safeParse(query);
    if (!checked.success) { setError("Chọn ngày giờ hợp lệ, tối đa 31 ngày."); return; }
    const id = ++requestId.current; setBusy(true); setError(""); setData(null); setPage(0);
    try {
      const response = await fetch(`/api/admin/vienphi-revenue?${new URLSearchParams(checked.data)}`, { cache: "no-store", signal: AbortSignal.timeout(60000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Không đọc được báo cáo.");
      const result = revenueSnapshotSchema.parse(body);
      if (result.scope.from !== checked.data.from || result.scope.to !== checked.data.to) throw new Error("Dữ liệu sai phạm vi ngày giờ.");
      if (id === requestId.current) { setData(result); setLoadedQuery(checked.data); window.history.replaceState(null, "", `/admin/vienphi-revenue?${new URLSearchParams(checked.data)}`); }
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : "Không đọc được báo cáo."); }
    finally { if (id === requestId.current) setBusy(false); }
  }
  function change(key: keyof RevenueQuery, value: string) { setQuery(current => ({ ...current, [key]: value })); setPage(0); }
  async function exportReport(print = false) {
    if (!ready || !data) return; setExporting(true); setError("");
    try {
      const report = buildRevenueReport(data, rows, query);
      if (print) {
        const html = reportPrintHtml(report, 0); const popup = window.open("", "_blank", "width=1200,height=900");
        if (!popup) throw new Error("Cho phép cửa sổ in từ trang admin rồi thử lại.");
        popup.opener = null; popup.document.open(); popup.document.write(html); popup.document.close(); popup.focus(); popup.print();
      } else {
        const bytes = await reportXlsx(report); const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        const link = document.createElement("a"); link.href = url; link.download = reportFilename(report); document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch(e) { setError(e instanceof Error ? e.message : "Không xuất được báo cáo."); } finally { setExporting(false); }
  }
  return <>
    <form onSubmit={load} className="mb-5 rounded-md border bg-white p-4" aria-label="Bộ lọc doanh thu viện phí">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-sm">Từ ngày giờ<input aria-label="Từ ngày giờ" className="min-w-0 rounded border p-2" type="datetime-local" step="1" required value={query.from} onChange={e => change("from", e.target.value.length === 16 ? e.target.value + ":00" : e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Đến ngày giờ (bao gồm)<input aria-label="Đến ngày giờ" className="min-w-0 rounded border p-2" type="datetime-local" step="1" required value={query.to} onChange={e => change("to", e.target.value.length === 16 ? e.target.value + ":59" : e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Thu ngân<select className="min-w-0 rounded border p-2" value={query.cashier} onChange={e => change("cashier", e.target.value)}><option value="">Tất cả thu ngân</option>{choices("cashier").map(([id,name]) => <option key={id} value={id}>{name} ({id})</option>)}</select></label>
        <label className="grid gap-1 text-sm">Khoa/phòng trên phiếu<select className="min-w-0 rounded border p-2" value={query.department} onChange={e => change("department", e.target.value)}><option value="">Tất cả khoa/phòng</option>{choices("department").map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Loại thu<select className="min-w-0 rounded border p-2" value={query.kind} onChange={e => change("kind", e.target.value)}><option value="">Tất cả loại thu / hoàn</option>{Object.entries(revenueKinds).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={busy} className="rounded border border-primary-700 bg-primary-700 px-4 py-2 font-bold text-white hover:bg-primary-900 disabled:opacity-50">{busy ? "Đang đọc HIS…" : "Đọc / Làm mới"}</button><button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setQuery(current => ({ ...current, cashier: "", department: "", kind: "" }))}>Bỏ lọc thu ngân / khoa / loại</button><p className="text-xs text-slate-600">Giờ theo HIS, tối đa 31 ngày. Khoa/phòng là nơi ghi trên đầu phiếu; mỗi phiếu chỉ tính một lần.</p></div>
      <p className="mt-3 text-xs text-amber-900">Lọc theo ngày giờ trên phiếu HIS. Nhiều phiếu chỉ lưu ngày với giờ 00:00:00; đây chưa phải giờ thu thực tế đã xác minh. Khi lọc riêng một khung giờ, các phiếu giờ 00:00:00 sẽ không nằm trong khung đó.</p>
    </form>
    {error && <p role="alert" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-amber-950">{error}</p>}
    {stale && <p role="status" className="mb-4 rounded border bg-amber-50 p-3">Khoảng ngày giờ đã đổi. Nhấn Đọc / Làm mới để xem báo cáo mới.</p>}
    {!data && !busy && !error && <p className="rounded border bg-white p-4">Chọn ngày giờ rồi nhấn Đọc / Làm mới để lấy phiếu viện phí.</p>}
    {ready && data && <>
      <p className="mb-3 text-sm text-slate-600">HIS {data.scope.branch} · Đọc lúc {new Date(data.scope.asof).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
      {(!complete || summary.unknown > 0) && <p role="alert" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3">{!complete ? "Chưa đọc đủ nguồn. Tổng toàn bộ chưa xác định. " : ""}{summary.unknown > 0 ? `${summary.unknown} phiếu cần đối chiếu; các số tiền dưới đây chỉ gồm phiếu xác định được.` : ""}{data.warnings.map(w => <span key={w} className="block text-sm">{w}</span>)}</p>}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Số phiếu", String(summary.count)], ["Tiền thu đã xác định", money(summary.inflow)], ["Tiền hoàn đã xác định", money(summary.outflow === null ? null : -summary.outflow)], ["Thu ròng đã xác định", money(summary.net)]].map(([label,value]) => <div key={label} className="rounded border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
      <p className="mb-4 text-xs text-slate-600">Thu ròng = thu dịch vụ + tạm ứng − hoàn ứng − hoàn thu khác. Ra viện trừ ứng sử dụng; nếu HIS đã hoàn ứng bằng phiếu liên kết thì không trừ lại. Tạm ứng được trình bày riêng, chưa phải doanh thu dịch vụ.</p>
      <section className="mb-4 rounded border bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Tổng hợp theo thu ngân ({groups.length})</h3><div className="flex gap-2"><button disabled={exporting} type="button" onClick={() => exportReport()} className="rounded border border-primary-700 bg-primary-700 px-3 py-2 font-bold text-white hover:bg-primary-900 disabled:opacity-50">Xuất Excel</button><button disabled={exporting} type="button" onClick={() => exportReport(true)} className="rounded border px-3 py-2">In / PDF</button></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Thu ngân", "Số phiếu", ...Object.values(revenueKinds), "Thu ròng đã xác định", "Cần đối chiếu"].map(h => <th className="min-w-28 border-b bg-primary-50 p-2" key={h}>{h}</th>)}</tr></thead><tbody>{groups.map(g => <tr key={g.id} className="border-b"><td className="p-2"><button type="button" onClick={() => change("cashier", g.id)} className="font-bold underline">{g.name}</button><p>{g.id}</p></td><td className="p-2">{g.summary.count}</td>{Object.keys(revenueKinds).map(k => <td className="whitespace-nowrap p-2" key={k}>{money(g.summary.byKind[k as RevenueKind])}</td>)}<td className="whitespace-nowrap p-2 font-bold">{money(g.summary.net)}</td><td className="p-2 text-amber-800">{g.summary.unknown}</td></tr>)}</tbody></table></div>
      </section>
      <section className="rounded border bg-white p-4"><h3 className="mb-3 font-bold">Chi tiết phiếu ({rows.length})</h3><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Ngày giờ", "Thu ngân", "Khoa/phòng", "Loại thu", "Quyển / số", "Người bệnh", "Tiền thu / hoàn", "Ghi chú"].map(h => <th key={h} className="whitespace-nowrap border-b bg-primary-50 p-2">{h}</th>)}</tr></thead><tbody>{rows.slice(page*50, page*50+50).map(r => <tr key={r.key} className="border-b"><td className="whitespace-nowrap p-2">{formatHisDateTime(r.at)}</td><td className="min-w-28 p-2">{r.cashier}</td><td className="min-w-28 p-2">{r.department}</td><td className="min-w-36 p-2">{revenueKinds[r.kind]}</td><td className="p-2">{r.receipt}</td><td className="min-w-36 p-2">{r.name}<br />{r.patient}</td><td className={`whitespace-nowrap p-2 font-bold ${r.amount === null ? "text-amber-800" : r.amount < 0 ? "text-red-700" : "text-green-800"}`}>{money(r.amount)}</td><td className="min-w-52 p-2">{r.notes.join(" · ")}</td></tr>)}{!rows.length && <tr><td colSpan={8} className="p-4">Không có phiếu khớp bộ lọc.</td></tr>}</tbody></table></div><div className="mt-3 flex items-center gap-3 text-sm"><button disabled={page===0} type="button" onClick={() => setPage(p=>p-1)} className="rounded border px-3 py-1 disabled:opacity-40">Trước</button><span>Trang {page+1}/{Math.max(1, Math.ceil(rows.length/50))}</span><button disabled={(page+1)*50>=rows.length} type="button" onClick={() => setPage(p=>p+1)} className="rounded border px-3 py-1 disabled:opacity-40">Sau</button></div></section>
    </>}
  </>;
}
