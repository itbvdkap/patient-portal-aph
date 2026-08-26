"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardList,
  Clock3,
  FileClock,
  HeartPulse,
  Hospital,
  Loader2,
  Home,
  LogOut,
  MessageCircle,
  PhoneCall,
  Pill,
  Activity,
  ScanSearch,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { DemoBanner } from "@/components/demo-banner";
import { InstallAppButton } from "@/components/install-app-button";
import { AccessibilityTextToggle } from "@/components/accessibility-text-toggle";
import { hospitalHotlines, hospitalZaloUrl } from "@/lib/content/hospital-info";
import type { PatientSessionProfile } from "@/lib/auth/session";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: typeof Home;
  badgeCount?: number;
};

const primaryItems: NavItem[] = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/today-visit", label: "Khám hôm nay", shortLabel: "Hôm nay", icon: Clock3 },
  { href: "/registrations", label: "Lịch sử đăng ký", shortLabel: "Đăng ký", icon: FileClock },
  { href: "/visits", label: "Lịch sử khám", shortLabel: "Lịch sử", icon: ClipboardList },
  { href: "/lab-results", label: "Xét nghiệm", icon: HeartPulse },
  { href: "/imaging", label: "Chẩn đoán hình ảnh", shortLabel: "CĐHA", icon: ScanSearch },
];

const moreItems: NavItem[] = [
  { href: "/health-tracking", label: "Theo dõi sức khỏe", shortLabel: "Sức khỏe", icon: Activity },
  { href: "/hospital-info", label: "Thông tin bệnh viện", shortLabel: "Bệnh viện", icon: Hospital },
  { href: "/health-guide", label: "Cẩm nang sức khỏe", shortLabel: "Cẩm nang", icon: BookOpenText },
  { href: "/prescriptions", label: "Đơn thuốc", shortLabel: "Thuốc", icon: Pill },
  { href: "/insurance", label: "BHYT", icon: ShieldCheck },
  { href: "/appointments", label: "Lịch hẹn", icon: CalendarDays },
  { href: "/profile", label: "Tài khoản", icon: UserRound },
];

export function AppShell({
  children,
  profiles = [],
  currentMabn = "",
  upcomingAppointmentsCount = 0,
  pendingRegistrationsCount = 0,
  activeTodayVisitCount = 0,
}: {
  children: React.ReactNode;
  profiles?: PatientSessionProfile[];
  currentMabn?: string;
  upcomingAppointmentsCount?: number;
  pendingRegistrationsCount?: number;
  activeTodayVisitCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const decoratedPrimaryItems = primaryItems.map((item) => {
    if (item.href === "/today-visit") {
      return { ...item, badgeCount: activeTodayVisitCount };
    }

    if (item.href === "/registrations") {
      return { ...item, badgeCount: pendingRegistrationsCount };
    }

    return item;
  });
  const decoratedMoreItems = moreItems.map((item) => (item.href === "/appointments" ? { ...item, badgeCount: upcomingAppointmentsCount } : item));
  const allItems = [...decoratedPrimaryItems, ...decoratedMoreItems];
  const accountItem = decoratedMoreItems.find((item) => item.href === "/profile") ?? moreItems[moreItems.length - 1];
  const showBackButton = pathname !== "/dashboard";
  const showHeaderUtilities = pathname === "/dashboard";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-[1440px]">
        <aside className="hidden w-64 shrink-0 border-r border-cream-200 bg-cream-50/95 px-3 py-5 shadow-[0_8px_22px_rgba(7,60,57,0.055)] lg:block">
          <Brand />
          <div className="mt-4">
            <AccessibilityTextToggle />
          </div>
          <InstallAppButton className="mt-5 w-full" />
          <ProfileQuickSwitch profiles={profiles} currentMabn={currentMabn} variant="sidebar" />
          <nav className="mt-6 space-y-1" aria-label="Điều hướng chính">
            {allItems.map((item) => (
              <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="mt-6 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
            Đăng xuất
          </button>
        </aside>

        <main className="w-full min-w-0 px-3 pb-24 pt-3 sm:px-5 lg:px-7 lg:pb-8 lg:pt-5">
          <div className="mb-3 flex min-h-14 items-center justify-between gap-2 rounded-md border border-cream-200 bg-cream-50 px-2.5 py-2 shadow-[0_8px_22px_rgba(7,60,57,0.055)] sm:px-3 lg:hidden">
            <div className="flex min-w-0 shrink-0 items-center gap-1.5">
              {showBackButton && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-primary-700 hover:bg-primary-50"
                  aria-label="Quay lại"
                  title="Quay lại"
                >
                  <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
              <Brand compact />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
              {showHeaderUtilities && (
                <span className="hidden min-[430px]:inline-flex">
                  <AccessibilityTextToggle compact />
                </span>
              )}
              {showHeaderUtilities && <InstallAppButton compact className="hidden min-[500px]:inline-flex" />}
              <ProfileQuickSwitch profiles={profiles} currentMabn={currentMabn} variant="header" />
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50"
                aria-label="Đăng xuất"
              >
                <LogOut aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
          {children}
        </main>
      </div>

      <FloatingSupportActions />

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-cream-200 bg-cream-50/95 backdrop-blur lg:hidden" aria-label="Điều hướng dưới">
        <div className="grid grid-cols-5">
          <BottomLink item={decoratedPrimaryItems[0]} label="Trang chủ" active={pathname.startsWith("/dashboard")} />
          <BottomLink item={decoratedPrimaryItems[1]} label="Hôm nay" active={pathname.startsWith("/today-visit")} />
          <BottomLink item={decoratedPrimaryItems[2]} label="Đăng ký" active={pathname.startsWith("/registrations")} />
          <BottomLink
            item={{ href: "/health-tracking", label: "Hồ sơ y tế", shortLabel: "Hồ sơ", icon: Activity }}
            label="Hồ sơ"
            active={["/health-tracking", "/visits", "/lab-results", "/imaging", "/prescriptions", "/insurance"].some((prefix) => pathname.startsWith(prefix))}
          />
          <BottomLink item={accountItem} label="Tài khoản" active={pathname.startsWith("/profile")} />
        </div>
      </nav>
    </div>
  );
}

function ProfileQuickSwitch({
  profiles,
  currentMabn,
  variant,
}: {
  profiles: PatientSessionProfile[];
  currentMabn: string;
  variant: "header" | "sidebar";
}) {
  const [open, setOpen] = useState(false);
  const [loadingMabn, setLoadingMabn] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const currentProfile = profiles.find((profile) => profile.mabn === currentMabn) ?? profiles[0];

  if (!profiles.length || !currentProfile) return null;

  async function selectProfile(mabn: string) {
    if (mabn === currentMabn) {
      setOpen(false);
      return;
    }

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
        setMessage(body?.error ?? "Không đổi được hồ sơ.");
        return;
      }

      setOpen(false);
      window.location.assign("/dashboard");
    } finally {
      setLoadingMabn(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "sidebar"
            ? "mt-4 flex w-full items-center justify-between gap-2 rounded-md border border-primary-100 bg-primary-50/80 px-3 py-2.5 text-left text-primary-900 shadow-sm hover:border-primary-200"
            : "inline-flex h-10 min-w-0 max-w-[11rem] flex-1 items-center gap-1.5 rounded-md border border-primary-100 bg-primary-50 px-2 text-primary-800 shadow-sm hover:border-primary-200 sm:max-w-[14rem] sm:flex-none"
        }
        aria-label="Đổi hồ sơ y tế đang xem"
        aria-expanded={open}
        title="Đổi hồ sơ y tế"
      >
        <span className="min-w-0">
          <span className={variant === "sidebar" ? "block text-xs font-bold uppercase text-primary-700" : "sr-only"}>Hồ sơ đang xem</span>
          <span className="block truncate text-xs font-black sm:text-sm">{currentProfile.fullName || "Hồ sơ"}</span>
          <span className="clinical-mono block truncate text-xs font-bold text-slate-600">BN {currentProfile.mabn}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 backdrop-blur-[2px] lg:items-center lg:justify-center"
          onClick={() => setOpen(false)}
        >
          <section
            className="mx-auto max-h-[82vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-cream-200 bg-cream-50 shadow-[0_24px_60px_rgba(7,60,57,0.24)] lg:rounded-2xl"
            aria-label="Đổi hồ sơ y tế đang xem"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
              <div>
                <h2 className="font-serif text-lg font-black text-ink">Đổi hồ sơ y tế</h2>
                <p className="clinical-mono mt-0.5 text-xs font-semibold text-slate-500">{profiles.length} hồ sơ đã liên kết</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-cream-100 hover:text-ink"
                aria-label="Đóng đổi hồ sơ"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[65vh] gap-3 overflow-auto p-4">
              {profiles.map((profile) => {
                const active = profile.mabn === currentMabn;
                return (
                  <button
                    key={profile.mabn}
                    type="button"
                    onClick={() => selectProfile(profile.mabn)}
                    disabled={loadingMabn !== null}
                    className={`flex min-h-20 items-center justify-between gap-3 rounded-md border p-3 text-left transition disabled:cursor-wait ${
                      active ? "border-primary-200 bg-primary-50/80" : "border-cream-200 bg-white/80 hover:border-primary-200 hover:bg-primary-50/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-lg font-black leading-6 text-ink">{profile.fullName || `Mã BN ${profile.mabn}`}</span>
                      <span className="clinical-mono mt-1 block text-sm font-bold text-slate-600">Mã BN: {profile.mabn}</span>
                      {profile.relationship ? <span className="mt-1 block text-sm font-semibold text-slate-500">{profile.relationship}</span> : null}
                    </span>
                    <span className="inline-flex min-w-20 shrink-0 items-center justify-center gap-1 rounded-md bg-white px-3 py-2 text-sm font-black text-primary-700 ring-1 ring-primary-100">
                      {loadingMabn === profile.mabn ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : active ? (
                        <>
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                          Đang xem
                        </>
                      ) : (
                        "Chọn"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {message ? <p className="mx-4 mb-4 rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">{message}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandLogo size={compact ? 34 : 44} />
      <div className={`min-w-0 ${compact ? "hidden min-[520px]:block" : ""}`}>
        <p className="truncate text-sm font-bold text-ink">Bệnh viện Đa khoa An Phú</p>
        {!compact && <p className="mt-0.5 text-xs font-semibold uppercase text-primary-700">Cổng thông tin bệnh nhân</p>}
      </div>
    </div>
  );
}

function FloatingSupportActions() {
  const [hotlineOpen, setHotlineOpen] = useState(false);
  const [compactFab, setCompactFab] = useState(false);

  useEffect(() => {
    let previousY = window.scrollY;

    function onScroll() {
      const currentY = window.scrollY;
      setCompactFab(currentY > 140 && currentY > previousY);
      previousY = currentY;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-3 z-30 transition duration-200 lg:bottom-5 lg:right-5 ${compactFab ? "translate-x-2 opacity-55" : "opacity-100"}`}>
        <button
          type="button"
          onClick={() => setHotlineOpen(true)}
          className={`flex items-center justify-center gap-2 rounded-full bg-primary-700 text-white shadow-[0_12px_28px_rgba(0,91,85,0.35)] ring-1 ring-white/70 transition hover:scale-105 hover:bg-primary-800 lg:px-4 ${
            compactFab ? "h-10 min-h-10 w-10 px-0 lg:h-11 lg:w-11" : "h-11 min-h-11 w-11 px-0 lg:h-12 lg:w-auto"
          }`}
          aria-label="Mở hỗ trợ"
          title="Mở hỗ trợ"
          aria-expanded={hotlineOpen}
        >
          <MessageCircle aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only text-sm font-black lg:not-sr-only">Hỗ trợ</span>
        </button>
      </div>

      {hotlineOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 backdrop-blur-[2px] lg:items-end lg:justify-end lg:p-5"
          onClick={() => setHotlineOpen(false)}
        >
          <section
            className="w-full rounded-t-2xl border border-cream-200 bg-cream-50 p-4 shadow-[0_24px_60px_rgba(7,60,57,0.24)] lg:max-w-sm lg:rounded-2xl"
            aria-label="Danh sách hotline"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-ink">HOTLINE</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Chọn số cần gọi</p>
              </div>
              <button
                type="button"
                onClick={() => setHotlineOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-cream-100 hover:text-ink"
                aria-label="Đóng danh sách hotline"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href={hospitalZaloUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-16 flex-col justify-center rounded-md border border-sky-100 bg-sky-50 px-3 text-center text-sky-700 transition hover:bg-sky-100"
              >
                <span className="clinical-mono text-base font-black">Za</span>
                <span className="mt-1 text-xs font-bold">Chat Zalo</span>
              </a>
              <a
                href={hospitalZaloUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-16 flex-col justify-center rounded-md border border-primary-100 bg-primary-50 px-3 text-center text-primary-700 transition hover:bg-primary-100"
              >
                <MessageCircle aria-hidden="true" className="mx-auto h-5 w-5" />
                <span className="mt-1 text-xs font-bold">Hỗ trợ trực tuyến</span>
              </a>
              {hospitalHotlines.map((item) => (
                <a
                  key={`${item.label}-${item.number}`}
                  href={`tel:${item.number}`}
                  className={`flex min-h-16 flex-col justify-center rounded-md border px-3 text-center transition active:scale-[0.98] ${
                    item.urgent
                      ? "col-span-2 border-rose-200 bg-rose-50 text-left text-rose-700 hover:bg-rose-100"
                      : "border-cream-200 bg-white/70 text-ink hover:border-primary-200 hover:bg-primary-50"
                  }`}
                >
                  <span className={`inline-flex items-center justify-center gap-1 text-xs font-bold ${item.urgent ? "uppercase text-rose-600" : "text-slate-500"}`}>
                    <PhoneCall aria-hidden="true" className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  <span className="clinical-mono mt-1 text-base font-black">{item.display}</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold ${
        active ? "bg-primary-50 text-primary-700 shadow-[inset_3px_0_0_#005b55]" : "text-slate-600 hover:bg-cream-100 hover:text-ink"
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badgeCount ? <CountBadge count={item.badgeCount} /> : null}
    </Link>
  );
}

function BottomLink({ item, label, active }: { item: NavItem; label?: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 text-center text-[11px] font-semibold ${active ? "bg-primary-50 text-primary-700" : "text-slate-600"}`}
    >
      <span className="relative">
        <Icon aria-hidden="true" className="h-5 w-5" />
        {item.badgeCount ? <CountBadge count={item.badgeCount} className="absolute -right-3 -top-3" /> : null}
      </span>
      <span className="max-w-full px-0.5 leading-tight">{label ?? item.shortLabel ?? item.label}</span>
    </Link>
  );
}

function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  return (
    <span className={`clinical-mono inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-black leading-none text-white shadow-sm ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
