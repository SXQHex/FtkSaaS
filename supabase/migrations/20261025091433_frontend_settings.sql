begin;
create function private.frontend_settings_fields() returns jsonb language sql immutable security invoker set search_path='' as $fields$select '[{"scope":"user","key":"honorific","schema":{"type":"string","maxLength":100},"default":"","group":"S01","consumer":"frontend"},{"scope":"user","key":"language","schema":{"type":"string","enum":["auto","tr","en"]},"default":"auto","group":"S07","consumer":"frontend"},{"scope":"user","key":"date_format","schema":{"type":"string","enum":["dd.MM.yyyy"]},"default":"dd.MM.yyyy","group":"S07","consumer":"frontend"},{"scope":"user","key":"time_format","schema":{"type":"string","enum":["12","24"]},"default":"24","group":"S07","consumer":"frontend"},{"scope":"user","key":"number_format","schema":{"type":"string","enum":["tr-TR","en-US"]},"default":"tr-TR","group":"S07","consumer":"frontend"},{"scope":"user","key":"week_start","schema":{"type":"string","enum":["monday","sunday"]},"default":"monday","group":"S07","consumer":"frontend"},{"scope":"user","key":"timezone_mode","schema":{"type":"string","enum":["auto","manual"]},"default":"auto","group":"S07","consumer":"frontend"},{"scope":"user","key":"theme","schema":{"type":"string","enum":["light","dark","system"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"contrast","schema":{"type":"string","enum":["system","high"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"motion","schema":{"type":"string","enum":["system","reduced"]},"default":"system","group":"S08","consumer":"frontend"},{"scope":"user","key":"remember_context","schema":{"type":"boolean"},"default":true,"group":"S09","consumer":"frontend"},{"scope":"user","key":"calendar_view","schema":{"type":"string","enum":["day","week","month","agenda"]},"default":"week","group":"S10","consumer":"frontend"},{"scope":"user","key":"show_weekends","schema":{"type":"boolean"},"default":true,"group":"S10","consumer":"frontend"},{"scope":"user","key":"marketing_in_app","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"frontend"},{"scope":"user","key":"ad_personalization","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"ad_measurement","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"optional_analytics","schema":{"type":"boolean"},"default":true,"group":"S14","consumer":"frontend"},{"scope":"user","key":"timezone_name","schema":{"anyOf":[{"type":"string","maxLength":100},{"type":"null"}]},"default":null,"group":"S07","consumer":"frontend"},{"scope":"member","key":"profile_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"photo_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"email_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"phone_visible","schema":{"type":"boolean"},"default":false,"group":"S15","consumer":"frontend"},{"scope":"member","key":"history_recommendations","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"frontend"},{"scope":"member","key":"interest_center_ids","schema":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"},"maxItems":100,"uniqueItems":true},"default":[],"group":"S14","consumer":"frontend"},{"scope":"member","key":"interest_discipline_ids","schema":{"type":"array","items":{"$ref":"#/$defs/FtkUuid"},"maxItems":100,"uniqueItems":true},"default":[],"group":"S14","consumer":"frontend"},{"scope":"member","key":"in_app_reminders","schema":{"type":"boolean"},"default":true,"group":"S12","consumer":"p05_optional_allowed"},{"scope":"member","key":"in_app_marketing","schema":{"type":"boolean"},"default":false,"group":"S14","consumer":"p05_optional_allowed"},{"scope":"center","key":"description","schema":{"type":"string","maxLength":3000},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"address","schema":{"type":"string","maxLength":1000},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"contact_phone","schema":{"type":"string","maxLength":100},"default":"","group":"M01","consumer":"frontend"},{"scope":"center","key":"contact_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"M01","consumer":"frontend"},{"scope":"organization","key":"description","schema":{"type":"string","maxLength":3000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"address","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"contact_phone","schema":{"type":"string","maxLength":100},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"contact_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"theme_package_id","schema":{"type":"null"},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"font_package_id","schema":{"type":"null"},"default":null,"group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_name","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_address","schema":{"type":"string","maxLength":1000},"default":"","group":"O01","consumer":"frontend"},{"scope":"organization","key":"billing_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"O01","consumer":"frontend"},{"scope":"platform","key":"application_name","schema":{"type":"string","minLength":1,"maxLength":100},"default":"FtkSaaS","group":"P01","consumer":"frontend"},{"scope":"platform","key":"support_email","schema":{"anyOf":[{"type":"string","format":"email","maxLength":320},{"type":"null"}]},"default":null,"group":"P01","consumer":"frontend"},{"scope":"platform","key":"support_url","schema":{"anyOf":[{"type":"string","format":"uri","pattern":"^https://","maxLength":2000},{"type":"null"}]},"default":null,"group":"P01","consumer":"frontend"},{"scope":"platform","key":"maintenance_message","schema":{"type":"string","maxLength":3000},"default":"","group":"P01","consumer":"frontend"}]'::jsonb$fields$;
-- Application preferences only. No direct client access or generic domain mutation.
create table private.frontend_settings(
 scope_key text primary key,scope text not null check(scope in ('user','member','center','organization','platform')),
 values jsonb not null default '{}' check(jsonb_typeof(values)='object'),version bigint not null default 0 check(version>=0)
);
create table private.frontend_settings_history(
 id uuid primary key,scope_key text not null,actor_account_id uuid not null references core.accounts(id),
 at timestamptz not null default clock_timestamp(),before_values jsonb not null,after_values jsonb not null,reason text not null,
 operation_id uuid not null unique references core.operation_receipts(id)
);
create trigger frontend_settings_history_immutable before update or delete on private.frontend_settings_history for each row execute function private.append_only();
create index frontend_settings_history_scope on private.frontend_settings_history(scope_key,at desc,id desc);
create table private.frontend_settings_previews(
 id uuid primary key,scope_key text not null,actor_account_id uuid not null references core.accounts(id),
 version bigint not null,fields jsonb not null,token_hash text not null,expires_at timestamptz not null,applied boolean not null default false
);
alter table private.frontend_settings enable row level security;
alter table private.frontend_settings_history enable row level security;
alter table private.frontend_settings_previews enable row level security;
revoke all on private.frontend_settings,private.frontend_settings_history,private.frontend_settings_previews from public,anon,authenticated;
grant select,insert,update on private.frontend_settings,private.frontend_settings_previews to service_role;
grant select,insert on private.frontend_settings_history to service_role;
-- Preserve the historical absent-reminder=false state; new members receive the FD04 default.
insert into private.frontend_settings(scope_key,scope,values)
 select distinct 'member:'||l.org_id||':'||l.account_id,'member','{"in_app_reminders":false}'::jsonb from core.account_links l where l.state='active' and l.verified_at is not null;

-- Every legacy preference write invalidates the same member document, including stale reset previews.
create function private.frontend_settings_notification_version() returns trigger language plpgsql security invoker set search_path='' as $$
declare r core.notification_preferences;a uuid;
begin
 if TG_OP='DELETE' then r:=old;else r:=new;end if;
 if r.channel='in_app' and r.purpose in ('reminder','marketing') then
  for a in select l.account_id from core.account_links l where l.org_id=r.org_id and l.person_id=r.person_id and l.state='active' and l.verified_at is not null loop
   insert into private.frontend_settings(scope_key,scope,version) values('member:'||r.org_id||':'||a,'member',1)
   on conflict(scope_key) do update set version=private.frontend_settings.version+1;
  end loop;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end$$;
revoke all on function private.frontend_settings_notification_version() from public,anon,authenticated;
grant execute on function private.frontend_settings_notification_version() to service_role;
create trigger frontend_settings_notification_version after insert or update or delete on core.notification_preferences for each row execute function private.frontend_settings_notification_version();

create function private.frontend_settings_key(r jsonb,account uuid,person uuid) returns text language sql immutable security invoker set search_path='' as $$
 select case r->>'scope' when 'user' then 'user:'||account when 'member' then 'member:'||(r->>'org_id')||':'||account when 'center' then 'center:'||(r->>'org_id')||':'||(r->>'center_id') when 'organization' then 'organization:'||(r->>'org_id') when 'platform' then 'platform' end
$$;
create function private.frontend_settings_access(r jsonb,account uuid,person uuid,platform boolean) returns void language plpgsql security invoker set search_path='' as $$
declare scope text:=r->>'scope';org uuid:=(r->>'org_id')::uuid;center uuid:=(r->>'center_id')::uuid;
begin
 if scope not in ('user','member','center','organization','platform') or scope is null then perform private.fail('VALIDATION_FAILED');end if;
 if scope in ('user','platform') then
  if org is not null or center is not null then perform private.fail('VALIDATION_FAILED');end if;
  if scope='platform' and not platform then perform private.fail('FORBIDDEN');end if;
 else
  if org is null or (scope='center') is distinct from (center is not null) then perform private.fail('VALIDATION_FAILED');end if;
  if scope='member' and person is null then perform private.fail('NOT_FOUND');end if;
  if scope='center' and not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
  if scope='organization' and not private.is_org_reader(org,person) then perform private.fail('FORBIDDEN');end if;
 end if;
 -- Same lock serializes absent-row creation, writes, reset preview and receipt replay.
 perform pg_advisory_xact_lock(hashtextextended('frontend.settings.'||private.frontend_settings_key(r,account,person),0));
end$$;
create function private.frontend_settings_defaults(scope text) returns jsonb language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(f->>'key',f->'default'),'{}') from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'=$1
$$;
create function private.frontend_settings_view(r jsonb,account uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare doc private.frontend_settings;values jsonb;ver bigint;row record;org uuid:=(r->>'org_id')::uuid;
begin
 select * into doc from private.frontend_settings where scope_key=private.frontend_settings_key(r,account,person);
 values:=private.frontend_settings_defaults(r->>'scope')||coalesce(doc.values,'{}');ver:=coalesce(doc.version,0);
 if r->>'scope'='member' then
  -- Existing notification API remains authoritative; a trigger advances the scoped settings version.
  for row in select purpose,enabled,version from core.notification_preferences where org_id=org and person_id=person and channel='in_app' and purpose in ('reminder','marketing') order by purpose loop
   values:=jsonb_set(values,array[case row.purpose when 'reminder' then 'in_app_reminders' else 'in_app_marketing' end],to_jsonb(row.enabled));
  end loop;
 end if;
 return jsonb_build_object('scope',r->>'scope','version',ver,'values',values,'overridden_fields',coalesce((select jsonb_agg(k order by k) from (select jsonb_object_keys(coalesce(doc.values,'{}')) k union select case n.purpose when 'reminder' then 'in_app_reminders' else 'in_app_marketing' end from core.notification_preferences n where r->>'scope'='member' and n.org_id=org and n.person_id=person and n.channel='in_app' and n.purpose in ('reminder','marketing')) s),'[]'),'as_of',clock_timestamp());
end$$;
-- Small closed schema subset used by the fixed field catalog, never a caller-provided schema.
create function private.frontend_setting_valid(v jsonb,s jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;kind text:=s->>'type';txt text:=v#>>'{}';
begin
 if s->>'$ref'='#/$defs/FtkUuid' then return jsonb_typeof(v)='string' and txt~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';end if;
 if s?'anyOf' then for item in select * from jsonb_array_elements(s->'anyOf') loop if private.frontend_setting_valid(v,item) then return true;end if;end loop;return false;end if;
 if kind='null' then return v='null';end if;
 if kind='integer' then if jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric) then return false;end if;
 elsif jsonb_typeof(v) is distinct from kind then return false;end if;
 if s?'enum' and not s->'enum' @> jsonb_build_array(v) then return false;end if;
 if kind='string' then
  if s?'maxLength' and length(txt)>(s->>'maxLength')::int or s?'minLength' and length(txt)<(s->>'minLength')::int then return false;end if;
  if s?'pattern' and txt!~(s->>'pattern') then return false;end if;
  if s->>'format'='uuid' and txt!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false;end if;
  if s->>'format'='email' and txt!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false;end if;
 elsif kind in ('integer','number') then
  if s?'minimum' and txt::numeric<(s->>'minimum')::numeric or s?'maximum' and txt::numeric>(s->>'maximum')::numeric then return false;end if;
 elsif kind='array' then
  if jsonb_array_length(v)>coalesce((s->>'maxItems')::int,100) then return false;end if;
  if s->>'uniqueItems'='true' and (select count(*)<>count(distinct x) from jsonb_array_elements(v) x) then return false;end if;
  for item in select * from jsonb_array_elements(v) loop if not private.frontend_setting_valid(item,s->'items') then return false;end if;end loop;
 end if;
 return true;
end$$;
create function private.frontend_settings_patch(r jsonb,patch jsonb,person uuid) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare item record;field jsonb;scope text:=r->>'scope';org uuid:=(r->>'org_id')::uuid;selected_id text;
begin
 if jsonb_typeof(patch)<>'object' or patch='{}' then perform private.fail('VALIDATION_FAILED');end if;
 for item in select * from jsonb_each(patch) loop
  select f into field from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'=scope and f->>'key'=item.key;
  if not found or not private.frontend_setting_valid(item.value,field->'schema') then perform private.fail('VALIDATION_FAILED');end if;
  if field#>>'{schema,type}'='null' then perform private.fail('SERVICE_UNAVAILABLE');end if;
  if scope='organization' and item.key like 'billing_%' and not exists(select 1 from core.organizations where id=org and owner_person_id=person) then perform private.fail('FORBIDDEN');end if;
  if scope='user' and item.key='timezone_name' and item.value<>'null' and not exists(select 1 from pg_timezone_names where name=item.value#>>'{}') then perform private.fail('VALIDATION_FAILED');end if;
  if scope='member' and item.key in ('interest_center_ids','interest_discipline_ids') then
   for selected_id in select jsonb_array_elements_text(item.value) loop
    if item.key='interest_center_ids' and not exists(select 1 from core.centers where org_id=org and id=selected_id::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
    if item.key='interest_discipline_ids' and not exists(select 1 from core.disciplines where org_id=org and id=selected_id::uuid and state='active') then perform private.fail('NOT_FOUND');end if;
   end loop;
  end if;
 end loop;
end$$;
create function private.frontend_settings_execute(op text,r jsonb,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare skey text:=private.frontend_settings_key(r,account,person);view jsonb:=private.frontend_settings_view(r,account,person);before jsonb:=view->'values';after jsonb;local jsonb;ver bigint:=(view->>'version')::bigint;
 keys jsonb;field text;patch jsonb;pid uuid:=private.new_id(ids,2);p private.frontend_settings_previews;token text:=aux->>'token';org uuid:=(r->>'org_id')::uuid;descriptor jsonb;history_cursor jsonb;history_at timestamptz;history_id uuid;history_asof timestamptz:=clock_timestamp();history_items jsonb;next_token text;more boolean;
begin
 if op='settings_get_v1' then return view;end if;
 if op='settings_catalog_get_v1' then
  select coalesce(jsonb_agg(jsonb_build_object('key',f->>'key','group',f->>'group','consumer',f->>'consumer','writable',(f#>>'{schema,type}' is distinct from 'null') and (not ((r->>'scope')='organization' and (f->>'key') like 'billing_%') or exists(select 1 from core.organizations where id=org and owner_person_id=person))) order by f->>'key'),'[]') into descriptor from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'=r->>'scope';
  return jsonb_build_object('scope',r->>'scope','catalog_version',1,'fields',descriptor,'defaults',private.frontend_settings_defaults(r->>'scope'),'brand_packages','[]'::jsonb,'limitations',jsonb_build_array('Only the returned closed fields are writable. Domain commands retain their existing APIs.','Only system branding is approved; color/font assets, logos and external providers are not implemented by this API.','Consent is separate from stored advertising or analytics preferences.'));
 end if;
 if op='settings_history_get_v1' then
  if r->>'cursor' is not null then
   begin
    history_cursor:=convert_from(decode(r->>'cursor','hex'),'UTF8')::jsonb;history_at:=(history_cursor->>'at')::timestamptz;history_id:=(history_cursor->>'id')::uuid;history_asof:=(history_cursor->>'as_of')::timestamptz;
    if history_cursor->>'scope' is distinct from md5(skey) or history_at is null or history_id is null or history_asof is null or not isfinite(history_at) or not isfinite(history_asof) or history_at>history_asof or history_asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
   exception when others then perform private.fail('VALIDATION_FAILED');end;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'actor_account_id',h.actor_account_id,'at',h.at,'before',h.before_values,'after',h.after_values,'reason',h.reason) order by h.at desc,h.id desc),'[]') into history_items from
   (select * from private.frontend_settings_history where scope_key=skey and at<=history_asof and (history_at is null or (at,id)<(history_at,history_id)) order by at desc,id desc limit 51) h;
  more:=jsonb_array_length(history_items)>50;
  if more then
   history_items:=history_items-50;
   next_token:=encode(convert_to(jsonb_build_object('scope',md5(skey),'at',history_items#>>'{49,at}','id',history_items#>>'{49,id}','as_of',history_asof)::text,'UTF8'),'hex');
  end if;
  return jsonb_build_object('items',history_items,'next_cursor',next_token,'as_of',history_asof);
 end if;
 select values into local from private.frontend_settings where scope_key=skey;local:=coalesce(local,'{}');
 if op='settings_reset_preview_v1' then
  keys:=r->'fields';
  if jsonb_typeof(keys)<>'array' or jsonb_array_length(keys)=0 or jsonb_array_length(keys)>50 or (select count(*)<>count(distinct v) from jsonb_array_elements(keys) v) then perform private.fail('VALIDATION_FAILED');end if;
  patch:='{}';for field in select jsonb_array_elements_text(keys) loop
   if not before?field then perform private.fail('VALIDATION_FAILED');end if;
   patch:=patch||jsonb_build_object(field,private.frontend_settings_defaults(r->>'scope')->field);
  end loop;
  -- Reset cannot reopen a disabled advertising/analytics choice.
  for field in select jsonb_array_elements_text(keys) loop if field in ('ad_personalization','ad_measurement','optional_analytics') and before->field='false' then patch:=jsonb_set(patch,array[field],'false');end if;end loop;
  perform private.frontend_settings_patch(r,patch,person);after:=before||patch;
  if r->>'scope'='user' and after->>'timezone_mode'='manual' and (after->>'timezone_name') is null then perform private.fail('VALIDATION_FAILED');end if;
  if token is null or length(token)<32 then perform private.fail('TEMPORARY_FAILURE');end if;
  insert into private.frontend_settings_previews values(pid,skey,account,ver,keys,encode(extensions.digest(token,'sha256'),'hex'),clock_timestamp()+interval '15 minutes',false);
  return jsonb_build_object('id',pid,'token',token,'scope',r->>'scope','version',ver,'fields',keys,'before',before,'after',after,'expires_at',clock_timestamp()+interval '15 minutes');
 end if;
 if ver is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
 if op='settings_update_v1' then patch:=r->'patch';perform private.frontend_settings_patch(r,patch,person);local:=local||patch;
 elsif op='settings_reset_apply_v1' then
  select * into p from private.frontend_settings_previews where id=(r#>>'{preview,id}')::uuid for update;
  if not found or p.scope_key<>skey or p.actor_account_id<>account or p.version<>ver or p.applied or p.expires_at<=clock_timestamp() or p.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') then perform private.fail('PREVIEW_STALE');end if;
  keys:=p.fields;patch:='{}';for field in select jsonb_array_elements_text(keys) loop local:=local-field;patch:=patch||jsonb_build_object(field,private.frontend_settings_defaults(r->>'scope')->field);end loop;
  for field in select jsonb_array_elements_text(keys) loop if field in ('ad_personalization','ad_measurement','optional_analytics') and before->field='false' then local:=jsonb_set(local,array[field],'false');patch:=jsonb_set(patch,array[field],'false');end if;end loop;
  perform private.frontend_settings_patch(r,patch,person);
  update private.frontend_settings_previews set applied=true where id=p.id;
 else perform private.fail('NOT_FOUND');end if;
 if r->>'scope'='user' and local->>'timezone_mode'='manual' and (local->>'timezone_name') is null then perform private.fail('VALIDATION_FAILED');end if;
 -- Legacy preference writes still work; the shared trigger also invalidates settings previews.
 if r->>'scope'='member' then
  for field in select k from jsonb_object_keys(patch) k where k in ('in_app_reminders','in_app_marketing') loop
   update core.notification_preferences set enabled=(patch->>field)::boolean,version=version+1 where org_id=org and person_id=person and channel='in_app' and purpose=case field when 'in_app_reminders' then 'reminder' else 'marketing' end;
  end loop;
 end if;
 insert into private.frontend_settings(scope_key,scope,values,version) values(skey,r->>'scope',local,1)
 on conflict(scope_key) do update set values=excluded.values,version=private.frontend_settings.version+1;
 view:=private.frontend_settings_view(r,account,person);after:=view->'values';
 insert into private.frontend_settings_history(id,scope_key,actor_account_id,before_values,after_values,reason,operation_id) values(private.new_id(ids,11),skey,account,before,after,coalesce(r->>'reason',''),operation);
 return jsonb_build_object('operation_id',operation,'primary_id',account,'version',(view->>'version')::bigint,'replayed',false,'related','[]'::jsonb);
end$$;
-- Optional preferences are evaluated at delivery, not trusted from the client payload.
create or replace function private.p05_optional_allowed(org uuid,person uuid,purpose text) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select p.enabled from core.notification_preferences p where p.org_id=org and p.person_id=person and p.channel='in_app' and p.purpose=$3),
 (select (s.values->>(case $3 when 'reminder' then 'in_app_reminders' when 'marketing' then 'in_app_marketing' end))::boolean from private.frontend_settings s where s.scope_key='member:'||$1||':'||(select l.account_id from core.account_links l where l.org_id=$1 and l.person_id=$2 and l.state='active' and l.verified_at is not null limit 1)),$3='reminder' and exists(select 1 from core.account_links l where l.org_id=$1 and l.person_id=$2 and l.state='active' and l.verified_at is not null))
$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=$a$ if not platform and p_operation not in ('account_access_accept_v1') then$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'settings self preference billing anchor mismatch';end if;
 b:=replace(b,old,$a$ if not platform and p_operation not in ('account_access_accept_v1') and not (p_operation in ('settings_catalog_get_v1','settings_get_v1','settings_update_v1','settings_reset_preview_v1','settings_reset_apply_v1','settings_history_get_v1') and r->>'scope'='member') then$a$);
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'settings permission anchor mismatch';end if;
 b:=replace(b,old,old||E'\n'||' if perm_code=''settings.access'' then perform private.frontend_settings_access(r,actor.id,person,platform);end if;');
 old:=' if perm_code in (''platform.owner'',''saas.operator'') then';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'settings permission branch anchor mismatch';end if;
 b:=replace(b,old,' if perm_code=''settings.access'' then null;elsif perm_code in (''platform.owner'',''saas.operator'') then');
 old:=$a$ if out ? 'items' and p_operation<>'disciplines_list_v1' then out:=out||jsonb_build_object('as_of',now());end if;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'settings history timestamp anchor mismatch';end if;
 b:=replace(b,old,$a$ if out ? 'items' and p_operation not in ('disciplines_list_v1','settings_history_get_v1') then out:=out||jsonb_build_object('as_of',now());end if;$a$);
 old:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'settings domain anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'settings_catalog_get_v1','settings_get_v1','settings_update_v1','settings_reset_preview_v1','settings_reset_apply_v1','settings_history_get_v1' then
  out:=private.frontend_settings_execute(p_operation,r,actor.id,person,operation_id,p_ids,p_aux);record_id:=actor.id;subject:='accounts';
 -- DOMAIN_CASES$a$);
 execute b;
end$patch$;
revoke all on function private.frontend_settings_fields(),private.frontend_settings_key(jsonb,uuid,uuid),private.frontend_settings_access(jsonb,uuid,uuid,boolean),private.frontend_settings_defaults(text),private.frontend_settings_view(jsonb,uuid,uuid),private.frontend_setting_valid(jsonb,jsonb),private.frontend_settings_patch(jsonb,jsonb,uuid),private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.frontend_settings_fields(),private.frontend_settings_key(jsonb,uuid,uuid),private.frontend_settings_access(jsonb,uuid,uuid,boolean),private.frontend_settings_defaults(text),private.frontend_settings_view(jsonb,uuid,uuid),private.frontend_setting_valid(jsonb,jsonb),private.frontend_settings_patch(jsonb,jsonb,uuid),private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settings_catalog_get_v1','settings.access','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settings_catalog_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settings_catalog_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settings_catalog_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settings_catalog_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settings_get_v1','settings.access','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settings_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settings_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settings_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settings_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settings_update_v1','settings.access','maintenance',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settings_update_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settings_update_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settings_update_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settings_update_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settings_reset_preview_v1','settings.access','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settings_reset_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settings_reset_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settings_reset_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settings_reset_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settings_reset_apply_v1','settings.access','maintenance',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settings_reset_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settings_reset_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settings_reset_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settings_reset_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('settings_history_get_v1','settings.access','read',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.settings_history_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('settings_history_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.settings_history_get_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.settings_history_get_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
