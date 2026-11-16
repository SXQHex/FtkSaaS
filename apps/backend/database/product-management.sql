begin;
do $state$
declare c record;col smallint;seen bool:=false;
begin
 select attnum into col from pg_attribute where attrelid='core.products'::regclass and attname='state';
 for c in select conname from pg_constraint where conrelid='core.products'::regclass and contype='c' and conkey=array[col] loop
  execute format('alter table core.products drop constraint %I',c.conname);seen:=true;
 end loop;
 if not seen then raise exception 'Product state CHECK anchor missing';end if;
 alter table core.products add constraint products_lifecycle_state check(state in ('active','inactive','archived'));
end$state$;
create function private.product_lifecycle(r jsonb,org uuid,center uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare p core.products;new_state text:=case r->>'action' when 'open' then 'active' when 'close' then 'inactive' when 'archive' then 'archived' end;
begin
 if new_state is null or nullif(btrim(r->>'reason'),'') is null or length(r->>'reason')>2000 then perform private.fail('VALIDATION_FAILED');end if;
 select x.* into p from core.products x where x.org_id=org and x.center_id=center and x.id=(r->>'product_id')::uuid for update;
 if p.id is null then perform private.fail('NOT_FOUND');end if;
 if (select v.kind from core.product_versions v where v.org_id=org and v.product_id=p.id order by v.effective_at desc,v.created_at desc,v.id desc limit 1)='timed' then perform private.require_feature(org,'F16');end if;
 if p.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if p.state=new_state then perform private.fail('INVALID_STATE_TRANSITION');end if;
 update core.products set state=new_state,version=version+1 where org_id=org and id=p.id;
 return jsonb_build_object('id',p.id,'version',p.version+1,'audit',jsonb_build_object('before',to_jsonb(p),'state',new_state));
end$$;
create function private.product_management_page(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare view_name text:=coalesce(r->>'view','products');items jsonb;totals jsonb;result jsonb;at timestamptz:=clock_timestamp();is_starter bool:=private.current_plan_name(org)='starter';
begin
 if center is null or not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
 if view_name not in ('products','versions','sales') then perform private.fail('VALIDATION_FAILED');end if;
 if view_name<>'products' and r->>'product_id' is null then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'product_id' is not null and not exists(select 1 from core.products p where p.org_id=org and p.center_id=center and p.id=(r->>'product_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 if coalesce((r->>'include_timed_products')::bool,false) then perform private.require_feature(org,'F16');end if;
 with catalog as materialized(
  select p.* from core.products p join lateral(select v.id,v.kind from core.product_versions v where v.org_id=org and v.product_id=p.id and v.effective_at<=at order by v.effective_at desc,v.created_at desc,v.id desc limit 1) v on true
  where p.org_id=org and p.center_id=center and (not is_starter or private.starter_product_allowed(org,v.id)) and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false))
 ), current_rights as materialized(
  select s.id,s.person_id,s.product_version_id from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id
  join core.product_versions v on v.org_id=s.org_id and v.id=s.product_version_id join catalog p on p.id=v.product_id
  where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and s.state='active' and a.state='active' and s.valid_from<=at and s.valid_until>at
   and (v.kind='timed' or private.credit_available(org,s.id)+(select coalesce(sum(x.quantity),0) from core.entitlement_allocations x where x.org_id=org and x.sale_id=s.id and x.state='reserved')>0)
 ) select jsonb_build_object('on_sale',(select count(*) from catalog p where p.state='active'),'closed',(select count(*) from catalog p where p.state='inactive'),
  'archived',(select count(*) from catalog p where p.state='archived'),'active_right_holders',(select count(distinct private.p07_person_root(org,s.person_id)) from current_rights s),
  'last_30_days',coalesce((select jsonb_agg(jsonb_build_object('currency',q.currency,'sales',q.n,'net_minor',q.net::text) order by q.currency) from(
   select s.currency,count(*) n,sum(s.net_minor::numeric) net from core.sales s join core.product_versions v on v.org_id=s.org_id and v.id=s.product_version_id join catalog p on p.id=v.product_id
   where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and s.created_at>=at-interval '30 days' and s.created_at<=at group by s.currency) q),'[]'::jsonb)) into totals;
 if view_name='products' then
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,'created_at',p.created_at,'state',p.state,'name',p.name,'version_id',v.id,'terms',private.catalog_terms(org,p.id,v.id),
   'active_right_holders',(select count(distinct private.p07_person_root(org,s.person_id)) from core.sales s join core.entitlement_accounts a on a.org_id=s.org_id and a.sale_id=s.id join core.product_versions x on x.org_id=s.org_id and x.id=s.product_version_id
    where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and x.product_id=p.id and s.state='active' and a.state='active' and s.valid_from<=at and s.valid_until>at
     and (x.kind='timed' or private.credit_available(org,s.id)+(select coalesce(sum(z.quantity),0) from core.entitlement_allocations z where z.org_id=org and z.sale_id=s.id and z.state='reserved')>0))) order by p.created_at,p.id),'[]') into items
  from core.products p join lateral(select x.* from core.product_versions x where x.org_id=org and x.product_id=p.id and x.effective_at<=at order by x.effective_at desc,x.created_at desc,x.id desc limit 1) v on true
  where p.org_id=org and p.center_id=center and (not is_starter or private.starter_product_allowed(org,v.id)) and (r->>'product_id' is null or p.id=(r->>'product_id')::uuid)
   and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false))
   and (coalesce(r->>'status','all')='all' or p.state=case r->>'status' when 'on_sale' then 'active' when 'closed' then 'inactive' when 'archived' then 'archived' end)
   and (r->>'query' is null or strpos(lower(p.name),lower(r->>'query'))>0);
 elsif view_name='versions' then
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'created_at',v.created_at,'product_id',v.product_id,'terms',private.catalog_terms(org,v.product_id,v.id)) order by v.created_at,v.id),'[]') into items
  from core.product_versions v where v.org_id=org and v.center_id=center and (not is_starter or private.starter_product_allowed(org,v.id)) and v.product_id=(r->>'product_id')::uuid
   and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false)) and (r->>'query' is null or strpos(lower(v.published_name),lower(r->>'query'))>0);
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'version',s.version,'created_at',s.created_at,'person_id',private.p07_person_root(org,s.person_id),
   'display_name',private.directory_person_name(org,center,actor,s.person_id),'product_version_id',v.id,'product_name',v.published_name,'net_minor',s.net_minor::text,'currency',s.currency,'state',s.state) order by s.created_at,s.id),'[]') into items
  from core.sales s join core.product_versions v on v.org_id=s.org_id and v.id=s.product_version_id where s.org_id=org and s.center_id=center and (not is_starter or private.member_summary_enabled(org,array['finance_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'person_id',private.p07_person_root(org,s.person_id)))) and (not is_starter or private.starter_product_allowed(org,v.id)) and v.product_id=(r->>'product_id')::uuid
   and (v.kind='credits' or coalesce((r->>'include_timed_products')::bool,false)) and (r->>'query' is null or strpos(lower(v.published_name),lower(r->>'query'))>0);
 end if;
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page')::text),at);
 return result||jsonb_build_object('view',view_name,'totals',totals);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product management dispatch anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='products_management_list_v1' then
  out:=private.product_management_page(r,org,center,person,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
 a:=$a$ when 'product_publish_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product lifecycle write anchor drift';end if;
 b:=replace(b,a,$a$ when 'product_state_set_v1' then
  terms:=private.product_lifecycle(r,org,center);record_id:=(terms->>'id')::uuid;version_n:=(terms->>'version')::bigint;subject:='products';audit_delta:=terms->'audit';
$a$||a||$a$
  if r->>'expected_version' is not null and not exists(select 1 from core.products p where p.org_id=org and p.center_id=center and p.id=(r->>'product_id')::uuid and p.version=(r->>'expected_version')::bigint) then perform private.fail('VERSION_CONFLICT');end if;
$a$);
 a:=$a$case when private.current_plan_name(org)='starter' then terms->>'name' else (select name from core.products where org_id=org and id=selected) end$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product version name anchor drift';end if;
 b:=replace(b,a,$a$terms->>'name'$a$);
 a:=$a$if private.current_plan_name(org)='starter' then update core.products set name=terms->>'name',version=version+1 where org_id=org and id=selected and name is distinct from terms->>'name';end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product master name anchor drift';end if;
 b:=replace(b,a,$a$if r->>'product_id' is not null then update core.products set name=terms->>'name',version=version+1 where org_id=org and id=selected;end if;$a$);
 a:=$a$ if p_aux->>'phase'='p06_authorize_original' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product state feature preflight anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='product_state_set_v1' and (select v.kind from core.product_versions v where v.org_id=org and v.center_id=center and v.product_id=(r->>'product_id')::uuid order by v.effective_at desc,v.created_at desc,v.id desc limit 1)='timed' then perform private.require_feature(org,'F16');end if;
$a$||a);
 execute b;
 b:=pg_get_functiondef('private.starter_request_guard(text,jsonb,uuid)'::regprocedure);a:=$a$ if op='product_publish_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Starter product lifecycle anchor drift';end if;
 execute replace(b,a,$a$ if op='product_state_set_v1' then
  select v.id into target from core.product_versions v where v.org_id=org and v.product_id=(r->>'product_id')::uuid order by v.effective_at desc,v.created_at desc,v.id desc limit 1;
  if target is null or not private.starter_product_allowed(org,target) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
$a$||a);
 b:=pg_get_functiondef('private.starter_replay_guard(text,uuid,uuid)'::regprocedure);a:=$a$elsif op='product_publish_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Starter product lifecycle replay anchor drift';end if;
 execute replace(b,a,$a$elsif op='product_state_set_v1' then
  select v.id into product from core.product_versions v where v.org_id=org and v.product_id=reference order by v.effective_at desc,v.created_at desc,v.id desc limit 1;
  if not coalesce(private.starter_product_allowed(org,product),false) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
$a$||a);
 b:=pg_get_functiondef('private.sale_discount_amount(uuid,uuid,uuid,uuid,text)'::regprocedure);a:=' if price is null then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product sale gate anchor drift';end if;
 execute replace(b,a,$a$ if not exists(select 1 from core.product_versions v join core.products p on p.org_id=v.org_id and p.id=v.product_id where v.org_id=org and v.id=product_version and p.state='active') then perform private.fail('FORBIDDEN');end if;
$a$||a);
 b:=pg_get_functiondef('private.sale_impact(jsonb,uuid,uuid,uuid,uuid,uuid)'::regprocedure);a:=$a$'product',to_jsonb(p),$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Product publication sale dependency anchor drift';end if;
 execute replace(b,a,a||$a$'catalog_product',(select to_jsonb(x) from core.products x where x.org_id=org and x.id=p.product_id),$a$);
end$patch$;
revoke all on function private.product_lifecycle(jsonb,uuid,uuid),private.product_management_page(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.product_lifecycle(jsonb,uuid,uuid),private.product_management_page(jsonb,uuid,uuid,uuid,uuid) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('products_management_list_v1','product.manage','read',array['F15','F06','F19']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
insert into private.runtime_operations(name,permission,billing_class,features) values('product_state_set_v1','product.manage','config',array['F15']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create function api_v1.products_management_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('products_management_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
create function api_v1.product_state_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('product_state_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.products_management_list_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.product_state_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.products_management_list_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.product_state_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
