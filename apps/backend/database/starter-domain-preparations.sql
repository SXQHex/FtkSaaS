begin;
create table private.center_domain_preparation_origins(
 center_id uuid not null references core.centers(id),field text not null check(field in ('availability_templates','package_templates')),
 org_id uuid not null references core.organizations(id),organization_version bigint not null,snapshot jsonb not null check(jsonb_typeof(snapshot)='array'),active boolean not null default true,
 primary key(center_id,field),foreign key(org_id,center_id) references core.centers(org_id,id)
);
alter table private.center_domain_preparation_origins enable row level security;
revoke all on private.center_domain_preparation_origins from public,anon,authenticated;
grant select,insert,update on private.center_domain_preparation_origins to service_role;
create function private.domain_preparation_copy() returns trigger language plpgsql security invoker set search_path='' as $$
declare doc private.frontend_settings;field text;copied jsonb:='{}';
begin
 select * into doc from private.frontend_settings where scope_key='organization:'||new.org_id;
 foreach field in array array['availability_templates','package_templates'] loop
  if doc.values?field then
   copied:=copied||jsonb_build_object(field,doc.values->field);
   insert into private.center_domain_preparation_origins(center_id,field,org_id,organization_version,snapshot) values(new.id,field,new.org_id,doc.version,doc.values->field);
  end if;
 end loop;
 if copied<>'{}' then
  insert into private.frontend_settings(scope_key,scope,values) values('center:'||new.org_id||':'||new.id,'center',copied)
   on conflict(scope_key) do update set values=private.frontend_settings.values||excluded.values;
 end if;return new;
end$$;
-- Runs after the existing program-duration initialization; no existing-center backfill.
create trigger zz_center_domain_preparation_copy after insert on core.centers for each row execute function private.domain_preparation_copy();
create function private.domain_preparation_sources(r jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare local jsonb;field text;origin private.center_domain_preparation_origins;result jsonb:='{}';source jsonb;
begin
 select values into local from private.frontend_settings where scope_key='center:'||(r->>'org_id')::uuid||':'||(r->>'center_id')::uuid;
 foreach field in array array['availability_templates','package_templates'] loop
  select * into origin from private.center_domain_preparation_origins where center_id=(r->>'center_id')::uuid and org_id=(r->>'org_id')::uuid and private.center_domain_preparation_origins.field=field;
  source:=case when not coalesce(local?field,false) then jsonb_build_object('kind','system_default')
   when origin.active and origin.snapshot=local->field then jsonb_build_object('kind','organization_copy','organization_version',origin.organization_version)
   else jsonb_build_object('kind','center_local') end;
  result:=result||jsonb_build_object(field,source);
 end loop;return result;
end$$;
create function private.domain_preparation_local(r jsonb,patch jsonb) returns void language sql volatile security invoker set search_path='' as $$
 update private.center_domain_preparation_origins set active=false where r->>'scope'='center' and center_id=(r->>'center_id')::uuid and org_id=(r->>'org_id')::uuid and patch?field
$$;
create function private.domain_preparation_validate(kind text,value jsonb,org uuid) returns void language plpgsql stable security invoker set search_path='' as $$
declare rule jsonb;terms jsonb;prefix text;name text;
begin
 if btrim(value->>'name')='' then perform private.fail('VALIDATION_FAILED');end if;
 if kind='availability' then
  perform private.require_feature(org,'F02');
  for rule in select * from jsonb_array_elements(value->'rules') loop
   if (rule->>'local_start')::time>=(rule->>'local_end')::time or (rule->>'valid_until')::date<=(rule->>'valid_from')::date then perform private.fail('VALIDATION_FAILED');end if;
  end loop;
 elsif kind='package' then
  terms:=value->'terms';perform private.require_feature(org,case when terms->>'kind'='timed' then 'F16' else 'F15' end);
  if (value->>'start_date')::date>=(value->>'end_date')::date or (terms->>'price_minor')::numeric not between 0 and 9223372036854775807 then perform private.fail('VALIDATION_FAILED');end if;
  if terms->>'kind'='credits' and ((terms->>'credits')::numeric is null or (terms->>'credits')::numeric not between 1 and 2147483647 or terms->'quota'<>'null'::jsonb) or terms->>'kind'='timed' and terms->>'credits' is not null then perform private.fail('VALIDATION_FAILED');end if;
  if terms#>>'{refund,method}'='used_at_unit_price' and (terms#>>'{refund,used_unit_minor}' is null or (terms#>>'{refund,used_unit_minor}')::numeric<0) or terms#>>'{refund,method}'='credit_ratio' and terms->>'kind'<>'credits' then perform private.fail('VALIDATION_FAILED');end if;
  select d.name into prefix from core.disciplines d where d.org_id=org and d.id=(value->>'discipline_id')::uuid and d.state='active';
  if prefix is null then perform private.fail('NOT_FOUND');end if;
  if private.current_plan_name(org)='starter' and left(terms->>'name',length(prefix))<>prefix then perform private.fail('VALIDATION_FAILED');end if;
 else perform private.fail('VALIDATION_FAILED');end if;
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then perform private.fail('VALIDATION_FAILED');
end$$;
create function private.domain_preparation_patch(r jsonb,patch jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare field text;value jsonb;
begin
 foreach field in array array['availability_templates','package_templates'] loop
  if patch?field then
   if exists(select 1 from jsonb_array_elements(patch->field) x group by x->>'key' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
   for value in select * from jsonb_array_elements(patch->field) loop perform private.domain_preparation_validate(case field when 'availability_templates' then 'availability' else 'package' end,value,(r->>'org_id')::uuid);end loop;
  end if;
 end loop;
end$$;
create function private.domain_preparation_access(r jsonb,org uuid,center uuid,person uuid) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,center);
 if r#>>'{source,scope}'='center' and (r#>>'{source,center_id}')::uuid is distinct from center then perform private.fail('NOT_FOUND');end if;
end$$;
create function private.domain_preparation_resolve(r jsonb,org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare doc private.frontend_settings;value jsonb;field text:=case r->>'kind' when 'availability' then 'availability_templates' when 'package' then 'package_templates' end;terms jsonb;rule jsonb;
begin
 perform private.domain_preparation_access(r,org,center,person);
 select * into doc from private.frontend_settings where scope_key=case r#>>'{source,scope}' when 'organization' then 'organization:'||org when 'center' then 'center:'||org||':'||center end;
 if coalesce(doc.version,0) is distinct from (r#>>'{source,version}')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 select x into value from jsonb_array_elements(coalesce(doc.values->field,'[]')) x where x->>'key'=r#>>'{source,key}';if value is null then perform private.fail('NOT_FOUND');end if;
 perform private.domain_preparation_validate(r->>'kind',value,org);
 if r->>'kind'='availability' then
  perform private.assert_resource(org,center,r#>>'{resource,kind}',(r#>>'{resource,id}')::uuid);rule:=value->'rules'->(r->>'rule_index')::int;if rule is null then perform private.fail('NOT_FOUND');end if;
  return jsonb_build_object('kind','availability','source',r->'source','request',jsonb_build_object('resource',r->'resource','rule',rule));
 end if;
 terms:=(value->'terms')||jsonb_build_object('scopes',jsonb_build_array(jsonb_build_object('scope_kind','center_discipline','center_id',center,'discipline_id',value->'discipline_id','usage_targets',jsonb_build_array('lesson'))));
 if not exists(select 1 from core.center_disciplines d where d.org_id=org and d.center_id=center and d.discipline_id=(value->>'discipline_id')::uuid and d.state='active') then perform private.fail('NOT_FOUND');end if;
 perform private.starter_request_guard('product_publish_v1',jsonb_build_object('center_id',center,'terms',terms),org);
 return jsonb_build_object('kind','package','source',r->'source','product_request',jsonb_build_object('terms',terms),'sale_dates',jsonb_build_object('start_date',value->'start_date','end_date',value->'end_date'));
end$$;
create function private.domain_preparations_available(org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare doc private.frontend_settings;scope text;field text;value jsonb;source jsonb;availability jsonb:='[]';packages jsonb:='[]';
begin
 if center is null or not private.is_manager(org,person,center) or not private.center_accessible(org,center) then return jsonb_build_object('availability',availability,'packages',packages,'package_currency_suggestion','TRY');end if;
 foreach scope in array array['center','organization'] loop
  select * into doc from private.frontend_settings where scope_key=case scope when 'center' then 'center:'||org||':'||center else 'organization:'||org end;
  foreach field in array array['availability_templates','package_templates'] loop
   for value in select * from jsonb_array_elements(coalesce(doc.values->field,'[]')) loop
    begin perform private.domain_preparation_validate(case field when 'availability_templates' then 'availability' else 'package' end,value,org);exception when SQLSTATE 'P0001' then continue;end;
    source:=jsonb_build_object('scope',scope,'key',value->>'key','version',doc.version)||case when scope='center' then jsonb_build_object('center_id',center) else '{}'::jsonb end;
    if field='availability_templates' then availability:=availability||jsonb_build_array(jsonb_build_object('source',source,'template',value));else packages:=packages||jsonb_build_array(jsonb_build_object('source',source,'template',value));end if;
   end loop;
  end loop;
 end loop;return jsonb_build_object('availability',availability,'packages',packages,'package_currency_suggestion','TRY');
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:=' for item in select * from jsonb_each(patch) loop';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation patch anchor drift';end if;
 execute replace(b,a,' perform private.domain_preparation_patch(r,patch);'||E'\n'||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',5';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation catalog version anchor drift';end if;b:=replace(b,a,'''catalog_version'',6');
 a:='''brand_packages'',''[]''::jsonb';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation catalog projection anchor drift';end if;
 b:=replace(b,a,'''preparation_templates'',private.domain_preparations_available(org,(r->>''center_id'')::uuid,person),'||a);
 a:='  local:=local||patch;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation explicit local anchor drift';end if;
 execute replace(b,a,'  perform private.domain_preparation_local(r,patch);'||E'\n'||a);
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:=$a$'program_duration_source',private.program_preparation_source(org,(r->>'center_id')::uuid)$a$;if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation source projection anchor drift';end if;
 execute replace(b,a,a||',''preparation_sources'',private.domain_preparation_sources(r)');
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation scope authorization anchor drift';end if;
 b:=replace(b,a,a||E'\n'||$a$ if perm_code='preparation.resolve' then perform private.domain_preparation_access(r,org,center,person);end if;$a$);
 a:=' if perm_code=''calendar.self'' then null;';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation permission branch anchor drift';end if;
 b:=replace(b,a,' if perm_code=''preparation.resolve'' then null;elsif perm_code=''calendar.self'' then null;');
 a:=' -- DOMAIN_CASES';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Domain preparation resolver dispatch anchor drift';end if;
 execute replace(b,a,$a$ when 'settings_preparation_resolve_v1' then out:=private.domain_preparation_resolve(r,org,center,person);
$a$||a);
end$patch$;
revoke all on function private.domain_preparation_copy(),private.domain_preparation_sources(jsonb),private.domain_preparation_local(jsonb,jsonb),private.domain_preparation_validate(text,jsonb,uuid),private.domain_preparation_patch(jsonb,jsonb),private.domain_preparation_access(jsonb,uuid,uuid,uuid),private.domain_preparation_resolve(jsonb,uuid,uuid,uuid),private.domain_preparations_available(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.domain_preparation_copy(),private.domain_preparation_sources(jsonb),private.domain_preparation_local(jsonb,jsonb),private.domain_preparation_validate(text,jsonb,uuid),private.domain_preparation_patch(jsonb,jsonb),private.domain_preparation_access(jsonb,uuid,uuid,uuid),private.domain_preparation_resolve(jsonb,uuid,uuid,uuid),private.domain_preparations_available(uuid,uuid,uuid) to service_role;
commit;
