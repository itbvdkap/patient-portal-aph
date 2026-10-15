-- Additive cloud bridge; no Oracle DDL/DML, no public patient access.
begin;
create table public.portal_ksk_states (
  key text primary key check (key in ('staff','management:CN1','management:CN3')),
  revision bigint not null check (revision > 0), payload text not null check (length(payload) <= 20000000),
  updated_at timestamptz not null default now()
);
create table public.portal_ksk_state_history (
  key text not null, revision bigint not null, payload text not null, archived_at timestamptz not null default now(), primary key(key,revision)
);
create table public.portal_ksk_jobs (
  id uuid primary key default gen_random_uuid(), branch text not null check (branch in ('CN1','CN3')),
  operation text not null check (operation in ('report','management','patient','validate')),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'), input jsonb not null check (octet_length(input::text) <= 128000),
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  result jsonb, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '3 minutes',
  worker text, lease uuid, locked_until timestamptz, attempts integer not null default 0,
  unique(branch,operation,request_hash)
);
create index portal_ksk_jobs_pending on public.portal_ksk_jobs(branch,created_at) where status in ('pending','running');
create index portal_ksk_jobs_expiry on public.portal_ksk_jobs(expires_at);
create table public.portal_ksk_limits (key text primary key, count integer not null, expires_at timestamptz not null);
alter table public.portal_ksk_states enable row level security;
alter table public.portal_ksk_state_history enable row level security;
alter table public.portal_ksk_jobs enable row level security;
alter table public.portal_ksk_limits enable row level security;
revoke all on public.portal_ksk_states, public.portal_ksk_state_history, public.portal_ksk_jobs, public.portal_ksk_limits from public,anon,authenticated;
grant select,insert,update,delete on public.portal_ksk_states, public.portal_ksk_state_history, public.portal_ksk_jobs, public.portal_ksk_limits to service_role;

create function public.portal_ksk_state_get(p_key text) returns jsonb language sql security invoker set search_path='' as $$
  select coalesce((select jsonb_build_object('revision',revision,'payload',payload) from public.portal_ksk_states where key=p_key),jsonb_build_object('revision',0,'payload',null));
$$;
create function public.portal_ksk_state_cas(p_key text,p_revision bigint,p_payload text) returns boolean language plpgsql security invoker set search_path='' as $$
declare current_revision bigint;
begin
  if p_key not in ('staff','management:CN1','management:CN3') or p_revision < 0 or length(p_payload)>20000000 then raise exception 'Invalid state'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ksk-state:'||p_key,0));
  select revision into current_revision from public.portal_ksk_states where key=p_key for update;
  if coalesce(current_revision,0) <> p_revision then return false; end if;
  insert into public.portal_ksk_state_history(key,revision,payload) select key,revision,payload from public.portal_ksk_states where key=p_key;
  insert into public.portal_ksk_states(key,revision,payload) values(p_key,p_revision+1,p_payload)
    on conflict(key) do update set revision=excluded.revision,payload=excluded.payload,updated_at=now();
  return true;
end $$;
create function public.portal_ksk_rate(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
declare hits integer;
begin
  if p_key !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from public.portal_ksk_limits where expires_at < now();
  if (select count(*) from public.portal_ksk_limits)>10000 then return false; end if;
  insert into public.portal_ksk_limits(key,count,expires_at) values(p_key,1,now()+interval '15 minutes')
    on conflict(key) do update set count=public.portal_ksk_limits.count+1 returning count into hits;
  return hits<=8;
end $$;
create function public.portal_ksk_enqueue(p_branch text,p_operation text,p_input jsonb,p_hash text) returns uuid language plpgsql security invoker set search_path='' as $$
declare job public.portal_ksk_jobs;
begin
  if p_branch not in ('CN1','CN3') or p_operation not in ('report','management','patient','validate') or p_hash !~ '^[a-f0-9]{64}$' or octet_length(p_input::text)>128000 then raise exception 'Invalid read request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ksk-queue:'||p_branch,0));
  select * into job from public.portal_ksk_jobs where branch=p_branch and operation=p_operation and request_hash=p_hash for update;
  if found and job.expires_at>now() and (job.status in ('pending','running','done') or job.created_at>now()-interval '10 seconds') then return job.id; end if;
  if (select count(*) from public.portal_ksk_jobs where branch=p_branch and status in ('pending','running') and expires_at>now())>=100 then raise exception 'Read queue full'; end if;
  insert into public.portal_ksk_jobs(branch,operation,input,request_hash) values(p_branch,p_operation,p_input,p_hash)
  on conflict(branch,operation,request_hash) do update set input=excluded.input,status='pending',result=null,created_at=now(),expires_at=now()+interval '3 minutes',worker=null,lease=null,locked_until=null,attempts=0 returning id into job.id;
  return job.id;
end $$;
create function public.portal_ksk_claim(p_branch text,p_worker text) returns setof public.portal_ksk_jobs language plpgsql security invoker set search_path='' as $$
begin
  if p_branch not in ('CN1','CN3') or length(p_worker)>100 then raise exception 'Invalid worker'; end if;
  -- Clinical request/result cache lasts minutes, not an unbounded archive.
  delete from public.portal_ksk_jobs where branch=p_branch and expires_at<now()-interval '1 day';
  return query update public.portal_ksk_jobs set status='running',worker=p_worker,lease=gen_random_uuid(),locked_until=now()+interval '90 seconds',attempts=attempts+1
  where id=(select id from public.portal_ksk_jobs where branch=p_branch and expires_at>now() and attempts<3 and
    (status='pending' or (status='running' and locked_until<now())) order by created_at limit 1 for update skip locked) returning *;
end $$;
create function public.portal_ksk_complete(p_id uuid,p_worker text,p_lease uuid,p_ok boolean,p_result jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  if octet_length(p_result::text)>14000000 then raise exception 'Read result too large'; end if;
  update public.portal_ksk_jobs set status=case when p_ok then 'done' else 'failed' end,result=case when p_ok then p_result else null end,
    expires_at=now()+case when operation in ('validate','patient','management') then interval '20 seconds' else interval '2 minutes' end,locked_until=null
    where id=p_id and worker=p_worker and lease=p_lease and status='running' and locked_until>now();
  get diagnostics changed=row_count; return changed=1;
end $$;
revoke all on function public.portal_ksk_state_get(text),public.portal_ksk_state_cas(text,bigint,text),public.portal_ksk_rate(text),public.portal_ksk_enqueue(text,text,jsonb,text),public.portal_ksk_claim(text,text),public.portal_ksk_complete(uuid,text,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.portal_ksk_state_get(text),public.portal_ksk_state_cas(text,bigint,text),public.portal_ksk_rate(text),public.portal_ksk_enqueue(text,text,jsonb,text),public.portal_ksk_claim(text,text),public.portal_ksk_complete(uuid,text,uuid,boolean,jsonb) to service_role;
commit;
