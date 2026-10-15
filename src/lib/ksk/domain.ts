import { z } from "zod";

export const rowSchema = z.record(z.string().nullable());
export type KskRow = z.infer<typeof rowSchema>;
function requiredRow(...keys: string[]) {
  return rowSchema.refine(row => keys.every(key => Boolean(row[key]?.trim())), "Thiếu khóa liên kết dữ liệu HIS.");
}
export const snapshotSchema = z.object({
  scope: z.object({ from: z.string(), to: z.string(), branch: z.string(), mode: z.enum(["his", "demo"]), asof: z.string(),
    episodePolicy: z.literal(2).optional(), collections: z.boolean().optional(), collectedFrom: z.string().nullable().optional(), collectedTo: z.string().nullable().optional() }),
  cohorts: z.array(requiredRow("id")), members: z.array(requiredRow("groupid", "mabn")),
  visits: z.array(requiredRow("maql", "episodeid", "groupid", "mabn")),
  charges: z.array(requiredRow("source", "id", "maql")),
  clinical: z.array(requiredRow("kind", "episodeid")), labs: z.array(requiredRow("id", "maql", "parameterid")),
  imaging: z.array(requiredRow("kind", "id", "maql", "serviceid")),
  // Older agents stay readable, but absence is never interpreted as no receipts.
  payments: z.array(requiredRow("source", "kind", "receiptid", "mabn", "maql")).default([]),
  sections: z.record(z.boolean()), warnings: z.array(z.string()),
}).superRefine((data, context) => {
  if (data.scope.episodePolicy !== 2) return;
  for (const [name, rows, fields] of [
    ["charges", data.charges, ["mabn", "mavaovien", "quantity", "price"]],
    ["payments", data.payments, ["mavaovien", "linequantity", "lineprice"]],
  ] as const) rows.forEach((row, index) => {
    if (fields.some(field => !(field in row))) context.addIssue({ code: z.ZodIssueCode.custom,
      path: [name, index], message: "Agent khai báo đối chiếu MAVAOVIEN nhưng thiếu trường bằng chứng." });
  });
});
export type KskSnapshot = z.infer<typeof snapshotSchema>;
export interface KskQuery { from: string; to: string; cohort: string }

// The entire HIS note is the operator-selected CSKH label, not a parsed employee identity.
// Keep the original text for display; normalize whitespace only for grouping/filter comparison.
export function cohortSupportKey(row: KskRow): string {
  if (!("ghichu" in row)) return "unknown";
  const value = row.ghichu?.trim().replace(/\s+/g, " ") ?? "";
  return value ? `note:${value}` : "blank";
}
export function cohortSupportLabel(row: KskRow): string {
  const key = cohortSupportKey(row);
  if (key === "unknown") return "Chưa đọc được ghi chú";
  if (key === "blank") return "Chưa ghi phụ trách";
  return row.ghichu!.trim();
}
export function cohortCompanyKey(row: KskRow): string {
  return row.customerid ? `id:${row.customerid}` : `name:${row.customer?.trim() ?? ""}`;
}
export function filterCohorts(rows: KskRow[], company: string, support: string): KskRow[] {
  return rows.filter(row => (!company || cohortCompanyKey(row) === company) && (!support || cohortSupportKey(row) === support));
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Ngày không hợp lệ.");
export const querySchema = z.object({ from: date, to: date, cohort: z.string().regex(/^\d{1,24}$/).or(z.literal("")).default("") })
  .refine(q => q.to >= q.from && (Date.parse(q.to) - Date.parse(q.from)) / 86400000 <= 92,
    "Chọn khoảng ngày hợp lệ, tối đa 93 ngày.");

export function defaultKskQuery(now = new Date()): KskQuery {
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { from: `${to.slice(0, 7)}-01`, to, cohort: "" };
}

export function sectionComplete(data: KskSnapshot, name: string) {
  if ((name === "charges" || name === "payments") && data.scope.episodePolicy !== 2) return false;
  const flags = Object.entries(data.sections).filter(([key]) => key === name || key.startsWith(`${name}:`));
  return flags.length > 0 && flags.every(([, complete]) => complete);
}

export function memberVisits(data: KskSnapshot, member: KskRow) {
  return data.visits.filter(v => v.mabn === member.mabn && v.groupid === member.groupid);
}

export function positiveEpisode(value: string | null | undefined): value is string {
  return Boolean(value && /^\d+$/.test(value) && /[1-9]/.test(value));
}
export function chargeInVisits(charge: KskRow, visits: KskRow[]) {
  return positiveEpisode(charge.mavaovien) && visits.some(v => v.mabn === charge.mabn && v.maql === charge.maql
    && positiveEpisode(v.episodeid) && v.episodeid === charge.mavaovien);
}
export function scopedCharges(data: KskSnapshot) { return data.charges.filter(c => chargeInVisits(c, data.visits)); }

export function memberRecords(data: KskSnapshot, member: KskRow) {
  const visits = memberVisits(data, member);
  const ids = new Set(visits.map(v => v.maql));
  const episodes = new Set(visits.map(v => v.episodeid).filter(Boolean));
  return {
    visits,
    charges: data.charges.filter(r => chargeInVisits(r, visits)),
    excludedCharges: data.charges.filter(r => ids.has(r.maql) && r.mabn === member.mabn && !chargeInVisits(r, visits)),
    labs: data.labs.filter(r => ids.has(r.maql)),
    imaging: data.imaging.filter(r => ids.has(r.maql)),
    clinical: data.clinical.filter(r => episodes.has(r.episodeid)),
  };
}

export function hasValue(value: string | null | undefined): boolean { return Boolean(value?.trim()); }
export function concluded(rows: KskRow[]) {
  return rows.some(r => r.kind === "BASK_TONGKET" && hasValue(r.ketluan) && hasValue(r.mabs));
}
export function hasResults(rows: { labs: KskRow[]; imaging: KskRow[] }) {
  return [...rows.labs, ...rows.imaging].some(r => hasValue(r.value));
}
export function chargeTotal(rows: KskRow[]): number | null {
  // Never sum a join with result rows: a single service can produce many analytes.
  const distinct = new Map<string, KskRow>();
  for (const row of rows) {
    if (!row.source || !row.id) return null;
    const key = `${row.source}:${row.id}`;
    if (distinct.has(key) && distinct.get(key)!.amount !== row.amount) return null;
    distinct.set(key, row);
  }
  let sum = 0;
  for (const r of distinct.values()) {
    if (!r.amount?.trim() || !/^-?\d+(\.\d+)?$/.test(r.amount)) return null;
    sum += Number(r.amount);
    if (!Number.isFinite(sum) || Math.abs(sum) > Number.MAX_SAFE_INTEGER) return null;
  }
  return sum;
}
export function summarize(data: KskSnapshot) {
  const members = [...new Map(data.members.map(m => [`${m.groupid}:${m.mabn}`, m])).values()];
  const records = members.map(m => memberRecords(data, m));
  return {
    expected: sectionComplete(data, "members") ? members.length : null,
    registered: sectionComplete(data, "members") && sectionComplete(data, "visits") ? records.filter(r => r.visits.length > 0).length : null,
    withResults: sectionComplete(data, "members") && sectionComplete(data, "labs") && sectionComplete(data, "imaging") && sectionComplete(data, "visits")
      ? records.filter(hasResults).length : null,
    concluded: sectionComplete(data, "members") && sectionComplete(data, "conclusions") && sectionComplete(data, "visits") ? records.filter(r => concluded(r.clinical)).length : null,
    amount: sectionComplete(data, "charges") && sectionComplete(data, "visits") ? chargeTotal(scopedCharges(data)) : null,
  };
}
export function money(value: number | null) {
  return value === null ? "Chưa xác định" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 2 }).format(value);
}
