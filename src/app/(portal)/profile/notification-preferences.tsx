"use client";

import { useEffect, useState } from "react";

type PreferenceKey = "appointments" | "results" | "insurance";

const storageKey = "anphu-notification-preferences";
const defaults: Record<PreferenceKey, boolean> = {
  appointments: true,
  results: true,
  insurance: true,
};

const options: Array<{ key: PreferenceKey; title: string; description: string }> = [
  {
    key: "appointments",
    title: "Nhắc lịch hẹn",
    description: "Thông báo trước ngày khám hoặc khi có thay đổi lịch.",
  },
  {
    key: "results",
    title: "Kết quả mới",
    description: "Nhắc khi có kết quả xét nghiệm hoặc CĐHA mới được đồng bộ.",
  },
  {
    key: "insurance",
    title: "BHYT sắp hết hạn",
    description: "Cảnh báo trước khi thẻ BHYT gần hết hiệu lực.",
  },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState(defaults);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      return;
    }

    try {
      setPreferences({ ...defaults, ...(JSON.parse(stored) as Partial<typeof defaults>) });
    } catch {
      setPreferences(defaults);
    }
  }, []);

  function toggle(key: PreferenceKey) {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold leading-6 text-slate-600">
        Tạm thời lưu lựa chọn trên thiết bị này. Khi bật push notification thật, các lựa chọn này sẽ được đồng bộ vào tài khoản.
      </p>
      <div className="space-y-2">
        {options.map((option) => {
          const enabled = preferences[option.key];

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggle(option.key)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-cream-200 bg-white/75 p-3 text-left transition hover:border-primary-200 hover:bg-primary-50"
              aria-pressed={enabled}
            >
              <span className="min-w-0">
                <span className="block text-sm font-black text-ink">{option.title}</span>
                <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500">{option.description}</span>
              </span>
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-primary-700" : "bg-slate-200"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
