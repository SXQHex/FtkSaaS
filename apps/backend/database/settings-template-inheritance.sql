begin;
-- Explicit live inheritance is limited to shared, non-financial templates.
-- Program/package/timezone startup copies and center identity remain local.
create table private.settings_template_inheritance(
 scope_key text not null,field text not null check(field in ('report_templates','import_templates','agreement_templates','permission_templates')),
 org_id uuid not null references core.organizations(id) on delete cascade,primary key(scope_key,field)
);
alter table private.settings_template_inheritance enable row level security;
revoke all on private.settings_template_inheritance from public,anon,authenticated;
grant select,insert,delete on private.settings_template_inheritance to service_role;
create function private.settings_effective_values(skey text,local_values jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(local_values,'{}'::jsonb)||coalesce((select jsonb_object_agg(i.field,coalesce(s.values->i.field,private.frontend_settings_defaults('organization')->i.field))
 from private.settings_template_inheritance i left join private.frontend_settings s on s.scope_key='organization:'||i.org_id where i.scope_key=skey),'{}'::jsonb)
$$;
create function private.settings_template_sources(skey text) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(i.field,jsonb_build_object('kind','organization_inherited','organization_version',coalesce(s.version,0))),'{}'::jsonb)
 from private.settings_template_inheritance i left join private.frontend_settings s on s.scope_key='organization:'||i.org_id where i.scope_key=skey
$$;
create function private.settings_template_invalidation() returns trigger language plpgsql security invoker set search_path='' as $$
declare previous_values jsonb;
begin
 if TG_OP='INSERT' then previous_values:='{}'::jsonb;else previous_values:=old.values;end if;
 if new.scope='organization' then
  update private.frontend_settings c set version=c.version+1 where c.scope='center' and exists(
   select 1 from private.settings_template_inheritance i where i.scope_key=c.scope_key and 'organization:'||i.org_id=new.scope_key
    and new.values->i.field is distinct from previous_values->i.field);
 end if;return new;
end$$;
create trigger settings_template_invalidation after insert or update of values on private.frontend_settings for each row execute function private.settings_template_invalidation();
do $patch$
declare b text;a text;fn record;
begin
 b:=pg_get_functiondef('private.frontend_settings_view(jsonb,uuid,uuid)'::regprocedure);
 a:=$anchor$private.frontend_settings_defaults(r->>'scope')||coalesce(doc.values,'{}')$anchor$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Effective settings view drift';end if;
 b:=replace(b,a,$branch$private.frontend_settings_defaults(r->>'scope')||private.settings_effective_values(private.frontend_settings_key(r,account,person),doc.values)$branch$);
 a:='''as_of'',clock_timestamp())';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Inherited field source view drift';end if;
 execute replace(b,a,a||$branch$||case when r->>'scope'='center' then jsonb_build_object('inherited_fields',private.settings_template_sources(private.frontend_settings_key(r,account,person))) else '{}'::jsonb end$branch$);
 b:=pg_get_functiondef('private.frontend_settings_access(jsonb,uuid,uuid,boolean)'::regprocedure);
 a:=' -- Same lock serializes absent-row creation, writes, reset preview and receipt replay.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Inheritance authority preflight drift';end if;
 execute replace(b,a,$branch$ if r?'inherit_fields' then
  if scope<>'center' or r?'history_source' or jsonb_typeof(r->'inherit_fields')<>'array' or jsonb_array_length(r->'inherit_fields') not between 1 and 4
   or exists(select 1 from jsonb_array_elements_text(r->'inherit_fields') k where k not in ('report_templates','import_templates','agreement_templates','permission_templates') or r->'patch'?k)
   or (select count(*)<>count(distinct x) from jsonb_array_elements(r->'inherit_fields') x) then perform private.fail('VALIDATION_FAILED');end if;
  perform private.frontend_settings_field_access(scope,r->'inherit_fields',org,person);
 end if;
$branch$||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$anchor$ elsif not (r?'logo_image') then perform private.fail('VALIDATION_FAILED');end if;$anchor$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Inheritance empty patch semantics drift';end if;
 b:=replace(b,a,$branch$ elsif not (r?'logo_image' or r?'inherit_fields') then perform private.fail('VALIDATION_FAILED');end if;$branch$);
 a:=' if op=''settings_update_v1'' then';
 -- There is one normal update branch; the earlier history-source guard also
 -- contains the operation name but does not match this complete anchor.
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Inheritance mutation branch drift';end if;
 b:=replace(b,a,$branch$ if op='settings_update_v1' then
  delete from private.settings_template_inheritance i where i.scope_key=skey and r->'patch'?i.field;
  if r?'inherit_fields' then
   for field in select jsonb_array_elements_text(r->'inherit_fields') loop
    local:=local-field;
    insert into private.settings_template_inheritance(scope_key,field,org_id) values(skey,field,org) on conflict on constraint settings_template_inheritance_pkey do nothing;
   end loop;
  end if;
$branch$);
 a:='  keys:=p.fields;patch:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Inherited reset semantics drift';end if;
 execute replace(b,a,'  delete from private.settings_template_inheritance i where i.scope_key=skey and p.fields ? i.field;'||E'\n'||a);
 -- The same resolver is used by the actual catalogue and preparation consumers.
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('permission_preparation_resolve','permission_preparations_available','agreement_preparation_resolve','agreement_preparations_available','work_template_resolve','work_templates_available') loop
  b:=pg_get_functiondef(fn.signature);
  if strpos(b,'doc.values->')=0 then raise exception 'Inherited template consumer drift: %',fn.signature;end if;
  execute replace(b,'doc.values->','private.settings_effective_values(doc.scope_key,doc.values)->');
 end loop;
end$patch$;
revoke all on function private.settings_effective_values(text,jsonb),private.settings_template_sources(text),private.settings_template_invalidation() from public,anon,authenticated;
grant execute on function private.settings_effective_values(text,jsonb),private.settings_template_sources(text),private.settings_template_invalidation() to service_role;
notify pgrst,'reload schema';
commit;
