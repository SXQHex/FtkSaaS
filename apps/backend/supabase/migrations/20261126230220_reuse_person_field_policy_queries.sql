begin;

create or replace function private.person_name_field_policy(org uuid,target uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $policy$
declare
 person_active boolean;
 linked_accounts uuid[];
 profile_owned boolean := false;
 origin text;
begin
 select p.state='active', array(
  select l.account_id from core.account_links l join core.organizations o on o.id=l.org_id and o.state='active'
  where l.org_id=p.org_id and l.person_id=p.id and l.state='active' and l.verified_at is not null and p.state='active'
 ) into person_active,linked_accounts
 from core.people p where p.org_id=org and p.id=target;
 if not found then return null; end if;
 if cardinality(linked_accounts)>0 then
  select exists(
   select 1 from core.accounts a join private.p07_profiles profile on profile.account_id=a.id
   where a.state='active' and a.id=any(linked_accounts)
  ) into profile_owned;
 end if;
 origin := case when profile_owned then 'account_profile' else 'person' end;
 return jsonb_build_object(
  'display_name',jsonb_build_object('source',origin,'person_update_writable',person_active and not profile_owned),
  'given_name',jsonb_build_object('source',origin,'person_update_writable',false),
  'family_name',jsonb_build_object('source',origin,'person_update_writable',false)
 );
end
$policy$;

create or replace function private.person_contact_field_policy(org uuid,members uuid[],kind text,value text,active boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $policy$
declare
 projected_ids uuid[];
 native_owned boolean := false;
begin
 select array(
  select m.contact_id from private.account_contact_projections m
  where m.contact_id=any(array(
   select c.id from core.person_contacts c where c.org_id=org and c.person_id=any(members)
   and not c.account_projection_retired and c.kind=$3 and c.value=$4
  ))
 ) into projected_ids;
 if cardinality(projected_ids)>0 then
  select exists(
   select 1 from private.account_contact_projections m
   join core.account_links l on l.org_id=m.org_id and l.person_id=m.person_id and l.account_id=m.account_id
    and l.state='active' and l.verified_at is not null
   join core.accounts a on a.id=m.account_id and a.state='active'
   where m.contact_id=any(projected_ids) and private.account_identity_view(m.account_id)->>$3 is not null
  ) into native_owned;
 end if;
 return jsonb_build_object('source',case when native_owned then 'native_auth' else 'person' end,
                           'person_update_writable',active and not native_owned);
end
$policy$;


-- The dispatcher has already checked this actor's live center-manager role.
do $migration$
declare
 dispatcher text := pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old_gate text := $old$person_contacts_visible:=org_reader or private.p07_same_person(org,target,person) or private.person_operational_access(org,person,center,target);$old$;
 new_gate text := $new$person_contacts_visible:=org_reader or case when cm and target<>person then
   private.person_operational_scope_matches(org,center,target,true) or private.p07_same_person(org,target,person)
  else
   private.p07_same_person(org,target,person) or private.person_operational_access(org,person,center,target)
  end;$new$;
begin
 if cardinality(string_to_array(dispatcher,old_gate))<>2 then raise exception 'Unexpected person detail access decision'; end if;
 execute replace(dispatcher,old_gate,new_gate);
end
$migration$;
commit;
