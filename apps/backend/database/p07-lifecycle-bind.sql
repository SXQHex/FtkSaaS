begin;
create function private.p07_account_delete_replay(r jsonb,account uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt core.operation_receipts;h text;
begin
 perform private.p07_lifecycle_reauth(account,aux);
 h:=encode(extensions.digest((r-'operation_key'-'request_id'-'reauth')::text,'sha256'),'hex');
 select * into receipt from core.operation_receipts where org_id is null and actor_fingerprint=account::text and operation='account_delete_apply_v1' and key_hash=encode(extensions.digest(r->>'operation_key','sha256'),'hex');
 if receipt.id is null or receipt.state<>'succeeded' then perform private.fail('SESSION_REVOKED');end if;
 if receipt.payload_hash<>h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if receipt.result_expires_at<=clock_timestamp() then perform private.fail('OPERATION_RESULT_EXPIRED');end if;
 return jsonb_set(receipt.result,'{trace_id}',to_jsonb(private.new_id(ids,1)));
end$$;
create function private.p07_organization_delete_replay(r jsonb,account uuid,org uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare receipt core.operation_receipts;h text;
begin
 perform private.p07_lifecycle_reauth(account,aux);
 if not exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null) then perform private.fail('FORBIDDEN');end if;
 h:=encode(extensions.digest((r-'operation_key'-'request_id'-'reauth')::text,'sha256'),'hex');
 select * into receipt from core.operation_receipts where org_id=org and actor_fingerprint=account::text and operation='organization_delete_apply_v1' and key_hash=encode(extensions.digest(r->>'operation_key','sha256'),'hex');
 if receipt.id is null or receipt.state<>'succeeded' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if receipt.payload_hash<>h then perform private.fail('IDEMPOTENCY_PAYLOAD_MISMATCH');end if;
 if receipt.result_expires_at<=clock_timestamp() then perform private.fail('OPERATION_RESULT_EXPIRED');end if;
 if not exists(select 1 from core.privacy_requests p where p.id=receipt.business_reference and p.org_id=org and p.kind='organization_delete' and p.requester_account_id=account) then perform private.fail('NOT_FOUND');end if;
 return jsonb_set(receipt.result,'{trace_id}',to_jsonb(private.new_id(ids,1)));
end$$;
create function private.p07_lifecycle_management(r jsonb,account uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare op text:=r->>'operation';org uuid:=(r->>'org_id')::uuid;entity jsonb;v bigint;st text;at timestamptz:=clock_timestamp();
begin
 if r#>>'{selector,operation}' is distinct from op or r->>'center_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if op='account_delete_preview_v1' then
  if org is not null then perform private.fail('VALIDATION_FAILED');end if;
  select version,state into v,st from core.accounts where id=account;
  entity:=jsonb_build_object('type','accounts','id',account);
 elsif op in ('organization_close_preview_v1','organization_reopen_v1','organization_delete_preview_v1') then
  select o.version,o.state into v,st from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null and o.state in ('active','closed');
  if v is null then perform private.fail('NOT_FOUND');end if;
  entity:=jsonb_build_object('type','organizations','id',org);
 else perform private.fail('FORBIDDEN');end if;
 if r?'entity' and r->'entity'<>'null'::jsonb and r->'entity' is distinct from entity then perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('items',jsonb_build_array(jsonb_build_object('operation',op,'entity',entity,'exists',true,'state',st,'versions',jsonb_build_array(jsonb_build_object('entity',entity,'version',v)),'as_of',at,'current',jsonb_build_object('operation',op,'values','{}'::jsonb))),'next_cursor',null,'as_of',at);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;
begin
 old:=$a$ if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 privacy worker entry anchor mismatch';end if;
 b:=replace(b,old,' if p_operation=''privacy_execute_v1'' then return private.p07_privacy_execute(r,p_ids);end if;'||E'\n'||old);
 old:=$a$ if p_operation='account_profile_update_v1' then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle account lock anchor mismatch';end if;
 b:=replace(b,old,$a$ if p_operation in ('account_profile_update_v1','account_delete_apply_v1') then$a$);
 old:=$a$ if actor.state<>'active' then perform private.fail('SESSION_REVOKED');end if;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle replay anchor mismatch';end if;
 b:=replace(b,old,$a$ if p_operation='job_status_get_v1' then out:=private.p07_privacy_status(r,actor.id,p_aux);if out is not null then return jsonb_build_object('ok',true,'data',out,'trace_id',trace);end if;if org is null then perform private.fail('NOT_FOUND');end if;end if;
 if actor.state='deletion_pending' and p_operation='account_delete_apply_v1' then return private.p07_account_delete_replay(r,actor.id,p_ids,p_aux);end if;
 if actor.state<>'active' then perform private.fail('SESSION_REVOKED');end if;
 -- Reauth is trusted server context only; never retain the bearer proof in audit/receipt context.
 if p_operation in ('account_delete_apply_v1','organization_delete_apply_v1') then r:=r-'reauth';end if;
 if p_operation='organization_delete_apply_v1' and exists(select 1 from core.organizations where id=org and state in ('deletion_pending','deleted')) then return private.p07_organization_delete_replay(r,actor.id,org,p_ids,p_aux);end if;
 if p_operation='management_state_get_v1' and r->>'operation' in ('account_delete_preview_v1','organization_close_preview_v1','organization_reopen_v1','organization_delete_preview_v1') then out:=private.p07_lifecycle_management(r,actor.id);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);end if;$a$);
 old:=$a$ if org is not null then
  -- Shared access gate.$a$;
 if strpos(b,old)=0 then raise exception 'P07 lifecycle tenant gate anchor mismatch';end if;
 -- Account lifecycle is global, regardless of caller-supplied transport context.
 b:=replace(b,old,$a$ if p_operation in ('account_delete_preview_v1','account_delete_apply_v1') and (org is not null or center is not null) then perform private.fail('VALIDATION_FAILED');end if;
 if org is not null then
  -- Shared access gate.$a$);
 old:=$a$'manager_self_assign_center_v1') then perform private.fail('SUBSCRIPTION_NOT_STARTED');$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle bootstrap owner anchor mismatch';end if;
 b:=replace(b,old,$a$'manager_self_assign_center_v1','organization_close_preview_v1','organization_close_apply_v1','organization_delete_preview_v1','organization_delete_apply_v1') then perform private.fail('SUBSCRIPTION_NOT_STARTED');$a$);
 old:=$a$  mode:=private.access_mode(org);$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle closed tenant anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||$a$  if exists(select 1 from core.organizations where id=org and state in ('deletion_pending','deleted')) then perform private.fail('SERVICE_UNAVAILABLE');end if;$a$);
 old:=$a$p_operation not in ('subscription_get_v1','subscription_change_cancel_v1','saas_grace_extend_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P07 lifecycle due boundary anchor mismatch';end if;
 b:=replace(b,old,$a$p_operation not in ('subscription_get_v1','subscription_change_cancel_v1','saas_grace_extend_v1','organization_close_preview_v1','organization_close_apply_v1','organization_reopen_v1','organization_delete_preview_v1','organization_delete_apply_v1')$a$);
 -- Owner lifecycle metadata must remain available after service closure/expiration.
 old:=$a$p_operation in ('subscription_get_v1','saas_payment_submit_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1')$a$;
 if strpos(b,old)=0 then raise exception 'P07 lifecycle closed owner anchor mismatch';end if;
 b:=replace(b,old,$a$p_operation in ('subscription_get_v1','saas_payment_submit_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1','organization_close_preview_v1','organization_close_apply_v1','organization_reopen_v1','organization_delete_preview_v1','organization_delete_apply_v1')$a$);
 old:=$a$ elsif p_operation='account_profile_update_v1' then null;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle self permission anchor mismatch';end if;
 b:=replace(b,old,$a$ elsif p_operation in ('account_profile_update_v1','account_delete_preview_v1','account_delete_apply_v1') then null;$a$);
 old:=' -- DOMAIN_CASES';if array_length(string_to_array(b,old),1)<>2 then raise exception 'P07 lifecycle dispatch anchor mismatch';end if;
 new:=$a$
 when 'account_delete_preview_v1','organization_close_preview_v1','organization_delete_preview_v1' then
  out:=private.p07_lifecycle_preview(p_operation,r,org,actor.id,p_ids,p_aux);
 when 'account_delete_apply_v1','organization_close_apply_v1','organization_reopen_v1','organization_delete_apply_v1' then
  terms:=private.p07_lifecycle_command(p_operation,r,org,actor.id,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;version_n:=(terms->>'version')::bigint;subject:=terms->>'subject';
  audit_delta:=jsonb_build_object('after',out,'physical_erasure_complete',false);
  if terms->>'reason' is not null then r:=r||jsonb_build_object('reason',terms->>'reason');end if;
 -- DOMAIN_CASES$a$;
 b:=replace(b,old,new);execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
-- Worker-only functions do not become an HTTP service-role bypass.
revoke all on function private.p07_worker_scope(uuid),private.p07_jobs_claim(uuid,uuid[],int),private.p07_worker_execute(text,jsonb,uuid[]),private.p07_privacy_scope(uuid),private.p07_privacy_claim(uuid,uuid[],int),private.p07_privacy_execute(jsonb,uuid[]) from service_role;
commit;
