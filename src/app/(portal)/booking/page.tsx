import { ExternalLink } from "lucide-react";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui";
import { BookingForm } from "./booking-form";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Patient } from "@/types/patient";
import { normalizeDisplayText } from "@anphu/patient-domain";

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

function toVnDate(value?: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;

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

function mapLinkedBookingProfile(mabn: string, fallbackName: string | undefined, patient: Patient | null) {
  const raw = (patient ?? {}) as Patient & Record<string, unknown>;

  return {
    oldPatientCode: mabn,
    fullName: normalizeDisplayText(patient?.fullName ?? fallbackName ?? `Mã BN ${mabn}`),
    phone: patient?.phone ?? "",
    birthDate: toVnDate(patient?.birthDate),
    gender: patient?.gender ?? "",
    address: normalizeDisplayText(patient?.address ?? ""),
    soCCCD: firstText(patient?.citizenId, patient?.soCCCD, raw.cccd, raw.cmnd, raw.citizen_id, raw.so_cmnd, raw.socmnd),
    ngayCap: toVnDate(firstText(patient?.citizenIssueDate, patient?.ngayCap, raw.ngay_cap, raw.issueDate, raw.issue_date, raw.ngaycap)),
    hasInsurance: patient?.insurance?.status === "Còn hiệu lực",
  };
}

async function getLinkedBookingProfiles() {
  const session = getDemoPatientSession(await cookies());
  if (!session) return [];

  const supabase = createSupabaseServiceClient();
  const mabnMap = new Map<string, string | undefined>();

  for (const profile of session.profiles) {
    mabnMap.set(profile.mabn, profile.fullName);
  }

  if (session.accountId || session.accountKey) {
    const query = supabase
      .from("portal_account_profiles")
      .select("mabn,display_name")
      .order("is_active", { ascending: false })
      .order("linked_at", { ascending: true });

    const { data } = session.accountId
      ? await query.eq("account_id", session.accountId)
      : await query.eq("account_key", session.accountKey);

    for (const profile of data ?? []) {
      mabnMap.set(profile.mabn, profile.display_name ?? mabnMap.get(profile.mabn));
    }
  }

  const profiles = await Promise.all(
    Array.from(mabnMap.entries()).map(async ([mabn, fallbackName]) => {
      const { data } = await supabase
        .from("portal_resource_snapshots")
        .select("payload_json")
        .eq("cache_key", `${mabn}:patient_profile:_`)
        .maybeSingle<SnapshotRow>();

      return mapLinkedBookingProfile(mabn, fallbackName, data?.payload_json ?? null);
    }),
  );

  return profiles;
}

export default async function BookingPage() {
  const linkedProfiles = await getLinkedBookingProfiles();

  return (
    <>
      <PageHeader
        title="Đăng ký khám"
        description="Đặt lịch khám ngay trong cổng thông tin, dữ liệu được chuyển về hệ thống đăng ký khám của Bệnh viện Đa khoa An Phú."
        actions={
          <a
            href="https://benhvienanphu.vn/dang-ky-kham"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary-700 px-3 text-sm font-bold text-white hover:bg-primary-900"
          >
            Mở ngoài
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        }
      />

      <BookingForm linkedProfiles={linkedProfiles} />
    </>
  );
}
