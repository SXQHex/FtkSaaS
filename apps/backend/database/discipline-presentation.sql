begin;
-- Presentation belongs to the existing organization discipline, not a new catalog.
create function private.discipline_presentation_valid(v jsonb,local boolean default false) returns boolean
 language plpgsql immutable security invoker set search_path='' as $$
declare k text;x jsonb;
begin
 if jsonb_typeof(v) is distinct from 'object' then return false;end if;
 for k,x in select * from jsonb_each(v) loop
  if k='description' then
   if x<>'null'::jsonb and (jsonb_typeof(x)<>'string' or length(x#>>'{}')>2000) then return false;end if;
  elsif k='public_visible' or (not local and k='allow_center_description') then
   if jsonb_typeof(x)<>'boolean' then return false;end if;
  elsif not local and k='color' then
   if x<>'null'::jsonb and (jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^#[0-9A-Fa-f]{6}$') then return false;end if;
  elsif not local and k='icon' then
   if x<>'null'::jsonb and (jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^[a-z][a-z0-9_-]{0,63}$') then return false;end if;
  elsif not local and k='display_order' then
   if jsonb_typeof(x)<>'number' then return false;end if;
   if x::text !~ '^(0|[1-9][0-9]*)$' then return false;end if;
   if (x::text)::numeric>2147483647 then return false;end if;
  else return false;end if;
 end loop;
 return true;
end$$;
alter table core.disciplines add column if not exists presentation jsonb not null default '{"description":null,"color":null,"icon":null,"display_order":0,"public_visible":false,"allow_center_description":false}';
alter table core.disciplines add constraint discipline_presentation_valid check(private.discipline_presentation_valid(presentation) and presentation ?& array['description','color','icon','display_order','public_visible','allow_center_description']);
alter table core.center_disciplines add column if not exists presentation jsonb not null default '{"description":null,"public_visible":false}';
alter table core.center_disciplines add constraint center_discipline_presentation_valid check(private.discipline_presentation_valid(presentation,true) and presentation ?& array['description','public_visible']);

-- This is also checked before receipt replay: an old key cannot bypass a
-- subsequently closed organization permission for local description editing.
create function private.discipline_presentation_access(op text,r jsonb,org uuid) returns void
 language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
begin
 if not r?'presentation' then return;end if;
 if not private.discipline_presentation_valid(r->'presentation',op='center_discipline_set_v1') then perform private.fail('VALIDATION_FAILED');end if;
 if op='center_discipline_set_v1' and r->'presentation'?'description'
  and not coalesce((select (presentation->>'allow_center_description')::boolean from core.disciplines where org_id=org and disciplines.id=(r->>'discipline_id')::uuid),false) then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.discipline_presentation_write(op text,r jsonb,org uuid,center uuid,id uuid) returns void
 language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
begin
 if not r?'presentation' then return;end if;
 perform private.discipline_presentation_access(op,r,org);
 if op='discipline_save_v1' then
  update core.disciplines set presentation=presentation||(r->'presentation') where org_id=org and disciplines.id=discipline_presentation_write.id;
 elsif op='center_discipline_set_v1' then
  update core.center_disciplines set presentation=presentation||(r->'presentation') where org_id=org and center_id=center and center_disciplines.id=discipline_presentation_write.id;
 else perform private.fail('FORBIDDEN');end if;
 if not found then perform private.fail('INTEGRITY_VIOLATION');end if;
end$$;
create function private.discipline_presentation_view(org uuid,discipline uuid,center uuid) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('organization',d.presentation,'center',
  (select jsonb_build_object('id',c.id,'version',c.version,'state',c.state,'presentation',c.presentation)
   from core.center_disciplines c where c.org_id=$1 and c.discipline_id=d.id and c.center_id=$3))
 from core.disciplines d where d.org_id=$1 and d.id=$2
$$;
-- Opt-in public metadata uses the existing profile gate and a hard transport bound.
create function private.disciplines_public(org uuid,center uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare result jsonb:='[]';item jsonb;bytes bigint:=2;
begin
 if private.settings_public_profile(org,center) is null then return '[]'::jsonb;end if;
 for item in select jsonb_build_object('id',d.id,'name',d.name,'description',
  case when center is not null and (d.presentation->>'allow_center_description')::boolean then coalesce(nullif(c.presentation->'description','null'::jsonb),d.presentation->'description') else d.presentation->'description' end,
  'color',d.presentation->'color','icon',d.presentation->'icon','display_order',d.presentation->'display_order')
 from (select x.* from core.disciplines x where x.org_id=org and x.state='active' and (x.presentation->>'public_visible')::boolean
  and (center is null or exists(select 1 from core.center_disciplines cd where cd.org_id=org and cd.center_id=center and cd.discipline_id=x.id and cd.state='active' and (cd.presentation->>'public_visible')::boolean))
  order by (x.presentation->>'display_order')::int,x.id limit 201) d
 left join core.center_disciplines c on c.org_id=d.org_id and c.discipline_id=d.id and c.center_id=center
 order by (d.presentation->>'display_order')::int,d.id loop
  bytes:=bytes+octet_length(item::text)+1;
  if jsonb_array_length(result)>=200 or bytes>2097152 then perform private.fail('SERVICE_UNAVAILABLE');end if;
  result:=result||jsonb_build_array(item);
 end loop;
 return result;
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=E' if mutable then\n  payload_digest:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discipline presentation live replay gate drift';end if;
 b:=replace(b,a,$a$ if p_operation in ('discipline_save_v1','center_discipline_set_v1') then perform private.discipline_presentation_access(p_operation,r,org);end if;
$a$||a);
 a:=' when ''disciplines_list_v1'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discipline reader dispatch drift';end if;
 b:=replace(b,a,a||$a$
  if r->>'center_id' is not null then
   perform private.assert_center(org,(r->>'center_id')::uuid);
   if not org_reader and not private.is_manager(org,person,(r->>'center_id')::uuid) then perform private.fail('FORBIDDEN');end if;
  end if;
$a$);
 a:='select d.* from core.disciplines d where d.org_id=org and';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discipline scoped page drift';end if;
 b:=replace(b,a,a||$a$ (r->>'center_id' is null or exists(select 1 from core.center_disciplines local_d where local_d.org_id=org and local_d.discipline_id=d.id and local_d.center_id=(r->>'center_id')::uuid)) and$a$);
 a:=' if out is null then out:=jsonb_build_object(''operation_id''';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discipline presentation result drift';end if;
 execute replace(b,a,$a$ if p_operation in ('discipline_save_v1','center_discipline_set_v1') then
  perform private.discipline_presentation_write(p_operation,r,org,center,record_id);
  if r?'presentation' then audit_delta:=coalesce(audit_delta,'{}'::jsonb)||jsonb_build_object('presentation',r->'presentation');end if;
 elsif p_operation='disciplines_list_v1' and coalesce((r->>'include_presentation')::boolean,false) then
  out:=jsonb_set(out,'{items}',coalesce((select jsonb_agg(x||jsonb_build_object('presentation',private.discipline_presentation_view(org,(x->>'id')::uuid,(r->>'center_id')::uuid)) order by n)
   from jsonb_array_elements(out->'items') with ordinality e(x,n)),'[]'::jsonb));
 end if;
$a$||a);
 b:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);
 a:=$a$'organization_profile',private.settings_public_profile(private.settings_public_slug(r->>'slug'))$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discipline public organization profile drift';end if;
 b:=replace(b,a,a||$a$||case when coalesce((r->>'include_disciplines')::boolean,false) then jsonb_build_object('disciplines',private.disciplines_public(private.settings_public_slug(r->>'slug'),null)) else '{}'::jsonb end$a$);
 a:=$a$private.settings_public_profile(private.settings_public_slug(r->>'slug'),(r->>'center_id')::uuid) end$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Discipline public center profile drift';end if;
 execute replace(b,a,$a$private.settings_public_profile(private.settings_public_slug(r->>'slug'),(r->>'center_id')::uuid)||case when coalesce((r->>'include_disciplines')::boolean,false) then jsonb_build_object('disciplines',private.disciplines_public(private.settings_public_slug(r->>'slug'),(r->>'center_id')::uuid)) else '{}'::jsonb end end$a$);
end$patch$;
revoke all on function private.discipline_presentation_valid(jsonb,boolean),private.discipline_presentation_access(text,jsonb,uuid),private.discipline_presentation_write(text,jsonb,uuid,uuid,uuid),private.discipline_presentation_view(uuid,uuid,uuid),private.disciplines_public(uuid,uuid) from public,anon,authenticated;
grant execute on function private.discipline_presentation_valid(jsonb,boolean),private.discipline_presentation_access(text,jsonb,uuid),private.discipline_presentation_write(text,jsonb,uuid,uuid,uuid),private.discipline_presentation_view(uuid,uuid,uuid),private.disciplines_public(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
