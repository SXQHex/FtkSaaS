begin;
alter table private.p05_jobs add column reminder_source_version text;
alter table private.p05_jobs add column safe_error_code text;
create function private.reminder_jobs_seed(org uuid,ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare item record;ctx jsonb;idx int:=1;jid uuid;fingerprint text;
begin
 if not private.reminder_licensed(org) then return;end if;
 for item in
  select q.* from (
   select id,center_id,person_id,'lesson'::text kind from core.reservations where org_id=org and state='active'
   union all select id,center_id,person_id,'entitlement' from core.sales where org_id=org and state='active'
   union all select id,center_id,person_id,'event' from core.event_registrations where org_id=org and state='active'
   union all select id,center_id,person_id,'payment' from core.debts where org_id=org and state='open'
  ) q cross join lateral(select private.reminder_context(org,q.center_id,q.person_id,q.kind,q.id) context) live
  where live.context is not null and (live.context->>'due_at')::timestamptz<=clock_timestamp()
  and not exists(select 1 from core.outbox_jobs j where j.org_id=org and j.kind='p05.reminder' and j.dedupe_key='p05.'||q.kind||':'||q.id::text||':'||md5(live.context->>'source_version'))
  order by (live.context->>'expires_at')::timestamptz,q.id limit 200
 loop
  ctx:=private.reminder_context(org,item.center_id,item.person_id,item.kind,item.id);
  if ctx is null or (ctx->>'due_at')::timestamptz>clock_timestamp() then continue;end if;
  fingerprint:='p05.'||item.kind||':'||item.id::text||':'||md5(ctx->>'source_version');
  if exists(select 1 from core.outbox_jobs where org_id=org and kind='p05.reminder' and dedupe_key=fingerprint) then continue;end if;
  jid:=private.new_id(ids,idx);idx:=idx+1;
  insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values(jid,org,'p05.reminder',fingerprint,'pending',0,clock_timestamp()) on conflict do nothing;
  if found then insert into private.p05_jobs(job_id,org_id,operation,target_id,center_id,person_id,event_key,reminder_source_version) values(jid,org,'reminder_schedule_v1',item.id,item.center_id,item.person_id,item.kind,ctx->>'source_version');end if;
 end loop;
end$$;
-- Rebind pre-migration generations conservatively, preserving existing success
-- evidence. Future start/expiry changes get a new generation, retries do not.
update private.p05_jobs c set reminder_source_version=private.reminder_source_generation(c.org_id,c.event_key,c.target_id)
 where c.operation='reminder_schedule_v1' and c.reminder_source_version is null;
update core.outbox_jobs j set dedupe_key=dedupe_key||':'||md5(c.reminder_source_version)
 from private.p05_jobs c where c.job_id=j.id and c.operation='reminder_schedule_v1' and c.reminder_source_version is not null and j.dedupe_key='p05.'||c.event_key||':'||c.target_id::text;
-- Keep the mature claim, scope, lease, billing and audit paths. Replace only
-- the former hardcoded reminder seed and source eligibility branch.
do $patch$
declare b text;a text;z text;start_at int;end_at int;
begin
 b:=pg_get_functiondef('private.p05_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 a:=' if exists(select 1 from core.saas_subscriptions';z:=' for cfg in select a.*';start_at:=strpos(b,a);end_at:=strpos(b,z);
 if start_at=0 or end_at<=start_at then raise exception 'Reminder seed branch drift';end if;
 b:=overlay(b placing ' perform private.reminder_jobs_seed(org,ids[301:500]);'||E'\n' from start_at for end_at-start_at);
 a:=' for j in select j.*';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker exhausted lease diagnostic drift';end if;
 b:=replace(b,a,' update private.p05_jobs c set safe_error_code=''TEMPORARY_FAILURE'' from core.outbox_jobs j where j.id=c.job_id and c.org_id=org and j.state=''failed'' and c.safe_error_code is null;'||E'\n'||a);execute b;
 b:=pg_get_functiondef('private.p05_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:='allowed boolean:=true;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reminder execution context drift';end if;
 b:=replace(b,a,a||'reminder jsonb;');
 a:='   allowed:=private.p05_optional_allowed(org,c.person_id,''reminder'');';z:='  elsif op=''automation_run_v1'' then';start_at:=strpos(b,a);end_at:=strpos(b,z);
 if start_at=0 or end_at<=start_at then raise exception 'Reminder execution branch drift';end if;
 b:=overlay(b placing $a$   reminder:=private.reminder_context(org,c.center_id,c.person_id,c.event_key,c.target_id);
   allowed:=reminder is not null and (c.reminder_source_version is null or reminder->>'source_version'=c.reminder_source_version);
   if allowed and (reminder->>'due_at')::timestamptz>clock_timestamp() then
    update core.outbox_jobs set state='pending',attempts=greatest(attempts-1,0),lease_until=null,next_attempt_at=(reminder->>'due_at')::timestamptz,version=version+1 where id=j.id;
    return jsonb_build_object('ok',true,'data',jsonb_build_object('job_id',j.id,'state','pending'),'trace_id',private.new_id(ids,1));
   end if;
   if allowed then
    insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values(nid,org,c.person_id,'reminder',c.target_id,jsonb_build_object('template_key','p05.'||c.event_key,'reminder_center_id',c.center_id,'reminder_source_version',reminder->>'source_version','subject',jsonb_build_object('type',reminder->>'subject_type','id',c.target_id)));
    did:=nid;subject:='notifications';
   else did:=j.id;subject:='outbox_jobs';end if;
$a$ from start_at for end_at-start_at);
 a:='when SQLSTATE=''P0001'' then SQLERRM else ''INTEGRITY_VIOLATION''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker safe diagnostic allowlist drift';end if;
 b:=replace(b,a,'when SQLSTATE=''P0001'' and SQLERRM in (''FORBIDDEN'',''NOT_FOUND'',''VALIDATION_FAILED'',''PLAN_FEATURE_UNAVAILABLE'',''PLAN_LIMIT_REACHED'',''POLICY_NOT_CONFIGURED'',''SERVICE_UNAVAILABLE'',''BILLING_OPERATION_RESTRICTED'',''INVALID_STATE_TRANSITION'',''SUBSCRIPTION_NOT_STARTED'') then SQLERRM else ''INTEGRITY_VIOLATION''');
 a:='update private.p05_jobs set result=out_data,';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker success error reset drift';end if;
 b:=replace(b,a,'update private.p05_jobs set safe_error_code=null,result=out_data,');
 a:=' update core.outbox_jobs set state=case when attempts>=3';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Worker failure diagnostic drift';end if;
 b:=replace(b,a,' update private.p05_jobs set safe_error_code=code where job_id=j.id;'||E'\n'||a);execute b;
end$patch$;
revoke all on function private.reminder_jobs_seed(uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.reminder_jobs_seed(uuid,uuid[]) to service_role;
commit;
