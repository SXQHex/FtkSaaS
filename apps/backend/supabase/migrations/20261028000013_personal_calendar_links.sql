begin;
create table private.personal_calendar_links(
 id uuid primary key,account_id uuid not null references core.accounts(id),org_id uuid not null references core.organizations(id),
 kinds text[] not null check(cardinality(kinds) between 1 and 2 and kinds<@array['lessons','duties']::text[] and array_position(kinds,null) is null and (cardinality(kinds)=1 or kinds[1]<>kinds[2])),
 token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),state text not null default 'active' check(state in ('active','revoked')),
 version bigint not null default 1,created_at timestamptz not null default clock_timestamp()
);
create index personal_calendar_sessions_live on core.sessions(org_id,ends_at,id) where state='planned';
create index personal_calendar_links_account on private.personal_calendar_links(account_id,created_at,id);
create table private.personal_calendar_history(
 operation_id uuid primary key references core.operation_receipts(id),account_id uuid not null references core.accounts(id),
 link_id uuid not null references private.personal_calendar_links(id),action text not null,version bigint not null,created_at timestamptz not null default clock_timestamp()
);
alter table private.personal_calendar_links enable row level security;
alter table private.personal_calendar_history enable row level security;
revoke all on private.personal_calendar_links,private.personal_calendar_history from public,anon,authenticated;
grant select,insert,update on private.personal_calendar_links to service_role;
grant select,insert on private.personal_calendar_history to service_role;
create trigger personal_calendar_history_immutable before update or delete on private.personal_calendar_history for each row execute function private.append_only();
create function private.personal_calendar_view(link private.personal_calendar_links) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',($1).id,'org_id',($1).org_id,'kinds',to_jsonb(($1).kinds),'state',($1).state,'version',($1).version,'created_at',($1).created_at)
$$;
create function private.personal_calendar_person(org uuid,account uuid,for_write boolean default true) returns uuid language plpgsql volatile security invoker set search_path='' as $$
declare person uuid;
begin
 -- Same org lock as role/link/plan mutations. Account lock is taken first by execute_operation.
 if for_write then perform 1 from core.organizations where id=org for update;else perform 1 from core.organizations where id=org for share;end if;if not found then perform private.fail('NOT_FOUND');end if;
 if private.access_mode(org) not in ('normal','grace') then perform private.fail('NOT_FOUND');end if;
 perform private.require_feature(org,'F08');person:=private.person_for(org,account);
 if person is null or not exists(select 1 from core.people where org_id=org and id=person and state='active') then perform private.fail('NOT_FOUND');end if;
 return person;
end$$;
create function private.personal_calendar_authorize(op text,r jsonb,account uuid,aux jsonb) returns void language plpgsql volatile security invoker set search_path='' as $$
declare link private.personal_calendar_links;org uuid;previous uuid;
begin
 if op='calendar_links_get_v1' then return;end if;
 if op='calendar_link_create_v1' then org:=(r#>>'{organization_scope,org_id}')::uuid;
 else select * into link from private.personal_calendar_links where id=(r->>'link_id')::uuid and account_id=account;if not found then perform private.fail('NOT_FOUND');end if;org:=link.org_id;
  if op='calendar_link_rotate_v1' and org is distinct from (r#>>'{organization_scope,org_id}')::uuid then perform private.fail('NOT_FOUND');end if;end if;
 if op<>'calendar_link_revoke_v1' then
  perform private.personal_calendar_person(org,account);
  if aux->>'calendar_token_hash' is null or aux->>'calendar_token_hash'!~'^[a-f0-9]{64}$' then perform private.fail('SERVICE_UNAVAILABLE');end if;
  if op='calendar_link_rotate_v1' and link.state<>'active' then perform private.fail('NOT_FOUND');end if;
  -- Replaying an older credential command must not restore a replaced/revoked secret.
  select h.link_id into previous from core.operation_receipts o join private.personal_calendar_history h on h.operation_id=o.id
   where o.org_id is null and o.actor_account_id=account and o.operation=op and o.key_hash=encode(extensions.digest(r->>'operation_key','sha256'),'hex') and o.state='succeeded';
  if previous is not null and not exists(select 1 from private.personal_calendar_links where id=previous and account_id=account and state='active' and token_hash=aux->>'calendar_token_hash') then perform private.fail('NOT_FOUND');end if;
 else
  -- Revocation remains possible after org membership or subscription closes.
  perform 1 from core.organizations where id=org for update;
 end if;
end$$;
create function private.personal_calendar_execute(op text,r jsonb,account uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare link private.personal_calendar_links;items jsonb;org uuid;
begin
 if op='calendar_links_get_v1' then
  select coalesce(jsonb_agg(private.personal_calendar_view(l) order by l.created_at,l.id),'[]') into items from private.personal_calendar_links l where l.account_id=account;
  return private.p06_page(items,r->'page','personal-calendar:'||account,clock_timestamp());
 end if;
 if op='calendar_link_create_v1' then
  org:=(r#>>'{organization_scope,org_id}')::uuid;
  insert into private.personal_calendar_links(id,account_id,org_id,kinds,token_hash) values(private.new_id(ids,11),account,org,array(select jsonb_array_elements_text(r->'kinds')),aux->>'calendar_token_hash') returning * into link;
 else
  select * into link from private.personal_calendar_links where id=(r->>'link_id')::uuid and account_id=account for update;
  if link.id is null then perform private.fail('NOT_FOUND');end if;
  if link.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  if link.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  update private.personal_calendar_links set token_hash=case when op='calendar_link_rotate_v1' then aux->>'calendar_token_hash' else token_hash end,
   state=case when op='calendar_link_revoke_v1' then 'revoked' else state end,version=version+1 where id=link.id returning * into link;
 end if;
 insert into private.personal_calendar_history(operation_id,account_id,link_id,action,version) values(operation,account,link.id,op,link.version);
 return jsonb_build_object('operation_id',operation,'primary_id',account,'replayed',false,'related','[]'::jsonb,'link',private.personal_calendar_view(link));
end$$;
create function private.personal_calendar_feed(r jsonb,ids uuid[],aux jsonb) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare link private.personal_calendar_links;person uuid;items jsonb;trace uuid:=private.new_id(ids,1);stamp timestamptz:=clock_timestamp();
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 select * into link from private.personal_calendar_links where token_hash=aux->>'calendar_token_hash' and state='active';if not found then perform private.fail('NOT_FOUND');end if;
 perform 1 from core.accounts a join auth.users u on u.id=a.auth_user_id where a.id=link.account_id and a.state='active' and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<stamp) for share of a;
 if not found then perform private.fail('NOT_FOUND');end if;
 person:=private.personal_calendar_person(link.org_id,link.account_id,false);
 -- Recheck pointer after the org lock; rotate/revoke uses the same lock order.
 perform 1 from private.personal_calendar_links where id=link.id and token_hash=aux->>'calendar_token_hash' and state='active' for share;if not found then perform private.fail('NOT_FOUND');end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'org_id',s.org_id,'version',s.version,'title',coalesce(c.name,d.name),
  'location',z.name||coalesce((select ' / '||string_agg(room.name,' / ' order by room.id) from core.resource_bookings b join core.rooms room on room.org_id=b.org_id and room.id=b.resource_id where b.org_id=s.org_id and b.session_id=s.id and b.resource_kind='room' and b.state='active'),''),
  'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at,s.id),'[]') into items
 from core.sessions s join core.centers z on z.org_id=s.org_id and z.id=s.center_id join core.disciplines d on d.org_id=s.org_id and d.id=s.discipline_id left join core.classes c on c.org_id=s.org_id and c.id=s.class_id
 where s.org_id=link.org_id and not private.starter_scope_required(s.org_id) and private.starter_session_allowed(s.org_id,s.id,false) and s.state='planned' and s.ends_at>stamp and private.center_accessible(s.org_id,s.center_id) and private.schedule_scope(s.org_id,person,s.center_id)
 and (('lessons'=any(link.kinds) and exists(select 1 from core.reservations x where x.org_id=s.org_id and x.session_id=s.id and x.person_id=person and x.state='active'))
 or ('duties'=any(link.kinds) and exists(select 1 from core.session_assignments x where x.org_id=s.org_id and x.session_id=s.id and x.person_id=person and x.state='active' and x.duty in ('instructor','assistant') and private.has_role(s.org_id,person,x.duty,s.center_id))));
 return jsonb_build_object('ok',true,'data',jsonb_build_object('items',items,'as_of',stamp),'trace_id',trace);
exception when SQLSTATE 'P0001' then return jsonb_build_object('ok',false,'error',jsonb_build_object('code',SQLERRM,'retryable',false,'trace_id',trace));
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar live authorization anchor drift';end if;
 b:=replace(b,a,a||E'\n'||$a$ if perm_code='calendar.self' then perform private.personal_calendar_authorize(p_operation,r,actor.id,p_aux);end if;$a$);
 a:=' if perm_code=''templates.resolve'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar permission branch anchor drift';end if;
 b:=replace(b,a,' if perm_code=''calendar.self'' then null;elsif perm_code=''templates.resolve'' then');
 a:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar domain anchor drift';end if;
 execute replace(b,a,$a$ when 'calendar_links_get_v1','calendar_link_create_v1','calendar_link_rotate_v1','calendar_link_revoke_v1' then
  out:=private.personal_calendar_execute(p_operation,r,actor.id,operation_id,p_ids,p_aux);record_id:=actor.id;subject:='accounts';
$a$||a);
end$patch$;
revoke all on function private.personal_calendar_view(private.personal_calendar_links),private.personal_calendar_person(uuid,uuid,boolean),private.personal_calendar_authorize(text,jsonb,uuid,jsonb),private.personal_calendar_execute(text,jsonb,uuid,uuid,uuid[],jsonb),private.personal_calendar_feed(jsonb,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.personal_calendar_view(private.personal_calendar_links),private.personal_calendar_person(uuid,uuid,boolean),private.personal_calendar_authorize(text,jsonb,uuid,jsonb),private.personal_calendar_execute(text,jsonb,uuid,uuid,uuid[],jsonb),private.personal_calendar_feed(jsonb,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('calendar_links_get_v1','calendar.self','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.calendar_links_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('calendar_links_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.calendar_links_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.calendar_links_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('calendar_link_create_v1','calendar.self','config',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.calendar_link_create_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('calendar_link_create_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.calendar_link_create_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.calendar_link_create_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('calendar_link_rotate_v1','calendar.self','config',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.calendar_link_rotate_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('calendar_link_rotate_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.calendar_link_rotate_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.calendar_link_rotate_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('calendar_link_revoke_v1','calendar.self','config',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.calendar_link_revoke_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('calendar_link_revoke_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.calendar_link_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.calendar_link_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('calendar_feed_get_v1','calendar.feed','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.calendar_feed_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.personal_calendar_feed(p_request,p_ids,p_aux)$$;
revoke all on function api_v1.calendar_feed_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.calendar_feed_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
