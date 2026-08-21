"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  QrCode,
  Send,
  ShieldCheck,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Badge, Panel, SectionHeader } from "@/components/ui";
import { normalizeDisplayText } from "@anphu/patient-domain";

const provinces = ["TP. Hồ Chí Minh", "TP. Đồng Nai", "Tây Ninh", "Lâm Đồng", "Đồng Tháp", "An Giang", "Khác"];

const branches = [
  "Bệnh viện An Phú CN1 - Thuận An",
  "Bệnh viện An Phú CN2 - VSIP II (Dự kiến hoạt động 2026)",
  "Phòng khám An Phú CN3 - Đồng Nai",
];

const departments = [
  "Nội khoa",
  "Ngoại khoa",
  "Sản khoa",
  "Nhi khoa",
  "Tai Mũi Họng",
  "Răng Hàm Mặt",
  "Mắt",
  "Da Liễu",
  "Y Học cổ truyền",
  "Phục hồi chức năng",
  "Khác",
];

const doctors = [
  "BS.CKII: NGUYỄN BẢO HIẾN (Khoa Nội)",
  "BS. PHẠM QUYẾT THẮNG (Khoa Nội)",
  "BS.CKI: PHẠM VĂN NƠI (Khoa Nội)",
  "ThS.BS: HỨA THANH VƯƠNG (Khoa Nhi)",
  "BS. HUỲNH THỊ TUYẾT SƯƠNG (Khoa Nhi)",
  "BS.CKII: NGUYỄN HỒNG TUẤN (Khoa Ngoại)",
  "BS.CKII: LƯƠNG CÔNG THÁI (Khoa LCK Tai-Mũi-Họng)",
  "BS.CKI: TRẦN QUỐC BẢO (Khoa LCK Răng-Hàm-Mặt)",
  "BS. TRẦN THỊ CẨM TÚ (Khoa Da liễu)",
  "Khoa - Bác sĩ khác",
];

const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

type BookingFormState = {
  oldPatientCode: string;
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  gender: string;
  weight: string;
  province: string;
  ward: string;
  address: string;
  branch: string;
  soCCCD: string;
  ngayCap: string;
  appointmentDate: string;
  appointmentTime: string;
  department: string;
  bacsikham: string;
  ghichu: string;
  symptoms: string;
  hasInsurance: boolean;
};

const initialForm: BookingFormState = {
  oldPatientCode: "",
  fullName: "",
  phone: "",
  email: "",
  birthDate: "",
  gender: "",
  weight: "",
  province: "",
  ward: "",
  address: "",
  branch: branches[0],
  soCCCD: "",
  ngayCap: "",
  appointmentDate: "",
  appointmentTime: "",
  department: "",
  bacsikham: "",
  ghichu: "",
  symptoms: "",
  hasInsurance: false,
};

export type BookingPatientProfile = {
  oldPatientCode: string;
  fullName: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  soCCCD?: string;
  ngayCap?: string;
  hasInsurance?: boolean;
};

type BookingResponse = {
  message?: string;
  data?: {
    ma_lich_hen?: string;
    id?: string | number;
  };
};

type CitizenQrData = {
  idNumber: string;
  fullName?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  issueDate?: string;
};

type Html5QrcodeScannerInstance = {
  render: (successCallback: (decodedText: string) => void, errorCallback?: () => void) => void;
  clear: () => Promise<void>;
};

type Html5QrcodeScannerConstructor = new (
  elementId: string,
  config: {
    fps: number;
    qrbox: { width: number; height: number };
    aspectRatio?: number;
    rememberLastUsedCamera?: boolean;
    supportedScanTypes?: unknown[];
  },
  verbose: boolean,
) => Html5QrcodeScannerInstance;

type Html5QrcodeModule = {
  Html5QrcodeScanner: Html5QrcodeScannerConstructor;
  Html5QrcodeScanType?: {
    SCAN_TYPE_CAMERA: unknown;
    SCAN_TYPE_FILE?: unknown;
  };
};

function inputClass(hasIcon = false) {
  return `min-h-12 w-full rounded-md border border-cream-200 bg-white px-3 text-sm font-semibold text-ink outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 ${
    hasIcon ? "pl-10" : ""
  }`;
}

function labelClass() {
  return "mb-1.5 block text-sm font-bold text-ink";
}

function IconInput({
  icon: Icon,
  children,
}: {
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-primary-700" />
      {children}
    </div>
  );
}

function RequiredMark() {
  return <span className="text-rose-600">*</span>;
}

function formatVnDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatCitizenDate(value: string | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return "";
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function normalizeCitizenGender(value: string | undefined) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "nam" || text === "male" || text === "m") return "Nam";
  if (text === "nữ" || text === "nu" || text === "female" || text === "f") return "Nữ";
  return text ? "Khác" : "";
}

function cleanDisplay(value: string | undefined) {
  return normalizeDisplayText(value ?? "");
}

function parseCitizenQr(raw: string): CitizenQrData | null {
  const parts = raw.split("|").map((part) => part.trim());

  if (parts.length < 4 || !/^\d{9,12}$/.test(parts[0])) {
    return null;
  }

  return {
    idNumber: parts[0],
    fullName: parts[2],
    birthDate: formatCitizenDate(parts[3]),
    gender: normalizeCitizenGender(parts[4]),
    address: parts[5],
    issueDate: formatCitizenDate(parts[6]),
  };
}

export function BookingForm({ linkedProfiles = [] }: { linkedProfiles?: BookingPatientProfile[] }) {
  const [form, setForm] = useState<BookingFormState>(initialForm);
  const [patientMode, setPatientMode] = useState<"new" | "old">(linkedProfiles.length ? "old" : "new");
  const [manualPatientCode, setManualPatientCode] = useState("");
  const [manualVerifyBirthDate, setManualVerifyBirthDate] = useState("");
  const [manualVerifyPhone, setManualVerifyPhone] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrMessage, setQrMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<BookingResponse | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  function update<K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccess(null);
  }

  function applyOldProfile(profile: BookingPatientProfile) {
    setPatientMode("old");
    setManualPatientCode(profile.oldPatientCode);
    setLookupMessage("");
    setError("");
    setSuccess(null);
    setForm((current) => ({
      ...current,
      oldPatientCode: profile.oldPatientCode,
      fullName: cleanDisplay(profile.fullName),
      phone: profile.phone ?? current.phone,
      birthDate: profile.birthDate ?? current.birthDate,
      gender: cleanDisplay(profile.gender) || current.gender,
      address: cleanDisplay(profile.address) || current.address,
      soCCCD: profile.soCCCD ?? "",
      ngayCap: profile.ngayCap ?? "",
      hasInsurance: Boolean(profile.hasInsurance),
      ghichu: current.ghichu || "Tái khám",
    }));
  }

  function startNewPatient() {
    setPatientMode("new");
    setStep(1);
    setManualPatientCode("");
    setManualVerifyBirthDate("");
    setManualVerifyPhone("");
    setLookupMessage("");
    setForm(initialForm);
  }

  function applyCitizenQr(data: CitizenQrData) {
    setPatientMode("new");
    setQrScannerOpen(false);
    setQrMessage("Đã lấy thông tin từ QR CCCD.");
    setError("");
    setSuccess(null);
    setForm((current) => ({
      ...current,
      oldPatientCode: "",
      soCCCD: data.idNumber || current.soCCCD,
      fullName: cleanDisplay(data.fullName) || current.fullName,
      birthDate: data.birthDate || current.birthDate,
      gender: cleanDisplay(data.gender) || current.gender,
      address: cleanDisplay(data.address) || current.address,
      ngayCap: data.issueDate || current.ngayCap,
    }));
  }

  async function lookupOldPatient() {
    const mabn = manualPatientCode.trim();
    if (!mabn) return;

    setLookingUp(true);
    setLookupMessage("");
    setError("");

    try {
      const response = await fetch("/api/booking/patient-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mabn,
          birthDate: manualVerifyBirthDate,
          phone: manualVerifyPhone,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; data?: BookingPatientProfile } | null;

      if (!response.ok || !body?.data) {
        setLookupMessage(body?.error ?? "Chưa tìm thấy hồ sơ bệnh nhân.");
        return;
      }

      applyOldProfile(body.data);
      setLookupMessage(`Đã xác minh và lấy thông tin hồ sơ ${cleanDisplay(body.data.fullName)}.`);
    } finally {
      setLookingUp(false);
    }
  }

  function goToPatientStep() {
    setError("");
    setStep(1);
  }

  function continueFromPatientStep() {
    if (!form.fullName.trim()) {
      setError("Vui lòng nhập họ tên bệnh nhân.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Vui lòng nhập số điện thoại liên hệ.");
      return;
    }

    if (patientMode === "new" && !form.soCCCD.trim()) {
      setError("Bệnh nhân mới cần nhập CCCD/CMND hoặc quét QR CCCD.");
      return;
    }

    setError("");
    setStep(2);
  }

  function continueFromScheduleStep() {
    if (!form.appointmentDate.trim()) {
      setError("Vui lòng chọn ngày khám.");
      return;
    }

    setError("");
    setStep(3);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const turnstileToken = event.currentTarget.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value ?? "";
    setIsSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const response = await fetch("/api/booking/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cf_turnstile_response: turnstileToken }),
      });
      const data = (await response.json().catch(() => ({}))) as BookingResponse;

      if (!response.ok) {
        setError(data.message ?? "Chưa gửi được đăng ký khám. Vui lòng kiểm tra lại thông tin.");
        return;
      }

      setSuccess(data);
      setForm(initialForm);
      setStep(1);
    } catch {
      setError("Không kết nối được hệ thống đăng ký khám. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      )}
      {success && (
        <Panel className="border-primary-200 bg-primary-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-primary-700" />
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">Đã gửi đăng ký khám</h2>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {success.message ?? "Bệnh viện đã tiếp nhận thông tin đăng ký của bạn."}
              </p>
              {success.data?.ma_lich_hen && (
                <p className="clinical-mono mt-2 text-base font-black text-primary-900">
                  Mã lịch hẹn: {success.data.ma_lich_hen}
                </p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold leading-6 text-rose-700">
          {error}
        </div>
      )}

      <BookingStepper step={step} />

      {step === 1 ? (
        <>
      <Panel>
        <SectionHeader title="Đối tượng đăng ký" meta={patientMode === "old" ? "Bệnh nhân cũ" : "Bệnh nhân mới"} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={startNewPatient}
            className={`min-h-11 rounded-md border px-3 text-sm font-black ${
              patientMode === "new" ? "border-primary-700 bg-primary-700 text-white" : "border-cream-200 bg-white text-ink"
            }`}
          >
            Bệnh nhân mới
          </button>
          <button
            type="button"
            onClick={() => setPatientMode("old")}
            className={`min-h-11 rounded-md border px-3 text-sm font-black ${
              patientMode === "old" ? "border-primary-700 bg-primary-700 text-white" : "border-cream-200 bg-white text-ink"
            }`}
          >
            Đã từng khám
          </button>
        </div>

        {patientMode === "old" ? (
          <div className="mt-3 space-y-3">
            {linkedProfiles.length ? (
              <div className="grid gap-2">
                {linkedProfiles.map((profile) => (
                  <button
                    key={profile.oldPatientCode}
                    type="button"
                    onClick={() => applyOldProfile(profile)}
                    className={`rounded-md border p-3 text-left transition ${
                      form.oldPatientCode === profile.oldPatientCode
                        ? "border-primary-300 bg-primary-50"
                        : "border-cream-200 bg-white hover:border-primary-200"
                    }`}
                  >
                    <span className="block font-serif text-base font-black text-ink">{cleanDisplay(profile.fullName)}</span>
                    <span className="clinical-mono mt-1 block text-sm font-bold text-slate-600">Mã BN: {profile.oldPatientCode}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex min-h-12 items-center gap-2 rounded-md border border-cream-200 bg-white px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
              <IdCard aria-hidden="true" className="h-5 w-5 text-primary-700" />
              <input
                value={manualPatientCode}
                onChange={(event) => {
                  setManualPatientCode(event.target.value);
                  setLookupMessage("");
                }}
                className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-base outline-none"
                placeholder="Nhập mã BN cũ"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label>
                <span className={labelClass()}>Ngày sinh để xác minh</span>
                <input
                  value={manualVerifyBirthDate}
                  onChange={(event) => {
                    setManualVerifyBirthDate(formatVnDateInput(event.target.value));
                    setLookupMessage("");
                  }}
                  className={inputClass()}
                  placeholder="dd/mm/yyyy"
                  inputMode="numeric"
                />
              </label>
              <label>
                <span className={labelClass()}>SĐT đã đăng ký</span>
                <input
                  value={manualVerifyPhone}
                  onChange={(event) => {
                    setManualVerifyPhone(event.target.value);
                    setLookupMessage("");
                  }}
                  className={inputClass()}
                  placeholder="Có thể nhập nếu nhớ"
                  inputMode="tel"
                />
              </label>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={lookupOldPatient}
                disabled={!manualPatientCode.trim() || (!manualVerifyBirthDate.trim() && !manualVerifyPhone.trim()) || lookingUp}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-primary-800 px-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:opacity-100"
              >
                {lookingUp ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
                Xác minh hồ sơ
              </button>
            </div>
            <p className="rounded-md border border-primary-100 bg-primary-50 px-3 py-2 text-xs font-semibold leading-5 text-primary-900">
              Để bảo mật, app chỉ tự điền hồ sơ cũ và CCCD/CMND sau khi mã BN khớp thêm ngày sinh hoặc số điện thoại.
            </p>
            {lookupMessage ? <p className="rounded-md bg-cream-100 px-3 py-2 text-sm font-semibold text-slate-700">{lookupMessage}</p> : null}
          </div>
        ) : null}

        {patientMode === "new" ? (
          <div className="mt-3 space-y-3 rounded-md border border-primary-100 bg-primary-50/70 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-primary-800">
                <QrCode aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-base font-black text-ink">Quét QR CCCD</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">Dùng camera điện thoại hoặc ảnh QR CCCD để tự điền CCCD, họ tên, ngày sinh, giới tính và địa chỉ.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setQrScannerOpen(true);
                setQrMessage("");
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary-800 px-4 text-sm font-black text-white"
            >
              <QrCode aria-hidden="true" className="h-4 w-4" />
              Quét QR CCCD
            </button>
            {qrMessage ? <p className="rounded-md bg-white/80 px-3 py-2 text-sm font-semibold text-primary-900">{qrMessage}</p> : null}
          </div>
        ) : null}
      </Panel>

      <CitizenQrScanner
        open={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onResult={applyCitizenQr}
        onMessage={setQrMessage}
      />

      <Panel>
        <SectionHeader title="Thông tin bệnh nhân" meta="Bắt buộc" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass()}>
              Họ và tên <RequiredMark />
            </span>
            <IconInput icon={UserRound}>
              <input
                className={inputClass(true)}
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                placeholder="Nhập họ tên"
                required
              />
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>
              Số điện thoại <RequiredMark />
            </span>
            <IconInput icon={Phone}>
              <input
                className={inputClass(true)}
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                inputMode="tel"
                placeholder="Ví dụ: 0912345678"
                required
              />
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>Email</span>
            <input
              className={inputClass()}
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              inputMode="email"
              placeholder="abc@gmail.com"
            />
          </label>

          <label>
            <span className={labelClass()}>Ngày sinh</span>
            <input
              className={inputClass()}
              value={form.birthDate}
              onChange={(event) => update("birthDate", formatVnDateInput(event.target.value))}
              placeholder="dd/mm/yyyy"
              inputMode="numeric"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass()}>Giới tính</span>
              <select className={inputClass()} value={form.gender} onChange={(event) => update("gender", event.target.value)}>
                <option value="">Chọn</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </label>

            <label>
              <span className={labelClass()}>Cân nặng</span>
              <input
                className={inputClass()}
                value={form.weight}
                onChange={(event) => update("weight", event.target.value)}
                inputMode="decimal"
                placeholder="kg"
              />
            </label>
          </div>

          <label>
            <span className={labelClass()}>Tỉnh/TP</span>
            <IconInput icon={MapPin}>
              <select className={inputClass(true)} value={form.province} onChange={(event) => update("province", event.target.value)}>
                <option value="">Chọn tỉnh/TP</option>
                {provinces.map((province) => (
                  <option key={province} value={province}>
                    {cleanDisplay(province)}
                  </option>
                ))}
              </select>
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>Phường/Xã</span>
            <input className={inputClass()} value={form.ward} onChange={(event) => update("ward", event.target.value)} />
          </label>

          <label className="sm:col-span-2">
            <span className={labelClass()}>Địa chỉ</span>
            <input className={inputClass()} value={form.address} onChange={(event) => update("address", event.target.value)} />
          </label>
        </div>
      </Panel>

      <Panel>
        <SectionHeader title="Xác thực đăng ký" meta={form.oldPatientCode ? "Có hồ sơ cũ" : "Bắt buộc"} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelClass()}>
              CCCD/CMND {!form.oldPatientCode ? <RequiredMark /> : <span className="font-semibold text-slate-500">(có thể bỏ qua)</span>}
            </span>
            <IconInput icon={IdCard}>
              <input
                className={inputClass(true)}
                value={form.soCCCD}
                onChange={(event) => update("soCCCD", event.target.value)}
                inputMode="numeric"
                placeholder={form.oldPatientCode ? "Không bắt buộc" : "Nhập CCCD/CMND"}
                required={!form.oldPatientCode}
              />
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>Ngày cấp</span>
            <input
              className={inputClass()}
              value={form.ngayCap}
              onChange={(event) => update("ngayCap", formatVnDateInput(event.target.value))}
              placeholder="dd/mm/yyyy"
              inputMode="numeric"
            />
          </label>
        </div>
      </Panel>

      <WizardActions
        primaryLabel="Tiếp tục chọn lịch khám"
        onPrimary={continueFromPatientStep}
      />
        </>
      ) : null}

      {step === 2 ? (
        <>
      <Panel>
        <SectionHeader title="Thông tin khám" meta="Chọn lịch" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass()}>Chi nhánh</span>
            <IconInput icon={Building2}>
              <select className={inputClass(true)} value={form.branch} onChange={(event) => update("branch", event.target.value)}>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {cleanDisplay(branch)}
                  </option>
                ))}
              </select>
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>
              Ngày khám <RequiredMark />
            </span>
            <IconInput icon={CalendarDays}>
              <input
                className={inputClass(true)}
                value={form.appointmentDate}
                onChange={(event) => update("appointmentDate", formatVnDateInput(event.target.value))}
                placeholder="dd/mm/yyyy"
                inputMode="numeric"
                required
              />
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>Giờ khám</span>
            <IconInput icon={Clock}>
              <select className={inputClass(true)} value={form.appointmentTime} onChange={(event) => update("appointmentTime", event.target.value)}>
                <option value="">Chọn giờ</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>Khoa khám</span>
            <IconInput icon={HeartPulse}>
              <select className={inputClass(true)} value={form.department} onChange={(event) => update("department", event.target.value)}>
                <option value="">Chọn khoa</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {cleanDisplay(department)}
                  </option>
                ))}
              </select>
            </IconInput>
          </label>

          <label>
            <span className={labelClass()}>Bác sĩ</span>
            <select className={inputClass()} value={form.bacsikham} onChange={(event) => update("bacsikham", event.target.value)}>
              <option value="">Chọn nếu có nhu cầu</option>
              {doctors.map((doctor) => (
                  <option key={doctor} value={doctor}>
                    {cleanDisplay(doctor)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass()}>Loại đăng ký</span>
            <select className={inputClass()} value={form.ghichu} onChange={(event) => update("ghichu", event.target.value)}>
              <option value="">Chọn</option>
              <option value="Khám lần đầu">Khám lần đầu</option>
              <option value="Tái khám">Tái khám</option>
            </select>
          </label>

          <label className="flex min-h-12 items-center gap-3 rounded-md border border-cream-200 bg-white px-3">
            <input
              type="checkbox"
              checked={form.hasInsurance}
              onChange={(event) => update("hasInsurance", event.target.checked)}
              className="h-5 w-5 rounded border-cream-300 text-primary-700"
            />
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary-700" />
              Có BHYT
            </span>
          </label>
        </div>
      </Panel>

      <WizardActions
        secondaryLabel="Quay lại thông tin bệnh nhân"
        onSecondary={goToPatientStep}
        primaryLabel="Tiếp tục xác nhận"
        onPrimary={continueFromScheduleStep}
      />
        </>
      ) : null}

      {step === 3 ? (
        <>
      <Panel>
        <SectionHeader title="Lý do khám" />
        <label>
          <span className={labelClass()}>Triệu chứng / nhu cầu khám</span>
          <div className="relative">
            <FileText aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-primary-700" />
            <textarea
              className={`${inputClass(true)} min-h-28 resize-y py-3 leading-6`}
              value={form.symptoms}
              onChange={(event) => update("symptoms", event.target.value)}
              placeholder="Ví dụ: đau bụng, tái khám, kiểm tra sức khỏe..."
            />
          </div>
        </label>
      </Panel>

      <div className="sticky bottom-[72px] z-10 -mx-1 rounded-md border border-cream-200 bg-cream-50/95 p-2 shadow-[0_-10px_30px_rgba(7,60,57,0.12)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <div className="mb-2 flex justify-center">
            <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
          </div>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-primary-950 bg-[#005f56] px-4 text-base font-black text-white shadow-[0_14px_32px_rgba(0,95,86,0.32)] ring-2 ring-primary-100 transition hover:bg-[#004c45] disabled:cursor-not-allowed disabled:border-slate-500 disabled:bg-slate-600 disabled:opacity-100"
        >
          {isSubmitting ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Send aria-hidden="true" className="h-5 w-5" />}
          Gửi đăng ký khám
        </button>
        <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs font-semibold text-slate-500">
          <BadgeCheck aria-hidden="true" className="h-4 w-4 text-primary-700" />
          <span>Thông tin sẽ chuyển về hệ thống lịch hẹn của bệnh viện.</span>
        </p>
      </div>

      <div className="pb-2 text-center text-xs text-slate-500">
        <Badge tone="slate">Dùng chung dữ liệu với benhvienanphu.vn</Badge>
      </div>
        </>
      ) : null}
    </form>
  );
}

function BookingStepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { id: 1, title: "Người bệnh" },
    { id: 2, title: "Lịch khám" },
    { id: 3, title: "Xác nhận" },
  ] as const;

  return (
    <nav className="rounded-md border border-cream-200 bg-cream-50 p-2 shadow-[0_8px_22px_rgba(7,60,57,0.055)]" aria-label="Các bước đăng ký khám">
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((item) => {
          const active = item.id === step;
          const done = item.id < step;
          return (
            <li key={item.id}>
              <span
                className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-2 text-center text-xs font-black ${
                  active
                    ? "bg-primary-700 text-white shadow-sm"
                    : done
                      ? "bg-primary-50 text-primary-800"
                      : "bg-white/70 text-slate-500"
                }`}
              >
                <span className="clinical-mono inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-[11px] text-primary-800">
                  {item.id}
                </span>
                <span className="leading-tight">{item.title}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function WizardActions({
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  const hasSecondary = Boolean(secondaryLabel && onSecondary);

  return (
    <div className={`sticky bottom-[72px] z-10 -mx-1 grid gap-2 rounded-md border border-primary-100 bg-cream-50/98 p-2 shadow-[0_-12px_34px_rgba(7,60,57,0.18)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none ${hasSecondary ? "sm:grid-cols-2" : ""}`}>
      {hasSecondary ? (
        <button
          type="button"
          onClick={onSecondary}
          className="flex min-h-12 w-full items-center justify-center rounded-md border border-primary-200 bg-white px-4 text-sm font-black text-primary-800 hover:bg-primary-50"
        >
          {secondaryLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onPrimary}
        className="flex min-h-12 w-full items-center justify-center rounded-md border border-primary-950 bg-[#005f56] px-4 text-sm font-black text-white shadow-[0_14px_32px_rgba(0,95,86,0.32)] ring-2 ring-primary-100 transition hover:bg-[#004c45] active:translate-y-px"
        style={{ backgroundColor: "#005f56", color: "#ffffff" }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

function CitizenQrScanner({
  open,
  onClose,
  onResult,
  onMessage,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (data: CitizenQrData) => void;
  onMessage: (message: string) => void;
}) {
  const scannerId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5QrcodeScannerInstance | null>(null);
  const [status, setStatus] = useState("Đang chuẩn bị camera...");

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function startScanner() {
      setStatus("Đang mở camera. Vui lòng cho phép trình duyệt sử dụng camera.");

      try {
        const qrModule = (await import("html5-qrcode")) as Html5QrcodeModule;
        if (cancelled) return;

        const supportedScanTypes = qrModule.Html5QrcodeScanType?.SCAN_TYPE_CAMERA
          ? [
              qrModule.Html5QrcodeScanType.SCAN_TYPE_CAMERA,
              ...(qrModule.Html5QrcodeScanType.SCAN_TYPE_FILE ? [qrModule.Html5QrcodeScanType.SCAN_TYPE_FILE] : []),
            ]
          : undefined;
        const scanner = new qrModule.Html5QrcodeScanner(
          scannerId,
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1,
            rememberLastUsedCamera: true,
            supportedScanTypes,
          },
          false,
        );

        scannerRef.current = scanner;
        scanner.render(
          (decodedText) => {
            const data = parseCitizenQr(decodedText);
            if (!data) {
              setStatus("QR chưa đúng định dạng CCCD. Vui lòng đưa rõ mã QR trên CCCD vào khung quét.");
              return;
            }

            void scannerRef.current?.clear().catch(() => undefined);
            scannerRef.current = null;
            onResult(data);
          },
          () => undefined,
        );
      } catch {
        setStatus("Không mở được camera. Vui lòng kiểm tra quyền camera, dùng HTTPS, hoặc chọn quét từ ảnh QR nếu trình duyệt hỗ trợ.");
        onMessage("Không mở được camera để quét QR CCCD. Bạn vẫn có thể nhập CCCD thủ công.");
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      void scannerRef.current?.clear().catch(() => undefined);
      scannerRef.current = null;
    };
  }, [onMessage, onResult, open, scannerId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto flex h-full max-w-lg flex-col overflow-hidden rounded-md bg-cream-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
          <div>
            <p className="font-serif text-lg font-black text-ink">Quét QR CCCD</p>
            <p className="text-xs font-semibold text-slate-500">Cho phép camera hoặc chọn ảnh QR CCCD từ máy</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-cream-200 bg-white text-slate-700"
            aria-label="Đóng quét QR"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div id={scannerId} className="overflow-hidden rounded-md border border-cream-200 bg-white" />
          <p className="mt-3 rounded-md bg-cream-100 px-3 py-2 text-sm font-semibold leading-6 text-slate-700">{status}</p>
        </div>
      </div>
    </div>
  );
}
