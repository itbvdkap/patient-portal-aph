alter table portal_accounts
  add column if not exists id uuid,
  add column if not exists phone text,
  add column if not exists display_name text;

update portal_accounts
set id = account_key::uuid
where id is null
  and account_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

alter table portal_account_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists account_id uuid,
  add column if not exists patient_name text,
  add column if not exists birth_date date,
  add column if not exists is_active boolean not null default false,
  add column if not exists verified_at timestamptz;

update portal_account_profiles
set account_id = portal_accounts.id
from portal_accounts
where portal_account_profiles.account_id is null
  and portal_account_profiles.account_key = portal_accounts.account_key
  and portal_accounts.id is not null;

update portal_account_profiles
set patient_name = coalesce(patient_name, display_name),
    verified_at = coalesce(verified_at, linked_at)
where patient_name is null
   or verified_at is null;

create unique index if not exists ux_portal_accounts_id
  on portal_accounts (id)
  where id is not null;

create index if not exists idx_portal_account_profiles_account_id
  on portal_account_profiles (account_id, linked_at)
  where account_id is not null;

create unique index if not exists ux_portal_account_profiles_account_mabn
  on portal_account_profiles (account_id, mabn)
  where account_id is not null;

alter table portal_account_sessions
  add column if not exists account_id uuid;

update portal_account_sessions
set account_id = portal_accounts.id
from portal_accounts
where portal_account_sessions.account_id is null
  and portal_account_sessions.account_key = portal_accounts.account_key
  and portal_accounts.id is not null;

create index if not exists idx_portal_account_sessions_account_id
  on portal_account_sessions (account_id, signed_in_at desc)
  where account_id is not null;

create table if not exists portal_login_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid,
  session_id uuid,
  phone_masked text,
  event_type text not null default 'login',
  device_label text,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_login_events_account
  on portal_login_events (account_id, created_at desc);

alter table portal_login_events enable row level security;
revoke all on portal_login_events from anon, authenticated;
