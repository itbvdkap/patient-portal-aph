import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSessionCookie } from "@/lib/auth/demo-auth";
import { createPatientSessionCookie } from "@/lib/auth/session";
import { enqueuePatientSync, requestOnDemandLoginSync } from "@/lib/supabase/portal-sync";

const verifyLoginSchema = z.object({
  phone: z.string().trim().min(9).max(20),
  citizenId: z.string().trim().min(9).max(20),
});

interface VerifyLoginEnvelope {
  data: {
    hisPatientCode: string;
    fullName: string;
    phone: string;
  };
}

export async function POST(request: Request) {
  const parsed = verifyLoginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại và CCCD/CMND hợp lệ." }, { status: 400 });
  }

  const body =
    process.env.PATIENT_DATA_MODE === "supabase"
      ? await verifyWithSupabase(parsed.data.phone, parsed.data.citizenId)
      : await verifyWithPatientApi(parsed.data.phone, parsed.data.citizenId);

  if (!body) {
    return NextResponse.json({ error: "Không xác minh được thông tin đăng nhập." }, { status: 401 });
  }

  const maxAge = 60 * 60 * 8;
  const result = NextResponse.json({ data: body.data });

  result.cookies.set(demoSessionCookie, createPatientSessionCookie(body.data.hisPatientCode, maxAge), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  if (process.env.PATIENT_DATA_MODE === "supabase") {
    void enqueuePatientSync(body.data.hisPatientCode, "all").catch(() => undefined);
  }

  return result;
}

async function verifyWithPatientApi(phone: string, citizenId: string): Promise<VerifyLoginEnvelope | null> {
  const baseUrl = process.env.PATIENT_API_BASE_URL;
  const serverToken = process.env.PATIENT_API_SERVER_TOKEN;

  if (!baseUrl || !serverToken) {
    throw new Error("PATIENT_API_BASE_URL/PATIENT_API_SERVER_TOKEN is not configured.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/verify`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${serverToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, citizenId }),
  });

  const body = (await response.json().catch(() => null)) as VerifyLoginEnvelope | { error?: string } | null;

  if (!response.ok || !body || !("data" in body)) {
    return null;
  }

  return body;
}

async function verifyWithSupabase(phone: string, citizenId: string): Promise<VerifyLoginEnvelope | null> {
  const data = await requestOnDemandLoginSync(phone, citizenId);
  if (!data) return null;

  return {
    data: {
      hisPatientCode: data.hisPatientCode,
      fullName: data.fullName,
      phone: data.phone,
    },
  };
}
