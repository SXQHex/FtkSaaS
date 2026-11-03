begin;
-- Existing occurrences may lose their inherited instructor through an explicit
-- class command. New occurrences still require the selected Starter instructor.
create or replace function private.starter_schedule_guard(org uuid,d jsonb)
returns void language plpgsql stable security invoker set search_path='' as $$
declare a jsonb;room uuid;instructors bigint;
begin
 if private.current_plan_name(org) is distinct from 'starter' then return;end if;
 perform private.starter_assert_selected(org,'discipline',(d->>'discipline_id')::uuid);
 if (select count(*) from jsonb_array_elements(d->'resources') x where x->>'kind'='room')<>1 then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 select (x->>'id')::uuid into room from jsonb_array_elements(d->'resources') x where x->>'kind'='room';
 perform private.starter_assert_selected(org,'room',room);
 if not exists(select 1 from core.rooms where org_id=org and id=room and state='active') then perform private.fail('NOT_FOUND');end if;
 select count(*) into instructors from jsonb_array_elements(d->'assignments') x where x->>'duty'='instructor';
 if instructors>1 or exists(select 1 from jsonb_array_elements(d->'assignments') x where x->>'duty'<>'instructor')
  or (instructors=0 and not exists(select 1 from core.sessions s where s.org_id=org and s.center_id=(d->>'center_id')::uuid and s.id=(d->>'id')::uuid)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 for a in select value from jsonb_array_elements(d->'assignments') loop
  perform private.starter_assert_selected(org,'instructor',(a->>'person_id')::uuid);
  if not private.starter_instructor_active(org,(d->>'center_id')::uuid,(a->>'person_id')::uuid) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end loop;
end$$;
-- Exact class/person/duty selector: expose only the original assignment identity.
create function private.class_duty_management(r jsonb,org uuid,center uuid,person uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';cls core.classes;a core.class_assignments;
 stamp timestamptz:=clock_timestamp();feature text;values jsonb;item jsonb;
begin
 if center is null or not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if r->>'operation' is distinct from 'class_assignment_set_v1' or r#>>'{selector,operation}' is distinct from 'class_assignment_set_v1'
  or coalesce((r#>>'{page,limit}')::int,50) not between 1 and 200
  or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' or r#>>'{page,cursor}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 for feature in select unnest(o.features) from private.runtime_operations o where o.name='class_assignment_set_v1' loop
  perform private.require_feature(org,feature);
 end loop;
 select * into cls from core.classes c where c.org_id=org and c.center_id=center and c.id=(k->>'class_id')::uuid and c.state='active';
 if not found then perform private.fail('NOT_FOUND');end if;
 perform private.assert_resource(org,center,'person',(k->>'person_id')::uuid);
 perform private.starter_request_guard('class_assignment_set_v1',jsonb_build_object('center_id',center,'class_id',cls.id,'discipline_id',cls.discipline_id,'person_id',k->'person_id','duty',k->'duty'),org);
 select * into a from core.class_assignments x where x.org_id=org and x.center_id=center and x.class_id=cls.id and x.person_id=(k->>'person_id')::uuid and x.duty=k->>'duty';
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and
  (a.id is null or r#>>'{entity,type}' is distinct from 'class_assignments' or (r#>>'{entity,id}')::uuid is distinct from a.id) then perform private.fail('NOT_FOUND');end if;
 values:=jsonb_build_object('class_id',cls.id,'person_id',(k->>'person_id')::uuid,'duty',k->>'duty');
 if a.id is not null then values:=values||jsonb_build_object('state',a.state);end if;
 item:=jsonb_build_object('operation','class_assignment_set_v1','exists',a.id is not null,
  'entity',case when a.id is null then null else jsonb_build_object('type','class_assignments','id',a.id) end,
  'state',a.state,'versions',case when a.id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','class_assignments','id',a.id),'version',a.version)) end,
  'as_of',stamp,'current',jsonb_build_object('operation','class_assignment_set_v1','values',values));
 return jsonb_build_object('items',jsonb_build_array(item),'next_cursor',null,'as_of',stamp);
end$$;
do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=$old$ if p_operation='management_state_get_v1' and r->>'operation' in ('class_save_v1','program_preview_v1') then$old$;
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Class duty management dispatch anchor drift';end if;
 execute replace(body,anchor,$new$ if p_operation='management_state_get_v1' and r->>'operation'='class_assignment_set_v1' then
  out:=private.class_duty_management(r,org,center,person);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$new$||anchor);
end$patch$;
revoke all on function private.class_duty_management(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.class_duty_management(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
