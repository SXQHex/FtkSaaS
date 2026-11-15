begin;
-- One canonical visible person per row, including people without any link.
-- The legacy link-record directory remains unchanged.
create function private.account_person_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare k jsonb:=r#>'{selector,key}';raw jsonb;filtered jsonb;result jsonb;items jsonb;summary jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,center);
 if private.access_mode(org)='bootstrap' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 if private.access_mode(org)='closed' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if k->>'directory' is distinct from 'center' or k->>'view' is distinct from 'people' or coalesce(k->>'status','all') not in ('linked','unlinked','all') then perform private.fail('VALIDATION_FAILED');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb then perform private.fail('VALIDATION_FAILED');end if;
 with eligible as materialized(
  select p.id,p.version,p.created_at,private.directory_person_name(org,center,actor,p.id) display_name
  from core.people p where p.org_id=org and p.merged_into_id is null
   and (exists(select 1 from private.person_center_relationships x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,p.id))
    or exists(select 1 from core.invitations x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,p.id))
    or exists(select 1 from core.role_assignments x where x.org_id=org and private.p07_same_person(org,x.person_id,p.id) and (x.scope_center_id=center or x.scope_center_id is null)))
 ), rows as(
  select p.*,l.id link_id,l.version link_version from eligible p left join lateral(
   select x.id,x.version from core.account_links x where x.org_id=org and x.state='active' and private.p07_same_person(org,x.person_id,p.id) order by x.created_at,x.id limit 1
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
do $patch$
declare b text:=pg_get_functiondef('private.p07_revoke_management(jsonb,uuid,uuid,uuid)'::regprocedure);a text;
begin
 a:=$a$ if k->>'directory' is distinct from 'center' then$a$;
 if strpos(b,a)=0 then raise exception 'Account person directory anchor drift';end if;
 execute replace(b,a,$a$ if op='account_link_remove_v1' and k->>'view'='people' then
  select l.account_id into account from core.account_links l where l.org_id=org and l.person_id=actor and l.state='active' and l.verified_at is not null;
  return private.account_person_directory(r,org,center,actor,account);
 end if;
$a$||a);
 -- Invitation lifecycle groups are evaluated before pagination, using effective expiry.
 b:=pg_get_functiondef('private.p07_revoke_management(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=$a$where k->>'status' is null or state=k->>'status'$a$;
 if strpos(b,a)=0 then raise exception 'Invitation grouped status anchor drift';end if;
 execute replace(b,a,$a$where k->>'status' is null or k->>'status'='all' or state=k->>'status' or (op='account_access_revoke_v1' and ((k->>'status'='open' and state='pending') or (k->>'status'='closed' and state in ('expired','accepted','revoked'))))$a$);
end$patch$;
revoke all on function private.account_person_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.account_person_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
commit;
