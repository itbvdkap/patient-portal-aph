import { z } from "zod";
import { querySchema } from "./domain";

export const managementKinds = ["customer", "cohort", "group", "member", "package"] as const;
export type ManagementKind = typeof managementKinds[number];
export const managementLabels: Record<ManagementKind, string> = { customer: "Khách hàng", cohort: "Đợt khám", group: "Nhóm khám", member: "Người khám", package: "Gói / mục dịch vụ" };
export const managementFields: Record<ManagementKind, string[]> = {
  customer: ["ten", "stt"],
  cohort: ["id_ksk_khachhang", "ten", "sohd", "ngay", "loai", "ma", "diachi", "dienthoai", "fax", "email", "masothue", "nguoilienhe", "ghichu"],
  group: ["stt", "ma", "ten", "tu", "den", "so_hop_dong"],
  member: ["stt", "hoten", "namsinh", "phai", "dienthoai", "diachi", "manv", "bo_phan", "id_goi_kskmuc", "tinhtrang_honnhan"],
  package: ["stt", "phai", "tt", "namsinh", "ghichu", "namsinh_tu", "namsinh_den", "id_goi_kskmuc", "tinhtrang_honnhan"],
};
export const fieldLabels: Record<string, string> = { ten: "Tên", stt: "STT", id_ksk_khachhang: "Công ty / khách hàng", sohd: "Số hợp đồng", ngay: "Ngày đợt khám", loai: "Loại (0 nội viện / 1 ngoại viện)", ma: "Mã", diachi: "Địa chỉ", dienthoai: "Điện thoại", fax: "Fax", email: "Email", masothue: "Mã số thuế", nguoilienhe: "Người liên hệ", ghichu: "Ghi chú / CSKH", tu: "Từ ngày", den: "Đến ngày", so_hop_dong: "Số hợp đồng nhóm", hoten: "Họ tên", namsinh: "Năm sinh", phai: "Giới tính (0 nam / 1 nữ)", manv: "Mã nhân viên", bo_phan: "Bộ phận", id_goi_kskmuc: "Mã nhóm gói (0–99, không phải ID dòng gói)", tinhtrang_honnhan: "Hôn nhân (0/1/2 theo HIS)", tt: "Điều kiện năm sinh nguồn", namsinh_tu: "Năm sinh từ", namsinh_den: "Năm sinh đến", iddonvi: "Nhóm khám", mabn: "Mã BN HIS (8 số)", mavp: "Dịch vụ", gia_nv: "Giá nội viện", gia_ngv: "Giá ngoại viện" };
export type ManagementRow = Record<string, string>;
const row = z.record(z.string().max(2000));
const id = z.string().regex(/^[1-9][0-9]{0,19}$/);
export const managementQuerySchema = querySchema;
export const managementProposalSchema = z.object({ kind: z.enum(managementKinds), key: z.string().max(50), fields: row, items: z.array(row).max(100) }).strict().superRefine((p, ctx) => {
  const required = [...managementFields[p.kind], ...(p.kind === "member" && p.key === "NEW" ? ["iddonvi", "mabn"] : [])].sort();
  if (JSON.stringify(Object.keys(p.fields).sort()) !== JSON.stringify(required)) ctx.addIssue({ code: "custom", message: "Sai danh sách trường chỉnh sửa." });
  if (p.key !== "NEW" && !(p.kind === "member" ? /^[1-9][0-9]{0,19}:[0-9]{8}$/ : /^[1-9][0-9]{0,19}$/).test(p.key)) ctx.addIssue({ code: "custom", message: "Sai khóa đối tượng." });
  if (p.kind !== "package" && p.items.length) ctx.addIssue({ code: "custom", message: "Chỉ gói khám có chi tiết dịch vụ." });
  for (const item of p.items) if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(["mavp", "stt", "gia_nv", "gia_ngv", "ghichu"].sort()) || !id.safeParse(item.mavp).success
    || !/^\d{1,3}$/.test(item.stt) || !/^\d{1,10}$/.test(item.gia_nv) || !/^\d{1,10}$/.test(item.gia_ngv) || item.ghichu.length > 254) ctx.addIssue({ code: "custom", message: "Dòng dịch vụ/đơn giá không hợp lệ." });
  if (new Set(p.items.map(i => i.mavp)).size !== p.items.length) ctx.addIssue({ code: "custom", message: "Trùng dịch vụ trong gói." });
});
export type ManagementProposal = z.infer<typeof managementProposalSchema>;
export const managementSnapshotSchema = z.object({ branch: z.string().min(1).max(20), version: z.string().regex(/^[a-f0-9]{64}$/), writeEnabled: z.boolean(), cohortId: id.or(z.literal("")),
  customers: z.array(row).max(5000), cohorts: z.array(row).max(3000), groups: z.array(row).max(3000), members: z.array(row).max(3000), packages: z.array(row).max(3000), items: z.array(row).max(10000), services: z.array(row).max(20000),
  hasVisits: z.boolean(), visitedMembers: z.array(z.string()).max(10000), visitedGroups: z.array(z.string()).max(10000) }).strict();
export type ManagementSnapshot = z.infer<typeof managementSnapshotSchema>;
export function managementRows(data: ManagementSnapshot, kind: ManagementKind) { return data[({ customer: "customers", cohort: "cohorts", group: "groups", member: "members", package: "packages" } as const)[kind]]; }
export function managementKey(kind: ManagementKind, value: ManagementRow) { return kind === "member" ? `${value.iddonvi}:${value.mabn}` : value.id; }
export function proposalFromRow(data: ManagementSnapshot, kind: ManagementKind, value: ManagementRow): ManagementProposal {
  return { kind, key: managementKey(kind, value), fields: Object.fromEntries(managementFields[kind].map(f => [f, value[f] ?? ""])),
    items: kind === "package" ? data.items.filter(i => i.id === value.id).map(({ mavp, stt, gia_nv, gia_ngv, ghichu }) => ({ mavp, stt, gia_nv, gia_ngv, ghichu })) : [] };
}
export function draftPermission(kind: ManagementKind) { return kind === "package" ? "ksk_manage_package" as const : "ksk_manage_roster" as const; }
export const managementStates = { draft: "Nháp", submitted: "Chờ duyệt", rejected: "Từ chối", approved: "Đã duyệt", applying: "Đang áp dụng", uncertain: "Chưa rõ kết quả — cần kiểm tra/lặp đúng mã lệnh", applied: "Đã ghi HIS" } as const;
export interface ManagementDraft {
  id: string; revision: number; branch: string; query: z.infer<typeof managementQuerySchema>; version: string; state: keyof typeof managementStates;
  proposal: ManagementProposal; before: ManagementProposal | null; author: string; reviewer?: string; reason: string; updatedAt: string;
  appliedBy?: string; applyReason?: string; result?: ManagementRow;
  history: { actor: string; action: string; at: string; reason: string; proposal?: ManagementProposal }[];
}
const reason = z.string().trim().min(5).max(500);
export const managementCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), query: managementQuerySchema, version: z.string().regex(/^[a-f0-9]{64}$/), proposal: managementProposalSchema, reason }).strict(),
  z.object({ action: z.literal("check"), query: managementQuerySchema, version: z.string().regex(/^[a-f0-9]{64}$/), proposal: managementProposalSchema, reason }).strict(),
  z.object({ action: z.enum(["submit", "approve", "reject", "apply"]), id: z.string().uuid(), revision: z.number().int().positive(), reason }).strict(),
]);
export type ManagementCommand = z.infer<typeof managementCommandSchema>;
