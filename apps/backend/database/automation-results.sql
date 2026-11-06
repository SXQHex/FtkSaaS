begin;
alter table private.p05_jobs add column domain_result jsonb;
create function private.automation_retry_eligible(c private.p05_jobs,a core.automations,x private.p05_configuration_scopes) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not coalesce(x.enabled and a.state='active' and private.current_plan_name(c.org_id) in ('pro','business') and private.access_mode(c.org_id) in ('normal','grace') and c.center_id=any(x.execution_center_ids) and private.center_accessible(c.org_id,c.center_id) and private.is_manager(c.org_id,x.creator_person_id,c.center_id) and split_part(c.event_key,':',1)=a.version::text,false) then return false;end if;
 perform private.require_feature(c.org_id,'F24');
 return private.p05_segment_matches(c.org_id,c.center_id,c.person_id,a.segment_id) and private.p07_automation_allowed(c.org_id,c.center_id,a.trigger,c.target_id) and exists(select 1 from private.p05_automation_candidates(c.org_id,c.center_id,a.trigger) z where z.person_id=c.person_id and z.target_id=c.target_id and a.version::text||':'||z.event_key=c.event_key);
exception when sqlstate 'P0001' then if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','POLICY_NOT_CONFIGURED','NOT_FOUND','FORBIDDEN','SUBSCRIPTION_NOT_STARTED') then return false;end if;raise;
end$$;
create function private.automation_recent_jobs(org uuid,automation uuid,actor uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'version',q.version,'center_id',q.center_id,'person_id',q.person_id,'state',q.state,'attempts',q.attempts,'next_attempt_at',q.next_attempt_at,'safe_error_code',q.safe_error_code,'result_reference',coalesce(q.domain_result,q.result#>'{data,result_reference}'),'retry_available',q.state='failed' and q.eligible and q.no_result) order by q.created_at desc,q.id desc),'[]') from (
 select j.*,c.center_id,c.person_id,c.safe_error_code,c.result,c.domain_result,private.automation_retry_eligible(c,a,x) eligible,
 not exists(select 1 from core.automation_runs z where z.org_id=$1 and z.automation_id=$2 and z.person_id=c.person_id and z.event_key=c.event_key) no_result
 from private.p05_jobs c join core.outbox_jobs j on j.id=c.job_id join core.automations a on a.org_id=c.org_id and a.id=c.automation_id join private.p05_configuration_scopes x on x.entity_id=a.id
 where c.org_id=$1 and c.automation_id=$2 and private.is_manager($1,$3,c.center_id) order by j.created_at desc,j.id desc limit 20
 ) q
$$;
create function private.automation_retry(r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a core.automations;x private.p05_configuration_scopes;c private.p05_jobs;j core.outbox_jobs;definition jsonb;
begin
 perform private.require_feature(org,'F24');
 select * into a from core.automations where org_id=org and id=(r->>'automation_id')::uuid for update;
 select * into x from private.p05_configuration_scopes where org_id=org and entity_id=a.id;
 if a.id is null or x.entity_id is null or x.center_id is distinct from (r#>>'{scope,center_id}')::uuid then perform private.fail('NOT_FOUND');end if;
 if a.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if not x.enabled or a.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 definition:=jsonb_build_object('name',a.name,'trigger',a.trigger,'action',a.action,'segment_id',a.segment_id,'execution_center_ids',x.execution_center_ids,'enabled',x.enabled);
 if coalesce(r->'definition','{}')||jsonb_build_object('segment_id',coalesce(r#>'{definition,segment_id}','null'::jsonb)) is distinct from definition then perform private.fail('VALIDATION_FAILED');end if;
 select * into c from private.p05_jobs where org_id=org and automation_id=a.id and job_id=(r#>>'{retry_job,id}')::uuid;
 if c.job_id is null or (center is not null and c.center_id<>center) or not private.is_manager(org,actor,c.center_id) then perform private.fail('NOT_FOUND');end if;
 select * into j from core.outbox_jobs where org_id=org and id=c.job_id for update;
 if j.version is distinct from (r#>>'{retry_job,version}')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if j.state<>'failed' or split_part(c.event_key,':',1)<>a.version::text or exists(select 1 from core.automation_runs z where z.org_id=org and z.automation_id=a.id and z.person_id=c.person_id and z.event_key=c.event_key) then perform private.fail('INVALID_STATE_TRANSITION');end if;
 if not private.automation_retry_eligible(c,a,x) then perform private.fail('INVALID_STATE_TRANSITION');end if;
 update core.outbox_jobs set state='pending',attempts=0,lease_until=null,next_attempt_at=clock_timestamp(),version=version+1 where id=j.id;
 -- Invalidate every old lease before the next claim; successful domain effects
 -- are never retried, even with a new operation key.
 update private.p05_jobs set lease_hash=null,operation_key=null,payload_hash=null,result=null,domain_result=null,safe_error_code=null where job_id=j.id;
 return jsonb_build_object('data',null,'primary_id',a.id,'subject','automations','version',a.version);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p05_notifications(text,jsonb,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:='  c:=private.p05_configuration(org,center,actor,r->''scope'');definition:=r->''definition'';';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation retry dispatch drift';end if;
 execute replace(b,a,a||$a$
  if op='automation_save_v1' and r?'retry_job' then return private.automation_retry(r,org,center,actor);end if;
$a$);
 b:=pg_get_functiondef('private.p05_management(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:='jsonb_build_object(''automation_id'',a.id,''definition''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation jobs projection drift';end if;
 execute replace(b,a,'jsonb_build_object(''recent_jobs'',private.automation_recent_jobs(org,a.id,actor),''automation_id'',a.id,''definition''');
 -- A claimed job must still respect closure epochs immediately before effects.
 b:=pg_get_functiondef('private.p05_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:='    update core.automation_runs set state=';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation result reference drift';end if;
 b:=replace(b,a,$a$    update private.p05_jobs set domain_result=case when a.action->>'kind'='create_followup' then jsonb_build_object('type','crm_activities','id',nid) when exists(select 1 from core.notifications n where n.org_id=org and n.id=nid) then jsonb_build_object('type','notifications','id',nid) end where job_id=j.id;
$a$||a);
 a:='   allowed:=exists(select 1 from private.p05_automation_candidates';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation final closure recheck drift';end if;
 execute replace(b,a,'   allowed:=private.p07_automation_allowed(org,c.center_id,a.trigger,c.target_id) and exists(select 1 from private.p05_automation_candidates');
end$patch$;
revoke all on function private.automation_retry_eligible(private.p05_jobs,core.automations,private.p05_configuration_scopes),private.automation_recent_jobs(uuid,uuid,uuid),private.automation_retry(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.automation_retry_eligible(private.p05_jobs,core.automations,private.p05_configuration_scopes),private.automation_recent_jobs(uuid,uuid,uuid),private.automation_retry(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
