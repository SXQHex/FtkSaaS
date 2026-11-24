begin;

-- The directory name reader is shared with existing access-directory projections.
-- Resolve only names for the returned page, under the same request center as person_get_v1.
create function private.page_person_names(p_items jsonb,p_org uuid,p_center uuid,p_actor uuid,p_include_assignee boolean)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(item||jsonb_strip_nulls(jsonb_build_object(
  'person_display_name',private.directory_person_name(p_org,p_center,p_actor,(item->>'person_id')::uuid),
  'assigned_display_name',case when p_include_assignee and item->>'assigned_to' is not null
   then private.directory_person_name(p_org,p_center,p_actor,(item->>'assigned_to')::uuid) end
 )) order by position),'[]'::jsonb)
 from jsonb_array_elements(p_items) with ordinality page(item,position)
$$;

create function private.event_management_labels(p_event jsonb,p_org uuid,p_center uuid,p_actor uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare room_name text;
begin
 if p_event#>>'{venue,kind}'='internal' and private.is_manager(p_org,p_actor,p_center) then
  select room.name into room_name
  from core.rooms room where room.org_id=p_org and room.center_id=p_center
   and room.id=(p_event#>>'{venue,room_id}')::uuid;
  if room_name is not null then
   p_event:=p_event||jsonb_build_object('venue_room_name',room_name);
  end if;
 end if;
 if p_event?'duties' then
  -- The separate duty person reader uses organization scope.
  p_event:=jsonb_set(p_event,'{duties}',private.page_person_names(p_event->'duties',p_org,null,p_actor,false));
 end if;
 return p_event;
end$$;

create function private.event_payment_for_registration(p_scope jsonb,p_org uuid,p_center uuid,p_actor uuid,p_manager boolean)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 selected_event_id uuid:=(p_scope->>'event_id')::uuid;
 target_id uuid:=(p_scope->>'person_id')::uuid;
 selected_registration_id uuid:=(p_scope->>'registration_id')::uuid;
 finance_reader boolean:=coalesce(p_manager,false) or coalesce(private.staff_grant(p_org,p_actor,p_center,'finance.collect'),false);
 candidates uuid[];
begin
 if p_center is null then perform private.fail('NOT_FOUND');end if;
 if not finance_reader and not private.p07_same_person(p_org,p_actor,target_id) then
  perform private.fail('FORBIDDEN');
 end if;

 select array_agg(candidate.id) into candidates from (
  select prep.id from core.event_payment_preparations prep
  where prep.org_id=p_org and prep.center_id=p_center and prep.event_id=selected_event_id
   and prep.person_id=any(private.p07_person_members(p_org,target_id))
   and (finance_reader or prep.person_id=p_actor)
   and (case when selected_registration_id is null then prep.state='prepared' and prep.registration_id is null
    else prep.registration_id=selected_registration_id end)
  limit 2
 ) candidate;
 if candidates is null then perform private.fail('NOT_FOUND');end if;
 if cardinality(candidates)<>1 then perform private.fail('INTEGRITY_VIOLATION');end if;
 return private.preparation_view(p_org,candidates[1]);
end$$;

do $patch$
declare
 body text:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor constant text:=$old$   and (r->>'session_id' is null or v.session_id=(r->>'session_id')::uuid)$old$;
begin
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Exact reservation selector anchor changed';end if;
 execute replace(body,anchor,anchor||$new$
   and (r->>'reservation_id' is null or v.id=(r->>'reservation_id')::uuid)$new$);
end$patch$;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text;
begin
 anchor:=$old$  if center is null and r ? 'event_id' then select center_id into center from core.events where org_id=org and id=(r->>'event_id')::uuid;end if;$old$;
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Exact event payment center anchor changed';end if;
 body:=replace(body,anchor,anchor||$new$
  if center is null and p_operation='event_payment_get_v1' and r?'selection' then
   select e.center_id into center from core.events e where e.org_id=org and e.id=(r#>>'{selection,event_id}')::uuid;
  end if;$new$);

 anchor:=$old$ when 'event_payment_get_v1' then$old$;
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Exact event payment selector anchor changed';end if;
 body:=replace(body,anchor,$new$ when 'event_payment_get_v1' then
  if r?'selection' then
   if r?'preparation_id' or r#>>'{selection,event_id}' is null or r#>>'{selection,person_id}' is null then
    perform private.fail('VALIDATION_FAILED');
   end if;
   out:=private.event_payment_for_registration(r->'selection',org,center,person,cm);
   return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
  end if;
  if not r?'preparation_id' then perform private.fail('VALIDATION_FAILED');end if;$new$);

 anchor:=$old$ if out is null then out:=jsonb_build_object('operation_id'$old$;
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Management readback projection anchor changed';end if;
 execute replace(body,anchor,$new$ if p_operation in ('reservation_list_v1','roles_list_v1','crm_followup_list_v1')
  and r->'include_person_display_names'='true'::jsonb then
  out:=jsonb_set(out,'{items}',private.page_person_names(out->'items',org,(r->>'center_id')::uuid,person,
   p_operation='crm_followup_list_v1'));
 elsif p_operation='event_get_v1' and r->'include_management_labels'='true'::jsonb then
  out:=private.event_management_labels(out,org,center,person);
 end if;
$new$||anchor);
end$patch$;

revoke all on function private.page_person_names(jsonb,uuid,uuid,uuid,boolean),
 private.event_management_labels(jsonb,uuid,uuid,uuid),
 private.event_payment_for_registration(jsonb,uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.page_person_names(jsonb,uuid,uuid,uuid,boolean),
 private.event_management_labels(jsonb,uuid,uuid,uuid),
 private.event_payment_for_registration(jsonb,uuid,uuid,uuid,boolean) to service_role;

commit;
