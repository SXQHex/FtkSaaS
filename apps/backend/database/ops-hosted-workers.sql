begin;
-- Native cron connects as a real, passwordless local role. The original
-- session_user + tenant worker fences remain authoritative.
do $$declare lane text;r text;begin
 foreach lane in array array['p01','p05','p06'] loop
  r:='ftk_ops_'||lane;
  if not exists(select 1 from pg_roles where rolname=r) then execute format('create role %I login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null',r);end if;
  if exists(select 1 from pg_roles where rolname=r and (not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then raise exception 'UNSAFE_HOSTED_WORKER_ROLE';end if;
  if exists(select 1 from pg_auth_members m join pg_roles child on child.oid=m.member join pg_roles parent on parent.oid=m.roleid where child.rolname=r and parent.rolname<>'ftk_'||lane||'_worker') then raise exception 'UNEXPECTED_HOSTED_WORKER_MEMBERSHIP';end if;
  execute format('alter role %I password null',r);
  execute format('grant %I to %I','ftk_'||lane||'_worker',r);
  execute format('grant usage on schema private,extensions to %I',r);
  execute format('alter role %I connection limit 2',r);
  execute format('alter role %I set statement_timeout = %L',r,'30s');
  execute format('alter role %I set lock_timeout = %L',r,'5s');
  execute format('alter role %I set idle_in_transaction_session_timeout = %L',r,'30s');
 end loop;
end$$;
create table private.ops_worker_health(lane text primary key check(lane in ('p01','p05','p06')),enabled boolean not null default false,last_org uuid,last_started_at timestamptz,last_finished_at timestamptz,last_status text not null default 'not_started',last_error_code text,claimed bigint not null default 0,succeeded bigint not null default 0,failed bigint not null default 0,ticks bigint not null default 0);
insert into private.ops_worker_health(lane) values('p01'),('p05'),('p06');
alter table private.ops_worker_health enable row level security;
revoke all on private.ops_worker_health from public,anon,authenticated,ftk_p01_worker,ftk_p05_worker,ftk_p06_worker;
create function private.ops_identity(lane text) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if lane not in ('p01','p05','p06') or session_user::text is distinct from 'ftk_ops_'||lane or not pg_has_role(session_user,'ftk_'||lane||'_worker','member') then raise exception using errcode='P0001',message='FORBIDDEN';end if;
end$$;
-- Server-produced RFC9562 UUIDv7 bank; does not replace any table default.
create function private.ops_uuid_bank(n int) returns uuid[] language plpgsql volatile security invoker set search_path='' as $$
declare result uuid[]:='{}';b bytea;ms bigint;i int;j int;
begin
 if n is null or n<1 or n>116574 then raise exception using errcode='P0001',message='VALIDATION_FAILED';end if;
 for i in 1..n loop
  ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;b:=extensions.gen_random_bytes(16);
  for j in 0..5 loop b:=set_byte(b,j,((ms>>((5-j)*8))&255)::int);end loop;
  b:=set_byte(b,6,(get_byte(b,6)&15)|112);b:=set_byte(b,8,(get_byte(b,8)&63)|128);
  result:=array_append(result,encode(b,'hex')::uuid);
 end loop;return result;
end$$;
create function private.ops_begin(lane text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict error
declare h private.ops_worker_health;orgs uuid[];chosen uuid;
begin
 perform private.ops_identity(lane);
 select * into h from private.ops_worker_health w where w.lane=ops_begin.lane for update;
 if not h.enabled then return jsonb_build_object('enabled',false);end if;
 if lane='p01' then select array_agg(w.org_id order by w.org_id) into orgs from private.p01_worker_scopes w where w.db_role=session_user;
 elsif lane='p05' then select array_agg(w.org_id order by w.org_id) into orgs from private.p05_worker_scopes w where w.db_role=session_user;
 else select array_agg(w.org_id order by w.org_id) into orgs from private.p06_worker_scopes w where w.db_role=session_user;end if;
 select u into chosen from unnest(orgs) u where h.last_org is null or u>h.last_org order by u limit 1;chosen:=coalesce(chosen,orgs[1]);
 update private.ops_worker_health w set last_started_at=clock_timestamp(),last_status='running',last_error_code=null,last_org=chosen,ticks=w.ticks+1 where w.lane=ops_begin.lane;
 return jsonb_build_object('enabled',true,'org',chosen);
end$$;
create function private.ops_finish(lane text,status text,code text,claims int,successes int,failures int) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.ops_identity(lane);
 if code is not null and code not in ('FORBIDDEN','NOT_FOUND','TEMPORARY_FAILURE','VALIDATION_FAILED','INTEGRITY_VIOLATION','IDEMPOTENCY_PAYLOAD_MISMATCH','PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED','POLICY_NOT_CONFIGURED','PREVIEW_STALE','DOCUMENT_REQUIRED','SERVICE_UNAVAILABLE','SESSION_REVOKED','BILLING_OPERATION_RESTRICTED','SUBSCRIPTION_NOT_STARTED','VERSION_CONFLICT') then code:='TEMPORARY_FAILURE';end if;
 if status not in ('idle','succeeded','job_error','claim_error') or claims<0 or successes<0 or failures<0 or successes+failures>claims then perform private.fail('VALIDATION_FAILED');end if;
 update private.ops_worker_health w set last_finished_at=clock_timestamp(),last_status=ops_finish.status,last_error_code=ops_finish.code,claimed=w.claimed+claims,succeeded=w.succeeded+successes,failed=w.failed+failures where w.lane=ops_finish.lane;
 -- Bounded retention of this scheduler's own technical cron history only.
 if to_regclass('cron.job_run_details') is not null and (select h.ticks%720=0 from private.ops_worker_health h where h.lane=ops_finish.lane) then
  execute $prune$delete from cron.job_run_details where runid in (select d.runid from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.username=session_user and j.jobname in ('ftksaas-ops-p01','ftksaas-ops-p05','ftksaas-ops-p06') and d.end_time<clock_timestamp()-interval '7 days' order by d.runid limit 1000)$prune$;
 end if;
end$$;
-- SECURITY INVOKER and no SET clause: each COMMIT is an explicit durability
-- boundary. A killed execution leaves its committed claim for lease reclaim.
create procedure private.ops_run(lane text) language plpgsql security invoker as $$
declare ctx jsonb;org uuid;jobs jsonb;j jsonb;answer jsonb;code text;claims int:=0;successes int:=0;failures int:=0;n int;required int;lock_id bigint;
begin
 perform private.ops_identity(lane);lock_id:=pg_catalog.hashtextextended('ftksaas.ops.'||lane,0);
 if not pg_catalog.pg_try_advisory_lock(lock_id) then return;end if;
 ctx:=private.ops_begin(lane);commit;
 if ctx->>'enabled' is distinct from 'true' then perform pg_catalog.pg_advisory_unlock(lock_id);return;end if;
 org:=(ctx->>'org')::uuid;
 if org is null then perform private.ops_finish(lane,'idle',null,0,0,0);commit;perform pg_catalog.pg_advisory_unlock(lock_id);return;end if;
 begin
  if lane='p01' then jobs:=private.p01_jobs_claim(org,private.ops_uuid_bank(4096),1);
  elsif lane='p05' then jobs:=private.p05_jobs_claim(org,private.ops_uuid_bank(4096),1);
  else jobs:=private.p06_jobs_claim(org,private.ops_uuid_bank(4096),1);end if;
 exception when others then code:=case when SQLSTATE='P0001' then SQLERRM else 'TEMPORARY_FAILURE' end;
 end;
 commit;
 if code is not null then perform private.ops_finish(lane,'claim_error',code,0,0,0);commit;perform pg_catalog.pg_advisory_unlock(lock_id);return;end if;
 for j in select value from pg_catalog.jsonb_array_elements(jobs) loop
  claims:=claims+1;answer:=null;code:=null;
  begin
   if lane='p01' then answer:=private.p01_worker_execute(j->>'operation',j->'request',private.ops_uuid_bank(4096));
   elsif lane='p05' then answer:=private.p05_worker_execute(j->>'operation',j->'request',private.ops_uuid_bank(4096));
   else
    n:=4096;
    for attempt in 1..4 loop
     answer:=private.p06_worker_execute(j->>'operation',j->'request',private.ops_uuid_bank(n));
     exit when answer->>'_internal_retry' is distinct from 'uuid_bank_exhausted';
     required:=(answer->>'required_uuid_count')::int;
     if required is null or required<1 or required>116574 then raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end if;
     n:=least(116574,greatest(n*2,required));
    end loop;
    if answer ? '_internal_retry' then raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end if;
   end if;
   if answer->>'ok' is distinct from 'true' then code:=coalesce(answer#>>'{error,code}','TEMPORARY_FAILURE');end if;
  exception when others then code:=case when SQLSTATE='P0001' then SQLERRM else 'TEMPORARY_FAILURE' end;
  end;
  commit;
  if code is null then successes:=successes+1;else failures:=failures+1;end if;
 end loop;
 perform private.ops_finish(lane,case when failures>0 then 'job_error' when claims=0 then 'idle' else 'succeeded' end,code,claims,successes,failures);commit;
 perform pg_catalog.pg_advisory_unlock(lock_id);
end$$;
revoke all on function private.ops_identity(text),private.ops_uuid_bank(int),private.ops_begin(text),private.ops_finish(text,text,text,int,int,int) from public,anon,authenticated;
revoke all on procedure private.ops_run(text) from public,anon,authenticated;
grant execute on function private.ops_identity(text),private.ops_uuid_bank(int),private.ops_begin(text),private.ops_finish(text,text,text,int,int,int) to ftk_ops_p01,ftk_ops_p05,ftk_ops_p06;
grant execute on procedure private.ops_run(text) to ftk_ops_p01,ftk_ops_p05,ftk_ops_p06;
commit;
