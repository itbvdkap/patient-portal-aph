"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, IdCard, Loader2, LogOut, Phone, Plus, ShieldAlert, Smartphone } from "lucide-react";
import type { AccountDeviceSession, AccountPatientProfile } from "@/lib/account/portal-account";
import { formatDateTime } from "@/utils/format";

export function ProfileSwitcher({ profiles }: { profiles: AccountPatientProfile[] }) {
  const router = useRouter();
  const [loadingMabn, setLoadingMabn] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function selectProfile(mabn: string) {
    setMessage("");
    setLoadingMabn(mabn);
    try {
      const response = await fetch("/api/account/select-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mabn }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(body?.error ?? "Không chọn được hồ sơ.");
        return;
      }

      router.refresh();
      router.push("/dashboard");
    } finally {
      setLoadingMabn(null);
    }
  }

  return (
    <div className="grid gap-3">
      {profiles.map((profile) => (
        <article
          key={profile.mabn}
          className={`rounded-md border p-3 ${
            profile.isCurrent ? "border-primary-200 bg-primary-50/80" : "border-cream-200 bg-white/70"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-serif text-lg font-black leading-6 text-ink">{profile.fullName}</h3>
                {profile.isCurrent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-700 px-2 py-1 text-xs font-bold text-white">
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                    Đang xem
                  </span>
                ) : null}
              </div>
              <p className="clinical-mono mt-1 text-sm font-bold text-slate-600">Mã BN: {profile.mabn}</p>
              {profile.relationship ? <p className="mt-1 text-sm font-semibold text-slate-500">{profile.relationship}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => selectProfile(profile.mabn)}
              disabled={profile.isCurrent || loadingMabn !== null}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-ink px-3 text-sm font-bold text-white hover:bg-primary-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {loadingMabn === profile.mabn ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : profile.isCurrent ? "Đã chọn" : "Chọn"}
            </button>
          </div>
        </article>
      ))}
      {message ? <p className="rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">{message}</p> : null}
    </div>
  );
}

export function LinkProfileForm() {
  const router = useRouter();
  const [mabn, setMabn] = useState("");
  const [phone, setPhone] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/account/link-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mabn, phone, citizenId, birthDate }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; data?: { fullName?: string } } | null;

      if (!response.ok) {
        setMessage(body?.error ?? "Không liên kết được hồ sơ.");
        return;
      }

      setMabn("");
      setPhone("");
      setCitizenId("");
      setBirthDate("");
      setMessage(`Đã thêm hồ sơ ${body?.data?.fullName ?? ""}`.trim());
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-ink">
          Mã bệnh nhân
          <input
            value={mabn}
            onChange={(event) => setMabn(event.target.value)}
            className="clinical-mono h-11 rounded-md border border-cream-200 bg-white/80 px-3 text-base outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
            placeholder="Ví dụ: 23006552"
            autoComplete="off"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-ink">
          Ngày sinh
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            className="clinical-mono h-11 rounded-md border border-cream-200 bg-white/80 px-3 text-base outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-ink">
          Số điện thoại
          <span className="flex h-11 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
            <Phone aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-base outline-none"
              placeholder="0911071001"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-ink">
          CCCD/CMND
          <span className="flex h-11 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
            <IdCard aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              value={citizenId}
              onChange={(event) => setCitizenId(event.target.value)}
              className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-base outline-none"
              placeholder="Nhập CCCD/CMND"
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </span>
        </label>
      </div>

      {message ? <p className="rounded-md bg-cream-100 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-4 font-bold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Plus aria-hidden="true" className="h-5 w-5" />}
        Thêm hồ sơ người thân
      </button>
    </form>
  );
}

export function DeviceSessions({ sessions }: { sessions: AccountDeviceSession[] }) {
  const [submitting, setSubmitting] = useState(false);

  async function logoutAll() {
    setSubmitting(true);
    await fetch("/api/account/logout-all", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {sessions.length ? (
          sessions.map((session) => (
            <article
              key={session.sessionId}
              className={`rounded-md border p-3 ${session.revokedAt ? "border-rose-100 bg-rose-50/60" : session.isCurrent ? "border-primary-200 bg-primary-50/80" : "border-cream-200 bg-white/70"}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-primary-700 shadow-sm">
                  <Smartphone aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-ink">{session.deviceLabel}</h3>
                    {session.isCurrent ? <span className="rounded-full bg-primary-700 px-2 py-1 text-xs font-bold text-white">Thiết bị này</span> : null}
                    {session.revokedAt ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">Đã đăng xuất</span> : null}
                  </div>
                  <p className="clinical-mono mt-1 text-xs font-semibold text-slate-500">Đăng nhập: {formatDateTime(session.signedInAt)}</p>
                  {session.lastSeenAt ? <p className="clinical-mono mt-0.5 text-xs font-semibold text-slate-500">Hoạt động: {formatDateTime(session.lastSeenAt)}</p> : null}
                  {session.ipAddress ? <p className="clinical-mono mt-0.5 text-xs font-semibold text-slate-500">IP: {session.ipAddress}</p> : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-cream-200 bg-white/60 p-4 text-sm font-semibold leading-6 text-slate-600">
            Chưa có dữ liệu thiết bị. Apply migration tài khoản mới để bắt đầu ghi nhận lịch sử đăng nhập.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={logoutAll}
        disabled={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-rose-700 px-4 font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <LogOut aria-hidden="true" className="h-5 w-5" />}
        Đăng xuất khỏi tất cả thiết bị
      </button>
      <p className="flex gap-2 text-xs font-semibold leading-5 text-slate-500">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        Các thiết bị khác sẽ bị chặn khi mở lại trang hoặc gọi dữ liệu mới.
      </p>
    </div>
  );
}
