"use client";
import { useState } from "react";
import type { AdminAction } from "@/lib/admin/permissions";
import type { KskQuery } from "@/lib/ksk/domain";
import { managementKinds, managementLabels, managementFields, fieldLabels, managementRows, managementKey, managementStates, proposalFromRow, draftPermission, managementProposalSchema,
  type ManagementKind, type ManagementRow, type ManagementSnapshot, type ManagementDraft, type ManagementProposal, type ManagementCommand } from "@/lib/ksk/management-contract";

const field = "min-w-0 rounded border bg-white p-2 text-sm disabled:bg-slate-100";
const button = "rounded border border-primary-700 bg-primary-700 px-3 py-2 text-sm font-bold text-white hover:bg-primary-900 disabled:opacity-50";
function newProposal(data: ManagementSnapshot, kind: ManagementKind, query: KskQuery): ManagementProposal {
  const defaults: ManagementRow = { stt: "1", phai: "0", loai: "0", ngay: query.to, tu: query.from, den: query.to, namsinh_tu: "1900", namsinh_den: "9999", id_goi_kskmuc: "0", tinhtrang_honnhan: "2", id_ksk_khachhang: data.customers[0]?.id || "" };
  return { kind, key: "NEW", fields: Object.fromEntries([...managementFields[kind], ...(kind === "member" ? ["iddonvi", "mabn"] : [])].map(f => [f, f === "iddonvi" ? data.groups[0]?.id || "" : defaults[f] || ""])), items: [] };
}
export function ManagementWorkspace({ initialData, initialDrafts, query, username, actions }: { initialData: ManagementSnapshot; initialDrafts: ManagementDraft[]; query: KskQuery; username: string; actions: AdminAction[] }) {
  const [data, setData] = useState(initialData), [drafts, setDrafts] = useState(initialDrafts), [kind, setKind] = useState<ManagementKind>("cohort");
  const [proposal, setProposal] = useState<ManagementProposal | null>(null), [reason, setReason] = useState(""), [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [search, setSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState(""), [serviceId, setServiceId] = useState(""), [actionReason, setActionReason] = useState(""), [confirm, setConfirm] = useState(false);
  const rows = managementRows(data, kind).filter(r => Object.values(r).some(v => v.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))));
  const chosen = drafts.find(d => d.id === selected);
  const permitted = actions.includes(draftPermission(kind));
  const scopeReady = ["customer", "cohort"].includes(kind) || Boolean(query.cohort);
  function changeKind(k: ManagementKind) { setKind(k); setProposal(null); setReason(""); setSearch(""); setError(""); }
  function start(value?: ManagementRow) { setProposal(value ? proposalFromRow(data, kind, value) : newProposal(data, kind, query)); setReason(""); setError(""); setServiceSearch(""); setServiceId(""); }
  function setValue(name: string, value: string) { setProposal(p => p ? { ...p, fields: { ...p.fields, [name]: value } } : p); }
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/ksk-manage?${new URLSearchParams({ ...query })}`, { cache: "no-store" }), payload = await response.json();
      if (!response.ok) { setError(payload.error || "Không đọc được dữ liệu."); return; }
      setData(payload.data); setDrafts(payload.drafts); setProposal(null); setNotice("Đã đọc lại dữ liệu HIS và danh sách phiếu.");
    } catch { setError("Không đọc được dữ liệu quản lý."); } finally { setBusy(false); }
  }
  async function send(command: ManagementCommand) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/ksk-manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) }), payload = await response.json();
      if (!response.ok) { setError(payload.error || "Không xử lý được phiếu. Làm mới để kiểm tra."); return; }
      setDrafts(payload.drafts);
      if (command.action !== "check") { setProposal(null); setReason(""); setActionReason(""); setConfirm(false); }
      if (command.action === "create") setSelected(payload.drafts[0].id);
      setNotice(command.action === "check" ? "Agent đã kiểm tra hợp lệ. Chưa lưu phiếu, chưa ghi HIS." : command.action === "apply" ? "Agent xác nhận đã ghi HIS. Bấm Đọc/Làm mới để đối chiếu dữ liệu sau ghi." : "Đã lưu trạng thái phiếu. Chưa ghi thay đổi vào HIS.");
    } catch { setError("Mất phản hồi. Làm mới và xem mã lệnh/trạng thái trước khi gửi lại; không lập phiếu mới để thay một lệnh chưa rõ kết quả."); }
    finally { setBusy(false); }
  }
  async function lookup() {
    if (!proposal) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/ksk-manage/patient", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mabn: proposal.fields.mabn || "" }), cache: "no-store" }), payload = await response.json();
      if (!response.ok) { setError(payload.error || "Không tìm được mã BN."); return; }
      setProposal(p => p ? { ...p, fields: { ...p.fields, hoten: payload.hoten, namsinh: payload.namsinh, phai: payload.phai } } : p);
    } catch { setError("Không tra được mã BN."); } finally { setBusy(false); }
  }
  function locked(row: ManagementRow) {
    return row.done === "1" || ((kind === "cohort" || kind === "package") && data.hasVisits) || (kind === "member" && (Boolean(row.ngaykham) || data.visitedMembers.includes(managementKey(kind, row)))) || (kind === "group" && data.visitedGroups.includes(row.id));
  }
  return <div className="grid min-w-0 gap-4">
    <section className={`rounded border p-4 text-sm ${data.writeEnabled ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
      <p className="font-bold">HIS {data.branch} · Dữ liệu thật · {data.writeEnabled ? "Agent đã cấu hình mở ghi — chỉ áp dụng phiếu đã duyệt" : "Ghi đang tắt — được đọc / lập nháp / duyệt"}</p>
      <p className="mt-2">Mỗi phiếu một đối tượng. Không tự ghi khi lưu/duyệt. Người đã tiếp nhận bị khóa; không sửa BTDBN, chỉ định, kết quả hoặc chứng từ. Mã nhóm gói không phải ID dòng gói.</p>
      <button type="button" disabled={busy} onClick={refresh} className="mt-3 rounded border bg-white px-3 py-2">Đọc / Làm mới HIS & phiếu</button>
    </section>
    <form action="/admin/ksk-manage" className="grid items-end gap-3 rounded border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chọn đợt quản lý">
      <label className="grid gap-1 text-sm">Từ ngày<input type="date" required name="from" defaultValue={query.from} className={field} /></label>
      <label className="grid gap-1 text-sm">Đến ngày<input type="date" required name="to" defaultValue={query.to} className={field} /></label>
      <label className="grid gap-1 text-sm">ID đợt (để trống: danh sách)<input name="cohort" pattern="[0-9]{1,20}" defaultValue={query.cohort} className={field} /></label><button className={button}>Đọc đợt / danh sách</button>
    </form>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    <section className="min-w-0 rounded border bg-white p-4"><div className="mb-3 flex flex-wrap gap-2" aria-label="Phân hệ quản lý">{managementKinds.map(k => <button key={k} type="button" disabled={busy} aria-pressed={kind === k} onClick={() => changeKind(k)} className={`rounded border px-3 py-2 text-sm ${kind === k ? "bg-primary-700 text-white" : "bg-white"}`}>{managementLabels[k]} ({managementRows(data, k).length})</button>)}</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">{managementLabels[kind]} · {rows.length} dòng</h3><input aria-label="Tìm dữ liệu quản lý" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / mã…" className={field} /><button type="button" disabled={busy || !permitted || !scopeReady} onClick={() => start()} className={button}>Thêm {managementLabels[kind].toLocaleLowerCase("vi")}</button></div>
      {!scopeReady && <p className="mb-3 text-sm text-amber-900">Chọn/mở một đợt trước để quản lý nhóm, danh sách và gói.</p>}
      {!permitted && <p className="mb-3 text-sm text-slate-500">Chỉ xem; chưa cấp quyền lập phiếu loại này.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Mã / khóa", "Tên / nội dung", "Thông tin", "Thao tác"].map(h => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead><tbody>{rows.slice(0, 200).map(r => <tr key={managementKey(kind, r)} className="border-b"><td className="p-2">{managementKey(kind, r)}</td><td className="p-2">{r.ten || r.hoten || r.ghichu || `${r.phai === "0" ? "Nam" : "Nữ"} · ${r.namsinh_tu}–${r.namsinh_den}`}</td><td className="p-2">{kind === "member" ? `Mã NV ${r.manv || "—"} · gói nhóm ${r.id_goi_kskmuc || "0"}` : kind === "package" ? `Gói nhóm ${r.id_goi_kskmuc || "0"} · ${r.namsinh_tu}–${r.namsinh_den}` : r.ghichu || r.sohd || r.tu || "—"}</td><td className="p-2"><div className="flex flex-wrap gap-2">{kind === "cohort" && <a className="rounded border px-3 py-2" href={`/admin/ksk-manage?${new URLSearchParams({ ...query, cohort: r.id })}`}>Mở quản lý</a>}<button type="button" disabled={busy || !permitted || locked(r)} onClick={() => start(r)} className="rounded border px-3 py-2 disabled:opacity-50">{locked(r) ? "Khóa: đã tiếp nhận" : "Sửa / lập phiếu"}</button></div></td></tr>)}</tbody></table></div>
      {rows.length > 200 && <p className="mt-2 text-xs text-amber-900">Hiện 200 dòng đầu, tìm tên/mã để thu hẹp. Không cắt dữ liệu nguồn khi lập phiếu.</p>}
    </section>
    {proposal && <form aria-label="Soạn thay đổi HIS" onSubmit={e => { e.preventDefault(); const checked = managementProposalSchema.safeParse(proposal); if (!checked.success) { setError("Trường/chi tiết gói không hợp lệ; kiểm tra mã, giá và dịch vụ trùng."); return; } void send({ action: "create", query, version: data.version, proposal: checked.data, reason }); }} className="rounded border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">{proposal.key === "NEW" ? "Thêm mới" : `Sửa ${proposal.key}`} · {managementLabels[proposal.kind]}</h3><button type="button" disabled={busy} onClick={() => setProposal(null)} className="rounded border px-3 py-2 text-sm">Bỏ soạn</button></div>
      <fieldset disabled={busy || !permitted} className="grid gap-3 sm:grid-cols-2">
        {Object.entries(proposal.fields).map(([name, value]) => {
          const options = name === "id_ksk_khachhang" ? data.customers : name === "iddonvi" ? data.groups : null;
          return <label key={name} className="grid gap-1 text-sm">{fieldLabels[name] || name}{options ? <select required value={value} onChange={e => setValue(name, e.target.value)} className={field}><option value="">Chọn…</option>{options.map(r => <option key={r.id} value={r.id}>{r.ten} · {r.id}</option>)}</select> : <input required={["ten", "hoten", "mabn", "namsinh", "ngay", "tu", "den", "phai", "stt", "loai", "id_goi_kskmuc", "namsinh_tu", "namsinh_den", "tinhtrang_honnhan"].includes(name)} type={["ngay", "tu", "den"].includes(name) ? "date" : "text"} maxLength={name === "mabn" ? 8 : name === "ten" && kind === "customer" ? 2000 : 254} value={value} onChange={e => setValue(name, e.target.value)} className={field} />}</label>;
        })}
        {proposal.kind === "member" && proposal.key === "NEW" && <div className="sm:col-span-2"><button type="button" onClick={lookup} disabled={busy || !/^\d{8}$/.test(proposal.fields.mabn)} className="rounded border px-3 py-2 text-sm">Tra mã BN / điền họ tên từ HIS</button><p className="mt-2 text-xs text-amber-900">Chỉ thêm mã BN đã tồn tại. Họ tên/năm sinh/giới tính phải khớp BTDBN; chưa cấp mã BN mới và không sửa hồ sơ gốc.</p></div>}
        {proposal.kind === "package" && <div className="min-w-0 rounded border p-3 sm:col-span-2"><h4 className="mb-2 font-bold">Dịch vụ trong gói · giá nguyên đồng</h4><p className="mb-3 text-xs text-slate-600">HIS không có cột số lượng trong KSKMUCCT. Mỗi mã dịch vụ một dòng, giá nội viện/ngoại viện riêng.</p>
          <div className="mb-3 flex flex-wrap gap-2"><input aria-label="Tìm dịch vụ HIS" placeholder="Tìm tên/mã dịch vụ…" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} className={field} /><select aria-label="Chọn dịch vụ HIS" value={serviceId} onChange={e => setServiceId(e.target.value)} className={`${field} max-w-full`}><option value="">Chọn dịch vụ…</option>{data.services.filter(s => s.hide !== "1" && `${s.id} ${s.ma} ${s.ten}`.toLocaleLowerCase("vi").includes(serviceSearch.toLocaleLowerCase("vi"))).slice(0, 100).map(s => <option key={s.id} value={s.id}>{s.ma} · {s.ten}</option>)}</select><button type="button" disabled={!serviceId || proposal.items.some(i => i.mavp === serviceId) || proposal.items.length >= 100} onClick={() => setProposal(p => p ? { ...p, items: [...p.items, { mavp: serviceId, stt: String(p.items.length + 1), gia_nv: "0", gia_ngv: "0", ghichu: "" }] } : p)} className="rounded border px-3 py-2 text-sm">Thêm dịch vụ</button></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Dịch vụ</th><th className="p-2">Giá nội viện</th><th className="p-2">Giá ngoại viện</th><th className="p-2">Ghi chú</th><th className="p-2">Thao tác</th></tr></thead><tbody>{proposal.items.map((item, index) => <tr key={item.mavp} className="border-b"><td className="min-w-40 p-2">{data.services.find(s => s.id === item.mavp)?.ten || item.mavp}</td>{["gia_nv", "gia_ngv", "ghichu"].map(name => <td key={name} className="p-2"><input aria-label={`${fieldLabels[name]} ${index + 1}`} required={name !== "ghichu"} type={name === "ghichu" ? "text" : "number"} min={0} max={9999999999} step={1} value={item[name]} onChange={e => setProposal(p => p ? { ...p, items: p.items.map((r, i) => i !== index ? r : { ...r, [name]: e.target.value }) } : p)} className={`${field} w-36`} /></td>)}<td className="p-2"><button type="button" onClick={() => setProposal(p => p ? { ...p, items: p.items.filter((_, i) => i !== index) } : p)} className="rounded border px-3 py-2 text-red-800">Bỏ</button></td></tr>)}</tbody></table></div>
        </div>}
        <label className="grid gap-1 text-sm sm:col-span-2">Lý do thay đổi<textarea required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className={field} /></label><div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" className={button}>Lưu bản nháp — chưa ghi HIS</button><button type="button" disabled={busy || reason.trim().length < 5} onClick={() => send({ action: "check", query, version: data.version, proposal, reason })} className="rounded border px-3 py-2 text-sm">Kiểm tra trước — chưa lưu</button></div>
      </fieldset>
    </form>}
    <section className="rounded border bg-white p-4"><h3 className="mb-3 font-bold">Phiếu thay đổi HIS ({drafts.length})</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Loại / đối tượng", "Trạng thái", "Người lập / duyệt", "Đợt", ""].map(h => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead><tbody>{drafts.map(d => <tr key={d.id} className="border-b"><td className="p-2">{managementLabels[d.proposal.kind]} · {d.proposal.fields.ten || d.proposal.fields.hoten || d.proposal.fields.ghichu || d.proposal.key}</td><td className="p-2">{managementStates[d.state]}</td><td className="p-2">{d.author} / {d.reviewer || "Chưa duyệt"}</td><td className="p-2">{d.query.cohort || "Tạo cấu hình mới"}</td><td className="p-2"><button type="button" disabled={busy} onClick={() => { setSelected(d.id); setActionReason(""); setConfirm(false); }} className="rounded border px-3 py-2">Xem / xử lý</button></td></tr>)}</tbody></table></div></section>
    {chosen && <section aria-label="Đối chiếu phiếu HIS" className="rounded border bg-white p-4"><h3 className="font-bold">{managementStates[chosen.state]} · {managementLabels[chosen.proposal.kind]}</h3><p className="my-2 break-all text-xs text-slate-500">Mã lệnh {chosen.id} · v{chosen.revision} · {chosen.branch}</p>
      <div className="grid min-w-0 gap-3 md:grid-cols-2"><Comparison title="Trước — HIS khi lập phiếu" value={chosen.before} /><Comparison title="Sau — đề nghị đã lưu" value={chosen.proposal} /></div>
      <p className="my-3 text-sm">Người lập: {chosen.author} · Duyệt: {chosen.reviewer || "Chưa duyệt"} · Người áp dụng: {chosen.appliedBy || "Chưa áp dụng"}</p>
      {chosen.author.toLowerCase() === username.toLowerCase() && chosen.state === "submitted" && <p className="my-3 text-sm text-amber-900">Không được tự duyệt; cần người khác kiểm soát.</p>}
      <label className="my-3 grid gap-1 text-sm">Lý do xử lý (ít nhất 5 ký tự)<textarea disabled={busy} minLength={5} maxLength={500} value={actionReason} onChange={e => setActionReason(e.target.value)} className={field} /></label>
      {actions.includes("ksk_manage_apply") && ["approved", "uncertain", "applying"].includes(chosen.state) && <label className="my-3 flex items-center gap-2 text-sm text-red-900"><input type="checkbox" checked={confirm} disabled={busy} onChange={e => setConfirm(e.target.checked)} />Tôi xác nhận nội dung đã duyệt và yêu cầu ghi vào HIS {chosen.branch} thật bằng đúng mã lệnh này</label>}
      <div className="flex flex-wrap gap-3">
        {chosen.author.toLowerCase() === username.toLowerCase() && ["draft", "rejected"].includes(chosen.state) && actions.includes(draftPermission(chosen.proposal.kind)) && <button type="button" disabled={busy || actionReason.trim().length < 5} onClick={() => send({ action: "submit", id: chosen.id, revision: chosen.revision, reason: actionReason })} className={button}>Gửi duyệt</button>}
        {chosen.author.toLowerCase() !== username.toLowerCase() && chosen.state === "submitted" && actions.includes("ksk_manage_approve") && <><button type="button" disabled={busy || actionReason.trim().length < 5} onClick={() => send({ action: "approve", id: chosen.id, revision: chosen.revision, reason: actionReason })} className={button}>Duyệt phiếu HIS</button><button type="button" disabled={busy || actionReason.trim().length < 5} onClick={() => send({ action: "reject", id: chosen.id, revision: chosen.revision, reason: actionReason })} className="rounded border px-3 py-2 text-sm text-red-800">Từ chối</button></>}
        {["approved", "uncertain", "applying"].includes(chosen.state) && actions.includes("ksk_manage_apply") && <button type="button" disabled={busy || !confirm || actionReason.trim().length < 5 || (!data.writeEnabled && chosen.state === "approved")} onClick={() => send({ action: "apply", id: chosen.id, revision: chosen.revision, reason: actionReason })} className={`${button} border-red-800 bg-red-800 hover:bg-red-900`}>{chosen.state === "approved" ? "Áp dụng vào HIS thật" : "Kiểm tra / áp dụng lại ĐÚNG mã lệnh"}</button>}
      </div>
      <details open className="mt-4"><summary className="cursor-pointer font-bold">Lịch sử xử lý</summary><ol className="mt-2 grid gap-2 text-sm">{chosen.history.map((event, i) => <li key={i} className="rounded bg-slate-50 p-2">{new Date(event.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {event.actor} · {event.action}<p className="mt-1 whitespace-pre-wrap">{event.reason}</p></li>)}</ol></details>
    </section>}
  </div>;
}
function Comparison({ title, value }: { title: string; value: ManagementProposal | null }) {
  return <section className="min-w-0 rounded border p-3 text-sm"><h4 className="mb-3 font-bold">{title}</h4>{!value ? <p>Chưa có — thêm mới</p> : <><dl className="grid grid-cols-2 gap-2">{Object.entries(value.fields).map(([key, val]) => <div key={key} className="min-w-0"><dt className="text-xs text-slate-500">{fieldLabels[key] || key}</dt><dd className="whitespace-pre-wrap break-words">{val || "—"}</dd></div>)}</dl>{value.items.length > 0 && <ul className="mt-3 grid gap-2">{value.items.map(item => <li key={item.mavp}>Dịch vụ {item.mavp} · Nội viện {item.gia_nv} đ · Ngoại viện {item.gia_ngv} đ · {item.ghichu}</li>)}</ul>}</>}</section>;
}
