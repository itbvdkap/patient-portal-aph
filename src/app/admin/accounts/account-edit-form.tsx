"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { Save } from "lucide-react";

export function AccountEditForm({
  accountId,
  accountKey,
  fullName,
  displayName,
  phoneVerified,
}: {
  accountId: string;
  accountKey: string;
  fullName: string;
  displayName: string;
  phoneVerified: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = {
      action: "edit_account",
      target: {
        accountId,
        accountKey,
        fullName: String(form.get("fullName") ?? "").trim(),
        displayName: String(form.get("displayName") ?? "").trim(),
        phoneVerified: String(form.get("phoneVerified") ?? "no"),
      },
    };

    const response = await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(result?.error ?? "Không lưu được thông tin tài khoản.");
      return;
    }

    setMessage("Đã lưu thông tin tài khoản.");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-md border border-cream-200 bg-white/70 p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="font-serif text-lg font-black text-ink">Sửa thông tin tài khoản</h4>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Chỉ cập nhật tài khoản portal. Không thay đổi dữ liệu hồ sơ HIS.</p>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {isPending ? "Đang lưu" : "Lưu thay đổi"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-bold text-ink">
          Họ tên
          <input
            name="fullName"
            defaultValue={fullName}
            maxLength={120}
            className="mt-2 w-full rounded-md border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm font-bold outline-none ring-primary-100 focus:ring-4"
          />
        </label>

        <label className="block text-sm font-bold text-ink">
          Tên hiển thị
          <input
            name="displayName"
            defaultValue={displayName}
            maxLength={120}
            className="mt-2 w-full rounded-md border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm font-bold outline-none ring-primary-100 focus:ring-4"
          />
        </label>

        <label className="block text-sm font-bold text-ink">
          Xác minh SĐT
          <select
            name="phoneVerified"
            defaultValue={phoneVerified ? "yes" : "no"}
            className="mt-2 w-full rounded-md border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm font-bold outline-none ring-primary-100 focus:ring-4"
          >
            <option value="yes">Đã xác minh</option>
            <option value="no">Chưa xác minh</option>
          </select>
        </label>
      </div>

      {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p> : null}
      {message ? <p className="mt-3 rounded-md bg-primary-50 px-3 py-2 text-sm font-bold text-primary-800">{message}</p> : null}
    </form>
  );
}
