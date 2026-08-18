import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { enqueuePatientSync } from "@/lib/supabase/portal-sync";
import type { Patient } from "@/types/patient";

const lookupSchema = z.object({
  mabn: z.string().trim().min(1).max(20),
  phone: z.string().trim().max(20).optional().default(""),
  birthDate: z.string().trim().max(10).optional().default(""),
});

type SnapshotRow = {
  payload_json: Patient | null;
};

function toVnDate(value?: string) {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function firstText(...values: Array<unknown>) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeDigits(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function dateKey(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}${ddmmyyyy[2]}${ddmmyyyy[1]}`;
  }

  const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}${yyyymmdd[2]}${yyyymmdd[3]}`;
  }

  return normalizeDigits(raw);
}

function canVerifyPatient(patient: Patient, verifier: { phone?: string; birthDate?: string }) {
  const phone = normalizeDigits(verifier.phone);
  const birthDate = dateKey(verifier.birthDate);
  const patientPhone = normalizeDigits(patient.phone);
  const patientBirthDate = dateKey(patient.birthDate);

  const phoneMatches = Boolean(phone && patientPhone && phone === patientPhone);
  const birthDateMatches = Boolean(birthDate && patientBirthDate && birthDate === patientBirthDate);

  return phoneMatches || birthDateMatches;
}

function mapPatient(patient: Patient) {
  const raw = patient as Patient & Record<string, unknown>;

  return {
    oldPatientCode: patient.hisPatientCode,
    fullName: patient.fullName,
    phone: patient.phone,
    birthDate: toVnDate(patient.birthDate),
    gender: patient.gender,
    address: patient.address,
    soCCCD: firstText(patient.citizenId, patient.soCCCD, raw.cccd, raw.cmnd, raw.citizen_id),
    ngayCap: toVnDate(firstText(patient.citizenIssueDate, patient.ngayCap, raw.ngay_cap, raw.issueDate)),
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
  if (!parsed.data.phone && !parsed.data.birthDate) {
    return NextResponse.json(
      { error: "Vui lòng nhập thêm ngày sinh hoặc số điện thoại đã đăng ký để xác minh hồ sơ cũ." },
      { status: 400 },
    );
  }

  const cached = await readPatientSnapshot(mabn);
  if (cached) {
    if (!canVerifyPatient(cached, parsed.data)) {
      return NextResponse.json(
        { error: "Không xác minh được hồ sơ. Vui lòng kiểm tra lại mã bệnh nhân, ngày sinh hoặc số điện thoại." },
        { status: 403 },
      );
    }
    return NextResponse.json({ data: mapPatient(cached) });
  }

  await enqueuePatientSync(mabn, "patient_profile");
  const started = Date.now();

  while (Date.now() - started < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const patient = await readPatientSnapshot(mabn);
    if (patient) {
      if (!canVerifyPatient(patient, parsed.data)) {
        return NextResponse.json(
          { error: "Không xác minh được hồ sơ. Vui lòng kiểm tra lại mã bệnh nhân, ngày sinh hoặc số điện thoại." },
          { status: 403 },
        );
      }
      return NextResponse.json({ data: mapPatient(patient) });
    }
  }

  return NextResponse.json(
    { error: "Đã yêu cầu đồng bộ hồ sơ cũ. Vui lòng bấm tìm lại sau vài giây." },
    { status: 202 },
  );
}
