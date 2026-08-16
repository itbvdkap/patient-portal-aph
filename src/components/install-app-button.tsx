"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }, []);

  useEffect(() => {
    setInstalled(isStandalone);

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      setShowGuide(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isStandalone]);

  async function installApp() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        setInstalled(true);
      }
      setPromptEvent(null);
      return;
    }

    setShowGuide(true);
  }

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={installApp}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-primary-100 bg-white/85 px-3 text-sm font-bold text-primary-800 shadow-sm hover:bg-primary-50 ${className}`}
        aria-label="Thêm vào màn hình chính"
        title="Thêm vào màn hình chính"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        <span>{compact ? "Cài app" : "Thêm vào màn hình chính"}</span>
      </button>

      {showGuide ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 backdrop-blur-[2px] sm:items-center sm:justify-center">
          <section className="w-full rounded-2xl border border-cream-200 bg-cream-50 p-4 shadow-[0_24px_60px_rgba(7,60,57,0.24)] sm:max-w-sm" aria-label="Hướng dẫn cài app">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-black text-ink">Thêm app</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Mở menu chia sẻ của trình duyệt, sau đó chọn thêm vào màn hình chính.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-cream-100 hover:text-ink"
                aria-label="Đóng"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 rounded-md border border-primary-100 bg-white/70 p-3 text-sm font-semibold text-ink">
              <Share2 aria-hidden="true" className="mr-2 inline h-4 w-4 text-primary-700" />
              iPhone/iPad: Chia sẻ → Thêm vào Màn hình chính
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
