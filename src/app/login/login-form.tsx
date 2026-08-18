"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { CheckCircle2, IdCard, KeyRound, Loader2, LockKeyhole, LogIn, Phone, RotateCcw, UserRound } from "lucide-react";

type Mode = "login" | "register" | "forgot";
type RegisterStep = "form" | "otp" | "password" | "done";
type ForgotStep = "phone" | "reset";

type ApiBody = {
  data?: {
    expiresAt?: string;
    testOtp?: string;
    hasLinkedProfile?: boolean;
  };
  error?: string;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("form");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("phone");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState("");
  const [otpNow, setOtpNow] = useState(() => Date.now());
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [registerTurnstileToken, setRegisterTurnstileToken] = useState("");
  const [forgotTurnstileToken, setForgotTurnstileToken] = useState("");

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const otpSecondsLeft = otpExpiresAt ? Math.max(0, Math.ceil((new Date(otpExpiresAt).getTime() - otpNow) / 1000)) : 0;
  const otpExpired = Boolean(otpExpiresAt && otpSecondsLeft <= 0);

  useEffect(() => {
    if ((registerStep !== "otp" && forgotStep !== "reset") || !otpExpiresAt) {
      return;
    }

    setOtpNow(Date.now());
    const interval = window.setInterval(() => setOtpNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [forgotStep, otpExpiresAt, registerStep]);

  function nextPath(hasLinkedProfile?: boolean) {
    return hasLinkedProfile ? searchParams.get("next") ?? "/dashboard" : "/profile";
  }

  function requireTurnstile(token: string) {
    if (siteKey && !token) {
      setMessage("Vui lòng xác thực chống bot trước khi gửi.");
      return false;
    }

    return true;
  }

  async function postJson(url: string, payload: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as ApiBody | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "Thao tác chưa thành công. Vui lòng thử lại.");
    }
    return body;
  }

  async function loginPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const body = await postJson("/api/auth/login-password", { phone, password, remember });
      router.replace(nextPath(body?.data?.hasLinkedProfile));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đăng nhập được.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await requestRegisterOtp(registerTurnstileToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gửi được OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestRegisterOtp(turnstileToken: string) {
    if (!requireTurnstile(turnstileToken)) {
      return;
    }

    const body = await postJson("/api/auth/start-register", {
      phone,
      fullName,
      cf_turnstile_response: turnstileToken,
    });
    setOtp("");
    setRegisterStep("otp");
    setRegisterTurnstileToken("");
    setOtpExpiresAt(body?.data?.expiresAt ?? "");
    setMessage(body?.data?.testOtp ? `Mã OTP test: ${body.data.testOtp}` : "Mã OTP đã được gửi qua Zalo.");
  }

  async function verifyRegisterOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await postJson("/api/auth/verify-register-otp", { phone, fullName, otp });
      setOtp("");
      setPassword("");
      setOtpExpiresAt("");
      router.replace("/profile");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xác minh được OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function setAccountPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await postJson("/api/auth/set-password", { password });
      setRegisterStep("done");
      setMessage("Đã tạo mật khẩu. Bạn có thể liên kết hồ sơ y tế trong trang Tài khoản.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await requestForgotOtp(forgotTurnstileToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gửi được OTP khôi phục.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestForgotOtp(turnstileToken: string) {
    if (!requireTurnstile(turnstileToken)) {
      return;
    }

    const body = await postJson("/api/auth/forgot-password", {
      phone,
      cf_turnstile_response: turnstileToken,
    });
    setOtp("");
    setForgotStep("reset");
    setForgotTurnstileToken("");
    setOtpExpiresAt(body?.data?.expiresAt ?? "");
    setMessage(body?.data?.testOtp ? `Mã OTP test: ${body.data.testOtp}` : "Mã OTP khôi phục đã được gửi qua Zalo.");
  }

  async function resendRegisterOtp() {
    setMessage("");
    setSubmitting(true);

    try {
      await requestRegisterOtp(registerTurnstileToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gửi lại được OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendForgotOtp() {
    setMessage("");
    setSubmitting(true);

    try {
      await requestForgotOtp(forgotTurnstileToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gửi lại được OTP khôi phục.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      await postJson("/api/auth/reset-password", { phone, otp, password });
      setForgotStep("phone");
      setMode("login");
      setPassword("");
      setOtp("");
      setOtpExpiresAt("");
      setMessage("Đã đổi mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đổi được mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" onLoad={() => setTurnstileReady(true)} />}

      <div className="grid grid-cols-2 gap-2 rounded-md bg-cream-100 p-1">
        <ModeButton active={mode === "login"} onClick={() => setMode("login")}>
          Đăng nhập
        </ModeButton>
        <ModeButton active={mode === "register"} onClick={() => setMode("register")}>
          Đăng ký lần đầu
        </ModeButton>
      </div>

      {mode === "login" && (
        <form onSubmit={loginPassword} className="space-y-4">
          <PhoneField phone={phone} setPhone={setPhone} />
          <PasswordField password={password} setPassword={setPassword} label="Mật khẩu" autoComplete="current-password" />
          <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-cream-300" />
            Lưu phiên đăng nhập trên thiết bị này
          </label>
          <StatusMessage message={message} />
          <PrimaryButton disabled={submitting || !phone || !password} loading={submitting} icon={LogIn}>
            Đăng nhập
          </PrimaryButton>
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setForgotStep("phone");
              setMessage("");
            }}
            className="inline-flex min-h-10 w-full items-center justify-center text-sm font-bold text-primary-800"
          >
            Quên mật khẩu?
          </button>
        </form>
      )}

      {mode === "register" && registerStep === "form" && (
        <form onSubmit={startRegister} className="space-y-4">
          <TextField icon={UserRound} label="Họ tên" value={fullName} setValue={setFullName} placeholder="Nhập họ tên" autoComplete="name" />
          <PhoneField phone={phone} setPhone={setPhone} />
          <TurnstileBox siteKey={siteKey} ready={turnstileReady} onToken={setRegisterTurnstileToken} />
          <StatusMessage message={message} />
          <PrimaryButton disabled={submitting || !phone || fullName.trim().length < 2 || Boolean(siteKey && !registerTurnstileToken)} loading={submitting} icon={Phone}>
            Gửi OTP Zalo
          </PrimaryButton>
        </form>
      )}

      {mode === "register" && registerStep === "otp" && (
        <form onSubmit={verifyRegisterOtp} className="space-y-4">
          <Notice>
            Nhập mã OTP đã gửi tới số điện thoại <span className="clinical-mono">{phone}</span>.
          </Notice>
          <OtpCountdown secondsLeft={otpSecondsLeft} />
          <OtpField otp={otp} setOtp={setOtp} />
          {(otpSecondsLeft <= 240 || otpExpired) && <TurnstileBox siteKey={siteKey} ready={turnstileReady} onToken={setRegisterTurnstileToken} />}
          <StatusMessage message={message} />
          <PrimaryButton disabled={submitting || otp.length < 6 || otpExpired} loading={submitting} icon={KeyRound}>
            Xác minh OTP
          </PrimaryButton>
          <ResendOtpButton
            disabled={submitting || otpSecondsLeft > 240 || Boolean(siteKey && !registerTurnstileToken)}
            onClick={resendRegisterOtp}
          />
          <BackButton onClick={() => setRegisterStep("form")} />
        </form>
      )}

      {mode === "register" && registerStep === "password" && (
        <form onSubmit={setAccountPassword} className="space-y-4">
          <Notice>Tạo mật khẩu cho lần đăng nhập sau. Số điện thoại đã được xác minh, không cần OTP mỗi lần đăng nhập.</Notice>
          <PasswordField password={password} setPassword={setPassword} label="Tạo mật khẩu" autoComplete="new-password" />
          <StatusMessage message={message} />
          <PrimaryButton disabled={submitting || password.length < 6} loading={submitting} icon={LockKeyhole}>
            Lưu mật khẩu
          </PrimaryButton>
        </form>
      )}

      {mode === "register" && registerStep === "done" && (
        <div className="space-y-4">
          <SuccessBox title="Tài khoản đã sẵn sàng" text="Bạn có thể liên kết hồ sơ y tế của bản thân hoặc người thân trong trang Tài khoản." />
          <button
            type="button"
            onClick={() => router.replace("/profile")}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary-800 px-4 font-black text-white"
          >
            Đi tới Tài khoản
          </button>
        </div>
      )}

      {mode === "forgot" && forgotStep === "phone" && (
        <form onSubmit={startForgotPassword} className="space-y-4">
          <Notice>Nhập số điện thoại tài khoản để nhận OTP khôi phục mật khẩu.</Notice>
          <PhoneField phone={phone} setPhone={setPhone} />
          <TurnstileBox siteKey={siteKey} ready={turnstileReady} onToken={setForgotTurnstileToken} />
          <StatusMessage message={message} />
          <PrimaryButton disabled={submitting || !phone || Boolean(siteKey && !forgotTurnstileToken)} loading={submitting} icon={Phone}>
            Gửi OTP khôi phục
          </PrimaryButton>
          <BackButton onClick={() => setMode("login")} />
        </form>
      )}

      {mode === "forgot" && forgotStep === "reset" && (
        <form onSubmit={resetPassword} className="space-y-4">
          <OtpCountdown secondsLeft={otpSecondsLeft} />
          <OtpField otp={otp} setOtp={setOtp} />
          <PasswordField password={password} setPassword={setPassword} label="Mật khẩu mới" autoComplete="new-password" />
          {(otpSecondsLeft <= 240 || otpExpired) && <TurnstileBox siteKey={siteKey} ready={turnstileReady} onToken={setForgotTurnstileToken} />}
          <StatusMessage message={message} />
          <PrimaryButton disabled={submitting || otp.length < 6 || password.length < 6 || otpExpired} loading={submitting} icon={LockKeyhole}>
            Đổi mật khẩu
          </PrimaryButton>
          <ResendOtpButton
            disabled={submitting || otpSecondsLeft > 240 || Boolean(siteKey && !forgotTurnstileToken)}
            onClick={resendForgotOtp}
          />
          <BackButton onClick={() => setForgotStep("phone")} />
        </form>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-md px-3 text-sm font-black transition ${
        active ? "bg-primary-800 text-white shadow-sm" : "text-slate-600 hover:bg-white/70"
      }`}
    >
      {children}
    </button>
  );
}

function TextField({
  icon: Icon,
  label,
  value,
  setValue,
  placeholder,
  autoComplete,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
        <Icon aria-hidden="true" className="h-5 w-5 text-primary-700" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
      </div>
    </label>
  );
}

function PhoneField({ phone, setPhone }: { phone: string; setPhone: (value: string) => void }) {
  return <TextField icon={Phone} label="Số điện thoại" value={phone} setValue={setPhone} placeholder="Ví dụ: 0911071001" autoComplete="tel" />;
}

function PasswordField({
  password,
  setPassword,
  label,
  autoComplete,
}: {
  password: string;
  setPassword: (value: string) => void;
  label: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
        <LockKeyhole aria-hidden="true" className="h-5 w-5 text-primary-700" />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
          placeholder="Nhập mật khẩu"
          autoComplete={autoComplete}
          required
          minLength={6}
        />
      </div>
    </label>
  );
}

function OtpField({ otp, setOtp }: { otp: string; setOtp: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">Mã OTP</span>
      <div className="mt-2 flex h-12 items-center gap-2 rounded-md border border-cream-200 bg-white/80 px-3 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-100">
        <KeyRound aria-hidden="true" className="h-5 w-5 text-primary-700" />
        <input
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
          className="clinical-mono h-full min-w-0 flex-1 bg-transparent text-center text-lg font-black tracking-[0.25em] outline-none"
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          minLength={6}
          maxLength={8}
        />
      </div>
    </label>
  );
}

function OtpCountdown({ secondsLeft }: { secondsLeft: number }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const text = secondsLeft > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : "Đã hết hạn";

  return (
    <div className="rounded-md border border-cream-200 bg-cream-50 px-3 py-2 text-center text-sm font-bold text-slate-700">
      Mã OTP còn hiệu lực <span className="clinical-mono text-primary-800">{text}</span>
    </div>
  );
}

function ResendOtpButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary-200 bg-white/80 px-4 font-bold text-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Gửi lại OTP
    </button>
  );
}

function TurnstileBox({ siteKey, ready, onToken }: { siteKey?: string; ready: boolean; onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteKey || !ready || !containerRef.current || !window.turnstile) {
      return;
    }

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });

    return () => {
      onToken("");
      window.turnstile?.remove(widgetId);
    };
  }, [onToken, ready, siteKey]);

  if (!siteKey) return null;
  return (
    <div className="flex min-h-[70px] justify-center">
      <div ref={containerRef} />
    </div>
  );
}

function StatusMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="status" className="rounded-md bg-cream-100 px-3 py-2 text-sm font-medium leading-6 text-slate-700">
      {message}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-primary-100 bg-primary-50/70 px-3 py-2 text-sm font-semibold leading-6 text-primary-900">{children}</div>;
}

function SuccessBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-primary-100 bg-primary-50 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 text-primary-700" />
        <div>
          <h3 className="font-serif text-lg font-bold text-ink">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({
  disabled,
  loading,
  icon: Icon,
  children,
}: {
  disabled: boolean;
  loading: boolean;
  icon: typeof IdCard;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 font-bold text-white hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Icon aria-hidden="true" className="h-5 w-5" />}
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-cream-200 bg-white/70 px-4 font-bold text-primary-800"
    >
      <RotateCcw aria-hidden="true" className="h-4 w-4" />
      Quay lại
    </button>
  );
}
