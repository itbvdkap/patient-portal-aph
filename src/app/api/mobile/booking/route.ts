import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createBookingAppointment, isDuplicateAppointmentError } from "@/lib/booking/appointments";
import { getDemoPatientSession } from "@/lib/auth/session";

const schema = z.object({
  oldPatientCode: z.string().trim().max(20).optional().or(z.literal("")),
  fullName: z.string().trim().min(2), phone: z.string().trim().min(9), email: z.string().trim().email().optional().or(z.literal("")),
  birthDate: z.string().trim().optional().or(z.literal("")), gender: z.string().trim().optional().or(z.literal("")), address: z.string().trim().optional().or(z.literal("")),
  branch: z.string().trim().optional().or(z.literal("")), soCCCD: z.string().trim().optional().or(z.literal("")), ngayCap: z.string().trim().optional().or(z.literal("")),
  appointmentDate: z.string().trim().min(1), appointmentTime: z.string().trim().optional().or(z.literal("")), department: z.string().trim().optional().or(z.literal("")),
  symptoms: z.string().trim().optional().or(z.literal("")), hasInsurance: z.boolean().optional(), bacsikham: z.string().trim().optional().or(z.literal("")), ghichu: z.string().trim().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const session = getDemoPatientSession(await cookies());
  if (!session?.accountId && !session?.accountKey) return NextResponse.json({ message: "Vui lòng đăng nhập trước khi đăng ký khám." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Thông tin đăng ký chưa đầy đủ." }, { status: 400 });
  try {
    const result = await createBookingAppointment(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isDuplicateAppointmentError(error)) return NextResponse.json({ message: error instanceof Error ? error.message : "Bạn đã có lịch khám đang hiệu lực." }, { status: 409 });
    console.error("[mobile booking] failed", error);
    return NextResponse.json({ message: "Chưa kết nối được hệ thống đăng ký khám." }, { status: 502 });
  }
}
