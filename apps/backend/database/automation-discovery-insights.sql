-- W1-BE-29: inspect existing native predicates/jobs; never invoke a worker.
begin;
create index automation_scope_history on private.p05_jobs(org_id,center_id,automation_id,job_id);
create function private.segment_insight_people(org uuid,center uuid,actor uuid,segment uuid) returns table(id uuid,created_at timestamptz,display_name text,matches boolean)
language sql stable security invoker set search_path='' as $$
 select p.id,p.created_at,p.display_name,private.p05_segment_matches(org,center,p.id,segment)
 from core.people p where p.org_id=org and p.state='active' and private.center_accessible(org,center) and private.is_manager(org,actor,center) and (
  exists(select 1 from core.center_relationships r where r.org_id=org and r.center_id=center and r.kind='student' and private.p07_same_person(org,r.person_id,p.id))
  or exists(select 1 from core.leads l where l.org_id=org and l.center_id=center and private.p07_same_person(org,l.person_id,p.id)))
$$;
create function private.automation_insight_jobs(org uuid,config_center uuid,actor uuid,automation uuid,lo timestamptz,hi timestamptz,stamp timestamptz)
returns table(id uuid,created_at timestamptz,state text,item jsonb,result_ref jsonb)
language sql stable security invoker set search_path='' as $$
 select j.id,j.created_at,j.state,
 jsonb_build_object('id',j.id,'version',j.version,'center_id',c.center_id,'person_id',c.person_id,'state',j.state,'attempts',j.attempts,
  'next_attempt_at',j.next_attempt_at,'safe_error_code',c.safe_error_code,'result_reference',coalesce(c.domain_result,c.result#>'{data,result_reference}'),
  'retry_available',j.state='failed' and private.automation_retry_eligible(c,a,x) and not exists(select 1 from core.automation_runs z where z.org_id=org and z.automation_id=a.id and z.person_id=c.person_id and z.event_key=c.event_key),
  'created_at',j.created_at,'automation_id',a.id,'automation_version',a.version,'automation_name',a.name,'configuration_creator_person_id',x.creator_person_id,'initiator_kind','automation'),
 coalesce(c.domain_result,c.result#>'{data,result_reference}')
 from private.p05_jobs c join core.outbox_jobs j on j.org_id=c.org_id and j.id=c.job_id
 join core.automations a on a.org_id=c.org_id and a.id=c.automation_id
 join private.p05_configuration_scopes x on x.org_id=c.org_id and x.entity_id=a.id
 where c.org_id=org and x.center_id is not distinct from config_center and (automation is null or a.id=automation)
  and private.center_accessible(org,c.center_id) and private.is_manager(org,actor,c.center_id) and j.created_at<=stamp
  and (lo is null or j.created_at>=lo) and (hi is null or j.created_at<hi)
$$;
create function private.automation_insight_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';view_name text:=k->>'discovery';c uuid;execution_center uuid:=(k->>'execution_center_id')::uuid;
 seg core.segments;selected core.automations;lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text;h text;cur jsonb;last_at timestamptz;last_id uuid;
 stamp timestamptz:=statement_timestamp();items jsonb;token text;summary jsonb;lo timestamptz:=(k#>>'{interval,starts_at}')::timestamptz;hi timestamptz:=(k#>>'{interval,ends_at}')::timestamptz;
begin
 if op not in ('segment_save_v1','automation_save_v1') or r#>>'{selector,operation}' is distinct from op or lim<1 or lim>200
  or (r->'entity' is not null and r->'entity'<>'null'::jsonb) then perform private.fail('VALIDATION_FAILED');end if;
 perform private.p05_access(op,r||k,org,center,actor,account);
 c:=case when k#>>'{scope,kind}'='center' then (k#>>'{scope,center_id}')::uuid else null end;
 if op='segment_save_v1' then
  if view_name is null or view_name not in ('matches','automations') then perform private.fail('VALIDATION_FAILED');end if;
  select s.* into seg from core.segments s join private.p05_configuration_scopes x on x.org_id=s.org_id and x.entity_id=s.id
   where s.org_id=org and s.id=(k->>'segment_id')::uuid and x.center_id is not distinct from c;
  if seg.id is null then perform private.fail('NOT_FOUND');end if;
  if view_name='matches' then
   if seg.state<>'active' or execution_center is null or (c is not null and c<>execution_center) or not private.center_accessible(org,execution_center) then perform private.fail('NOT_FOUND');end if;
   if not private.is_manager(org,actor,execution_center) then perform private.fail('FORBIDDEN');end if;
  end if;
 else
  if view_name is distinct from 'jobs' then perform private.fail('VALIDATION_FAILED');end if;
  if k->>'automation_id' is not null then
   select a.* into selected from core.automations a join private.p05_configuration_scopes x on x.org_id=a.org_id and x.entity_id=a.id
    where a.org_id=org and a.id=(k->>'automation_id')::uuid and x.center_id is not distinct from c;
   if selected.id is null then perform private.fail('NOT_FOUND');end if;
  end if;
  if k?'interval' and (lo is null or hi is null or not isfinite(lo) or not isfinite(hi) or lo>=hi) then perform private.fail('VALIDATION_FAILED');end if;
 end if;
 sorting:=coalesce(r#>>'{page,sort}',case when view_name='jobs' then 'created_at_desc' else 'created_at_asc' end);
 if sorting not in ('created_at_asc','created_at_desc') then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page','sort',sorting,'segment_version',seg.version)::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;stamp:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(stamp) or stamp>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 if view_name='matches' then
  with audience as materialized(select * from private.segment_insight_people(org,execution_center,actor,seg.id)),page as (
   select * from audience p where p.matches and (last_id is null or sorting='created_at_asc' and (p.created_at,p.id)>(last_at,last_id) or sorting='created_at_desc' and (p.created_at,p.id)<(last_at,last_id))
    order by case when sorting='created_at_asc' then p.created_at end,case when sorting='created_at_desc' then p.created_at end desc,
     case when sorting='created_at_asc' then p.id end,case when sorting='created_at_desc' then p.id end desc limit lim+1
  ) select coalesce((select jsonb_agg(jsonb_build_object('operation','segment_save_v1','entity',jsonb_build_object('type','people','id',p.id),'exists',true,'state','active',
   'versions','[]'::jsonb,'as_of',stamp,'current',null,'segment_match',jsonb_build_object('person_id',p.id,'display_name',p.display_name),'_at',p.created_at) order by
   case when sorting='created_at_asc' then p.created_at end,case when sorting='created_at_desc' then p.created_at end desc,case when sorting='created_at_asc' then p.id end,case when sorting='created_at_desc' then p.id end desc) from page p),'[]'),
   jsonb_build_object('audience_count',(select count(*) from audience),'matched_count',(select count(*) from audience where matches),
    'using_automations',(select count(*) from core.automations a join private.p05_configuration_scopes x on x.org_id=a.org_id and x.entity_id=a.id where a.org_id=org and a.segment_id=seg.id and ((x.center_id is null and private.is_org_reader(org,actor)) or (x.center_id is not null and private.center_accessible(org,x.center_id) and private.is_manager(org,actor,x.center_id))))) into items,summary;
 elsif view_name='automations' then
  select coalesce(jsonb_agg(q.item order by case when sorting='created_at_asc' then q.created_at end,case when sorting='created_at_desc' then q.created_at end desc,case when sorting='created_at_asc' then q.id end,case when sorting='created_at_desc' then q.id end desc),'[]') into items from (
   select a.id,a.created_at,jsonb_build_object('operation','automation_save_v1','entity',jsonb_build_object('type','automations','id',a.id),'exists',true,'state',a.state,
    'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','automations','id',a.id),'version',a.version)),'as_of',stamp,'current',null,
    'automation_reference',jsonb_build_object('id',a.id,'version',a.version,'name',a.name,'enabled',x.enabled),'_at',a.created_at) item
   from core.automations a join private.p05_configuration_scopes x on x.org_id=a.org_id and x.entity_id=a.id
   where a.org_id=org and a.segment_id=seg.id and ((x.center_id is null and private.is_org_reader(org,actor)) or (x.center_id is not null and private.center_accessible(org,x.center_id) and private.is_manager(org,actor,x.center_id)))
    and (last_id is null or sorting='created_at_asc' and (a.created_at,a.id)>(last_at,last_id) or sorting='created_at_desc' and (a.created_at,a.id)<(last_at,last_id))
   order by case when sorting='created_at_asc' then a.created_at end,case when sorting='created_at_desc' then a.created_at end desc,
    case when sorting='created_at_asc' then a.id end,case when sorting='created_at_desc' then a.id end desc limit lim+1
  ) q;
 else
  with scoped as materialized(select * from private.automation_insight_jobs(org,c,actor,selected.id,lo,hi,stamp)),page as (
   select * from scoped j where (coalesce(k->>'state','all')='all' or j.state=k->>'state')
    and (last_id is null or sorting='created_at_asc' and (j.created_at,j.id)>(last_at,last_id) or sorting='created_at_desc' and (j.created_at,j.id)<(last_at,last_id))
   order by case when sorting='created_at_asc' then j.created_at end,case when sorting='created_at_desc' then j.created_at end desc,
    case when sorting='created_at_asc' then j.id end,case when sorting='created_at_desc' then j.id end desc limit lim+1
  ) select coalesce((select jsonb_agg(jsonb_build_object('operation','automation_save_v1','entity',jsonb_build_object('type','outbox_jobs','id',j.id),'exists',true,'state',j.state,
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','outbox_jobs','id',j.id),'version',j.item->'version')),'as_of',stamp,'current',null,'automation_job',j.item,'_at',j.created_at) order by
   case when sorting='created_at_asc' then j.created_at end,case when sorting='created_at_desc' then j.created_at end desc,case when sorting='created_at_asc' then j.id end,case when sorting='created_at_desc' then j.id end desc) from page j),'[]'),
   jsonb_build_object('total',(select count(*) from scoped),'pending',(select count(*) from scoped where state='pending'),'running',(select count(*) from scoped where state='running'),
    'retry_wait',(select count(*) from scoped where state='retry_wait'),'succeeded',(select count(*) from scoped where state='succeeded'),'failed',(select count(*) from scoped where state='failed'),
    'cancelled',(select count(*) from scoped where state='cancelled'),'notifications_created',(select count(distinct result_ref->>'id') from scoped where result_ref->>'type'='notifications'),
    'followups_created',(select count(distinct result_ref->>'id') from scoped where result_ref->>'type'='crm_activities'),'email_delivery','not_supported') into items,summary;
 end if;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',items->-1#>'{entity,id}','as_of',stamp)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]') into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp)||case when view_name='matches' then jsonb_build_object('segment_summary',summary) when view_name='jobs' then jsonb_build_object('automation_queue_summary',summary) else '{}'::jsonb end;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Automation insight dispatch anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation' in ('segment_save_v1','automation_save_v1') and r#>>'{selector,key,discovery}' is not null then
  out:=private.automation_insight_directory(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.segment_insight_people(uuid,uuid,uuid,uuid),private.automation_insight_jobs(uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz),private.automation_insight_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.segment_insight_people(uuid,uuid,uuid,uuid),private.automation_insight_jobs(uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz),private.automation_insight_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
