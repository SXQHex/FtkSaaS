-- P01-A: catalog and session-context purchased-right reads. Prior migrations are immutable.
begin;
create or replace function private.catalog_center_access(org uuid,actor uuid,center uuid)
returns bool language sql stable security invoker set search_path='' as $$
 select private.center_accessible(org,center) and (
 private.is_org_reader(org,actor) or private.is_manager(org,actor,center)
 or private.staff_grant(org,actor,center,'reservation.write') or private.staff_grant(org,actor,center,'sale.write')
 or private.staff_grant(org,actor,center,'person.manage')
 or exists(select 1 from core.center_relationships c where c.org_id=org and c.center_id=center and c.person_id=actor and c.kind='student' and c.state='active'))
$$;
create or replace function private.catalog_terms(org uuid,product uuid,wanted_version uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('name',p.name,'kind',v.kind,'booking_mode',v.booking_mode,'credits',v.credits,
 'price_minor',v.price_minor::text,'currency',v.currency,'freeze',v.freeze_terms,'refund',v.refund_terms,'quota',v.quota,
 'scopes',coalesce((select jsonb_agg(jsonb_build_object('scope_kind',s.scope_kind,'center_id',s.center_id,
 'discipline_id',s.discipline_id,'class_id',s.class_id,'event_id',s.event_id,'usage_targets',to_jsonb(s.usage_targets)) order by s.created_at,s.id)
 from core.product_scopes s where s.org_id=org and s.product_version_id=v.id),'[]'::jsonb))
 from core.products p join core.product_versions v on v.org_id=p.org_id and v.product_id=p.id
 where p.org_id=org and p.id=product and v.id=wanted_version
$$;
create or replace function private.catalog_page(r jsonb,org uuid,actor uuid,center uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text:=coalesce(r#>>'{page,sort}','created_at_asc');
 fingerprint text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;last_item jsonb;token text;
begin
 if lim<1 or lim>200 or sorting not in ('created_at_asc','created_at_desc') then perform private.fail('VALIDATION_FAILED');end if;
 if center is not null and not private.catalog_center_access(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if not exists(select 1 from core.centers c where c.org_id=org and (center is null or c.id=center) and private.catalog_center_access(org,actor,c.id)) then perform private.fail('FORBIDDEN');end if;
 if coalesce((r->>'include_timed_products')::bool,false) then perform private.require_feature(org,'F16');end if;
 fingerprint:=encode(extensions.digest(jsonb_build_object('actor',actor,'request',r-'request_id'-'page','sort',sorting)::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;
   if jsonb_typeof(cur) is distinct from 'object' or cur->>'scope' is distinct from fingerprint or cur->>'at' is null or cur->>'id' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
   if not isfinite(last_at) then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(q.item order by case when sorting='created_at_desc' then q.at_time end desc,
 case when sorting='created_at_asc' then q.at_time end,
 case when sorting='created_at_desc' then q.id end desc,case when sorting='created_at_asc' then q.id end),'[]'::jsonb) into items from (
  select p.created_at at_time,p.id,jsonb_build_object('id',p.id,'version_id',v.id,'terms',private.catalog_terms(org,p.id,v.id),'_at',p.created_at) item
  from core.products p join lateral (select x.* from core.product_versions x where x.org_id=p.org_id and x.product_id=p.id and x.effective_at<=now()
   order by x.effective_at desc,x.created_at desc,x.id desc limit 1) v on true
  where p.org_id=org and p.state='active' and (center is null or p.center_id=center)
  and private.catalog_center_access(org,actor,p.center_id)
  and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false))
  and (cur is null or (sorting='created_at_asc' and (p.created_at,p.id)>(last_at,last_id))
   or (sorting='created_at_desc' and (p.created_at,p.id)<(last_at,last_id)))
  order by case when sorting='created_at_desc' then p.created_at end desc,case when sorting='created_at_asc' then p.created_at end,
   case when sorting='created_at_desc' then p.id end desc,case when sorting='created_at_asc' then p.id end limit lim+1
 ) q;
 if jsonb_array_length(items)>lim then
  items:=items-lim;last_item:=items->(lim-1);
  token:=encode(convert_to(jsonb_build_object('scope',fingerprint,'at',last_item->>'_at','id',last_item->>'id')::text,'UTF8'),'hex');
 end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',now());
end$$;
create or replace function private.purchased_rights(r jsonb,org uuid,actor uuid,center uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare target uuid:=(r->>'person_id')::uuid;ses core.sessions;out jsonb;has_context bool:=r->>'session_id' is not null;
begin
 if not exists(select 1 from core.people p where p.org_id=org and p.id=target) then perform private.fail('NOT_FOUND');end if;
 if r->>'booking_mode' is not null and not has_context then perform private.fail('VALIDATION_FAILED');end if;
 if has_context then
  select * into ses from core.sessions s where s.org_id=org and s.id=(r->>'session_id')::uuid and s.center_id=center;
  if not found then perform private.fail('NOT_FOUND');end if;
  -- This is a pool/scope projection, not a new session-discovery or roster grant.
  if not private.catalog_center_access(org,actor,center) then perform private.fail('FORBIDDEN');end if;
  if target<>actor and not private.is_org_reader(org,actor)
   and not (private.person_operational_access(org,actor,center,target)
    and (private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'reservation.write'))) then perform private.fail('FORBIDDEN');end if;
 else
  if target<>actor and not private.is_org_reader(org,actor)
   and not (private.is_manager(org,actor,center) and private.person_operational_access(org,actor,center,target)) then perform private.fail('FORBIDDEN');end if;
 end if;
 if coalesce((r->>'include_timed_rights')::bool,false) then perform private.require_feature(org,'F16');end if;
 select coalesce(jsonb_agg(q.item order by q.valid_until asc nulls last,q.created_at,q.id),'[]'::jsonb) into out from (
 select s.id,s.valid_until,s.created_at,
 jsonb_build_object('sale_id',s.id,'person_id',s.person_id,'product_version_id',p.id,'booking_mode',p.booking_mode,'kind',p.kind,
 'start_date',s.start_date,'end_date',s.end_date,'timezone',s.timezone,'state',a.state,
 'available',case when p.kind='credits' then greatest(0,private.credit_available(org,s.id)) else 0 end,
 'reserved',coalesce((select sum(quantity) from core.entitlement_allocations where org_id=org and sale_id=s.id and state='reserved'),0),
 'consumed',coalesce((select sum(private.credit_effect(org,m.id)*-1) from core.entitlement_movements m where m.org_id=org and m.sale_id=s.id and m.kind in ('consume','reverse')),0),
 'deficit',coalesce((select sum(quantity) from core.credit_deficits where org_id=org and person_id=target and state in ('reserved','consumed') and (center is null or center_id=center)),0),
 'deficit_scopes',coalesce((select jsonb_agg(jsonb_build_object('center_id',x.center_id,'discipline_id',x.discipline_id,'reserved',x.r,'consumed',x.c) order by x.center_id,x.discipline_id)
 from (select center_id,discipline_id,coalesce(sum(quantity) filter(where state='reserved'),0) r,coalesce(sum(quantity) filter(where state='consumed'),0) c
 from core.credit_deficits where org_id=org and person_id=target and state in ('reserved','consumed') and (center is null or center_id=center) group by center_id,discipline_id) x),'[]'::jsonb),
 'quotas',coalesce((select jsonb_agg(jsonb_build_object('starts_at',q.starts_at,'ends_at',q.ends_at,'limit',q.limit_count,'reserved',q.reserved_count,'consumed',q.consumed_count) order by q.starts_at,q.ends_at)
 from core.quota_buckets q where q.org_id=org and q.sale_id=s.id),'[]'::jsonb))
 || case when has_context then jsonb_build_object('available_at_session',private.available_for(org,s.id,ses.starts_at)) else '{}'::jsonb end item
 from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id join core.product_versions p on p.org_id=s.org_id and p.id=s.product_version_id
 where s.org_id=org and s.person_id=target and (p.kind='credits' or coalesce((r->>'include_timed_rights')::bool,false))
 and (has_context or center is null or s.center_id=center)
 and (has_context or private.center_accessible(org,s.center_id))
 and (not has_context or (ses.state='planned' and s.state='active' and private.lesson_scope_matches(org,ses.id,p.id)
  and private.available_for(org,s.id,ses.starts_at)>0 and (r->>'booking_mode' is null or p.booking_mode=r->>'booking_mode')))
 ) q;
 return out;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
begin
 if strpos(b,' -- DOMAIN_CASES')=0 or strpos(b,'when ''entitlements_get_v1'' then')=0 then raise exception 'P01 read dispatch anchors missing';end if;
 b:=replace(b,' -- DOMAIN_CASES',$c$
 when 'products_list_v1' then out:=private.catalog_page(r,org,person,center);
 -- DOMAIN_CASES
 $c$);
 b:=regexp_replace(b,$rx$when 'entitlements_get_v1' then.*?(?=when 'class_save_v1' then)$rx$,$c$when 'entitlements_get_v1' then
  out:=private.purchased_rights(r,org,person,center);
 $c$,'s');
 execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('products_list_v1','person.read','read',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.products_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('products_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.products_list_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.products_list_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('entitlements_get_v1','person.read','read',array['F06','F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.entitlements_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('entitlements_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.entitlements_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.entitlements_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
