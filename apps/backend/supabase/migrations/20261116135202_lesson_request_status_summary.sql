begin;
create index lesson_request_center_status on core.lesson_requests(org_id,center_id,state,created_at,id);
-- Extend the current reader, retaining its canonical-person, live visibility,
-- catalog and outer Auth/subscription/plan gates. No command path changes.
do $patch$
declare b text:=pg_get_functiondef('private.p01_requests_page(jsonb,uuid,uuid,uuid)'::regprocedure);
 a text;scope_sql text;start_at int;end_at int;
begin
 a:=$a$ manager bool:=$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Request status declaration anchor drift';end if;
 b:=replace(b,a,$a$ status_filter text:=coalesce(r->>'status','all');summary jsonb;
$a$||a);
 a:=$a$ if lim<1 or lim>200$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Request status validation anchor drift';end if;
 b:=replace(b,a,$a$ if status_filter not in ('all','pending','alternative_offered','resolved') or (r ? 'catalog' and (r ? 'status' or r ? 'include_summary')) then perform private.fail('VALIDATION_FAILED');end if;
$a$||a);
 -- Read the current exact scope, not a duplicated role/alias implementation.
 start_at:=strpos(b,'from core.lesson_requests q where');
 end_at:=strpos(b,'  and (last_id is null or');
 if start_at=0 or end_at<=start_at then raise exception 'Request summary scope anchor drift';end if;
 scope_sql:=substring(b from start_at for end_at-start_at);
 a:=$a$  and (last_id is null or$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Request status page anchor drift';end if;
 b:=replace(b,a,$a$  and (status_filter='all' or (status_filter='resolved' and q.state in ('approved','rejected','withdrawn','expired')) or q.state=status_filter)
$a$||a);
 a:=$a$ return jsonb_build_object('items',items,'next_cursor',token);$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Request summary response anchor drift';end if;
 b:=replace(b,a,$a$ if coalesce((r->>'include_summary')::bool,false) then
  select jsonb_build_object('pending',count(*) filter(where q.state='pending'),'alternative_offered',count(*) filter(where q.state='alternative_offered'),
   'approved',count(*) filter(where q.state='approved'),'rejected',count(*) filter(where q.state='rejected')) into summary
  $a$||scope_sql||$a$ and q.state in ('pending','alternative_offered','approved','rejected');
 end if;
 return jsonb_build_object('items',items,'next_cursor',token)||case when summary is not null then jsonb_build_object('lesson_request_summary',summary) else '{}'::jsonb end;$a$);
 execute b;
end$patch$;
commit;
