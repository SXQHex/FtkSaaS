begin;

alter table core.organizations add column if not exists platform_suspended boolean not null default false;

create function private.platform_directory(r jsonb,actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 view_name text:=r->>'view';
 org_filter uuid:=(r#>>'{scope,org_id}')::uuid;
 payment_filter uuid:=(r->>'payment_id')::uuid;
 as_of timestamptz:=statement_timestamp();
 take int:=coalesce((r#>>'{page,limit}')::int,50);
 scope_hash text:=encode(extensions.digest(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text,'sha256'),'hex');
 cursor_data jsonb;after_at timestamptz;after_id uuid;items jsonb;next_cursor text;
begin
 if view_name not in ('organizations','owners','payments','verified_accounts')
  or take not between 1 and 200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc'
  or (view_name='verified_accounts' and (r->>'account_email' is null or r?'scope' or r#>>'{page,cursor}' is not null))
  or (view_name<>'verified_accounts' and r?'account_email')
  or (view_name<>'payments' and (r?'payment_state' or r?'payment_id')) then perform private.fail('VALIDATION_FAILED');end if;
 if r#>>'{page,cursor}' is not null then
  begin
   cursor_data:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;
   after_at:=(cursor_data->>'at')::timestamptz;after_id:=(cursor_data->>'id')::uuid;
   as_of:=(cursor_data->>'as_of')::timestamptz;
   if cursor_data->>'scope' is distinct from scope_hash or after_id is null or after_at is null or as_of is null
    or not isfinite(after_at) or not isfinite(as_of) or as_of>statement_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;

 select coalesce(jsonb_agg(jsonb_build_object('at',q.at,'id',q.id,'item',q.item) order by q.at,q.id),'[]') into items
 from (
  select entries.* from (
   select o.created_at at,o.id,jsonb_build_object('kind','organization','id',o.id,'name',o.name,'version',o.version,
    'state',o.state,'platform_suspended',o.platform_suspended,'access_mode',private.access_mode(o.id),'subscription_state',s.state,'grace_until',s.grace_until) item
   from core.organizations o left join lateral (
    select x.state,x.grace_until from core.saas_subscriptions x where x.org_id=o.id order by x.created_at desc,x.id desc limit 1
   ) s on true
   where view_name='organizations' and (org_filter is null or o.id=org_filter)
   union all
   select o.created_at,o.id,jsonb_build_object('kind','owner','org_id',o.id,'person_id',p.id,'display_name',p.display_name,'account_id',account.id)
   from core.organizations o join core.people p on p.org_id=o.id and p.id=o.owner_person_id left join lateral (
    select a.id from core.account_links l join core.accounts a on a.id=l.account_id
    join auth.users u on u.id=a.auth_user_id
    where l.org_id=o.id and l.person_id=p.id and l.state='active' and l.verified_at is not null
    and a.state='active' and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<statement_timestamp())
    order by a.id limit 1
   ) account on true
   where view_name='owners' and (org_filter is null or o.id=org_filter)
   union all
   select p.created_at,p.id,jsonb_build_object('kind','payment','id',p.id,'org_id',p.org_id,'amount_minor',p.amount_minor::text,
    'currency',p.currency,'state',p.state,'version',p.version,'reference',p.reference,'occurred_at',p.occurred_at,'verified_at',p.verified_at)
   from core.saas_payment_verifications p
   where view_name='payments' and (org_filter is null or p.org_id=org_filter) and (payment_filter is null or p.id=payment_filter)
    and (r->>'payment_state' is null or p.state=r->>'payment_state')
   union all
   select a.created_at,a.id,jsonb_build_object('kind','verified_account','account_id',a.id)
   from core.accounts a join auth.users u on u.id=a.auth_user_id
   where view_name='verified_accounts' and lower(u.email)=lower(btrim(r->>'account_email'))
    and a.state='active' and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<statement_timestamp())
  ) entries
  where entries.at<=as_of and (after_id is null or (entries.at,entries.id)>(after_at,after_id))
  order by entries.at,entries.id limit take+1
 ) q;

 if view_name='verified_accounts' and jsonb_array_length(items)>1 then perform private.fail('ACCOUNT_LINK_CONFLICT');end if;
 if jsonb_array_length(items)>take then
  items:=items-take;
  next_cursor:=encode(convert_to(jsonb_build_object('scope',scope_hash,'at',items->-1->'at',
   'id',items->-1->'id','as_of',as_of)::text,'UTF8'),'hex');
 end if;
 select coalesce(jsonb_agg(x->'item' order by n),'[]') into items from jsonb_array_elements(items) with ordinality t(x,n);
 return jsonb_build_object('items',items,'next_cursor',next_cursor,'as_of',as_of);
end$$;

do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor text;
begin
 anchor:=' -- DOMAIN_CASES';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform directory dispatch drift';end if;
 body:=replace(body,anchor,$a$
 when 'platform_directory_get_v1' then
  return jsonb_build_object('ok',true,'data',private.platform_directory(r,actor.id),'trace_id',trace);
$a$||anchor);
 anchor:=$a$ if out is null then out:=jsonb_build_object('operation_id',operation_id$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform self-scope projection drift';end if;
 execute replace(body,anchor,$a$ if p_operation='account_get_v1' and r->'include_platform_scope'='true'::jsonb then
  out:=out||jsonb_build_object('platform_scope',jsonb_build_object(
   'organizations',platform,'organization_create',platform,'organization_suspend',platform,'owner_manage',platform,'payment_verify',platform,'grace_extend',platform));
 end if;
$a$||anchor);
end$patch$;

insert into private.runtime_operations(name,permission,billing_class,features) values('platform_directory_get_v1','platform.owner','exempt',array[]::text[]);
create function api_v1.platform_directory_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('platform_directory_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.platform_directory(jsonb,uuid),api_v1.platform_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.platform_directory(jsonb,uuid),api_v1.platform_directory_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
