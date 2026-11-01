"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, RefreshCw } from "lucide-react";

export function PatientPageError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="patient-card" role="alert">
      <Info className="h-6 w-6 text-primary-700 mb-3" aria-hidden="true" />
      <h1 className="text-xl font-bold">Chưa tải được thông tin</h1>
      <p className="patient-subtitle my-3">
        Vui lòng kiểm tra kết nối và thử lại. Không có thông tin nào được thay
        đổi.
      </p>
      <button
        type="button"
        className="patient-primary"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        <RefreshCw
          className={pending ? "animate-spin" : ""}
          aria-hidden="true"
        />
        {pending ? "Đang tải lại…" : "Thử lại"}
      </button>
    </section>
  );
}

export function PatientPageLoading() {
  return (
    <section
      role="status"
      aria-label="Đang tải hồ sơ bệnh nhân"
      className="space-y-4"
    >
      <p className="text-sm text-slate-600">Đang tải thông tin của bạn…</p>
      {[1, 2, 3].map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className="h-24 rounded-lg bg-slate-100 animate-pulse"
        />
      ))}
    </section>
  );
}
