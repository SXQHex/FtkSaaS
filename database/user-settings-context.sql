create or replace function private.frontend_setting_valid(v jsonb,s jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;entry record;kind text:=s->>'type';txt text:=v#>>'{}';
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
 elsif kind='object' then
  if s->'additionalProperties' is distinct from 'false'::jsonb then return false;end if;
  for item in select * from jsonb_array_elements(coalesce(s->'required','[]')) loop if not v?(item#>>'{}') then return false;end if;end loop;
  for entry in select * from jsonb_each(v) loop
   if not (s->'properties')?entry.key or not private.frontend_setting_valid(entry.value,s#>array['properties',entry.key]) then return false;end if;
  end loop;
 end if;
 return true;
end$$;

-- A startup preference selects context, never confers membership, a role or an entitlement.
create function private.frontend_startup_context_allowed(value jsonb,account uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare org uuid;center uuid;discipline uuid;person uuid;schema jsonb;
begin
 if value='null'::jsonb then return true;end if;
 select f->'schema' into schema from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'='user' and f->>'key'='startup_context';
 if not coalesce(private.frontend_setting_valid(value,schema),false) then return false;end if;
 org:=(value->>'org_id')::uuid;center:=(value->>'center_id')::uuid;discipline:=(value->>'discipline_id')::uuid;
 person:=private.person_for(org,account);
 if person is null or not exists(select 1 from core.people p where p.org_id=org and p.id=person and p.state='active')
  or not exists(select 1 from core.organizations o where o.id=org and o.state='active') or private.access_mode(org)='closed' then return false;end if;
 if center is null then return discipline is null;end if;
 if not private.center_accessible(org,center) or not (private.is_org_reader(org,person) or private.is_manager(org,person,center)
  or exists(select 1 from core.center_relationships c where c.org_id=org and c.center_id=center and c.person_id=person and c.state='active')) then return false;end if;
 if discipline is null then return true;end if;
 return exists(select 1 from core.disciplines d join core.center_disciplines c on c.org_id=d.org_id and c.discipline_id=d.id
  where d.org_id=org and d.id=discipline and d.state='active' and c.center_id=center and c.state='active');
end$$;
revoke all on function private.frontend_startup_context_allowed(jsonb,uuid) from public,anon,authenticated;
grant execute on function private.frontend_startup_context_allowed(jsonb,uuid) to service_role;

-- Extend only the accepted settings functions, keeping receipt/version/reset logic intact.
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.frontend_settings_access(jsonb,uuid,uuid,boolean)'::regprocedure);
 old:=' perform pg_advisory_xact_lock(hashtextextended(''frontend.settings.''||private.frontend_settings_key(r,account,person),0));';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'User settings access anchor mismatch';end if;
 b:=replace(b,old,$a$ if r->>'scope'='user' and (r->'patch')?'startup_context' then
  if not private.frontend_setting_valid(r#>'{patch,startup_context}',(select f->'schema' from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'='user' and f->>'key'='startup_context')) then perform private.fail('VALIDATION_FAILED');end if;
  if not private.frontend_startup_context_allowed(r#>'{patch,startup_context}',account) then perform private.fail('NOT_FOUND');end if;
 end if;
$a$||old);execute b;
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 old:=' return jsonb_build_object(''scope'',r->>''scope'',''version'',ver';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'User settings view anchor mismatch';end if;
 b:=replace(b,old,$a$ if r->>'scope'='user' and not private.frontend_startup_context_allowed(values->'startup_context',account) then
  values:=jsonb_set(values,'{startup_context}','null'::jsonb);
 end if;
$a$||old);execute b;
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:='''catalog_version'',1';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'User settings catalog version anchor mismatch';end if;
 execute replace(b,old,'''catalog_version'',2');
end$patch$;
commit;
