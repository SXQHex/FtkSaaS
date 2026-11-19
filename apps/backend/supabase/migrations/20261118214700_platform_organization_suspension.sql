begin;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.access_mode(uuid)'::regprocedure);
 anchor:=$a$if not found or o.state<>'active' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform suspension access-mode drift';end if;
 execute replace(body,anchor,$a$if not found or o.state<>'active' or o.platform_suspended then$a$);

 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:='  person:=private.person_for(org,actor.id);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform invitation suspension drift';end if;
 body:=replace(body,anchor,$a$  if p_operation='account_access_accept_v1' and exists(select 1 from core.organizations where id=org and platform_suspended)
  then perform private.fail('INVITATION_UNAVAILABLE');end if;
$a$||anchor);
 anchor:='  mode:=private.access_mode(org);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform suspension gate drift';end if;
 body:=replace(body,anchor,anchor||E'\n'||$a$  if mode='closed' and perm_code not in ('platform.owner','saas.operator')
   and p_operation not in ('subscription_get_v1','saas_payment_submit_v1','subscription_upgrade_quote_v1',
    'subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1',
    'organization_close_preview_v1','organization_close_apply_v1','organization_reopen_v1',
    'organization_delete_preview_v1','organization_delete_apply_v1')
   and not (p_operation in ('settings_catalog_get_v1','settings_get_v1','settings_update_v1',
    'settings_reset_preview_v1','settings_reset_apply_v1','settings_history_get_v1')
    and r->>'scope' in ('user','member'))
   and exists(select 1 from core.organizations where id=org and platform_suspended)
  then perform private.fail('SERVICE_UNAVAILABLE');end if;
$a$);
 anchor:=' -- DOMAIN_CASES';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform suspension command drift';end if;
 execute replace(body,anchor,$a$
 when 'platform_organization_suspension_set_v1' then
  if length(btrim(r->>'reason')) not between 1 and 1000 then perform private.fail('VALIDATION_FAILED');end if;
  update core.organizations set platform_suspended=(r->>'suspended')::boolean,version=version+1
   where id=org and version=(r->>'expected_version')::bigint and platform_suspended is distinct from (r->>'suspended')::boolean
   returning version into version_n;
  if not found then
   if exists(select 1 from core.organizations where id=org and version=(r->>'expected_version')::bigint)
   then perform private.fail('INVALID_STATE_TRANSITION');end if;
   perform private.fail('VERSION_CONFLICT');
  end if;
  record_id:=org;subject:='organizations';
  audit_delta:=jsonb_build_object('platform_suspended',(r->>'suspended')::boolean);
$a$||anchor);
end$patch$;

insert into private.runtime_operations(name,permission,billing_class,features) values('platform_organization_suspension_set_v1','platform.owner','exempt',array[]::text[]);
create function api_v1.platform_organization_suspension_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('platform_organization_suspension_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.platform_organization_suspension_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.platform_organization_suspension_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

do $patch$
declare body text:=pg_get_functiondef('private.tracking_operation_module(text)'::regprocedure);anchor text:='"platform_owner_set_v1":"M02"';
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Platform suspension audit module drift';end if;
 execute replace(body,anchor,anchor||',"platform_organization_suspension_set_v1":"M01"');
end$patch$;
commit;
