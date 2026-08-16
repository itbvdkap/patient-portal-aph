create or replace function portal_enqueue_sync_job(
  p_mabn varchar,
  p_resource_name varchar default 'all',
  p_resource_id varchar default null,
  p_maql varchar default null,
  p_requested_by varchar default 'portal',
  p_requested_reason varchar default 'on-demand patient access'
)
returns bigint
language plpgsql
as $$
declare
  existing_job_id bigint;
  new_job_id bigint;
begin
  select job_id
  into existing_job_id
  from portal_sync_jobs
  where mabn = p_mabn
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
    resource_name,
    resource_id,
    maql,
    status,
    requested_by,
    requested_reason
  )
  values (
    p_mabn,
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
