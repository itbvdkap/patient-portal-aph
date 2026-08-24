alter table if exists portal_accounts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deleted_reason text,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists locked_reason text;

create index if not exists idx_portal_accounts_status_deleted_at
  on portal_accounts (status, deleted_at);

create index if not exists idx_portal_accounts_deleted_at
  on portal_accounts (deleted_at)
  where deleted_at is not null;
