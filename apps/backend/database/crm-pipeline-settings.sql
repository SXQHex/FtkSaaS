begin;
create function private.crm_pipeline_schema(name text) returns jsonb language sql immutable security invoker set search_path='' as $schema$ select '{"CrmPipelineConfiguration":{"type":"object","properties":{"stages":{"type":"array","maxItems":50,"items":{"$ref":"#/$defs/CrmPipelineStage"},"minItems":3},"tags":{"type":"array","maxItems":100,"items":{"$ref":"#/$defs/CrmTag"}},"allow_center_tags":{"type":"boolean"},"followup_days":{"anyOf":[{"type":"integer","enum":[1,3,7]},{"type":"null"}]}},"required":["stages","tags","allow_center_tags","followup_days"],"additionalProperties":false},"CrmPipelineStage":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9_]{0,63}$","maxLength":64},"name":{"type":"string","minLength":1,"maxLength":100},"kind":{"type":"string","enum":["open","won","lost"]}},"required":["key","name","kind"],"additionalProperties":false},"CrmTag":{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9_]{0,63}$","maxLength":64},"name":{"type":"string","minLength":1,"maxLength":100}},"required":["key","name"],"additionalProperties":false},"CrmLossReason":{"type":"string","enum":["unreachable","timing","price","alternative","other"]},"LeadPipelineInput":{"type":"object","properties":{"stage_key":{"type":"string","pattern":"^[a-z][a-z0-9_]{0,63}$","maxLength":64},"tag_keys":{"type":"array","maxItems":100,"items":{"type":"string","pattern":"^[a-z][a-z0-9_]{0,63}$","maxLength":64},"uniqueItems":true},"loss_reason":{"anyOf":[{"$ref":"#/$defs/CrmLossReason"},{"type":"null"}]}},"required":["stage_key","tag_keys","loss_reason"],"additionalProperties":false,"x-invariant":"stage_key resolves from the current organization catalog; lost requires one loss_reason; other kinds require null. Stage/tag changes do not activate students, sell products, collect money or grant consent."}}'::jsonb->$1 $schema$;
-- Pipeline progress is separate from student conversion and financial state.
alter table core.leads add column if not exists pipeline jsonb;
alter table core.leads add constraint lead_pipeline_shape check(pipeline is null or
 (jsonb_typeof(pipeline)='object' and pipeline ?& array['stage','tags','loss_reason']));
create function private.crm_pipeline_catalog(org uuid,center uuid default null) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare config jsonb;local_tags jsonb;
begin
 config:=coalesce((select values->'crm_pipeline' from private.frontend_settings where scope_key='organization:'||org),private.frontend_settings_defaults('organization')->'crm_pipeline');
 if center is not null and coalesce((config->>'allow_center_tags')::boolean,false) then
  select values->'crm_local_tags' into local_tags from private.frontend_settings where scope_key='center:'||org||':'||center;
  config:=jsonb_set(config,'{tags}',config->'tags'||coalesce(local_tags,'[]'));
 end if;
 return config;
end$$;
create function private.crm_pipeline_feature(org uuid) returns void
 language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(private.current_plan_name(org),'') not in ('pro','business') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 perform private.require_feature(org,'F21');
end$$;
create function private.crm_pipeline_patch(r jsonb,patch jsonb) returns void
 language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(r->>'org_id')::uuid;center uuid:=(r->>'center_id')::uuid;config jsonb;tags jsonb;
begin
 if not(patch ?| array['crm_pipeline','crm_local_tags']) then return;end if;
 perform private.crm_pipeline_feature(org);
 config:=coalesce(patch->'crm_pipeline',private.crm_pipeline_catalog(org));
 tags:=coalesce(patch->'crm_local_tags','[]');
 if patch?'crm_pipeline' then
  if r->>'scope'<>'organization' or not private.frontend_setting_valid(config,private.crm_pipeline_schema('CrmPipelineConfiguration')) then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from jsonb_array_elements(config->'stages') x group by x->>'key' having count(*)>1)
   or exists(select 1 from jsonb_array_elements(config->'tags') x group by x->>'key' having count(*)>1)
   or exists(select 1 from jsonb_array_elements(config->'stages') x where btrim(x->>'name')='')
   or exists(select 1 from jsonb_array_elements(config->'tags') x where btrim(x->>'name')='')
   or exists(select 1 from private.frontend_settings f where f.scope='center' and f.scope_key like 'center:'||org||':%' and jsonb_array_length(coalesce(f.values->'crm_local_tags','[]'))+jsonb_array_length(config->'tags')>100)
   or (select count(*) from jsonb_array_elements(config->'stages') x where x->>'kind'='won')<>1
   or (select count(*) from jsonb_array_elements(config->'stages') x where x->>'kind'='lost')<>1
   or not exists(select 1 from jsonb_array_elements(config->'stages') x where x->>'kind'='open') then perform private.fail('VALIDATION_FAILED');end if;
  -- Live records must be explicitly remapped before removing their stage/tag or
  -- changing its semantic kind. Immutable audit and converted history remain.
  if exists(select 1 from core.leads l where l.org_id=org and l.state='open' and l.pipeline is not null and
   (not exists(select 1 from jsonb_array_elements(config->'stages') s where s->>'key'=l.pipeline#>>'{stage,key}' and s->>'kind'=l.pipeline#>>'{stage,kind}')
    or exists(select 1 from jsonb_array_elements(l.pipeline->'tags') t where
     not exists(select 1 from jsonb_array_elements(config->'tags') x where x->>'key'=t->>'key') and
     not ((config->>'allow_center_tags')::boolean and exists(select 1 from private.frontend_settings f,jsonb_array_elements(coalesce(f.values->'crm_local_tags','[]')) x where f.scope_key='center:'||org||':'||l.center_id and x->>'key'=t->>'key'))))) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if exists(select 1 from private.frontend_settings f,jsonb_array_elements(coalesce(f.values->'crm_local_tags','[]')) t
   where f.scope='center' and f.scope_key like 'center:'||org||':%' and exists(select 1 from jsonb_array_elements(config->'tags') x where x->>'key'=t->>'key')) then perform private.fail('VALIDATION_FAILED');end if;
 end if;
 if patch?'crm_local_tags' then
  if r->>'scope'<>'center' or not coalesce((config->>'allow_center_tags')::boolean,false) then perform private.fail('FORBIDDEN');end if;
  if not private.frontend_setting_valid(tags,(select f->'schema' from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'='center' and f->>'key'='crm_local_tags'))
   or jsonb_array_length(config->'tags')+jsonb_array_length(tags)>100
   or exists(select 1 from jsonb_array_elements(tags) x group by x->>'key' having count(*)>1)
   or exists(select 1 from jsonb_array_elements(tags) x where btrim(x->>'name')='' or exists(select 1 from jsonb_array_elements(config->'tags') y where y->>'key'=x->>'key')) then perform private.fail('VALIDATION_FAILED');end if;
  if exists(select 1 from core.leads l,jsonb_array_elements(l.pipeline->'tags') t where l.org_id=org and l.center_id=center and l.state='open'
   and not exists(select 1 from jsonb_array_elements(config->'tags'||tags) x where x->>'key'=t->>'key')) then perform private.fail('INVALID_STATE_TRANSITION');end if;
 end if;
end$$;
create function private.crm_pipeline_resolve(org uuid,center uuid,input jsonb) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare config jsonb;stage jsonb;tags jsonb;
begin
 perform private.crm_pipeline_feature(org);
 if not private.frontend_setting_valid(input,private.crm_pipeline_schema('LeadPipelineInput')) then perform private.fail('VALIDATION_FAILED');end if;
 config:=private.crm_pipeline_catalog(org,center);
 select s into stage from jsonb_array_elements(config->'stages') s where s->>'key'=input->>'stage_key';
 if stage is null then perform private.fail('NOT_FOUND');end if;
 if (stage->>'kind'='lost') is distinct from (input->>'loss_reason' is not null) then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_array_elements_text(input->'tag_keys') k where not exists(select 1 from jsonb_array_elements(config->'tags') t where t->>'key'=k)) then perform private.fail('NOT_FOUND');end if;
 select coalesce(jsonb_agg(t order by n),'[]') into tags from jsonb_array_elements(config->'tags') with ordinality x(t,n) where input->'tag_keys' ? (t->>'key');
 return jsonb_build_object('stage',stage,'tags',tags,'loss_reason',input->'loss_reason');
end$$;
create function private.crm_pipeline_view(l core.leads) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare config jsonb;stage jsonb;tags jsonb;
begin
 if l.pipeline is null then return null;end if;
 if l.state<>'open' then return l.pipeline;end if;
 config:=private.crm_pipeline_catalog(l.org_id,l.center_id);
 select coalesce((select s from jsonb_array_elements(config->'stages') s where s->>'key'=l.pipeline#>>'{stage,key}'),l.pipeline->'stage') into stage;
 select coalesce(jsonb_agg(coalesce((select t from jsonb_array_elements(config->'tags') t where t->>'key'=old->>'key'),old) order by n),'[]') into tags
 from jsonb_array_elements(l.pipeline->'tags') with ordinality x(old,n);
 return jsonb_build_object('stage',stage,'tags',tags,'loss_reason',l.pipeline->'loss_reason');
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_setting_valid(jsonb,jsonb)'::regprocedure);a:=$a$ if s->>'$ref'='#/$defs/FtkUuid' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM schema validation drift';end if;
 execute replace(b,a,$a$ if s->>'$ref' in ('#/$defs/CrmPipelineConfiguration','#/$defs/CrmPipelineStage','#/$defs/CrmTag','#/$defs/CrmLossReason','#/$defs/LeadPipelineInput') then return private.frontend_setting_valid(v,private.crm_pipeline_schema(split_part(s->>'$ref','/',3)));end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);a:='perform private.pro_preparation_patch(r,patch);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM settings mutation drift';end if;
 execute replace(b,a,a||'perform private.crm_pipeline_patch(r,patch);');
 b:=pg_get_functiondef('private.frontend_settings_field_access(text,jsonb,uuid,uuid)'::regprocedure);a:='  if key=''permission_templates'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM settings replay authority drift';end if;
 execute replace(b,a,$a$  if key in ('crm_pipeline','crm_local_tags') then
   perform private.crm_pipeline_feature(org);
   if key='crm_local_tags' and not coalesce((private.crm_pipeline_catalog(org)->>'allow_center_tags')::boolean,false) then perform private.fail('FORBIDDEN');end if;
  end if;
$a$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);a:='''catalog_version'',18';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM settings catalog version drift';end if;
 b:=replace(b,a,'''catalog_version'',19');
 a:='''writable'',';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM catalog capability drift';end if;
 execute replace(b,a,a||$a$(f->>'key' not in ('crm_pipeline','crm_local_tags') or coalesce(private.current_plan_name(org),'') in ('pro','business')) and (f->>'key'<>'crm_local_tags' or coalesce((private.crm_pipeline_catalog(org)->>'allow_center_tags')::boolean,false)) and $a$);
 b:=pg_get_functiondef('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:=' elsif op=''crm_activity_save_v1'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM lead writer drift';end if;
 execute replace(b,a,$a$  if r?'pipeline' then
   update core.leads set pipeline=private.crm_pipeline_resolve(org,center,r->'pipeline') where id=pid and org_id=org and center_id=center;
  end if;
$a$||a);
 b:=pg_get_functiondef('private.p04_lead_view(core.leads,timestamp with time zone)'::regprocedure);a:='select jsonb_build_object(';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM lead view drift';end if;
 execute replace(b,a,'select jsonb_build_object(''pipeline'',private.crm_pipeline_view(l))||jsonb_build_object(');
 b:=pg_get_functiondef('private.p04_leads_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 a:=' return jsonb_build_object(''items'',items,''next_cursor'',token,''as_of'',asof);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM opt-in page drift';end if;
 b:=replace(b,a,$a$ return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof)||case when coalesce((r->>'include_pipeline')::boolean,false) then jsonb_build_object('pipeline_catalog',private.crm_pipeline_catalog(org,center)) else '{}'::jsonb end;$a$);
 a:=$a$x-'_at' order by n$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM legacy page shape drift';end if;
 execute replace(b,a,$a$(x-'_at')-case when coalesce((r->>'include_pipeline')::boolean,false) then '' else 'pipeline' end order by n$a$);
 b:=pg_get_functiondef('private.p04_management(jsonb,uuid,uuid,uuid)'::regprocedure);a:='''assigned_to'',l.assigned_person_id) vals';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM management pipeline drift';end if;
 execute replace(b,a,$a$'assigned_to',l.assigned_person_id,'pipeline',case when l.pipeline is null then null else jsonb_build_object('stage_key',l.pipeline#>>'{stage,key}','tag_keys',coalesce((select jsonb_agg(t->'key') from jsonb_array_elements(l.pipeline->'tags') t),'[]'),'loss_reason',l.pipeline->'loss_reason') end) vals$a$);
 -- Resolve on every command before receipt replay; a previous key cannot use a
 -- removed stage, tag, local permission or paid-plan feature.
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a:=E' if mutable then\n  payload_digest:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM live replay gate drift';end if;
 b:=replace(b,a,$a$ if p_operation='lead_save_v1' and r?'pipeline' then
  perform private.crm_pipeline_resolve(org,center,r->'pipeline');
  audit_delta:=jsonb_build_object('pipeline_before',(select pipeline from core.leads where org_id=org and id=(r->>'lead_id')::uuid));
 end if;
 if p_operation='leads_list_v1' and coalesce((r->>'include_pipeline')::boolean,false) then perform private.crm_pipeline_feature(org);end if;
$a$||a);
 a:=' if out is null then out:=jsonb_build_object(''operation_id''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'CRM pipeline audit drift';end if;
 execute replace(b,a,$a$ if p_operation='lead_save_v1' and r?'pipeline' then
  audit_delta:=audit_delta||jsonb_build_object('pipeline_after',(select pipeline from core.leads where org_id=org and id=record_id));
 end if;
$a$||a);
end$patch$;
revoke all on function private.crm_pipeline_schema(text),private.crm_pipeline_catalog(uuid,uuid),private.crm_pipeline_feature(uuid),private.crm_pipeline_patch(jsonb,jsonb),private.crm_pipeline_resolve(uuid,uuid,jsonb),private.crm_pipeline_view(core.leads) from public,anon,authenticated;
grant execute on function private.crm_pipeline_schema(text),private.crm_pipeline_catalog(uuid,uuid),private.crm_pipeline_feature(uuid),private.crm_pipeline_patch(jsonb,jsonb),private.crm_pipeline_resolve(uuid,uuid,jsonb),private.crm_pipeline_view(core.leads) to service_role;
notify pgrst,'reload schema';
commit;
