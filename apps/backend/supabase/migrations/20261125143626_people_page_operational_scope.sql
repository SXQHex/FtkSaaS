begin;

create index people_active_created_page_idx
 on core.people (org_id,created_at,id) where state='active';

-- An active relationship on the canonical row is sufficient proof for an
-- operational reader. Other rows still use the full alias and role history.
create function private.person_operational_scope_matches(org uuid,center uuid,target uuid,manager boolean)
returns boolean language sql stable security invoker set search_path='' as $$
 with members as materialized (select private.p07_person_members($1,$3) ids)
 select case when exists (
  select 1 from core.people p
  join core.center_relationships cr on cr.org_id=p.org_id and cr.person_id=p.id
  where p.org_id=$1 and p.id=$3 and p.merged_into_id is null and cr.center_id=$2
   and cr.kind<>'instructor' and cr.state='active'
 ) then true else (
  exists (
   select 1 from private.person_center_relationships cr
   where cr.org_id=$1 and cr.center_id=$2 and cr.person_id=any((select ids from members)::uuid[])
    and (cr.state='active' or (cr.kind='instructor' and $4))
  ) or (
   exists (
    select 1 from private.person_origins po
    where po.org_id=$1 and po.person_id=any((select ids from members)::uuid[]) and po.center_id=$2
   ) and not exists (
    select 1 from private.person_center_relationships cr
    where cr.org_id=$1 and cr.person_id=any((select ids from members)::uuid[])
   )
  )
 ) end
$$;
revoke all on function private.person_operational_scope_matches(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.person_operational_scope_matches(uuid,uuid,uuid,boolean) to service_role;

create or replace function private.person_operational_access(org uuid,actor uuid,center uuid,target uuid)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare
 manager boolean;
 permitted boolean;
begin
 if center is null then return false;end if;
 manager:=private.is_manager(org,actor,center);
 permitted:=manager or private.staff_grant(org,actor,center,'person.manage')
  or private.staff_grant(org,actor,center,'reservation.write') or private.staff_grant(org,actor,center,'finance.collect');
 if not permitted then return false;end if;
 return permitted and private.person_operational_scope_matches(org,center,target,manager);
end$$;

-- The dispatcher already resolves the manager against the current center.
-- Reuse that answer and resolve staff grants once for both page predicates.
do $patch$
declare
 body text;
 original text;
 page text;
 anchor text;
 first_pos integer;
 last_pos integer;
begin
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=' person uuid;owner uuid;cm bool:=false;org_reader bool:=false;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Person page declaration anchor drift';end if;
 body:=replace(body,anchor,anchor||'people_operational_reader bool;');

 first_pos:=strpos(body,$a$ when 'people_list_v1' then$a$);
 last_pos:=strpos(body,$a$ when 'room_save_v1' then$a$);
 if first_pos=0 or last_pos<=first_pos then raise exception 'Person page dispatch anchors drift';end if;
 original:=substring(body,first_pos,last_pos-first_pos);
 anchor:=$a$  if not org_reader and not (private.is_manager(org,person,center) or private.staff_grant(org,person,center,'person.manage') or private.staff_grant(org,person,center,'reservation.write') or private.staff_grant(org,person,center,'finance.collect')) and not private.person_assignment_candidate(org,person,center) then$a$;
 if array_length(string_to_array(original,anchor),1)<>2 then raise exception 'Person page authority anchor drift';end if;
 page:=replace(original,anchor,$a$  people_operational_reader:=not org_reader and center is not null and (
   cm or private.staff_grant(org,person,center,'person.manage') or private.staff_grant(org,person,center,'reservation.write')
   or private.staff_grant(org,person,center,'finance.collect'));
  if not org_reader and not people_operational_reader and not private.person_assignment_candidate(org,person,center) then$a$);

 anchor:='private.person_operational_access(org,person,center,x.id)';
 if array_length(string_to_array(page,anchor),1)<>3 then raise exception 'Person page visibility anchor drift';end if;
 page:=replace(page,anchor,'(people_operational_reader and private.person_operational_scope_matches(org,center,x.id,cm))');
 anchor:='private.person_operational_access(org,person,center,p.id)';
 if array_length(string_to_array(page,anchor),1)<>2 then raise exception 'Person list predicate anchor drift';end if;
 page:=replace(page,anchor,'(people_operational_reader and private.person_operational_scope_matches(org,center,p.id,cm))');
 execute overlay(body placing page from first_pos for length(original));
end$patch$;

commit;
