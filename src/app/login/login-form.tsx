"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IdCard, Loader2, LogIn, Phone } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, citizenId }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(body?.error ?? "Không xác minh được thông tin đăng nhập.");
        return;
      }

      router.replace(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } catch {
      setMessage("Không kết nối được hệ thống xác minh. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitLogin} className="space-y-4">
      <div>
        <label htmlFor="phone" className="text-sm font-semibold text-ink">
          Số điện thoại
        </label>
        <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
          <Phone aria-hidden="true" className="h-5 w-5 text-primary-700" />
          <input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-base outline-none"
            placeholder="Ví dụ: 0911071001"
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="citizenId" className="text-sm font-semibold text-ink">
          CCCD/CMND
        </label>
        <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
          <IdCard aria-hidden="true" className="h-5 w-5 text-primary-700" />
          <input
            id="citizenId"
            value={citizenId}
            onChange={(event) => setCitizenId(event.target.value)}
            className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-base outline-none"
            placeholder="Nhập số CCCD/CMND"
            inputMode="numeric"
            autoComplete="off"
            required
          />
        </div>
      </div>

      {message && (
        <div role="status" className="rounded-md bg-cream-100 px-3 py-2 text-sm font-medium text-slate-700">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 font-bold text-white hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <LogIn aria-hidden="true" className="h-5 w-5" />}
        Xác minh và đăng nhập
      </button>
    </form>
  );
}
