begin;
-- An account link spans the organization. The selected center cannot hide other
-- affected centers or organization-wide grants. Check live authority on replay.
create function private.p07_revoke_access(op text,r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare inv core.invitations;lnk core.account_links;c uuid;mode text;scopes uuid[];global_grant boolean;
begin
 if org is null or actor is null then perform private.fail('NOT_FOUND');end if;
 mode:=private.access_mode(org);
 if mode='bootstrap' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 if mode='closed' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if op='account_access_revoke_v1' then
  select * into inv from core.invitations x where x.org_id=org and x.id=(r->>'invitation_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  if center is not null and center<>inv.center_id then perform private.fail('NOT_FOUND');end if;
  if not private.can_invite(org,actor,inv.center_id,inv.person_id) then perform private.fail('FORBIDDEN');end if;
  return jsonb_build_object('id',inv.id,'version',inv.version,'state',inv.state,'type','invitations');
 elsif op='account_link_remove_v1' then
  if mode='grace' then perform private.fail('BILLING_OPERATION_RESTRICTED');end if;
  select * into lnk from core.account_links x where x.org_id=org and x.id=(r->>'link_id')::uuid;
  if not found then perform private.fail('NOT_FOUND');end if;
  if center is not null and not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
  global_grant:=exists(select 1 from core.role_assignments x where x.org_id=org and x.person_id=lnk.person_id and x.scope_center_id is null)
   or exists(select 1 from private.settlement_grants x where x.org_id=org and x.person_id=lnk.person_id and x.center_id is null);
  select array_agg(distinct s.center_id) into scopes from (
   select x.center_id from core.center_relationships x where x.org_id=org and x.person_id=lnk.person_id
   union select x.scope_center_id from core.role_assignments x where x.org_id=org and x.person_id=lnk.person_id and x.scope_center_id is not null
   union select x.center_id from core.permission_overrides x where x.org_id=org and x.person_id=lnk.person_id
   union select x.center_id from private.settlement_grants x where x.org_id=org and x.person_id=lnk.person_id and x.center_id is not null
   union select x.id from core.centers x where x.org_id=org and global_grant
  ) s;
  foreach c in array coalesce(scopes,'{}'::uuid[]) loop
   if not private.is_manager(org,actor,c) then perform private.fail('FORBIDDEN');end if;
  end loop;
  if coalesce(cardinality(scopes),0)=0 and center is null and not exists(select 1 from core.centers x where x.org_id=org and private.is_manager(org,actor,x.id)) then perform private.fail('FORBIDDEN');end if;
  return jsonb_build_object('id',lnk.id,'version',lnk.version,'state',lnk.state,'type','account_links');
 end if;
 perform private.fail('FORBIDDEN');
end$$;
create function private.p07_revoke(op text,r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare target jsonb;target_id uuid;ver bigint;pid uuid;
begin
 target:=private.p07_revoke_access(op,r,org,center,actor);target_id:=(target->>'id')::uuid;
 if (target->>'version')::bigint is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if op='account_access_revoke_v1' then
  if target->>'state'<>'pending' or exists(select 1 from core.invitations x where x.org_id=org and x.id=target_id and x.expires_at<=clock_timestamp()) then perform private.fail('INVITATION_UNAVAILABLE');end if;
  update core.invitations x set state='revoked',version=x.version+1 where x.org_id=org and x.id=target_id returning x.version into ver;
 else
  if target->>'state'<>'active' then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  select x.person_id into pid from core.account_links x where x.org_id=org and x.id=target_id;
  if exists(select 1 from core.organizations x where x.id=org and x.owner_person_id=pid) then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
  update core.account_links x set state='revoked',version=x.version+1 where x.org_id=org and x.id=target_id returning x.version into ver;
  update core.role_assignments x set state='inactive',version=x.version+1 where x.org_id=org and x.account_link_id=target_id and x.state='active';
  -- Person-based grants must never revive when a new account link is accepted.
  update core.permission_overrides x set enabled=false,version=x.version+1 where x.org_id=org and x.person_id=pid and x.enabled;
  update private.settlement_grants x set granted=false,version=x.version+1 where x.org_id=org and x.person_id=pid and x.granted;
 end if;
 return jsonb_build_object('primary_id',target_id,'version',ver,'subject',target->'type');
end$$;
create function private.p07_revoke_management(r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare op text:=r->>'operation';target jsonb;data jsonb;at timestamptz:=clock_timestamp();
begin
 if r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 target:=private.p07_revoke_access(op,r#>'{selector,key}',org,center,actor);
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity' is distinct from jsonb_build_object('type',target->'type','id',target->'id') then perform private.fail('VALIDATION_FAILED');end if;
 data:=jsonb_build_object('operation',op,'entity',jsonb_build_object('type',target->'type','id',target->'id'),'exists',true,'state',target->'state',
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',target->'type','id',target->'id'),'version',target->'version')),'as_of',at,'current',jsonb_build_object('operation',op,'values','{}'::jsonb));
 return jsonb_build_object('data',jsonb_build_object('items',jsonb_build_array(data),'next_cursor',null,'as_of',at),'primary_id',target->'id','subject',target->'type');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;ops text:=$o$'account_access_revoke_v1','account_link_remove_v1'$o$;
begin
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 access anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||' if p_operation in ('||ops||') then perform private.p07_revoke_access(p_operation,r,org,center,person);end if;');
 old:=$a$ elsif perm_code='invite.student' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 permission anchor mismatch';end if;
 b:=replace(b,old,' elsif p_operation in ('||ops||') then null;'||old);
 -- center.manage is evaluated earlier than invite.student in the common chain.
 old:=$a$ elsif perm_code in ('center.manage','schedule.manage'$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 center permission anchor mismatch';end if;
 b:=replace(b,old,' elsif p_operation=''account_link_remove_v1'' then null;'||old);
 old:=$a$elsif perm_code='management.inspect' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 management access anchor mismatch';end if;
 b:=replace(b,old,'elsif perm_code=''management.inspect'' and r->>''operation'' in ('||ops||') then perform private.p07_revoke_management(r,org,center,person);'||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 management domain anchor mismatch';end if;
 b:=replace(b,old,'if p_operation=''management_state_get_v1'' and r->>''operation'' in ('||ops||') then terms:=private.p07_revoke_management(r,org,center,person);else '||old||'end if;');
 old:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 domain anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'account_access_revoke_v1','account_link_remove_v1' then
  terms:=private.p07_revoke(p_operation,r,org,center,person);record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';
 -- DOMAIN_CASES$a$);
 execute b;
end$patch$;
revoke all on function private.p07_revoke_access(text,jsonb,uuid,uuid,uuid),private.p07_revoke(text,jsonb,uuid,uuid,uuid),private.p07_revoke_management(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.p07_revoke_access(text,jsonb,uuid,uuid,uuid),private.p07_revoke(text,jsonb,uuid,uuid,uuid),private.p07_revoke_management(jsonb,uuid,uuid,uuid) to service_role;
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_access_revoke_v1','invite.student','invite',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_access_revoke_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_access_revoke_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_access_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_access_revoke_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('account_link_remove_v1','center.manage','config',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.account_link_remove_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('account_link_remove_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.account_link_remove_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.account_link_remove_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
