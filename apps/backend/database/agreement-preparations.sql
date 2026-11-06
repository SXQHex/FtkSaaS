begin;
create function private.agreement_pay_terms_schema() returns jsonb language sql immutable security invoker set search_path='' as $schema$select '{"type":"object","properties":{"model":{"type":"string","enum":["percentage","session_fixed","per_person","fixed_plus_person","explicit_mixed"]},"currency":{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},"components":{"type":"array","items":{"type":"object","properties":{"kind":{"enum":["percentage","session_fixed","per_person"],"type":"string"},"rate_bps":{"anyOf":[{"type":"integer","minimum":0,"maximum":10000},{"type":"null"}]},"amount_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]},"entitlement_kind":{"anyOf":[{"type":"string","enum":["credits","timed"]},{"type":"null"}]},"basis":{"anyOf":[{"type":"object","properties":{"mode":{"type":"string","enum":["sale_unit","fixed_unit"]},"unit_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]}},"required":["mode"],"additionalProperties":false,"x-invariant":"fixed_unit needs unit_minor; timed percentage explicit fixed-unit agreement; source-less negative uses reservation valuation snapshot"},{"type":"null"}]}},"required":["kind"],"additionalProperties":false,"x-invariant":"percentage rate_bps+basis; fixed/person amount_minor. trial and blocked excluded from percentage/person, session_fixed only occurred session"},"minItems":1},"room_fee":{"type":"object","properties":{"kind":{"enum":["free","fixed","percentage"],"type":"string"},"amount_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]},"rate_bps":{"anyOf":[{"type":"integer","minimum":0,"maximum":10000},{"type":"null"}]},"basis":{"anyOf":[{"type":"object","properties":{"mode":{"type":"string","enum":["sale_unit","fixed_unit"]},"unit_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]}},"required":["mode"],"additionalProperties":false,"x-invariant":"fixed_unit needs unit_minor; timed percentage explicit fixed-unit agreement; source-less negative uses reservation valuation snapshot"},{"type":"null"}]},"order":{"enum":["before_instructor_share","after_instructor_share"],"type":"string"}},"required":["kind","order"],"additionalProperties":false},"package_overrides":{"type":"array","items":{"type":"object","properties":{"product_id":{"$ref":"#/$defs/FtkUuid"},"components":{"type":"array","items":{"type":"object","properties":{"kind":{"enum":["percentage","session_fixed","per_person"],"type":"string"},"rate_bps":{"anyOf":[{"type":"integer","minimum":0,"maximum":10000},{"type":"null"}]},"amount_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]},"entitlement_kind":{"anyOf":[{"type":"string","enum":["credits","timed"]},{"type":"null"}]},"basis":{"anyOf":[{"type":"object","properties":{"mode":{"type":"string","enum":["sale_unit","fixed_unit"]},"unit_minor":{"anyOf":[{"type":"string","pattern":"^(0|[1-9][0-9]{0,18})$","x-validation":"int(value)<=9223372036854775807"},{"type":"null"}]}},"required":["mode"],"additionalProperties":false,"x-invariant":"fixed_unit needs unit_minor; timed percentage explicit fixed-unit agreement; source-less negative uses reservation valuation snapshot"},{"type":"null"}]}},"required":["kind"],"additionalProperties":false,"x-invariant":"percentage rate_bps+basis; fixed/person amount_minor. trial and blocked excluded from percentage/person, session_fixed only occurred session"},"minItems":1}},"required":["product_id","components"],"additionalProperties":false},"minItems":0,"uniqueItems":true}},"required":["model","currency","components","room_fee"],"additionalProperties":false,"x-invariant":"DS-03: explicit model/components/currency; package identity override replaces general variable components, never adds them; one session_fixed component per performed session/person, not per package or attendee; no implicit fee or valuation; actual sale price or frozen negative basis; immutable published version."}'::jsonb$schema$;
-- Preparation is a read-only proposal. Instructor, dates, predecessor and
-- publication reason remain explicit inputs to the existing agreement writer.
create function private.agreement_preparation_licensed(org uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(private.current_plan_name(org),'') not in ('pro','business') then return false;end if;
 perform private.require_feature(org,'F20');return true;
exception when sqlstate 'P0001' then
 if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','SUBSCRIPTION_NOT_STARTED','POLICY_NOT_CONFIGURED') then return false;end if;raise;
end$$;
create function private.agreement_preparation_validate(value jsonb,org uuid) returns void language plpgsql stable security invoker set search_path='' as $$
declare schema jsonb;
begin
 perform private.require_feature(org,'F20');
 select f#>'{schema,items}' into schema from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'='organization' and f->>'key'='agreement_templates';
 if schema is null or not private.frontend_setting_valid(value,schema) or btrim(value->>'name')='' then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from core.disciplines d where d.org_id=org and d.id=(value->>'discipline_id')::uuid and d.state='active') then perform private.fail('NOT_FOUND');end if;
 perform private.pay_terms_validate(org,value->'terms');
exception when invalid_text_representation or numeric_value_out_of_range then perform private.fail('VALIDATION_FAILED');
end$$;
create function private.agreement_preparation_patch(r jsonb,patch jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare value jsonb;
begin
 if not patch?'agreement_templates' then return;end if;
 if exists(select 1 from jsonb_array_elements(patch->'agreement_templates') x group by x->>'key' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
 for value in select * from jsonb_array_elements(patch->'agreement_templates') loop
  perform private.agreement_preparation_validate(value,(r->>'org_id')::uuid);
  if r->>'scope'='center' and not exists(select 1 from core.center_disciplines d where d.org_id=(r->>'org_id')::uuid and d.center_id=(r->>'center_id')::uuid and d.discipline_id=(value->>'discipline_id')::uuid and d.state='active') then perform private.fail('NOT_FOUND');end if;
 end loop;
end$$;
create function private.agreement_preparation_resolve(r jsonb,org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare doc private.frontend_settings;value jsonb;
begin
 -- The existing earnings.manage writer requires the live center manager;
 -- organization template ownership never grants center publication authority.
 perform private.domain_preparation_access(r,org,center,person);
 perform private.require_feature(org,'F20');
 select * into doc from private.frontend_settings where scope_key=case r#>>'{source,scope}' when 'organization' then 'organization:'||org when 'center' then 'center:'||org||':'||center end;
 if coalesce(doc.version,0) is distinct from (r#>>'{source,version}')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 select x into value from jsonb_array_elements(coalesce(doc.values->'agreement_templates','[]')) x where x->>'key'=r#>>'{source,key}';
 if value is null then perform private.fail('NOT_FOUND');end if;
 perform private.agreement_preparation_validate(value,org);
 if not exists(select 1 from core.center_disciplines d where d.org_id=org and d.center_id=center and d.discipline_id=(value->>'discipline_id')::uuid and d.state='active') then perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('kind','agreement','source',r->'source','agreement_request',jsonb_build_object('discipline_id',value->'discipline_id','format',value->'format','terms',value->'terms'));
end$$;
create function private.agreement_preparations_available(org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare doc private.frontend_settings;scope text;value jsonb;source jsonb;result jsonb:='[]';
begin
 if center is null or not private.is_manager(org,person,center) or not private.center_accessible(org,center) or not private.agreement_preparation_licensed(org) then return result;end if;
 foreach scope in array array['center','organization'] loop
  select * into doc from private.frontend_settings where scope_key=case scope when 'center' then 'center:'||org||':'||center else 'organization:'||org end;
  for value in select * from jsonb_array_elements(coalesce(doc.values->'agreement_templates','[]')) loop
   begin perform private.agreement_preparation_validate(value,org);exception when sqlstate 'P0001' then continue;end;
   if not exists(select 1 from core.center_disciplines d where d.org_id=org and d.center_id=center and d.discipline_id=(value->>'discipline_id')::uuid and d.state='active') then continue;end if;
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
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement shared schema anchor drift';end if;
 execute replace(b,a,$branch$ if s->>'$ref'='#/$defs/PayTerms' then return private.frontend_setting_valid(v,private.agreement_pay_terms_schema());end if;
$branch$||a);
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 a:='  if scope=''organization'' and key like ''billing_%''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement preparation field authority drift';end if;
 execute replace(b,a,'  if key=''agreement_templates'' then perform private.require_feature(org,''F20'');end if;'||E'\n'||a);
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:=' perform private.domain_preparation_patch(r,patch);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement preparation validation drift';end if;
 execute replace(b,a,a||'perform private.agreement_preparation_patch(r,patch);');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',12';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement preparation catalog version drift';end if;
 b:=replace(b,a,'''catalog_version'',13');
 a:='''writable'',private.reminder_field_writable';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement preparation descriptor drift';end if;
 execute replace(b,a,'''writable'',(f->>''key''<>''agreement_templates'' or private.agreement_preparation_licensed(org)) and private.reminder_field_writable');
 b:=pg_get_functiondef('private.domain_preparation_resolve(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=' perform private.domain_preparation_access(r,org,center,person);';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Agreement preparation resolver drift';end if;
 execute replace(b,a,' if r->>''kind''=''agreement'' then return private.agreement_preparation_resolve(r,org,center,person);end if;'||E'\n'||a);
 b:=pg_get_functiondef('private.domain_preparations_available(uuid,uuid,uuid)'::regprocedure);
 a:='jsonb_build_object(''availability'',availability,''packages'',packages,''package_currency_suggestion'',''TRY'')';
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Agreement preparation catalogue drift';end if;
 execute replace(b,a,'('||a||'||jsonb_build_object(''agreements'',private.agreement_preparations_available(org,center,person)))');
end$patch$;
revoke all on function private.agreement_pay_terms_schema(),private.agreement_preparation_licensed(uuid),private.agreement_preparation_validate(jsonb,uuid),private.agreement_preparation_patch(jsonb,jsonb),private.agreement_preparation_resolve(jsonb,uuid,uuid,uuid),private.agreement_preparations_available(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.agreement_pay_terms_schema(),private.agreement_preparation_licensed(uuid),private.agreement_preparation_validate(jsonb,uuid),private.agreement_preparation_patch(jsonb,jsonb),private.agreement_preparation_resolve(jsonb,uuid,uuid,uuid),private.agreement_preparations_available(uuid,uuid,uuid) to service_role;
commit;
