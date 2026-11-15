begin;
-- Two selected merge records can reuse the exact page-summary semantics,
-- without guessing currencies or fetching their reservation histories.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$ if p_operation='people_list_v1' and coalesce((r->>'include_member_summary')::boolean,false) then$a$;
 if strpos(b,a)=0 then raise exception 'Selected person summary anchor drift';end if;
 b:=replace(b,a,$a$ if p_operation='person_get_v1' and coalesce((r->>'include_member_summary')::boolean,false) then
  if center is null then perform private.fail('VALIDATION_FAILED');end if;
  out:=out||jsonb_build_object('member_summary',private.member_page_summary(org,center,person,(r->>'person_id')::uuid));
 end if;
$a$||a);
 execute b;
end$patch$;
commit;
