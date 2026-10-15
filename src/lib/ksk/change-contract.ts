import { z } from "zod";

const text = z.string().trim().min(1).max(120);
const labId = z.string().regex(/^LAB-[A-Z0-9-]{1,50}$/);
export const packageProposalSchema = z.object({ kind: z.literal("package"), name: text,
  services: z.array(z.object({ serviceId: labId, quantity: z.number().int().min(1).max(1000), unitPrice: z.number().int().min(0).max(100000000) }).strict()).min(1).max(50)
    .refine(rows => new Set(rows.map(r => r.serviceId)).size === rows.length, "Không lặp dịch vụ trong gói.") }).strict();
export const memberProposalSchema = z.object({ kind: z.literal("member"), name: text, birthYear: z.number().int().min(1900).max(2100),
  sex: z.enum(["male", "female"]), employeeCode: z.string().trim().max(40), department: z.string().trim().max(120), groupId: labId, packageId: labId }).strict();
export const changeProposalSchema = z.discriminatedUnion("kind", [packageProposalSchema, memberProposalSchema]);
export type ChangeProposal = z.infer<typeof changeProposalSchema>;
export interface LabTarget { id: string; value: ChangeProposal; hasVisit: boolean }
export const changeStates = { draft: "Nháp", submitted: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối", simulated: "Đã áp dụng GIẢ LẬP" } as const;
export type ChangeState = keyof typeof changeStates;
export interface ChangeEvent { actor: string; at: string; action: string; reason: string; proposal?: ChangeProposal }
export interface ChangeDraft {
  id: string; revision: number; state: ChangeState; targetId: string; sourceHash: string; before: ChangeProposal | null; after: ChangeProposal;
  author: string; reviewer?: string; appliedBy?: string; createdAt: string; updatedAt: string; reason: string; history: ChangeEvent[];
}
export interface ChangeLabSnapshot {
  mode: "simulation"; realHisWriteEnabled: false; sourceVersion: string; targets: LabTarget[]; drafts: ChangeDraft[];
  catalog: { id: string; name: string }[]; groups: { id: string; name: string }[];
}
const revision = z.number().int().min(1);
const reason = z.string().trim().min(5).max(500);
export const changeCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), targetId: labId.or(z.literal("NEW")), sourceVersion: z.string().regex(/^[a-f0-9]{64}$/), after: changeProposalSchema, reason }).strict(),
  z.object({ action: z.literal("save"), id: z.string().uuid(), revision, after: changeProposalSchema, reason }).strict(),
  z.object({ action: z.enum(["submit", "approve", "reject", "apply_simulation", "apply_his"]), id: z.string().uuid(), revision, reason }).strict(),
]);
export type ChangeCommand = z.infer<typeof changeCommandSchema>;
export function changeDraftAction(kind: ChangeProposal["kind"]) { return kind === "package" ? "ksk_package_draft" as const : "ksk_roster_draft" as const; }
export function packageTotal(value: z.infer<typeof packageProposalSchema>) { return value.services.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0); }
