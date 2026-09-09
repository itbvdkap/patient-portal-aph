import { CalendarCheck } from "lucide-react";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { BookingForm } from "./booking-form";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Patient } from "@/types/patient";
import { isPatientBranchCode, normalizeDisplayText, type PatientBranchCode } from "@anphu/patient-domain";

type SnapshotRow = {
  payload_json: Patient | null;
};

function firstText(...values: Array<unknown>) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return "";
}

function deepText(source: Record<string, unknown>, ...paths: string[]) {
  for (const path of paths) {
    let current: unknown = source;
    for (const part of path.split(".")) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    const text = String(current ?? "").trim();
    if (text) return text;
  }
  return "";
}

function toVnDate(value?: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }

  const compact = raw.match(/^(\d{8})$/);
  if (compact) {
    const digits = compact[1];
    if (digits.startsWith("19") || digits.startsWith("20")) {
      return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
    }

    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function mapLinkedBookingProfile(mabn: string, branchCode: PatientBranchCode, fallbackName: string | undefined, patient: Patient | null) {
  const raw = (patient ?? {}) as Patient & Record<string, unknown>;

  return {
    oldPatientCode: mabn,
    branchCode,
    fullName: normalizeDisplayText(patient?.fullName ?? fallbackName ?? `Mã BN ${mabn}`),
    phone: patient?.phone ?? "",
    birthDate: toVnDate(patient?.birthDate),
    gender: patient?.gender ?? "",
    address: normalizeDisplayText(patient?.address ?? ""),
    soCCCD: firstText(
      patient?.citizenId,
      patient?.soCCCD,
      raw.cccd,
      raw.cmnd,
      raw.citizen_id,
      raw.citizenId,
      raw.so_cccd,
      raw.socccd,
      raw.so_cmnd,
      raw.socmnd,
      raw.sothe,
      raw.so_the,
      raw.socmnd_cccd,
      raw.so_giayto,
      raw.so_giay_to,
      deepText(raw, "identity.number", "identity.idNumber", "identity.cardNumber", "personal.idNumber", "patient.identityNumber"),
    ),
    ngayCap: toVnDate(
      firstText(
        patient?.citizenIssueDate,
        patient?.ngayCap,
        raw.ngay_cap,
        raw.ngaycap,
        raw.ngay_cap_cccd,
        raw.ngaycapcccd,
        raw.ngay_cap_cmnd,
        raw.ngaycapcmnd,
        raw.ngay_cap_giayto,
        raw.ngay_cap_giay_to,
        raw.issueDate,
        raw.issue_date,
        raw.idIssueDate,
        raw.id_issue_date,
        deepText(raw, "identity.issueDate", "identity.issuedAt", "personal.issueDate", "patient.identityIssueDate"),
      ),
    ),
    hasInsurance: patient?.insurance?.status === "Còn hiệu lực",
  };
}

async function getLinkedBookingProfiles() {
  const session = getDemoPatientSession(await cookies());
  if (!session) return [];

  const supabase = createSupabaseServiceClient();
  const profileMap = new Map<string, { mabn: string; branchCode: PatientBranchCode; fallbackName?: string }>();

  for (const profile of session.profiles) {
    profileMap.set(`${profile.branchCode}:${profile.mabn}`, { mabn: profile.mabn, branchCode: profile.branchCode, fallbackName: profile.fullName });
  }

  if (session.accountId || session.accountKey) {
    const query = supabase
      .from("portal_account_profiles")
      .select("mabn,branch_code,display_name")
      .order("is_active", { ascending: false })
      .order("linked_at", { ascending: true });

    const { data } = session.accountId
      ? await query.eq("account_id", session.accountId)
      : await query.eq("account_key", session.accountKey);

    for (const profile of data ?? []) {
      const branchCode = normalizeBranchCode(profile.branch_code);
      const key = `${branchCode}:${profile.mabn}`;
      profileMap.set(key, { mabn: profile.mabn, branchCode, fallbackName: profile.display_name ?? profileMap.get(key)?.fallbackName });
    }
  }

  const profiles = await Promise.all(
    Array.from(profileMap.values()).map(async ({ mabn, branchCode, fallbackName }) => {
      const { data } = await supabase
        .from("portal_resource_snapshots")
        .select("payload_json")
        .eq("cache_key", `${branchCode}:${mabn}:patient_profile:_`)
        .maybeSingle<SnapshotRow>();

      return mapLinkedBookingProfile(mabn, branchCode, fallbackName, data?.payload_json ?? null);
    }),
  );

  return profiles;
}

function normalizeBranchCode(value: unknown): PatientBranchCode {
  return isPatientBranchCode(value) ? value : "CN1";
}

export default async function BookingPage() {
  const linkedProfiles = await getLinkedBookingProfiles();

  return (
    <>
      <header className="mb-4 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-900 via-primary-700 to-emerald-500 p-4 text-white shadow-[0_14px_34px_rgba(7,60,57,0.16)]">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <CalendarCheck aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wide text-white/75">Express booking</p>
            <h1 className="font-serif text-2xl font-black leading-7 text-white">Đăng ký khám</h1>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/82">
              Chọn người bệnh, chuyên khoa, bác sĩ và giờ khám trong một luồng ngắn gọn.
            </p>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <BookingForm linkedProfiles={linkedProfiles} />
      </Suspense>
    </>
  );
}
