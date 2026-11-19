-- Reuse the locked management scope without dispatching the original command again.
begin;

do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 auth_code text:=$old$ select * into usr from auth.users where id=p_actor_auth_id and deleted_at is null and (banned_until is null or banned_until<now());
 if not found or usr.email_confirmed_at is null then perform private.fail('AUTH_REQUIRED');end if;
 perform 1 from auth.sessions where id=p_session_id and user_id=p_actor_auth_id and (not_after is null or not_after>now());
 if not found then perform private.fail('SESSION_REVOKED');end if;$old$;
 first_gate text:='  if exists(select 1 from core.saas_change_requests where org_id=org and source_plan_id is null';
 after_gate text:=$old$
 end if;
 if p_operation='management_state_get_v1' and r->>'operation' in ('center_discipline_set_v1','availability_exception_save_v1') then$old$;
 gate_start integer;
 gate_length integer;
 gates text;
 changes text[][];
 change text[];
begin
 if cardinality(string_to_array(body,auth_code))<>2
  or cardinality(string_to_array(body,first_gate))<>2 or cardinality(string_to_array(body,after_gate))<>2
 then raise exception 'Shared operation authorization anchors changed';end if;
 gate_start:=strpos(body,first_gate);
 gate_length:=strpos(body,after_gate)-gate_start;
 gates:=substring(body from gate_start for gate_length);

 execute $sql$create function private.operation_auth_user(p_actor_auth_id uuid,p_session_id uuid) returns auth.users
 language plpgsql security invoker set search_path='' as $function$
 declare usr auth.users;
 begin
 $sql$||auth_code||$sql$
 return usr;
 end$function$$sql$;
 execute $sql$create function private.organization_operation_mode(
  p_operation text,r jsonb,org uuid,person uuid,owner uuid,platform boolean,perm_code text,billing text
 ) returns text language plpgsql security invoker set search_path='' as $function$
 #variable_conflict use_column
 declare mode text;feature text;
 begin
 $sql$||gates||$sql$
 return mode;
 end$function$$sql$;

 body:=overlay(body placing
  '  mode:=private.organization_operation_mode(p_operation,r,org,person,owner,platform,perm_code,billing);'
  from gate_start for gate_length);
 body:=replace(body,auth_code,' usr:=private.operation_auth_user(p_actor_auth_id,p_session_id);');
 changes:=array[
  array[$old$perm_code text;billing text;feature text;mode text;$old$,$new$perm_code text;billing text;mode text;$new$],
  array[$old$ insert into core.accounts(id,auth_user_id,state) values(private.new_id(p_ids,10),usr.id,'active') on conflict(auth_user_id) do nothing;
 if p_operation in ('account_profile_update_v1','account_delete_apply_v1') then select * into actor from core.accounts where auth_user_id=usr.id for update;else  select * into actor from core.accounts where auth_user_id=usr.id for share;end if;$old$,
        $new$ if p_operation in ('account_profile_update_v1','account_delete_apply_v1') then
  select * into actor from core.accounts where auth_user_id=usr.id for update;
 else
  select * into actor from core.accounts where auth_user_id=usr.id for share;
 end if;
 if not found then
  insert into core.accounts(id,auth_user_id,state) values(private.new_id(p_ids,10),usr.id,'active') on conflict(auth_user_id) do nothing;
  if p_operation in ('account_profile_update_v1','account_delete_apply_v1') then
   select * into actor from core.accounts where auth_user_id=usr.id for update;
  else
   select * into actor from core.accounts where auth_user_id=usr.id for share;
  end if;
 end if;$new$],
  array[$old$elsif perm_code in ('center.manage','schedule.manage','product.manage','entitlement.correct','finance.refund','event.manage','event.close','attendance.correct','attendance.block') then if not cm then perform private.fail('FORBIDDEN');end if;$old$,
        $new$elsif perm_code in ('center.manage','schedule.manage','product.manage','entitlement.correct','finance.refund','event.manage','event.close','attendance.correct','attendance.block') then perform private.assert_operation_center_manager(cm);$new$],
  array[$old$private.permission_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,p_ids)$old$,
        $new$private.permission_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,person,owner,cm)$new$],
  array[$old$private.session_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,p_ids)$old$,
        $new$private.session_management_page(r,org,center,actor.id,p_actor_auth_id,p_session_id,person,owner,cm)$new$]
 ];
 foreach change slice 1 in array changes loop
  if cardinality(string_to_array(body,change[1]))<>2 then raise exception 'Shared operation dispatch anchor changed: %',left(change[1],64);end if;
  body:=replace(body,change[1],change[2]);
 end loop;
 execute body;
end$patch$;

create function private.assert_operation_center_manager(cm boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not cm then perform private.fail('FORBIDDEN');end if;
end$$;

create function private.management_center_command_authorize(
 op text,request jsonb,org uuid,center uuid,account uuid,auth_id uuid,session_id uuid,
 person uuid,owner uuid,cm boolean
) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare r jsonb;aux jsonb;platform boolean;permission text;billing text;
begin
 if op not in ('permission_set_v1','session_change_preview_v1','replacement_session_create_v1')
  or not private.p06_trackable(op) then perform private.fail('NOT_FOUND');end if;
 r:=private.capacity_request(op,private.capacity_recovery_request(op,request));
 if (r->>'org_id')::uuid is distinct from org or (r->>'center_id')::uuid is distinct from center then
  perform private.fail('FORBIDDEN');
 end if;
 -- Auth can change independently of the outer account and organization locks.
 aux:=jsonb_build_object('verified_aal',(
  select to_jsonb(s)->>'aal' from auth.sessions s
  where s.id=session_id and s.user_id=auth_id and (s.not_after is null or s.not_after>clock_timestamp())
 ));
 perform private.operation_auth_user(auth_id,session_id);
 perform private.account_mfa_assert(auth_id,session_id,aux);
 -- Platform operator changes do not use the organization lock.
 select exists(select 1 from private.platform_operators where auth_user_id=auth_id) into platform;
 select o.permission,o.billing_class into permission,billing from private.runtime_operations o where o.name=op;
 if not found then perform private.fail('NOT_FOUND');end if;
 perform private.organization_security_assert(op,r,org,person,account,session_id,aux);
 if person is null and not platform then perform private.fail('NOT_FOUND');end if;
 perform private.assert_center(org,center);
 perform private.organization_operation_mode(op,r,org,person,owner,platform,permission,billing);
 if permission not in ('center.manage','schedule.manage') then perform private.fail('FORBIDDEN');end if;
 perform private.assert_operation_center_manager(cm);
exception when raise_exception then
 if SQLERRM in ('FORBIDDEN','NOT_FOUND','SESSION_REVOKED','SERVICE_UNAVAILABLE','PLAN_FEATURE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','BILLING_OPERATION_RESTRICTED') then raise;end if;
 perform private.fail('FORBIDDEN');
when others then perform private.fail('FORBIDDEN');
end$$;

do $patch$
declare
 signatures regprocedure[]:=array[
  'private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure,
  'private.session_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure
 ];
 old_calls text[]:=array[
  $old$private.p06_original_authorize(op,jsonb_build_object('org_id',org,'center_id',center)||k,auth_id,session_id,ids)$old$,
  $old$private.p06_original_authorize(op,probe,auth_id,session_id,ids)$old$
 ];
 new_calls text[]:=array[
  $new$private.management_center_command_authorize(op,jsonb_build_object('org_id',org,'center_id',center)||k,org,center,account,auth_id,session_id,person,owner,cm)$new$,
  $new$private.management_center_command_authorize(op,probe,org,center,account,auth_id,session_id,person,owner,cm)$new$
 ];
 body text;
begin
 for i in 1..cardinality(signatures) loop
  body:=pg_get_functiondef(signatures[i]);
  if cardinality(string_to_array(body,'session_id uuid, ids uuid[])'))<>2
   or cardinality(string_to_array(body,old_calls[i]))<>2
  then raise exception 'Center management projection anchor changed: %',signatures[i];end if;
  body:=replace(body,'session_id uuid, ids uuid[])','session_id uuid, person uuid, owner uuid, cm boolean)');
  execute replace(body,old_calls[i],new_calls[i]);
  execute 'drop function '||signatures[i];
 end loop;
end$patch$;

revoke all on function
 private.operation_auth_user(uuid,uuid),
 private.organization_operation_mode(text,jsonb,uuid,uuid,uuid,boolean,text,text),
 private.assert_operation_center_manager(boolean),
 private.management_center_command_authorize(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean),
 private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean),
 private.session_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean)
 from public,anon,authenticated;
grant execute on function
 private.operation_auth_user(uuid,uuid),
 private.organization_operation_mode(text,jsonb,uuid,uuid,uuid,boolean,text,text),
 private.assert_operation_center_manager(boolean),
 private.management_center_command_authorize(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean),
 private.permission_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean),
 private.session_management_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean)
 to service_role;

commit;
