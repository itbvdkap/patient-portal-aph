import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { enqueuePatientSync } from "@/lib/supabase/portal-sync";
import type { Patient } from "@/types/patient";

const lookupSchema = z.object({
  mabn: z.string().trim().min(1).max(20),
});

type SnapshotRow = {
  payload_json: Patient | null;
};

function toVnDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function mapPatient(patient: Patient) {
  return {
    oldPatientCode: patient.hisPatientCode,
    fullName: patient.fullName,
    phone: patient.phone,
    birthDate: toVnDate(patient.birthDate),
    gender: patient.gender,
    address: patient.address,
    hasInsurance: patient.insurance?.status === "Còn hiệu lực",
  };
}

async function readPatientSnapshot(mabn: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("portal_resource_snapshots")
    .select("payload_json")
    .eq("cache_key", `${mabn}:patient_profile:_`)
    .maybeSingle<SnapshotRow>();

  if (error) {
    throw new Error(`Supabase patient snapshot read failed: ${error.message}`);
  }

  return data?.payload_json ?? null;
}

export async function POST(request: Request) {
  const parsed = lookupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập mã bệnh nhân." }, { status: 400 });
  }

  const mabn = parsed.data.mabn;
  const cached = await readPatientSnapshot(mabn);
  if (cached) {
    return NextResponse.json({ data: mapPatient(cached) });
  }

  await enqueuePatientSync(mabn, "patient_profile");
  const started = Date.now();

  while (Date.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const patient = await readPatientSnapshot(mabn);
    if (patient) {
      return NextResponse.json({ data: mapPatient(patient) });
    }
  }

  return NextResponse.json(
    { error: "Đã yêu cầu đồng bộ hồ sơ cũ. Vui lòng bấm tìm lại sau vài giây." },
    { status: 202 },
  );
}
