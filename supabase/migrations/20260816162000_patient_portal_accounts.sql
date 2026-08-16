create table if not exists portal_accounts (
  account_key char(64) primary key,
  phone_masked varchar(30),
  primary_mabn varchar(20),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_account_profiles (
  account_key char(64) not null references portal_accounts(account_key) on delete cascade,
  mabn varchar(20) not null,
  display_name varchar(255),
  relationship varchar(50),
  is_default boolean not null default false,
  linked_at timestamptz not null default now(),
  last_selected_at timestamptz,
  primary key (account_key, mabn)
);

create index if not exists idx_portal_account_profiles_mabn
  on portal_account_profiles (mabn);

create table if not exists portal_account_sessions (
  session_id uuid primary key,
  account_key char(64) not null references portal_accounts(account_key) on delete cascade,
  mabn varchar(20) not null,
  current_mabn varchar(20),
  device_label varchar(80),
  user_agent text,
  ip_address varchar(80),
  signed_in_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_portal_account_sessions_account
  on portal_account_sessions (account_key, signed_in_at desc);

create index if not exists idx_portal_account_sessions_active
  on portal_account_sessions (account_key, revoked_at, expires_at)
  where revoked_at is null;

alter table portal_accounts enable row level security;
alter table portal_account_profiles enable row level security;
alter table portal_account_sessions enable row level security;

revoke all on portal_accounts from anon, authenticated;
revoke all on portal_account_profiles from anon, authenticated;
revoke all on portal_account_sessions from anon, authenticated;
