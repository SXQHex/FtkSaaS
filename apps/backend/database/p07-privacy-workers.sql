begin;
-- Global account requests deliberately do not use the tenant-only outbox.
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p07_privacy_worker') then create role ftk_p07_privacy_worker nologin;end if;end$$;
grant usage on schema private to ftk_p07_privacy_worker;
create table private.p07_privacy_worker_scopes(db_role name not null,org_id uuid references core.organizations(id),unique nulls not distinct(db_role,org_id));
create table private.p07_privacy_jobs(id uuid primary key,request_id uuid not null unique references core.privacy_requests(id),org_id uuid references core.organizations(id),state text not null check(state in ('pending','running','retry_wait','succeeded','failed')),attempts int not null default 0,stage_runs bigint not null default 0,lease_until timestamptz,next_attempt_at timestamptz not null default clock_timestamp(),operation_key uuid,lease_hash text,payload_hash text,result jsonb);
create table private.p07_privacy_manifests(request_id uuid primary key references core.privacy_requests(id),updated_at timestamptz not null default clock_timestamp(),scopes jsonb not null);
alter table private.p07_privacy_worker_scopes enable row level security;alter table private.p07_privacy_jobs enable row level security;alter table private.p07_privacy_manifests enable row level security;
revoke all on private.p07_privacy_worker_scopes,private.p07_privacy_jobs,private.p07_privacy_manifests from public,anon,authenticated,ftk_p07_privacy_worker;
grant select,insert,update on private.p07_privacy_jobs,private.p07_privacy_manifests to service_role;
create function private.p07_privacy_scope(org uuid) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if not pg_has_role(session_user,'ftk_p07_privacy_worker','member') or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=session_user and s.org_id is not distinct from org) then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.p07_privacy_enqueue(request uuid,org uuid,job uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from core.privacy_requests r where r.id=request and r.org_id is not distinct from org and ((org is null and r.kind='account_delete' and r.scope->>'kind'='account') or (org is not null and r.kind='organization_delete' and r.scope->>'org_id'=org::text))) then perform private.fail('NOT_FOUND');end if;
 insert into private.p07_privacy_jobs(id,request_id,org_id,state) values(job,request,org,'pending');
end$$;
create function private.p07_privacy_claim(org uuid,ids uuid[],lim int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.p07_privacy_jobs;token text;idx int:=20;out_result jsonb:='[]';
begin
 perform private.p07_privacy_scope(org);if lim not between 1 and 50 then perform private.fail('VALIDATION_FAILED');end if;
 update private.p07_privacy_jobs set state='failed',lease_until=null where org_id is not distinct from org and state='running' and lease_until<=clock_timestamp() and attempts>=3;
 for j in select x.* from private.p07_privacy_jobs x where x.org_id is not distinct from org and x.attempts<3 and ((x.state in ('pending','retry_wait') and x.next_attempt_at<=clock_timestamp()) or (x.state='running' and x.lease_until<=clock_timestamp())) order by x.next_attempt_at,x.id limit lim for update skip locked loop
  token:=encode(extensions.gen_random_bytes(32),'hex');
  update private.p07_privacy_jobs set state='running',attempts=attempts+1,operation_key=private.new_id(ids,idx),lease_hash=encode(extensions.digest(token,'sha256'),'hex'),lease_until=clock_timestamp()+interval '60 seconds',result=null,payload_hash=null where id=j.id returning * into j;idx:=idx+1;
  out_result:=out_result||jsonb_build_array(jsonb_build_object('operation','privacy_execute_v1','request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(ids,idx),'org_id',org,'job_id',j.id,'operation_key',j.operation_key,'lease_token',token)));idx:=idx+1;
 end loop;return out_result;
end$$;
create function private.p07_privacy_execute(r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(r->>'org_id')::uuid;j private.p07_privacy_jobs;p core.privacy_requests;h text:=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex');scopes jsonb;out_result jsonb;code text;receipt_id uuid:=private.new_id(ids,3);
begin
 perform private.p07_privacy_scope(org);
 select * into j from private.p07_privacy_jobs where id=(r->>'job_id')::uuid and org_id is not distinct from org for update;
 if j.id is null or j.operation_key is distinct from (r->>'operation_key')::uuid or j.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 if j.payload_hash is not null and j.payload_hash<>h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if j.result is not null then return j.result;end if;
 if j.state<>'running' or j.lease_until<=clock_timestamp() or j.lease_until is null then perform private.fail('OPERATION_IN_PROGRESS');end if;
 select * into p from core.privacy_requests where id=j.request_id and org_id is not distinct from org for update;
 if p.id is null or (org is null and (p.kind<>'account_delete' or p.scope->>'kind'<>'account' or p.scope->>'account_id' is distinct from p.requester_account_id::text)) or (org is not null and (p.kind<>'organization_delete' or p.scope->>'org_id' is distinct from org::text)) then perform private.fail('FORBIDDEN');end if;
 insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values(receipt_id,org,'worker:privacy:'||session_user,'privacy_execute_v1',encode(extensions.digest(r->>'operation_key','sha256'),'hex'),h,'in_progress',clock_timestamp()+interval '30 days');
 -- Infrastructure is an explicit completion boundary. Do not equate a successful
 -- lease/stage with erasure, nor invent legal approval, object deletion or backup receipts.
 scopes:=jsonb_build_object('database',jsonb_build_object('state','pending','reason','retention policy, legal holds and scoped purge proof required'),'auth',jsonb_build_object('state',case when org is null then 'pending' else 'not_applicable' end,'reason',case when org is null then 'native Auth identity/session erasure proof required' else 'shared global accounts must be preserved' end),'storage',jsonb_build_object('state','pending','reason','private object deletion and absence proof required'),'exports',jsonb_build_object('state','pending','reason','DB exports, source uploads and temporary copies need verified purge'),'backups',jsonb_build_object('state','pending','reason','backup inventory/expiry and restore non-resurrection proof required'));
 insert into private.p07_privacy_manifests(request_id,scopes) values(p.id,scopes) on conflict(request_id) do update set scopes=excluded.scopes,updated_at=clock_timestamp();
 update core.privacy_requests set state='partial',completed_at=null,version=version+1 where id=p.id;
 out_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','retry_wait','result_reference',jsonb_build_object('type','privacy_requests','id',p.id)),'trace_id',private.new_id(ids,1));
 update private.p07_privacy_jobs set state='retry_wait',attempts=greatest(0,attempts-1),stage_runs=stage_runs+1,next_attempt_at=clock_timestamp()+interval '5 minutes',lease_until=null,payload_hash=h,result=out_result where id=j.id;
 update core.operation_receipts set state='succeeded',result=out_result,business_reference=p.id where id=receipt_id;
 insert into private.p07_lifecycle_events(id,account_id,operation_id,action,detail) values(private.new_id(ids,4),p.requester_account_id,receipt_id,'privacy_execute_v1',jsonb_build_object('request_id',p.id,'job_id',j.id,'state','partial','physical_erasure_complete',false));
 return out_result;
exception when others then
 code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code in ('TEMPORARY_FAILURE','OPERATION_IN_PROGRESS'),'trace_id',private.new_id(ids,1)));
end$$;
create function private.p07_privacy_status(r jsonb,account uuid,aux jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare j private.p07_privacy_jobs;p core.privacy_requests;org uuid:=(r->>'org_id')::uuid;manifest jsonb;
begin
 select * into j from private.p07_privacy_jobs where id=(r->>'job_id')::uuid and org_id is not distinct from org;
 if j.id is null then return null;end if;
 if r->>'center_id' is not null then perform private.fail('NOT_FOUND');end if;
 select * into p from core.privacy_requests where id=j.request_id;
 if org is null then
  if p.requester_account_id is distinct from account then perform private.fail('NOT_FOUND');end if;
  perform private.p07_lifecycle_reauth(account,aux);
 elsif not exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null) then perform private.fail('NOT_FOUND');end if;
 select scopes into manifest from private.p07_privacy_manifests where request_id=p.id;
 return jsonb_build_object('id',j.id,'state',j.state,'progress_count',0,'total_count',null,'result_reference',jsonb_build_object('type','privacy_requests','id',p.id),'safe_error_code',case when p.state='partial' then 'RESULT_NOT_CONFIRMED' end,'privacy',jsonb_build_object('request_state',p.state,'completed_at',p.completed_at,'pending_scopes',coalesce((select jsonb_agg(k order by k) from jsonb_each(manifest) e(k,v) where v->>'state'='pending'),case when org is null then '["database","auth","storage","exports","backups"]'::jsonb else '["database","storage","exports","backups"]'::jsonb end)));
end$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
revoke all on function private.p07_privacy_scope(uuid),private.p07_privacy_claim(uuid,uuid[],int),private.p07_privacy_execute(jsonb,uuid[]) from service_role;
grant execute on function private.p07_privacy_scope(uuid),private.p07_privacy_claim(uuid,uuid[],int),private.p07_privacy_execute(jsonb,uuid[]) to ftk_p07_privacy_worker;
commit;
