begin;

-- Page selection and the per-person contact visibility decision stay in the dispatcher.
-- A merged family uses the detail reader's canonical identity and contact deduplication.
create function private.people_page_projection(p_org uuid, p_center uuid, targets uuid[], show_contacts boolean[])
returns jsonb language sql stable security invoker set search_path='' as $$
 with page as materialized (
  select p.*, t.ordinal, show_contacts[t.ordinal] as include_contacts,
   p.merged_into_id is null and not exists (
    select 1 from core.people alias where alias.org_id=p_org and alias.merged_into_id=p.id
   ) as single_person
  from unnest(targets) with ordinality t(id,ordinal)
  join core.people p on p.id=t.id and p.org_id=p_org
 ), single_rows as materialized (
  select * from page where single_person
 ), relationships as (
  select cr.person_id,jsonb_agg(jsonb_build_object('center_id',cr.center_id,'kind',cr.kind,'state',cr.state)
   order by cr.center_id,cr.kind,cr.created_at,cr.id) as items
  from single_rows p join private.person_center_relationships cr on cr.person_id=p.id and cr.org_id=p_org
  where p_center is null or cr.center_id=p_center
  group by cr.person_id
 ), distinct_contacts as (
  select distinct on (c.person_id,c.kind,c.value) c.person_id,c.id,c.kind,c.value,c.verified_at,c.created_at
  from single_rows p join core.person_contacts c on c.org_id=p_org and c.person_id=p.id
  where p.include_contacts and not c.account_projection_retired
  order by c.person_id,c.kind,c.value,c.verified_at desc nulls last,c.created_at,c.id
 ), contacts as (
  select c.person_id,jsonb_agg(jsonb_build_object('kind',c.kind,'value',c.value,'verified_at',c.verified_at,
   'field_policy',private.person_contact_field_policy(p_org,array[c.person_id],c.kind,c.value,p.state='active'))
   order by c.created_at,c.id) as items
  from distinct_contacts c join single_rows p on p.id=c.person_id group by c.person_id
 ), numbers as (
  select n.person_id,min(n.number)::text as subscriber_number
  from single_rows p join private.subscriber_numbers n on n.org_id=p_org and n.person_id=p.id group by n.person_id
 ), projected as (
  select p.ordinal,p.created_at,jsonb_build_object(
   'id',p.id,'display_name',p.display_name,'given_name',p.given_name,'family_name',p.family_name,
   'field_policy',private.person_name_field_policy(p_org,p.id),'subscriber_number',n.subscriber_number,
   'linked_person_ids',jsonb_build_array(p.id),'relationships',coalesce(r.items,'[]'::jsonb))
   || case when p.include_contacts then jsonb_build_object('contacts',coalesce(c.items,'[]'::jsonb)) else '{}'::jsonb end as item
  from single_rows p left join relationships r on r.person_id=p.id
  left join contacts c on c.person_id=p.id left join numbers n on n.person_id=p.id
  union all
  select p.ordinal,p.created_at,private.person_projection(p_org,p.id,p_center,p.include_contacts,false)
  from page p where not p.single_person
 )
 select coalesce(jsonb_agg(item || jsonb_build_object('_at',created_at) order by ordinal),'[]'::jsonb) from projected
$$;
revoke all on function private.people_page_projection(uuid,uuid,uuid[],boolean[]) from public,anon,authenticated;
grant execute on function private.people_page_projection(uuid,uuid,uuid[],boolean[]) to service_role;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 visibility text:='x.id=person or org_reader or (people_operational_reader and private.person_operational_scope_matches(org,center,x.id,cm))';
 original text:='coalesce(jsonb_agg(private.person_projection(org,x.id,center,'||visibility||',false)||jsonb_build_object(''_at'',x.created_at) order by x.created_at,x.id),''[]''::jsonb)';
 replacement text:='private.people_page_projection(org,center,array_agg(x.id order by x.created_at,x.id),array_agg(('||visibility||') order by x.created_at,x.id))';
begin
 if array_length(string_to_array(body,original),1)<>3 then raise exception 'Unexpected people list projection sites';end if;
 execute replace(body,original,replacement);
end $patch$;

commit;
