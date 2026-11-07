begin;
create function private.organization_regional_schema() returns jsonb language sql immutable security invoker set search_path='' as $schema$select '{"type":"object","properties":{"application_language":{"type":"string","enum":["tr","en"]},"public_language":{"type":"string","enum":["tr","en"]},"document_language":{"type":"string","enum":["tr","en"]},"notification_language":{"type":"string","enum":["tr","en"]},"date_format":{"type":"string","enum":["dd.MM.yyyy"]},"time_format":{"type":"string","enum":["12","24"]},"number_format":{"type":"string","enum":["tr-TR","en-US"]},"week_start":{"type":"string","enum":["monday","sunday"]},"fallback_language":{"type":"string","enum":["tr"]},"new_center_timezone":{"type":"string","minLength":1,"maxLength":100}},"required":["application_language","public_language","document_language","notification_language","date_format","time_format","number_format","week_start","fallback_language","new_center_timezone"],"additionalProperties":false}'::jsonb$schema$;
create function private.organization_regional_defaults(org uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select (private.frontend_settings_defaults('organization')->'regional_defaults')||coalesce((select values->'regional_defaults' from private.frontend_settings where scope_key='organization:'||org),'{}'::jsonb)
$$;
create function private.organization_public_regional_context(org uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('language',v->'public_language','fallback_language',v->'fallback_language','date_format',v->'date_format','time_format',v->'time_format','number_format',v->'number_format','week_start',v->'week_start') from (select private.organization_regional_defaults(org) v) s
$$;
create function private.settings_history_patch(r jsonb,account uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare h private.frontend_settings_history;k text;patch jsonb:='{}';current_values jsonb;
begin
 if not r?'history_source' then return r->'patch';end if;
 if r->'patch'<>'{}'::jsonb or r?'logo_image' then perform private.fail('VALIDATION_FAILED');end if;
 select * into h from private.frontend_settings_history where id=(r#>>'{history_source,id}')::uuid and scope_key=private.frontend_settings_key(r,account,person);
 if not found then perform private.fail('NOT_FOUND');end if;
 if jsonb_typeof(r#>'{history_source,fields}')<>'array' or jsonb_array_length(r#>'{history_source,fields}') not between 1 and 50 then perform private.fail('VALIDATION_FAILED');end if;
 if (select count(*)<>count(distinct x) from jsonb_array_elements(r#>'{history_source,fields}') x) then perform private.fail('VALIDATION_FAILED');end if;
 current_values:=private.frontend_settings_view(r,account,person)->'values';
 for k in select jsonb_array_elements_text(r#>'{history_source,fields}') loop
  if not h.after_values?k then perform private.fail('VALIDATION_FAILED');end if;
  patch:=patch||jsonb_build_object(k,h.after_values->k);
  -- Historical preferences cannot reopen withdrawn disclosure/marketing choices.
  if k in ('history_recommendations','profile_visible','photo_visible','email_visible','phone_visible','marketing_in_app','in_app_marketing','ad_personalization','ad_measurement','optional_analytics') and current_values->k='false'::jsonb then patch:=jsonb_set(patch,array[k],'false'::jsonb);end if;
 end loop;
 perform private.frontend_settings_patch(r,patch,person);
 return patch;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_setting_valid(jsonb,jsonb)'::regprocedure);
 a:=$anchor$ if s->>'$ref'='#/$defs/FtkUuid' then$anchor$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Regional schema validation drift';end if;
 execute replace(b,a,$branch$ if s->>'$ref'='#/$defs/OrganizationRegionalDefaults' then return private.frontend_setting_valid(v,private.organization_regional_schema());end if;
$branch$||a);
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:=' for item in select * from jsonb_each(patch) loop';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Regional timezone validation drift';end if;
 execute replace(b,a,$branch$ if patch?'regional_defaults' and not exists(select 1 from pg_timezone_names where name=patch#>>'{regional_defaults,new_center_timezone}') then perform private.fail('VALIDATION_FAILED');end if;
$branch$||a);
 b:=pg_get_functiondef('private.frontend_settings_access(jsonb,uuid,uuid,boolean)'::regprocedure);
 a:=' -- Same lock serializes absent-row creation, writes, reset preview and receipt replay.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Historical source preflight drift';end if;
 execute replace(b,a,$branch$ if r?'history_source' then r:=jsonb_set(r,'{patch}',private.settings_history_patch(r,account,person));end if;
$branch$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' if op=''settings_get_v1'' then return view;end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'History reapply write drift';end if;
 b:=replace(b,a,$branch$ if op='settings_update_v1' and r?'history_source' then r:=jsonb_set(r,'{patch}',private.settings_history_patch(r,account,person));end if;
$branch$||a);
 a:='''catalog_version'',15';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Regional catalog version drift';end if;
 execute replace(b,a,'''catalog_version'',16');
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' if out is null then out:=jsonb_build_object(''operation_id''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Regional organization context drift';end if;
 execute replace(b,a,$branch$ if p_operation='organization_get_v1' then out:=out||jsonb_build_object('regional_defaults',private.organization_regional_defaults(org));
 elsif p_operation='organizations_list_v1' then
  out:=jsonb_set(out,'{items}',coalesce((select jsonb_agg(x||jsonb_build_object('regional_defaults',private.organization_regional_defaults((x->>'id')::uuid)) order by n) from jsonb_array_elements(out->'items') with ordinality e(x,n)),'[]'::jsonb));
 end if;
$branch$||a);
 b:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);
 a:=$anchor$'organization_profile',private.settings_public_profile(private.settings_public_slug(r->>'slug'))$anchor$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public regional context drift';end if;
 execute replace(b,a,a||$branch$,'regional_defaults',private.organization_public_regional_context(private.settings_public_slug(r->>'slug'))$branch$);
end$patch$;
revoke all on function private.organization_regional_schema(),private.organization_regional_defaults(uuid),private.organization_public_regional_context(uuid),private.settings_history_patch(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function private.organization_regional_schema(),private.organization_regional_defaults(uuid),private.organization_public_regional_context(uuid),private.settings_history_patch(jsonb,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
