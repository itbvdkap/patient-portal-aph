"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileClock,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  PhoneCall,
  Pill,
  ScanSearch,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { DemoBanner } from "@/components/demo-banner";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: typeof Home;
  badgeCount?: number;
};

const hotlineLabel = "0911.071.001";
const zaloUrl = "https://zalo.me/1548432229030950164";
const hotlines = [
  { label: "Hotline chính", number: "0911071001", display: "0911 071 001" },
  { label: "CSKH - Mr. Tiến", number: "0917665115", display: "0917 665 115" },
  { label: "CSKH - Ms. Trinh", number: "0949850115", display: "0949 850 115" },
  { label: "CSKH - Ms. Bé", number: "0972641115", display: "0972 641 115" },
  { label: "Cấp cứu 24/7", number: "0917665115", display: "0917 665 115", urgent: true },
];

const primaryItems: NavItem[] = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/today-visit", label: "Khám hôm nay", shortLabel: "Hôm nay", icon: Clock3 },
  { href: "/registrations", label: "Lịch sử đăng ký", shortLabel: "Đăng ký", icon: FileClock },
  { href: "/visits", label: "Lịch sử khám", shortLabel: "Lịch sử", icon: ClipboardList },
  { href: "/lab-results", label: "Xét nghiệm", icon: HeartPulse },
  { href: "/imaging", label: "Chẩn đoán hình ảnh", shortLabel: "CĐHA", icon: ScanSearch },
];

const moreItems: NavItem[] = [
  { href: "/prescriptions", label: "Đơn thuốc", shortLabel: "Thuốc", icon: Pill },
  { href: "/insurance", label: "BHYT", icon: ShieldCheck },
  { href: "/appointments", label: "Lịch hẹn", icon: CalendarDays },
  { href: "/profile", label: "Tài khoản", icon: UserRound },
];

export function AppShell({
  children,
  upcomingAppointmentsCount = 0,
  pendingRegistrationsCount = 0,
  activeTodayVisitCount = 0,
}: {
  children: React.ReactNode;
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
  const moreBadgeCount = upcomingAppointmentsCount + pendingRegistrationsCount;
  const isMoreActive = [...decoratedMoreItems, decoratedPrimaryItems[2]].some((item) => pathname.startsWith(item.href));
  const showBackButton = pathname !== "/dashboard";

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
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-cream-200 bg-cream-50 px-3 py-3 shadow-[0_8px_22px_rgba(7,60,57,0.055)] lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              {showBackButton && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-primary-700 hover:bg-primary-50"
                  aria-label="Quay lại"
                  title="Quay lại"
                >
                  <ArrowLeft aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
              <Brand compact />
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50"
              aria-label="Đăng xuất"
            >
              <LogOut aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          {children}
        </main>
      </div>

      <FloatingSupportActions />

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-cream-200 bg-cream-50/95 backdrop-blur lg:hidden" aria-label="Điều hướng dưới">
        <div className="grid grid-cols-6">
          <BottomLink item={decoratedPrimaryItems[0]} label="Trang chủ" active={pathname.startsWith("/dashboard")} />
          <BottomLink item={decoratedPrimaryItems[1]} label="Hôm nay" active={pathname.startsWith("/today-visit")} />
          <BottomLink item={decoratedPrimaryItems[3]} label="Lịch sử" active={pathname.startsWith("/visits")} />
          <BottomLink item={decoratedPrimaryItems[4]} label="Xét nghiệm" active={pathname.startsWith("/lab-results")} />
          <BottomLink item={decoratedPrimaryItems[5]} label="CĐHA" active={pathname.startsWith("/imaging")} />
          <Link
            href="/insurance"
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${isMoreActive ? "bg-primary-50 text-primary-700" : "text-slate-600"}`}
            aria-label="Thêm"
          >
            <span className="relative">
              <Menu aria-hidden="true" className="h-5 w-5" />
              {moreBadgeCount > 0 && <CountBadge count={moreBadgeCount} className="absolute -right-3 -top-3" />}
            </span>
            <span className="max-w-full px-0.5 leading-tight">Thêm</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="clinical-mono flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-700 text-base font-black text-white">AP</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">Bệnh viện Đa khoa An Phú</p>
        {!compact && <p className="mt-0.5 text-xs font-semibold uppercase text-primary-700">Cổng thông tin bệnh nhân</p>}
      </div>
    </div>
  );
}

function FloatingSupportActions() {
  const [hotlineOpen, setHotlineOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-3 z-30 flex flex-col gap-2 lg:bottom-5 lg:right-5">
        <a
          href={zaloUrl}
          target="_blank"
          rel="noreferrer"
          className="clinical-mono flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-sm font-black text-white shadow-[0_12px_24px_rgba(14,165,233,0.35)] ring-1 ring-white/60 transition hover:scale-105"
          aria-label="Chat Zalo"
          title="Chat Zalo"
        >
          Za
        </a>
        <button
          type="button"
          onClick={() => setHotlineOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,0.35)] ring-1 ring-white/60 transition hover:scale-105"
          aria-label={`Chọn hotline để gọi, mặc định ${hotlineLabel}`}
          title="Chọn hotline để gọi"
          aria-expanded={hotlineOpen}
        >
          <PhoneCall aria-hidden="true" className="h-5 w-5" />
        </button>
        <a
          href={zaloUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-700 text-white shadow-[0_12px_24px_rgba(0,91,85,0.35)] ring-1 ring-white/60 transition hover:scale-105"
          aria-label="Hỗ trợ trực tuyến"
          title="Hỗ trợ trực tuyến"
        >
          <MessageCircle aria-hidden="true" className="h-5 w-5" />
        </a>
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
              {hotlines.map((item) => (
                <a
                  key={`${item.label}-${item.number}`}
                  href={`tel:${item.number}`}
                  className={`flex min-h-16 flex-col justify-center rounded-md border px-3 text-center transition active:scale-[0.98] ${
                    item.urgent
                      ? "col-span-2 border-rose-200 bg-rose-50 text-left text-rose-700 hover:bg-rose-100"
                      : "border-cream-200 bg-white/70 text-ink hover:border-primary-200 hover:bg-primary-50"
                  }`}
                >
                  <span className={`text-xs font-bold ${item.urgent ? "uppercase text-rose-600" : "text-slate-500"}`}>{item.label}</span>
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
