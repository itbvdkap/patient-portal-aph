alter table portal_accounts
  add column if not exists full_name text,
  add column if not exists password_hash text,
  add column if not exists password_set_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists status text not null default 'active';

alter table portal_otp_attempts
  add column if not exists purpose text not null default 'login';

create index if not exists idx_portal_accounts_phone
  on portal_accounts (phone);

create index if not exists idx_portal_otp_attempts_phone_purpose_pending
  on portal_otp_attempts (phone, purpose, created_at desc)
  where consumed_at is null;
