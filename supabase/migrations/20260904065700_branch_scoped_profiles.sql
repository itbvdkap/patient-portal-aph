alter table portal_account_profiles
  add column if not exists branch_code text,
  add column if not exists branch_name text;

update portal_account_profiles
set branch_code = 'CN1'
where branch_code is null;

update portal_account_profiles profile
set branch_name = branch.branch_name
from portal.branches branch
where profile.branch_code = branch.branch_code
  and profile.branch_name is null;

alter table portal_account_profiles
  alter column branch_code set not null,
  add constraint fk_portal_account_profiles_branch
    foreign key (branch_code) references portal.branches(branch_code);

create index if not exists idx_portal_account_profiles_branch_mabn
  on portal_account_profiles (branch_code, mabn);

alter table portal_account_profiles
  drop constraint if exists portal_account_profiles_pkey;

drop index if exists ux_portal_account_profiles_account_mabn;

alter table portal_account_profiles
  add constraint portal_account_profiles_pkey primary key (account_key, branch_code, mabn);

create unique index if not exists ux_portal_account_profiles_account_branch_mabn
  on portal_account_profiles (account_key, branch_code, mabn);

create unique index if not exists ux_portal_account_profiles_account_id_branch_mabn
  on portal_account_profiles (account_id, branch_code, mabn)
  where account_id is not null;

alter table portal_account_sessions
  add column if not exists current_branch_code text;

update portal_account_sessions
set current_branch_code = 'CN1'
where current_branch_code is null
  and coalesce(current_mabn, mabn) is not null;

alter table portal_account_sessions
  add constraint fk_portal_account_sessions_current_branch
    foreign key (current_branch_code) references portal.branches(branch_code);

alter table portal_resource_snapshots
  add column if not exists branch_code text;

update portal_resource_snapshots
set branch_code = 'CN1'
where branch_code is null;

alter table portal_resource_snapshots
  alter column branch_code set not null,
  add constraint fk_portal_resource_snapshots_branch
    foreign key (branch_code) references portal.branches(branch_code);

create index if not exists idx_portal_resource_snapshots_branch_patient
  on portal_resource_snapshots (branch_code, mabn, resource_name, resource_id);

alter table portal_sync_jobs
  add column if not exists branch_code text;

update portal_sync_jobs
set branch_code = 'CN1'
where branch_code is null;

alter table portal_sync_jobs
  alter column branch_code set not null,
  add constraint fk_portal_sync_jobs_branch
    foreign key (branch_code) references portal.branches(branch_code);

create index if not exists idx_portal_sync_jobs_branch_pickup
  on portal_sync_jobs (branch_code, status, run_after, priority, job_id);

alter table portal_sync_state
  add column if not exists branch_code text;

update portal_sync_state
set branch_code = 'CN1'
where branch_code is null;

alter table portal_sync_state
  alter column branch_code set not null,
  add constraint fk_portal_sync_state_branch
    foreign key (branch_code) references portal.branches(branch_code);

create unique index if not exists ux_portal_sync_state_branch_key
  on portal_sync_state (branch_code, mabn, resource_name, coalesce(mavaovien, ''), coalesce(maql, ''));

create or replace function portal_enqueue_sync_job(
  p_mabn varchar,
  p_resource_name varchar default 'all',
  p_resource_id varchar default null,
  p_maql varchar default null,
  p_requested_by varchar default 'portal',
  p_requested_reason varchar default 'on-demand patient access',
  p_branch_code text default 'CN1'
)
returns bigint
language plpgsql
as $$
declare
  existing_job_id bigint;
  new_job_id bigint;
  normalized_branch text := coalesce(nullif(trim(p_branch_code), ''), 'CN1');
begin
  if not exists (select 1 from portal.branches where branch_code = normalized_branch and is_active = true) then
    raise exception 'Invalid branch_code: %', normalized_branch;
  end if;

  select job_id
  into existing_job_id
  from portal_sync_jobs
  where mabn = p_mabn
    and branch_code = normalized_branch
    and resource_name = p_resource_name
    and coalesce(resource_id, '') = coalesce(p_resource_id, '')
    and coalesce(maql, '') = coalesce(p_maql, '')
    and status in ('queued', 'running')
    and attempt_count < max_attempts
  order by priority, run_after, job_id
  limit 1;

  if existing_job_id is not null then
    return existing_job_id;
  end if;

  insert into portal_sync_jobs(
    mabn,
    branch_code,
    resource_name,
    resource_id,
    maql,
    status,
    requested_by,
    requested_reason
  )
  values (
    p_mabn,
    normalized_branch,
    p_resource_name,
    p_resource_id,
    p_maql,
    'queued',
    p_requested_by,
    p_requested_reason
  )
  returning job_id into new_job_id;

  return new_job_id;
end;
$$;

create or replace function portal_claim_sync_job(p_worker_id text, p_lock_seconds integer default 300, p_branch_code text default null)
returns table(job_id bigint, mabn varchar, branch_code text, resource_name varchar, resource_id varchar, maql varchar)
language plpgsql
as $$
begin
  return query
  update portal_sync_jobs j
  set status = 'running',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => p_lock_seconds),
      started_at = coalesce(j.started_at, now()),
      attempt_count = j.attempt_count + 1,
      updated_at = now()
  where j.job_id = (
    select x.job_id
    from portal_sync_jobs x
    where (x.status = 'queued' or (x.status = 'running' and x.locked_until < now()))
      and x.run_after <= now()
      and x.attempt_count < x.max_attempts
      and (p_branch_code is null or x.branch_code = p_branch_code)
    order by x.priority, x.run_after, x.job_id
    for update skip locked
    limit 1
  )
  returning j.job_id, j.mabn, j.branch_code, j.resource_name, j.resource_id, j.maql;
end;
$$;

create or replace function portal_complete_sync_job(
  p_job_id bigint,
  p_mabn varchar,
  p_resource_name varchar,
  p_resource_id varchar,
  p_maql varchar,
  p_status varchar,
  p_error text,
  p_next_sync_after timestamptz,
  p_branch_code text default 'CN1'
)
returns void
language plpgsql
as $$
declare
  normalized_branch text := coalesce(nullif(trim(p_branch_code), ''), 'CN1');
begin
  update portal_sync_jobs
  set status = p_status,
      finished_at = case when p_status in ('success', 'failed') then now() else finished_at end,
      locked_by = null,
      locked_until = null,
      error_message = p_error,
      updated_at = now()
  where job_id = p_job_id;

  insert into portal_sync_state(branch_code, mabn, resource_name, mavaovien, maql, status, last_synced_at, next_sync_after, error_message)
  values (
    normalized_branch,
    p_mabn,
    p_resource_name,
    p_resource_id,
    p_maql,
    p_status,
    case when p_status = 'success' then now() else null end,
    p_next_sync_after,
    p_error
  )
  on conflict (branch_code, mabn, resource_name, (coalesce(mavaovien, '')), (coalesce(maql, ''))) do update set
    status = excluded.status,
    last_synced_at = coalesce(excluded.last_synced_at, portal_sync_state.last_synced_at),
    next_sync_after = excluded.next_sync_after,
    error_message = excluded.error_message,
    updated_at = now();
end;
$$;
