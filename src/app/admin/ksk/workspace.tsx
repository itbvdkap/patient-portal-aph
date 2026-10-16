"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ClipboardCheck, FlaskConical, LockKeyhole, Users, Wallet } from "lucide-react";
import { chargeTotal, cohortSupportKey, cohortSupportLabel, concluded, hasResults, memberRecords, money, sectionComplete, summarize, type KskQuery, type KskRow, type KskSnapshot } from "@/lib/ksk/domain";
import { paymentDashboard, paymentLinksCharge, paymentStates, type PaymentState } from "@/lib/ksk/payment";
import { filterChoices, KskFilterBar, type KskFilters } from "./filters";
import { KskReports } from "./reports";
import { formatHisDateTime, hisDateTimeNotice } from "@/lib/ksk/datetime";
import { plainClsResult } from "@/lib/ksk/rtf-text";

const box = "rounded-md border border-cream-200 bg-white p-4 shadow-sm";
const kindLabels: Record<string, string> = { BASK_NOIKHOA: "Nội khoa", BASK_NGKHOA: "Ngoại khoa", BASK_MAT: "Mắt", BASK_RHM: "Răng hàm mặt", BASK_TMH: "Tai mũi họng", BASK_SANPHU: "Sản phụ khoa", BASK_TONGKET: "Kết luận sức khỏe" };
const clinicalLabels: Record<string, string> = { ketluan: "Kết luận", nhanxet: "Nhận xét", loai_kl: "Phân loại", denghi: "Đề nghị", timmach: "Tim mạch", hohap: "Hô hấp", tieuhoa: "Tiêu hóa", than: "Thận", thankinh: "Thần kinh", tongquat: "Tổng quát", dalieu: "Da liễu", mat: "Mắt", tmh: "Tai mũi họng", san: "Sản", phu: "Phụ khoa", khac: "Khác" };

export function KskWorkspace({ data, query, choices = data.cohorts, filters = { company: "", support: "" } }: { data: KskSnapshot; query: KskQuery; choices?: KskRow[]; filters?: KskFilters }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<KskRow | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentState | "">("");
  const filteredCohorts = filterChoices(choices, filters).filter(c => data.cohorts.some(row => row.id === c.id));
  const stats = useMemo(() => summarize(data), [data]);
  const finance = useMemo(() => paymentDashboard(data), [data]);
  const uniqueMembers = useMemo(() => [...new Map(data.members.map(r => [`${r.groupid}:${r.mabn}`, r])).values()], [data.members]);
  const members = uniqueMembers.filter(r => (!group || r.groupid === group) && (!paymentFilter || finance.payments.get(`${r.groupid}:${r.mabn}`)?.status === paymentFilter)
    && `${r.name} ${r.mabn} ${r.manv}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  const pageCount = Math.max(1, Math.ceil(members.length / 50));
  const visibleMembers = members.slice((Math.min(page, pageCount) - 1) * 50, Math.min(page, pageCount) * 50);
  const groups = [...new Map(uniqueMembers.map(r => [r.groupid, r.groupname])).entries()];
  const records = selected ? memberRecords(data, selected) : null;
  const visitsKnown = sectionComplete(data, "visits");
  const selectedPayment = selected ? finance.payments.get(`${selected.groupid}:${selected.mabn}`) : null;
  const viewUrl = (cohort: string) => `/admin/ksk?${new URLSearchParams({ ...query, ...filters, cohort })}`;
  return <>
    <KskFilterBar query={query} rows={choices} filters={filters} />
    <div className={`${box} mb-4 flex flex-wrap items-center justify-between gap-2 text-sm`}>
      <span className="inline-flex items-center gap-2 font-bold text-primary-800"><LockKeyhole size={16} />{data.scope.mode === "demo" ? "GIẢ LẬP — không phải HIS" : `HIS ${data.scope.branch} · Chỉ đọc`}</span>
      <span className="text-slate-500">Đọc lúc {new Date(data.scope.asof).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
    </div>
    {data.warnings.length > 0 && <details open className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <summary className="cursor-pointer font-bold">Phạm vi & cảnh báo dữ liệu ({data.warnings.length})</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">{data.warnings.map(w => <li key={w}>{w}</li>)}</ul>
    </details>}
    {!query.cohort ? <section className={box}>
      <h3 className="text-lg font-bold">Danh sách đoàn / đợt khám</h3>
      <p className="mt-2 text-xs text-slate-500">Nguồn phụ trách / CSKH: ghi chú đợt khám trong HIS. Lọc trong các đợt đã đọc theo khoảng ngày; không tự tách tên nhân viên từ ghi chú.</p>
      <p className="mt-3 text-sm font-semibold" role="status" aria-live="polite">{sectionComplete(data, "cohorts") ? `${filteredCohorts.length} / ${data.cohorts.length} đợt khám` : "Danh sách chưa xác định"}</p>
      <Table headers={["Khách hàng", "Đợt khám", "Phụ trách / CSKH", "Hợp đồng", "Ngày", ""]} rows={filteredCohorts.map(c => [
        c.customer, c.name, <SupportNote key="support" row={c} />, c.sohd, c.date?.slice(0, 10),
        <Link key={c.id} className="font-bold text-primary-800 underline" href={viewUrl(c.id!)}>Xem tiến độ →</Link>
      ])} empty={sectionComplete(data, "cohorts") ? "Không có đợt phù hợp với khoảng ngày và bộ lọc." : "Danh sách chưa xác định."} />
    </section> : <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm text-slate-500">{data.cohorts[0]?.customer}</p><h3 className="text-xl font-bold">{data.cohorts[0]?.name ?? "Không tìm thấy đợt khám"}</h3>
          {data.cohorts[0] && <div className="mt-2 text-sm"><span className="font-semibold">Phụ trách / CSKH: </span><SupportNote row={data.cohorts[0]} /><p className="mt-1 text-xs text-slate-500">Theo ghi chú đợt khám trong HIS.</p></div>}
        </div>
        <Link href={viewUrl("")} className="text-sm font-bold text-primary-800 underline">← Danh sách đoàn</Link>
      </div>
      <h3 className="mb-3 text-lg font-bold">Tiến độ khám</h3>
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Dashboard tiến độ đợt khám">
        {[
          { label: "Người trong danh sách", value: stats.expected, icon: Users, hint: "Theo nhóm thuộc đợt" },
          { label: "Có lượt đăng ký", value: stats.registered, icon: Activity, hint: "Trong phạm vi ngày chọn" },
          { label: "Có kết quả CLS", value: stats.withResults, icon: FlaskConical, hint: "Có ít nhất một giá trị, chưa khẳng định đủ" },
          { label: "Có kết luận & bác sĩ", value: stats.concluded, icon: ClipboardCheck, hint: "Chưa xác minh duyệt/ký" },
          { label: "Chi phí phát sinh", value: money(stats.amount), icon: Wallet, hint: "Chưa đối soát hủy/hoàn/công nợ" },
        ].map(c => <article key={c.label} className={box}><c.icon size={19} className="mb-3 text-primary-700" /><p className="text-sm text-slate-600">{c.label}</p><p className="my-2 text-xl font-bold">{c.value ?? "Chưa xác định"}</p><p className="text-xs text-slate-500">{c.hint}</p></article>)}
      </section>
      <section className="mb-5" aria-label="Thanh toán theo chứng từ HIS">
        <h3 className="mb-2 text-lg font-bold">Thanh toán theo chứng từ HIS</h3>
        <p className="mb-3 text-sm text-slate-600">Số người theo chứng từ và dịch vụ đã đối chiếu; không đồng nghĩa công ty đã trả tiền hợp đồng. Nhấn ô để lọc danh sách.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(Object.entries(paymentStates) as [PaymentState, typeof paymentStates[PaymentState]][]).map(([state, meta]) => <button type="button" key={state}
            className={`rounded-md border p-4 text-left ${meta.color} ${paymentFilter === state ? "ring-2 ring-primary-700" : ""}`}
            aria-pressed={paymentFilter === state} onClick={() => { setPaymentFilter(paymentFilter === state ? "" : state); setPage(1); }}>
            <span className="block text-sm font-semibold">{meta.label}</span><span className="my-2 block text-xl font-bold">{finance.counts[state] ?? "Chưa xác định"}</span><span className="text-xs">người · Nhấn để lọc</span>
          </button>)}
        </div>
      </section>
      <KskReports data={data} allMembers={uniqueMembers} filteredMembers={members}
        filterLabel={`Nhóm: ${groups.find(([id]) => id === group)?.[1] || "Tất cả"} · Thanh toán: ${paymentFilter ? paymentStates[paymentFilter].label : "Tất cả"} · Tìm người: ${search || "Không lọc"}`} />
      <section className={box}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Danh sách người khám</h3>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="ksk-search">Tìm người khám</label><input id="ksk-search" className="rounded border p-2 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tên, mã BN hoặc mã nhân viên" />
            <label className="sr-only" htmlFor="ksk-group">Nhóm khám</label><select id="ksk-group" className="rounded border p-2 text-sm" value={group} onChange={e => { setGroup(e.target.value); setPage(1); }}><option value="">Tất cả nhóm</option>{groups.map(([id, name]) => <option key={id} value={id!}>{name}</option>)}</select>
            <label className="sr-only" htmlFor="ksk-payment">Trạng thái thanh toán</label><select id="ksk-payment" className="rounded border p-2 text-sm" value={paymentFilter}
              onChange={e => { setPaymentFilter(e.target.value as PaymentState | ""); setPage(1); }}><option value="">Tất cả trạng thái thanh toán</option>{Object.entries(paymentStates).map(([state, meta]) => <option key={state} value={state}>{meta.label}</option>)}</select>
          </div>
        </div>
        <Table headers={["Mã BN / NV", "Họ tên", "Nhóm", "Tiếp nhận trong phạm vi", "Kết quả / kết luận", "Thanh toán", "Số phải thu", "Đã thu ròng", "Còn chưa thu", "Ghi chú", ""]}
          rows={visibleMembers.map(m => {
            const r = memberRecords(data, m);
            const resultsKnown = sectionComplete(data, "labs") && sectionComplete(data, "imaging") && visitsKnown;
            const payment = finance.payments.get(`${m.groupid}:${m.mabn}`)!;
            return [<span key="id">{m.mabn}<br /><small>{m.manv}</small></span>, m.name, m.groupname,
              !visitsKnown ? "Chưa xác định" : r.visits.length ? "Có lượt đăng ký" : "Chưa có lượt",
              `${resultsKnown ? hasResults(r) ? "Có kết quả" : "Chưa có kết quả" : "CLS chưa xác định"} · ${concluded(r.clinical) ? "Có kết luận" : "Chưa xác nhận kết luận"}`,
              <PaymentBadge key="payment" state={payment.status} />, money(payment.due), money(payment.net), money(payment.outstanding),
              <span key="notes" className={payment.status === "partial" ? "font-semibold text-orange-900" : payment.status === "unknown" ? "text-amber-900" : "text-slate-600"}>{payment.notes.join(" · ") || "Theo chứng từ HIS"}</span>,
              <button key="view" className="rounded border border-primary-200 px-3 py-1 font-bold text-primary-800" onClick={() => setSelected(m)}>Xem hồ sơ</button>];
          })} empty={sectionComplete(data, "members") ? "Không có người khớp bộ lọc." : "Danh sách thành viên chưa xác định."} />
        <div className="mt-3 flex items-center justify-between text-sm"><span>{members.length} người · Trang {Math.min(page, pageCount)}/{pageCount}</span><div className="flex gap-2"><button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Sau</button></div></div>
      </section>
      {selected && records && <section className={`${box} mt-5`} aria-label="Hồ sơ kết quả từng người">
        <div className="mb-3 flex justify-between gap-3"><div><h3 className="text-xl font-bold">{selected.name}</h3><p className="text-sm text-slate-500">{selected.mabn} · {selected.groupname} · Năm sinh {selected.namsinh ?? "—"}</p></div><button onClick={() => setSelected(null)} className="self-start rounded border px-3 py-1">Đóng hồ sơ</button></div>
        <p className="mb-4 rounded bg-primary-50 p-3 text-sm">Chi phí phát sinh: <strong>{money(sectionComplete(data, "charges") && visitsKnown ? chargeTotal(records.charges) : null)}</strong>. Không phải công nợ hợp đồng.</p>
        {selectedPayment && <details open className="mb-4"><summary className="cursor-pointer font-bold">Chứng từ thanh toán</summary>
          <div className="my-3 flex flex-wrap items-center gap-3 text-sm"><PaymentBadge state={selectedPayment.status} /><span>Phải thu: {money(selectedPayment.due)}</span><span>Đã thu ròng: {money(selectedPayment.net)}</span><span>Còn chưa thu: {money(selectedPayment.outstanding)}</span></div>
          {selectedPayment.notes.map(note => <p key={note} className="my-2 text-sm text-amber-900">{note}</p>)}
          <p className="my-2 text-xs text-slate-600">{hisDateTimeNotice}</p>
          <Table headers={["Loại / số phiếu", "Ngày giờ thu (HIS)", "Tổng gốc phiếu", "Miễn giảm", "Trả thiếu / trả sau", "Hoàn trả ghi nhận", "Dịch vụ liên kết"]}
            rows={selectedPayment.receipts.map(b => [`${b.kind === "DIRECT" ? "Thu trực tiếp" : "Thanh toán"} · ${b.book}/${b.number} · ID ${b.receiptid}`, formatHisDateTime(b.date),
              b.gross, b.waiver, `${b.debt ?? "—"} · ${b.deferred === "1" ? "Trả sau" : "Không đánh dấu trả sau"}`, `${b.refundamount ?? "—"}${b.refunddate ? ` · ${formatHisDateTime(b.refunddate)}` : ""}`,
              [...new Map(data.payments.filter(r => r.source === b.source && r.kind === b.kind && r.receiptid === b.receiptid).map(r => [r.lineid, r])).values()].map(r => {
                const c = records.charges.find(c => paymentLinksCharge(r, c));
                return `${c?.name ?? "Ngoài phạm vi / chưa nối"} (chỉ định ${r.chargeid ?? "?"}; ${r.chargetable ?? "?"})`;
              }).join(" · ")])} empty="Không thấy chứng từ liên kết trong các tháng đọc. Không dùng PAID để xác nhận đã thu." />
        </details>}
        <details open className="mb-4"><summary className="cursor-pointer font-bold">Lượt khám ({records.visits.length})</summary><Table headers={["MAQL", "MAVAOVIEN", "Ngày giờ tiếp nhận (HIS)", "Khoa/phòng"]} rows={records.visits.map(v => [v.maql, v.episodeid, formatHisDateTime(v.date), v.makp])} /></details>
        <details open className="mb-4"><summary className="cursor-pointer font-bold">Khám chuyên khoa & kết luận</summary>
          {records.clinical.length === 0 && <p className="p-3 text-sm text-slate-500">Không có dữ liệu trong phạm vi đọc; xem cảnh báo nguồn phía trên.</p>}
          {records.clinical.map((r, i) => <article key={i} className="my-2 rounded border p-3"><h4 className="font-bold">{kindLabels[r.kind!] ?? r.kind} · BS {r.mabs || "chưa ghi nhận"}</h4><p className="text-xs text-slate-500">Lượt vào viện: {r.episodeid}</p>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">{Object.entries(clinicalLabels).filter(([k]) => r[k]?.trim()).map(([k, label]) => <div key={k}><dt className="text-slate-500">{label}</dt><dd className="whitespace-pre-wrap break-words">{r[k]}</dd></div>)}</dl>
            {!Object.keys(clinicalLabels).some(k => r[k]?.trim()) && <p className="mt-2 text-sm text-slate-500">Có bản ghi khởi tạo, chưa thấy nội dung kết quả.</p>}
          </article>)}
        </details>
        <details open className="mb-4"><summary className="cursor-pointer font-bold">Xét nghiệm ({records.labs.length} thông số)</summary><p className="my-2 text-xs text-amber-800">Có giá trị chưa đồng nghĩa đã duyệt. Không dùng số thông số để tính số dịch vụ/tiền.</p><Table headers={["Thông số", "Kết quả", "Đơn vị", "Cờ bất thường"]} rows={records.labs.map(r => [r.name, r.value, r.unit, r.kq_batthuong === "1" ? "Có" : r.kq_batthuong === "0" ? "Không" : "Chưa xác định"])} /></details>
        <details open className="mb-4"><summary className="cursor-pointer font-bold">CDHA / siêu âm / X-quang</summary><Table headers={["Dịch vụ", "Kết quả (văn bản)", "Đề nghị"]} rows={records.imaging.map(r => [r.name, <PlainResult key="result" value={r.value} />, r.denghi])} /></details>
        <details className="mb-4"><summary className="cursor-pointer font-bold">Chi tiết phát sinh ({records.charges.length} dòng)</summary><Table headers={["Dịch vụ", "SL", "Đơn giá", "Thành tiền", "Cờ PAID nguồn (không xác nhận thu)"]} rows={records.charges.map(r => [r.name, r.quantity, r.price, r.amount, r.paid ?? "—"])} /></details>
      </section>}
    </>}
  </>;
}

function SupportNote({ row }: { row: KskRow }) {
  const key = cohortSupportKey(row);
  return <span className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${key === "blank" || key === "unknown" ? "text-slate-500 italic" : "text-primary-900"}`}>{cohortSupportLabel(row)}</span>;
}
function PaymentBadge({ state }: { state: PaymentState }) {
  return <span className={`inline-block rounded-full border px-2 py-1 text-xs font-semibold ${paymentStates[state].color}`}>{paymentStates[state].label}</span>;
}

function PlainResult({ value }: { value?: string | null }) {
  // Render text only. The original RTF remains in HIS, never as injected HTML.
  return <span className="whitespace-pre-wrap">{plainClsResult(value)}</span>;
}
function Table({ headers, rows, empty = "Không có dữ liệu trong phạm vi; kiểm tra cảnh báo nguồn." }: { headers: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{headers.map((h, i) => <th key={i} className="whitespace-nowrap border-b bg-primary-50 p-3 font-bold text-primary-900">{h}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={headers.length} className="p-4 text-slate-500">{empty}</td></tr> : rows.map((row, i) => <tr key={i} className="border-b border-cream-100 hover:bg-cream-50">{row.map((cell, j) => <td key={j} className="max-w-lg break-words p-3 align-top">{cell ?? "—"}</td>)}</tr>)}</tbody></table></div>;
}
