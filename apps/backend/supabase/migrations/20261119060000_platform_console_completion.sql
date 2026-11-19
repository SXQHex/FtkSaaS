begin;

create function private.platform_identity_eligible(u auth.users,account_state text) returns boolean
language sql stable security invoker set search_path='' as $$
 select u.id is not null and u.email_confirmed_at is not null and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<statement_timestamp())
  and coalesce(account_state,'active')='active'
$$;

create function private.p07_grace_extension_floor(s core.saas_subscriptions,at timestamptz) returns timestamptz
language sql stable security invoker set search_path='' as $$
 select case when s.period_end<=at and not s.cancel_at_period_end and s.state not in ('pending_payment','ended')
  then greatest(at,coalesce(s.grace_until,s.period_end+interval '7 days')) end
$$;

create function private.platform_operator_change(r jsonb,actor_id uuid,operation_id uuid,ids uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_auth uuid;target_id uuid:=(r->>'verified_account_id')::uuid;
 enabled boolean:=(r->>'enabled')::boolean;reason text:=btrim(r->>'reason');eligible boolean;
begin
 if reason is null or length(reason) not between 1 and 1000 or enabled is null then perform private.fail('VALIDATION_FAILED');end if;
 select a.auth_user_id,private.platform_identity_eligible(u,a.state) into target_auth,eligible
 from core.accounts a join auth.users u on u.id=a.auth_user_id where a.id=target_id;
 if target_auth is null then perform private.fail('NOT_FOUND');end if;
 if enabled then
  if not eligible then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  insert into private.platform_operators(auth_user_id) values(target_auth) on conflict do nothing;
  if not found then perform private.fail('INVALID_STATE_TRANSITION');end if;
 else
  if not exists(select 1 from private.platform_operators where auth_user_id=target_auth) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if not exists(select 1 from private.platform_operators m join auth.users u on u.id=m.auth_user_id
   left join core.accounts a on a.auth_user_id=u.id
   where m.auth_user_id<>target_auth and private.platform_identity_eligible(u,a.state))
  then perform private.fail('INVALID_STATE_TRANSITION');end if;
  delete from private.platform_operators where auth_user_id=target_auth;
 end if;
 insert into private.p07_lifecycle_events(id,account_id,operation_id,action,detail)
 values(private.new_id(ids,11),actor_id,operation_id,'platform_operator_access_set_v1',
  jsonb_build_object('target_account_id',target_id,'enabled',enabled,'reason',reason));
 return jsonb_build_object('operation_id',operation_id,'account_id',target_id,'enabled',enabled);
end$$;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.platform_directory(jsonb,uuid)'::regprocedure);
 anchor:=$a$'organizations','owners','payments','verified_accounts'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform console views drift';end if;
 body:=replace(body,anchor,anchor||$a$,'initial_plans','operators'$a$);
 anchor:=$a$  or (view_name<>'verified_accounts' and r?'account_email')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Global platform directory filter drift';end if;
 body:=replace(body,anchor,anchor||E'\n'||$a$  or (view_name in ('initial_plans','operators') and r?'scope')$a$);
 anchor:=$a$'verified_at',p.verified_at)
   from core.saas_payment_verifications p$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform payment period drift';end if;
 body:=replace(body,anchor,$a$'verified_at',p.verified_at,'org_name',o.name,
    'quote_period',case when qc.quote_id is not null then jsonb_build_object('starts_at',qc.period_start,'ends_at',qc.period_end) end)
   from core.saas_payment_verifications p join core.organizations o on o.id=p.org_id
   left join private.p07_payment_quotes pq on pq.payment_id=p.id
   left join private.p07_quote_context qc on qc.quote_id=pq.quote_id$a$);
 anchor:=$a$   union all
   select a.created_at,a.id,jsonb_build_object('kind','verified_account'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform native roster drift';end if;
 execute replace(body,anchor,$a$   union all
   select p.created_at,p.id,jsonb_build_object('kind','initial_plan','id',p.id,'name',p.name,'period',p.period,'currency',p.currency)
   from (
    select distinct on (name,period,currency) id,created_at,name,period,currency
    from core.saas_plan_versions
    where view_name='initial_plans' and effective_at<=as_of and created_at<=as_of
    order by name,period,currency,effective_at desc,created_at desc,id desc
   ) p
   union all
   select m.created_at,substr(encode(extensions.digest('platform-operator:'||m.auth_user_id::text,'sha256'),'hex'),1,32)::uuid,
    jsonb_build_object('kind','operator','account_id',a.id,
    'display_name',nullif(btrim(u.raw_user_meta_data->>'display_name'),''),'granted_at',m.created_at,
    'eligible',private.platform_identity_eligible(u,a.state))
   from private.platform_operators m join auth.users u on u.id=m.auth_user_id
   left join core.accounts a on a.auth_user_id=m.auth_user_id where view_name='operators'
$a$||anchor);

 body:=pg_get_functiondef('private.p07_subscription_command(text,jsonb,uuid,uuid,uuid,uuid[])'::regprocedure);
 anchor:=$a$  if s.period_end is null or s.period_end>at or s.cancel_at_period_end or s.state in ('pending_payment','ended') or (r->>'until')::timestamptz<=greatest(at,coalesce(s.grace_until,s.period_end+interval '7 days')) or btrim(coalesce(r->>'reason',''))='' then perform private.fail('VALIDATION_FAILED');end if;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform grace writer drift';end if;
 execute replace(body,anchor,$a$  if not coalesce((r->>'until')::timestamptz>private.p07_grace_extension_floor(s,at),false) or btrim(coalesce(r->>'reason',''))='' then perform private.fail('VALIDATION_FAILED');end if;$a$);
 body:=pg_get_functiondef('private.p07_subscription_management(jsonb,uuid,uuid,boolean)'::regprocedure);
 anchor:=$a$elsif op='saas_grace_extend_v1' then vals:=jsonb_build_object('until',s.grace_until);$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform grace reader drift';end if;
 execute replace(body,anchor,$a$elsif op='saas_grace_extend_v1' then
  select jsonb_strip_nulls(jsonb_build_object('until',s.grace_until))
   ||jsonb_build_object('eligible',f.floor is not null,'until_after',f.floor) into vals
   from (select private.p07_grace_extension_floor(s,clock_timestamp()) as floor) f;$a$);

 body:=pg_get_functiondef('private.p07_lifecycle_owner_blocked(uuid)'::regprocedure);
 anchor:=$a$ select exists(select 1 from core.organizations$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform operator deletion blocker drift';end if;
 execute replace(body,anchor,$a$ select exists(select 1 from core.accounts a join private.platform_operators m on m.auth_user_id=a.auth_user_id where a.id=$1)
  or exists(select 1 from core.organizations$a$);

 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 -- Serialize role changes and account deletion before locking the actor account.
 anchor:=$a$ insert into core.accounts(id,auth_user_id,state) values(private.new_id(p_ids,10),usr.id,'active')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform operator lock anchor drift';end if;
 body:=replace(body,anchor,$a$ if p_operation in ('platform_operator_access_set_v1','account_delete_apply_v1') then
  lock table private.platform_operators in share row exclusive mode;
 end if;
$a$||anchor);
 anchor:=$a$'payment_verify',platform,'grace_extend',platform$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform operator capabilities drift';end if;
 body:=replace(body,anchor,anchor||$a$,'operator_manage',platform$a$);
 anchor:=' -- DOMAIN_CASES';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform operator dispatch drift';end if;
 execute replace(body,anchor,$a$
 when 'platform_operator_access_set_v1' then out:=private.platform_operator_change(r,actor.id,operation_id,p_ids);
$a$||anchor);
end$patch$;

do $patch$
declare body text:=pg_get_functiondef('private.tracking_operation_module(text)'::regprocedure);
 anchor text:='"platform_invoice_publish_v1":"M12"';
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform operator audit module drift';end if;
 execute replace(body,anchor,anchor||',"platform_operator_access_set_v1":"M02"');
end$patch$;

insert into private.runtime_operations(name,permission,billing_class,features) values('platform_operator_access_set_v1','platform.owner','exempt',array[]::text[]);
create function api_v1.platform_operator_access_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.execute_operation('platform_operator_access_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)
$$;
revoke all on function private.platform_identity_eligible(auth.users,text),private.p07_grace_extension_floor(core.saas_subscriptions,timestamptz),
 private.platform_operator_change(jsonb,uuid,uuid,uuid[]),api_v1.platform_operator_access_set_v1(jsonb,uuid,uuid,uuid[],jsonb)
 from public,anon,authenticated;
grant execute on function private.platform_identity_eligible(auth.users,text),private.p07_grace_extension_floor(core.saas_subscriptions,timestamptz),
 private.platform_operator_change(jsonb,uuid,uuid,uuid[]),api_v1.platform_operator_access_set_v1(jsonb,uuid,uuid,uuid[],jsonb)
 to service_role;

commit;
