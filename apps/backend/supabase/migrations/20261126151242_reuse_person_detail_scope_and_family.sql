begin;

-- Contact visibility is also the first part of the detail access decision.
-- Assigned instructors can read the detail with the contact field omitted.
do $migration$
declare
 dispatcher text := pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 declarations text := E'\ndeclare\n';
 old_gate text := $old$if not private.p07_same_person(org,target,person) and not org_reader and not private.person_operational_access(org,person,center,target) and not private.person_assigned_access(org,person,center,target) then perform private.fail('NOT_FOUND');end if;
  out:=private.person_projection(org,target,center,private.p07_same_person(org,target,person) or org_reader or private.person_operational_access(org,person,center,target),true);$old$;
 new_gate text := $new$person_contacts_visible:=org_reader or private.p07_same_person(org,target,person) or private.person_operational_access(org,person,center,target);
  if not person_contacts_visible and not private.person_assigned_access(org,person,center,target) then
   perform private.fail('NOT_FOUND');
  end if;
  out:=private.person_projection(org,target,center,person_contacts_visible,true);$new$;
begin
 if cardinality(string_to_array(dispatcher,old_gate)) <> 2 or cardinality(string_to_array(dispatcher,declarations)) <> 2 then
  raise exception 'Unexpected person detail dispatcher definition';
 end if;
 dispatcher := replace(dispatcher,declarations,declarations || E' person_contacts_visible boolean;\n');
 execute replace(dispatcher,old_gate,new_gate);
end
$migration$;

-- Each call projects one indexed person. Reuse its parameterized plan from
-- the first call on a connection, including during pool warm-up.
create or replace function private.person_projection(org uuid, target uuid, center uuid, contacts boolean, detail boolean)
returns jsonb language plpgsql stable security invoker set search_path=''
set plan_cache_mode=force_generic_plan as $projection$
begin
 return (
  with family as materialized (
   select p.id, p.state, p.display_name, p.given_name, p.family_name, p.version,
    case when exists (
     select 1 from core.people child where child.org_id=org and child.merged_into_id=p.id
    ) then private.p07_person_members(org,target) else array[p.id] end as ids
   from core.people requested
   join core.people p on p.org_id=requested.org_id and p.id=case
    when requested.merged_into_id is null then requested.id else private.p07_person_root(org,target) end
   where requested.org_id=org and requested.id=target
  )
  select jsonb_build_object(
   'id', p.id, 'display_name', p.display_name, 'field_policy', private.person_name_field_policy(org,p.id),
   'subscriber_number', (select min(n.number)::text from private.subscriber_numbers n where n.org_id=org and n.person_id=p.id),
   'given_name', p.given_name, 'family_name', p.family_name, 'linked_person_ids', to_jsonb(p.ids),
   'relationships', coalesce((
    select jsonb_agg(jsonb_build_object('center_id',cr.center_id,'kind',cr.kind,'state',cr.state)
                     order by cr.center_id,cr.kind,cr.created_at,cr.id)
    from private.person_center_relationships cr
    where cr.org_id=org and cr.person_id=any(p.ids) and (center is null or cr.center_id=center)
   ), '[]'::jsonb)
  ) || case when contacts then jsonb_build_object(
   'contacts', coalesce((
    select jsonb_agg(jsonb_build_object(
     'kind',c.kind,'value',c.value,'verified_at',c.verified_at,
     'field_policy',private.person_contact_field_policy(org,p.ids,c.kind,c.value,p.state='active')
    ) order by c.created_at,c.id)
    from (
     select distinct on (source.kind,source.value) source.*
     from core.person_contacts source
     where source.org_id=org and not source.account_projection_retired and source.person_id=any(p.ids)
     order by source.kind,source.value,source.verified_at desc nulls last,source.created_at,source.id
    ) c
   ), '[]'::jsonb)
  ) else '{}'::jsonb end
  || case when detail then jsonb_build_object(
   'version', p.version,
   'discipline_relationships', coalesce((
    select jsonb_agg(jsonb_build_object(
     'center_id',pd.center_id,'discipline_id',pd.discipline_id,'kind',pd.kind,'state',pd.state,'version',pd.version
    ) order by pd.center_id,pd.discipline_id,pd.kind,pd.created_at,pd.id)
    from core.person_disciplines pd
    where pd.org_id=org and pd.person_id=any(p.ids) and (center is null or pd.center_id=center)
   ), '[]'::jsonb)
  ) else '{}'::jsonb end
  from family p
 );
end
$projection$;

-- PostgreSQL prepares each visited PL/pgSQL CASE condition on a connection's
-- first call. Move the frequent reads together, preserving their entire arms.
do $route$
declare
 dispatcher text := pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text := E'\n when ''organizations_list_v1'' then\n';
 arm_name text;
 arm_start integer;
 next_arm integer;
 arm text;
 read_arms text := '';
begin
 if cardinality(string_to_array(dispatcher,anchor)) <> 2 then
  raise exception 'Unexpected read dispatch anchor';
 end if;
 foreach arm_name in array array['''person_get_v1''','''people_list_v1''','''session_get_v1'',''calendar_get_v1'',''reservation_list_v1'''] loop
  arm := E'\n when ' || arm_name || E' then\n';
  arm_start := strpos(dispatcher,arm);
  if cardinality(string_to_array(dispatcher,arm)) <> 2 or arm_start <= strpos(dispatcher,anchor) then
   raise exception 'Unexpected read dispatch arm %',arm_name;
  end if;
  next_arm := strpos(substr(dispatcher,arm_start+length(arm)),E'\n when ''');
  if next_arm = 0 then raise exception 'Missing next dispatch arm'; end if;
  arm := substr(dispatcher,arm_start,length(arm)+next_arm-1);
  read_arms := read_arms || arm;
  dispatcher := replace(dispatcher,arm,'');
 end loop;
 execute replace(dispatcher,anchor,read_arms || anchor);
end
$route$;

commit;
