import "server-only";

import { Pool } from "pg";
import type { PatientBranchCode } from "@anphu/patient-domain";

const CONFIRMED_STATUSES = ["DA_XAC_NHAN", "DA_XAC_NHAN_HIS"];
const CANCELLED_STATUSES = ["DA_HUY", "HOSPITAL_CANCELLED"];

export type OnlineRegistrationSummary = {
  available: boolean;
  total: number;
  confirmed: number;
  unconfirmed: number;
  cancelled: number;
};

export type OnlineRegistrationLookup = {
  mabn?: string | null;
  branchCode: PatientBranchCode;
  accountKeys?: Array<string | null | undefined>;
};

const EMPTY_SUMMARY: OnlineRegistrationSummary = {
  available: false,
  total: 0,
  confirmed: 0,
  unconfirmed: 0,
  cancelled: 0,
};

let bookingPool: Pool | null = null;

function getBookingPool() {
  const connectionString = process.env.BOOKING_DATABASE_URL;
  if (!connectionString) return null;

  bookingPool ??= new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  return bookingPool;
}

function asCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export async function getOnlineRegistrationSummary(lookup: OnlineRegistrationLookup): Promise<OnlineRegistrationSummary> {
  const pool = getBookingPool();
  const mabn = String(lookup.mabn ?? "").trim();
  const accountKeys = [...new Set((lookup.accountKeys ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))];

  if (!pool || (!mabn && accountKeys.length === 0)) return EMPTY_SUMMARY;

  try {
    const { rows } = await pool.query<{
      total: number;
      confirmed: number;
      unconfirmed: number;
      cancelled: number;
    }>(
      `
        with scoped_bookings as (
          select upper(trim(coalesce(status, 'CHO_DUYET'))) as normalized_status
          from portal.lich_hen_kham
          where coalesce(branch_code, 'CN1') = $1
            and (
              ($2::text <> '' and nullif(trim(patient_code), '') = $2)
              or (
                cardinality($3::text[]) > 0
                and nullif(trim(patient_code), '') is null
                and account_key = any($3::text[])
              )
            )
        )
        select
          count(*) filter (where normalized_status <> all($5::text[]))::int as total,
          count(*) filter (where normalized_status = any($4::text[]))::int as confirmed,
          count(*) filter (where normalized_status <> all($4::text[]) and normalized_status <> all($5::text[]))::int as unconfirmed,
          count(*) filter (where normalized_status = any($5::text[]))::int as cancelled
        from scoped_bookings
      `,
      [lookup.branchCode, mabn, accountKeys, CONFIRMED_STATUSES, CANCELLED_STATUSES],
    );

    const row = rows[0];
    return {
      available: true,
      total: asCount(row?.total),
      confirmed: asCount(row?.confirmed),
      unconfirmed: asCount(row?.unconfirmed),
      cancelled: asCount(row?.cancelled),
    };
  } catch (error) {
    console.warn("[registrations] Could not load online registration summary", error);
    return EMPTY_SUMMARY;
  }
}
