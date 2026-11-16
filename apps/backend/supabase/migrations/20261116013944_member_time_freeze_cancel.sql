-- W1-BE-13/14: cursor-bound start-time partitions and planned freeze cancellation.
begin;
-- Add a start-time partition to the current reader without replacing its live
-- canonical-person, Starter, assignment, capacity or calendar guards.
do $patch$
declare b text:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);p record;
 scope_expr text:=$s$encode(extensions.digest((jsonb_build_object('request',r-'request_id'-'page','actor',actor,'operation',op,'sort',sort_name)||case when time_filter is not null then jsonb_build_object('time_filter_at',filter_at) else '{}'::jsonb end)::text,'sha256'),'hex')$s$;
begin
 for p in select * from (values
  ($a$ lo timestamptz:=$a$,$a$ time_filter text:=case when op='reservation_list_v1' then r->>'time_filter' end;filter_at timestamptz:=statement_timestamp();
 lo timestamptz:=$a$),
  ($a$ if lim<1 or lim>200$a$,$a$ if time_filter is not null and time_filter not in ('all','upcoming','past') then perform private.fail('VALIDATION_FAILED');end if;
 if lim<1 or lim>200$a$),
  ($a$encode(extensions.digest(jsonb_build_object('request',r-'request_id'-'page','actor',actor,'operation',op,'sort',sort_name)::text,'sha256'),'hex')$a$,scope_expr),
  ($a$cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;$a$,$a$cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'UTF8')::jsonb;
   if time_filter is not null then
    filter_at:=(cur->>'time_filter_at')::timestamptz;
    if filter_at is null or not isfinite(filter_at) then perform private.fail('VALIDATION_FAILED');end if;
    scope_hash:=$a$||scope_expr||$a$;
   end if;$a$),
  ($a$and (lo is null or (s.starts_at<hi and s.ends_at>lo))$a$,$a$and (lo is null or (s.starts_at<hi and s.ends_at>lo))
   and (time_filter is null or time_filter='all' or (time_filter='upcoming' and s.starts_at>=filter_at) or (time_filter='past' and s.starts_at<filter_at))$a$),
  ($a$'scope',scope_hash,'at',last_item->>'_at'$a$,$a$'scope',scope_hash,'time_filter_at',case when time_filter is not null then filter_at end,'at',last_item->>'_at'$a$),
  ($a$'as_of',now()$a$,$a$'as_of',case when time_filter is not null then filter_at else now() end$a$)
 ) x(anchor,replacement) loop
  if array_length(string_to_array(b,p.anchor),1)<>2 then raise exception 'Member time filter anchor drift: %',p.anchor;end if;
  b:=replace(b,p.anchor,p.replacement);
 end loop;
 execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 if array_length(string_to_array(b,$a$then out:=out||jsonb_build_object('as_of',now());end if;$a$),1)<>2 then raise exception 'Member cutoff response anchor drift';end if;
 execute replace(b,$a$then out:=out||jsonb_build_object('as_of',now());end if;$a$,$a$and not (p_operation='reservation_list_v1' and r ? 'time_filter') then out:=out||jsonb_build_object('as_of',now());end if;$a$);
end$patch$;
-- Extend the existing lifecycle so its locks, preview ownership, protection,
-- notifications and receipt machinery stay the single mutation path.
do $patch$
declare b text:=pg_get_functiondef('private.p02_freeze(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);p record;
begin
 for p in select * from (values
  ($a$is_end bool:=op in ('freeze_end_preview_v1','freeze_end_apply_v1');$a$,$a$is_cancel bool:=op in ('freeze_cancel_preview_v1','freeze_cancel_apply_v1');is_end bool:=op in ('freeze_end_preview_v1','freeze_end_apply_v1');$a$),
  ($a$is_preview bool:=op in ('freeze_preview_v1','freeze_end_preview_v1')$a$,$a$is_preview bool:=op in ('freeze_preview_v1','freeze_end_preview_v1','freeze_cancel_preview_v1')$a$),
  ($a$ if is_end then
  select * into f$a$,$a$ if is_end or is_cancel then
  select * into f$a$),
  ($a$ if is_end then
  if f.state$a$,$a$ if is_cancel then
  if not is_preview and private.p02_dependencies(org,center,account,s.id)<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
  if f.state<>'scheduled' or f.actual_end is not null or f.starts_at<=clock_timestamp() then
   if not is_preview then perform private.fail('PREVIEW_STALE');end if;
   perform private.fail('INVALID_STATE_TRANSITION');
  end if;
  starts:=f.starts_at;ends:=f.planned_end;
  remaining_days:=(ends at time zone s.timezone)::date-(starts at time zone s.timezone)::date;
  if coalesce((p.freeze_terms->>'extends_validity')::bool,false) then new_end:=s.end_date-remaining_days;else remaining_days:=0;end if;
  effects:=jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','freezes','id',f.id),'action','cancel','reason',reason),jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'action','adjust','quantity',remaining_days,'reason',reason));
 elsif is_end then
  if f.state$a$),
  ($a$  insert into core.previews(id,org_id$a$,$a$  if is_cancel then data:=data||jsonb_build_object('freeze_cancellation',jsonb_build_object('freeze_id',f.id,'sale_id',s.id,'state','cancelled','removed_extension_days',remaining_days,'previous_end_date',s.end_date,'end_date',new_end,'valid_until',new_end::timestamp at time zone s.timezone,'preserves_reservations',true));end if;
  insert into core.previews(id,org_id$a$),
  ($a$case when is_end then 'freeze_end' else 'freeze' end$a$,$a$case when is_cancel then 'freeze_cancel' when is_end then 'freeze_end' else 'freeze' end$a$),
  ($a$ if is_end then
  update core.freezes$a$,$a$ if is_cancel then
  if f.starts_at<=clock_timestamp() then perform private.fail('PREVIEW_STALE');end if;
  -- The interval never ran: retain its planned dates and leave actual_end null.
  update core.freezes set state='cancelled',extension_until=null,version=version+1 where org_id=org and id=f.id returning version into ver;pid:=f.id;
 elsif is_end then
  update core.freezes$a$)
 ) x(anchor,replacement) loop
  if array_length(string_to_array(b,p.anchor),1)<>2 then raise exception 'Freeze cancellation anchor drift: %',p.anchor;end if;
  b:=replace(b,p.anchor,p.replacement);
 end loop;
 execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 for p in select * from (values
  ($a$p_operation in ('freeze_preview_v1','freeze_end_preview_v1')$a$,$a$p_operation in ('freeze_preview_v1','freeze_end_preview_v1','freeze_cancel_preview_v1')$a$),
  ($a$when 'freeze_preview_v1','freeze_apply_v1','freeze_end_preview_v1','freeze_end_apply_v1' then$a$,$a$when 'freeze_preview_v1','freeze_apply_v1','freeze_end_preview_v1','freeze_end_apply_v1','freeze_cancel_preview_v1','freeze_cancel_apply_v1' then$a$)
 ) x(anchor,replacement) loop
  if array_length(string_to_array(b,p.anchor),1)<>2 then raise exception 'Freeze cancellation dispatcher anchor drift';end if;
  b:=replace(b,p.anchor,p.replacement);
 end loop;
 execute b;
end$patch$;
revoke all on function private.p02_freeze(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.p02_freeze(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('freeze_cancel_preview_v1','entitlement.correct','maintenance',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.freeze_cancel_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('freeze_cancel_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.freeze_cancel_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.freeze_cancel_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('freeze_cancel_apply_v1','entitlement.correct','maintenance',array['F17']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.freeze_cancel_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('freeze_cancel_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.freeze_cancel_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.freeze_cancel_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
