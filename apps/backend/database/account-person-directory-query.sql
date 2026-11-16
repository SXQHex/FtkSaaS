begin;
create or replace function private.account_person_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare k jsonb:=r#>'{selector,key}';raw jsonb;filtered jsonb;result jsonb;items jsonb;summary jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,center);
 if private.access_mode(org)='bootstrap' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 if private.access_mode(org)='closed' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if k->>'directory' is distinct from 'center' or k->>'view' is distinct from 'people' or coalesce(k->>'status','all') not in ('linked','unlinked','all') then perform private.fail('VALIDATION_FAILED');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb then perform private.fail('VALIDATION_FAILED');end if;
 -- Resolve each participating identity once. Calling same_person inside a
 -- correlated EXISTS for every person/relationship pair made this directory
 -- quadratic, before its cursor page was even selected.
 with center_people as materialized(
  select x.person_id from private.person_center_relationships x where x.org_id=org and x.center_id=center
  union select x.person_id from core.invitations x where x.org_id=org and x.center_id=center
  union select x.person_id from core.role_assignments x where x.org_id=org and (x.scope_center_id=center or x.scope_center_id is null)
 ), roots as materialized(
  select distinct private.p07_person_root(org,x.person_id) id from center_people x
 ), links as materialized(
  select x.id,x.version,x.created_at,private.p07_person_root(org,x.person_id) person_id from core.account_links x where x.org_id=org and x.state='active'
 ), eligible as materialized(
  select p.id,p.version,p.created_at,private.directory_person_name(org,center,actor,p.id) display_name
  from core.people p join roots z on z.id=p.id where p.org_id=org and p.merged_into_id is null
 ), rows as(
  select p.*,l.id link_id,l.version link_version from eligible p left join lateral(
   select x.id,x.version from links x where x.person_id=p.id order by x.created_at,x.id limit 1
  ) l on true where p.display_name is not null and (k->>'query' is null or strpos(lower(p.display_name),lower(k->>'query'))>0)
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'created_at',created_at,'display_name',display_name,'link_id',link_id,'link_version',link_version,
  'status',case when link_id is null then 'unlinked' else 'linked' end) order by created_at,id),'[]') into raw from rows;
 select coalesce(jsonb_agg(x order by n),'[]') into filtered from jsonb_array_elements(raw) with ordinality a(x,n) where coalesce(k->>'status','all')='all' or x->>'status'=k->>'status';
 select jsonb_build_object('total',jsonb_array_length(raw),'filtered',jsonb_array_length(filtered),'by_state',coalesce(jsonb_agg(jsonb_build_object('state',state,'count',n) order by state),'[]')) into summary
 from(select x->>'status' state,count(*) n from jsonb_array_elements(raw) x group by x->>'status') counts;
 result:=private.p06_page(filtered,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 select coalesce(jsonb_agg(case when x->>'link_id' is not null then private.access_directory_item('account_link_remove_v1',org,center,actor,account,(x->>'link_id')::uuid,at)
  else jsonb_build_object('operation','account_link_remove_v1','entity',jsonb_build_object('type','people','id',x->'id'),'exists',true,'state','inactive',
   'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','people','id',x->'id'),'version',x->'version')),'as_of',at,
   'current',jsonb_build_object('operation','account_link_remove_v1','values',jsonb_build_object('person_id',x->'id','actionable',false))) end
  ||jsonb_build_object('access_detail',jsonb_build_object('kind','person_account','person_id',x->'id','display_name',x->'display_name','created_at',x->'created_at','linked',x->>'link_id' is not null,'can_send_invitation',private.directory_resend_allowed(org,center,actor,(x->>'id')::uuid))) order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality a(x,n);
 return jsonb_build_object('data',jsonb_set(result,'{items}',items)||jsonb_build_object('access_summary',summary),'subject','people');
end$$;
commit;
