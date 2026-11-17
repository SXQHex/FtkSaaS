-- Public page forms are explicit settings bindings, never inferred from private
-- form inventory or publication availability. Legal text is existing catalog data.
begin;
create function private.public_form_source(binding jsonb,p_org uuid,p_center uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare f private.crm_intake_forms;t private.content_templates;entry jsonb;consents jsonb:='[]';rules jsonb;
begin
 if binding is null or binding='null'::jsonb then return null;end if;
 if private.current_plan_name(p_org) not in ('pro','business') or private.access_mode(p_org) not in ('normal','grace') then return null;end if;
 perform private.require_feature(p_org,'F21');perform private.require_feature(p_org,'F25');perform private.require_feature(p_org,'F30');
 if p_center is not null and not private.center_accessible(p_org,p_center) then return null;end if;
 select * into f from private.crm_intake_forms where id=(binding->>'form_id')::uuid and org_id=p_org and center_id is not distinct from p_center and channel='web_form' and enabled;
 if f.id is null then return null;end if;
 if jsonb_array_length(binding->'consents') not between 1 and 20 or exists(select 1 from jsonb_array_elements(binding->'consents') x group by x->>'purpose' having count(*)>1) then return null;end if;
 for entry in select * from jsonb_array_elements(binding->'consents') loop
  select * into t from private.content_templates c where c.id=(entry->>'content_template_id')::uuid and c.org_id=p_org
   and (c.center_id is null or c.center_id=p_center) and c.channel='document' and c.code like 'document.%' and c.state='published'
   and c.source_version=entry->>'version' and not exists(select 1 from private.content_retirements x where x.template_id=c.id)
   and not exists(select 1 from private.content_invalidations x where x.template_id=c.id);
  if t.id is null then return null;end if;
  consents:=consents||jsonb_build_array(jsonb_build_object('purpose',entry->'purpose','version',entry->'version','required',entry->'required',
   'content_template_id',t.id,'source_version',t.source_version,'content_hash',private.digital_document_hash(t.content),'content',t.content));
 end loop;
 rules:=private.crm_form_rules(p_org,f.id);
 return jsonb_build_object('form_id',f.id,'contact_requirement',rules->'contact_requirement','required_fields',rules->'required_fields','consents',consents);
exception when sqlstate 'P0001' then
 if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','FORBIDDEN','NOT_FOUND') then return null;end if;raise;
end$$;
create function private.public_form_binding_validate(r jsonb,patch jsonb,actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare org uuid:=(r->>'org_id')::uuid;center uuid:=case when r->>'scope'='center' then (r->>'center_id')::uuid else null end;
 binding jsonb:=patch->'public_application_form';other jsonb;
begin
 if not patch?'public_application_form' or binding='null'::jsonb then return;end if;
 perform private.p05_configuration(org,center,actor,case when center is null then '{"kind":"organization"}'::jsonb else jsonb_build_object('kind','center','center_id',center) end);
 if private.public_form_source(binding,org,center) is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 -- One form is one consent source; another page cannot silently redefine it.
 if exists(select 1 from private.frontend_settings s where s.scope_key<>case when center is null then 'organization:'||org else 'center:'||org||':'||center end
  and s.values#>>'{public_application_form,form_id}'=binding->>'form_id' and s.values#>'{public_application_form,consents}' is distinct from binding->'consents') then perform private.fail('INVALID_STATE_TRANSITION');end if;
end$$;
create function private.public_form_discovery(p_org uuid,p_center uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare binding jsonb;source jsonb;
begin
 select values->'public_application_form' into binding from private.frontend_settings where scope_key=case when p_center is null then 'organization:'||p_org else 'center:'||p_org||':'||p_center end;
 if binding is null or binding='null'::jsonb then return jsonb_build_object('state','closed','form',null);end if;
 source:=private.public_form_source(binding,p_org,p_center);
 return jsonb_build_object('state',case when source is null then 'unavailable' else 'open' end,'form',source);
end$$;
create function private.public_form_consent_evidence(p_org uuid,form uuid,proof jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare s private.frontend_settings;source jsonb;entry jsonb;actual jsonb;evidence jsonb:='[]';
begin
 select * into s from private.frontend_settings f where (f.scope_key='organization:'||p_org or f.scope_key like 'center:'||p_org||':%') and f.values#>>'{public_application_form,form_id}'=form::text order by f.scope_key limit 1;
 if not found then return '{}'::jsonb;end if;
 source:=private.public_form_source(s.values->'public_application_form',p_org,(select center_id from private.crm_intake_forms where id=form and org_id=p_org));
 if source is null then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if exists(select 1 from jsonb_array_elements(proof) x where not exists(select 1 from jsonb_array_elements(source->'consents') y where y->>'purpose'=x->>'purpose' and y->>'version'=x->>'version')) then perform private.fail('VALIDATION_FAILED');end if;
 for entry in select * from jsonb_array_elements(source->'consents') loop
  select x into actual from jsonb_array_elements(proof) x where x->>'purpose'=entry->>'purpose' and x->>'version'=entry->>'version';
  if (entry->>'required')::bool and (actual is null or actual->>'accepted'<>'true') then perform private.fail('VALIDATION_FAILED');end if;
  if actual is not null then evidence:=evidence||jsonb_build_array(entry-'content'-'required');end if;
 end loop;
 return jsonb_build_object('public_consents',evidence);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);a:=' for key in select jsonb_array_elements_text(keys) loop';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public form field authority drift';end if;
 b:=replace(b,a,a||$a$ if key='public_application_form' then
  if private.current_plan_name(org) not in ('pro','business') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  perform private.require_feature(org,'F21');perform private.require_feature(org,'F25');perform private.require_feature(org,'F30');end if;
$a$);execute b;
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);a:='perform private.crm_form_rules_patch(r,patch);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public form binding write drift';end if;
 execute replace(b,a,a||'perform private.public_form_binding_validate(r,patch,person);');
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a:=' -- Central permission mapping;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public form binding replay drift';end if;
 execute replace(b,a,$a$ if p_operation='settings_update_v1' and r#>'{patch,public_application_form}' is not null then
  perform private.public_form_binding_validate(r,r->'patch',person);
 end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);a:='''catalog_version'',23';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public form catalog version drift';end if;
 execute replace(b,a,'''catalog_version'',24');
 b:=pg_get_functiondef('private.crm_intake_submit(jsonb,uuid[],jsonb)'::regprocedure);a:=' rules:=private.crm_form_rules(org,f.id);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Public consent admission drift';end if;
 execute replace(b,a,$a$ source:=source||private.public_form_consent_evidence(org,f.id,proof);
$a$||a);
end$patch$;
revoke all on function private.public_form_source(jsonb,uuid,uuid),private.public_form_binding_validate(jsonb,jsonb,uuid),private.public_form_discovery(uuid,uuid),private.public_form_consent_evidence(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.public_form_source(jsonb,uuid,uuid),private.public_form_binding_validate(jsonb,jsonb,uuid),private.public_form_discovery(uuid,uuid),private.public_form_consent_evidence(uuid,uuid,jsonb) to service_role;
commit;
