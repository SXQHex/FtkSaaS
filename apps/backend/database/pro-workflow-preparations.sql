begin;
create function private.pro_preparation_feature(kind text) returns text language sql immutable security invoker set search_path='' as $$
 select case $1 when 'program' then 'F08' when 'event' then 'F29' when 'collection' then 'F19' when 'crm' then 'F21' when 'automation' then 'F24' end
$$;
create function private.pro_preparation_licensed(org uuid,kind text) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if private.pro_preparation_feature(kind) is null or coalesce(private.current_plan_name(org),'') not in ('pro','business') then return false;end if;
 perform private.require_feature(org,private.pro_preparation_feature(kind));return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','POLICY_NOT_CONFIGURED') then return false;end if;raise;
end$$;
create function private.pro_preparation_validate(kind text,value jsonb,org uuid,center uuid default null) returns void language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare schema jsonb;t jsonb:=value->'defaults';id uuid;
begin
 if not private.pro_preparation_licensed(org,kind) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 select f#>'{schema,items}' into schema from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'='organization' and f->>'key'=kind||'_templates';
 if schema is null or not private.frontend_setting_valid(value,schema) or btrim(value->>'name')='' then perform private.fail('VALIDATION_FAILED');end if;
 if kind='program' then perform private.capacity_input(t->'capacity');perform (t->>'local_start')::time;if (t->>'local_start')::time>=time '24:00:00' then perform private.fail('VALIDATION_FAILED');end if;
 elsif kind='event' then
  if t#>>'{capacity,kind}' is distinct from 'unlimited' and (t#>>'{capacity,nominal}')::bigint>(t#>>'{capacity,maximum}')::bigint then perform private.fail('VALIDATION_FAILED');end if;
  if (t#>>'{terms,fee_minor}')::numeric not between 0 and 9223372036854775807 then perform private.fail('VALIDATION_FAILED');end if;
  if t#>>'{terms,package_usage}'='eligibility_only' and (t#>>'{terms,fee_minor}'<>'0' or jsonb_array_length(t#>'{terms,allowed_product_version_ids}')=0) then perform private.fail('VALIDATION_FAILED');end if;
  for id in select x::uuid from jsonb_array_elements_text(t#>'{terms,allowed_product_version_ids}') x loop
   if not exists(select 1 from core.product_versions p where p.org_id=org and p.id=id and (center is null or p.center_id=center)) then perform private.fail('NOT_FOUND');end if;
  end loop;
 elsif kind='crm' then
  if btrim(t->>'source')='' or btrim(t->>'interest')='' then perform private.fail('VALIDATION_FAILED');end if;
 elsif kind='automation' then
  if t#>>'{action,channel}'<>'in_app' or btrim(t#>>'{action,template_key}')='' then perform private.fail('VALIDATION_FAILED');end if;
 end if;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then perform private.fail('VALIDATION_FAILED');
end$$;
create function private.pro_preparation_patch(r jsonb,patch jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare kind text;field text;value jsonb;
begin
 foreach kind in array array['program','event','collection','crm','automation'] loop
  field:=kind||'_templates';if not patch?field then continue;end if;
  if exists(select 1 from jsonb_array_elements(patch->field) x group by x->>'key' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
  for value in select * from jsonb_array_elements(patch->field) loop perform private.pro_preparation_validate(kind,value,(r->>'org_id')::uuid,case when r->>'scope'='center' then (r->>'center_id')::uuid end);end loop;
 end loop;
end$$;
create function private.pro_preparation_resolve(r jsonb,org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare doc private.frontend_settings;value jsonb;kind text:=r->>'kind';
begin
 perform private.domain_preparation_access(r,org,center,person);
 select * into doc from private.frontend_settings where scope_key=case r#>>'{source,scope}' when 'organization' then 'organization:'||org when 'center' then 'center:'||org||':'||center end;
 if coalesce(doc.version,0) is distinct from (r#>>'{source,version}')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 select x into value from jsonb_array_elements(coalesce(private.settings_effective_values(doc.scope_key,doc.values)->(kind||'_templates'),'[]')) x where x->>'key'=r#>>'{source,key}';
 if value is null then perform private.fail('NOT_FOUND');end if;
 perform private.pro_preparation_validate(kind,value,org,center);
 return jsonb_build_object('kind',kind,'source',r->'source','defaults',value->'defaults');
end$$;
create function private.pro_preparations_available(org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare doc private.frontend_settings;scope text;kind text;field text;value jsonb;source jsonb;result jsonb:='{"programs":[],"events":[],"collections":[],"crm":[],"automations":[]}';
begin
 if center is null or not private.is_manager(org,person,center) or not private.center_accessible(org,center) then return result;end if;
 foreach scope in array array['center','organization'] loop
  select * into doc from private.frontend_settings where scope_key=case scope when 'center' then 'center:'||org||':'||center else 'organization:'||org end;
  foreach kind in array array['program','event','collection','crm','automation'] loop
   field:=case kind when 'program' then 'programs' when 'event' then 'events' when 'collection' then 'collections' when 'crm' then 'crm' else 'automations' end;
   for value in select * from jsonb_array_elements(coalesce(private.settings_effective_values(doc.scope_key,doc.values)->(kind||'_templates'),'[]')) loop
    begin perform private.pro_preparation_validate(kind,value,org,center);exception when sqlstate 'P0001' then continue;end;
    source:=jsonb_build_object('scope',scope,'key',value->>'key','version',doc.version)||case when scope='center' then jsonb_build_object('center_id',center) else '{}'::jsonb end;
    result:=jsonb_set(result,array[field],result->field||jsonb_build_array(jsonb_build_object('source',source,'template',value)));
   end loop;
  end loop;
 end loop;return result;
end$$;
-- Program values are startup copies; other shared templates use explicit live inheritance.
alter table private.center_domain_preparation_origins drop constraint center_domain_preparation_origins_field_check;
alter table private.center_domain_preparation_origins add constraint center_domain_preparation_origins_field_check check(field in ('availability_templates','package_templates','program_templates'));
alter table private.settings_template_inheritance drop constraint settings_template_inheritance_field_check;
alter table private.settings_template_inheritance add constraint settings_template_inheritance_field_check check(field in ('report_templates','import_templates','agreement_templates','permission_templates','event_templates','collection_templates','crm_templates','automation_templates'));
do $patch$
declare b text;a text;fn record;
begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('domain_preparation_copy','domain_preparation_sources') loop
  b:=pg_get_functiondef(fn.signature);a:='array[''availability_templates'',''package_templates'']';
  if array_length(string_to_array(b,a),1)<>2 then raise exception 'Program startup-copy source drift';end if;
  execute replace(b,a,'array[''availability_templates'',''package_templates'',''program_templates'']');
 end loop;
 b:=pg_get_functiondef('private.frontend_settings_access(jsonb,uuid,uuid,boolean)'::regprocedure);
 a:='jsonb_array_length(r->''inherit_fields'') not between 1 and 4';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro inheritance count drift';end if;
 b:=replace(b,a,'jsonb_array_length(r->''inherit_fields'') not between 1 and 8');
 a:='k not in (''report_templates'',''import_templates'',''agreement_templates'',''permission_templates'')';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro inheritance whitelist drift';end if;
 execute replace(b,a,'k not in (''report_templates'',''import_templates'',''agreement_templates'',''permission_templates'',''event_templates'',''collection_templates'',''crm_templates'',''automation_templates'')');
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:='perform private.permission_preparation_patch(r,patch);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro preparation patch drift';end if;
 execute replace(b,a,a||'perform private.pro_preparation_patch(r,patch);');
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 a:='  if key=''permission_templates'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro preparation field authority drift';end if;
 execute replace(b,a,$a$  if key in ('program_templates','event_templates','collection_templates','crm_templates','automation_templates') and not private.pro_preparation_licensed(org,split_part(key,'_',1)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
$a$||a);
 b:=pg_get_functiondef('private.domain_preparation_resolve(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=' if r->>''kind''=''permission'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro preparation resolver dispatch drift';end if;
 execute replace(b,a,$a$ if r->>'kind' in ('program','event','collection','crm','automation') then return private.pro_preparation_resolve(r,org,center,person);end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',17';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro preparation catalog version drift';end if;
 b:=replace(b,a,'''catalog_version'',18');
 a:='''preparation_templates'',private.domain_preparations_available(org,(r->>''center_id'')::uuid,person)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro preparation catalog projection drift';end if;
 b:=replace(b,a,a||'||private.pro_preparations_available(org,(r->>''center_id'')::uuid,person)');
 a:='''writable'',';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Pro preparation writable descriptor drift';end if;
 execute replace(b,a,a||$a$(f->>'key' not in ('program_templates','event_templates','collection_templates','crm_templates','automation_templates') or private.pro_preparation_licensed(org,split_part(f->>'key','_',1))) and $a$);
end$patch$;
revoke all on function private.pro_preparation_feature(text),private.pro_preparation_licensed(uuid,text),private.pro_preparation_validate(text,jsonb,uuid,uuid),private.pro_preparation_patch(jsonb,jsonb),private.pro_preparation_resolve(jsonb,uuid,uuid,uuid),private.pro_preparations_available(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.pro_preparation_feature(text),private.pro_preparation_licensed(uuid,text),private.pro_preparation_validate(text,jsonb,uuid,uuid),private.pro_preparation_patch(jsonb,jsonb),private.pro_preparation_resolve(jsonb,uuid,uuid,uuid),private.pro_preparations_available(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
