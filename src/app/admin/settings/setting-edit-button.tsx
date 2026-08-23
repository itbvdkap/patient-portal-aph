"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminSettingEntry } from "@/lib/admin/modules";

export function SettingEditButton({ setting }: { setting: AdminSettingEntry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(setting.value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = value.trim();
    const validation = validateClient(setting, nextValue);
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "edit_setting",
          target: {
            settingKey: setting.key,
            settingValue: nextValue,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Không lưu được cấu hình.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Không kết nối được API quản trị.");
    } finally {
      setLoading(false);
    }
  }

  if (!setting.isEditable) {
    return <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">Secret</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue(setting.value);
          setError("");
          setOpen(true);
        }}
        className="rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-black text-primary-800 transition hover:bg-primary-100"
      >
        Sửa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6">
          <form onSubmit={submit} className="w-full max-w-lg rounded-md border border-cream-200 bg-cream-50 p-4 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary-700">{setting.groupLabel}</p>
            <h2 className="mt-1 font-serif text-2xl font-black text-ink">{setting.label}</h2>
            <p className="mt-1 break-words clinical-mono text-xs font-bold text-slate-500">{setting.key}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{setting.description}</p>

            <label className="mt-4 block text-sm font-bold text-ink">
              Giá trị cấu hình
              <SettingInput setting={setting} value={value} onChange={setValue} />
            </label>
            <p className="mt-2 text-xs font-bold text-slate-500">{setting.validationHint}</p>
            {error && <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                {loading ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function SettingInput({ setting, value, onChange }: { setting: AdminSettingEntry; value: string; onChange: (value: string) => void }) {
  const baseClass = "mt-2 w-full rounded-md border border-cream-200 bg-white px-3 py-3 text-sm font-semibold outline-none ring-primary-100 focus:ring-4";
  if (setting.inputType === "select" || setting.inputType === "boolean") {
    const options = setting.inputType === "boolean" ? ["true", "false"] : setting.options;
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (setting.inputType === "textarea") {
    return <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} className={`${baseClass} resize-none leading-6`} />;
  }
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type={setting.inputType === "number" ? "number" : setting.inputType === "url" ? "url" : "text"}
      className={`${baseClass} clinical-mono`}
    />
  );
}

function validateClient(setting: AdminSettingEntry, value: string) {
  if (setting.key === "auth.otp_provider" && !["test", "zalo", "off"].includes(value)) return "Chọn test, zalo hoặc off.";
  if (setting.key === "auth.otp_ttl_minutes") {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) return "Thời hạn OTP phải từ 1 đến 30 phút.";
  }
  if (setting.inputType === "boolean" && !["true", "false"].includes(value.toLowerCase())) return "Giá trị bật/tắt phải là true hoặc false.";
  if (setting.inputType === "url" && value && !/^https?:\/\/\S+$/i.test(value)) return "URL phải bắt đầu bằng http:// hoặc https://.";
  if (setting.inputType === "number" && value && !/^\d+$/.test(value)) return "Giá trị này phải là số nguyên.";
  return "";
}
