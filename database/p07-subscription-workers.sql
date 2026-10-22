begin;
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p07_worker') then create role ftk_p07_worker nologin;end if;end$$;
create table private.p07_worker_scopes(db_role name not null,org_id uuid not null references core.organizations(id),primary key(db_role,org_id));
create table private.p07_jobs(job_id uuid primary key references core.outbox_jobs(id),org_id uuid not null references core.organizations(id),operation text not null check(operation in ('subscription_boundary_apply_v1','privacy_execute_v1')),subscription_id uuid references core.saas_subscriptions(id),operation_key uuid,lease_hash text,payload_hash text,result jsonb);
alter table private.p07_worker_scopes enable row level security;alter table private.p07_jobs enable row level security;
revoke all on private.p07_worker_scopes,private.p07_jobs from public,anon,authenticated,ftk_p07_worker;
grant select,insert,update,delete on private.p07_jobs to service_role;
create function private.p07_worker_scope(org uuid) returns void language plpgsql security invoker set search_path='' as $$
begin if not pg_has_role(session_user,'ftk_p07_worker','member') or not exists(select 1 from private.p07_worker_scopes where db_role=session_user and org_id=org) then perform private.fail('FORBIDDEN');end if;end$$;
create function private.p07_boundary(org uuid,sub_id uuid,operation_id uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions;c core.saas_change_requests;p core.saas_plan_versions;owner uuid;changed bool:=false;at timestamptz:=clock_timestamp();
begin
 select * into s from core.saas_subscriptions where org_id=org and id=sub_id for update;if s.id is null then perform private.fail('NOT_FOUND');end if;
 select * into c from core.saas_change_requests where org_id=org and state='scheduled' and effective_at<=at order by effective_at,id limit 1 for update;
 if c.id is not null then
  select * into p from core.saas_plan_versions where id=c.target_plan_id;
  if p.name<>'business' and not exists(select 1 from core.centers where org_id=org and id=c.kept_center_id and state='active') then perform private.fail('VALIDATION_FAILED');end if;
  update core.saas_subscriptions set plan_version_id=c.target_plan_id,version=version+1 where id=s.id;
  insert into private.p07_subscription_scope(subscription_id,kept_center_id) values(s.id,c.kept_center_id) on conflict(subscription_id) do update set kept_center_id=excluded.kept_center_id;
  update core.saas_change_requests set state='applied',version=version+1 where id=c.id;changed:=true;
 end if;
 if s.period_end<=at and s.state<>'pending_payment' then
  if not s.cancel_at_period_end and private.p07_renew(org,s.id,operation_id) then
   select * into s from core.saas_subscriptions where id=s.id;changed:=true;
  end if;
 end if;
 if s.period_end<=at and s.state<>'pending_payment' then
  update core.saas_subscriptions set state=case when cancel_at_period_end or state='ended' then 'ended' when at<coalesce(grace_until,period_end+interval '7 days') then 'grace' else 'suspended' end,version=version+1 where id=s.id and state is distinct from case when cancel_at_period_end or state='ended' then 'ended' when at<coalesce(grace_until,period_end+interval '7 days') then 'grace' else 'suspended' end;
  changed:=changed or found;
 end if;
 if changed then
  select owner_person_id into owner from core.organizations where id=org;
  insert into core.audit_events(id,org_id,action,subject_table,subject_id,operation_id,diff) values(private.new_id(ids,4),org,'subscription_boundary_apply_v1','saas_subscriptions',s.id,operation_id,jsonb_build_object('old_plan_id',s.plan_version_id,'change_id',c.id,'period_end',s.period_end));
  insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(private.new_id(ids,5),org,owner,'subscription_boundary_apply_v1',s.id,jsonb_build_object('template_key','subscription_boundary_apply_v1','subject',jsonb_build_object('type','saas_subscriptions','id',s.id)));
  insert into core.outbox_jobs(id,org_id,notification_id,kind,dedupe_key,state,attempts,next_attempt_at) values(private.new_id(ids,6),org,private.new_id(ids,5),'in_app',operation_id::text,'pending',0,at);
 end if;
 return jsonb_build_object('type','saas_subscriptions','id',s.id);
end$$;
create function private.p07_jobs_claim(org uuid,ids uuid[],lim int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j core.outbox_jobs;s core.saas_subscriptions;c private.p07_jobs;id uuid;token text;idx int:=20;data jsonb:='[]';
begin
 perform private.p07_worker_scope(org);if lim not between 1 and 50 then perform private.fail('VALIDATION_FAILED');end if;
 perform 1 from core.organizations where id=org for update;
 for s in select x.* from core.saas_subscriptions x where x.org_id=org and ((x.period_end<=clock_timestamp() and x.state not in ('pending_payment','ended') and (x.state='active' or (x.state='grace' and coalesce(x.grace_until,x.period_end+interval '7 days')<=clock_timestamp()))) or exists(select 1 from core.saas_change_requests z where z.org_id=org and z.state='scheduled' and z.effective_at<=clock_timestamp())) order by x.created_at,x.id desc limit 1 loop
  id:=private.new_id(ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(id,org,'p07.boundary','p07.boundary:'||s.id::text||':'||s.version::text,'pending',0,clock_timestamp()) on conflict(org_id,dedupe_key) do nothing;
  if found then insert into private.p07_jobs(job_id,org_id,operation,subscription_id) values(id,org,'subscription_boundary_apply_v1',s.id);end if;
 end loop;
 update core.outbox_jobs j set state='failed',lease_until=null,version=version+1 from private.p07_jobs c where c.job_id=j.id and c.org_id=org and j.state='running' and j.lease_until<=clock_timestamp() and j.attempts>=3;
 for j in select j.* from core.outbox_jobs j join private.p07_jobs c on c.job_id=j.id where c.org_id=org and c.operation='subscription_boundary_apply_v1' and j.attempts<3 and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp())) order by j.created_at,j.id limit lim for update of j skip locked loop
  token:=encode(extensions.gen_random_bytes(32),'hex');update private.p07_jobs set operation_key=private.new_id(ids,idx),lease_hash=encode(extensions.digest(token,'sha256'),'hex'),result=null,payload_hash=null where job_id=j.id returning * into c;idx:=idx+1;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',version=version+1 where id=j.id;
  data:=data||jsonb_build_array(jsonb_build_object('operation',c.operation,'request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(ids,idx),'org_id',org,'job_id',j.id,'operation_key',c.operation_key,'lease_token',token)));idx:=idx+1;
 end loop;return data;
end$$;
create function private.p07_worker_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare org uuid:=(r->>'org_id')::uuid;j core.outbox_jobs;c private.p07_jobs;out_result jsonb;reference jsonb;receipt_id uuid:=private.new_id(ids,3);hash text:=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex');code text;
begin
 perform private.p07_worker_scope(org);perform 1 from core.organizations where id=org for update;
 select * into j from core.outbox_jobs where org_id=org and id=(r->>'job_id')::uuid for update;select * into c from private.p07_jobs where job_id=j.id and org_id=org;
 if c.job_id is null or c.operation<>op or c.operation_key is distinct from (r->>'operation_key')::uuid or c.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 if c.payload_hash is not null and c.payload_hash<>hash then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if c.result is not null then return c.result;end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 begin
  insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values(receipt_id,org,'worker:p07:'||session_user,op,encode(extensions.digest(r->>'operation_key','sha256'),'hex'),hash,'in_progress',clock_timestamp()+interval '30 days');
  if op='subscription_boundary_apply_v1' then reference:=private.p07_boundary(org,c.subscription_id,receipt_id,ids);else perform private.fail('FORBIDDEN');end if;
  out_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','succeeded','result_reference',reference),'trace_id',private.new_id(ids,1));
  update core.operation_receipts set state='succeeded',result=out_result,business_reference=c.subscription_id where id=receipt_id;
  update core.outbox_jobs set state='succeeded',lease_until=null,version=version+1 where id=j.id;
  update private.p07_jobs set result=out_result,payload_hash=hash where job_id=j.id;
  set constraints all immediate;set constraints all deferred;return out_result;
 exception when others then
  code:=case when SQLSTATE='P0001' and SQLERRM in ('VALIDATION_FAILED','NOT_FOUND','FORBIDDEN','POLICY_NOT_CONFIGURED') then SQLERRM else 'INTEGRITY_VIOLATION' end;
  out_result:=jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',false,'trace_id',private.new_id(ids,1)));return out_result;
 end;
exception when others then
 code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code='OPERATION_IN_PROGRESS','trace_id',private.new_id(ids,1)));
end$$;
revoke all on function private.p07_jobs_claim(uuid,uuid[],int),private.p07_worker_execute(text,jsonb,uuid[]) from public,anon,authenticated,service_role;
grant usage on schema private,api_v1 to ftk_p07_worker;
grant execute on function private.p07_jobs_claim(uuid,uuid[],int),private.p07_worker_execute(text,jsonb,uuid[]) to ftk_p07_worker;
commit;
