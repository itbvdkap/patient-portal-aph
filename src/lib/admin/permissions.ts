export const adminMenuOptions = [
  { id: "accounts", path: "/admin/accounts", label: "Tài khoản bệnh nhân" },
  { id: "profiles", path: "/admin/profiles", label: "Hồ sơ liên kết" },
  { id: "bookings", path: "/admin/bookings", label: "Đăng ký khám" },
  { id: "revenue", path: "/admin/vienphi-revenue", label: "Doanh thu viện phí toàn viện theo thu ngân" },
  { id: "ksk", path: "/admin/ksk", label: "Khám đoàn và báo cáo XN / CLS" },
  { id: "ksk_collections", path: "/admin/ksk-collections", label: "Báo cáo thu tiền khám đoàn" },
  { id: "ksk_changes", path: "/admin/ksk-changes", label: "Phiếu thay đổi gói / danh sách · LAB" },
  { id: "ksk_manage", path: "/admin/ksk-manage", label: "Quản lý đoàn / gói / danh sách HIS" },
  { id: "sync", path: "/admin/sync", label: "Theo dõi Sync HIS" },
  { id: "otp", path: "/admin/otp", label: "Theo dõi OTP / Zalo" },
  { id: "content", path: "/admin/content", label: "Xem nội dung" },
  { id: "audit", path: "/admin/audit", label: "Xem Audit log" },
] as const;
export type AdminMenu = typeof adminMenuOptions[number]["id"];
export const adminMenus = adminMenuOptions.map(menu => menu.id);

// Presentation only: this parent never grants access to its children.
export const kskMenuGroup = {
  id: "ksk_management",
  label: "Quản lý khám sức khoẻ",
  menus: ["ksk", "ksk_collections", "ksk_changes", "ksk_manage"],
} as const satisfies { id: string; label: string; menus: readonly AdminMenu[] };

export const adminActionOptions = [
  { id: "ksk_package_draft", label: "Lập / sửa nháp gói khám · LAB" },
  { id: "ksk_roster_draft", label: "Lập / sửa nháp danh sách khám · LAB" },
  { id: "ksk_change_approve", label: "Duyệt / từ chối phiếu của người khác · LAB" },
  { id: "ksk_change_apply", label: "Áp dụng phiếu đã duyệt vào HIS giả lập" },
  { id: "ksk_manage_roster", label: "Lập phiếu khách hàng / đợt / nhóm / người khám HIS" },
  { id: "ksk_manage_package", label: "Lập phiếu gói / dịch vụ HIS" },
  { id: "ksk_manage_approve", label: "Duyệt thay đổi dữ liệu HIS của người khác" },
  { id: "ksk_manage_apply", label: "Áp dụng phiếu đã duyệt vào HIS thật (cần mở ghi server)" },
] as const;
export type AdminAction = typeof adminActionOptions[number]["id"];
export const adminActions = adminActionOptions.map(option => option.id);
export function actionMenu(action: AdminAction): AdminMenu { return action.startsWith("ksk_manage_") ? "ksk_manage" : "ksk_changes"; }

export function matchesAdminPath(allowed: string, path: string) {
  // /admin is the landing page, NEVER a wildcard granting all descendants.
  return path === allowed || (allowed !== "/admin" && path.startsWith(`${allowed}/`));
}
