begin;

-- Start from the exact person's active link before checking profile ownership.
create or replace function private.person_name_field_policy(org uuid,target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with ownership as(
  select p.state='active' as active,exists(
   select 1 from core.accounts a join private.p07_profiles profile on profile.account_id=a.id
   where a.state='active' and a.id=any(array(
    select l.account_id from core.account_links l join core.organizations o on o.id=l.org_id and o.state='active'
    where l.org_id=p.org_id and l.person_id=p.id and l.state='active' and l.verified_at is not null and p.state='active'
   ))
  ) as protected from core.people p where p.org_id=org and p.id=target
 )
 select jsonb_build_object(
  'display_name',jsonb_build_object('source',case when protected then 'account_profile' else 'person' end,'person_update_writable',active and not protected),
  'given_name',jsonb_build_object('source',case when protected then 'account_profile' else 'person' end,'person_update_writable',false),
  'family_name',jsonb_build_object('source',case when protected then 'account_profile' else 'person' end,'person_update_writable',false)) from ownership
$$;

-- Resolve exact visible contact IDs before checking native account ownership.
create or replace function private.person_contact_field_policy(org uuid,members uuid[],kind text,value text,active boolean) returns jsonb
language sql stable security invoker set search_path='' as $$
 with matching_projections as materialized (
  select m.org_id,m.person_id,m.account_id
  from private.account_contact_projections m
  where m.contact_id=any(array(
   select c.id from core.person_contacts c where c.org_id=org and c.person_id=any(members)
   and not c.account_projection_retired and c.kind=$3 and c.value=$4
  ))
 ), ownership as(select exists(
  select 1 from matching_projections m
  join core.account_links l on l.org_id=m.org_id and l.person_id=m.person_id and l.account_id=m.account_id and l.state='active' and l.verified_at is not null
  join core.accounts a on a.id=m.account_id and a.state='active'
  where private.account_identity_view(m.account_id)->>$3 is not null
 ) as protected)
 select jsonb_build_object('source',case when protected then 'native_auth' else 'person' end,'person_update_writable',active and not protected) from ownership
$$;

commit;
