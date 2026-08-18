create table if not exists portal_otp_attempts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  phone_masked text,
  otp_hash text not null,
  provider text not null default 'test',
  status text not null default 'pending',
  send_result jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_otp_attempts_phone_pending
  on portal_otp_attempts (phone, created_at desc)
  where consumed_at is null;

create index if not exists idx_portal_otp_attempts_expires_at
  on portal_otp_attempts (expires_at);

alter table portal_otp_attempts enable row level security;
revoke all on portal_otp_attempts from anon, authenticated;
