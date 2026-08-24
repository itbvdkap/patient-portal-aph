alter table portal.lich_hen_kham
  add column if not exists old_patient_code text,
  add column if not exists his_mabn text,
  add column if not exists his_mavaovien text,
  add column if not exists his_maql text,
  add column if not exists his_stt_kham text,
  add column if not exists his_makp text,
  add column if not exists his_department_name text,
  add column if not exists his_doctor_name text,
  add column if not exists his_registered_at timestamptz,
  add column if not exists his_match_status text not null default 'PENDING',
  add column if not exists his_match_confidence numeric(5,2),
  add column if not exists his_match_reason text,
  add column if not exists his_match_checked_at timestamptz,
  add column if not exists his_match_attempt_count integer not null default 0,
  add column if not exists his_match_next_check_at timestamptz,
  add column if not exists his_matched_at timestamptz,
  add column if not exists zalo_confirm_sent_at timestamptz;

update portal.lich_hen_kham
set old_patient_code = coalesce(old_patient_code, patient_code)
where old_patient_code is null
  and patient_code is not null;

create table if not exists portal.booking_his_matches (
  id bigserial primary key,
  appointment_id uuid not null references portal.lich_hen_kham(id) on delete cascade,
  online_booking_code text,
  online_patient_code text,
  his_mabn text,
  his_mavaovien text,
  his_maql text,
  his_stt_kham text,
  his_makp text,
  his_department_name text,
  his_doctor_name text,
  his_registered_at timestamptz,
  match_status text not null default 'MATCHED',
  match_confidence numeric(5,2),
  match_reason text,
  source_schema text,
  raw_his_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_booking_his_matches_appointment
  on portal.booking_his_matches (appointment_id);

create index if not exists idx_booking_his_matches_his_keys
  on portal.booking_his_matches (his_mabn, his_mavaovien, his_maql);

create index if not exists idx_lich_hen_kham_his_match_pending
  on portal.lich_hen_kham (his_match_status, his_match_next_check_at, ngay_kham, status)
  where his_match_status in ('PENDING', 'RETRY', 'NEEDS_REVIEW');

create index if not exists idx_lich_hen_kham_old_patient_date
  on portal.lich_hen_kham (old_patient_code, ngay_kham)
  where old_patient_code is not null;

create table if not exists portal.notification_outbox (
  id bigserial primary key,
  channel text not null default 'zalo',
  recipient_phone text not null,
  template_key text not null,
  template_id text,
  appointment_id uuid references portal.lich_hen_kham(id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_until timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_outbox_pending
  on portal.notification_outbox (status, run_after, id)
  where status in ('pending', 'retry');

create index if not exists idx_notification_outbox_appointment
  on portal.notification_outbox (appointment_id);

create unique index if not exists ux_notification_outbox_booking_template_pending_sent
  on portal.notification_outbox (appointment_id, channel, template_key)
  where appointment_id is not null
    and status in ('pending', 'retry', 'sent');

alter table portal.booking_his_matches enable row level security;
alter table portal.notification_outbox enable row level security;

revoke all on portal.booking_his_matches from anon, authenticated;
revoke all on portal.notification_outbox from anon, authenticated;
