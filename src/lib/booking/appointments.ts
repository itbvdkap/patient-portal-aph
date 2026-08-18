import crypto from "crypto";
import { Pool } from "pg";

const ACTIVE_APPOINTMENT_STATUSES = ["CHO_DUYET", "CHO_DUYET_LAI", "DA_XAC_NHAN"];

type BookingAppointmentInput = {
  oldPatientCode?: string;
  fullName: string;
  phone: string;
  email?: string;
  birthDate?: string;
  gender?: string;
  weight?: string;
  province?: string;
  ward?: string;
  address?: string;
  branch?: string;
  soCCCD?: string;
  ngayCap?: string;
  appointmentDate: string;
  appointmentTime?: string;
  department?: string;
  symptoms?: string;
  hasInsurance?: boolean;
  bacsikham?: string;
  ghichu?: string;
};

type BookingAppointmentRecord = {
  id: string;
  ma_lich_hen: string | null;
  ho_ten: string | null;
  ngay_kham: string | null;
  chi_nhanh: string | null;
};

class DuplicateAppointmentError extends Error {
  code = "DUPLICATE_ACTIVE_APPOINTMENT";
}

let bookingPool: Pool | null = null;

function getBookingPool() {
  const connectionString = process.env.BOOKING_DATABASE_URL;

  if (!connectionString) {
    throw new Error("Missing BOOKING_DATABASE_URL.");
  }

  bookingPool ??= new Pool({
    connectionString,
    max: 3,
    ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  return bookingPool;
}

function cleanString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizePhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function dateKey(raw: string | null | undefined) {
  const value = cleanString(raw);
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const vn = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (vn) {
    const year = vn[3].length === 2 ? `20${vn[3]}` : vn[3];
    return `${year}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
  }

  return value;
}

function hashSHA256(text: string) {
  return crypto.createHash("sha256").update(text.trim()).digest("hex");
}

function encrypt(text: string) {
  if (!text) return "";
  const secret = process.env.BOOKING_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "fallback-secure-encryption-key-32b";
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function branchCode(branch: string | null) {
  const value = branch ?? "";
  if (value.includes("CN2") || value.includes("CN 2") || value.includes("Chi nhánh 2") || value.includes("VSIP II")) {
    return "2";
  }
  if (value.includes("CN3") || value.includes("CN 3") || value.includes("Chi nhánh 3") || value.includes("Đồng Nai")) {
    return "3";
  }
  return "1";
}

function makeBookingCode(branch: string | null) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AP${branchCode(branch)}${yy}${mm}${rand}`;
}

async function assertNoActiveDuplicate({
  cccdHash,
  phone,
  appointmentDate,
}: {
  cccdHash: string;
  phone: string;
  appointmentDate: string;
}) {
  const pool = getBookingPool();
  const normalizedPhone = normalizePhone(phone);

  const { rows } = await pool.query<{
    id: string;
    ma_lich_hen: string | null;
    so_dien_thoai: string | null;
  }>(
    `
      select id, ma_lich_hen, so_dien_thoai
      from portal.lich_hen_kham
      where "soCCCD_hash" = $1
        and ngay_kham = $2::date
        and status = any($3::text[])
    `,
    [cccdHash, appointmentDate, ACTIVE_APPOINTMENT_STATUSES],
  );

  const duplicate = rows.find((appointment) => normalizePhone(appointment.so_dien_thoai) === normalizedPhone);
  if (duplicate) {
    const code = duplicate.ma_lich_hen ? ` (mã lịch ${duplicate.ma_lich_hen})` : "";
    throw new DuplicateAppointmentError(`Bạn đã có lịch khám đang hiệu lực vào ngày ${appointmentDate}${code}.`);
  }
}

export async function createBookingAppointment(input: BookingAppointmentInput) {
  const pool = getBookingPool();
  const oldPatientCode = cleanString(input.oldPatientCode);
  const rawCccd = cleanString(input.soCCCD) ?? "";
  const identityHashSource = rawCccd || (oldPatientCode ? `MABN:${oldPatientCode}` : "");
  const cccdHash = identityHashSource ? hashSHA256(identityHashSource) : "";
  const appointmentDate = dateKey(input.appointmentDate);
  const birthDate = dateKey(input.birthDate);
  const issueDate = dateKey(input.ngayCap);
  const branch = cleanString(input.branch);

  if (!appointmentDate) {
    throw new Error("Missing appointment date.");
  }

  if (cccdHash) {
    await assertNoActiveDuplicate({
      cccdHash,
      phone: input.phone,
      appointmentDate,
    });
  }

  const baseRecord = {
    ho_ten: cleanString(input.fullName),
    so_dien_thoai: cleanString(input.phone),
    email: cleanString(input.email),
    ngay_sinh: birthDate,
    gioi_tinh: cleanString(input.gender),
    dia_chi: cleanString(input.address),
    ngay_kham: appointmentDate,
    gio_kham: cleanString(input.appointmentTime),
    khoa_kham: cleanString(input.department),
    trieu_chung: cleanString(input.symptoms),
    co_bao_hiem: Boolean(input.hasInsurance),
    bacsikham: cleanString(input.bacsikham),
    ghichu: [oldPatientCode ? `Mã BN cũ: ${oldPatientCode}` : "", cleanString(input.ghichu)].filter(Boolean).join(" - ") || null,
    can_nang: input.weight ? Number(input.weight) : null,
    tinh_thanh: cleanString(input.province),
    phuong_xa: cleanString(input.ward),
    chi_nhanh: branch,
    ngayCap: issueDate,
    trang_thai: false,
    soCCCD: null,
    soCCCD_encrypt: rawCccd ? encrypt(rawCccd) : null,
    soCCCD_hash: cccdHash || null,
    status: "CHO_DUYET",
  };

  let created: BookingAppointmentRecord | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const maLichHen = makeBookingCode(branch);

    try {
      const { rows } = await pool.query<BookingAppointmentRecord>(
        `
          insert into portal.lich_hen_kham (
            ho_ten,
            so_dien_thoai,
            email,
            ngay_sinh,
            gioi_tinh,
            dia_chi,
            ngay_kham,
            gio_kham,
            khoa_kham,
            trieu_chung,
            co_bao_hiem,
            bacsikham,
            ghichu,
            can_nang,
            tinh_thanh,
            phuong_xa,
            chi_nhanh,
            "ngayCap",
            trang_thai,
            "soCCCD",
            "soCCCD_encrypt",
            "soCCCD_hash",
            status,
            ma_lich_hen
          )
          values (
            $1,
            $2,
            $3,
            $4::date,
            $5,
            $6,
            $7::date,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18::date,
            $19,
            $20,
            $21,
            $22,
            $23,
            $24
          )
          returning id, ma_lich_hen, ho_ten, ngay_kham::text, chi_nhanh
        `,
        [
          baseRecord.ho_ten,
          baseRecord.so_dien_thoai,
          baseRecord.email,
          baseRecord.ngay_sinh,
          baseRecord.gioi_tinh,
          baseRecord.dia_chi,
          baseRecord.ngay_kham,
          baseRecord.gio_kham,
          baseRecord.khoa_kham,
          baseRecord.trieu_chung,
          baseRecord.co_bao_hiem,
          baseRecord.bacsikham,
          baseRecord.ghichu,
          baseRecord.can_nang,
          baseRecord.tinh_thanh,
          baseRecord.phuong_xa,
          baseRecord.chi_nhanh,
          baseRecord.ngayCap,
          baseRecord.trang_thai,
          baseRecord.soCCCD,
          baseRecord.soCCCD_encrypt,
          baseRecord.soCCCD_hash,
          baseRecord.status,
          maLichHen,
        ],
      );

      created = rows[0] ?? null;
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("duplicate key")) {
        throw error;
      }
    }
  }

  if (!created) {
    throw lastError instanceof Error ? lastError : new Error("Không tạo được mã lịch hẹn duy nhất.");
  }

  try {
    await pool.query(
      `
        insert into portal.lich_hen_kham_history (
          appointment_id,
          action,
          performed_by,
          old_status,
          new_status,
          changed_fields
        )
        values ($1, 'DANG_KY', 'PATIENT', null, 'CHO_DUYET', $2::jsonb)
      `,
      [
        created.id,
        JSON.stringify({
          ho_ten: created.ho_ten,
          ngay_kham: created.ngay_kham,
          chi_nhanh: created.chi_nhanh,
          source: "patient_portal",
        }),
      ],
    );
  } catch (historyError) {
    console.warn("[booking] Appointment created but history insert failed", historyError);
  }

  return {
    message: "Bệnh viện đã tiếp nhận thông tin đăng ký khám.",
    data: created,
  };
}

export function isDuplicateAppointmentError(error: unknown) {
  return error instanceof DuplicateAppointmentError || (error instanceof Error && "code" in error && error.code === "DUPLICATE_ACTIVE_APPOINTMENT");
}
