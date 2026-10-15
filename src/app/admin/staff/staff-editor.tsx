"use client";

import { useRef, useState } from "react";
import { adminMenuOptions, adminActionOptions, actionMenu, kskMenuGroup, type AdminMenu, type AdminAction } from "@/lib/admin/permissions";
import type { StaffPublic } from "@/lib/admin/staff-store";

export function StaffEditor({ initialUsers }: { initialUsers: StaffPublic[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState(false), [username, setUsername] = useState(""), [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState(""), [enabled, setEnabled] = useState(true), [menus, setMenus] = useState<AdminMenu[]>(["ksk"]);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [pendingDelete, setPendingDelete] = useState<StaffPublic | null>(null), [confirmUsername, setConfirmUsername] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const formRef = useRef<HTMLFormElement>(null), deleteRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  function toggleMenu(menu: AdminMenu, checked: boolean) {
    setMenus(current => checked ? [...current, menu] : current.filter(m => m !== menu));
    if (!checked) setActions(current => current.filter(action => actionMenu(action) !== menu));
  }
  function menuCheckbox(menu: typeof adminMenuOptions[number]) {
    return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={menus.includes(menu.id)} onChange={e => toggleMenu(menu.id, e.target.checked)} />{menu.label}</label>;
  }
  function choose(user?: StaffPublic) {
    setEditing(Boolean(user)); setUsername(user?.username || ""); setDisplayName(user?.displayName || ""); setPassword(""); setConfirmPassword("");
    setEnabled(user?.enabled ?? true); setMenus(user?.menus || ["ksk"]); setError(""); setNotice("");
    setActions(user?.actions ?? []);
    setPendingDelete(null); setConfirmUsername(""); setDeleteError("");
    formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
  function askDelete(user: StaffPublic) {
    setPendingDelete(user); setConfirmUsername(""); setDeleteError(""); setNotice("");
    deleteRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }
  async function remove() {
    if (!pendingDelete || confirmUsername !== pendingDelete.username) return;
    setBusy(true); setDeleteError("");
    try {
      const response = await fetch("/api/admin/staff/delete", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: pendingDelete.username, confirmUsername }) });
      const payload = await response.json();
      if (!response.ok) { setDeleteError(payload.error || "Không xóa được nhân viên."); return; }
      setUsers(payload.users); choose();
      setNotice("Đã xóa tài khoản nhân viên và thu hồi các phiên đăng nhập. Dữ liệu HIS không bị thay đổi; có bản sao lưu để khôi phục.");
    } catch { setDeleteError("Không kết nối được máy chủ quản lý nhân viên."); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (password !== confirmPassword) { setError("Mật khẩu nhập lại không khớp."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, password, confirmPassword, enabled, menus, actions: actions.filter(a => menus.includes(actionMenu(a))) }) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "Không lưu được nhân viên."); return; }
      setUsers(payload.users); setPassword(""); setConfirmPassword(""); setEditing(true);
      setNotice("Đã lưu. Phiên đăng nhập cũ của nhân viên đã bị thu hồi; đăng nhập lại để dùng quyền mới.");
    } catch { setError("Không kết nối được máy chủ quản lý nhân viên."); }
    finally { setBusy(false); }
  }
  return <div className="grid min-w-0 gap-5 xl:grid-cols-2">
    <section className="rounded border bg-white p-4"><h3 className="mb-3 text-lg font-bold">Danh sách nhân viên ({users.length})</h3>
      <button type="button" disabled={busy} onClick={() => choose()} className="mb-3 rounded border px-3 py-2 text-sm font-bold">Thêm nhân viên</button>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Tài khoản", "Họ tên", "Truy cập admin", "Menu", ""].map(h => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead>
        <tbody>{users.map(u => <tr key={u.username}><td className="border-b p-2">{u.username}</td><td className="border-b p-2">{u.displayName}</td><td className={`border-b p-2 ${u.enabled ? "text-green-800" : "text-red-800"}`}>{u.enabled ? "Được phép" : "Đã khóa"}</td>
          <td className="border-b p-2">{u.menus.map(m => adminMenuOptions.find(o => o.id === m)?.label).join(" · ") || "Chưa cấp"}</td><td className="border-b p-2"><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => choose(u)} aria-label={`Sửa ${u.username}`} className="rounded border px-3 py-1">Sửa</button><button type="button" disabled={busy} onClick={() => askDelete(u)} aria-label={`Xóa ${u.username}`} className="rounded border border-red-200 px-3 py-1 text-red-800">Xóa</button></div></td></tr>)}</tbody></table></div>
      {!users.length && <p className="mt-3 text-sm text-slate-500">Chưa có nhân viên. Tạo tài khoản riêng cho từng người.</p>}
      <div ref={deleteRef} className="scroll-mt-24">{pendingDelete && <section aria-label="Xác nhận xóa nhân viên" className="mt-4 rounded border border-red-200 bg-red-50 p-3">
        <h4 className="font-bold text-red-900">Xóa nhân viên: {pendingDelete.username}</h4>
        <p className="my-2 text-sm">Tài khoản sẽ bị chặn đăng nhập và gỡ khỏi danh sách. Giữ bản ghi và bản sao lưu để khôi phục; không xóa dữ liệu HIS.</p>
        <label className="grid gap-1 text-sm">Nhập tên tài khoản để xác nhận<input autoComplete="off" maxLength={50} value={confirmUsername} disabled={busy} onChange={e => setConfirmUsername(e.target.value)} className="rounded border bg-white p-2" /></label>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || confirmUsername !== pendingDelete.username} onClick={remove} className="rounded bg-red-800 px-3 py-2 text-white disabled:opacity-50">{busy ? "Đang xóa…" : "Xác nhận xóa"}</button><button type="button" disabled={busy} onClick={() => { setPendingDelete(null); setDeleteError(""); }} className="rounded border bg-white px-3 py-2">Không xóa</button></div>
        {deleteError && <p role="alert" className="mt-3 text-sm text-red-800">{deleteError}</p>}
      </section>}</div>
    </section>
    <form ref={formRef} onSubmit={submit} className="scroll-mt-24 rounded border bg-white p-4"><div className="sticky top-20 z-10 -mx-4 -mt-4 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-t border-b bg-white px-4 py-3">
      <h3 className="text-lg font-bold">{editing ? "Cập nhật nhân viên" : "Tạo nhân viên"}</h3>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="rounded border border-primary-700 bg-primary-700 px-4 py-2 font-bold text-white hover:bg-primary-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:opacity-50">{busy ? "Đang xử lý…" : editing ? "Lưu thay đổi" : "Lưu nhân viên"}</button><button type="button" disabled={busy} onClick={() => choose()} className="rounded border px-3 py-2">Hủy</button></div>
    </div>
      {error && <p role="alert" className="my-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="my-3 text-sm text-green-800">{notice}</p>}
      <label className="mb-3 grid gap-1 text-sm">Tên đăng nhập<input required minLength={3} maxLength={50} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" value={username} disabled={editing || busy} onChange={e => setUsername(e.target.value)} className="rounded border p-2" autoComplete="off" /></label>
      <label className="mb-3 grid gap-1 text-sm">Họ tên nhân viên<input required maxLength={120} value={displayName} disabled={busy} onChange={e => setDisplayName(e.target.value)} className="rounded border p-2" autoComplete="off" /></label>
      <label className="mb-3 grid gap-1 text-sm">{editing ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}<input type="password" required={!editing} minLength={12} maxLength={128} value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="rounded border p-2" autoComplete="new-password" /></label>
      <label className="mb-3 grid gap-1 text-sm">Nhập lại mật khẩu<input type="password" required={!editing || Boolean(password)} minLength={12} maxLength={128} value={confirmPassword} disabled={busy} onChange={e => setConfirmPassword(e.target.value)} className="rounded border p-2" autoComplete="new-password" /></label>
      <p className="mb-3 text-xs text-slate-500">Ít nhất 12 ký tự, có chữ và số. Không lưu mật khẩu rõ; không gửi mật khẩu qua chat nhóm.</p>
      <label className="mb-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => setEnabled(e.target.checked)} />Cho phép vào trang admin</label>
      <fieldset disabled={busy} className="grid gap-2"><legend className="mb-2 font-bold">Menu được phép xem</legend>
        {adminMenuOptions.filter(menu => !kskMenuGroup.menus.some(id => id === menu.id)).map(menu => <div key={menu.id}>{menuCheckbox(menu)}</div>)}
        <fieldset aria-label="Phân quyền quản lý khám sức khoẻ" className="mt-3 grid min-w-0 gap-3 rounded border border-primary-200 bg-primary-50/30 p-3">
          <legend className="px-1 font-bold">{kskMenuGroup.label}</legend>
          <p className="text-xs text-slate-600">Menu cha chỉ gom nhóm. Tích riêng mục được xem; không tự cấp toàn bộ 4 mục hay quyền sửa/ghi HIS.</p>
          {kskMenuGroup.menus.map(id => {
            const menu = adminMenuOptions.find(option => option.id === id)!;
            const options = adminActionOptions.filter(action => actionMenu(action.id) === id);
            return <div key={id} className="min-w-0 rounded border bg-white p-3">
              {menuCheckbox(menu)}
              {!options.length && <p className="ml-6 mt-2 text-xs text-slate-500">Chỉ đọc và xem/xuất báo cáo; không có quyền thay đổi HIS.</p>}
              {options.length > 0 && <fieldset disabled={busy || !menus.includes(id)} className="ml-2 mt-3 grid gap-2 rounded border p-3 disabled:opacity-60">
                <legend className="px-1 text-sm font-bold">{id === "ksk_changes" ? "Quyền thao tác phiếu thay đổi · LAB" : "Quyền quản lý đoàn / gói HIS thật"}</legend>
                {options.map(action => <label key={action.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={actions.includes(action.id)} onChange={e => setActions(current => e.target.checked ? [...current, action.id] : current.filter(a => a !== action.id))} />{action.label}</label>)}
                <p className={`text-xs ${id === "ksk_changes" ? "text-slate-600" : "text-red-900"}`}>{id === "ksk_changes" ? "Chỉ dùng dữ liệu giả lập, không ghi Oracle thật. Người lập không tự duyệt." : "Độc lập với LAB và báo cáo. CN1 hiện chỉ đọc/lưu nháp; quyền ghi không vượt qua khóa ghi server. Người lập không tự duyệt."}</p>
              </fieldset>}
            </div>;
          })}
        </fieldset>
      </fieldset>
      <p className="my-4 rounded bg-amber-50 p-3 text-xs text-amber-950">Các menu báo cáo HIS vẫn chỉ đọc. Quyền Khám đoàn bao gồm dữ liệu người bệnh, kết quả XN/CLS và xuất báo cáo của chi nhánh đang cấu hình; chưa giới hạn theo từng công ty/đoàn. Quyền quản lý/ghi HIS ở nhóm riêng trên đây; không tự cấp khi cho xem báo cáo.</p>
      <button type="submit" disabled={busy} className="rounded border border-primary-700 bg-primary-700 px-4 py-2 font-bold text-white hover:bg-primary-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:opacity-50">{busy ? "Đang xử lý…" : "Lưu nhân viên & quyền"}</button>
    </form>
  </div>;
}
