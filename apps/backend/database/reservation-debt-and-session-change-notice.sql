-- Distinguish the authorized debt guard and notify affected reservations in-app.
begin;
create function private.session_change_participant_notices(
 p_org uuid,p_center uuid,p_actor uuid,p_operation uuid,p_before jsonb,p_ids uuid[],p_index int
) returns int language plpgsql security invoker set search_path='' as $$
declare recipient record;
begin
 for recipient in
  with changed as materialized (
   select (item->>'id')::uuid session_id
   from jsonb_array_elements(p_before) item
   where (item-'expected_version') is distinct from
    (private.schedule_snapshot(p_org,(item->>'id')::uuid)-'expected_version')
  )
  select distinct v.session_id,private.p07_person_root(p_org,v.person_id) person_id
  from changed c join core.reservations v on v.org_id=p_org and v.center_id=p_center and v.session_id=c.session_id and v.state='active'
  join core.people p on p.org_id=p_org and p.id=private.p07_person_root(p_org,v.person_id) and p.state='active'
  where p.id is distinct from p_actor
  order by v.session_id,person_id
 loop
  perform private.p02_notice(p_org,recipient.person_id,recipient.session_id,'session_changed_for_participant',p_operation,p_ids,p_index);
  p_index:=p_index+2;
 end loop;
 return p_index;
end$$;
revoke all on function private.session_change_participant_notices(uuid,uuid,uuid,uuid,jsonb,uuid[],int) from public,anon,authenticated;
grant execute on function private.session_change_participant_notices(uuid,uuid,uuid,uuid,jsonb,uuid[],int) to service_role;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$old$if coalesce((select (p.value->>'value')::bool from private.policy_at(org,center,'debt_booking',clock_timestamp()) p),false) and exists(select 1 from core.debts q where q.org_id=org and private.p07_same_person(org,q.person_id,target) and private.debt_remaining(org,q.id)>0) then perform private.fail('FORBIDDEN');end if;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Reservation debt guard anchor drift';end if;
 body:=replace(body,anchor,replace(anchor,'FORBIDDEN','DEBT_BOOKING_BLOCKED'));

 anchor:=$old$  if p_operation='session_change_apply_v1' then select version into version_n from core.sessions where org_id=org and id=record_id;end if;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Session change write anchor drift';end if;
 execute replace(body,anchor,$new$  if p_operation='session_change_apply_v1' then
   select version into version_n from core.sessions where org_id=org and id=record_id;
   idx:=private.session_change_participant_notices(org,center,person,operation_id,before_rows,p_ids,idx);
  end if;$new$);

 -- Use existing localized in-app copy; the email subject allowlist is unchanged.
 body:=pg_get_functiondef('private.notification_content_code(core.notifications)'::regprocedure);
 anchor:=$old$when n.kind='session_change_apply_v1' then 'session_change'$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Session change notification copy anchor drift';end if;
 execute replace(body,anchor,$new$when n.kind in ('session_change_apply_v1','session_changed_for_participant') then 'session_change'$new$);
end$patch$;
commit;
