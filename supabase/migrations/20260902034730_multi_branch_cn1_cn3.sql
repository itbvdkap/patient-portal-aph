create table if not exists portal.branches (
  branch_code text primary key,
  branch_name text not null,
  short_name text not null,
  location_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_portal_branches_code check (branch_code ~ '^CN[0-9]+$')
);

insert into portal.branches (branch_code, branch_name, short_name, location_name, is_active)
values
  ('CN1', 'Bệnh viện An Phú - Chi nhánh 1', 'An Phú CN1', 'Thuận An', true),
  ('CN2', 'Bệnh viện An Phú - Chi nhánh 2', 'An Phú CN2', 'VSIP II', false),
  ('CN3', 'Phòng khám An Phú - Chi nhánh 3', 'An Phú CN3', 'Đồng Nai', true)
on conflict (branch_code) do update set
  branch_name = excluded.branch_name,
  short_name = excluded.short_name,
  location_name = excluded.location_name,
  is_active = excluded.is_active,
  updated_at = now();

alter table portal.lich_hen_kham
  add column if not exists branch_code text,
  add column if not exists account_key text;

update portal.lich_hen_kham
set branch_code = case
  when upper(coalesce(chi_nhanh, '')) like '%CN3%'
    or lower(coalesce(chi_nhanh, '')) like '%đồng nai%' then 'CN3'
  when upper(coalesce(chi_nhanh, '')) like '%CN2%'
    or upper(coalesce(chi_nhanh, '')) like '%VSIP II%' then 'CN2'
  else 'CN1'
end
where branch_code is null;

update portal.lich_hen_kham booking
set chi_nhanh = branch.branch_name
from portal.branches branch
where booking.branch_code = branch.branch_code
  and booking.chi_nhanh is distinct from branch.branch_name;

alter table portal.lich_hen_kham
  alter column branch_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_lich_hen_kham_branch'
      and conrelid = 'portal.lich_hen_kham'::regclass
  ) then
    alter table portal.lich_hen_kham
      add constraint fk_lich_hen_kham_branch
        foreign key (branch_code) references portal.branches(branch_code);
  end if;
end;
$$;

create index if not exists idx_lich_hen_kham_branch_pending
  on portal.lich_hen_kham (branch_code, his_match_status, his_match_next_check_at, ngay_kham);

alter table portal.booking_his_matches
  add column if not exists branch_code text references portal.branches(branch_code);

alter table portal.notification_outbox
  add column if not exists branch_code text references portal.branches(branch_code);

update portal.booking_his_matches match
set branch_code = booking.branch_code
from portal.lich_hen_kham booking
where match.appointment_id = booking.id
  and match.branch_code is null;

update portal.notification_outbox notification
set branch_code = booking.branch_code
from portal.lich_hen_kham booking
where notification.appointment_id = booking.id
  and notification.branch_code is null;

create table if not exists portal_patient_branch_mappings (
  id uuid primary key default gen_random_uuid(),
  account_key text,
  identity_hash text,
  branch_code text not null references portal.branches(branch_code),
  his_mabn text not null,
  patient_name text,
  source text not null default 'booking_his_match',
  verified_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_patient_branch_mapping_owner
    check (nullif(account_key, '') is not null or nullif(identity_hash, '') is not null)
);

create unique index if not exists ux_patient_branch_mapping_account
  on portal_patient_branch_mappings (account_key, branch_code, his_mabn)
  where account_key is not null;

create unique index if not exists ux_patient_branch_mapping_identity
  on portal_patient_branch_mappings (identity_hash, branch_code, his_mabn)
  where identity_hash is not null;

create index if not exists idx_patient_branch_mapping_his
  on portal_patient_branch_mappings (branch_code, his_mabn);

create unique index if not exists ux_patient_branch_mapping_identity_owner
  on portal_patient_branch_mappings (
    coalesce(account_key, ''),
    coalesce(identity_hash, ''),
    branch_code,
    his_mabn
  );

alter table portal.branches enable row level security;
alter table portal_patient_branch_mappings enable row level security;

revoke all on portal.branches from anon, authenticated;
revoke all on portal_patient_branch_mappings from anon, authenticated;
