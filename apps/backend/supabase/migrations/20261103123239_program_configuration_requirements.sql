-- Preserve schedule guards; expose only an agreement-specific prerequisite on previews.
begin;
create or replace function private.schedule_configuration_requirement(error_detail text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare data jsonb;person uuid;discipline uuid;at_time timestamptz;
begin
 if error_detail is null or error_detail='' then return null;end if;
 data:=error_detail::jsonb;
 if jsonb_typeof(data)<>'object' or data->>'kind' is distinct from 'schedule_instructor_agreement'
  or jsonb_typeof(data->'person_id') is distinct from 'string'
  or jsonb_typeof(data->'discipline_id') is distinct from 'string'
  or jsonb_typeof(data->'starts_at') is distinct from 'string'
  or data->>'format' is null or data->>'format' not in ('group','private') then return null;end if;
 person:=(data->>'person_id')::uuid;discipline:=(data->>'discipline_id')::uuid;at_time:=(data->>'starts_at')::timestamptz;
 if not isfinite(at_time) then return null;end if;
 -- Rebuild a closed allowlist. Never expose raw exception DETAIL or fee/SQL data.
 return jsonb_build_object('blocker_index',0,'kind','instructor_agreement','person_id',person,'discipline_id',discipline,'format',data->>'format','starts_at',at_time);
 exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
  return null;
end$$;

do $patch$
declare body text;old text;replacement text;
begin
 body:=pg_get_functiondef('private.schedule_resolve_agreements(uuid,uuid,uuid,text,timestamptz,jsonb)'::regprocedure);
 old:='perform private.fail(''POLICY_NOT_CONFIGURED'');';
 replacement:=$new$raise exception using errcode='P0001',message='POLICY_NOT_CONFIGURED',
  detail=jsonb_build_object('kind','schedule_instructor_agreement','person_id',d->'person_id','discipline_id',discipline,'format',format_name,'starts_at',at_time)::text;$new$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>2 then raise exception 'Agreement prerequisite anchors missing';end if;
 execute replace(body,old,replacement);

 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:='schedule_blockers jsonb;';
 if strpos(body,old)=0 then raise exception 'Schedule declaration anchor missing';end if;
 body:=replace(body,old,old||'schedule_error_detail text;schedule_requirement jsonb;');
 old:=$old$exception when sqlstate 'P0001' then
   schedule_blockers:=jsonb_build_array(jsonb_build_object('code',SQLERRM,'retryable',false,'trace_id',trace));
  end;$old$;
 replacement:=$new$exception when sqlstate 'P0001' then
   schedule_blockers:=jsonb_build_array(jsonb_build_object('code',SQLERRM,'retryable',false,'trace_id',trace));
   if SQLERRM='POLICY_NOT_CONFIGURED' then
    get stacked diagnostics schedule_error_detail=PG_EXCEPTION_DETAIL;
    schedule_requirement:=private.schedule_configuration_requirement(schedule_error_detail);
   end if;
  end;$new$;
 if strpos(body,old)=0 then raise exception 'Schedule error anchor missing';end if;
 body:=replace(body,old,replacement);
 old:=$old$if schedule_class is not null then out:=out||jsonb_build_object('class_version'$old$;
 replacement:=$new$if schedule_requirement is not null then out:=out||jsonb_build_object('configuration_requirement',schedule_requirement);end if;
  if schedule_class is not null then out:=out||jsonb_build_object('class_version'$new$;
 if strpos(body,old)=0 then raise exception 'Schedule preview result anchor missing';end if;
 execute replace(body,old,replacement);
end$patch$;
revoke all on function private.schedule_configuration_requirement(text) from public,anon,authenticated;
grant execute on function private.schedule_configuration_requirement(text) to service_role;
notify pgrst,'reload schema';
commit;
