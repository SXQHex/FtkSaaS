begin;
-- This calendar is a center-wide constraint, distinct from resource hours and
-- public presentation hours. Null adds no constraint to existing resource gates.
create function private.center_work_calendar_valid(value jsonb) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare rule jsonb;closure jsonb;
begin
 if value='null'::jsonb then return true;end if;
 if not private.frontend_setting_valid(value,(select schema from (select f->'schema' schema from jsonb_array_elements(private.frontend_settings_fields()) f where f->>'scope'='center' and f->>'key'='work_calendar') s)) then return false;end if;
 for rule in select * from jsonb_array_elements(value->'rules') loop
  if (rule->>'local_start')::time>=(rule->>'local_end')::time or (rule->>'valid_until')::date<=(rule->>'valid_from')::date then return false;end if;
 end loop;
 for closure in select * from jsonb_array_elements(value->'closures') loop
  if btrim(closure->>'reason')='' or not isfinite((closure->>'starts_at')::timestamptz) or not isfinite((closure->>'ends_at')::timestamptz) or (closure->>'starts_at')::timestamptz>=(closure->>'ends_at')::timestamptz then return false;end if;
 end loop;
 return true;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return false;
end$$;
create function private.center_work_calendar_contains(org uuid,center uuid,value jsonb,starts timestamptz,ends timestamptz)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare tz text;coverage tstzmultirange;
begin
 if starts>=ends or not isfinite(starts) or not isfinite(ends) then return false;end if;
 if value is null or value='null'::jsonb then return true;end if;
 select timezone into tz from core.centers where org_id=org and id=center;
 if tz is null then perform private.fail('NOT_FOUND');end if;
 if exists(select 1 from jsonb_array_elements(value->'closures') c where (c->>'starts_at')::timestamptz<ends and (c->>'ends_at')::timestamptz>starts) then return false;end if;
 select coalesce(range_agg(private.availability_day_window(d::date,r->>'local_start',r->>'local_end',tz)),'{}'::tstzmultirange) into coverage
 from generate_series(least((starts at time zone tz)::date,(ends at time zone tz)::date)::timestamp,greatest((starts at time zone tz)::date,(ends at time zone tz)::date)::timestamp,interval '1 day') d
 cross join jsonb_array_elements(value->'rules') r
 where extract(isodow from d)::int in(select wd.day::int from jsonb_array_elements_text(r->'weekdays') wd(day))
 and d::date>=(r->>'valid_from')::date and (r->>'valid_until' is null or d::date<(r->>'valid_until')::date);
 return coverage @> tstzrange(starts,ends,'[)');
end$$;
create function private.center_work_calendar_impact(org uuid,center uuid,value jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 with affected as(select s.id,s.version,s.starts_at,s.ends_at from core.sessions s where s.org_id=org and s.center_id=center and s.state<>'cancelled' and s.ends_at>clock_timestamp()
 and not private.center_work_calendar_contains(org,center,value,s.starts_at,s.ends_at)),first_page as(select * from affected order by starts_at,id limit 200)
 select jsonb_build_object('count',(select count(*) from affected),'truncated',(select count(*)>200 from affected),'sessions',coalesce((select jsonb_agg(to_jsonb(p) order by starts_at,id) from first_page p),'[]'))
$$;
create function private.center_work_calendar_patch(r jsonb,patch jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if not patch?'work_calendar' then return;end if;
 if not private.center_work_calendar_valid(patch->'work_calendar') then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'scope'='center' and (private.center_work_calendar_impact((r->>'org_id')::uuid,(r->>'center_id')::uuid,patch->'work_calendar')->>'count')::bigint>0 then perform private.fail('OPEN_OPERATIONS_EXIST');end if;
end$$;
create function private.center_work_calendar_management(r jsonb,org uuid,center uuid,person uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare k jsonb:=r#>'{selector,key}';v jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or not coalesce(private.is_manager(org,person,center),false) then perform private.fail('FORBIDDEN');end if;
 perform private.assert_center(org,center);perform private.require_feature(org,'F02');
 if r#>>'{selector,operation}'<>'settings_update_v1' or k->>'scope'<>'center' or not k?'work_calendar' or r#>>'{page,cursor}' is not null then perform private.fail('VALIDATION_FAILED');end if;
 if not private.center_work_calendar_valid(k->'work_calendar') then perform private.fail('VALIDATION_FAILED');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','centers','id',center) then perform private.fail('NOT_FOUND');end if;
 v:=jsonb_build_object('scope','center','work_calendar',k->'work_calendar','settings_version',coalesce((select version from private.frontend_settings where scope_key='center:'||org||':'||center),0),'work_calendar_impact',private.center_work_calendar_impact(org,center,k->'work_calendar'));
 return jsonb_build_object('items',jsonb_build_array(jsonb_build_object('operation','settings_update_v1','entity',jsonb_build_object('type','centers','id',center),'exists',true,'state','active',
 'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','centers','id',center),'version',(select version from core.centers where id=center))),'as_of',at,'current',jsonb_build_object('operation','settings_update_v1','values',v))),'next_cursor',null,'as_of',at);
end$$;
-- Reuse the existing startup-copy provenance. Only this field permits a
-- non-array snapshot; the three existing preparation formats remain arrays.
alter table private.center_domain_preparation_origins drop constraint center_domain_preparation_origins_field_check;
alter table private.center_domain_preparation_origins add constraint center_domain_preparation_origins_field_check check(field in ('availability_templates','package_templates','program_templates','work_calendar'));
alter table private.center_domain_preparation_origins drop constraint center_domain_preparation_origins_snapshot_check;
alter table private.center_domain_preparation_origins add constraint center_domain_preparation_origins_snapshot_check check((field='work_calendar' and jsonb_typeof(snapshot) in ('object','null')) or (field<>'work_calendar' and jsonb_typeof(snapshot)='array'));
do $patch$
declare b text;a text;fn record;
begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('domain_preparation_copy','domain_preparation_sources') loop
  b:=pg_get_functiondef(fn.signature);a:='array[''availability_templates'',''package_templates'',''program_templates'']';
  if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work calendar startup copy drift';end if;
  execute replace(b,a,'array[''availability_templates'',''package_templates'',''program_templates'',''work_calendar'']');
 end loop;
 b:=pg_get_functiondef('private.frontend_settings_patch(jsonb,jsonb,uuid)'::regprocedure);
 a:='perform private.pro_preparation_patch(r,patch);';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work calendar settings validation drift';end if;
 execute replace(b,a,a||'perform private.center_work_calendar_patch(r,patch);');
 b:=pg_get_functiondef('private.schedule_validate(uuid,uuid,jsonb)'::regprocedure);
 a:='  if coalesce((d->>''_touch'')::bool,true) then';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work calendar schedule interval enforcement drift';end if;
 execute replace(b,a,a||E'\n'||$a$   if not private.center_work_calendar_contains(org,center,(select values->'work_calendar' from private.frontend_settings where scope_key='center:'||org||':'||center),at_time,end_time) then perform private.fail('RESOURCE_CONFLICT');end if;$a$);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Work calendar impact reader drift';end if;
 execute replace(b,a,$a$ if p_operation='management_state_get_v1' and r->>'operation'='settings_update_v1' then
  out:=private.center_work_calendar_management(r,org,center,person);return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$a$||a);
end$patch$;
revoke all on function private.center_work_calendar_valid(jsonb),private.center_work_calendar_contains(uuid,uuid,jsonb,timestamptz,timestamptz),private.center_work_calendar_impact(uuid,uuid,jsonb),private.center_work_calendar_patch(jsonb,jsonb),private.center_work_calendar_management(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.center_work_calendar_valid(jsonb),private.center_work_calendar_contains(uuid,uuid,jsonb,timestamptz,timestamptz),private.center_work_calendar_impact(uuid,uuid,jsonb),private.center_work_calendar_patch(jsonb,jsonb),private.center_work_calendar_management(jsonb,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
