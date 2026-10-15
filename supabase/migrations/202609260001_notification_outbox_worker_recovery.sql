-- Keep the worker's claim and reconciliation queries bounded as the outbox grows.
create index if not exists idx_notification_outbox_branch_pending
  on portal.notification_outbox (branch_code, run_after, id)
  where channel = 'zalo' and status in ('pending', 'retry');

create index if not exists idx_notification_outbox_branch_sent
  on portal.notification_outbox (branch_code, sent_at, appointment_id)
  where channel = 'zalo' and sent_at is not null;

create index if not exists idx_notification_outbox_branch_manual
  on portal.notification_outbox (branch_code, status, updated_at, id)
  where channel = 'zalo' and status in ('pending', 'retry', 'failed', 'sent') and sent_at is null;
