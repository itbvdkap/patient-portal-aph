import { ExternalLink } from "lucide-react";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui";
import { BookingForm } from "./booking-form";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Patient } from "@/types/patient";

type SnapshotRow = {
  payload_json: Patient | null;
};

function toVnDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
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

      const patient = data?.payload_json;
      return {
        oldPatientCode: mabn,
        fullName: patient?.fullName ?? fallbackName ?? `Mã BN ${mabn}`,
        phone: patient?.phone ?? "",
        birthDate: toVnDate(patient?.birthDate),
        gender: patient?.gender ?? "",
        address: patient?.address ?? "",
        hasInsurance: patient?.insurance?.status === "Còn hiệu lực",
      };
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
