begin;
-- Resolve the root once and walk only its indexed incoming merge edges.
-- The old implementation resolved two roots for every person in the tenant.
create or replace function private.p07_person_members(org uuid,pid uuid) returns uuid[]
language sql stable security invoker set search_path='' as $$
 with recursive root as materialized (select private.p07_person_root($1,$2) id),
 component(id,depth) as (
  select p.id,1 from core.people p join root r on r.id=p.id where p.org_id=$1
  union all
  select p.id,c.depth+1 from component c join core.people p on p.org_id=$1 and p.merged_into_id=c.id where c.depth<64
 ) select coalesce(array_agg(id order by id),'{}'::uuid[]) from component
$$;
-- Check the actor's live capability before scanning the target's alias and
-- center relationships. A plain SQL AND lets the planner run that expensive
-- scan even when the actor has no operational capability at all.
create or replace function private.person_operational_access(org uuid,actor uuid,center uuid,target uuid) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare permitted boolean;members uuid[];
begin
 if center is null then return false;end if;
 permitted:=private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'person.manage') or private.staff_grant(org,actor,center,'reservation.write') or private.staff_grant(org,actor,center,'finance.collect');
 if not permitted then return false;end if;
 members:=private.p07_person_members(org,target);
 return permitted and (
  exists(select 1 from private.person_center_relationships cr where cr.org_id=org and cr.center_id=center and cr.person_id=any(members) and (cr.state='active' or (cr.kind='instructor' and private.is_manager(org,actor,center))))
  or (exists(select 1 from private.person_origins po where po.org_id=org and po.person_id=any(members) and po.center_id=center)
   and not exists(select 1 from private.person_center_relationships cr where cr.org_id=org and cr.person_id=any(members)))
 );
end$$;
create or replace function private.person_assigned_access(org uuid,actor uuid,center uuid,target uuid) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare members uuid[];actors uuid[];
begin
 if center is null then return false;end if;
 members:=private.p07_person_members(org,target);actors:=private.p07_person_members(org,actor);
 return exists(select 1 from core.reservations r join core.session_assignments a on a.org_id=r.org_id and a.session_id=r.session_id and a.center_id=r.center_id where r.org_id=org and r.center_id=center and r.person_id=any(members) and r.state in ('active','completed') and a.person_id=any(actors) and a.state='active' and private.has_role(org,actor,a.duty,center))
  or exists(select 1 from core.event_registrations r where r.org_id=org and r.center_id=center and r.person_id=any(members) and r.state in ('active','completed') and private.event_assignee(org,actor,r.event_id));
end$$;
revoke all on function private.person_operational_access(uuid,uuid,uuid,uuid),private.person_assigned_access(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.person_operational_access(uuid,uuid,uuid,uuid),private.person_assigned_access(uuid,uuid,uuid,uuid) to service_role;
-- This is a conservative candidate check, not an authorization grant. Even an
-- inactive/historical assignment retains the existing full visibility path.
create function private.person_assignment_candidate(org uuid,actor uuid,center uuid) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare members uuid[]:=private.p07_person_members(org,actor);
begin
 return exists(select 1 from core.session_assignments a where a.org_id=org and a.center_id=center and a.person_id=any(members))
  or exists(select 1 from core.event_assignments a where a.org_id=org and a.center_id=center and a.person_id=any(members));
end$$;
-- Keep all current identity/contact projection additions; change only alias
-- lookup evaluation and predicates. The canonical role relationship view stays.
do $patch$
declare b text;a text;z text;original text;fast text;start_at integer;end_at integer;
begin
 b:=pg_get_functiondef('private.person_projection(uuid,uuid,uuid,boolean,boolean)'::regprocedure);
 a:='select jsonb_build_object(''id'',p.id';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Person projection start drift';end if;
 b:=replace(b,a,'with members as materialized(select private.p07_person_members(org,target) ids) '||a);
 b:=replace(b,'to_jsonb(private.p07_person_members(org,target))','to_jsonb((select ids from members))');
 foreach a in array array['cr','source','c','pd'] loop
  b:=replace(b,'private.p07_same_person(org,'||a||'.person_id,target)',a||'.person_id=any((select ids from members)::uuid[])');
 end loop;
 execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='  select coalesce(jsonb_agg(private.person_projection(org,x.id,center,';
 z:='limit limit_n+1) x;';start_at:=strpos(b,a);end_at:=strpos(substr(b,start_at),z);
 if start_at=0 or end_at=0 or array_length(string_to_array(b,a),1)<>2 then raise exception 'People page anchor drift';end if;
 original:=substr(b,start_at,end_at-1+length(z));
 fast:=regexp_replace(original,'and \(org_reader or p.id=person or private.person_operational_access[^\n]+','and p.id=person');
 if fast=original then raise exception 'People self visibility anchor drift';end if;
 b:=overlay(b placing $a$  if not org_reader and not (private.is_manager(org,person,center) or private.staff_grant(org,person,center,'person.manage') or private.staff_grant(org,person,center,'reservation.write') or private.staff_grant(org,person,center,'finance.collect')) and not private.person_assignment_candidate(org,person,center) then
$a$||fast||E'\n  else\n'||original||E'\n  end if;' from start_at for length(original));
 execute b;
end$patch$;
revoke all on function private.p07_person_members(uuid,uuid),private.person_assignment_candidate(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.p07_person_members(uuid,uuid),private.person_assignment_candidate(uuid,uuid,uuid) to service_role;
commit;
