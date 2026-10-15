import { AdminShellClient, type AdminNavIcon, type AdminShellNavItem } from "@/app/admin/admin-shell-client";
import { adminRoleLabel, canAdminAccessPath, type AdminRole } from "@/lib/admin/session";
import { adminMenuOptions, kskMenuGroup, type AdminMenu } from "@/lib/admin/permissions";

const nav: Array<{ label: string; href: string; iconKey: AdminNavIcon }> = [
  { label: "Tổng quan", href: "/admin", iconKey: "activity" },
  { label: "Tài khoản", href: "/admin/accounts", iconKey: "user" },
  { label: "Hồ sơ liên kết", href: "/admin/profiles", iconKey: "users" },
  { label: "Đăng ký khám", href: "/admin/bookings", iconKey: "calendar" },
  { label: "Khám đoàn · chỉ đọc", href: "/admin/ksk", iconKey: "users" },
  { label: "Báo cáo thu tiền", href: "/admin/ksk-collections", iconKey: "file" },
  { label: "Phiếu thay đổi · LAB", href: "/admin/ksk-changes", iconKey: "file" },
  { label: "Quản lý đoàn / gói HIS", href: "/admin/ksk-manage", iconKey: "users" },
  { label: "Sync HIS", href: "/admin/sync", iconKey: "database" },
  { label: "OTP / Zalo", href: "/admin/otp", iconKey: "key" },
  { label: "Nội dung", href: "/admin/content", iconKey: "book" },
  { label: "Cấu hình", href: "/admin/settings", iconKey: "settings" },
  { label: "Audit log", href: "/admin/audit", iconKey: "file" },
  { label: "Nhân viên & phân quyền", href: "/admin/staff", iconKey: "user" },
  { label: "Đổi mật khẩu", href: "/admin/password", iconKey: "key" },
];

export function AdminShell({
  children,
  username,
  role = "super_admin",
  menus,
}: {
  children: React.ReactNode;
  username: string;
  role?: AdminRole;
  menus?: AdminMenu[];
}) {
  const subject = { username, role, exp: 0, menus };
  const visibleNav = nav.filter((item) => (item.href !== "/admin/password" || role === "staff") && canAdminAccessPath(subject, item.href)).map(({ label, href, iconKey }) => ({ label, href, icon: iconKey }));
  const kskPaths = new Set<string>(adminMenuOptions.filter(menu => kskMenuGroup.menus.some(id => id === menu.id)).map(menu => menu.path));
  const kskChildren = visibleNav.filter(item => kskPaths.has(item.href));
  const groupedNav: AdminShellNavItem[] = [];
  for (const item of visibleNav) {
    if (kskPaths.has(item.href)) {
      if (!groupedNav.some(entry => "id" in entry && entry.id === kskMenuGroup.id)) {
        groupedNav.push({ id: kskMenuGroup.id, label: kskMenuGroup.label, icon: "users", children: kskChildren });
      }
    } else groupedNav.push(item);
  }

  return (
    <AdminShellClient nav={groupedNav} username={username} roleLabel={adminRoleLabel(role)}>
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
