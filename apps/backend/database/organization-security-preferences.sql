begin;
create function private.organization_security_schema() returns jsonb language sql immutable security invoker set search_path='' as $schema$select '{"type":"object","properties":{"mfa_roles":{"type":"array","maxItems":7,"uniqueItems":true,"items":{"type":"string","enum":["owner","org_manager","center_manager","staff","instructor","assistant","student"]}},"sensitive_reauth_max_age_seconds":{"anyOf":[{"type":"integer","minimum":1,"maximum":2147483647},{"type":"null"}]}},"required":["mfa_roles","sensitive_reauth_max_age_seconds"],"additionalProperties":false}'::jsonb$schema$;
create function private.organization_security_assert(op text,r jsonb,org uuid,person uuid,account uuid,session uuid,aux jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare policy jsonb;auth_id uuid;required boolean;editing boolean;age int;proof_session uuid;
begin
 if org is null or person is null then return;end if;
 select auth_user_id into auth_id from core.accounts where id=account and state='active';
 policy:=coalesce((select values->'security_policy' from private.frontend_settings where scope_key='organization:'||org),private.frontend_settings_defaults('organization')->'security_policy');
 editing:=op in ('settings_update_v1','settings_reset_apply_v1') and r->>'scope'='organization' and
  (coalesce(r->'patch'?'security_policy',false) or coalesce(r#>'{history_source,fields}'?'security_policy',false) or
   exists(select 1 from private.frontend_settings_previews p where p.id=(r#>>'{preview,id}')::uuid and p.actor_account_id=account and p.scope_key='organization:'||org and p.fields?'security_policy'));
 select exists(select 1 from jsonb_array_elements_text(policy->'mfa_roles') x where
  (x='owner' and exists(select 1 from core.organizations where id=org and owner_person_id=person)) or
  exists(select 1 from core.role_assignments a where a.org_id=org and a.person_id=person and a.role=x and a.state='active' and private.has_role(org,person,a.role,a.scope_center_id)) or
  exists(select 1 from core.center_relationships a where a.org_id=org and a.person_id=person and a.state='active' and a.kind=x and x in ('instructor','student'))) into required;
 if editing or required then
  if aux->>'verified_aal' is distinct from 'aal2' or not exists(select 1 from auth.mfa_factors f where f.user_id=auth_id and f.status::text='verified') or
   not exists(select 1 from auth.sessions s where s.id=session and s.user_id=auth_id and to_jsonb(s)->>'aal'='aal2') then perform private.fail('AUTH_REQUIRED');end if;
 end if;
 age:=(policy->>'sensitive_reauth_max_age_seconds')::int;
 if age is not null and (editing or op in ('role_assign_v1','role_revoke_v1','permission_set_v1','center_manager_assign_v1','center_manager_revoke_v1','org_manager_assign_v1','org_manager_revoke_v1','account_link_remove_v1','person_merge_apply_v1','organization_close_apply_v1','organization_delete_apply_v1')) then
  proof_session:=case when aux->>'reauth_verified'='true' and aux->>'reauth_auth_id'=auth_id::text then (aux->>'reauth_session_id')::uuid else session end;
  if not exists(select 1 from auth.sessions s where s.id=proof_session and s.user_id=auth_id and s.created_at>=clock_timestamp()-make_interval(secs=>age) and s.created_at<=clock_timestamp() and (s.not_after is null or s.not_after>clock_timestamp())) then perform private.fail('AUTH_REQUIRED');end if;
 end if;
end$$;
create function private.organization_security_patch(r jsonb,patch jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare age int;baseline int;
begin
 if not patch?'security_policy' then return;end if;
 if r->>'scope'<>'organization' or not private.frontend_setting_valid(patch->'security_policy',private.organization_security_schema()) then perform private.fail('VALIDATION_FAILED');end if;
 age:=(patch#>>'{security_policy,sensitive_reauth_max_age_seconds}')::int;
 if age is not null then
  select reauth_max_age_seconds into baseline from private.p07_lifecycle_config where singleton;
  if baseline is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if age>baseline then perform private.fail('VALIDATION_FAILED');end if;
 end if;
end$$;
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.frontend_setting_valid(jsonb,jsonb)'::regprocedure);anchor:=$a$ if s->>'$ref'='#/$defs/FtkUuid' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization security schema drift';end if;
 execute replace(body,anchor,$a$ if s->>'$ref'='#/$defs/OrganizationSecurityPolicy' then return private.frontend_setting_valid(v,private.organization_security_schema());end if;
$a$||anchor);
 body:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);anchor:=' perform private.domain_preparation_patch(r,patch);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization security patch drift';end if;
 execute replace(body,anchor,' perform private.organization_security_patch(r,patch);'||anchor);
 body:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor:='''catalog_version'',16';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization security catalogue drift';end if;
 execute replace(body,anchor,'''catalog_version'',17');
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor:='  person:=private.person_for(org,actor.id);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization security authorization drift';end if;
 execute replace(body,anchor,anchor||E'\n'||'  perform private.organization_security_assert(p_operation,r,org,person,actor.id,p_session_id,p_aux);');
 body:=pg_get_functiondef('private.p06_original_authorize(text,jsonb,uuid,uuid,uuid[])'::regprocedure);anchor:=$a$jsonb_build_object('phase','p06_authorize_original')$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Original authorization assurance drift';end if;
 execute replace(body,anchor,$a$jsonb_build_object('phase','p06_authorize_original','verified_aal',(select to_jsonb(s)->>'aal' from auth.sessions s where s.id=session_id and s.user_id=auth_id and (s.not_after is null or s.not_after>clock_timestamp())))$a$);
end$patch$;
revoke all on function private.organization_security_schema(),private.organization_security_assert(text,jsonb,uuid,uuid,uuid,uuid,jsonb),private.organization_security_patch(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.organization_security_schema(),private.organization_security_assert(text,jsonb,uuid,uuid,uuid,uuid,jsonb),private.organization_security_patch(jsonb,jsonb) to service_role;
commit;
