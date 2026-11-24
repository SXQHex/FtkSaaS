begin;

create function private.calendar_person_matches(p_org uuid,p_center uuid,p_id uuid,p_type text,p_person uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists (
  select 1 from core.resource_bookings b
  where b.org_id=p_org and b.center_id=p_center and b.resource_kind='person' and b.resource_id=p_person
   and b.state='active' and case when p_type='session' then b.session_id=p_id else b.event_id=p_id end
 ) or case when p_type='session' then
  exists (select 1 from core.session_assignments a
   where a.org_id=p_org and a.center_id=p_center and a.session_id=p_id and a.person_id=p_person and a.state='active')
  or exists (select 1 from core.sessions s join core.class_assignments a
   on a.org_id=s.org_id and a.center_id=s.center_id and a.class_id=s.class_id
   where s.org_id=p_org and s.center_id=p_center and s.id=p_id and s.assignment_mode='legacy'
    and a.person_id=p_person and a.state='active')
 else exists (select 1 from core.event_assignments a
  where a.org_id=p_org and a.center_id=p_center and a.event_id=p_id and a.person_id=p_person) end
$$;

create or replace function private.calendar_session_summary(p_org uuid,p_actor uuid,p_center uuid,p_session uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('state',s.state,'attendance_state',s.attendance_state,'version',s.version,
  'format',s.format,'class_id',s.class_id,'assignments',coalesce((
   select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty) order by a.person_id,a.duty)
   from core.session_assignments a where a.org_id=p_org and a.center_id=p_center and a.session_id=p_session and a.state='active'
  ),'[]'::jsonb)) || case when duty.duty is null then '{}'::jsonb
    else jsonb_build_object('actor_class_duty',jsonb_build_object('duty',duty.duty)) end
 from core.sessions s
 left join lateral (
  select ca.duty
  from core.class_assignments ca
  where ca.org_id=s.org_id and ca.center_id=s.center_id and ca.class_id=s.class_id
   and ca.person_id=p_actor and ca.state='active' and private.has_role(p_org,p_actor,ca.duty,p_center)
   and private.member_summary_enabled(p_org,array['session_get_v1'],
    jsonb_build_object('org_id',p_org,'center_id',p_center,'session_id',p_session))
   and (s.assignment_mode='legacy' or exists (
    select 1 from core.session_assignments a
    where a.org_id=s.org_id and a.center_id=s.center_id and a.session_id=s.id and a.person_id=ca.person_id
     and a.duty=ca.duty and a.origin_class_assignment_id=ca.id and a.state='active'
   ))
  order by (ca.duty='instructor') desc,ca.duty limit 1
 ) duty on true
 where s.org_id=p_org and s.center_id=p_center and s.id=p_session
  and private.session_readable(p_org,p_actor,s.id) and private.starter_session_allowed(p_org,s.id,false)
$$;

create function private.calendar_management_labels(p_org uuid,p_actor uuid,p_center uuid,p_session uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('instructor_labels',coalesce((
  select jsonb_agg(jsonb_build_object('person_id',q.person_id,'name',q.name) order by q.person_id)
  from (
   select distinct a.person_id,private.directory_person_name(p_org,p_center,p_actor,a.person_id) name
   from core.session_assignments a
   where a.org_id=p_org and a.center_id=p_center and a.session_id=p_session and a.state='active' and a.duty='instructor'
  ) q where q.name is not null
 ),'[]'::jsonb)) || case when private.is_manager(p_org,p_actor,p_center) then
  jsonb_build_object('room_labels',coalesce((
   select jsonb_agg(jsonb_build_object('room_id',q.id,'name',q.name) order by q.id)
   from (
    select distinct room.id,room.name from core.resource_bookings b
    join core.rooms room on room.org_id=b.org_id and room.center_id=b.center_id and room.id=b.resource_id
    where b.org_id=p_org and b.center_id=p_center and b.session_id=p_session and b.resource_kind='room'
     and b.state='active' and room.state='active' and private.starter_selected(p_org,'room',room.id)
   ) q
  ),'[]'::jsonb)) else '{}'::jsonb end
$$;

-- Share the discovery labels without computing booking, capacity, or waitlist data.
create function private.member_lesson_labels(org uuid,center uuid,sid uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('instructor_labels',(
 select coalesce(jsonb_agg(q.name order by q.person_id),'[]') from (
  select distinct private.p07_person_root(org,p.id) person_id,p.display_name name
   from jsonb_array_elements(private.schedule_snapshot(org,sid)->'assignments') a
   join core.people p on p.org_id=org and p.id=private.p07_person_root(org,(a->>'person_id')::uuid)
   where a->>'duty'='instructor' and p.state='active' and private.starter_instructor_active(org,center,p.id)
    and private.starter_selected(org,'instructor',p.id)
 ) q), 'room_labels',(

 select coalesce(jsonb_agg(q.name order by q.id),'[]') from (
  select distinct room.id,room.name from core.resource_bookings b join core.rooms room on room.org_id=b.org_id and room.center_id=b.center_id and room.id=b.resource_id
   where b.org_id=org and b.center_id=center and b.session_id=sid and b.resource_kind='room' and b.state='active'
 ) q))
$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.member_lesson_item(uuid,uuid,uuid,uuid,boolean)'::regprocedure);
 a constant text:=$old$ select coalesce(jsonb_agg(q.name order by q.person_id),'[]') into instructors from (
  select distinct private.p07_person_root(org,p.id) person_id,p.display_name name
   from jsonb_array_elements(private.schedule_snapshot(org,sid)->'assignments') a
   join core.people p on p.org_id=org and p.id=private.p07_person_root(org,(a->>'person_id')::uuid)
   where a->>'duty'='instructor' and p.state='active' and private.starter_instructor_active(org,center,p.id)
    and private.starter_selected(org,'instructor',p.id)
 ) q;
 select coalesce(jsonb_agg(q.name order by q.id),'[]') into rooms from (
  select distinct room.id,room.name from core.resource_bookings b join core.rooms room on room.org_id=b.org_id and room.center_id=b.center_id and room.id=b.resource_id
   where b.org_id=org and b.center_id=center and b.session_id=sid and b.resource_kind='room' and b.state='active'
 ) q;$old$;
begin
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Member lesson labels anchor changed';end if;
 execute replace(body,a,$new$ select labels->'instructor_labels',labels->'room_labels' into instructors,rooms
 from private.member_lesson_labels(org,center,sid) labels;$new$);
end$patch$;

-- Use the same current student, plan and class visibility as member discovery.
-- Historic reservations retain their existing title, attendance and cancellation sources.
create function private.reservation_member_labels(p_session core.sessions,p_actor uuid,p_class_open boolean)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.member_lesson_labels(p_session.org_id,p_session.center_id,p_session.id)
 where p_session.state='planned' and p_session.starts_at>=statement_timestamp()
   and p_session.actual_started_at is null and private.starter_session_allowed(p_session.org_id,p_session.id,true)
   and exists (select 1 from core.people p where p.org_id=p_session.org_id and p.id=p_actor and p.state='active')
   and exists (select 1 from core.center_relationships c where c.org_id=p_session.org_id
    and c.center_id=p_session.center_id and c.person_id=any(private.p07_person_members(p_session.org_id,p_actor))
    and c.kind='student' and c.state='active')
   and private.member_summary_enabled(p_session.org_id,array['calendar_get_v1','reservation_create_v1'],
    jsonb_build_object('org_id',p_session.org_id,'center_id',p_session.center_id,'person_id',p_actor))
   and (p_session.class_id is null or p_class_open or exists (
    select 1 from core.sales sale join core.product_scopes sc on sc.org_id=sale.org_id and sc.product_version_id=sale.product_version_id
    where sale.org_id=p_session.org_id and sale.person_id=any(private.p07_person_members(p_session.org_id,p_actor))
     and sc.class_id=p_session.class_id and private.lesson_scope_matches(p_session.org_id,p_session.id,sale.product_version_id)
   ))
$$;

create or replace function private.reservation_self_summary(p_org uuid,p_actor uuid,p_reservation uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('title',coalesce(c.name,d.name),'starts_at',s.starts_at,'ends_at',s.ends_at,
  'attendance_state',s.attendance_state,'attendance_result',case when s.attendance_state='closed' then a.result end,
  'cancellation',private.member_lesson_cancellation(v.org_id,v.center_id,v.session_id,v.id))
  || case when private.member_summary_enabled(p_org,array['session_get_v1'],
   jsonb_build_object('org_id',p_org,'center_id',s.center_id,'session_id',s.id))
   then jsonb_build_object('session_version',s.version,'session_state',s.state,'format',s.format,'discipline_id',s.discipline_id)
   else '{}'::jsonb end
  || coalesce(private.reservation_member_labels(s,p_actor,c.external_open),'{}'::jsonb)
 from core.reservations v
 join core.sessions s on s.org_id=v.org_id and s.center_id=v.center_id and s.id=v.session_id
 join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
 left join core.classes c on c.org_id=s.org_id and c.id=s.class_id
 left join core.attendance_entries a on a.org_id=v.org_id and a.center_id=v.center_id and a.reservation_id=v.id
 where v.org_id=p_org and v.id=p_reservation and private.p07_same_person(p_org,v.person_id,p_actor)
  and private.session_readable(p_org,p_actor,s.id) and private.starter_session_allowed(p_org,s.id,false)
$$;

create or replace function private.event_management_labels(p_event jsonb,p_org uuid,p_center uuid,p_actor uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare room_record core.rooms;
begin
 if p_event#>>'{venue,kind}'='internal' and private.is_manager(p_org,p_actor,p_center) then
  select * into room_record from core.rooms room where room.org_id=p_org and room.center_id=p_center
   and room.id=(p_event#>>'{venue,room_id}')::uuid;
  if found then
   p_event:=p_event||jsonb_build_object('venue_room_name',room_record.name,
    'venue_active_room_name',case when room_record.state='active' and private.starter_selected(p_org,'room',room_record.id)
     then room_record.name end);
  end if;
 end if;
 if p_event?'duties' then
  p_event:=jsonb_set(p_event,'{duties}',private.page_person_names(p_event->'duties',p_org,null,p_actor,false));
 end if;
 return p_event;
end$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 a text;
begin
 a:=$old$where (center is null or c.center_id=center) and c.starts_at<hi and c.ends_at>lo$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Calendar intersection filter anchor changed';end if;
 body:=replace(body,a,a||$new$
   and (r->>'resource_person_id' is null or private.calendar_person_matches(org,c.center_id,c.id,c.kind,(r->>'resource_person_id')::uuid))$new$);
 a:=$old$ then private.calendar_session_summary(org,actor,(x->>'center_id')::uuid,(x->>'id')::uuid) end summary offset 0) s;$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Calendar labels projection anchor changed';end if;
 body:=replace(body,a,$new$ then private.calendar_session_summary(org,actor,(x->>'center_id')::uuid,(x->>'id')::uuid)
    ||case when r->'include_management_labels'='true'::jsonb
      and private.member_summary_enabled(org,array['session_get_v1'],
       jsonb_build_object('org_id',org,'center_id',x->'center_id','session_id',x->'id'))
     then private.calendar_management_labels(org,actor,(x->>'center_id')::uuid,(x->>'id')::uuid) else '{}'::jsonb end
   end summary offset 0) s;$new$);
 a:=$old$ if op='calendar_get_v1' and coalesce((r->>'needs_instructor')::bool,false)$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Calendar intersection validation anchor changed';end if;
 execute replace(body,a,$new$ if op='calendar_get_v1' then
  if r?'resource_person_id' then
   if r#>>'{resource,kind}' is distinct from 'room' then perform private.fail('VALIDATION_FAILED');end if;
   perform private.starter_request_guard(op,jsonb_build_object('center_id',center,
    'resource',jsonb_build_object('kind','person','id',r->'resource_person_id')),org);
  end if;
  if r->'include_management_labels'='true'::jsonb and r->'include_session_summary' is distinct from 'true'::jsonb
   then perform private.fail('VALIDATION_FAILED');end if;
 end if;
$new$||a);
end$patch$;

-- Keep the base calendar page and its versioned projections on one read snapshot.
alter function private.schedule_page(text,jsonb,uuid,uuid,uuid) stable;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a constant text:=$old$ if out is null then out:=jsonb_build_object('operation_id'$old$;
begin
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Session and attendance projection anchor changed';end if;
 execute replace(body,a,$new$ if p_operation='session_get_v1' and (r->'include_title'='true'::jsonb or r->'include_person_display_names'='true'::jsonb) then
  out:=out||coalesce((select
   case when r->'include_title'='true'::jsonb then jsonb_build_object('title',coalesce(c.name,d.name)) else '{}'::jsonb end
   ||case when r->'include_person_display_names'='true'::jsonb then jsonb_build_object('person_labels',coalesce((
    select jsonb_agg(jsonb_build_object('person_id',readable.id,'name',readable.name) order by readable.id)
    from (
     select ids.id,private.directory_person_name(org,s.center_id,person,ids.id) name
     from (
      select (item->>'person_id')::uuid id from jsonb_array_elements(out->'assignments') item where item->>'duty'='instructor'
      union select person where private.session_assignee(org,person,s.id)
     ) ids
    ) readable where readable.name is not null
   ),'[]'::jsonb)) else '{}'::jsonb end
   from core.sessions s join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
   left join core.classes c on c.org_id=s.org_id and c.center_id=s.center_id and c.id=s.class_id
   where s.org_id=org and s.id=(out->>'id')::uuid and s.version=(out->>'version')::bigint),'{}'::jsonb);
 elsif p_operation='attendance_get_v1' and r->'include_person_display_names'='true'::jsonb then
  out:=jsonb_set(out,'{entries}',private.page_person_names(out->'entries',org,center,person,false));
 end if;
$new$||a);
end$patch$;

revoke all on function private.calendar_person_matches(uuid,uuid,uuid,text,uuid),
 private.calendar_management_labels(uuid,uuid,uuid,uuid),private.member_lesson_labels(uuid,uuid,uuid),
 private.reservation_member_labels(core.sessions,uuid,boolean)
 from public,anon,authenticated;
grant execute on function private.calendar_person_matches(uuid,uuid,uuid,text,uuid),
 private.calendar_management_labels(uuid,uuid,uuid,uuid),private.member_lesson_labels(uuid,uuid,uuid),
 private.reservation_member_labels(core.sessions,uuid,boolean)
 to service_role;


-- Scope the existing management pages to requested visible subjects before keyset paging.
create function private.management_read_resources(p_org uuid,p_center uuid,p_op text,p_selector jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 resources jsonb:=p_selector->'resources';
 resource jsonb;
begin
 if resources is null then resources:=jsonb_build_array(p_selector->'resource');end if;
 if jsonb_typeof(resources) is distinct from 'array' then perform private.fail('VALIDATION_FAILED');end if;
 if jsonb_array_length(resources) not between 1 and 50 or (p_selector?'resources' and p_selector?'resource')
  or (select count(distinct (kind,id)) from jsonb_to_recordset(resources) x(kind text,id uuid))<>jsonb_array_length(resources)
 then perform private.fail('VALIDATION_FAILED');end if;
 for resource in select value from jsonb_array_elements(resources) loop
  perform private.starter_request_guard(p_op,jsonb_build_object('resource',resource,'center_id',p_center),p_org);
  perform private.assert_resource(p_org,p_center,resource->>'kind',(resource->>'id')::uuid);
 end loop;
 return resources;
end$$;

do $patch$
declare body text; a text; function_name regprocedure;
begin
 foreach function_name in array array[
  'private.starter_availability_management(jsonb,uuid,uuid,uuid)'::regprocedure,
  'private.starter_resource_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure
 ] loop
  body:=pg_get_functiondef(function_name);
  a:=$old$declare $old$;
  if cardinality(string_to_array(body,a))<>2 then raise exception 'Resource list declaration anchor changed in %',function_name;end if;
  body:=replace(body,a,a||'scoped_resources jsonb; ');
  a:=$old$ perform private.assert_resource(org,center,k#>>'{resource,kind}',(k#>>'{resource,id}')::uuid);$old$;
  if cardinality(string_to_array(body,a))<>2 then raise exception 'Resource list authority anchor changed in %',function_name;end if;
  body:=replace(body,a,$new$ scoped_resources:=private.management_read_resources(org,center,r->>'operation',k);$new$);
  a:=$old$a.resource_kind=k#>>'{resource,kind}'[[:space:]]+and a.resource_id=\(k#>>'\{resource,id\}'\)::uuid$old$;
  if (select count(*) from regexp_matches(body,a,'g')) <>
     (case when function_name='private.starter_resource_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure then 2 else 1 end)
   then raise exception 'Resource list filter anchor changed in %',function_name;end if;
  body:=regexp_replace(body,a,$new$exists (select 1 from jsonb_to_recordset(scoped_resources) x(kind text,id uuid) where x.kind=a.resource_kind and x.id=a.resource_id)$new$,'g');
  a:=$old$'resource',k->'resource'$old$;
  if cardinality(string_to_array(body,a))<>2 then raise exception 'Resource list projection anchor changed in %',function_name;end if;
  execute replace(body,a,$new$'resource',jsonb_build_object('kind',resource_kind,'id',resource_id)$new$);
 end loop;
end$patch$;

do $patch$
declare
 body text:=pg_get_functiondef('private.studio_management_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a text;
begin
 a:=$old$ cur jsonb;last_at timestamptz;$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Studio class set declaration anchor changed';end if;
 body:=replace(body,a,' class_scope uuid[];'||a);
 a:=$old$  if not exists(select 1 from core.classes c where c.org_id=org and c.center_id=center and c.id=(k->>'class_id')::uuid
   and private.starter_selected(org,'discipline',c.discipline_id)) then perform private.fail('NOT_FOUND');end if;$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Studio class set authority anchor changed';end if;
 body:=replace(body,a,$new$  if k?'class_ids' then
   class_scope:=array(select value::uuid from jsonb_array_elements_text(k->'class_ids'));
   if k?'class_id' or cardinality(class_scope) not between 1 and 50
    or cardinality(class_scope)<>(select count(distinct id) from unnest(class_scope) ids(id))
   then perform private.fail('VALIDATION_FAILED');end if;
  else
   class_scope:=array[(k->>'class_id')::uuid];
  end if;
  if (select count(*) from core.classes c where c.org_id=org and c.center_id=center and c.id=any(class_scope)
   and private.starter_selected(org,'discipline',c.discipline_id))<>cardinality(class_scope)
   then perform private.fail('NOT_FOUND');end if;$new$);
 a:=$old$and p.class_id=(k->>'class_id')::uuid$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Studio class set filter anchor changed';end if;
 execute replace(body,a,$new$and p.class_id=any(class_scope)$new$);
end$patch$;

do $patch$
declare
 body text:=pg_get_functiondef('private.earnings_management(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a text;
begin
 a:=$old$declare $old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Agreement person set declaration anchor changed';end if;
 body:=replace(body,a,a||'person_scope uuid[]; ');
 a:=$old$ elsif op='instructor_agreements_list_v1' then$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Agreement person set validation anchor changed';end if;
 body:=replace(body,a,a||$new$
  if r?'person_ids' then
   if r?'person_id' or jsonb_typeof(r->'person_ids') is distinct from 'array' then perform private.fail('VALIDATION_FAILED');end if;
   person_scope:=array(select value::uuid from jsonb_array_elements_text(r->'person_ids'));
   if cardinality(person_scope) not between 1 and 50
    or cardinality(person_scope)<>(select count(distinct id) from unnest(person_scope) ids(id))
   then perform private.fail('VALIDATION_FAILED');end if;
  else
   person_scope:=array[(r->>'person_id')::uuid];
  end if;$new$);
 a:=$old$and a.person_id=(r->>'person_id')::uuid and (last_id is null$old$;
 if cardinality(string_to_array(body,a))<>2 then raise exception 'Agreement person set filter anchor changed';end if;
 execute replace(body,a,$new$and a.person_id=any(person_scope) and (last_id is null$new$);
end$patch$;

revoke all on function private.management_read_resources(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.management_read_resources(uuid,uuid,text,jsonb) to service_role;

commit;
