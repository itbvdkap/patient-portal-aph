create extension if not exists "pgcrypto";

create table if not exists portal_patients (
  mabn varchar(20) primary key,
  full_name varchar(255) not null,
  birth_date date,
  gender varchar(20),
  phone varchar(30),
  address text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_auth_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  lookup_hash char(64) not null,
  encrypted_payload text not null,
  status varchar(30) not null default 'queued',
  mabn varchar(20),
  result_json jsonb,
  error_message text,
  locked_by varchar(100),
  locked_until timestamptz,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_auth_attempts_pickup
  on portal_auth_attempts (status, created_at)
  where status in ('queued', 'running');

create index if not exists idx_portal_auth_attempts_lookup
  on portal_auth_attempts (lookup_hash, created_at desc);

create table if not exists portal_login_lookup (
  lookup_hash char(64) primary key,
  mabn varchar(20) not null,
  payload_json jsonb not null,
  synced_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists portal_resource_snapshots (
  cache_key varchar(255) primary key,
  mabn varchar(20) not null,
  resource_name varchar(80) not null,
  resource_id varchar(100),
  payload_json jsonb not null,
  synced_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_resource_snapshots_patient
  on portal_resource_snapshots (mabn, resource_name, resource_id);

create table if not exists portal_sync_state (
  id bigserial primary key,
  mabn varchar(20) not null,
  resource_name varchar(80) not null,
  mavaovien varchar(100),
  maql varchar(30),
  status varchar(30) not null,
  last_synced_at timestamptz,
  next_sync_after timestamptz,
  error_message text,
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_portal_sync_state_key
  on portal_sync_state (mabn, resource_name, coalesce(mavaovien, ''), coalesce(maql, ''));

create table if not exists portal_sync_jobs (
  job_id bigserial primary key,
  mabn varchar(20) not null,
  resource_name varchar(80) not null,
  resource_id varchar(100),
  maql varchar(30),
  priority integer not null default 100,
  status varchar(30) not null default 'queued',
  requested_by varchar(100),
  requested_reason varchar(255),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  locked_by varchar(100),
  locked_until timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_sync_jobs_pickup
  on portal_sync_jobs (status, priority, run_after)
  where status = 'queued';

create index if not exists idx_portal_sync_jobs_patient
  on portal_sync_jobs (mabn, resource_name, resource_id, maql, status);

create table if not exists portal_audit_logs (
  audit_id bigserial primary key,
  user_id varchar(100),
  mabn varchar(20),
  action varchar(100) not null,
  resource_name varchar(100),
  resource_id varchar(120),
  ip_address varchar(80),
  user_agent text,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

alter table portal_patients enable row level security;
alter table portal_auth_attempts enable row level security;
alter table portal_login_lookup enable row level security;
alter table portal_resource_snapshots enable row level security;
alter table portal_sync_state enable row level security;
alter table portal_sync_jobs enable row level security;
alter table portal_audit_logs enable row level security;

revoke all on portal_patients from anon, authenticated;
revoke all on portal_auth_attempts from anon, authenticated;
revoke all on portal_login_lookup from anon, authenticated;
revoke all on portal_resource_snapshots from anon, authenticated;
revoke all on portal_sync_state from anon, authenticated;
revoke all on portal_sync_jobs from anon, authenticated;
revoke all on portal_audit_logs from anon, authenticated;
