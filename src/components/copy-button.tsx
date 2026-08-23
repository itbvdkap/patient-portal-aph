"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({
  value,
  label = "Sao chép",
  variant = "dark",
}: {
  value: string;
  label?: string;
  variant?: "dark" | "light";
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value) return;

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const className =
    variant === "light"
      ? "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-primary-100 bg-white/80 px-2 text-[11px] font-bold text-primary-800 shadow-sm transition hover:bg-primary-50"
      : "inline-flex min-h-8 items-center gap-1.5 rounded-md bg-white/15 px-2.5 text-xs font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20";

  return (
    <button
      type="button"
      onClick={copyValue}
      className={className}
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
      {copied ? "Đã sao chép" : label}
    </button>
  );
}
