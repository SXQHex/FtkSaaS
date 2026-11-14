begin;
-- These flags describe the person_update field boundary, never actor authority.
-- Match account_identity_guard rather than inferring ownership from proof dates.
create function private.person_name_field_policy(org uuid,target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with ownership as(select p.state='active' as active,exists(
  select 1 from core.account_links l join core.accounts a on a.id=l.account_id and a.state='active'
  join private.p07_profiles profile on profile.account_id=a.id
  join core.organizations o on o.id=l.org_id and o.state='active'
  where l.org_id=p.org_id and l.person_id=p.id and l.state='active' and l.verified_at is not null and p.state='active'
 ) as protected from core.people p where p.org_id=org and p.id=target)
 select jsonb_build_object(
  'display_name',jsonb_build_object('source',case when protected then 'account_profile' else 'person' end,'person_update_writable',active and not protected),
  'given_name',jsonb_build_object('source',case when protected then 'account_profile' else 'person' end,'person_update_writable',false),
  'family_name',jsonb_build_object('source',case when protected then 'account_profile' else 'person' end,'person_update_writable',false)) from ownership
$$;
create function private.person_contact_field_policy(org uuid,members uuid[],kind text,value text,active boolean) returns jsonb
language sql stable security invoker set search_path='' as $$
 with ownership as(select exists(
  select 1 from core.person_contacts c join private.account_contact_projections m on m.contact_id=c.id
  join core.account_links l on l.org_id=m.org_id and l.person_id=m.person_id and l.account_id=m.account_id and l.state='active' and l.verified_at is not null
  join core.accounts a on a.id=m.account_id and a.state='active'
  where c.org_id=org and c.person_id=any(members) and not c.account_projection_retired
   and c.kind=$3 and c.value=$4 and private.account_identity_view(m.account_id)->>c.kind is not null
 ) as protected)
 select jsonb_build_object('source',case when protected then 'native_auth' else 'person' end,'person_update_writable',active and not protected) from ownership
$$;
do $patch$
declare b text:=pg_get_functiondef('private.person_projection(uuid,uuid,uuid,boolean,boolean)'::regprocedure);a text;
begin
 a:=$a$'display_name',p.display_name,$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Person name field policy anchor drift';end if;
 b:=replace(b,a,a||$a$'field_policy',private.person_name_field_policy(org,p.id),$a$);
 a:=$a$'kind',c.kind,'value',c.value,'verified_at',c.verified_at$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Person contact field policy anchor drift';end if;
 -- The projection deduplicates values across aliases. If any row sharing the
 -- visible kind/value is protected, a local duplicate cannot advertise editability.
 b:=replace(b,a,a||$a$,'field_policy',private.person_contact_field_policy(org,(select ids from members),c.kind,c.value,p.state='active')$a$);
 execute b;
end$patch$;
revoke all on function private.person_name_field_policy(uuid,uuid),private.person_contact_field_policy(uuid,uuid[],text,text,boolean) from public,anon,authenticated;
grant execute on function private.person_name_field_policy(uuid,uuid),private.person_contact_field_policy(uuid,uuid[],text,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
