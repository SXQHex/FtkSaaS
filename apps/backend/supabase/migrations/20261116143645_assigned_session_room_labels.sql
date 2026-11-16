begin;
create function private.assigned_session_room_labels(org uuid,actor uuid,session uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare center uuid;labels jsonb;
begin
 select s.center_id into center from core.sessions s where s.org_id=org and s.id=session;
 if center is null or not private.center_accessible(org,center) or not private.session_readable(org,actor,session)
  or not private.session_assignee(org,actor,session) then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('room_id',q.id,'name',q.name) order by q.id),'[]') into labels from (
  select distinct room.id,room.name from core.resource_bookings b
   join core.rooms room on room.org_id=b.org_id and room.center_id=b.center_id and room.id=b.resource_id
   where b.org_id=org and b.center_id=center and b.session_id=session and b.resource_kind='room' and b.state='active'
 ) q;
 return labels;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a text:=$a$ if out is null then out:=jsonb_build_object('operation_id'$a$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Assigned room labels response anchor drift';end if;
 execute replace(b,a,$a$ if p_operation in ('session_get_v1','calendar_get_v1') and coalesce((r->>'include_room_labels')::bool,false) then
  if p_operation='session_get_v1' then
   terms:=private.assigned_session_room_labels(org,person,(out->>'id')::uuid);
   if terms is not null then out:=out||jsonb_build_object('room_labels',terms);end if;
  else
   select coalesce(jsonb_agg(x||case when labels is not null then jsonb_build_object('room_labels',labels) else '{}'::jsonb end order by n),'[]')
    into terms from jsonb_array_elements(out->'items') with ordinality t(x,n)
    cross join lateral (select case when x->>'type'='session' then private.assigned_session_room_labels(org,person,(x->>'id')::uuid) end labels) q;
   out:=jsonb_set(out,'{items}',terms);
  end if;
 end if;
$a$||a);
end$patch$;
revoke all on function private.assigned_session_room_labels(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.assigned_session_room_labels(uuid,uuid,uuid) to service_role;
commit;
