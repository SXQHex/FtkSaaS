begin;
-- This catalog is part of the Owner's subscription write context, not a
-- center-management grant. Only names and selection identifiers leave SQL.
create function private.downgrade_resource_rows(org uuid,center uuid,family text,number text) returns jsonb language sql stable security invoker set search_path='' as $$
 with resources as (
  select r.id,r.name display_name,r.created_at,null::text subscriber_number from core.rooms r
   where family='rooms' and r.org_id=org and r.center_id=center and r.state='active'
  union all
  select d.id,d.name,d.created_at,null::text from core.disciplines d
   where family='disciplines' and d.org_id=org and d.state='active' and exists(select 1 from core.center_disciplines c where c.org_id=org and c.center_id=center and c.discipline_id=d.id and c.state='active')
  union all
  select p.id,p.display_name,p.created_at,private.subscriber_number(org,p.id) from core.people p
   where family in ('instructors','students') and p.org_id=org and p.state='active'
   and case when family='instructors' then private.starter_instructor_active(org,center,p.id)
    else exists(select 1 from core.center_relationships c where c.org_id=org and c.center_id=center and c.person_id=p.id and c.kind='student' and c.state='active') end
 ) select coalesce(jsonb_agg(jsonb_build_object('kind',family,'id',id,'display_name',display_name,'subscriber_number',subscriber_number) order by created_at,id),'[]'::jsonb)
 from resources where number is null or subscriber_number=number
$$;
create function private.owner_downgrade_resources(r jsonb,org uuid,actor uuid,item jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare k jsonb:=r#>'{selector,key}';family text:=r#>>'{selector,resources}';number text:=r#>>'{selector,subscriber_number}';center uuid:=(k->>'kept_center_id')::uuid;items jsonb;result jsonb;at timestamptz:=clock_timestamp();
begin
 if actor is distinct from (select owner_person_id from core.organizations where id=org) then perform private.fail('FORBIDDEN');end if;
 if k->>'expected_version' is null then perform private.fail('VALIDATION_FAILED');end if;
 if family not in ('rooms','disciplines','instructors','students') or (number is not null and family<>'students') then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from jsonb_array_elements(private.subscription_downgrade_options(org,actor)) x where x->>'plan'='starter' and x#>>'{target,id}'=k->>'target_plan_id') then perform private.fail('NOT_FOUND');end if;
 if center is null or not exists(select 1 from core.centers c where c.org_id=org and c.id=center and c.state='active') then perform private.fail('NOT_FOUND');end if;
 if r->>'center_id' is not null and (r->>'center_id')::uuid<>center then perform private.fail('NOT_FOUND');end if;
 if k->>'expected_version' is not null and (k->>'expected_version')::bigint<>(item#>>'{versions,0,version}')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 select coalesce(jsonb_agg((item-'as_of')||jsonb_build_object('retained_resource',x) order by n),'[]'::jsonb) into items
  from jsonb_array_elements(private.downgrade_resource_rows(org,center,family,number)) with ordinality v(x,n);
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('actor',actor,'request',r-'page'-'request_id')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]'::jsonb) into items from jsonb_array_elements(result->'items') with ordinality v(x,n);
 return jsonb_set(result,'{items}',items);
end$$;
revoke all on function private.downgrade_resource_rows(uuid,uuid,text,text),private.owner_downgrade_resources(jsonb,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.downgrade_resource_rows(uuid,uuid,text,text),private.owner_downgrade_resources(jsonb,uuid,uuid,jsonb) to service_role;
do $patch$
declare b text:=pg_get_functiondef('private.p07_subscription_management(jsonb,uuid,uuid,boolean)'::regprocedure);a text:=$anchor$ return jsonb_build_object('data',$anchor$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Owner downgrade discovery anchor drift';end if;
 execute replace(b,a,$branch$ if op='subscription_downgrade_request_v1' and r#>>'{selector,resources}' is not null then
  return jsonb_build_object('data',private.owner_downgrade_resources(r,org,actor,jsonb_build_object('operation',op,'entity',jsonb_build_object('type',typ,'id',id),'exists',true,'state',state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',typ,'id',id),'version',v)),'as_of',statement_timestamp(),'current',jsonb_build_object('operation',op,'values',vals))),'primary_id',id,'subject',typ);
 end if;
$branch$||a);
end$patch$;
notify pgrst,'reload schema';
commit;
