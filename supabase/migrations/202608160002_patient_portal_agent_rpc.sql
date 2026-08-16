create or replace function portal_claim_auth_attempt(p_worker_id text, p_lock_seconds integer default 120)
returns table(attempt_id uuid, lookup_hash char(64), encrypted_payload text)
language plpgsql
as $$
begin
  return query
  update portal_auth_attempts a
  set status = 'running',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => p_lock_seconds),
      updated_at = now()
  where a.attempt_id = (
    select x.attempt_id
    from portal_auth_attempts x
    where (x.status = 'queued' or (x.status = 'running' and x.locked_until < now()))
      and x.expires_at > now()
    order by x.created_at
    for update skip locked
    limit 1
  )
  returning a.attempt_id, a.lookup_hash, a.encrypted_payload;
end;
$$;

create or replace function portal_claim_sync_job(p_worker_id text, p_lock_seconds integer default 300)
returns table(job_id bigint, mabn varchar, resource_name varchar, resource_id varchar, maql varchar)
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
    order by x.priority, x.run_after, x.job_id
    for update skip locked
    limit 1
  )
  returning j.job_id, j.mabn, j.resource_name, j.resource_id, j.maql;
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
  p_next_sync_after timestamptz
)
returns void
language plpgsql
as $$
begin
  update portal_sync_jobs
  set status = p_status,
      finished_at = case when p_status in ('success', 'failed') then now() else finished_at end,
      locked_by = null,
      locked_until = null,
      error_message = p_error,
      updated_at = now()
  where job_id = p_job_id;

  insert into portal_sync_state(mabn, resource_name, mavaovien, maql, status, last_synced_at, next_sync_after, error_message)
  values (
    p_mabn,
    p_resource_name,
    p_resource_id,
    p_maql,
    p_status,
    case when p_status = 'success' then now() else null end,
    p_next_sync_after,
    p_error
  )
  on conflict (mabn, resource_name, (coalesce(mavaovien, '')), (coalesce(maql, ''))) do update set
    status = excluded.status,
    last_synced_at = coalesce(excluded.last_synced_at, portal_sync_state.last_synced_at),
    next_sync_after = excluded.next_sync_after,
    error_message = excluded.error_message,
    updated_at = now();
end;
$$;
