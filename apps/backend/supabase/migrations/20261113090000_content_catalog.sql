begin;
-- One catalog, exact existing ownership scope. No inherited organization overrides.
create table private.content_templates(
 id uuid primary key,scope_key text not null,org_id uuid references core.organizations(id),center_id uuid,
 code text not null check(code~'^[a-z][a-z0-9_.-]{0,127}$'),channel text not null check(channel in ('email','in_app','document','report')),
 language text not null check(language=lower(language) and length(language)<=35 and language~'^[a-z]{2,8}(-[a-z0-9]{1,8})*$'),
 version bigint not null check(version>0),source_version text not null check(length(source_version) between 1 and 64),
 content jsonb not null,state text not null check(state in ('draft','published')),revision bigint not null default 1,
 created_at timestamptz not null default clock_timestamp(),published_at timestamptz,
 unique(scope_key,code,channel,language,version),foreign key(org_id,center_id) references core.centers(org_id,id),
 check((org_id is null and center_id is null and scope_key='platform') or
 (org_id is not null and scope_key=case when center_id is null then 'organization:'||org_id else 'center:'||org_id||':'||center_id end)),
 check((state='published')=(published_at is not null))
);
create table private.content_retirements(template_id uuid primary key references private.content_templates(id),retired_at timestamptz not null default clock_timestamp());
alter table private.content_templates enable row level security;
alter table private.content_retirements enable row level security;
revoke all on private.content_templates,private.content_retirements from public,anon,authenticated;
grant select,insert,update on private.content_templates to service_role;
grant select,insert on private.content_retirements to service_role;
create function private.content_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.state='published' or (new.id,new.scope_key,new.code,new.channel,new.language,new.version,new.source_version,new.org_id,new.center_id)
 is distinct from (old.id,old.scope_key,old.code,old.channel,old.language,old.version,old.source_version,old.org_id,old.center_id) then perform private.fail('INTEGRITY_VIOLATION');end if;
 return new;
end$$;
create trigger content_immutable before update or delete on private.content_templates for each row execute function private.content_immutable();
create trigger content_retirement_immutable before update or delete on private.content_retirements for each row execute function private.p05_immutable();
-- Variables are runtime capabilities, not editable template declarations.
create function private.content_variables(code text,channel text) returns jsonb language sql immutable set search_path='' as $$
 select case when channel='email' and code='account.invitation' then '{"link":"string"}'::jsonb
 when channel='email' and code like 'notification.%' then '{"app_url":"string"}'::jsonb
 when channel='document' and code='instructor.agreement' then '{"facts":"string"}'::jsonb
 else '{}'::jsonb end
$$;
create function private.content_render_value(value jsonb,variables jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb;entry record;txt text;match text[];
begin
 case jsonb_typeof(value)
 when 'object' then
  result:='{}';for entry in select * from jsonb_each(value) loop result:=result||jsonb_build_object(entry.key,private.content_render_value(entry.value,variables));end loop;
 when 'array' then
  result:='[]';for entry in select x from jsonb_array_elements(value) x loop result:=result||jsonb_build_array(private.content_render_value(entry.x,variables));end loop;
 when 'string' then
  txt:=value#>>'{}';
  -- Read tokens only from the template, never recursively interpret inserted data.
  for match in select regexp_matches(txt,'\{\{([a-z][a-z0-9_]*)\}\}','g') loop
   if not variables?match[1] then perform private.fail('VALIDATION_FAILED');end if;
  end loop;
  -- Split once so variable values containing braces remain literal user data.
  result:=to_jsonb(''::text);
  while strpos(txt,'{{')>0 loop
   result:=to_jsonb((result#>>'{}')||substr(txt,1,strpos(txt,'{{')-1));txt:=substr(txt,strpos(txt,'{{')+2);
   if txt!~'^[a-z][a-z0-9_]*\}\}' then perform private.fail('VALIDATION_FAILED');end if;
   result:=to_jsonb((result#>>'{}')||(variables->>split_part(txt,'}}',1)));txt:=substr(txt,strpos(txt,'}}')+2);
  end loop;
  if strpos(txt,'}}')>0 then perform private.fail('VALIDATION_FAILED');end if;
  result:=to_jsonb((result#>>'{}')||txt);
 else perform private.fail('VALIDATION_FAILED');end case;
 return result;
end$$;
create function private.content_validate(code text,channel text,lang text,body jsonb) returns void language plpgsql immutable set search_path='' as $$
#variable_conflict use_column
declare vars jsonb:=private.content_variables(code,channel);sample jsonb;rendered jsonb;k text;
begin
 if code is null or code!~'^[a-z][a-z0-9_.-]{0,127}$' or lang is null or length(lang)>35 or lang!~'^[a-z]{2,8}(-[a-z0-9]{1,8})*$'
 or jsonb_typeof(body) is distinct from 'object' or octet_length(body::text)>262144 then perform private.fail('VALIDATION_FAILED');end if;
 if channel in ('email','in_app') then
  if not body?&array['title','text'] or exists(select 1 from jsonb_object_keys(body) k where k not in ('title','text'))
   or jsonb_typeof(body->'title') is distinct from 'string' or jsonb_typeof(body->'text') is distinct from 'string'
   or length(btrim(body->>'title')) not between 1 and 200 or length(btrim(body->>'text'))=0 or (body->>'title')~'[\r\n]' then perform private.fail('VALIDATION_FAILED');end if;
 elsif channel='document' then
  perform private.digital_document_hash(body);
  if lower(body->>'language') is distinct from lang then perform private.fail('VALIDATION_FAILED');end if;
 elsif channel='report' then
  if code<>'report.headers' or not body?'text' or jsonb_typeof(body->'text') is distinct from 'string' or exists(select 1 from jsonb_object_keys(body) k where k<>'text') then perform private.fail('VALIDATION_FAILED');end if;
 else perform private.fail('VALIDATION_FAILED');end if;
 select coalesce(jsonb_object_agg(key,to_jsonb('sample'::text)),'{}') into sample from jsonb_each(vars);
 rendered:=private.content_render_value(body,sample);
 for k in select jsonb_object_keys(vars) loop
  if strpos(body::text,'{{'||k||'}}')=0 then perform private.fail('VALIDATION_FAILED');end if;
 end loop;
end$$;
-- Store helper is private; only the native-auth dispatcher or deployment operator calls it.
create function private.content_store(r jsonb,new_id uuid) returns private.content_templates language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare t private.content_templates;sk text:=r->>'scope_key';action text:=r->>'action';
begin
 if action not in ('draft','publish','retire') or action is null then perform private.fail('VALIDATION_FAILED');end if;
 perform pg_advisory_xact_lock(hashtextextended('content.'||sk||':'||(r->>'code')||':'||(r->>'channel')||':'||(r->>'language'),0));
 select * into t from private.content_templates c where c.scope_key=sk and c.code=r->>'code' and c.channel=r->>'channel' and c.language=r->>'language' and c.version=(r->>'version')::bigint for update;
 if action='retire' then
  if t.id is null or t.state<>'published' then perform private.fail('NOT_FOUND');end if;
  insert into private.content_retirements(template_id) values(t.id) on conflict do nothing;return t;
 end if;
 perform private.content_validate(r->>'code',r->>'channel',r->>'language',r->'content');
 if t.state='published' then
  if t.content is distinct from r->'content' or t.source_version is distinct from r->>'source_version' then perform private.fail('VERSION_CONFLICT');end if;
  return t;
 end if;
 if t.id is null then
  if coalesce((r->>'expected_revision')::bigint,0)<>0 then perform private.fail('VERSION_CONFLICT');end if;
  insert into private.content_templates(id,scope_key,org_id,center_id,code,channel,language,version,source_version,content,state,published_at)
  values(new_id,sk,(r->>'org_id')::uuid,(r->>'center_id')::uuid,r->>'code',r->>'channel',r->>'language',(r->>'version')::bigint,r->>'source_version',r->'content',case when action='publish' then 'published' else 'draft' end,case when action='publish' then clock_timestamp() end) returning * into t;
 else
  if t.revision is distinct from (r->>'expected_revision')::bigint or t.source_version is distinct from r->>'source_version' then perform private.fail('VERSION_CONFLICT');end if;
  update private.content_templates c set content=r->'content',state=case when action='publish' then 'published' else 'draft' end,published_at=case when action='publish' then clock_timestamp() end,revision=c.revision+1 where c.id=t.id returning * into t;
 end if;
 return t;
end$$;
create function private.content_pick(sk text,code text,channel text,languages text[],source_version text default null) returns private.content_templates language sql stable set search_path='' as $$
 select c from private.content_templates c where c.scope_key=$1 and c.code=$2 and c.channel=$3 and c.state='published'
 and ($5 is null or c.source_version=$5) and c.language=any($4) and not exists(select 1 from private.content_retirements x where x.template_id=c.id)
 order by array_position($4,c.language),c.version desc limit 1
$$;
create function private.content_render(t private.content_templates,variables jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare defs jsonb:=private.content_variables(t.code,t.channel);
begin
 if t.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if jsonb_typeof(variables) is distinct from 'object' or exists(select 1 from jsonb_each(variables) e where defs->>e.key is distinct from jsonb_typeof(e.value))
 or exists(select 1 from jsonb_object_keys(defs) k where not variables?k) then perform private.fail('VALIDATION_FAILED');end if;
 return private.content_render_value(t.content,variables);
end$$;
commit;
begin;
create function private.content_validate_row() returns trigger language plpgsql set search_path='' as $$
begin perform private.content_validate(new.code,new.channel,new.language,new.content);return new;end$$;
create trigger content_validate before insert or update on private.content_templates for each row execute function private.content_validate_row();
revoke all on function private.content_immutable(),private.content_validate_row(),private.content_variables(text,text),private.content_render_value(jsonb,jsonb),private.content_validate(text,text,text,jsonb),private.content_store(jsonb,uuid),private.content_pick(text,text,text,text[],text),private.content_render(private.content_templates,jsonb) from public,anon,authenticated;
grant execute on function private.content_variables(text,text),private.content_render_value(jsonb,jsonb),private.content_validate(text,text,text,jsonb),private.content_store(jsonb,uuid),private.content_pick(text,text,text,text[],text),private.content_render(private.content_templates,jsonb) to service_role;
commit;
begin;
create function private.content_catalog_access(r jsonb,org uuid,center uuid,person uuid,platform boolean) returns void language plpgsql set search_path='' as $$
declare sk text:=r->>'scope_key';
begin
 if sk='platform' then
  if org is not null or center is not null or not platform then perform private.fail('FORBIDDEN');end if;
 elsif org is not null and sk=(case when center is null then 'organization:'||org else 'center:'||org||':'||center end) then
  if r->>'channel'<>'document' or r->>'code' not like 'document.%' and r->>'code'<>'instructor.agreement' then perform private.fail('FORBIDDEN');end if;
  perform private.p05_configuration(org,center,person,case when center is null then '{"kind":"organization"}'::jsonb else jsonb_build_object('kind','center','center_id',center) end);
  perform private.require_feature(org,case when r->>'code'='instructor.agreement' then 'F20' else 'F30' end);
 else perform private.fail('FORBIDDEN');end if;
end$$;
create function private.content_catalog_execute(op text,r jsonb,ids uuid[]) returns jsonb language plpgsql set search_path='' as $$
declare t private.content_templates;data jsonb;
begin
 if op='content_catalog_save_v1' then
  t:=private.content_store(r,private.new_id(ids,2));
  data:=jsonb_build_object('operation_id',private.new_id(ids,3),'primary_id',t.id,'version',t.revision,'replayed',false,'related','[]'::jsonb);
 else
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('retired',exists(select 1 from private.content_retirements x where x.template_id=c.id)) order by c.language,c.version),'[]'::jsonb)) into data
  from private.content_templates c where c.scope_key=r->>'scope_key' and c.code=r->>'code' and c.channel=r->>'channel';
 end if;
 return jsonb_build_object('data',data,'primary_id',t.id,'subject','content_templates','version',t.revision);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping;';if strpos(b,a)=0 then raise exception 'Catalog access anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation in ('content_catalog_get_v1','content_catalog_save_v1') then perform private.content_catalog_access(r,org,center,person,platform);end if;
$a$||a);
 -- Existing permission implementation has an earlier digital agreement branch.
 a:='elsif perm_code=''preparation.resolve'' then null;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog permission anchor drift';end if;
 b:=replace(b,a,'elsif p_operation in (''content_catalog_get_v1'',''content_catalog_save_v1'') then null;'||a);
 a:=' -- DOMAIN_CASES';if array_length(string_to_array(b,a),1)<>2 then raise exception 'Catalog domain anchor drift';end if;
 execute replace(b,a,$a$ when 'content_catalog_get_v1','content_catalog_save_v1' then
  terms:=private.content_catalog_execute(p_operation,r,p_ids);out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=(terms->>'version')::bigint;
$a$||a);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('content_catalog_get_v1','document.manage','read','{}'),('content_catalog_save_v1','document.manage','config','{}');
create function api_v1.content_catalog_get_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('content_catalog_get_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
create function api_v1.content_catalog_save_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('content_catalog_save_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function private.content_catalog_access(jsonb,uuid,uuid,uuid,boolean),private.content_catalog_execute(text,jsonb,uuid[]),api_v1.content_catalog_get_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.content_catalog_save_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.content_catalog_access(jsonb,uuid,uuid,uuid,boolean),private.content_catalog_execute(text,jsonb,uuid[]),api_v1.content_catalog_get_v1(jsonb,uuid,uuid,uuid[],jsonb),api_v1.content_catalog_save_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
begin;
select private.content_store('{"scope_key":"platform","code":"notification.reservation","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Rezervasyon sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c05-77a7-9217-423621501c07'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.reservation","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Rezervasyon sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-6d1ad300aeb8'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.reservation","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Reservation update","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-724aa55d9411'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.reservation","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Reservation update","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-76035fb9d61b'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson_request","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Ders talebi sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-79bcb49ad97d'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson_request","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Ders talebi sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-7ce613a09077'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson_request","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Lesson request update","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-81edbe271f82'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson_request","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Lesson request update","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-870cbe4adabe'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.cancellation","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Ders iptali","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-8a7284e5d062'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.cancellation","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Ders iptali","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-8e7471b9a069'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.cancellation","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Lesson cancellation","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-937506bbac35'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.cancellation","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Lesson cancellation","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-94f9a6a4b840'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.session_change","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Ders değişikliği","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-991f213ff390'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.session_change","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Ders değişikliği","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-9e8153f1c6f5'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.session_change","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Lesson update","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-a1245f24e1d3'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.session_change","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Lesson update","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-a5d12a8fa966'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.seat_offer","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Yer teklifi sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-ab25387d963b'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.seat_offer","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Yer teklifi sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-ae8cf2eb7174'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.seat_offer","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Seat offer update","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-b20e7be369b9'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.seat_offer","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Seat offer update","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-b47efd306616'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.collection","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Tahsilat sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-b9acf5216fa4'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.collection","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Tahsilat sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-bfb35c0fcc01'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.collection","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Payment update","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-c1c852a4b44f'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.collection","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Payment update","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-c60193c224dc'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.refund","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"İade sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-c97d72f4d2e7'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.refund","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"İade sonucu","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-cd5a7bb07965'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.refund","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Refund update","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-d0b145707338'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.refund","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Refund update","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-d722d8e60c7d'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.access","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Erişim değişikliği","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-da6d6ae9b6ba'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.access","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Erişim değişikliği","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-dd844dd7d72f'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.access","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Access update","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-e39f939b74e6'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.access","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Access update","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-e60cc4a2319e'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Ders hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-ea708c9a0f95'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Ders hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c08-7677-a576-ec4aff12881d'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Lesson reminder","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-1e99a4a736d6'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.lesson","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Lesson reminder","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-225ec8fa6446'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.event","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Etkinlik hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-25a5525c933e'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.event","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Etkinlik hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-2bf8ac8f27a4'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.event","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Event reminder","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-2ca51d7695d2'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.event","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Event reminder","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-32ba73734d8b'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.entitlement","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Paket bitişi hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-347586662e88'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.entitlement","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Paket bitişi hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-3b624539515b'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.entitlement","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Package expiry reminder","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-3d015d3a90c6'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.entitlement","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Package expiry reminder","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-40a7c5079e15'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.payment","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Ödeme vadesi hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-463e8d0c38ba'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.payment","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Ödeme vadesi hatırlatması","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-4b99575586e6'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.payment","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Payment due reminder","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-4f16be7abde9'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.payment","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Payment due reminder","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-52ecbecab788'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.generic","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"Bildirim","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-5621272c7300'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.generic","channel":"in_app","language":"tr","version":1,"source_version":"1","content":{"title":"Bildirim","text":"Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-586758a27c97'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.generic","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"Notification","text":"View your new notification in the application: {{app_url}}"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-5ef997b10c8a'::uuid);
select private.content_store('{"scope_key":"platform","code":"notification.generic","channel":"in_app","language":"en","version":1,"source_version":"1","content":{"title":"Notification","text":"View your new notification in the application:"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-636abd73aa07'::uuid);
select private.content_store('{"scope_key":"platform","code":"account.invitation","channel":"email","language":"tr","version":1,"source_version":"1","content":{"title":"FtkSaaS hesap erişimi daveti","text":"Hesap erişimi davetinizi kabul etmek için bağlantıyı açın:\n{{link}}\n\nBu davet yalnız gönderildiği doğrulanmış e-posta hesabıyla kabul edilebilir. Talep etmediyseniz bu e-postayı yok sayabilirsiniz."},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-6583e8bbef94'::uuid);
select private.content_store('{"scope_key":"platform","code":"account.invitation","channel":"email","language":"en","version":1,"source_version":"1","content":{"title":"FtkSaaS account access invitation","text":"Open the link to accept your account access invitation:\n{{link}}\n\nThis invitation can only be accepted with the verified email account it was sent to. If you did not request it, you can ignore this email."},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-69d250682252'::uuid);
select private.content_store('{"scope_key":"platform","code":"report.headers","channel":"report","language":"tr","version":2,"source_version":"1","content":{"text":"group_key,center_id,person_id,currency,count,amount_minor,credits,basis_count,ratio_bps,subscriber_number"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-6d472bcc0e66'::uuid);
select private.content_store('{"scope_key":"platform","code":"report.headers","channel":"report","language":"en","version":2,"source_version":"1","content":{"text":"group_key,center_id,person_id,currency,count,amount_minor,credits,basis_count,ratio_bps,subscriber_number"},"action":"publish"}'::jsonb,'01a1d2b1-3c09-7128-a211-7148f57fe4e7'::uuid);
commit;
