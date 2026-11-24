begin;

create function private.centers_read_rows(p_org uuid,p_person uuid,p_org_reader boolean,p_center uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security='on' as $$
declare
 items jsonb;
 prior_scope text:=current_setting('ftk.centers_read_scope',true);
begin
 perform set_config('ftk.centers_read_scope',jsonb_build_object('org',p_org,'person',p_person,'org_reader',p_org_reader)::text,true);
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'name',c.name,'timezone',c.timezone,'state',c.state,'accessible',true,'version',c.version
 )),'[]'::jsonb) into items
 from core.centers c where c.org_id=p_org and (p_center is null or c.id=p_center);
 perform set_config('ftk.centers_read_scope',coalesce(prior_scope,''),true);
 return jsonb_build_object('items',items,'next_cursor',null);
end$$;
revoke all on function private.centers_read_rows(uuid,uuid,boolean,uuid) from public,anon,authenticated,service_role;
grant create on schema private to ftk_centers_read;
alter function private.centers_read_rows(uuid,uuid,boolean,uuid) owner to ftk_centers_read;
revoke create on schema private from ftk_centers_read;
grant execute on function private.centers_read_rows(uuid,uuid,boolean,uuid) to current_user,service_role;

create function private.settable_team_permissions() returns text[]
language sql immutable security invoker set search_path='' as $$
 select array['person.manage','person.activate','invite.student','reservation.write','attendance.draft',
  'sale.write','finance.collect','sale.discount','reservation.capacity_override','request.write','request.resolve','crm.daily']
$$;

create or replace function private.permission_management_page(
 r jsonb,org uuid,center uuid,account uuid,auth_id uuid,session_id uuid,person uuid,owner uuid,cm boolean
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 k jsonb:=r#>'{selector,key}';
 op constant text:='permission_set_v1';
 target uuid:=(k->>'person_id')::uuid;
 permission_code text:=k->>'permission';
 summary boolean:=coalesce(k->'permission_summary'='true'::jsonb,false);
 target_person core.people;
 choice core.permission_overrides;
 target_staff boolean;
 target_instructor boolean;
 target_manager boolean;
 vals jsonb;
 stamp timestamptz:=clock_timestamp();
 entity jsonb;
begin
 if center is null or r->>'operation' is distinct from op or r#>>'{selector,operation}' is distinct from op
  or summary=(permission_code is not null) then perform private.fail('VALIDATION_FAILED');end if;
 perform private.management_center_command_authorize(op,jsonb_build_object('org_id',org,'center_id',center)||k,
  org,center,account,auth_id,session_id,person,owner,cm);

 if summary then target:=private.p07_person_root(org,target);end if;
 target_staff:=private.has_role(org,target,'staff',center);
 if not summary and (permission_code<>all(private.settable_team_permissions())
  or (permission_code='reservation.capacity_override' and not target_staff)) then
  perform private.fail('FORBIDDEN');
 end if;
 select * into target_person from core.people p where p.org_id=org and p.id=target;
 if not found then perform private.fail('NOT_FOUND');end if;
 target_instructor:=private.has_role(org,target,'instructor',center);
 target_manager:=private.is_manager(org,target,center);
 if not (target_staff or target_instructor or ((summary or permission_code='sale.discount') and target_manager)) then
  perform private.fail('ACCOUNT_LINK_REQUIRED');
 end if;
 entity:=jsonb_build_object('type','people','id',target);
 if coalesce(r->'entity','null'::jsonb)<>'null'::jsonb and r->'entity'<>entity then perform private.fail('NOT_FOUND');end if;

 if summary then
  select jsonb_build_object('person_id',target,'permission_overrides',coalesce(jsonb_agg(
   jsonb_build_object('permission',p.code,'override_exists',o.id is not null,'enabled',o.enabled,'override_version',o.version,
    'effective_staff_grant',coalesce(private.staff_grant(org,target,center,p.code),false)) order by p.position
  ),'[]'::jsonb)) into vals
  from unnest(private.settable_team_permissions()) with ordinality p(code,position)
  left join core.permission_overrides o on o.org_id=org and o.center_id=center and o.person_id=target and o.permission=p.code
  where (target_staff or (target_instructor and p.code<>'reservation.capacity_override') or (target_manager and p.code='sale.discount'));
 else
  select * into choice from core.permission_overrides o
  where o.org_id=org and o.center_id=center and o.person_id=target and o.permission=permission_code;
  vals:=k||jsonb_build_object('override_exists',choice.id is not null)
   ||case when choice.id is null then '{}'::jsonb else jsonb_build_object('enabled',choice.enabled) end;
 end if;

 return private.p06_page(jsonb_build_array(jsonb_build_object(
  'operation',op,'entity',entity,'exists',true,'state',target_person.state,
  'versions',jsonb_build_array(jsonb_build_object('entity',entity,'version',target_person.version)),
  'as_of',stamp,'current',jsonb_build_object('operation',op,'values',vals)
 )),r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),stamp);
end$$;

-- Enrich only the session rows that survived the existing range, resource and cursor filters.
create function private.calendar_session_summary(p_org uuid,p_actor uuid,p_center uuid,p_session uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('state',s.state,'attendance_state',s.attendance_state,'version',s.version,
  'format',s.format,'class_id',s.class_id,'assignments',coalesce((
   select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty) order by a.person_id,a.duty)
   from core.session_assignments a where a.org_id=p_org and a.center_id=p_center and a.session_id=p_session and a.state='active'
  ),'[]'::jsonb))
 from core.sessions s
 where s.org_id=p_org and s.center_id=p_center and s.id=p_session
  and private.session_readable(p_org,p_actor,s.id) and private.starter_session_allowed(p_org,s.id,false)
$$;

-- Self read only. The attendance projection is the final outcome on this exact reservation.
create function private.reservation_self_summary(p_org uuid,p_actor uuid,p_reservation uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('title',coalesce(c.name,d.name),'starts_at',s.starts_at,'ends_at',s.ends_at,
  'attendance_state',s.attendance_state,'attendance_result',case when s.attendance_state='closed' then a.result end,
  'cancellation',private.member_lesson_cancellation(v.org_id,v.center_id,v.session_id,v.id))
 from core.reservations v
 join core.sessions s on s.org_id=v.org_id and s.center_id=v.center_id and s.id=v.session_id
 join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id
 left join core.classes c on c.org_id=s.org_id and c.id=s.class_id
 left join core.attendance_entries a on a.org_id=v.org_id and a.center_id=v.center_id and a.reservation_id=v.id
 where v.org_id=p_org and v.id=p_reservation and private.p07_same_person(p_org,v.person_id,p_actor)
  and private.session_readable(p_org,p_actor,s.id) and private.starter_session_allowed(p_org,s.id,false)
$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old_center constant text:='private.centers_read_rows(org,person,org_reader)';
 old_permissions constant text:=$old$r->>'permission' not in ('person.manage','person.activate','invite.student','reservation.write','attendance.draft','sale.write','finance.collect','sale.discount','reservation.capacity_override','request.write','request.resolve','crm.daily')$old$;
begin
 if cardinality(string_to_array(body,old_center))<>2 or cardinality(string_to_array(body,old_permissions))<>2 then
  raise exception 'Scoped projection dispatcher anchor changed';
 end if;
 body:=replace(body,old_center,'private.centers_read_rows(org,person,org_reader,center)');
 body:=replace(body,old_permissions,$new$(r->>'permission')<>all(private.settable_team_permissions())$new$);
 execute body;
end$patch$;
drop function private.centers_read_rows(uuid,uuid,boolean);

do $patch$
declare
 body text:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor constant text:=$old$ return jsonb_build_object('items',items,'next_cursor',token,'as_of',case when time_filter is not null then filter_at else now() end);$old$;
begin
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Calendar page projection anchor changed';end if;
 execute replace(body,anchor,$new$ if op='calendar_get_v1' and r->'include_session_summary'='true'::jsonb then
  select coalesce(jsonb_agg(x||case when s.summary is not null then jsonb_build_object('session_summary',s.summary)
   else '{}'::jsonb end order by n),'[]'::jsonb)
  into items
  from jsonb_array_elements(items) with ordinality t(x,n)
  cross join lateral (select case when x->>'type'='session'
   then private.calendar_session_summary(org,actor,(x->>'center_id')::uuid,(x->>'id')::uuid) end summary offset 0) s;
 elsif op='reservation_list_v1' and r->'include_self_summary'='true'::jsonb then
  select coalesce(jsonb_agg(x||case when s.summary is not null then jsonb_build_object('self_summary',s.summary)
   else '{}'::jsonb end order by n),'[]'::jsonb)
  into items
  from jsonb_array_elements(items) with ordinality t(x,n)
  cross join lateral (select private.reservation_self_summary(org,actor,(x->>'id')::uuid) summary offset 0) s;
 end if;
$new$||anchor);
end$patch$;

do $patch$
declare
 body text:=pg_get_functiondef('private.member_lesson_discovery(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 anchor constant text:=$old$or coalesce((r->>'include_room_labels')::bool,false) then$old$;
begin
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Member discovery projection guard changed';end if;
 execute replace(body,anchor,$new$or coalesce((r->>'include_room_labels')::bool,false) or r->'include_session_summary'='true'::jsonb then$new$);
end$patch$;

-- Keep the class catalog's existing keyset page and add exactly one eligible instructor's duty.
do $patch$
declare
 body text:=pg_get_functiondef('private.studio_management_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 declare_target constant text:=$old$ cur jsonb;last_at timestamptz;$old$;
 validate_reader constant text:=$old$ perform private.require_feature(org,'F10');$old$;
 candidate constant text:=$old$   and private.starter_selected(org,'discipline',c.discipline_id)
  union all$old$;
 reply constant text:=$old$ return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);$old$;
begin
 if cardinality(string_to_array(body,declare_target))<>2 or cardinality(string_to_array(body,validate_reader))<>2
  or cardinality(string_to_array(body,candidate))<>2 or cardinality(string_to_array(body,reply))<>2 then
  raise exception 'Class catalog assignment projection anchor changed';
 end if;
 body:=replace(body,declare_target,$new$ instructor uuid:=(k->>'class_assignment_instructor_id')::uuid;feature text;
$new$||declare_target);
 body:=replace(body,validate_reader,validate_reader||$new$
 if instructor is not null then
  if op<>'class_save_v1' then perform private.fail('VALIDATION_FAILED');end if;
  for feature in select unnest(o.features) from private.runtime_operations o where o.name='class_assignment_set_v1' loop
   perform private.require_feature(org,feature);
  end loop;
  perform private.assert_resource(org,center,'person',instructor);
  perform private.starter_request_guard('class_assignment_set_v1',
   jsonb_build_object('center_id',center,'class_id',null,'person_id',instructor,'duty','instructor'),org);
 end if;$new$);
 body:=replace(body,candidate,$new$   and (instructor is null or c.state='active')
$new$||candidate);
 execute replace(body,reply,$new$ if instructor is not null then
  select coalesce(jsonb_agg(jsonb_set(x,'{current,values,instructor_assignment}',jsonb_build_object(
   'person_id',instructor,'id',a.id,'state',a.state,'version',a.version)) order by n),'[]'::jsonb)
  into items from jsonb_array_elements(items) with ordinality t(x,n)
  left join core.class_assignments a on a.org_id=org and a.center_id=center and a.class_id=(x#>>'{entity,id}')::uuid
   and a.person_id=instructor and a.duty='instructor';
 end if;
$new$||reply);
end$patch$;

revoke all on function private.settable_team_permissions(),private.calendar_session_summary(uuid,uuid,uuid,uuid),
 private.reservation_self_summary(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.settable_team_permissions(),private.calendar_session_summary(uuid,uuid,uuid,uuid),
 private.reservation_self_summary(uuid,uuid,uuid)
 to service_role;

commit;
