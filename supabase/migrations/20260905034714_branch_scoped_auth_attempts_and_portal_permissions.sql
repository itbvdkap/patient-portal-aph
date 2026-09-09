-- Route authentication/profile-link jobs to the correct hospital branch.
-- Existing historical rows predate multi-branch support and belong to CN1.
alter table public.portal_auth_attempts
  add column if not exists branch_code text;

update public.portal_auth_attempts
set branch_code = 'CN1'
where branch_code is null;

alter table public.portal_auth_attempts
  alter column branch_code set default 'CN1',
  alter column branch_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_portal_auth_attempts_branch'
      and conrelid = 'public.portal_auth_attempts'::regclass
  ) then
    alter table public.portal_auth_attempts
      add constraint fk_portal_auth_attempts_branch
      foreign key (branch_code) references portal.branches(branch_code);
  end if;
end;
$$;

drop index if exists public.idx_portal_auth_attempts_pickup;

create index idx_portal_auth_attempts_branch_pickup
  on public.portal_auth_attempts (branch_code, status, created_at)
  where status in ('queued', 'running');

-- The old two-argument RPC must be removed so outdated agents cannot claim
-- another branch's authentication jobs. New agents always pass p_branch_code.
drop function if exists public.portal_claim_auth_attempt(text, integer);

create function public.portal_claim_auth_attempt(
  p_worker_id text,
  p_lock_seconds integer default 120,
  p_branch_code text default null
)
returns table(
  attempt_id uuid,
  branch_code text,
  lookup_hash char(64),
  encrypted_payload text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_branch text := upper(nullif(trim(p_branch_code), ''));
begin
  if normalized_branch is null
     or normalized_branch not in ('CN1', 'CN3')
     or not exists (
       select 1
       from portal.branches b
       where b.branch_code = normalized_branch
         and b.is_active = true
     ) then
    return;
  end if;

  return query
  update public.portal_auth_attempts a
  set status = 'running',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => p_lock_seconds),
      updated_at = now()
  where a.attempt_id = (
    select x.attempt_id
    from public.portal_auth_attempts x
    where (x.status = 'queued' or (x.status = 'running' and x.locked_until < now()))
      and x.branch_code = normalized_branch
      and x.expires_at > now()
    order by x.created_at
    for update skip locked
    limit 1
  )
  returning a.attempt_id, a.branch_code, a.lookup_hash, a.encrypted_payload;
end;
$$;

-- The portal schema is internal. Only trusted server-side code may resolve
-- active branches or call the queue claim RPC.
grant usage on schema portal to service_role;
grant select on table portal.branches to service_role;
grant select, insert, update on table public.portal_auth_attempts to service_role;

revoke all on function public.portal_claim_auth_attempt(text, integer, text) from public;
revoke all on function public.portal_claim_auth_attempt(text, integer, text) from anon, authenticated;
grant execute on function public.portal_claim_auth_attempt(text, integer, text) to service_role;

notify pgrst, 'reload schema';
