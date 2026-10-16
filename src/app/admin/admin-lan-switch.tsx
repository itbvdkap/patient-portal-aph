"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi } from "lucide-react";

const probeTimeoutMs = 4000;

export function buildLanTarget(baseUrl: string, pathname: string, search: string) {
  const current = /^\/admin(?:\/|$)/.test(pathname) ? `${pathname}${search}` : "/admin";
  return new URL(current, baseUrl).toString();
}

export function AdminLanSwitch({ baseUrl, compact }: { baseUrl: string; compact: boolean }) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const probeRef = useRef<HTMLImageElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAvailable(window.location.origin !== baseUrl);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (probeRef.current) {
        probeRef.current.onload = null;
        probeRef.current.onerror = null;
      }
    };
  }, [baseUrl]);

  function openLan() {
    if (checking) return;
    setChecking(true);
    setError("");

    const probe = new Image();
    probeRef.current = probe;
    let settled = false;
    const finish = (connected: boolean) => {
      if (settled) return;
      settled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      probe.onload = null;
      probe.onerror = null;
      probeRef.current = null;
      setChecking(false);
      if (connected) {
        window.location.assign(buildLanTarget(baseUrl, window.location.pathname, window.location.search));
      } else {
        setError("Không kết nối được máy chủ nội bộ. Anh vẫn đang ở trang public; hãy kiểm tra LAN và chứng chỉ HTTPS nội bộ.");
      }
    };
    probe.onload = () => finish(true);
    probe.onerror = () => finish(false);
    timerRef.current = setTimeout(() => finish(false), probeTimeoutMs);
    probe.src = `${baseUrl}/admin/lan-ready.gif?t=${Date.now()}`;
  }

  if (!available) return null;
  return <div className="mt-3">
    <button type="button" onClick={openLan} disabled={checking} title={compact ? "Mở bản nội bộ CN1" : undefined}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-black text-white transition hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-70">
      <Wifi aria-hidden="true" className="h-4 w-4" />
      <span className={compact ? "sr-only" : ""}>{checking ? "Đang kiểm tra LAN…" : "Mở bản nội bộ CN1"}</span>
    </button>
    {error && <p role="alert" className={compact ? "sr-only" : "mt-2 rounded bg-amber-50 p-2 text-xs leading-5 text-amber-950"}>{error}</p>}
  </div>;
}
