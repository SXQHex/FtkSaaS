begin;
-- Legacy provider and phone-only wire validators stay unchanged.
create function private.crm_validate_contact_intake(body jsonb) returns jsonb language plpgsql security invoker set search_path='' as $validate$
declare phone text;proof jsonb:='[]';entry jsonb;part record;stamp timestamptz;
begin
 if jsonb_typeof(body) is distinct from 'object' or octet_length(body::text)>65536 then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_object_keys(body) k where k not in ('display_name','phone','email','interest','message','partner_name','mode','level','attribution','consents')) or jsonb_typeof(body->'display_name') is distinct from 'string' or not(body?'phone' or body?'email') then perform private.fail('VALIDATION_FAILED');end if;
 for part in select key,value from jsonb_each(body) loop
  if part.key in ('display_name','phone','email','interest','message','partner_name','mode','level') and (jsonb_typeof(part.value) is distinct from 'string' or length(part.value#>>'{}')>case part.key when 'display_name' then 200 when 'phone' then 40 when 'email' then 320 when 'interest' then 1000 when 'message' then 10000 else 200 end) then perform private.fail('VALIDATION_FAILED');end if;
 end loop;
 if body?'phone' and length(body->>'phone')<7 or body ? 'interest' and length(body->>'interest')=0 then perform private.fail('VALIDATION_FAILED');end if;
 if body ? 'attribution' then
  if jsonb_typeof(body->'attribution') is distinct from 'object' then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_each(body->'attribution') x where x.key not in ('campaign_id','ad_id','utm_source','utm_medium','utm_campaign','utm_term','utm_content','page_url') or jsonb_typeof(x.value) is distinct from 'string' or length(x.value#>>'{}')>2048) then perform private.fail('VALIDATION_FAILED');end if;
 end if;
 if body?'phone' then phone:=private.crm_normalize_phone(body->>'phone');body:=jsonb_set(body,'{phone}',to_jsonb(phone));end if;
 if body?'email' then body:=jsonb_set(body,'{email}',to_jsonb(lower(btrim(body->>'email'))));end if;
 if length(btrim(coalesce(body->>'display_name','')))=0 or length(body->>'display_name')>200 or jsonb_typeof(body->'consents') is distinct from 'array' or jsonb_array_length(body->'consents')>20 then perform private.fail('VALIDATION_FAILED');end if;
 if body->>'email' is not null and (length(body->>'email')>320 or (body->>'email') collate "C" !~* $email$^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$$email$) then perform private.fail('VALIDATION_FAILED');end if;
 for entry in select value from jsonb_array_elements(body->'consents') loop
  if jsonb_typeof(entry) is distinct from 'object' or length(btrim(coalesce(entry->>'purpose','')))=0 or length(btrim(coalesce(entry->>'version','')))=0 or jsonb_typeof(entry->'accepted') is distinct from 'boolean' or entry->>'occurred_at' is null then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_object_keys(entry) k where k not in ('purpose','accepted','version','occurred_at')) or jsonb_typeof(entry->'purpose') is distinct from 'string' or length(entry->>'purpose')>100 or jsonb_typeof(entry->'version') is distinct from 'string' or length(entry->>'version')>200 or jsonb_typeof(entry->'occurred_at') is distinct from 'string' or entry->>'occurred_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt ][0-9]{2}:[0-9]{2}:[0-5][0-9](\.[0-9]+)?([Zz]|[+-][0-9]{2}:[0-9]{2})$' then perform private.fail('VALIDATION_FAILED');end if;
  begin stamp:=(entry->>'occurred_at')::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then perform private.fail('VALIDATION_FAILED');end;
  if not isfinite(stamp) or stamp>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_array_elements(proof) x where x->>'purpose'=entry->>'purpose') then perform private.fail('VALIDATION_FAILED');end if;
  proof:=proof||jsonb_build_array(entry);
 end loop;
 return jsonb_set(body,'{consents}',proof);
exception when others then if SQLSTATE='P0001' then raise;end if;perform private.fail('VALIDATION_FAILED');
end$validate$;
alter table core.public_applications add column if not exists intake_format text not null default 'phone' check(intake_format in ('phone','contact'));
alter table core.public_applications add column if not exists form_rules_snapshot jsonb;
create function private.crm_form_rules(org uuid,form uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce((select r from private.frontend_settings s cross join lateral jsonb_array_elements(coalesce(s.values->'application_form_rules','[]')) r where s.scope_key='organization:'||org and (r->>'form_id')::uuid=form),'{"contact_requirement":"phone","required_fields":[]}'::jsonb)
$$;
create function private.crm_form_rules_patch(r jsonb,patch jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare entry jsonb;prior jsonb;org uuid:=(r->>'org_id')::uuid;
begin
 if not patch?'application_form_rules' then return;end if;
 if r->>'scope'<>'organization' then perform private.fail('FORBIDDEN');end if;
 if (select count(*)<>count(distinct (value->>'form_id')::uuid) from jsonb_array_elements(patch->'application_form_rules')) then perform private.fail('VALIDATION_FAILED');end if;
 for entry in select * from jsonb_array_elements(patch->'application_form_rules') loop
  prior:=private.crm_form_rules(org,(entry->>'form_id')::uuid);
  if not exists(select 1 from private.crm_intake_forms f where f.org_id=org and f.id=(entry->>'form_id')::uuid and f.channel='web_form' and (f.enabled or prior=entry)) then perform private.fail('NOT_FOUND');end if;
 end loop;
end$$;
create function private.crm_form_target(body jsonb,rules jsonb) returns text language plpgsql stable security invoker set search_path='' as $$
declare required text;
begin
 if rules->>'contact_requirement'='phone' and body->>'phone' is null or rules->>'contact_requirement'='email' and body->>'email' is null then perform private.fail('VALIDATION_FAILED');end if;
 for required in select jsonb_array_elements_text(rules->'required_fields') loop
  if btrim(coalesce(body->>required,''))='' then perform private.fail('VALIDATION_FAILED');end if;
 end loop;
 return case when rules->>'contact_requirement'='phone' then 'phone' when body->>'email' is not null then 'email' else 'phone' end;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.crm_intake_submit(jsonb,uuid[],jsonb)'::regprocedure);
 a:='phone text;body jsonb:=r->''intake'';';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form contact declaration drift';end if;
 b:=replace(b,a,'target_contact text;contact_kind text;rules jsonb;body jsonb:=coalesce(r->''contact_intake'',r->''intake'');');
 a:='body:=private.crm_validate_intake(body);phone:=body->>''phone'';proof:=body->''consents'';';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form contact validation drift';end if;
 b:=replace(b,a,'if r?''contact_intake'' then body:=private.crm_validate_contact_intake(body);else body:=private.crm_validate_intake(body);end if;proof:=body->''consents'';');
 a:=' if ip_hash is null or ip_hash';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form contact quota drift';end if;
 b:=replace(b,a,$a$ rules:=private.crm_form_rules(org,f.id);contact_kind:=private.crm_form_target(body,rules);target_contact:=body->>contact_kind;
 if aux?'target_hashes' then
  aux:=jsonb_set(aux,'{target_hash}',coalesce(aux#>array['target_hashes',contact_kind],'null'::jsonb));
 elsif contact_kind<>'phone' then perform private.fail('SERVICE_UNAVAILABLE');end if;
$a$||a);
 a:='crm_form_id,target_contact,target_hash,state';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form intake snapshot columns drift';end if;
 b:=replace(b,a,'crm_form_id,intake_format,form_rules_snapshot,target_contact,target_hash,state');
 a:='values(app_id,org,c,f.id,phone,v_target_hash';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form intake snapshot values drift';end if;
 execute replace(b,a,'values(app_id,org,c,f.id,case when r?''contact_intake'' then ''contact'' else ''phone'' end,rules,target_contact,v_target_hash');
 b:=pg_get_functiondef('private.crm_application_review(jsonb,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:='   insert into core.person_contacts(id,org_id,person_id,kind,value) values(private.new_id(ids,25),org,target,''phone'',app.intake->>''phone'');';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form candidate optional phone drift';end if;
 execute replace(b,a,'   if app.intake->>''phone'' is not null then '||ltrim(a)||'end if;');
 b:=pg_get_functiondef('private.crm_application_page(jsonb,uuid,uuid,uuid)'::regprocedure);
 a:='''source'',a.source_snapshot,''intake'',a.intake';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form contact inbox projection drift';end if;
 b:=replace(b,a,'''source'',a.source_snapshot');
 a:='''routing_history'',a.routing_history)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form inbox opt-in compatibility drift';end if;
 execute replace(b,a,'''routing_history'',a.routing_history)||case when a.intake_format=''phone'' then jsonb_build_object(''intake'',a.intake) when coalesce((k->>''include_contact_intake'')::boolean,false) then jsonb_build_object(''contact_intake'',a.intake) else ''{}''::jsonb end');
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:='perform private.pro_preparation_patch(r,patch);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form rules settings validation drift';end if;
 execute replace(b,a,a||'perform private.crm_form_rules_patch(r,patch);');
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);
 a:=' for key in select jsonb_array_elements_text(keys) loop';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form rules field authority drift';end if;
 execute replace(b,a,a||' if key=''application_form_rules'' then perform private.require_feature(org,''F21'');perform private.require_feature(org,''F25'');end if;');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''writable'',';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Form rules availability descriptor drift';end if;
 execute replace(b,a,a||'(f->>''key''<>''application_form_rules'' or private.pro_preparation_licensed(org,''crm'')) and ');
end$patch$;
revoke all on function private.crm_validate_contact_intake(jsonb),private.crm_form_rules(uuid,uuid),private.crm_form_rules_patch(jsonb,jsonb),private.crm_form_target(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.crm_validate_contact_intake(jsonb),private.crm_form_rules(uuid,uuid),private.crm_form_rules_patch(jsonb,jsonb),private.crm_form_target(jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
