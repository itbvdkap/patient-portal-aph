"use client";

import { useEffect, useState } from "react";
import { Bell, Camera, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

type PreferenceKey = "appointments" | "results" | "insurance";

const storageKey = "anphu-notification-preferences";
const defaults: Record<PreferenceKey, boolean> = {
  appointments: true,
  results: true,
  insurance: true,
};

const options: Array<{ key: PreferenceKey; title: string; description: string }> = [
  {
    key: "appointments",
    title: "Nhắc lịch hẹn",
    description: "Thông báo trước ngày khám hoặc khi có thay đổi lịch.",
  },
  {
    key: "results",
    title: "Kết quả mới",
    description: "Nhắc khi có kết quả xét nghiệm hoặc CĐHA mới được đồng bộ.",
  },
  {
    key: "insurance",
    title: "BHYT sắp hết hạn",
    description: "Cảnh báo trước khi thẻ BHYT gần hết hiệu lực.",
  },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [cameraStatus, setCameraStatus] = useState<"unknown" | "granted" | "denied" | "unsupported">("unknown");
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");

    if (!stored) {
      return;
    }

    try {
      setPreferences({ ...defaults, ...(JSON.parse(stored) as Partial<typeof defaults>) });
    } catch {
      setPreferences(defaults);
    }
  }, []);

  async function requestNotifications() {
    setMessage("");

    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setMessage("Thiết bị này chưa hỗ trợ thông báo từ trình duyệt.");
      return;
    }

    if (!window.isSecureContext) {
      setMessage("Trình duyệt chỉ hiện yêu cầu thông báo khi dùng HTTPS hoặc localhost.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setMessage(permission === "granted" ? "Đã cho phép app gửi thông báo trên thiết bị này." : "Thiết bị chưa cho phép nhận thông báo.");
  }

  async function requestCamera() {
    setMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unsupported");
      setMessage("Thiết bị này chưa hỗ trợ mở camera từ trình duyệt.");
      return;
    }

    if (!window.isSecureContext) {
      setCameraStatus("denied");
      setMessage("Trình duyệt chỉ cho xin quyền camera khi dùng HTTPS hoặc localhost.");
      return;
    }

    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraStatus("granted");
      setMessage("Đã cho phép app sử dụng camera trên thiết bị này.");
    } catch {
      setCameraStatus("denied");
      setMessage("Thiết bị chưa cho phép sử dụng camera. Bạn có thể mở cài đặt trình duyệt để cấp lại quyền.");
    } finally {
      setRequestingCamera(false);
    }
  }

  function toggle(key: PreferenceKey) {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <PermissionButton
          icon={Bell}
          title="Cho phép thông báo"
          status={permissionLabel(notificationPermission)}
          onClick={requestNotifications}
          disabled={notificationPermission === "granted"}
        />
        <PermissionButton
          icon={Camera}
          title="Cho phép camera"
          status={cameraLabel(cameraStatus)}
          onClick={requestCamera}
          disabled={requestingCamera || cameraStatus === "granted"}
          loading={requestingCamera}
        />
      </div>
      {message ? (
        <p className="flex gap-2 rounded-md bg-primary-50 px-3 py-2 text-xs font-semibold leading-5 text-primary-900">
          {message.startsWith("Đã") ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
          ) : (
            <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          )}
          <span>{message}</span>
        </p>
      ) : null}
      <p className="text-sm font-semibold leading-6 text-slate-600">Chọn loại thông báo muốn nhận trên thiết bị này.</p>
      <div className="space-y-2">
        {options.map((option) => {
          const enabled = preferences[option.key];

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggle(option.key)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-cream-200 bg-white/75 p-3 text-left transition hover:border-primary-200 hover:bg-primary-50"
              aria-pressed={enabled}
            >
              <span className="min-w-0">
                <span className="block text-sm font-black text-ink">{option.title}</span>
                <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500">{option.description}</span>
              </span>
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-primary-700" : "bg-slate-200"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PermissionButton({
  icon: Icon,
  title,
  status,
  onClick,
  disabled,
  loading = false,
}: {
  icon: typeof Bell;
  title: string;
  status: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-20 w-full items-center gap-3 rounded-md border border-cream-200 bg-white/75 p-3 text-left transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-default disabled:opacity-80"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
        {loading ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Icon aria-hidden="true" className="h-5 w-5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-ink">{title}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500">{status}</span>
      </span>
    </button>
  );
}

function permissionLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") return "Đã cho phép";
  if (permission === "denied") return "Đang bị chặn";
  if (permission === "unsupported") return "Không hỗ trợ";
  return "Chưa xin quyền";
}

function cameraLabel(status: "unknown" | "granted" | "denied" | "unsupported") {
  if (status === "granted") return "Đã cho phép";
  if (status === "denied") return "Đang bị chặn";
  if (status === "unsupported") return "Không hỗ trợ";
  return "Chưa xin quyền";
}
