"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function ContentCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("huong-dan-kham");
  const [excerpt, setExcerpt] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, category, excerpt }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Không tạo được bài viết.");
        return;
      }
      setTitle("");
      setExcerpt("");
      setMessage("Đã tạo bài viết nháp.");
      router.refresh();
    } catch {
      setMessage("Không kết nối được API nội dung.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 grid gap-3 rounded-md border border-cream-200 bg-cream-50 p-4 shadow-[0_8px_22px_rgba(7,60,57,0.055)] lg:grid-cols-[1fr_180px]">
      <label className="block text-sm font-bold text-ink">
        Tiêu đề bài viết
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2 outline-none ring-primary-100 focus:ring-4"
          placeholder="Ví dụ: Hướng dẫn đi khám tại An Phú"
          required
        />
      </label>
      <label className="block text-sm font-bold text-ink">
        Chuyên mục
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-2 outline-none ring-primary-100 focus:ring-4"
        >
          <option value="huong-dan-kham">Hướng dẫn khám</option>
          <option value="xet-nghiem">Xét nghiệm</option>
          <option value="bhyt">BHYT</option>
          <option value="cdha">CĐHA</option>
        </select>
      </label>
      <label className="block text-sm font-bold text-ink lg:col-span-2">
        Tóm tắt
        <textarea
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
          className="mt-2 min-h-20 w-full rounded-md border border-cream-200 bg-white px-3 py-2 outline-none ring-primary-100 focus:ring-4"
          placeholder="Tóm tắt ngắn hiển thị trên dashboard/cẩm nang."
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-black text-white shadow-soft hover:bg-primary-900 disabled:cursor-wait disabled:bg-slate-300"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {loading ? "Đang tạo..." : "Tạo bài nháp"}
        </button>
        {message && <span className="text-sm font-semibold text-slate-600">{message}</span>}
      </div>
    </form>
  );
}
