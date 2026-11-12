begin;
alter table core.sessions add column if not exists work_calendar_exception jsonb check(work_calendar_exception is null or jsonb_typeof(work_calendar_exception)='object');
create function private.work_calendar_exception_authorize(org uuid,center uuid,person uuid) returns bigint
language plpgsql stable security invoker set search_path='' as $$
declare ov bigint;enabled boolean;
begin
 if person is null or not coalesce(private.is_manager(org,person,center),false) then perform private.fail('FORBIDDEN');end if;
 select version,coalesce((values->>'work_calendar_exceptions_enabled')::boolean,false) into ov,enabled from private.frontend_settings where scope_key='organization:'||org;
 if not coalesce(enabled,false) then perform private.fail('FORBIDDEN');end if;
 return ov;
end$$;
create function private.work_calendar_exception_assert(org uuid,center uuid,person uuid,e jsonb) returns void
language plpgsql stable security invoker set search_path='' as $$
declare ov bigint:=private.work_calendar_exception_authorize(org,center,person);cv bigint;
begin
 select coalesce((select version from private.frontend_settings where scope_key='center:'||org||':'||center),0) into cv;
 if ov is distinct from (e->>'organization_settings_version')::bigint or cv is distinct from (e->>'settings_version')::bigint then perform private.fail('PREVIEW_STALE');end if;
 if jsonb_typeof(e->'reason') is distinct from 'string' or length(btrim(e->>'reason'))=0 or length(e->>'reason')>1000 then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.schedule_work_calendar_rows(org uuid,center uuid,person uuid,rows_data jsonb,r jsonb) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare proof jsonb;
begin
 if r?'work_calendar_exception' then
  perform private.work_calendar_exception_assert(org,center,person,r->'work_calendar_exception');
  proof:=r->'work_calendar_exception'||jsonb_build_object('approved_by',person,'approved_at',clock_timestamp());
 end if;
 return coalesce((select jsonb_agg((d-'_work_calendar_exception')||case when proof is null then '{}'::jsonb else jsonb_build_object('_work_calendar_exception',proof) end order by n)
 from jsonb_array_elements(rows_data) with ordinality a(d,n)),'[]'::jsonb);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=E' if mutable then\n  payload_digest:=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar exception replay authority drift';end if;
 b:=replace(b,a,' if r?''work_calendar_exception'' or (p_operation in (''program_apply_v1'',''session_change_apply_v1'') and exists(
  select 1 from core.previews p join private.preview_payloads v on v.preview_id=p.id
  where p.org_id=org and p.actor_account_id=actor.id and p.operation=p_operation and p.id=(r#>>''{preview,id}'')::uuid
   and v.token_hash=encode(extensions.digest(r#>>''{preview,token}'',''sha256''),''hex'') and v.payload->''request''?''work_calendar_exception''))
 then perform private.work_calendar_exception_authorize(org,center,person);end if;'||E'\n'||a);
 -- Preview payloads already bind the native actor, center and original request.
 -- Revalidate current permission and both settings versions on apply too.
 a:='private.schedule_validate(org,center,schedule_rows)';
 if strpos(b,a)=0 then raise exception 'Calendar exception schedule rows drift';end if;
 b:=replace(b,a,'private.schedule_validate(org,center,private.schedule_work_calendar_rows(org,center,person,schedule_rows,case when p_operation in (''program_apply_v1'',''session_change_apply_v1'') then preview_data.payload->''request'' else r end))');
 a:='private.schedule_validate(org,center,jsonb_build_array(proposal))';
 if strpos(b,a)=0 then raise exception 'Calendar exception duty write drift';end if;
 b:=replace(b,a,'private.schedule_validate(org,center,private.schedule_work_calendar_rows(org,center,person,jsonb_build_array(proposal),r))');
 a:='   out:=private.schedule_session_view(org,ses.id,org_reader or private.is_manager(org,person,ses.center_id));';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar exception session read drift';end if;
 execute replace(b,a,a||E'\n'||'   if coalesce((r->>''include_work_calendar_exception'')::boolean,false) then if not (org_reader or private.is_manager(org,person,ses.center_id)) then perform private.fail(''FORBIDDEN'');end if;out:=out||jsonb_build_object(''work_calendar_exception'',ses.work_calendar_exception);end if;');
 b:=pg_get_functiondef('private.p02_session_dispatch(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='private.schedule_validate(org,center,jsonb_build_array(proposal))';
 if strpos(b,a)=0 then raise exception 'Calendar exception replacement drift';end if;
 execute replace(b,a,'private.schedule_validate(org,center,private.schedule_work_calendar_rows(org,center,person,jsonb_build_array(proposal),r))');
 b:=pg_get_functiondef('private.schedule_validate(uuid,uuid,jsonb)'::regprocedure);
 -- Only replace the work-calendar guard, leaving room/duty/physical checks intact.
 a:='if not private.center_work_calendar_contains(org,center,(select values->''work_calendar'' from private.frontend_settings where scope_key=''center:''||org||'':''||center),at_time,end_time) then perform private.fail(''RESOURCE_CONFLICT'');end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar exception interval drift';end if;
 execute replace(b,a,'if not private.center_work_calendar_contains(org,center,(select values->''work_calendar'' from private.frontend_settings where scope_key=''center:''||org||'':''||center),at_time,end_time) then
    if not d?''_work_calendar_exception'' then perform private.fail(''RESOURCE_CONFLICT'');end if;
    perform private.work_calendar_exception_assert(org,center,(d#>>''{_work_calendar_exception,approved_by}'')::uuid,d->''_work_calendar_exception'');
   end if;');
 b:=pg_get_functiondef('private.schedule_write(uuid,jsonb,uuid[],integer)'::regprocedure);
 a:='update core.sessions set starts_at=';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar exception update snapshot drift';end if;
 b:=replace(b,a,'update core.sessions set work_calendar_exception=case when coalesce((d->>''_touch'')::boolean,true) then d->''_work_calendar_exception'' else work_calendar_exception end,starts_at=');
 a:='state,attendance_state,assignment_mode)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar exception insert columns drift';end if;
 b:=replace(b,a,'state,attendance_state,assignment_mode,work_calendar_exception)');
 a:='''planned'',''open'',d->>''assignment_mode'')';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar exception insert values drift';end if;
 execute replace(b,a,'''planned'',''open'',d->>''assignment_mode'',d->''_work_calendar_exception'')');
 b:=pg_get_functiondef('private.schedule_snapshot(uuid,uuid)'::regprocedure);
 a:='''_touch'',false,';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Calendar exception historical snapshot drift';end if;
 execute replace(b,a,a||'''_work_calendar_exception'',s.work_calendar_exception,');
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''catalog_version'',20';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Settings closure catalog version drift';end if;
 execute replace(b,a,'''catalog_version'',21');
end$patch$;
revoke all on function private.work_calendar_exception_authorize(uuid,uuid,uuid),private.work_calendar_exception_assert(uuid,uuid,uuid,jsonb),private.schedule_work_calendar_rows(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.work_calendar_exception_authorize(uuid,uuid,uuid),private.work_calendar_exception_assert(uuid,uuid,uuid,jsonb),private.schedule_work_calendar_rows(uuid,uuid,uuid,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
