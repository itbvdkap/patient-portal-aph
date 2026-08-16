"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ value, label = "Sao chép" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value) return;

    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-white/15 px-2.5 text-xs font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20"
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
      {copied ? "Đã sao chép" : label}
    </button>
  );
}
