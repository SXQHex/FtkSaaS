begin;
create or replace function private.frontend_settings_fields() returns jsonb language sql immutable security invoker set search_path='' as $fields$select '[{"scope":"user","key":"honorific","schema":{"type":"string","maxLength":100},"default":"","group":"S01","consumer":"frontend"},{"scope":"user","key":"language","schema":{"type":"string","enum":["auto","tr","en"]},"default":"auto","group":"S07","consumer":"frontend"},{"scope":"user","key":"date_format","schema":{"type":"string","enum":["dd.MM.yyyy"]},"default":"dd.MM.yyyy","group":"S07","consumer":"frontend"},{"scope":"user","key":"time_format","schema":{"type":"string","enum":["12","24"]},"default":"24","group":"S07","consumer":"frontend"},{"scope":"user","key":"number_format","schema":{"type":"string","enum":["tr-TR","en-US"]},"default":"tr-TR","group":"S07","consumer":"frontend"},{"scope":"user","key":"week_start","schema":{"type":"string","enum":["monday","sunday"]},"default":"monday","group":"S07","consumer":"frontend"},{"scope":"user","key":"timezone_mode","schema":{"type":"string","enum":["auto","manual"]},"default":"auto","group":"S07","consumer":"frontend"},{"scope":"user","key":"theme","schema":{"type":"string","enum":["light","dark","system"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"contrast","schema":{"type":"string","enum":["system","high"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"motion","schema":{"type":"string","enum":["system","reduced"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"remember_context","schema":{"type":"boolean"},"default":true,"group":"S09","consumer":"frontend"},{"scope":"user","key":"calendar_view","schema":{"type":"string","enum":["day","week","month","agenda"]},"default":"week","group":"S10","consumer":"frontend"},{"scope":"user","key":"show_weekends","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"frontend"},{"scope":"user","key":"marketing_in_app","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"frontend"},{"scope":"user","key":"ad_personalization","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"ad_measurement","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"optional_analytics","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"timezone_name","schema":{"anyOf":[{"type":"string","maxLength":100},{"type":"null"}]},"default":null,"group":"S07","consumer":"frontend"},{"scope":"member","key":"profile_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"photo_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"email_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"phone_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"history_recommendations","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"frontend"},{"scope":"member","key":"interest_center_ids","schema":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"},"maxItems":100,"uniqueItems":true},"default":[],"group":"S14","consumer":"frontend"},{"scope":"member","key":"interest_discipline_ids","schema":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"},"maxItems":100,"uniqueItems":true},"default":[],"group":"S14","consumer":"frontend"},{"scope":"member","key":"in_app_reminders","schema":{"type":"boolean"},"default":true,"group":"S12","consumer":"p05_optional_allowed"},{"scope":"member","key":"in_app_marketing","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"p05_optional_allowed"},{"scope":"center","key":"description","schema":{"type":"string","maxLength":3000},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"address","schema":{"type":"string","maxLength":1000},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"contact_phone","schema":{"type":"string","maxLength":100},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"contact_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"M01","consumer":"frontend"},{"scope":"organization","key":"description","schema":{"type":"string","maxLength":3000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"address","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"contact_phone","schema":{"type":"string","maxLength":100},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"contact_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"theme_package_id","schema":{"type":"null"},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"font_package_id","schema":{"type":"null"},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_name","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_address","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"platform","key":"application_name","schema":{"type":"string","minLength":1,"maxLength":100},"default":"FtkSaaS","group":"P01","consumer":"frontend"},{"scope":"platform","key":"support_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"P01","consumer":"frontend"},{"scope":"platform","key":"support_url","schema":{"anyOf":[{"type":"string","format":"uri","pattern":"^https://","maxLength":2000},{"type":"null"}]},"default":null,"group":"P01","consumer":"frontend"},{"scope":"platform","key":"maintenance_message","schema":{"type":"string","maxLength":3000},"default":"","group":"P01","consumer":"frontend"},{"scope":"user","key":"font_scale","schema":{"anyOf":[{"type":"number","minimum":0.75,"maximum":2},{"type":"null"}]},"default":null,"group":"S08","consumer":"frontend"},{"scope":"user","key":"startup_context","schema":{"anyOf":[{"type":"object","properties":{"org_id":{"$ref":"#/$defs/FtkUuid"},"center_id":{"anyOf":[{"$ref":"#/$defs/FtkUuid"},{"type":"null"}]},"discipline_id":{"anyOf":[{"$ref":"#/$defs/FtkUuid"},{"type":"null"}]}},"required":["org_id","center_id","discipline_id"],"additionalProperties":false},{"type":"null"}]},"default":null,"group":"S09","consumer":"frontend"},{"scope":"organization","key":"program_duration_minutes","schema":{"type":"integer","minimum":1,"maximum":2147483647},"default":60,"group":"O18","consumer":"new_center_copy"},{"scope":"center","key":"program_duration_minutes","schema":{"type":"integer","minimum":1,"maximum":2147483647},"default":60,"group":"M06","consumer":"schedule_build_program"},{"scope":"member","key":"report_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"report":{"type":"string","enum":["collections_debts","lesson_attendance"]},"filters":{"type":"object","properties":{"interval":{"type":"object","properties":{"starts_at":{"type":"string","format":"date-time"},"ends_at":{"type":"string","format":"date-time"}},"required":["starts_at","ends_at"],"additionalProperties":false,"x-invariant":"starts_at < ends_at; [start,end)"},"center_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"person_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"currency":{"anyOf":[{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},{"type":"null"}]},"state":{"anyOf":[{"type":"string"},{"type":"null"}]}},"required":["interval","center_ids"],"additionalProperties":false},"columns":{"type":"array","items":{"type":"string","enum":["group_key","center_id","person_id","currency","count","amount_minor","credits","ratio_bps","basis_count"]},"minItems":1,"maxItems":9,"uniqueItems":true},"report_order":{"type":"string","enum":["group_key_asc","group_key_desc"]},"group_by":{"type":"string","enum":["person","center","total"]}},"required":["key","name","report","filters","columns","report_order","group_by"],"additionalProperties":false}},"default":[],"group":"S10","consumer":"p06_report_prepare"},{"scope":"member","key":"import_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"center_id":{"$ref":"#/$defs/FtkUuid"},"mapping":{"type":"object","properties":{"columns":{"type":"array","items":{"type":"object","properties":{"source_column":{"type":"string"},"target":{"type":"string","enum":["display_name","email","phone","source_key","person_ref","opening_credits","opening_debt_minor","currency","product_version_ref","start_date","end_date","opening_credit_value_minor"]}},"required":["source_column","target"],"additionalProperties":false}},"delimiter":{"type":"string","enum":[",",";"]}},"required":["columns","delimiter"],"additionalProperties":false,"x-invariant":"unique targets except contacts, permanent source_key required; existing person only explicit person_ref, never email auto merge"},"source_namespace":{"type":"string"}},"required":["key","name","center_id","mapping","source_namespace"],"additionalProperties":false}},"default":[],"group":"S10","consumer":"p06_import_prepare"},{"scope":"center","key":"report_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"report":{"type":"string","enum":["collections_debts","lesson_attendance"]},"filters":{"type":"object","properties":{"interval":{"type":"object","properties":{"starts_at":{"type":"string","format":"date-time"},"ends_at":{"type":"string","format":"date-time"}},"required":["starts_at","ends_at"],"additionalProperties":false,"x-invariant":"starts_at < ends_at; [start,end)"},"center_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"person_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"currency":{"anyOf":[{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},{"type":"null"}]},"state":{"anyOf":[{"type":"string"},{"type":"null"}]}},"required":["interval","center_ids"],"additionalProperties":false},"columns":{"type":"array","items":{"type":"string","enum":["group_key","center_id","person_id","currency","count","amount_minor","credits","ratio_bps","basis_count"]},"minItems":1,"maxItems":9,"uniqueItems":true},"report_order":{"type":"string","enum":["group_key_asc","group_key_desc"]},"group_by":{"type":"string","enum":["person","center","total"]}},"required":["key","name","report","filters","columns","report_order","group_by"],"additionalProperties":false}},"default":[],"group":"M18","consumer":"p06_report_prepare"},{"scope":"center","key":"import_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"center_id":{"$ref":"#/$defs/FtkUuid"},"mapping":{"type":"object","properties":{"columns":{"type":"array","items":{"type":"object","properties":{"source_column":{"type":"string"},"target":{"type":"string","enum":["display_name","email","phone","source_key","person_ref","opening_credits","opening_debt_minor","currency","product_version_ref","start_date","end_date","opening_credit_value_minor"]}},"required":["source_column","target"],"additionalProperties":false}},"delimiter":{"type":"string","enum":[",",";"]}},"required":["columns","delimiter"],"additionalProperties":false,"x-invariant":"unique targets except contacts, permanent source_key required; existing person only explicit person_ref, never email auto merge"},"source_namespace":{"type":"string"}},"required":["key","name","center_id","mapping","source_namespace"],"additionalProperties":false}},"default":[],"group":"M19","consumer":"p06_import_prepare"},{"scope":"organization","key":"report_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"report":{"type":"string","enum":["collections_debts","lesson_attendance"]},"filters":{"type":"object","properties":{"interval":{"type":"object","properties":{"starts_at":{"type":"string","format":"date-time"},"ends_at":{"type":"string","format":"date-time"}},"required":["starts_at","ends_at"],"additionalProperties":false,"x-invariant":"starts_at < ends_at; [start,end)"},"center_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"person_ids":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"}},"currency":{"anyOf":[{"type":"string","pattern":"^[A-Z]{3}$","x-validation":"currency exponent from versioned server allowlist; unsupported rejected"},{"type":"null"}]},"state":{"anyOf":[{"type":"string"},{"type":"null"}]}},"required":["interval","center_ids"],"additionalProperties":false},"columns":{"type":"array","items":{"type":"string","enum":["group_key","center_id","person_id","currency","count","amount_minor","credits","ratio_bps","basis_count"]},"minItems":1,"maxItems":9,"uniqueItems":true},"report_order":{"type":"string","enum":["group_key_asc","group_key_desc"]},"group_by":{"type":"string","enum":["person","center","total"]}},"required":["key","name","report","filters","columns","report_order","group_by"],"additionalProperties":false}},"default":[],"group":"O14","consumer":"p06_report_prepare"},{"scope":"organization","key":"import_templates","schema":{"type":"array","maxItems":100,"items":{"type":"object","properties":{"key":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,64}$"},"name":{"type":"string","minLength":1,"maxLength":100},"center_id":{"$ref":"#/$defs/FtkUuid"},"mapping":{"type":"object","properties":{"columns":{"type":"array","items":{"type":"object","properties":{"source_column":{"type":"string"},"target":{"type":"string","enum":["display_name","email","phone","source_key","person_ref","opening_credits","opening_debt_minor","currency","product_version_ref","start_date","end_date","opening_credit_value_minor"]}},"required":["source_column","target"],"additionalProperties":false}},"delimiter":{"type":"string","enum":[",",";"]}},"required":["columns","delimiter"],"additionalProperties":false,"x-invariant":"unique targets except contacts, permanent source_key required; existing person only explicit person_ref, never email auto merge"},"source_namespace":{"type":"string"}},"required":["key","name","center_id","mapping","source_namespace"],"additionalProperties":false}},"default":[],"group":"O14","consumer":"p06_import_prepare"}]'::jsonb$fields$;
-- The catalog is fixed source, never a caller-provided schema. Structured
-- preparation fields use the same closed recursive subset as Edge validation.
create or replace function private.frontend_setting_valid(v jsonb,s jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;kind text:=s->>'type';txt text:=v#>>'{}';field record;needed text;
begin
 if s->>'$ref'='#/$defs/FtkUuid' then return jsonb_typeof(v)='string' and txt~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';end if;
 if s?'anyOf' then for item in select * from jsonb_array_elements(s->'anyOf') loop if private.frontend_setting_valid(v,item) then return true;end if;end loop;return false;end if;
 if kind='null' then return v='null';end if;
 if kind='integer' then if jsonb_typeof(v)<>'number' or txt::numeric<>trunc(txt::numeric) then return false;end if;
 elsif jsonb_typeof(v) is distinct from kind then return false;end if;
 if s?'enum' and not s->'enum' @> jsonb_build_array(v) then return false;end if;
 if kind='string' then
  if s?'maxLength' and length(txt)>(s->>'maxLength')::int or s?'minLength' and length(txt)<(s->>'minLength')::int then return false;end if;
  if s?'pattern' and txt!~(s->>'pattern') then return false;end if;
  if s->>'format'='email' and txt!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false;end if;
 elsif kind in ('integer','number') then
  if s?'minimum' and txt::numeric<(s->>'minimum')::numeric or s?'maximum' and txt::numeric>(s->>'maximum')::numeric then return false;end if;
 elsif kind='array' then
  if jsonb_array_length(v)>coalesce((s->>'maxItems')::int,100) or jsonb_array_length(v)<coalesce((s->>'minItems')::int,0) then return false;end if;
  if s->>'uniqueItems'='true' and (select count(*)<>count(distinct x) from jsonb_array_elements(v) x) then return false;end if;
  for item in select * from jsonb_array_elements(v) loop if not private.frontend_setting_valid(item,s->'items') then return false;end if;end loop;
 elsif kind='object' then
  for needed in select jsonb_array_elements_text(coalesce(s->'required','[]')) loop if not v?needed then return false;end if;end loop;
  for field in select * from jsonb_each(v) loop
   if not (s->'properties')?field.key then if s->>'additionalProperties'='false' then return false;end if;
   elsif not private.frontend_setting_valid(field.value,s#>array['properties',field.key]) then return false;end if;
  end loop;
 end if;
 return true;
end$$;
create function private.work_template_request(kind text,value jsonb,overrides jsonb,org uuid,center uuid,person uuid,configuration boolean default false) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare request jsonb;c uuid:=center;
begin
 if btrim(value->>'name')='' then perform private.fail('VALIDATION_FAILED');end if;
 if kind='report' then
  request:=jsonb_build_object('report',value->'report','filters',(value->'filters')||coalesce(overrides->'filters','{}'),
   'columns',coalesce(overrides->'columns',value->'columns'),'report_order',coalesce(overrides->'report_order',value->'report_order'),'group_by',coalesce(overrides->'group_by',value->'group_by'));
  if c is not null then request:=request||jsonb_build_object('center_id',c);end if;
  perform private.p06_report_scope(request,org,c,person);
 elsif kind='import' then
  if c is not null and c is distinct from (value->>'center_id')::uuid then perform private.fail('NOT_FOUND');end if;c:=(value->>'center_id')::uuid;
  request:=jsonb_build_object('center_id',c,'mapping',coalesce(overrides->'mapping',value->'mapping'),'source_namespace',coalesce(overrides->'source_namespace',value->'source_namespace'));
  if btrim(request->>'source_namespace')='' or not exists(select 1 from jsonb_array_elements(request#>'{mapping,columns}') x where x->>'target'='source_key') or not exists(select 1 from jsonb_array_elements(request#>'{mapping,columns}') x where x->>'target'='display_name')
   or exists(select 1 from jsonb_array_elements(request#>'{mapping,columns}') x group by x->>'source_column' having count(*)>1)
   or exists(select 1 from jsonb_array_elements(request#>'{mapping,columns}') x where x->>'target' not in ('email','phone') group by x->>'target' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
  if configuration then
   if not private.is_org_reader(org,person) then perform private.fail('FORBIDDEN');end if;
   perform private.require_feature(org,'F31');perform private.assert_center(org,c);
  else perform private.p06_import_access(org,c,person,false);end if;
 else perform private.fail('VALIDATION_FAILED');end if;
 return request;
end$$;
create function private.work_template_patch(r jsonb,patch jsonb,person uuid) returns void language plpgsql volatile security invoker set search_path='' as $$
declare field text;v jsonb;s jsonb;c uuid:=(r->>'center_id')::uuid;kind text;
begin
 foreach field in array array['report_templates','import_templates'] loop
  if not patch?field then continue;end if;
  select f->'schema' into s from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'=r->>'scope' and f->>'key'=field;
  if s is null or not private.frontend_setting_valid(patch->field,s) or (select count(*)<>count(distinct x->>'key') from jsonb_array_elements(patch->field) x) then perform private.fail('VALIDATION_FAILED');end if;
  kind:=case field when 'report_templates' then 'report' else 'import' end;
  for v in select * from jsonb_array_elements(patch->field) loop perform private.work_template_request(kind,v,'{}',(r->>'org_id')::uuid,c,person,r->>'scope'='organization');end loop;
 end loop;
end$$;
create function private.work_template_resolve(r jsonb,org uuid,account uuid,person uuid) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source jsonb:=r->'template';skey text;doc private.frontend_settings;value jsonb;c uuid:=(r->>'center_id')::uuid;request jsonb;
begin
 if source->>'scope'='member' then skey:='member:'||org||':'||account;
 elsif source->>'scope'='organization' then skey:='organization:'||org;
 elsif source->>'scope'='center' then
  if c is not null and c is distinct from (source->>'center_id')::uuid then perform private.fail('NOT_FOUND');end if;
  c:=(source->>'center_id')::uuid;perform private.assert_center(org,c);skey:='center:'||org||':'||c;source:=jsonb_set(source,'{center_id}',to_jsonb(c));
 else perform private.fail('VALIDATION_FAILED');end if;
 select * into doc from private.frontend_settings where scope_key=skey;
 select v into value from jsonb_array_elements(coalesce(doc.values->case r->>'kind' when 'report' then 'report_templates' when 'import' then 'import_templates' end,'[]')) v where v->>'key'=source->>'key';
 if value is null then perform private.fail('NOT_FOUND');end if;
 request:=private.work_template_request(r->>'kind',value,coalesce(r->'overrides','{}'),org,c,person);
 -- Authorize the actual prepared scope before exposing its version/state.
 if doc.version is distinct from (source->>'version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 return jsonb_build_object('kind',r->>'kind','source',source,'request',request);
end$$;
create function private.work_templates_available(org uuid,account uuid,person uuid,center uuid) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare skey text;doc private.frontend_settings;value jsonb;kind text;source jsonb;reports jsonb:='[]';imports jsonb:='[]';scope text;
begin
 if org is null or person is null or private.access_mode(org) not in ('normal','grace') then return jsonb_build_object('reports',reports,'imports',imports);end if;
 foreach scope in array array['member','center','organization'] loop
  if scope='center' and center is null then continue;end if;
  skey:=case scope when 'member' then 'member:'||org||':'||account when 'center' then 'center:'||org||':'||center else 'organization:'||org end;
  select * into doc from private.frontend_settings where scope_key=skey;
  foreach kind in array array['report','import'] loop
   for value in select * from jsonb_array_elements(coalesce(doc.values->case kind when 'report' then 'report_templates' else 'import_templates' end,'[]')) loop
    begin perform private.work_template_request(kind,value,'{}',org,center,person);exception when SQLSTATE 'P0001' then continue;end;
    source:=jsonb_build_object('scope',scope,'key',value->>'key','version',doc.version)||case when scope='center' then jsonb_build_object('center_id',center) else '{}'::jsonb end;
    if kind='report' then reports:=reports||jsonb_build_array(jsonb_build_object('source',source,'template',value));else imports:=imports||jsonb_build_array(jsonb_build_object('source',source,'template',value));end if;
   end loop;
  end loop;
 end loop;
 return jsonb_build_object('reports',reports,'imports',imports);
end$$;
create function private.work_report_rows(r jsonb,rows jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare grouping text:=coalesce(r->>'group_by','person');ordering text:=coalesce(r->>'report_order','group_key_asc');result jsonb:=rows;
begin
 if grouping not in ('person','center','total') or ordering not in ('group_key_asc','group_key_desc') then perform private.fail('VALIDATION_FAILED');end if;
 if grouping<>'person' then
  if r->>'report' not in ('collections_debts','lesson_attendance') then perform private.fail('VALIDATION_FAILED');end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('group_key',g.metric,'center_id',g.center,'currency',g.currency,'count',g.n,'amount_minor',g.amount::text,'credits',g.credits))),'[]') into result from (
   select x->>'group_key' metric,case when grouping='center' then x->>'center_id' end center,x->>'currency' currency,sum((x->>'count')::bigint)::bigint n,sum((x->>'amount_minor')::numeric) amount,sum((x->>'credits')::bigint)::bigint credits
   from jsonb_array_elements(rows) x group by x->>'group_key',case when grouping='center' then x->>'center_id' end,x->>'currency'
  ) g;
 end if;
 select coalesce(jsonb_agg(v order by case when ordering='group_key_desc' then v->>'group_key' end desc,case when ordering='group_key_asc' then v->>'group_key' end,v->>'center_id',v->>'person_id',v->>'currency'),'[]') into result from jsonb_array_elements(result) v;
 return result;
end$$;
create function private.work_report_csv(rows jsonb,columns jsonb,max_bytes bigint) returns bytea language plpgsql immutable security invoker set search_path='' as $$
declare body text;line text;item jsonb;field text;
begin
 if jsonb_typeof(columns)<>'array' or jsonb_array_length(columns)<1 or jsonb_array_length(columns)>9 or exists(select 1 from jsonb_array_elements_text(columns) c where c not in ('group_key','center_id','person_id','currency','count','amount_minor','credits','basis_count','ratio_bps')) then perform private.fail('VALIDATION_FAILED');end if;
 select string_agg(v,',' order by n)||E'\r\n' into body from jsonb_array_elements_text(columns) with ordinality c(v,n);
 for item in select * from jsonb_array_elements(rows) loop
  line:='';for field in select jsonb_array_elements_text(columns) loop line:=line||case when line='' then '' else ',' end||private.p06_csv_cell(item->>field);end loop;
  body:=body||line||E'\r\n';if octet_length(body)>max_bytes then perform private.fail('PLAN_LIMIT_REACHED');end if;
 end loop;
 if octet_length(body)>max_bytes then perform private.fail('PLAN_LIMIT_REACHED');end if;return convert_to(body,'UTF8');
end$$;
create function private.work_report_columns_page(page jsonb,columns jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select case when $2 is null then $1 else jsonb_set($1,'{items}',coalesce((
  select jsonb_agg((select jsonb_object_agg(k,v) from jsonb_each(item) e(k,v) where k='group_key' or $2?k) order by n)
  from jsonb_array_elements($1->'items') with ordinality entries(item,n)
 ),'[]'::jsonb)) end
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:=' for item in select * from jsonb_each(patch) loop';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work template field validation anchor drift';end if;
 execute replace(b,a,' perform private.work_template_patch(r,patch,person);'||E'\n'||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',3';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work template catalog version anchor drift';end if;b:=replace(b,a,'''catalog_version'',4');
 a:='''brand_packages'',''[]''::jsonb';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work template catalog availability anchor drift';end if;
 execute replace(b,a,'''work_templates'',private.work_templates_available(org,account,person,coalesce((r->>''template_center_id'')::uuid,(r->>''center_id'')::uuid)),'||a);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' if perm_code=''media.read'' then null;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work template permission branch anchor drift';end if;
 b:=replace(b,a,' if perm_code=''templates.resolve'' then perform private.work_template_resolve(r,org,actor.id,person);elsif perm_code=''media.read'' then null;');
 a:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work template resolve dispatch anchor drift';end if;
 execute replace(b,a,$a$ when 'settings_template_resolve_v1' then out:=private.work_template_resolve(r,org,actor.id,person);
 -- DOMAIN_CASES$a$);
 b:=pg_get_functiondef('private.p06_report_rows(jsonb,uuid,uuid[])'::regprocedure);a:=' return rows;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work report grouping/order consumer anchor drift';end if;
 execute replace(b,a,' return private.work_report_rows(r,rows);');
 b:=pg_get_functiondef('private.p06_report(text,jsonb,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$'report_kind',r->'report','as_of',asof$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work report selected columns view anchor drift';end if;
 b:=replace(b,a,$a$'columns',coalesce(r->'columns','["group_key","center_id","person_id","currency","count","amount_minor","credits","basis_count","ratio_bps"]'::jsonb),$a$||a);
 a:=$a$'rows',private.p06_page(rows,r->'page',md5(jsonb_build_object('actor',account,'request',r-'page'-'request_id')::text),asof)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work report row columns projection anchor drift';end if;
 execute replace(b,a,$a$'rows',private.work_report_columns_page(private.p06_page(rows,r->'page',md5(jsonb_build_object('actor',account,'request',r-'page'-'request_id')::text),asof),r->'columns')$a$);
 b:=pg_get_functiondef('private.p06_worker_execute(text,jsonb,uuid[])'::regprocedure);
 a:=$a$   body:='group_key,center_id,person_id,currency,count,amount_minor,credits,basis_count,ratio_bps'||E'\r\n';$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work report CSV columns start anchor drift';end if;
 b:=replace(b,a,$a$   if c.request?'columns' then bin:=private.work_report_csv(rows,c.request->'columns',cfg.max_export_bytes);else
$a$||a);
 a:=$a$   bin:=convert_to(body,'UTF8');if octet_length(bin)>cfg.max_export_bytes then perform private.fail('PLAN_LIMIT_REACHED');end if;$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work report CSV columns end anchor drift';end if;
 execute replace(b,a,a||'end if;');
end$patch$;
revoke all on function private.work_template_request(text,jsonb,jsonb,uuid,uuid,uuid,boolean),private.work_template_patch(jsonb,jsonb,uuid),private.work_template_resolve(jsonb,uuid,uuid,uuid),private.work_templates_available(uuid,uuid,uuid,uuid),private.work_report_rows(jsonb,jsonb),private.work_report_csv(jsonb,jsonb,bigint),private.work_report_columns_page(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.work_template_request(text,jsonb,jsonb,uuid,uuid,uuid,boolean),private.work_template_patch(jsonb,jsonb,uuid),private.work_template_resolve(jsonb,uuid,uuid,uuid),private.work_templates_available(uuid,uuid,uuid,uuid),private.work_report_rows(jsonb,jsonb),private.work_report_csv(jsonb,jsonb,bigint),private.work_report_columns_page(jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
insert into private.runtime_operations(name,permission,billing_class,features) values('settings_template_resolve_v1','templates.resolve','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settings_template_resolve_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settings_template_resolve_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settings_template_resolve_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settings_template_resolve_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
