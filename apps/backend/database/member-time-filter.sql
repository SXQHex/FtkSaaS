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
commit;
