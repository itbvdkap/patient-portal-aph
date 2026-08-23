import Link from "next/link";
import {
  Activity,
  BookOpenText,
  CalendarCheck,
  DatabaseZap,
  FileText,
  KeyRound,
  LogOut,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { adminRoleLabel, canAdminAccessPath, type AdminRole } from "@/lib/admin/session";

const nav: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Tổng quan", href: "/admin", icon: Activity },
  { label: "Tài khoản", href: "/admin/accounts", icon: UserRound },
  { label: "Hồ sơ liên kết", href: "/admin/profiles", icon: UsersRound },
  { label: "Đăng ký khám", href: "/admin/bookings", icon: CalendarCheck },
  { label: "Sync HIS", href: "/admin/sync", icon: DatabaseZap },
  { label: "OTP / Zalo", href: "/admin/otp", icon: KeyRound },
  { label: "Nội dung", href: "/admin/content", icon: BookOpenText },
  { label: "Cấu hình", href: "/admin/settings", icon: Settings },
  { label: "Audit log", href: "/admin/audit", icon: FileText },
];

export function AdminShell({
  children,
  username,
  role = "super_admin",
}: {
  children: React.ReactNode;
  username: string;
  role?: AdminRole;
}) {
  const visibleNav = nav.filter((item) => canAdminAccessPath(role, item.href));

  return (
    <main className="min-h-screen bg-[#f7f1e6] text-ink">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-cream-200 bg-primary-900 px-4 py-5 text-white lg:sticky lg:top-0 lg:h-screen">
          <div className="rounded-md bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-100">An Phú Care</p>
            <h1 className="mt-1 font-serif text-2xl font-black">Portal Admin</h1>
            <p className="mt-2 text-sm leading-6 text-primary-50/80">Quản trị vận hành cổng bệnh nhân.</p>
          </div>

          <nav className="mt-5 grid gap-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-primary-50/85 transition hover:bg-white/10 hover:text-white"
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold leading-5 text-primary-50/80">
            Đăng nhập: <span className="text-white">{username}</span>
            <br />
            Vai trò: <span className="text-white">{adminRoleLabel(role)}</span>
          </div>

          <form action="/api/admin/logout" method="post" className="mt-3">
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-black text-white transition hover:bg-white/15">
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Đăng xuất
            </button>
          </form>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">{children}</section>
      </div>
    </main>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-cream-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700">{eyebrow}</p>
        <h2 className="mt-1 font-serif text-3xl font-black text-ink">{title}</h2>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
