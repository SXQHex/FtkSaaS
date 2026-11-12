begin;
create function private.personal_negative_limits_enabled(org uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((values->>'personal_negative_limits_enabled')::boolean,false)
 from (select (select values from private.frontend_settings where scope_key='organization:'||org) values) s
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.lesson_impact_authorize(uuid,uuid,uuid,jsonb)'::regprocedure);
 a:=' elsif change->>''kind''=''negative_limit'' then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Personal negative delegation authority drift';end if;
 execute replace(b,a,a||E'\n  if change ? ''allowed_negative_credits'' and not private.personal_negative_limits_enabled(org) then perform private.fail(''FORBIDDEN'');end if;');
 b:=pg_get_functiondef('private.lesson_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='result:=private.lesson_limits(org,center,(r->>''person_id'')::uuid,(r->>''discipline_id'')::uuid)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Personal negative delegation discovery drift';end if;
 execute replace(b,a,a||'||case when coalesce((r->>''include_delegation'')::boolean,false) then jsonb_build_object(''personal_override_enabled'',private.personal_negative_limits_enabled(org)) else ''{}''::jsonb end');
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=E' if mutable then\n  payload_digest:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Personal negative delegation replay gate drift';end if;
 execute replace(b,a,' if p_operation=''negative_limit_set_v1'' and not private.personal_negative_limits_enabled(org) then perform private.fail(''FORBIDDEN'');end if;'||E'\n'||a);
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',19';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Settings completion catalog version drift';end if;
 execute replace(b,a,'''catalog_version'',20');
end$patch$;
revoke all on function private.personal_negative_limits_enabled(uuid) from public,anon,authenticated;
grant execute on function private.personal_negative_limits_enabled(uuid) to service_role;
notify pgrst,'reload schema';
commit;
