import { AdminShellClient, type AdminNavIcon } from "@/app/admin/admin-shell-client";
import { adminRoleLabel, canAdminAccessPath, type AdminRole } from "@/lib/admin/session";

const nav: Array<{ label: string; href: string; iconKey: AdminNavIcon }> = [
  { label: "Tổng quan", href: "/admin", iconKey: "activity" },
  { label: "Tài khoản", href: "/admin/accounts", iconKey: "user" },
  { label: "Hồ sơ liên kết", href: "/admin/profiles", iconKey: "users" },
  { label: "Đăng ký khám", href: "/admin/bookings", iconKey: "calendar" },
  { label: "Sync HIS", href: "/admin/sync", iconKey: "database" },
  { label: "OTP / Zalo", href: "/admin/otp", iconKey: "key" },
  { label: "Nội dung", href: "/admin/content", iconKey: "book" },
  { label: "Cấu hình", href: "/admin/settings", iconKey: "settings" },
  { label: "Audit log", href: "/admin/audit", iconKey: "file" },
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
  const visibleNav = nav.filter((item) => canAdminAccessPath(role, item.href)).map(({ label, href, iconKey }) => ({ label, href, icon: iconKey }));

  return (
    <AdminShellClient nav={visibleNav} username={username} roleLabel={adminRoleLabel(role)}>
      {children}
    </AdminShellClient>
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
