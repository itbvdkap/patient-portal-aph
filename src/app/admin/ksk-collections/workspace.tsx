"use client";
import { useMemo, useState } from "react";
import { cohortSupportKey, cohortSupportLabel, money, type KskSnapshot } from "@/lib/ksk/domain";
import { collectionRows, filterCollections, collectionSummary, buildCollectionReport, type CollectionQuery } from "@/lib/ksk/collections";
import { reportFilename, reportPrintHtml, reportXlsx } from "@/lib/ksk/report-export";
import { formatHisDateTime, hisDateTimeNotice } from "@/lib/ksk/datetime";

export function CollectionWorkspace({ data, query }: { data: KskSnapshot | null; query: CollectionQuery }) {
  const [company, setCompany] = useState(query.company), [support, setSupport] = useState(query.support), [cashier, setCashier] = useState(query.cashier), [status, setStatus] = useState(query.status);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [page, setPage] = useState(0);
  const all = useMemo(() => data ? collectionRows(data) : [], [data]);
  const selected = { ...query, company, support, cashier, status };
  const rows = useMemo(() => data ? filterCollections(all, data, { ...query, company, support, cashier, status }) : [], [all, data, query, company, support, cashier, status]);
  const totals = data ? collectionSummary(data, rows) : null;
  const companies = [...new Map((data?.cohorts || []).filter(c => c.customerid).map(c => [c.customerid!, c.customer || "Chưa có tên"])).entries()];
  const representatives = new Map<string, [string, string]>();
  for (const c of data?.cohorts || []) if (!representatives.has(cohortSupportKey(c)) || c.id === support) representatives.set(cohortSupportKey(c), [c.id!, cohortSupportLabel(c)]);
  const cashiers = [...new Map(all.map(r => [r.cashierId, r.cashier])).entries()];
  async function download() {
    if (!data || !totals?.complete) return;
    setBusy(true); setError("");
    try {
      const report = buildCollectionReport(data, rows, selected), bytes = await reportXlsx(report);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = reportFilename(report); document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError("Không xuất được Excel; không tạo báo cáo bị cắt hoặc tổng chưa đầy đủ."); }
    finally { setBusy(false); }
  }
  function print() {
    if (!data || !totals?.complete) return;
    setError("");
    try {
      const html = reportPrintHtml(buildCollectionReport(data, rows, selected), 1);
      const popup = window.open("", "_blank", "width=1200,height=900"); if (!popup) throw new Error("Cho phép pop-up để mở bản in.");
      popup.opener = null; popup.document.open(); popup.document.write(html); popup.document.close(); popup.focus(); popup.print();
    } catch (e) { setError(e instanceof Error ? e.message : "Không mở được bản in."); }
  }
  return <>
    <form action="/admin/ksk-collections" className="mb-4 rounded border bg-white p-4" aria-label="Lọc báo cáo thu tiền">
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-sm">Đăng ký từ ngày<input type="date" name="from" required defaultValue={query.from} className="min-w-0 rounded border p-2" /></label>
        <label className="grid gap-1 text-sm">Đăng ký đến ngày<input type="date" name="to" required defaultValue={query.to} className="min-w-0 rounded border p-2" /></label>
        <label className="grid gap-1 text-sm">Thu từ ngày<input type="date" name="collectedFrom" required defaultValue={query.collectedFrom} className="min-w-0 rounded border p-2" /></label>
        <label className="grid gap-1 text-sm">Thu đến ngày<input type="date" name="collectedTo" required defaultValue={query.collectedTo} className="min-w-0 rounded border p-2" /></label>
        <Choice label="Công ty" name="company" value={company} options={companies} onChange={v => { setCompany(v); setPage(0); }} />
        <Choice label="Người phụ trách / CSKH" name="support" value={support} options={[...representatives.values()]} onChange={v => { setSupport(v); setPage(0); }} />
        <Choice label="Nhân viên thu ngân HIS" name="cashier" value={cashier} options={cashiers} onChange={v => { setCashier(v); setPage(0); }} />
        <label className="grid gap-1 text-sm">Trạng thái chứng từ<select name="status" value={status} onChange={e => { setStatus(e.target.value as CollectionQuery["status"]); setPage(0); }} className="rounded border p-2">
          <option value="">Tất cả</option><option value="received">Đối chiếu được</option><option value="deferred">Trả sau — chưa nhận tiền</option><option value="unknown">Chưa xác định</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-3"><button type="submit" className="rounded border border-primary-700 bg-primary-700 px-4 py-2 font-bold text-white hover:bg-primary-900">Đọc / Làm mới HIS</button>
        <a className="rounded border px-3 py-2 text-sm" href={`/admin/ksk-collections?${new URLSearchParams({ from: query.from, to: query.to, collectedFrom: query.collectedFrom, collectedTo: query.collectedTo })}`}>Bỏ lọc công ty / phụ trách / thu ngân</a></div>
      <p className="mt-3 text-xs text-slate-600">Giao của ngày đăng ký tiếp nhận và ngày phiếu thu, không phải ngày tạo đoàn. Mỗi khoảng tối đa 93 ngày, tổng phạm vi tối đa 186 ngày. Chọn bộ lọc tên sẽ lọc ngay dữ liệu đã đọc; đổi ngày cần bấm Đọc/Làm mới.</p>
    </form>
    {data && <>
      <p className="mb-3 text-sm text-slate-600">{data.scope.mode === "demo" ? "GIẢ LẬP — không phải HIS" : `HIS ${data.scope.branch} · Chỉ đọc`} · Đăng ký {query.from} → {query.to} · Ngày thu {query.collectedFrom} → {query.collectedTo} · Đọc lúc {data.scope.asof}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng hợp chứng từ thu"><Card label="Số phiếu trong bộ lọc" value={totals?.count ?? "Chưa xác định"} color="border-slate-300 bg-white" /><Card label="Tiền thu ngày phiếu đối chiếu được" value={money(totals?.received ?? null)} color="border-green-300 bg-green-50" /><Card label="Phiếu trả sau, chưa nhận tiền" value={totals?.deferred ?? 0} color="border-orange-300 bg-orange-50" /><Card label="Phiếu chưa đối chiếu được" value={totals?.unknown ?? 0} color="border-amber-300 bg-amber-50" /></div>
      {!totals?.complete && <p role="alert" className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">Nguồn dữ liệu thiếu hoặc vượt giới hạn. Chưa tính tổng, chưa cho xuất/in; thu hẹp ngày và đọc lại.</p>}
      <details className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><summary className="cursor-pointer font-bold">Phạm vi và cảnh báo</summary><p className="mt-2">Không phải tiền công ty trả hợp đồng. Không bao gồm thu tạm ứng riêng; tiền tạm ứng đã áp dụng không cộng lại vào thu ngày phiếu. Phiếu hủy/hoàn và dịch vụ không nối đủ được giữ Chưa xác định, không cộng vào tổng.</p><ul className="mt-2 list-disc pl-5">{data.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>
      <section className="rounded border bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Danh sách phiếu thu ({rows.length})</h3><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !totals?.complete} onClick={download} className="rounded bg-primary-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xuất…" : "Xuất Excel theo bộ lọc"}</button><button type="button" disabled={busy || !totals?.complete} onClick={print} className="rounded border px-3 py-2 text-sm">In / PDF</button></div></div>
        {error && <p role="alert" className="mb-3 text-sm text-red-800">{error}</p>}
        <p className="mb-3 text-xs text-slate-600">{hisDateTimeNotice}</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{["Công ty / đoàn", "Phụ trách", "Thu ngân", "Người khám", "Ngày giờ đăng ký (HIS)", "Ngày giờ thu (HIS)", "Phiếu / nguồn", "Tiền thu đối chiếu", "Trạng thái / ghi chú"].map(h => <th key={h} className="whitespace-nowrap border-b bg-primary-50 p-2">{h}</th>)}</tr></thead><tbody>{rows.slice(page * 50, page * 50 + 50).map(r => <tr key={r.key} className="border-b"><td className="min-w-40 p-2">{r.company}<br />{r.cohort}</td><td className="min-w-28 whitespace-pre-wrap p-2">{r.support}</td><td className="min-w-28 p-2">{r.cashier}</td><td className="min-w-28 p-2">{r.patient}<br />{r.name}</td><td className="min-w-40 p-2">{r.registered.map(formatHisDateTime).join(" · ") || "Chưa xác định"}</td><td className="min-w-40 p-2">{formatHisDateTime(r.bill.date)}</td><td className="min-w-28 p-2">Quyển {r.bill.book} / Số {r.bill.number}<br />{r.bill.source} · {r.bill.kind}</td><td className="whitespace-nowrap p-2">{money(r.received)}</td><td className="min-w-52 p-2"><span className={`rounded border px-2 py-1 ${r.status === "received" ? "border-green-300 bg-green-50 text-green-900" : r.status === "deferred" ? "border-orange-300 bg-orange-50 text-orange-900" : "border-amber-300 bg-amber-50 text-amber-950"}`}>{r.status === "received" ? "Đối chiếu được" : r.status === "deferred" ? "Trả sau — chưa nhận tiền" : "Chưa xác định"}</span><p className="mt-2">{r.notes.join(" · ")}</p></td></tr>)}</tbody></table></div>
        {!rows.length && <p className="my-3 text-sm">Không có phiếu khớp các bộ lọc trong dữ liệu đã đọc.</p>}
        <div className="mt-3 flex items-center gap-3 text-sm"><button type="button" className="rounded border px-3 py-1 disabled:opacity-50" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page + 1}/{Math.max(1, Math.ceil(rows.length / 50))} · Xuất/in dùng toàn bộ phiếu đã lọc</span><button type="button" className="rounded border px-3 py-1 disabled:opacity-50" disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(p => p + 1)}>Sau</button></div>
      </section>
    </>}
  </>;
}
function Choice({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  const [search, setSearch] = useState("");
  return <div className="grid min-w-0 gap-1 text-sm"><label htmlFor={`collection-${name}`}>{label}</label><input type="search" aria-label={`Tìm ${label.toLowerCase()}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Gõ để tìm…" className="min-w-0 rounded border p-2" /><select id={`collection-${name}`} name={name} value={value} onChange={e => onChange(e.target.value)} className="min-w-0 rounded border p-2"><option value="">Tất cả</option>{options.filter(([id, text]) => id === value || text.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></div>;
}
function Card({ label, value, color }: { label: string; value: string | number; color: string }) {
  return <section className={`rounded border p-4 ${color}`}><h3 className="text-sm">{label}</h3><p className="mt-2 text-xl font-bold">{value}</p></section>;
}
