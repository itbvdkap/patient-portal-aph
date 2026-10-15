"use client";

import { useState } from "react";
import type { AdminAction } from "@/lib/admin/permissions";
import { changeDraftAction, changeProposalSchema, changeStates, packageTotal, type ChangeCommand, type ChangeDraft, type ChangeLabSnapshot, type ChangeProposal, type LabTarget } from "@/lib/ksk/change-contract";
import { money } from "@/lib/ksk/domain";

const button = "rounded border border-primary-700 bg-primary-700 px-3 py-2 text-sm font-bold text-white hover:bg-primary-900 disabled:opacity-50";
const field = "min-w-0 rounded border bg-white p-2 text-sm disabled:bg-slate-100";
function sourceLocked(target: LabTarget, targets: LabTarget[]) {
  return target.hasVisit || (target.value.kind === "package" && targets.some(t => t.hasVisit && t.value.kind === "member" && t.value.packageId === target.id));
}
function blankMember(data: ChangeLabSnapshot): ChangeProposal {
  return { kind: "member", name: "", birthYear: 1990, sex: "female", employeeCode: "", department: "", groupId: data.groups[0].id, packageId: data.targets.find(t => t.value.kind === "package")!.id };
}
function when(value: string) { return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }); }
export function ChangeWorkspace({ initialData, username, actions }: { initialData: ChangeLabSnapshot; username: string; actions: AdminAction[] }) {
  const [data, setData] = useState(initialData), [targetId, setTargetId] = useState(initialData.targets[0].id);
  const [proposal, setProposal] = useState<ChangeProposal>(initialData.targets[0].value), [reason, setReason] = useState("");
  const [editing, setEditing] = useState<ChangeDraft | null>(null), [selectedId, setSelectedId] = useState("");
  const [actionReason, setActionReason] = useState(""), [confirmApply, setConfirmApply] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const selected = data.drafts.find(d => d.id === selectedId);
  const canEdit = actions.includes(changeDraftAction(proposal.kind));
  const isLocked = targetId !== "NEW" && Boolean(data.targets.find(t => t.id === targetId && sourceLocked(t, data.targets)));
  function chooseTarget(id: string) {
    setTargetId(id); setEditing(null); setReason(""); setError("");
    setProposal(id === "NEW" ? blankMember(data) : data.targets.find(t => t.id === id)!.value);
  }
  function openDraft(draft: ChangeDraft) { setSelectedId(draft.id); setActionReason(""); setConfirmApply(false); setError(""); }
  function editDraft(draft: ChangeDraft) {
    setEditing(draft); setTargetId(draft.before === null ? "NEW" : draft.targetId); setProposal(draft.after); setReason(draft.reason); openDraft(draft);
  }
  async function send(command: ChangeCommand) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/ksk-changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "Không lưu được phiếu; làm mới để kiểm tra."); return; }
      setData(payload); setEditing(null); setReason(""); setActionReason(""); setConfirmApply(false);
      setProposal(targetId === "NEW" ? blankMember(payload) : payload.targets.find((t: LabTarget) => t.id === targetId)!.value);
      if (command.action === "create") setSelectedId(payload.drafts[0]?.id || "");
      setNotice(command.action === "apply_simulation" ? "Đã áp dụng vào HIS GIẢ LẬP. Oracle thật không bị thay đổi." : "Đã lưu trạng thái phiếu. HIS thật không bị thay đổi.");
    } catch { setError("Không nhận được xác nhận. Làm mới và kiểm tra lịch sử trước khi gửi lại."); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/ksk-changes", { cache: "no-store" }), payload = await response.json();
      if (!response.ok) { setError(payload.error || "Không đọc được LAB."); return; }
      setData(payload); setEditing(null); setReason(""); setProposal(targetId === "NEW" ? blankMember(payload) : payload.targets.find((t: LabTarget) => t.id === targetId)!.value);
      setNotice("Đã làm mới nguồn giả lập và danh sách phiếu.");
    } catch { setError("Không đọc được LAB."); } finally { setBusy(false); }
  }
  const myPending = selected && selected.author.toLowerCase() === username.toLowerCase();
  const pendingEditable = selected && ["draft", "rejected"].includes(selected.state) && myPending && actions.includes(changeDraftAction(selected.after.kind));
  return <div className="grid min-w-0 gap-4">
    <section className="rounded border border-amber-300 bg-amber-50 p-4 text-sm" aria-label="Trạng thái thử nghiệm">
      <p className="font-bold text-amber-950">GIẢ LẬP · Ghi HIS thật đang khóa và chưa triển khai</p>
      <p className="mt-2">Chỉ có gói/người mẫu; không chỉnh danh sách CN1, chỉ định, kết quả hay phiếu thu thật. Người lập không được tự duyệt. Bấm áp dụng chỉ cập nhật kho HIS giả lập.</p>
      <button type="button" onClick={refresh} disabled={busy} className="mt-3 rounded border bg-white px-3 py-2">Làm mới LAB</button>
    </section>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    <section className="rounded border bg-white p-4"><h3 className="mb-3 text-lg font-bold">Nguồn HIS giả lập</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Mã LAB", "Loại / tên", "Nội dung hiện tại", "Tình trạng"].map(h => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead><tbody>{data.targets.map(t => <tr key={t.id} className="border-b"><td className="whitespace-nowrap p-2">{t.id}</td><td className="p-2">{t.value.kind === "package" ? "Gói" : "Người"} · {t.value.name}</td><td className="p-2">{t.value.kind === "package" ? `${t.value.services.length} dịch vụ · ${money(packageTotal(t.value))}` : `${t.value.employeeCode || "Chưa có mã NV"} · gói ${t.value.packageId}`}</td><td className={`p-2 ${sourceLocked(t, data.targets) ? "text-red-800" : "text-green-800"}`}>{sourceLocked(t, data.targets) ? "Khóa: đã tiếp nhận / được sử dụng" : "Được lập phiếu sửa"}</td></tr>)}</tbody></table></div>
    </section>
    <form aria-label="Lập phiếu thay đổi" onSubmit={e => {
      e.preventDefault();
      const checked = changeProposalSchema.safeParse(proposal);
      if (!checked.success) { setError("Thông tin gói/người không hợp lệ; kiểm tra tên, năm sinh, dịch vụ, số lượng và đơn giá."); return; }
      void send(editing ? { action: "save", id: editing.id, revision: editing.revision, after: checked.data, reason } : { action: "create", targetId, sourceVersion: data.sourceVersion, after: checked.data, reason });
    }} className="rounded border bg-white p-4">
      <h3 className="mb-3 text-lg font-bold">{editing ? "Sửa phiếu nháp của tôi" : "Lập phiếu nháp"}</h3>
      <label className="mb-3 grid gap-1 text-sm">Đối tượng LAB<select aria-label="Đối tượng LAB" value={targetId} disabled={busy || Boolean(editing)} onChange={e => chooseTarget(e.target.value)} className={field}>{data.targets.map(t => <option key={t.id} value={t.id}>{t.id} · {t.value.name}</option>)}<option value="NEW">Thêm người mới GIẢ LẬP</option></select></label>
      {!canEdit && <p className="mb-3 text-sm text-amber-900">Chưa được cấp quyền lập/sửa loại phiếu này.</p>}
      {isLocked && <p className="mb-3 text-sm text-red-800">Đã có tiếp nhận; không cho sửa trong bản thử.</p>}
      <fieldset disabled={busy || !canEdit || isLocked} className="grid gap-3 disabled:opacity-60">
        <label className="grid gap-1 text-sm">{proposal.kind === "package" ? "Tên gói" : "Họ tên"}<input required maxLength={120} value={proposal.name} onChange={e => setProposal(p => ({ ...p, name: e.target.value }))} className={field} /></label>
        {proposal.kind === "package" ? <>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Dịch vụ</th><th className="p-2">SL</th><th className="p-2">Đơn giá (đ)</th><th className="p-2">Thành tiền</th><th className="p-2">Thao tác</th></tr></thead><tbody>{proposal.services.map((s, i) => <tr key={i}>
            <td className="p-2"><select aria-label={`Dịch vụ ${i + 1}`} value={s.serviceId} onChange={e => setProposal(p => p.kind !== "package" ? p : { ...p, services: p.services.map((r, n) => n !== i ? r : { ...r, serviceId: e.target.value }) })} className={field}>{data.catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
            <td className="p-2"><input aria-label={`Số lượng ${i + 1}`} type="number" required min={1} max={1000} step={1} value={s.quantity} onChange={e => setProposal(p => p.kind !== "package" ? p : { ...p, services: p.services.map((r, n) => n !== i ? r : { ...r, quantity: Number(e.target.value) }) })} className={`${field} w-20`} /></td>
            <td className="p-2"><input aria-label={`Đơn giá ${i + 1}`} type="number" required min={0} max={100000000} step={1} value={s.unitPrice} onChange={e => setProposal(p => p.kind !== "package" ? p : { ...p, services: p.services.map((r, n) => n !== i ? r : { ...r, unitPrice: Number(e.target.value) }) })} className={`${field} w-36`} /></td>
            <td className="whitespace-nowrap p-2">{money(s.quantity * s.unitPrice)}</td><td className="p-2"><button type="button" disabled={proposal.services.length === 1} onClick={() => setProposal(p => p.kind !== "package" ? p : { ...p, services: p.services.filter((_, n) => n !== i) })} className="rounded border px-3 py-2 text-red-800">Bỏ dịch vụ</button></td>
          </tr>)}</tbody></table></div>
          <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={proposal.services.length >= data.catalog.length} onClick={() => setProposal(p => {
            if (p.kind !== "package") return p;
            const unused = data.catalog.find(c => !p.services.some(s => s.serviceId === c.id));
            return unused ? { ...p, services: [...p.services, { serviceId: unused.id, quantity: 1, unitPrice: 0 }] } : p;
          })} className="rounded border px-3 py-2 text-sm">Thêm dịch vụ</button><strong>Tổng gói dự kiến: {money(packageTotal(proposal))}</strong></div>
        </> : <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Năm sinh<input type="number" required min={1900} max={new Date().getFullYear()} value={proposal.birthYear} onChange={e => setProposal(p => p.kind !== "member" ? p : { ...p, birthYear: Number(e.target.value) })} className={field} /></label>
          <label className="grid gap-1 text-sm">Giới tính<select value={proposal.sex} onChange={e => setProposal(p => p.kind !== "member" ? p : { ...p, sex: e.target.value as "male" | "female" })} className={field}><option value="female">Nữ</option><option value="male">Nam</option></select></label>
          <label className="grid gap-1 text-sm">Mã nhân viên<input maxLength={40} value={proposal.employeeCode} onChange={e => setProposal(p => p.kind !== "member" ? p : { ...p, employeeCode: e.target.value })} className={field} /></label>
          <label className="grid gap-1 text-sm">Bộ phận<input maxLength={120} value={proposal.department} onChange={e => setProposal(p => p.kind !== "member" ? p : { ...p, department: e.target.value })} className={field} /></label>
          <label className="grid gap-1 text-sm">Nhóm khám<select value={proposal.groupId} onChange={e => setProposal(p => p.kind !== "member" ? p : { ...p, groupId: e.target.value })} className={field}>{data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Gói khám<select value={proposal.packageId} onChange={e => setProposal(p => p.kind !== "member" ? p : { ...p, packageId: e.target.value })} className={field}>{data.targets.filter(t => t.value.kind === "package").map(t => <option key={t.id} value={t.id}>{t.value.name}</option>)}</select></label>
        </div>}
        <label className="grid gap-1 text-sm">Lý do thay đổi<textarea required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className={field} /></label>
        <div className="flex flex-wrap gap-3"><button type="submit" className={button}>{busy ? "Đang lưu…" : editing ? "Lưu sửa nháp" : "Lưu bản nháp"}</button></div>
      </fieldset>
      {editing && <button type="button" disabled={busy} onClick={() => chooseTarget(data.targets[0].id)} className="mt-3 rounded border px-3 py-2 text-sm">Bỏ sửa / lập phiếu mới</button>}
    </form>
    <section className="rounded border bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Danh sách phiếu ({data.drafts.length})</h3><label className="text-sm">Trạng thái <select aria-label="Lọc trạng thái phiếu" value={stateFilter} onChange={e => setStateFilter(e.target.value)} className={field}><option value="">Tất cả</option>{Object.entries(changeStates).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      {!data.drafts.length && <p className="text-sm text-slate-500">Chưa có phiếu. Chỉnh dữ liệu mẫu rồi bấm Lưu bản nháp.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Đối tượng", "Trạng thái", "Người lập / duyệt", "Cập nhật", ""].map(h => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead><tbody>{data.drafts.filter(d => !stateFilter || d.state === stateFilter).map(d => <tr key={d.id} className="border-b"><td className="p-2">{d.after.name}<br /><span className="text-xs text-slate-500">{d.targetId} · v{d.revision}</span></td><td className="p-2"><StateLabel state={d.state} /></td><td className="p-2">{d.author} / {d.reviewer || "Chưa duyệt"}</td><td className="p-2">{when(d.updatedAt)}</td><td className="p-2"><button type="button" disabled={busy} onClick={() => openDraft(d)} className="whitespace-nowrap rounded border px-3 py-2">Xem / xử lý phiếu</button></td></tr>)}</tbody></table></div>
    </section>
    {selected && <section aria-label="Chi tiết phiếu thay đổi" className="rounded border bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Đối chiếu trước / sau — {selected.after.name}</h3><StateLabel state={selected.state} /></div>
      <p className="mb-3 break-all text-xs text-slate-500">Phiếu {selected.id} · {selected.targetId} · phiên bản {selected.revision}</p>
      <div className="grid gap-3 md:grid-cols-2"><ProposalView title="Trước — nguồn lúc lập phiếu" value={selected.before} data={data} /><ProposalView title="Sau — nội dung đề nghị" value={selected.after} data={data} /></div>
      <p className="my-3 text-sm">Người lập: {selected.author} · Duyệt: {selected.reviewer || "Chưa duyệt"} · Áp dụng: {selected.appliedBy || "Chưa áp dụng"}</p>
      {myPending && selected.state === "submitted" && <p className="my-3 text-sm text-amber-900">Không được tự duyệt. Nhờ tài khoản khác có quyền duyệt đăng nhập và kiểm tra phiếu.</p>}
      <label className="my-3 grid gap-1 text-sm">Lý do xử lý phiếu (ít nhất 5 ký tự)<textarea disabled={busy} value={actionReason} minLength={5} maxLength={500} onChange={e => setActionReason(e.target.value)} className={field} /></label>
      {selected.state === "approved" && actions.includes("ksk_change_apply") && <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmApply} disabled={busy} onChange={e => setConfirmApply(e.target.checked)} />Tôi xác nhận áp dụng phiếu đã duyệt vào HIS GIẢ LẬP</label>}
      <div className="flex flex-wrap gap-3">
        {pendingEditable && <><button type="button" disabled={busy} onClick={() => editDraft(selected)} className="rounded border px-3 py-2 text-sm">Sửa nháp</button><button type="button" disabled={busy || actionReason.trim().length < 5} onClick={() => send({ action: "submit", id: selected.id, revision: selected.revision, reason: actionReason })} className={button}>Gửi duyệt</button></>}
        {selected.state === "submitted" && !myPending && actions.includes("ksk_change_approve") && <><button type="button" disabled={busy || actionReason.trim().length < 5} onClick={() => send({ action: "approve", id: selected.id, revision: selected.revision, reason: actionReason })} className={button}>Duyệt phiếu</button><button type="button" disabled={busy || actionReason.trim().length < 5} onClick={() => send({ action: "reject", id: selected.id, revision: selected.revision, reason: actionReason })} className="rounded border border-red-300 px-3 py-2 text-sm text-red-800">Từ chối</button></>}
        {selected.state === "approved" && actions.includes("ksk_change_apply") && <button type="button" disabled={busy || !confirmApply || actionReason.trim().length < 5} onClick={() => send({ action: "apply_simulation", id: selected.id, revision: selected.revision, reason: actionReason })} className={button}>Áp dụng HIS GIẢ LẬP</button>}
      </div>
      <details open className="mt-4"><summary className="cursor-pointer font-bold">Lịch sử xử lý ({selected.history.length})</summary><ol className="mt-2 grid gap-2 text-sm">{selected.history.map((event, index) => <li key={index} className="rounded bg-slate-50 p-2">{when(event.at)} · {event.actor} · {event.action}<p className="mt-1 whitespace-pre-wrap">{event.reason}</p>{event.proposal && <details className="mt-2"><summary className="cursor-pointer">Nội dung nháp tại lần lưu này</summary><ProposalView title="Nội dung đã lưu" value={event.proposal} data={data} /></details>}</li>)}</ol></details>
    </section>}
  </div>;
}
function StateLabel({ state }: { state: ChangeDraft["state"] }) {
  return <span className={`inline-block rounded border px-2 py-1 text-xs font-bold ${state === "simulated" ? "border-green-300 bg-green-50 text-green-900" : state === "rejected" ? "border-red-300 bg-red-50 text-red-900" : state === "submitted" || state === "approved" ? "border-orange-300 bg-orange-50 text-orange-900" : "bg-slate-50 text-slate-700"}`}>{changeStates[state]}</span>;
}
function ProposalView({ title, value, data }: { title: string; value: ChangeProposal | null; data: ChangeLabSnapshot }) {
  return <section className="min-w-0 rounded border p-3 text-sm"><h4 className="mb-2 font-bold">{title}</h4>{!value ? <p>Chưa có người này — đề nghị thêm mới.</p> : <><p className="mb-2 font-bold">{value.name}</p>{value.kind === "package" ? <><ul className="grid gap-2">{value.services.map(s => <li key={s.serviceId}>{data.catalog.find(c => c.id === s.serviceId)?.name || s.serviceId} · SL {s.quantity} × {money(s.unitPrice)} = {money(s.quantity * s.unitPrice)}</li>)}</ul><p className="mt-3 font-bold">Tổng: {money(packageTotal(value))}</p></> : <dl className="grid grid-cols-2 gap-2"><dt>Năm sinh</dt><dd>{value.birthYear}</dd><dt>Giới tính</dt><dd>{value.sex === "male" ? "Nam" : "Nữ"}</dd><dt>Mã NV</dt><dd>{value.employeeCode || "—"}</dd><dt>Bộ phận</dt><dd>{value.department || "—"}</dd><dt>Nhóm</dt><dd>{data.groups.find(g => g.id === value.groupId)?.name || value.groupId}</dd><dt>Gói</dt><dd>{data.targets.find(t => t.id === value.packageId)?.value.name || value.packageId}</dd></dl>}</>}</section>;
}
