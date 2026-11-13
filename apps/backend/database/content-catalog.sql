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
 or jsonb_typeof(body) is distinct from 'object' or (channel<>'document' and octet_length(body::text)>262144) then perform private.fail('VALIDATION_FAILED');end if;
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
 -- Existing organization document/notice JSON is literal text, never executable template syntax.
 if channel='document' and code<>'instructor.agreement' then return;end if;
 select coalesce(jsonb_object_agg(key,to_jsonb('sample'::text)),'{}') into sample from jsonb_each(vars);
 if strpos((body-'text')::text,'{{')>0 or strpos((body-'text')::text,'}}')>0 then perform private.fail('VALIDATION_FAILED');end if;
 rendered:=private.content_render_value(body,sample);
 for k in select jsonb_object_keys(vars) loop
  if strpos(body->>'text','{{'||k||'}}')=0 then perform private.fail('VALIDATION_FAILED');end if;
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
 if t.channel='document' and t.code<>'instructor.agreement' then return t.content;end if;
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
