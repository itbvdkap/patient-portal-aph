"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronUp, IdCard, KeyRound, Loader2, LogOut, Pencil, Phone, Plus, Save, Search, ShieldAlert, Smartphone, Trash2, UserRound, X } from "lucide-react";
import type { AccountDeviceSession, AccountIdentity, AccountPatientProfile } from "@/lib/account/portal-account";
import { PATIENT_BRANCHES, type PatientBranchCode } from "@anphu/patient-domain";
import { formatDateTime } from "@/utils/format";

const relationshipOptions = ["Bản thân", "Con", "Cha/Mẹ", "Vợ/Chồng", "Anh/Chị/Em", "Ông/Bà", "Người giám hộ", "Người thân", "Khác"];

function profileKey(profile: { mabn: string; branchCode?: string }) {
  return `${profile.branchCode ?? "CN1"}:${profile.mabn}`;
}

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

export function AccountIdentityForm({ identity, accountName, phone }: { identity?: AccountIdentity; accountName: string; phone: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(accountName);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(body?.error ?? "Chưa cập nhật được thông tin tài khoản.");
        return;
      }

      setEditing(false);
      setMessage("Đã cập nhật thông tin tài khoản.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function cancel() {
    setFullName(accountName);
    setMessage("");
    setEditing(false);
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-md border border-primary-100 bg-primary-50/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-ink">Tên hiển thị trong app</p>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">Không thay đổi dữ liệu hồ sơ y tế/HIS.</p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary-700 px-3 text-sm font-bold text-white hover:bg-primary-800"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Sửa
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Tên tài khoản
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="h-11 rounded-md border border-cream-200 bg-white/90 px-3 text-base font-semibold outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
              autoComplete="name"
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-bold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
              Lưu
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={submitting}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-cream-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-cream-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className={`mt-3 rounded-md px-3 py-2 text-sm font-semibold leading-6 ${message.startsWith("Đã") ? "bg-white text-primary-800" : "bg-amber-100 text-amber-900"}`}>
          {message}
        </p>
      ) : null}

      {identity?.phoneVerifiedAt || editing ? null : (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
          Số điện thoại tài khoản {phone ? `(${phone}) ` : ""}chưa được xác minh.
        </p>
      )}
    </form>
  );
}

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setMessage("Mật khẩu nhập lại chưa khớp.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(body?.error ?? "Chưa đổi được mật khẩu.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Đã cập nhật mật khẩu.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <p className="text-sm font-semibold leading-6 text-slate-600">
        {hasPassword ? "Nhập mật khẩu hiện tại để đổi sang mật khẩu mới." : "Tài khoản chưa có mật khẩu. Bạn có thể tạo mật khẩu mới ngay tại đây."}
      </p>
      {hasPassword ? (
        <label className="grid gap-1.5 text-sm font-bold text-ink">
          Mật khẩu hiện tại
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="h-11 rounded-md border border-cream-200 bg-white/90 px-3 text-base font-semibold outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
            autoComplete="current-password"
            required
          />
        </label>
      ) : null}
      <label className="grid gap-1.5 text-sm font-bold text-ink">
        Mật khẩu mới
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="h-11 rounded-md border border-cream-200 bg-white/90 px-3 text-base font-semibold outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-ink">
        Nhập lại mật khẩu mới
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-11 rounded-md border border-cream-200 bg-white/90 px-3 text-base font-semibold outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </label>

      {message ? (
        <p className={`rounded-md px-3 py-2 text-sm font-semibold leading-6 ${message.startsWith("Đã") ? "bg-primary-50 text-primary-800" : "bg-amber-100 text-amber-900"}`}>
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || (hasPassword && !currentPassword) || !newPassword || !confirmPassword}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-bold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <KeyRound aria-hidden="true" className="h-4 w-4" />}
        Cập nhật mật khẩu
      </button>
    </form>
  );
}

export function ProfileSwitcher({ profiles }: { profiles: AccountPatientProfile[] }) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState("");
  const currentProfile = profiles.find((profile) => profile.isCurrent) ?? profiles[0];

  async function selectProfile(profile: AccountPatientProfile) {
    const key = profileKey(profile);
    setMessage("");
    setLoadingKey(key);
    try {
      const response = await fetch("/api/account/select-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mabn: profile.mabn, branchCode: profile.branchCode }),
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
      setLoadingKey(null);
    }
  }

  async function removeProfile(profile: AccountPatientProfile) {
    const key = profileKey(profile);
    if (confirmRemoveKey !== key) {
      setConfirmRemoveKey(key);
      setMessage("Bấm Gỡ liên kết một lần nữa để xác nhận.");
      return;
    }

    setMessage("");
    setRemovingKey(key);
    try {
      const response = await fetch("/api/account/unlink-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mabn: profile.mabn, branchCode: profile.branchCode }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(body?.error ?? "Không gỡ được hồ sơ.");
        return;
      }

      router.refresh();
    } finally {
      setRemovingKey(null);
      setConfirmRemoveKey(null);
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
              <span className="mt-0.5 block text-sm font-black text-primary-700">{currentProfile.branchName}</span>
              <span className="clinical-mono mt-0.5 block text-sm font-bold text-slate-600">{currentProfile.branchCode} · Mã BN: {currentProfile.mabn}</span>
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
                  key={profileKey(profile)}
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
                      <p className="mt-1 text-sm font-black text-primary-700">{profile.branchName}</p>
                      <p className="clinical-mono mt-1 text-sm font-bold text-slate-600">{profile.branchCode} · Mã BN: {profile.mabn}</p>
                      {profile.relationship ? <p className="mt-1 text-sm font-semibold text-slate-500">{profile.relationship}</p> : null}
                    </div>
                    <div className="grid shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => selectProfile(profile)}
                        disabled={profile.isCurrent || loadingKey !== null || removingKey !== null}
                        className="inline-flex min-h-10 items-center justify-center rounded-md bg-ink px-3 text-sm font-bold text-white hover:bg-primary-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {loadingKey === profileKey(profile) ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : profile.isCurrent ? "Đã chọn" : "Chọn"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeProfile(profile)}
                        disabled={profiles.length <= 1 || loadingKey !== null || removingKey !== null}
                        className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-md border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${
                          confirmRemoveKey === profileKey(profile)
                            ? "border-rose-700 bg-rose-700 text-white"
                            : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                        }`}
                      >
                        {removingKey === profileKey(profile) ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
                        {confirmRemoveKey === profileKey(profile) ? "Xác nhận gỡ" : "Gỡ"}
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
  const [branchCode, setBranchCode] = useState<PatientBranchCode>("CN1");
  const [lookup, setLookup] = useState<{
    hisPatientCode: string;
    branchCode?: PatientBranchCode;
    branchName?: string;
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
        body: JSON.stringify({ mabn, branchCode }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        data?: {
          hisPatientCode: string;
          branchCode?: PatientBranchCode;
          branchName?: string;
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
        body: JSON.stringify({ mabn, branchCode, phone, citizenId, birthDate: normalizedBirthDate, relationship }),
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
      <div className="grid gap-2 sm:grid-cols-2">
        {PATIENT_BRANCHES.map((branch) => (
          <button
            key={branch.code}
            type="button"
            onClick={() => {
              setBranchCode(branch.code);
              setLookup(null);
              setMessage("");
            }}
            className={`rounded-md border px-3 py-2 text-left text-sm font-black transition ${
              branchCode === branch.code ? "border-primary-700 bg-primary-700 text-white" : "border-cream-200 bg-white text-ink hover:border-primary-200"
            }`}
          >
            <span className="block">{branch.shortName}</span>
            <span className={`mt-0.5 block text-xs font-semibold ${branchCode === branch.code ? "text-white/80" : "text-slate-500"}`}>{branch.location}</span>
          </button>
        ))}
      </div>

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
              <p className="mt-1 text-sm font-black text-primary-800">{lookup.branchName ?? PATIENT_BRANCHES.find((branch) => branch.code === branchCode)?.name}</p>
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
