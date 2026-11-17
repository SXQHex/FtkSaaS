-- Request notifications navigate to the native request reader, never select a
-- write action on the recipient's behalf. The reader owns live row visibility.
begin;
do $patch$
declare b text:=pg_get_functiondef('private.notification_source_state(core.notifications,uuid)'::regprocedure);a text;
begin
 a:=$a$perform private.p01_request_access('lesson_request_withdraw_v1',req,n.org_id,actor,c);$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Notification request reader anchor drift';end if;
 b:=replace(b,a,$a$if not exists(select 1 from jsonb_array_elements(private.p01_requests_page(
   req||jsonb_build_object('operation','lesson_request_create_v1','page',jsonb_build_object('limit',1)),n.org_id,actor,c)->'items') item
   where item#>>'{entity,id}'=l.id::text) then return empty;end if;$a$);
 a:=$a$'lesson_request_withdraw_v1'$a$;
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Notification request read selector anchor drift';end if;
 execute replace(b,a,$a$'lesson_request_create_v1'$a$);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$if r->>'operation'='lesson_request_create_v1' and r#>>'{selector,key,person_id}' is null then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Native request detail dispatch anchor drift';end if;
 execute replace(b,a,$a$if r->>'operation'='lesson_request_create_v1' and r#>>'{selector,key,lesson_request_id}' is not null then
   -- F09 and the outer account/org/billing gates already ran. Exact row read
   -- uses the same native page visibility as the request directory.
   perform private.p01_requests_page(r||(r#>'{selector,key}'),org,person,center);
  elsif r->>'operation'='lesson_request_create_v1' and r#>>'{selector,key,person_id}' is null then$a$);
end$patch$;
commit;
