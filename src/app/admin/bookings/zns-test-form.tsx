"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function AdminZnsTestForm() {
  const [phone, setPhone] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "test_zns_template",
          target: {
            phone,
            templateId,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Chưa tạo được tin test ZNS.");
        return;
      }
      setMessage("Đã queue tin test ZNS. Agent sẽ gửi khi worker outbox đang chạy.");
    } catch {
      setError("Không kết nối được API quản trị.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-primary-700">Zalo ZNS</p>
          <h2 className="font-serif text-lg font-black text-ink">Test template</h2>
        </div>
        <span className="rounded-md bg-primary-50 p-2 text-primary-700">
          <Send aria-hidden="true" className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="block text-xs font-black text-ink">
          SĐT nhận test
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="09..."
            className="mt-1 w-full rounded-md border border-cream-200 bg-white px-3 py-2 text-sm font-bold outline-none ring-primary-100 focus:ring-4"
            required
          />
        </label>
        <label className="block text-xs font-black text-ink">
          Template ID
          <input
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            placeholder="Để trống dùng cấu hình"
            className="mt-1 w-full rounded-md border border-cream-200 bg-white px-3 py-2 text-sm font-bold outline-none ring-primary-100 focus:ring-4"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-3 py-2 text-sm font-black text-white transition hover:bg-primary-900 disabled:cursor-wait disabled:bg-slate-300"
      >
        <Send aria-hidden="true" className="h-4 w-4" />
        {loading ? "Đang queue..." : "Queue test ZNS"}
      </button>

      {message && <p className="mt-2 rounded-md bg-primary-50 px-3 py-2 text-xs font-bold leading-5 text-primary-900">{message}</p>}
      {error && <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">{error}</p>}
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Dùng đúng template xác nhận HIS để kiểm tra token, template ID và worker gửi Zalo.</p>
    </form>
  );
}
