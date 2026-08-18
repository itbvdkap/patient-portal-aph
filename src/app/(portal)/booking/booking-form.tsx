"use client";

import { useState } from "react";
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
  Send,
  ShieldCheck,
  Search,
  UserRound,
} from "lucide-react";
import { Badge, Panel, SectionHeader } from "@/components/ui";

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
  hasInsurance?: boolean;
};

type BookingResponse = {
  message?: string;
  data?: {
    ma_lich_hen?: string;
    id?: string | number;
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

export function BookingForm({ linkedProfiles = [] }: { linkedProfiles?: BookingPatientProfile[] }) {
  const [form, setForm] = useState<BookingFormState>(initialForm);
  const [patientMode, setPatientMode] = useState<"new" | "old">(linkedProfiles.length ? "old" : "new");
  const [manualPatientCode, setManualPatientCode] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<BookingResponse | null>(null);

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
      fullName: profile.fullName,
      phone: profile.phone ?? current.phone,
      birthDate: profile.birthDate ?? current.birthDate,
      gender: profile.gender ?? current.gender,
      address: profile.address ?? current.address,
      hasInsurance: Boolean(profile.hasInsurance),
      ghichu: current.ghichu || "Tái khám",
    }));
  }

  function startNewPatient() {
    setPatientMode("new");
    setManualPatientCode("");
    setLookupMessage("");
    setForm(initialForm);
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
        body: JSON.stringify({ mabn }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; data?: BookingPatientProfile } | null;

      if (!response.ok || !body?.data) {
        setLookupMessage(body?.error ?? "Chưa tìm thấy hồ sơ bệnh nhân.");
        return;
      }

      applyOldProfile(body.data);
      setLookupMessage(`Đã lấy thông tin hồ sơ ${body.data.fullName}.`);
    } finally {
      setLookingUp(false);
    }
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
                    <span className="block font-serif text-base font-black text-ink">{profile.fullName}</span>
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
              <button
                type="button"
                onClick={lookupOldPatient}
                disabled={!manualPatientCode.trim() || lookingUp}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md bg-primary-700 px-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {lookingUp ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
                Tìm
              </button>
            </div>
            {lookupMessage ? <p className="rounded-md bg-cream-100 px-3 py-2 text-sm font-semibold text-slate-700">{lookupMessage}</p> : null}
          </div>
        ) : null}
      </Panel>

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
                    {province}
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

      <Panel>
        <SectionHeader title="Thông tin khám" meta="Chọn lịch" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass()}>Chi nhánh</span>
            <IconInput icon={Building2}>
              <select className={inputClass(true)} value={form.branch} onChange={(event) => update("branch", event.target.value)}>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
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
                    {department}
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
                  {doctor}
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
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary-800 px-4 text-base font-black text-white shadow-[0_12px_28px_rgba(0,109,101,0.22)] transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-70"
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
    </form>
  );
}
