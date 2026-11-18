begin;

create table private.studio_setup_requests(
 id uuid primary key,
 account_id uuid not null references core.accounts(id),
 name text not null check(length(btrim(name)) between 1 and 200),
 created_at timestamptz not null default statement_timestamp(),
 organization_id uuid unique references core.organizations(id)
);
create unique index studio_setup_one_pending on private.studio_setup_requests(account_id) where organization_id is null;
create index studio_setup_account_order on private.studio_setup_requests(account_id,created_at,id);
alter table private.studio_setup_requests enable row level security;
revoke all on private.studio_setup_requests from public,anon,authenticated;
grant select,insert,update on private.studio_setup_requests to service_role;

create function private.studio_setup_list(r jsonb,account uuid,platform boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare queue boolean:=coalesce((r->>'platform_queue')::boolean,false);items jsonb;
begin
 if queue and not platform then perform private.fail('FORBIDDEN');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'account_id',s.account_id,'name',s.name,'created_at',s.created_at,
  'state',case when s.organization_id is null then 'pending' else 'fulfilled' end,'organization_id',s.organization_id)
  order by s.created_at,s.id),'[]') into items
 from private.studio_setup_requests s where
  (queue and s.organization_id is null and exists(
   select 1 from core.accounts a join auth.users u on u.id=a.auth_user_id
   where a.id=s.account_id and a.state='active' and u.email_confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<statement_timestamp())
   ) and not exists(select 1 from core.account_links l where l.account_id=s.account_id and l.state='active'))
  or (not queue and s.account_id=account);
 return private.p06_page(items,r->'page','studio-setup:'||account||':'||queue,statement_timestamp());
end$$;

create function private.studio_setup_open(r jsonb,account uuid,id uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if length(btrim(r->>'name')) not between 1 and 200 then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from core.account_links l where l.account_id=account and l.state='active') then
  perform private.fail('INVALID_STATE_TRANSITION');
 end if;
 insert into private.studio_setup_requests(id,account_id,name) values(id,account,btrim(r->>'name'))
 on conflict(account_id) where organization_id is null do nothing;
 if not found then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
end$$;

do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor text;
begin
 anchor:='elsif perm_code=''calendar.self'' then null;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Setup request account scope drift';end if;
 body:=replace(body,anchor,$a$elsif p_operation in ('studio_setup_list_v1','studio_setup_open_v1') then null;
 elsif perm_code='calendar.self' then null;$a$);

 anchor:=$a$ when 'organization_create_v1' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Setup request platform creation drift';end if;
 body:=replace(body,anchor,anchor||$a$
  if r?'studio_setup_id' then
   perform 1 from core.accounts a join auth.users u on u.id=a.auth_user_id
   where a.id=(r->>'verified_account_id')::uuid and a.state='active' and u.email_confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<statement_timestamp()) for update of a;
   if not found or exists(select 1 from core.account_links l where l.account_id=(r->>'verified_account_id')::uuid and l.state='active')
   then perform private.fail('INVALID_STATE_TRANSITION');end if;
   perform 1 from private.studio_setup_requests s where s.id=(r->>'studio_setup_id')::uuid
    and s.account_id=(r->>'verified_account_id')::uuid and s.organization_id is null and s.name=btrim(r->>'name') for update;
   if not found then perform private.fail('NOT_FOUND');end if;
  end if;$a$);

 anchor:=$a$  if p_operation='organization_create_v1' then update core.operation_receipts set org_id=org where id=operation_id;end if;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Setup request completion drift';end if;
 body:=replace(body,anchor,anchor||$a$
  if p_operation='organization_create_v1' and r?'studio_setup_id' then
   update private.studio_setup_requests set organization_id=org where id=(r->>'studio_setup_id')::uuid;
  end if;$a$);

 anchor:=' -- DOMAIN_CASES';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Setup request dispatch drift';end if;
 execute replace(body,anchor,$a$
 when 'studio_setup_list_v1' then out:=private.studio_setup_list(r,actor.id,platform);
 when 'studio_setup_open_v1' then perform private.studio_setup_open(r,actor.id,record_id);subject:='accounts';
$a$||anchor);
end$patch$;

insert into private.runtime_operations(name,permission,billing_class,features) values('studio_setup_list_v1','account.self','exempt',array[]::text[]);
insert into private.runtime_operations(name,permission,billing_class,features) values('studio_setup_open_v1','account.self','exempt',array[]::text[]);
create function api_v1.studio_setup_list_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('studio_setup_list_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
create function api_v1.studio_setup_open_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('studio_setup_open_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.studio_setup_list(jsonb,uuid,boolean),private.studio_setup_open(jsonb,uuid,uuid),
 api_v1.studio_setup_list_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.studio_setup_open_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.studio_setup_list(jsonb,uuid,boolean),private.studio_setup_open(jsonb,uuid,uuid),
 api_v1.studio_setup_list_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.studio_setup_open_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
