begin;
-- The account comes only from the native session in execute_operation. This
-- projection is an identity/scope snapshot, never a grant for a later command.
create function private.account_self_context(org uuid,account uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare person uuid;members uuid[];scopes jsonb;
begin
 select private.p07_person_root(org,l.person_id) into person from core.account_links l
  join core.accounts a on a.id=l.account_id and a.state='active'
  where l.org_id=org and l.account_id=account and l.state='active' and l.verified_at is not null;
 if person is null or not exists(select 1 from core.people p where p.org_id=org and p.id=person and p.state='active') then return null;end if;
 members:=private.p07_person_members(org,person);
 select coalesce(jsonb_agg(jsonb_build_object('center_id',c.id,
  'student',exists(select 1 from core.center_relationships x where x.org_id=org and x.center_id=c.id and x.person_id=any(members) and x.kind='student' and x.state='active'),
  'instructor',private.has_role(org,person,'instructor',c.id),
  'assistant',private.has_role(org,person,'assistant',c.id)) order by c.id),'[]'::jsonb) into scopes
 from core.centers c where c.org_id=org and c.state='active' and private.center_accessible(org,c.id)
 and private.access_mode(org) in ('normal','grace') and (
  private.is_org_reader(org,person) or private.is_manager(org,person,c.id)
  or private.has_role(org,person,'staff',c.id) or private.has_role(org,person,'instructor',c.id) or private.has_role(org,person,'assistant',c.id)
  or exists(select 1 from core.center_relationships x where x.org_id=org and x.center_id=c.id and x.person_id=any(members) and x.kind='student' and x.state='active'));
 return jsonb_build_object('person_id',person,'subscriber_number',private.subscriber_number(org,person),'centers',scopes);
end$$;
revoke all on function private.account_self_context(uuid,uuid) from public,anon,authenticated;
grant execute on function private.account_self_context(uuid,uuid) to service_role;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=' if out is null then out:=jsonb_build_object(''operation_id''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Self context projection anchor drift';end if;
 execute replace(b,a,$branch$ if p_operation='organizations_list_v1' then
  out:=jsonb_set(out,'{items}',coalesce((select jsonb_agg(x||jsonb_build_object('self_context',private.account_self_context((x->>'id')::uuid,actor.id)) order by n)
   from jsonb_array_elements(out->'items') with ordinality e(x,n)),'[]'::jsonb));
 end if;
$branch$||a);
end$patch$;
notify pgrst,'reload schema';
commit;
