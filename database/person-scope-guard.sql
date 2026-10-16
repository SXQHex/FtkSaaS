-- Person data follows current account grants and operational center scope.
begin;
create or replace function private.person_operational_access(org uuid,actor uuid,center uuid,target uuid) returns bool language sql stable set search_path='' as $$
 select center is not null and (
  exists(select 1 from core.center_relationships cr where cr.org_id=org and cr.center_id=center and cr.person_id=target)
 ) and (private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'person.manage') or private.staff_grant(org,actor,center,'reservation.write') or private.staff_grant(org,actor,center,'finance.collect'))
$$;
revoke all on function private.person_operational_access(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.person_operational_access(uuid,uuid,uuid,uuid) to service_role;
commit;
