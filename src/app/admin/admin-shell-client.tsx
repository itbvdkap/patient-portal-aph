"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpenText,
  CalendarCheck,
  DatabaseZap,
  FileText,
  KeyRound,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminNavIcon = "activity" | "user" | "users" | "calendar" | "database" | "key" | "book" | "settings" | "file";

export interface AdminShellNavItem {
  label: string;
  href: string;
  icon: AdminNavIcon;
}

const icons: Record<AdminNavIcon, LucideIcon> = {
  activity: Activity,
  user: UserRound,
  users: UsersRound,
  calendar: CalendarCheck,
  database: DatabaseZap,
  key: KeyRound,
  book: BookOpenText,
  settings: Settings,
  file: FileText,
};

const storageKey = "aph-admin-sidebar-collapsed";

export function AdminShellClient({
  children,
  nav,
  username,
  roleLabel,
}: {
  children: React.ReactNode;
  nav: AdminShellNavItem[];
  username: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(storageKey) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f1e6] text-ink">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-cream-200 bg-cream-50/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-cream-200 bg-white px-3 py-2 text-sm font-black text-primary-800 shadow-sm"
        >
          <Menu aria-hidden="true" className="h-4 w-4" />
          Menu
        </button>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">An Phú Care</p>
          <p className="font-serif text-lg font-black text-ink">Portal Admin</p>
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Đóng menu quản trị"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className={collapsed ? "grid min-h-screen lg:grid-cols-[76px_minmax(0,1fr)]" : "grid min-h-screen lg:grid-cols-[clamp(232px,22vw,280px)_minmax(0,1fr)]"}>
        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 flex w-[min(84vw,310px)] flex-col border-r border-cream-200 bg-primary-900 px-4 py-4 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
            collapsed ? "lg:px-3" : "",
          ].join(" ")}
        >
          <div className={collapsed ? "flex items-center justify-center" : "flex items-start justify-between gap-3"}>
            <div className={collapsed ? "hidden" : "min-w-0 rounded-md bg-white/10 p-4"}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-100">An Phú Care</p>
              <h1 className="mt-1 font-serif text-2xl font-black">Portal Admin</h1>
              <p className="mt-2 text-sm leading-6 text-primary-50/80">Quản trị vận hành cổng bệnh nhân.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/15 lg:inline-flex"
                title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
                aria-label={collapsed ? "Mở rộng menu quản trị" : "Thu gọn menu quản trị"}
              >
                {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-5 w-5" /> : <PanelLeftClose aria-hidden="true" className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/15 lg:hidden"
                aria-label="Đóng menu quản trị"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>

          {collapsed && (
            <div className="hidden h-12 w-12 items-center justify-center rounded-md bg-white/10 font-serif text-xl font-black lg:flex" title="Portal Admin">
              AP
            </div>
          )}

          <nav className="mt-5 grid gap-1 overflow-y-auto pr-1">
            {nav.map((item) => {
              const Icon = icons[item.icon];
              const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "flex items-center rounded-md text-sm font-bold transition hover:bg-white/10 hover:text-white",
                    collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5",
                    active ? "bg-white text-primary-900 shadow-sm hover:bg-white hover:text-primary-900" : "text-primary-50/85",
                  ].join(" ")}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-5">
            <div className={collapsed ? "hidden" : "rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold leading-5 text-primary-50/80"}>
              Đăng nhập: <span className="text-white">{username}</span>
              <br />
              Vai trò: <span className="text-white">{roleLabel}</span>
            </div>

            <form action="/api/admin/logout" method="post" className="mt-3">
              <button
                title={collapsed ? "Đăng xuất" : undefined}
                className={[
                  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/15",
                  collapsed ? "h-11 px-0" : "",
                ].join(" ")}
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                <span className={collapsed ? "sr-only" : ""}>Đăng xuất</span>
              </button>
            </form>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-[clamp(20px,3vw,40px)]">{children}</section>
      </div>
    </main>
  );
}
