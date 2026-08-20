"use client";

import { useEffect, useState } from "react";

const preferenceKey = "anphucare-text-size";

export function AccessibilityTextToggle({ compact = false }: { compact?: boolean }) {
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(preferenceKey);
    const enabled = saved === "large";
    setLargeText(enabled);
    document.documentElement.classList.toggle("large-text-mode", enabled);
  }, []);

  function toggle() {
    const next = !largeText;
    setLargeText(next);
    document.documentElement.classList.toggle("large-text-mode", next);
    window.localStorage.setItem(preferenceKey, next ? "large" : "normal");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={largeText}
      title="Bật/tắt chữ lớn"
      className={`inline-flex min-h-10 items-center justify-center rounded-md border font-black transition ${
        largeText
          ? "border-primary-700 bg-primary-700 text-white shadow-sm"
          : "border-primary-100 bg-white/85 text-primary-800 hover:bg-primary-50"
      } ${compact ? "h-10 w-10 text-sm" : "gap-2 px-3 text-sm"}`}
    >
      <span className="clinical-mono">A+</span>
      {!compact ? <span>Chữ lớn</span> : null}
    </button>
  );
}
