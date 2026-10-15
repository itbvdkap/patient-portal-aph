"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState(""), [newPassword, setNewPassword] = useState(""), [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [changed, setChanged] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (newPassword !== confirmPassword) { setError("Mật khẩu nhập lại không khớp."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "Không đổi được mật khẩu."); return; }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setChanged(true);
      // Do not refresh the protected page: old cookies are already invalidated.
      router.replace("/admin/login");
    } catch { setError("Không kết nối được máy chủ. Nếu mật khẩu đã được đổi, hãy đăng nhập lại bằng mật khẩu mới."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="max-w-xl rounded border bg-white p-4">
    <h3 className="mb-3 text-lg font-bold">Đổi mật khẩu của tôi</h3>
    <p className="mb-4 text-sm text-slate-600">Mật khẩu mới ít nhất 12 ký tự, có chữ và số. Đổi thành công sẽ đăng xuất tất cả phiên của tài khoản; đăng nhập lại bằng mật khẩu mới.</p>
    <fieldset disabled={busy || changed} className="grid gap-3">
      <label className="grid gap-1 text-sm">Mật khẩu hiện tại<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="rounded border p-2" /></label>
      <label className="grid gap-1 text-sm">Mật khẩu mới<input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="rounded border p-2" /></label>
      <label className="grid gap-1 text-sm">Nhập lại mật khẩu mới<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="rounded border p-2" /></label>
      <button type="submit" className="rounded border border-primary-700 bg-primary-700 px-4 py-2 font-bold text-white hover:bg-primary-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:opacity-50">{busy ? "Đang đổi…" : "Lưu mật khẩu mới"}</button>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {changed && <p role="status" className="mt-3 text-sm text-green-800">Đã đổi mật khẩu. <a className="underline" href="/admin/login">Đăng nhập lại</a>.</p>}
  </form>;
}
