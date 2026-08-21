"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronUp, IdCard, Loader2, LogOut, Phone, Plus, Search, ShieldAlert, Smartphone, Trash2, UserRound, X } from "lucide-react";
import type { AccountDeviceSession, AccountPatientProfile } from "@/lib/account/portal-account";
import { formatDateTime } from "@/utils/format";

const relationshipOptions = ["Bản thân", "Con", "Cha/Mẹ", "Vợ/Chồng", "Anh/Chị/Em", "Ông/Bà", "Người giám hộ", "Người thân", "Khác"];

function vnDateToIso(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return "";
  }

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  return `${year}-${month}-${day}`;
}

function formatVnDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function ProfileSwitcher({ profiles }: { profiles: AccountPatientProfile[] }) {
  const router = useRouter();
  const [loadingMabn, setLoadingMabn] = useState<string | null>(null);
  const [removingMabn, setRemovingMabn] = useState<string | null>(null);
  const [confirmRemoveMabn, setConfirmRemoveMabn] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState("");
  const currentProfile = profiles.find((profile) => profile.isCurrent) ?? profiles[0];

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

      setSheetOpen(false);
      router.refresh();
      router.push("/dashboard");
    } finally {
      setLoadingMabn(null);
    }
  }

  async function removeProfile(mabn: string) {
    if (confirmRemoveMabn !== mabn) {
      setConfirmRemoveMabn(mabn);
      setMessage("Bấm Gỡ liên kết một lần nữa để xác nhận.");
      return;
    }

    setMessage("");
    setRemovingMabn(mabn);
    try {
      const response = await fetch("/api/account/unlink-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mabn }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(body?.error ?? "Không gỡ được hồ sơ.");
        return;
      }

      router.refresh();
    } finally {
      setRemovingMabn(null);
      setConfirmRemoveMabn(null);
    }
  }

  return (
    <div className="grid gap-3">
      {currentProfile ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex min-h-20 items-center justify-between gap-3 rounded-md border border-primary-200 bg-primary-50/80 p-3 text-left shadow-sm"
          aria-expanded={sheetOpen}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white">
              <UserRound aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-serif text-lg font-black leading-6 text-ink">{currentProfile.fullName}</span>
              <span className="clinical-mono mt-0.5 block text-sm font-bold text-slate-600">Mã BN: {currentProfile.mabn}</span>
              <span className="mt-0.5 block text-sm font-semibold text-slate-500">{currentProfile.relationship || "Hồ sơ liên kết"}</span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2.5 py-2 text-xs font-black text-primary-700 ring-1 ring-primary-100">
            Đổi
            <ChevronUp aria-hidden="true" className="h-4 w-4" />
          </span>
        </button>
      ) : (
        <div className="rounded-md border border-dashed border-cream-200 bg-white/60 p-4 text-sm font-semibold leading-6 text-slate-600">
          Chưa có hồ sơ y tế liên kết. Hãy thêm hồ sơ bằng mã bệnh nhân ở phần bên dưới.
        </div>
      )}

      {message ? <p className="rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">{message}</p> : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 backdrop-blur-[2px]" onClick={() => setSheetOpen(false)}>
          <section
            className="mx-auto max-h-[82vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-cream-200 bg-cream-50 shadow-[0_24px_60px_rgba(7,60,57,0.24)]"
            aria-label="Chọn hồ sơ đang xem"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
              <div>
                <h2 className="font-serif text-lg font-black text-ink">Hồ sơ người thân</h2>
                <p className="clinical-mono mt-0.5 text-xs font-semibold text-slate-500">{profiles.length} hồ sơ đã liên kết</p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-cream-100 hover:text-ink"
                aria-label="Đóng chọn hồ sơ"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-[65vh] gap-3 overflow-auto p-4">
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
                    <div className="grid shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => selectProfile(profile.mabn)}
                        disabled={profile.isCurrent || loadingMabn !== null || removingMabn !== null}
                        className="inline-flex min-h-10 items-center justify-center rounded-md bg-ink px-3 text-sm font-bold text-white hover:bg-primary-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {loadingMabn === profile.mabn ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : profile.isCurrent ? "Đã chọn" : "Chọn"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeProfile(profile.mabn)}
                        disabled={profiles.length <= 1 || loadingMabn !== null || removingMabn !== null}
                        className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-md border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${
                          confirmRemoveMabn === profile.mabn
                            ? "border-rose-700 bg-rose-700 text-white"
                            : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                        }`}
                      >
                        {removingMabn === profile.mabn ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
                        {confirmRemoveMabn === profile.mabn ? "Xác nhận gỡ" : "Gỡ"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function LinkProfileForm() {
  const router = useRouter();
  const [mabn, setMabn] = useState("");
  const [lookup, setLookup] = useState<{
    hisPatientCode: string;
    patientCodeMasked: string;
    fullName: string;
    phoneMasked: string;
    birthDateMasked: string;
  } | null>(null);
  const [phone, setPhone] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relationship, setRelationship] = useState("Người thân");
  const [message, setMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function lookupProfile() {
    setMessage("");
    setLookup(null);
    setPhone("");
    setCitizenId("");
    setBirthDate("");
    setRelationship("Người thân");
    setLookingUp(true);

    try {
      const response = await fetch("/api/account/lookup-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mabn }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        data?: {
          hisPatientCode: string;
          patientCodeMasked: string;
          fullName: string;
          phoneMasked: string;
          birthDateMasked: string;
        };
      } | null;

      if (!response.ok || !body?.data) {
        setMessage(body?.error ?? "Không tìm thấy hồ sơ.");
        return;
      }

      setLookup(body.data);
    } finally {
      setLookingUp(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lookup) {
      await lookupProfile();
      return;
    }

    setMessage("");
    setSubmitting(true);

    try {
      const normalizedBirthDate = vnDateToIso(birthDate);
      if (!normalizedBirthDate) {
        setMessage("Ngày sinh phải nhập theo định dạng dd/mm/yyyy.");
        return;
      }

      const response = await fetch("/api/account/link-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mabn, phone, citizenId, birthDate: normalizedBirthDate, relationship }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; data?: { fullName?: string } } | null;

      if (!response.ok) {
        setMessage(body?.error ?? "Không liên kết được hồ sơ.");
        return;
      }

      setMabn("");
      setLookup(null);
      setPhone("");
      setCitizenId("");
      setBirthDate("");
      setRelationship("Người thân");
      setMessage(`Đã thêm hồ sơ ${body?.data?.fullName ?? ""}`.trim());
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-bold text-ink">
        Mã bệnh nhân
        <span className="flex min-h-12 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
          <IdCard aria-hidden="true" className="h-5 w-5 text-primary-700" />
          <input
            value={mabn}
            onChange={(event) => {
              setMabn(event.target.value);
              setLookup(null);
              setMessage("");
            }}
            className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-base outline-none"
            placeholder="Ví dụ: N24-001111 hoặc 23006552"
            autoComplete="off"
            required
          />
          <button
            type="button"
            onClick={lookupProfile}
            disabled={!mabn.trim() || lookingUp || submitting}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary-700 px-3 text-sm font-bold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {lookingUp ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
            Tìm
          </button>
        </span>
      </label>

      {lookup ? (
        <section className="rounded-md border-2 border-primary-200 bg-primary-50/80 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white">
              <UserRound aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg font-black uppercase leading-6 text-primary-800">{lookup.fullName}</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-semibold text-slate-500">Mã NB</dt>
                <dd className="clinical-mono font-bold text-ink">{lookup.patientCodeMasked}</dd>
                <dt className="font-semibold text-slate-500">Điện thoại</dt>
                <dd className="clinical-mono font-bold text-ink">{lookup.phoneMasked}</dd>
                <dt className="font-semibold text-slate-500">Ngày sinh</dt>
                <dd className="clinical-mono font-bold text-ink">{lookup.birthDateMasked}</dd>
              </dl>
            </div>
            <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-primary-700" />
          </div>
        </section>
      ) : null}

      {lookup ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Ngày sinh
            <input
              type="text"
              value={birthDate}
              onChange={(event) => setBirthDate(formatVnDateInput(event.target.value))}
              className="clinical-mono h-11 rounded-md border border-cream-200 bg-white/80 px-3 text-base outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
              placeholder="dd/mm/yyyy"
              inputMode="numeric"
              autoComplete="bday"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Quan hệ
            <select
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
              className="h-11 rounded-md border border-cream-200 bg-white/80 px-3 text-base font-semibold outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
            >
              {relationshipOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {lookup ? (
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
          CCCD/CMND <span className="font-semibold text-slate-500">(có thể bỏ qua)</span>
          <span className="flex h-11 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
            <IdCard aria-hidden="true" className="h-4 w-4 text-primary-700" />
            <input
              value={citizenId}
              onChange={(event) => setCitizenId(event.target.value)}
              className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-base outline-none"
              placeholder="Không bắt buộc"
              inputMode="numeric"
              autoComplete="off"
            />
          </span>
        </label>
      </div>
      ) : null}

      {message ? <p className="rounded-md bg-cream-100 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p> : null}

      <button
        type="submit"
        disabled={(lookup ? submitting : lookingUp) || !mabn.trim()}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-4 font-bold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting || lookingUp ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : lookup ? <Plus aria-hidden="true" className="h-5 w-5" /> : <Search aria-hidden="true" className="h-5 w-5" />}
        {lookup ? "Xác nhận liên kết" : "Tìm hồ sơ"}
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
            Chưa có dữ liệu thiết bị. Lịch sử đăng nhập sẽ xuất hiện sau các lần đăng nhập tiếp theo.
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
