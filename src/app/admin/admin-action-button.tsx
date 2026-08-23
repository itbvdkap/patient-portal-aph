"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminActionButton({
  action,
  label,
  target,
  confirm,
  tone = "neutral",
}: {
  action: string;
  label: string;
  target?: Record<string, string>;
  confirm?: string;
  tone?: "primary" | "danger" | "neutral";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  async function runAction() {
    setError("");
    const nextTarget = { ...(target ?? {}) };

    if (needsNoteModal(action)) {
      setNote(String(nextTarget.note ?? ""));
      setNoteOpen(true);
      return;
    }

    if (confirm && !window.confirm(confirm)) return;

    if (action === "edit_setting") {
      const value = window.prompt("Nhập giá trị cấu hình mới", nextTarget.settingValue ?? "");
      if (value === null) return;
      nextTarget.settingValue = value;
    }

    await submitAction(nextTarget);
  }

  async function submitAction(nextTarget: Record<string, string>) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, target: nextTarget }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Không thực hiện được thao tác.");
        return;
      }
      setNoteOpen(false);
      router.refresh();
    } catch {
      setError("Không kết nối được API quản trị.");
    } finally {
      setLoading(false);
    }
  }

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (requiresNote(action) && !trimmedNote) {
      setError("Vui lòng nhập lý do trước khi thực hiện.");
      return;
    }
    const nextTarget = { ...(target ?? {}), note: trimmedNote };
    await submitAction(nextTarget);
  }

  const tones = {
    primary: "border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100",
    danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    neutral: "border-cream-200 bg-cream-100 text-slate-700 hover:bg-white",
  };

  return (
    <>
      <span className="inline-flex flex-col items-end">
        <button
          type="button"
          onClick={runAction}
          disabled={loading}
          className={`rounded-md border px-2.5 py-1 text-xs font-black transition disabled:cursor-wait disabled:opacity-60 ${tones[tone]}`}
        >
          {loading ? "..." : label}
        </button>
        {error && <span className="mt-1 max-w-48 text-right text-[11px] font-semibold leading-4 text-rose-700">{error}</span>}
      </span>

      {noteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6">
          <form onSubmit={submitNote} className="w-full max-w-md rounded-md border border-cream-200 bg-cream-50 p-4 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary-700">{modalCopy(action).eyebrow}</p>
            <h2 className="mt-1 font-serif text-2xl font-black text-ink">{modalCopy(action).title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{modalCopy(action).description}</p>
            <label className="mt-4 block text-sm font-bold text-ink">
              {modalCopy(action).label}
              <textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setError("");
                }}
                rows={4}
                className="mt-2 w-full resize-none rounded-md border border-cream-200 bg-white px-3 py-3 text-sm font-semibold leading-6 outline-none ring-primary-100 focus:ring-4"
                placeholder={modalCopy(action).placeholder}
                required={requiresNote(action)}
                autoFocus
              />
            </label>
            {requiresNote(action) && <p className="mt-2 text-xs font-bold text-slate-500">Bắt buộc nhập lý do để lưu vết audit.</p>}
            {error && <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                disabled={loading}
                className="rounded-md border border-cream-200 bg-cream-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-white disabled:opacity-60"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-primary-700 px-4 py-2 text-sm font-black text-white transition hover:bg-primary-900 disabled:cursor-wait disabled:bg-slate-300"
              >
                {loading ? "Đang lưu..." : modalCopy(action).submit}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function needsNoteModal(action: string) {
  return action === "approve_booking" || action === "cancel_booking" || action === "lock_account" || action === "unlink_profile";
}

function requiresNote(action: string) {
  return action === "unlink_profile" || action === "lock_account";
}

function modalCopy(action: string) {
  if (action === "approve_booking") {
    return {
      eyebrow: "Đăng ký khám",
      title: "Ghi chú xác nhận",
      description: "Ghi chú này lưu vào lịch sử xử lý và audit log, không ghi đè ghi chú của bệnh nhân.",
      label: "Nội dung ghi chú",
      placeholder: "Ví dụ: Đã gọi xác nhận với bệnh nhân.",
      submit: "Xác nhận lịch",
    };
  }
  if (action === "cancel_booking") {
    return {
      eyebrow: "Đăng ký khám",
      title: "Ghi chú hủy lịch",
      description: "Ghi chú này lưu vào lịch sử xử lý và audit log, không ghi đè ghi chú của bệnh nhân.",
      label: "Lý do hủy / ghi chú",
      placeholder: "Ví dụ: Bệnh nhân yêu cầu hủy / trùng lịch.",
      submit: "Hủy lịch",
    };
  }
  if (action === "unlink_profile") {
    return {
      eyebrow: "Hồ sơ y tế",
      title: "Lý do gỡ liên kết",
      description: "Hồ sơ sẽ bị gỡ khỏi tài khoản đang liên kết. Lý do này được lưu vào audit log để truy vết khi cần.",
      label: "Lý do gỡ",
      placeholder: "Ví dụ: Liên kết nhầm hồ sơ / yêu cầu từ bệnh nhân.",
      submit: "Gỡ liên kết",
    };
  }
  return {
    eyebrow: "Tài khoản portal",
    title: "Lý do khóa tài khoản",
    description: "Tài khoản sẽ bị khóa và các phiên đang mở sẽ được thu hồi. Lý do được lưu trong audit log.",
    label: "Lý do khóa",
    placeholder: "Ví dụ: Yêu cầu từ bệnh nhân / nghi ngờ truy cập bất thường.",
    submit: "Khóa tài khoản",
  };
}
