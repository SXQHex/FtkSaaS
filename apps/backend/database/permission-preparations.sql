begin;
create function private.permission_preparation_schema() returns jsonb language sql immutable security invoker set search_path='' as $schema$select '{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"grants":{"type":"array","minItems":1,"maxItems":7,"uniqueItems":true,"items":{"type":"object","properties":{"permission":{"type":"string","enum":["person.manage","person.activate","invite.student","reservation.write","attendance.draft","sale.write","finance.collect"]},"enabled":{"type":"boolean"}},"required":["permission","enabled"],"additionalProperties":false}}},"required":["key","name","grants"],"additionalProperties":false}'::jsonb$schema$;
-- Templates describe seven supported permission_set_v1 permissions. They never
-- create roles, select a target, or apply grants on save/resolve/reset.
create function private.permission_preparation_licensed(org uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(private.current_plan_name(org),'') not in ('pro','business') then return false;end if;
 perform private.require_feature(org,'F05');return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','POLICY_NOT_CONFIGURED') then return false;end if;raise;
end$$;
create function private.permission_preparation_validate(value jsonb,org uuid) returns void language plpgsql stable security invoker set search_path='' as $$
declare schema jsonb;
begin
 perform private.require_feature(org,'F05');
 select f#>'{schema,items}' into schema from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'='organization' and f->>'key'='permission_templates';
 if schema is null or not private.frontend_setting_valid(value,schema) or btrim(value->>'name')='' then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_array_elements(value->'grants') x group by x->>'permission' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.permission_preparation_patch(r jsonb,patch jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare value jsonb;
begin
 if not patch?'permission_templates' then return;end if;
 if exists(select 1 from jsonb_array_elements(patch->'permission_templates') x group by x->>'key' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
 for value in select * from jsonb_array_elements(patch->'permission_templates') loop perform private.permission_preparation_validate(value,(r->>'org_id')::uuid);end loop;
end$$;
create function private.permission_preparation_resolve(r jsonb,org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare doc private.frontend_settings;value jsonb;
begin
 perform private.domain_preparation_access(r,org,center,person);
 perform private.require_feature(org,'F05');
 select * into doc from private.frontend_settings where scope_key=case r#>>'{source,scope}' when 'organization' then 'organization:'||org when 'center' then 'center:'||org||':'||center end;
 if coalesce(doc.version,0) is distinct from (r#>>'{source,version}')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 select x into value from jsonb_array_elements(coalesce(doc.values->'permission_templates','[]')) x where x->>'key'=r#>>'{source,key}';
 if value is null then perform private.fail('NOT_FOUND');end if;
 perform private.permission_preparation_validate(value,org);
 return jsonb_build_object('kind','permission','source',r->'source','permission_requests',value->'grants');
end$$;
create function private.permission_preparations_available(org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare doc private.frontend_settings;scope text;value jsonb;source jsonb;result jsonb:='[]';
begin
 if center is null or not private.is_manager(org,person,center) or not private.center_accessible(org,center) or not private.permission_preparation_licensed(org) then return result;end if;
 foreach scope in array array['center','organization'] loop
  select * into doc from private.frontend_settings where scope_key=case scope when 'center' then 'center:'||org||':'||center else 'organization:'||org end;
  for value in select * from jsonb_array_elements(coalesce(doc.values->'permission_templates','[]')) loop
   begin perform private.permission_preparation_validate(value,org);exception when sqlstate 'P0001' then continue;end;
   source:=jsonb_build_object('scope',scope,'key',value->>'key','version',doc.version)||case when scope='center' then jsonb_build_object('center_id',center) else '{}'::jsonb end;
   result:=result||jsonb_build_array(jsonb_build_object('source',source,'template',value));
  end loop;
 end loop;return result;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_setting_valid(jsonb,jsonb)'::regprocedure);
 a:=$anchor$ if s->>'$ref'='#/$defs/FtkUuid' then$anchor$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission shared schema anchor drift';end if;
 execute replace(b,a,$branch$ if s->>'$ref'='#/$defs/PermissionPreparationTemplate' then return private.frontend_setting_valid(v,private.permission_preparation_schema());end if;
$branch$||a);
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 a:='  if key=''agreement_templates'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission preparation field authority drift';end if;
 execute replace(b,a,'  if key=''permission_templates'' then perform private.require_feature(org,''F05'');end if;'||E'\n'||a);
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:='perform private.agreement_preparation_patch(r,patch);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission preparation validation drift';end if;
 execute replace(b,a,a||'perform private.permission_preparation_patch(r,patch);');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',13';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission preparation catalog version drift';end if;b:=replace(b,a,'''catalog_version'',14');
 a:='''writable'',(f->>''key''<>''agreement_templates''';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission preparation descriptor drift';end if;
 execute replace(b,a,'''writable'',(f->>''key''<>''permission_templates'' or private.permission_preparation_licensed(org)) and (f->>''key''<>''agreement_templates''');
 b:=pg_get_functiondef('private.domain_preparation_resolve(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=' if r->>''kind''=''agreement'' then';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Permission preparation resolver drift';end if;
 execute replace(b,a,' if r->>''kind''=''permission'' then return private.permission_preparation_resolve(r,org,center,person);end if;'||E'\n'||a);
 b:=pg_get_functiondef('private.domain_preparations_available(uuid,uuid,uuid)'::regprocedure);
 a:='jsonb_build_object(''agreements'',private.agreement_preparations_available(org,center,person))';if array_length(string_to_array(b,a),1)<>3 then raise exception 'Permission preparation catalogue drift';end if;
 execute replace(b,a,'('||a||'||jsonb_build_object(''permissions'',private.permission_preparations_available(org,center,person)))');
end$patch$;
revoke all on function private.permission_preparation_schema(),private.permission_preparation_licensed(uuid),private.permission_preparation_validate(jsonb,uuid),private.permission_preparation_patch(jsonb,jsonb),private.permission_preparation_resolve(jsonb,uuid,uuid,uuid),private.permission_preparations_available(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.permission_preparation_schema(),private.permission_preparation_licensed(uuid),private.permission_preparation_validate(jsonb,uuid),private.permission_preparation_patch(jsonb,jsonb),private.permission_preparation_resolve(jsonb,uuid,uuid,uuid),private.permission_preparations_available(uuid,uuid,uuid) to service_role;
commit;
