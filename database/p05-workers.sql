begin;
do $$begin if not exists(select 1 from pg_roles where rolname='ftk_p05_worker') then create role ftk_p05_worker nologin;end if;end$$;
create table private.p05_worker_scopes(db_role name not null,org_id uuid not null references core.organizations(id),primary key(db_role,org_id));
create table private.p05_jobs(job_id uuid primary key references core.outbox_jobs(id),org_id uuid not null references core.organizations(id),operation text not null check(operation in ('outbox_deliver_v1','reminder_schedule_v1','automation_run_v1')),target_id uuid not null,center_id uuid,person_id uuid,automation_id uuid,event_key text,operation_key uuid,lease_hash text,payload_hash text,result jsonb);
alter table private.p05_worker_scopes enable row level security;alter table private.p05_jobs enable row level security;
revoke all on private.p05_worker_scopes,private.p05_jobs from public,anon,authenticated,ftk_p05_worker;
create unique index p05_automation_event on core.automation_runs(org_id,automation_id,person_id,event_key);
create function private.p05_worker_scope(org uuid) returns void language plpgsql security invoker set search_path='' as $$
begin if not pg_has_role(session_user,'ftk_p05_worker','member') or not exists(select 1 from private.p05_worker_scopes where db_role=session_user and org_id=org) then perform private.fail('FORBIDDEN');end if;end$$;
create function private.p05_optional_allowed(org uuid,person uuid,purpose text) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select p.enabled from core.notification_preferences p where p.org_id=org and p.person_id=person and p.channel='in_app' and p.purpose=$3),false)
$$;
-- No dynamic SQL: typed segment fields/operators are evaluated on a safe snapshot.
create function private.p05_segment_condition(condition jsonb,fields jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare lhs jsonb:=fields->(condition->>'field');rhs jsonb:=condition->'value';op text:=condition->>'operator';
begin
 if op='is_null' then return lhs is null or lhs='null'::jsonb;end if;
 if lhs is null or lhs='null'::jsonb or rhs is null then return false;end if;
 if op='eq' then return lhs=rhs;elsif op='neq' then return lhs<>rhs;elsif op='in' then return jsonb_typeof(rhs)='array' and rhs@>jsonb_build_array(lhs);end if;
 if jsonb_typeof(lhs)<>jsonb_typeof(rhs) or jsonb_typeof(lhs) not in ('number','string') then return false;end if;
 if jsonb_typeof(lhs)='number' then
  return case op when 'lt' then (lhs#>>'{}')::numeric<(rhs#>>'{}')::numeric when 'lte' then (lhs#>>'{}')::numeric<=(rhs#>>'{}')::numeric when 'gt' then (lhs#>>'{}')::numeric>(rhs#>>'{}')::numeric when 'gte' then (lhs#>>'{}')::numeric>=(rhs#>>'{}')::numeric else false end;
 end if;
 if condition->>'field' in ('last_attended_at','entitlement_ends_at') then
  return case op when 'lt' then (lhs#>>'{}')::timestamptz<(rhs#>>'{}')::timestamptz when 'lte' then (lhs#>>'{}')::timestamptz<=(rhs#>>'{}')::timestamptz when 'gt' then (lhs#>>'{}')::timestamptz>(rhs#>>'{}')::timestamptz when 'gte' then (lhs#>>'{}')::timestamptz>=(rhs#>>'{}')::timestamptz else false end;
 end if;
 return false;
exception when others then return false;
end$$;
create function private.p05_segment_matches(org uuid,center uuid,person uuid,segment uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare d jsonb;fields jsonb;c jsonb;l core.leads;last_at timestamptz;end_at timestamptz;credits bigint;
begin
 if segment is null then return true;end if;
 select s.definition into d from core.segments s join private.p05_configuration_scopes x on x.entity_id=s.id where s.org_id=org and s.id=segment and s.state='active' and (x.center_id is null or x.center_id=center);
 if d is null then return false;end if;
 select * into l from core.leads where org_id=org and center_id=center and person_id=person order by created_at desc,id desc limit 1;
 select max(coalesce(s.actual_started_at,s.starts_at)) into last_at from core.attendance_entries a join core.reservations r on r.org_id=a.org_id and r.id=a.reservation_id join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=person and a.result='attended' and r.state='completed';
 select min(s.valid_until) into end_at from core.sales s where s.org_id=org and s.center_id=center and s.person_id=person and s.state='active' and s.valid_until>clock_timestamp();
 select coalesce(sum(private.available_for(org,s.id,clock_timestamp())),0) into credits from core.sales s where s.org_id=org and s.person_id=person and s.center_id=center and s.state='active';
 fields:=jsonb_build_object('last_attended_at',last_at,'entitlement_ends_at',end_at,'remaining_credits',credits,'lead_source',l.source,'lead_interest',l.interest,'active_student',exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=person and kind='student' and state='active'),'center_id',center);
 for c in select value from jsonb_array_elements(coalesce(d->'all','[]')) loop if not private.p05_segment_condition(c,fields) then return false;end if;end loop;
 if jsonb_array_length(coalesce(d->'any','[]'))>0 and not exists(select 1 from jsonb_array_elements(d->'any') v(value) where private.p05_segment_condition(v.value,fields)) then return false;end if;
 return true;
end$$;
create function private.p05_automation_candidates(org uuid,center uuid,trigger jsonb) returns table(person_id uuid,target_id uuid,event_key text) language plpgsql stable security invoker set search_path='' as $$
declare days int:=(trigger->>'offset_days')::int;policy core.policy_versions;
begin
 if trigger->>'kind'='lead_followup_due' then
  return query select l.person_id,a.id,'activity:'||a.id::text||':'||a.version::text from core.crm_activities a join core.leads l on l.org_id=a.org_id and l.id=a.lead_id where a.org_id=org and a.center_id=center and l.state='open' and a.completed_at is null and not exists(select 1 from private.p05_automation_activities generated where generated.activity_id=a.id) and a.due_at<=clock_timestamp()+make_interval(days=>days);return;
 end if;
 select * into policy from private.policy_at(org,center,case when trigger->>'kind'='student_inactive' then 'inactive_student_days' else 'entitlement_reminder_days' end,clock_timestamp());
 if policy.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if policy.mandatory and (policy.value->>'value')::int<>days then perform private.fail('FORBIDDEN');end if;
 if trigger->>'kind'='entitlement_expiring' then
  return query select s.person_id,s.id,'sale:'||s.id::text||':'||s.version::text from core.sales s where s.org_id=org and s.center_id=center and s.state='active' and s.valid_until>clock_timestamp() and s.valid_until<=clock_timestamp()+make_interval(days=>days)
  and not exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=s.id and n.state='active');
 elsif trigger->>'kind'='student_inactive' then
  return query select cr.person_id,cr.id,'inactive:'||cr.id::text||':'||coalesce(last_seen.at,cr.started_at)::text from core.center_relationships cr
  left join lateral(select max(coalesce(s.actual_started_at,s.starts_at)) at from core.attendance_entries a join core.reservations r on r.org_id=a.org_id and r.id=a.reservation_id join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.center_id=center and r.person_id=cr.person_id and a.result='attended' and r.state='completed') last_seen on true
  where cr.org_id=org and cr.center_id=center and cr.kind='student' and cr.state='active' and coalesce(last_seen.at,cr.started_at)+make_interval(days=>days)<=clock_timestamp();
 end if;
end$$;
create function private.p05_jobs_claim(org uuid,ids uuid[],lim int default 1) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare j core.outbox_jobs;item record;jid uuid;idx int:=1;tok text;out_data jsonb:='[]';cfg record;candidate record;c uuid;fingerprint text;
begin
 perform private.p05_worker_scope(org);
 if lim<1 or lim>50 then perform private.fail('VALIDATION_FAILED');end if;
 perform 1 from core.organizations where id=org for update;
 if private.access_mode(org) not in ('normal','grace') then return '[]';end if;
 perform private.require_feature(org,'F26');
 insert into private.p05_jobs(job_id,org_id,operation,target_id,person_id) select j.id,j.org_id,'outbox_deliver_v1',j.notification_id,n.recipient_person_id from core.outbox_jobs j join core.notifications n on n.org_id=j.org_id and n.id=j.notification_id where j.org_id=org and j.kind='in_app' and j.state in ('pending','retry_wait','running') on conflict(job_id) do nothing;
 if exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and p.name in ('pro','business') and 'F27'=any(p.features)) then
  for item in select r.id,r.center_id,r.person_id from core.reservations r join core.sessions s on s.org_id=r.org_id and s.id=r.session_id where r.org_id=org and r.state='active' and s.state='planned' and s.starts_at>clock_timestamp() and s.starts_at<=clock_timestamp()+interval '24 hours' and private.center_accessible(org,r.center_id) and not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.reminder' and j.dedupe_key='p05.lesson:'||r.id::text) order by s.starts_at,r.id limit 100 loop
   fingerprint:='p05.lesson:'||item.id::text;jid:=private.new_id(ids,idx);idx:=idx+1;
   insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.reminder',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
   if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,event_key) values(jid,org,'reminder_schedule_v1',item.id,item.center_id,item.person_id,'lesson');end if;
  end loop;
  for item in select s.id,s.center_id,s.person_id from core.sales s cross join lateral private.policy_at(org,s.center_id,'entitlement_reminder_days',clock_timestamp()) p where s.org_id=org and s.state='active' and s.valid_until>clock_timestamp() and s.valid_until<=clock_timestamp()+make_interval(days=>(p.value->>'value')::int) and private.center_accessible(org,s.center_id)
  and not exists(select 1 from core.sales n where n.org_id=org and n.previous_sale_id=s.id and n.state='active') and not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.reminder' and j.dedupe_key='p05.entitlement:'||s.id::text) order by s.valid_until,s.id limit 100 loop
   fingerprint:='p05.entitlement:'||item.id::text;jid:=private.new_id(ids,idx);idx:=idx+1;
   insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.reminder',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
   if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,event_key) values(jid,org,'reminder_schedule_v1',item.id,item.center_id,item.person_id,'entitlement');end if;
  end loop;
 end if;
 for cfg in select a.*,x.execution_center_ids,x.creator_person_id from core.automations a join private.p05_configuration_scopes x on x.entity_id=a.id join core.saas_subscriptions s on s.org_id=a.org_id join core.saas_plan_versions p on p.id=s.plan_version_id where a.org_id=org and a.state='active' and x.enabled and p.name='business' and 'F24'=any(p.features) order by a.created_at,a.id loop
  exit when idx>200;
  foreach c in array cfg.execution_center_ids loop
   exit when idx>200;
   if not private.center_accessible(org,c) or not private.is_manager(org,cfg.creator_person_id,c) then continue;end if;
   begin
   for candidate in select z.* from private.p05_automation_candidates(org,c,cfg.trigger) z where not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.automation' and j.dedupe_key='p05.automation:'||cfg.id::text||':'||cfg.version::text||':'||z.person_id::text||':'||z.event_key) and private.p05_segment_matches(org,c,z.person_id,cfg.segment_id) order by person_id,target_id limit 100 loop
    exit when idx>200;
    fingerprint:='p05.automation:'||cfg.id::text||':'||cfg.version::text||':'||candidate.person_id::text||':'||candidate.event_key;
    jid:=private.new_id(ids,idx);idx:=idx+1;
    insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.automation',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
    if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,automation_id,event_key) values(jid,org,'automation_run_v1',candidate.target_id,c,candidate.person_id,cfg.id,cfg.version::text||':'||candidate.event_key);end if;
   end loop;
   exception when SQLSTATE 'P0001' then if SQLERRM not in ('POLICY_NOT_CONFIGURED','FORBIDDEN','PLAN_FEATURE_UNAVAILABLE','NOT_FOUND') then raise;end if;end;
  end loop;
 end loop;
 update core.outbox_jobs j set state='failed',lease_until=null,version=version+1 from private.p05_jobs c where c.job_id=j.id and c.org_id=org and j.state='running' and j.lease_until<=clock_timestamp() and j.attempts>=3;
 for j in select j.* from core.outbox_jobs j join private.p05_jobs c on c.job_id=j.id where c.org_id=org and j.attempts<3 and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp())) order by j.created_at,j.id limit lim for update of j skip locked loop
  tok:=encode(extensions.gen_random_bytes(32),'hex');update private.p05_jobs set lease_hash=encode(extensions.digest(tok,'sha256'),'hex'),operation_key=private.new_id(ids,idx),payload_hash=null,result=null where job_id=j.id;idx:=idx+1;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',version=version+1 where id=j.id;
  select operation into fingerprint from private.p05_jobs where job_id=j.id;
  out_data:=out_data||jsonb_build_array(jsonb_build_object('operation',fingerprint,'request',jsonb_build_object('client_api_version',1,'request_id',private.new_id(ids,idx),'org_id',org,'operation_key',(select operation_key from private.p05_jobs where job_id=j.id),'job_id',j.id,'lease_token',tok)));idx:=idx+1;
 end loop;
 return out_data;
end$$;
create function private.p05_worker_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare org uuid:=(r->>'org_id')::uuid;j core.outbox_jobs;c private.p05_jobs;a core.automations;x private.p05_configuration_scopes;res core.reservations;sal core.sales;policy core.policy_versions;run_id uuid:=private.new_id(ids,2);nid uuid:=private.new_id(ids,20);out_data jsonb;code text;did uuid;subject text:='outbox_jobs';l core.leads;allowed boolean:=true;
begin
 perform private.p05_worker_scope(org);perform 1 from core.organizations where id=org for update;
 select * into j from core.outbox_jobs where org_id=org and id=(r->>'job_id')::uuid for update;
 select * into c from private.p05_jobs where job_id=j.id and org_id=org;
 if c.job_id is null or c.operation<>op or c.operation_key is distinct from (r->>'operation_key')::uuid or c.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 if c.payload_hash is not null and c.payload_hash<>encode(extensions.digest((r-'request_id')::text,'sha256'),'hex') then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if j.state<>'succeeded' and (j.state<>'running' or j.lease_until<=clock_timestamp()) then perform private.fail('OPERATION_IN_PROGRESS');end if;
 begin
 if private.access_mode(org) not in ('normal','grace') then perform private.fail('SERVICE_UNAVAILABLE');end if;
 perform private.require_feature(org,'F26');
 if c.center_id is not null and not private.center_accessible(org,c.center_id) then perform private.fail('NOT_FOUND');end if;
 if op='automation_run_v1' then
  perform private.require_feature(org,'F24');select * into a from core.automations where org_id=org and id=c.automation_id;select * into x from private.p05_configuration_scopes where entity_id=a.id and org_id=org;
  if a.id is null or x.entity_id is null or not exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and p.name='business') or not x.enabled or a.state<>'active' or not(c.center_id=any(x.execution_center_ids)) or not private.is_manager(org,x.creator_person_id,c.center_id) then perform private.fail('FORBIDDEN');end if;
 elsif op='reminder_schedule_v1' then
  perform private.require_feature(org,'F27');
  if not exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and p.name in ('pro','business')) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
 if j.state='succeeded' and c.result is not null then return c.result;end if;

  if op='outbox_deliver_v1' then
   if j.kind<>'in_app' or j.notification_id is null or not exists(select 1 from core.notifications where org_id=org and id=j.notification_id and recipient_person_id=c.person_id) then perform private.fail('NOT_FOUND');end if;
   did:=j.notification_id;subject:='notifications';
  elsif op='reminder_schedule_v1' then
   allowed:=private.p05_optional_allowed(org,c.person_id,'reminder');
   if c.event_key='lesson' then
    select * into res from core.reservations where org_id=org and id=c.target_id and person_id=c.person_id and center_id=c.center_id and state='active';
    allowed:=allowed and res.id is not null and exists(select 1 from core.sessions where org_id=org and id=res.session_id and state='planned' and starts_at>clock_timestamp() and starts_at<=clock_timestamp()+interval '24 hours');
    subject:='reservations';
   else
    select * into sal from core.sales where org_id=org and id=c.target_id and person_id=c.person_id and center_id=c.center_id and state='active';
    select * into policy from private.policy_at(org,c.center_id,'entitlement_reminder_days',clock_timestamp());
    if policy.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
    allowed:=allowed and sal.id is not null and sal.valid_until>clock_timestamp() and sal.valid_until<=clock_timestamp()+make_interval(days=>(policy.value->>'value')::int) and not exists(select 1 from core.sales where org_id=org and previous_sale_id=sal.id and state='active');subject:='sales';
   end if;
   if allowed then insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(nid,org,c.person_id,'reminder',c.target_id,jsonb_build_object('template_key','p05.'||c.event_key,'subject',jsonb_build_object('type',subject,'id',c.target_id)));did:=nid;subject:='notifications';else did:=j.id;subject:='outbox_jobs';end if;
  elsif op='automation_run_v1' then
   allowed:=exists(select 1 from private.p05_automation_candidates(org,c.center_id,a.trigger) z where z.person_id=c.person_id and z.target_id=c.target_id and a.version::text||':'||z.event_key=c.event_key) and private.p05_segment_matches(org,c.center_id,c.person_id,a.segment_id);
   if allowed then
    insert into core.automation_runs(id,org_id,automation_id,person_id,event_key,state) values(run_id,org,a.id,c.person_id,c.event_key,'running');
    if a.action->>'kind'='send_reminder' then
     perform private.require_feature(org,'F27');
     if a.action->>'channel'<>'in_app' then perform private.fail('SERVICE_UNAVAILABLE');end if;
     if private.p05_optional_allowed(org,c.person_id,'reminder') then insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(nid,org,c.person_id,'reminder',c.person_id,jsonb_build_object('template_key',a.action->>'template_key','subject',jsonb_build_object('type','people','id',c.person_id)));end if;
    elsif a.action->>'kind'='create_followup' then
     select * into l from core.leads where org_id=org and center_id=c.center_id and person_id=c.person_id and state='open' order by created_at,id limit 1;
     insert into core.crm_activities(id,org_id,center_id,lead_id,person_id,kind,due_at,note) values(nid,org,c.center_id,l.id,c.person_id,'followup',clock_timestamp(),a.action->>'template_key');
     insert into private.p05_automation_activities values(nid,a.id,run_id);
    else perform private.fail('VALIDATION_FAILED');end if;
    update core.automation_runs set state='succeeded',version=version+1 where id=run_id;did:=run_id;subject:='automation_runs';
   else did:=j.id;subject:='outbox_jobs';end if;
  else perform private.fail('FORBIDDEN');end if;
  out_data:=jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','succeeded','result_reference',jsonb_build_object('type',subject,'id',did)),'trace_id',private.new_id(ids,1));
  insert into core.operation_receipts(id,org_id,actor_fingerprint,operation,key_hash,payload_hash,state,result,result_expires_at,business_reference) values(private.new_id(ids,3),org,'worker:p05:'||session_user,op,encode(extensions.digest(r->>'operation_key','sha256'),'hex'),encode(extensions.digest((r-'request_id')::text,'sha256'),'hex'),'succeeded',out_data,clock_timestamp()+interval '30 days',did);
  insert into core.audit_events(id,org_id,action,subject_table,subject_id,operation_id,diff) values(private.new_id(ids,4),org,op,subject,did,private.new_id(ids,3),jsonb_build_object('worker_role',session_user,'job_id',j.id,'center_id',c.center_id,'creator_person_id',x.creator_person_id));
  update core.outbox_jobs set state='succeeded',lease_until=null,version=version+1 where id=j.id;
  update private.p05_jobs set result=out_data,payload_hash=encode(extensions.digest((r-'request_id')::text,'sha256'),'hex') where job_id=j.id;
  set constraints all immediate;set constraints all deferred;return out_data;
 exception when others then if j.state='succeeded' then raise;end if;code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;end;
 update core.outbox_jobs set state=case when attempts>=3 then 'failed' else 'retry_wait' end,lease_until=null,next_attempt_at=clock_timestamp()+interval '5 seconds',version=version+1 where id=j.id;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',j.attempts<3,'trace_id',private.new_id(ids,1)));
end$$;
revoke all on function private.p05_worker_execute(text,jsonb,uuid[]),private.p05_jobs_claim(uuid,uuid[],int) from public,anon,authenticated;
grant usage on schema private to ftk_p05_worker;
grant execute on function private.p05_worker_execute(text,jsonb,uuid[]),private.p05_jobs_claim(uuid,uuid[],int) to ftk_p05_worker;
commit;
