alter table portal.lich_hen_kham
  add column if not exists his_online_sync_status text not null default 'PENDING',
  add column if not exists his_online_booking_id bigint,
  add column if not exists his_online_sync_reason text,
  add column if not exists his_online_sync_attempt_count integer not null default 0,
  add column if not exists his_online_sync_checked_at timestamptz,
  add column if not exists his_online_sync_next_check_at timestamptz,
  add column if not exists his_online_synced_at timestamptz;

update portal.lich_hen_kham
set his_online_sync_status = 'PENDING'
where his_online_sync_status is null;

create index if not exists idx_lich_hen_kham_his_online_pending
  on portal.lich_hen_kham (branch_code, his_online_sync_status, his_online_sync_next_check_at, ngay_kham)
  where his_online_sync_status in ('PENDING', 'RETRY', 'NEEDS_REVIEW');

create index if not exists idx_lich_hen_kham_his_online_id
  on portal.lich_hen_kham (his_online_booking_id)
  where his_online_booking_id is not null;
