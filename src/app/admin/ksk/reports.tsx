"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { buildKskReport, memberResultState, resultStates, type ReportKind, type ResultState } from "@/lib/ksk/reports";
import { reportFilename, reportPrintHtml, reportXlsx } from "@/lib/ksk/report-export";
import type { KskRow, KskSnapshot } from "@/lib/ksk/domain";

export function KskReports({ data, allMembers, filteredMembers, filterLabel }: {
  data: KskSnapshot; allMembers: KskRow[]; filteredMembers: KskRow[]; filterLabel: string;
}) {
  const [kind, setKind] = useState<ReportKind | "">("");
  const [scope, setScope] = useState("filtered");
  const [resultFilter, setResultFilter] = useState<ResultState | "">("");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generated = useMemo(() => {
    if (!kind) return { report: null, error: "" };
    const members = (scope === "all" ? allMembers : filteredMembers).filter(m => kind !== "results" || !resultFilter || memberResultState(data, m) === resultFilter);
    try { return { report: buildKskReport(data, members, kind, `${scope === "all" ? "Toàn bộ đợt" : filterLabel}${kind === "results" && resultFilter ? ` · ${resultStates[resultFilter]}` : ""}`), error: "" }; }
    catch (e) { return { report: null, error: e instanceof Error ? e.message : "Không lập được báo cáo." }; }
  }, [kind, scope, allMembers, filteredMembers, resultFilter, data, filterLabel]);
  const quickResults = useMemo(() => {
    try { return { report: buildKskReport(data, filteredMembers, "results", `${filterLabel} · Bảng ngang mỗi BN một hàng`), error: "" }; }
    catch (e) { return { report: null, error: e instanceof Error ? e.message : "Không lập được báo cáo kết quả." }; }
  }, [data, filteredMembers, filterLabel]);
  const report = generated.report;
  const sheet = report?.sheets[sheetIndex] ?? report?.sheets[0];
  const open = (next: ReportKind) => { setKind(next); setSheetIndex(0); setError(""); };
  async function download(target = report) {
    if (!target) return;
    setBusy(true); setError("");
    try {
      const bytes = await reportXlsx(target);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = reportFilename(target);
      document.body.append(link); link.click(); link.remove();
      // Give the browser time to consume the object URL; no patient data in storage.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError("Không xuất được Excel. Thử thu hẹp nhóm/người hoặc kiểm tra trình duyệt; không có file dữ liệu bị cắt."); }
    finally { setBusy(false); }
  }
  function print() {
    if (!report) return;
    setError("");
    try {
      const html = reportPrintHtml(report, sheetIndex);
      const popup = window.open("", "_blank", "width=1200,height=900");
      if (!popup) throw new Error("Trình duyệt chặn cửa sổ in. Cho phép pop-up từ ứng dụng nội bộ rồi thử lại.");
      popup.opener = null; popup.document.open(); popup.document.write(html); popup.document.close(); popup.focus(); popup.print();
    } catch (e) { setError(e instanceof Error ? e.message : "Không mở được bản in."); }
  }
  return <section className="mb-5 rounded-md border border-cream-200 bg-white p-4 shadow-sm" aria-label="Báo cáo đoàn khám">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Báo cáo theo đoàn</h3><p className="mt-1 text-xs text-slate-500">Xuất trực tiếp danh sách đang lọc, hoặc mở tùy chọn chi tiết để chọn phạm vi/bảng in.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !quickResults.report} onClick={() => download(quickResults.report)}
          className="inline-flex items-center gap-2 rounded bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">
          <FileSpreadsheet size={17} />{busy ? "Đang tạo Excel…" : `Xuất Excel XN + CLS (${filteredMembers.length} BN)`}
        </button>
        <button type="button" className="rounded border px-3 py-2 text-sm font-semibold text-primary-800" aria-pressed={kind === "collections"} onClick={() => open("collections")}>Danh sách & thu tiền</button>
        <button type="button" className="rounded border px-3 py-2 text-sm font-semibold text-primary-800" aria-pressed={kind === "results"} onClick={() => open("results")}>Kết quả XN / CLS</button></div>
    </div>
    <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">
      <strong>Excel XN + CLS:</strong> sheet “KQ XN-CLS theo người” có mỗi bệnh nhân một hàng; từng thông số xét nghiệm và dịch vụ CLS là một cột. Ô xét nghiệm chỉ chứa giá trị, CLS hiển thị văn bản thuần; báo cáo không kèm mã phiếu/nguồn. Khi cần kiểm tra bản gốc, đối chiếu HIS.
    </div>
    {!kind && (error || quickResults.error) && <p role="alert" className="my-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error || quickResults.error}</p>}
    {kind && <>
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm" htmlFor="ksk-report-scope">Danh sách xuất<select id="ksk-report-scope" className="rounded border p-2" value={scope} onChange={e => { setScope(e.target.value); setSheetIndex(0); }}>
          <option value="filtered">Theo bộ lọc người khám ({filteredMembers.length})</option><option value="all">Toàn bộ đợt ({allMembers.length})</option></select></label>
        {kind === "results" && <label className="grid gap-1 text-sm" htmlFor="ksk-report-results">Trạng thái kết quả<select id="ksk-report-results" className="rounded border p-2" value={resultFilter} onChange={e => { setResultFilter(e.target.value as ResultState | ""); setSheetIndex(0); }}>
          <option value="">Tất cả trạng thái kết quả</option>{Object.entries(resultStates).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        {report && <label className="grid gap-1 text-sm" htmlFor="ksk-report-sheet">Bảng xem / in<select id="ksk-report-sheet" className="rounded border p-2" value={sheetIndex} onChange={e => { setSheetIndex(Number(e.target.value)); setError(""); }}>
          {report.sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</select></label>}
        <button type="button" disabled={busy || !report} onClick={() => download()} className="rounded bg-primary-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang tạo Excel…" : "Xuất Excel đầy đủ"}</button>
        <button type="button" disabled={busy || !report} onClick={print} className="rounded border px-3 py-2 text-sm font-bold disabled:opacity-50">In bảng đang chọn / PDF</button>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setKind("")}>Đóng báo cáo</button>
      </div>
      {(error || generated.error) && <p role="alert" className="my-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error || generated.error}</p>}
      {report && sheet && <>
        <h4 className="font-bold">{report.title}</h4><p className="my-2 text-sm" role="status">{report.memberCount} người · {sheet.name}: {sheet.rows.length} dòng · Excel chứa tất cả bảng, không chỉ trang xem trước.</p>
        <p className="mb-3 text-xs text-slate-500">Bộ lọc: {report.metadata.find(([key]) => key === "Bộ lọc báo cáo")?.[1]}</p>
        <details className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><summary className="cursor-pointer font-bold">Phạm vi, dữ liệu cá nhân và cảnh báo ({report.warnings.length})</summary><ul className="mt-2 list-disc space-y-1 pl-4">{report.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>
        {sheet.headers.length > 14 && <p className="my-2 text-xs text-amber-900">Bảng rộng: cuộn ngang để xem, xuất Excel để giữ mọi thông số hoặc chọn bảng chi tiết để in A4.</p>}
        <div className="max-h-[32rem] overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{sheet.headers.map((h, i) => <th key={i} className="whitespace-nowrap border-b bg-primary-50 p-2">{h}</th>)}</tr></thead><tbody>
          {sheet.rows.slice(0, 50).map((row, i) => <tr key={i} className="border-b">{row.map((cell, j) => <td key={j} className="min-w-24 max-w-sm whitespace-pre-wrap break-words p-2 align-top">{typeof cell === "string" && cell.length > 1000 ? `${cell.slice(0, 1000)}… [Xem nguyên nội dung trong Excel]` : cell ?? "—"}</td>)}</tr>)}
          {!sheet.rows.length && <tr><td colSpan={sheet.headers.length} className="p-3">Không có dữ liệu khớp bộ lọc.</td></tr>}
        </tbody></table></div>
        {sheet.rows.length > 50 && <p className="mt-2 text-xs text-slate-500">Xem trước 50/{sheet.rows.length} dòng. Bản in/Excel dùng toàn bộ dòng trong phạm vi, không chỉ 50 dòng này.</p>}
      </>}
    </>}
  </section>;
}
