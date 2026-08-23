"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";

export function AdminLoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Không đăng nhập được trang quản trị.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ quản trị.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-soft sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-serif text-2xl font-black text-ink">Đăng nhập quản trị</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Khu vực vận hành cổng bệnh nhân An Phú.</p>
        </div>
      </div>

      {!configured && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">
          Chưa cấu hình `ADMIN_PASSWORD` hoặc `PORTAL_ADMIN_PASSWORD` trong môi trường server.
        </div>
      )}

      <label className="block text-sm font-bold text-ink">
        Tài khoản
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-3 clinical-mono outline-none ring-primary-100 focus:ring-4"
          autoComplete="username"
          disabled={!configured || loading}
        />
      </label>

      <label className="mt-4 block text-sm font-bold text-ink">
        Mật khẩu
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-3 outline-none ring-primary-100 focus:ring-4"
          autoComplete="current-password"
          disabled={!configured || loading}
        />
      </label>

      {error && <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}

      <button
        type="submit"
        disabled={!configured || loading}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-3 text-sm font-black text-white shadow-soft transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <LogIn aria-hidden="true" className="h-4 w-4" />
        {loading ? "Đang kiểm tra..." : "Vào trang quản trị"}
      </button>
    </form>
  );
}
