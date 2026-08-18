import { NextResponse } from "next/server";
import { z } from "zod";
import { createBookingAppointment, isDuplicateAppointmentError } from "@/lib/booking/appointments";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export const runtime = "nodejs";

const appointmentSchema = z.object({
  oldPatientCode: z.string().trim().max(20).optional().or(z.literal("")),
  fullName: z.string().trim().min(2, "Vui lòng nhập họ tên"),
  phone: z.string().trim().min(9, "Vui lòng nhập số điện thoại"),
  email: z.string().trim().email("Email chưa đúng định dạng").optional().or(z.literal("")),
  birthDate: z.string().trim().optional().or(z.literal("")),
  gender: z.string().trim().optional().or(z.literal("")),
  weight: z.string().trim().optional().or(z.literal("")),
  province: z.string().trim().optional().or(z.literal("")),
  ward: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  branch: z.string().trim().optional().or(z.literal("")),
  soCCCD: z.string().trim().optional().or(z.literal("")),
  ngayCap: z.string().trim().optional().or(z.literal("")),
  appointmentDate: z.string().trim().min(1, "Vui lòng chọn ngày khám"),
  appointmentTime: z.string().trim().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
  symptoms: z.string().trim().optional().or(z.literal("")),
  hasInsurance: z.boolean().optional(),
  bacsikham: z.string().trim().optional().or(z.literal("")),
  ghichu: z.string().trim().optional().or(z.literal("")),
  cf_turnstile_response: z.string().trim().optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (!value.oldPatientCode && (!value.soCCCD || value.soCCCD.length < 6)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["soCCCD"],
      message: "Vui lòng nhập CCCD/CMND hoặc chọn hồ sơ bệnh nhân cũ.",
    });
  }
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = appointmentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Thông tin đăng ký chưa đầy đủ.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const turnstile = await verifyTurnstileToken(parsed.data.cf_turnstile_response, request);
    if (!turnstile.ok) {
      return NextResponse.json({ message: turnstile.message }, { status: 403 });
    }

    const result = await createBookingAppointment(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isDuplicateAppointmentError(error)) {
      return NextResponse.json(
        {
          message: error instanceof Error ? error.message : "Bạn đã có lịch khám đang hiệu lực.",
          code: "DUPLICATE_ACTIVE_APPOINTMENT",
        },
        { status: 409 },
      );
    }

    console.error("[booking] Failed to create appointment", error);
    return NextResponse.json(
      {
        message: "Chưa kết nối được hệ thống đăng ký khám. Vui lòng thử lại sau.",
      },
      { status: 502 },
    );
  }
}
