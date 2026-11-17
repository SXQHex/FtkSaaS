-- One pending-work projection over native sources; no independent task lifecycle.
begin;
create index management_pending_request on core.lesson_requests(org_id,center_id,created_at,id) where state in ('pending','alternative_offered');
create index management_open_attendance on core.sessions(org_id,center_id,created_at,id) where actual_started_at is not null and attendance_state<>'closed' and state<>'cancelled';
create function private.management_work_allowed(kind text,org uuid,center uuid,actor uuid,target uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare q core.lesson_requests;s core.sessions;e core.events;a core.crm_activities;app core.public_applications;r jsonb:=jsonb_build_object('org_id',org,'center_id',center);
begin
 if not private.center_accessible(org,center) then return false;end if;
 if kind='lesson_request' then
  select * into q from core.lesson_requests where org_id=org and center_id=center and id=target;
  if q.id is null or not private.lesson_request_actionable(q) or not private.work_alert_recipient(org,center,actor,'pending_request',q.id) then return false;end if;
  r:=r||jsonb_build_object('lesson_request_id',q.id);
  return private.member_summary_enabled(org,array['lesson_request_reject_v1'],r)
   and exists(select 1 from jsonb_array_elements(private.p01_requests_page(r||jsonb_build_object('operation','lesson_request_create_v1','page',jsonb_build_object('limit',1)),org,actor,center)->'items') x where x#>>'{entity,id}'=q.id::text);
 elsif kind='lesson_attendance' then
  select * into s from core.sessions where org_id=org and center_id=center and id=target;
  return s.id is not null and s.state<>'cancelled' and s.attendance_state<>'closed' and s.actual_started_at is not null and s.starts_at<=statement_timestamp()
   and private.work_alert_recipient(org,center,actor,'unclosed_attendance',s.id)
   and private.member_summary_enabled(org,array['attendance_get_v1'],r||jsonb_build_object('session_id',s.id));
 elsif kind='event_attendance' then
  select * into e from core.events where org_id=org and center_id=center and id=target;
  return e.id is not null and e.state in ('published','occurred') and e.attendance_state<>'closed' and e.actual_started_at is not null and e.starts_at<=statement_timestamp()
   and (private.is_manager(org,actor,center) or private.event_assignee(org,actor,e.id))
   and private.member_summary_enabled(org,array['event_attendance_mark_v1'],r||jsonb_build_object('event_id',e.id));
 elsif kind='crm_followup' then
  select * into a from core.crm_activities where org_id=org and center_id=center and id=target;
  if a.id is null or a.kind<>'followup' or a.completed_at is not null or a.due_at is null then return false;end if;
  r:=r||jsonb_build_object('activity_id',a.id,'lead_id',a.lead_id,'person_id',a.person_id);
  if a.lead_id is null then perform private.require_feature(org,'F23');perform private.p05_person_activity_access(org,center,actor,r);
  else
   if not exists(select 1 from core.leads l where l.org_id=org and l.center_id=center and l.id=a.lead_id and l.state='open') then return false;end if;
   perform private.p04_access('crm_activity_save_v1',r-'person_id',org,center,actor);
  end if;
  return private.member_summary_enabled(org,array['crm_activity_save_v1'],r);
 elsif kind='application_review' then
  select * into app from core.public_applications where org_id=org and center_id=center and id=target;
  if app.id is null or app.state<>'pending' then return false;end if;
  r:=r||jsonb_build_object('application_id',app.id);perform private.crm_application_access(r,org,center,actor);
  return private.member_summary_enabled(org,array['public_application_review_v1'],r);
 end if;
 return false;
exception when sqlstate 'P0001' then
 if sqlerrm in ('FORBIDDEN','NOT_FOUND','PLAN_FEATURE_UNAVAILABLE','PLAN_LIMIT_REACHED','SUBSCRIPTION_NOT_STARTED','BILLING_OPERATION_RESTRICTED') then return false;end if;raise;
end$$;
create function private.management_work_rows(org uuid,center uuid,actor uuid,stamp timestamptz)
returns table(id uuid,created_at timestamptz,kind text,item jsonb)
language sql stable security invoker set search_path='' as $$
 with sources as (
  select q.id,q.created_at,'lesson_request'::text kind,q.version,'Özel ders talebi'::text title,q.person_id,null::timestamptz due,
   jsonb_build_object('operation','management_state_get_v1','selector',jsonb_build_object('operation','lesson_request_create_v1','key',jsonb_build_object('lesson_request_id',q.id))) target
  from core.lesson_requests q where q.org_id=org and q.center_id=center and q.state in ('pending','alternative_offered')
  union all
  select s.id,s.created_at,'lesson_attendance',s.version,coalesce(c.name,d.name,'Ders yoklaması'),null,null,
   jsonb_build_object('operation','session_get_v1','session_id',s.id)
  from core.sessions s left join core.classes c on c.org_id=s.org_id and c.id=s.class_id left join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
  where s.org_id=org and s.center_id=center and s.actual_started_at is not null and s.attendance_state<>'closed' and s.state<>'cancelled'
  union all
  select e.id,e.created_at,'event_attendance',e.version,e.name,null,null,jsonb_build_object('operation','event_get_v1','event_id',e.id)
  from core.events e where e.org_id=org and e.center_id=center and e.actual_started_at is not null and e.attendance_state<>'closed' and e.state in ('published','occurred')
  union all
  select a.id,a.created_at,'crm_followup',a.version,coalesce(a.note,'CRM takibi'),coalesce(l.person_id,a.person_id),a.due_at,
   jsonb_build_object('operation','management_state_get_v1','selector',jsonb_build_object('operation','crm_activity_save_v1','key',jsonb_build_object('activity_id',a.id)||case when a.lead_id is null then jsonb_build_object('person_id',a.person_id) else jsonb_build_object('lead_id',a.lead_id) end))
  from core.crm_activities a left join core.leads l on l.org_id=a.org_id and l.id=a.lead_id
  where a.org_id=org and a.center_id=center and a.kind='followup' and a.completed_at is null and a.due_at is not null
  union all
  select a.id,a.created_at,'application_review',a.version,'Başvuru incelemesi',a.person_id,null,
   jsonb_build_object('operation','management_state_get_v1','selector',jsonb_build_object('operation','public_application_review_v1','key',jsonb_build_object('application_id',a.id)))
  from core.public_applications a where a.org_id=org and a.center_id=center and a.state='pending'
 ) select s.id,s.created_at,s.kind,jsonb_build_object('id',s.id,'kind',s.kind,'created_at',s.created_at,'version',s.version,'title',s.title,
  'person_id',case when s.person_id is null then null else private.p07_person_root(org,s.person_id) end,
  'person_name',(select p.display_name from core.people p where p.org_id=org and p.id=private.p07_person_root(org,s.person_id)),
  'due_at',s.due,'target',s.target)
 from sources s where s.created_at<=stamp and private.management_work_allowed(s.kind,org,center,actor,s.id)
$$;
create function private.management_work_page(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text:=coalesce(r#>>'{page,sort}','created_at_asc');wanted text:=coalesce(r->>'kind','all');stamp timestamptz:=statement_timestamp();h text;
 cur jsonb;last_at timestamptz;last_id uuid;last_kind text;items jsonb;summary jsonb;token text;
begin
 if center is null or not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if actor is null or not exists(select 1 from core.people p where p.org_id=org and p.id=actor and p.state='active') then perform private.fail('FORBIDDEN');end if;
 if lim<1 or lim>200 or sorting not in ('created_at_asc','created_at_desc') or wanted not in ('all','lesson_request','lesson_attendance','event_attendance','crm_followup','application_review') then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('account',account,'actor',actor,'request',r-'request_id'-'page','sort',sorting)::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'kind' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;last_kind:=cur->>'kind';stamp:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(stamp) or stamp>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with scoped as materialized(select * from private.management_work_rows(org,center,actor,stamp)),page as (
  select * from scoped where (wanted='all' or kind=wanted) and (last_id is null or sorting='created_at_asc' and (created_at,id,kind)>(last_at,last_id,last_kind) or sorting='created_at_desc' and (created_at,id,kind)<(last_at,last_id,last_kind))
  order by case when sorting='created_at_asc' then created_at end,case when sorting='created_at_desc' then created_at end desc,
   case when sorting='created_at_asc' then id end,case when sorting='created_at_desc' then id end desc,case when sorting='created_at_asc' then kind end,case when sorting='created_at_desc' then kind end desc limit lim+1
 ) select coalesce((select jsonb_agg(item order by case when sorting='created_at_asc' then created_at end,case when sorting='created_at_desc' then created_at end desc,
  case when sorting='created_at_asc' then id end,case when sorting='created_at_desc' then id end desc,case when sorting='created_at_asc' then kind end,case when sorting='created_at_desc' then kind end desc) from page),'[]'),
 jsonb_build_object('total',(select count(*) from scoped),'lesson_request',(select count(*) from scoped where kind='lesson_request'),'lesson_attendance',(select count(*) from scoped where kind='lesson_attendance'),
  'event_attendance',(select count(*) from scoped where kind='event_attendance'),'crm_followup',(select count(*) from scoped where kind='crm_followup'),'application_review',(select count(*) from scoped where kind='application_review')) into items,summary;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'created_at','id',items->-1->'id','kind',items->-1->'kind','as_of',stamp)::text,'utf8'),'hex');end if;
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp,'summary',summary);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=' elsif perm_code=''management.inspect'' and r->>''operation'' in (''waitlist_join_v1''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Management work permission anchor drift';end if;
 b:=replace(b,a,$a$ elsif p_operation='management_work_list_v1' then
  out:=private.management_work_page(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
$a$||a);execute b;
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('management_work_list_v1','management.inspect','read',array[]::text[]);
create function api_v1.management_work_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb
language sql security invoker set search_path='' as $$select private.execute_operation('management_work_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.management_work_allowed(text,uuid,uuid,uuid,uuid),private.management_work_rows(uuid,uuid,uuid,timestamptz),private.management_work_page(jsonb,uuid,uuid,uuid,uuid),api_v1.management_work_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.management_work_allowed(text,uuid,uuid,uuid,uuid),private.management_work_rows(uuid,uuid,uuid,timestamptz),private.management_work_page(jsonb,uuid,uuid,uuid,uuid),api_v1.management_work_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
