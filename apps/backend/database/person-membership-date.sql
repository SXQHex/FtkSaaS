begin;
-- User decision: membership means the first recorded student relationship in
-- the selected center, including inactive history and canonical aliases.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$ if p_operation='people_list_v1' and coalesce((r->>'include_member_summary')::boolean,false) then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Membership date projection anchor drift';end if;
 execute replace(b,a,$a$ if p_operation='person_get_v1' and coalesce((r->>'include_membership_date')::boolean,false) then
  if center is null then perform private.fail('VALIDATION_FAILED');end if;
  out:=out||jsonb_build_object('membership_started_at',(select min(c.started_at) from core.center_relationships c
   where c.org_id=org and c.center_id=center and c.kind='student' and c.person_id=any(private.p07_person_members(org,(r->>'person_id')::uuid))));
 end if;
$a$||a);
end$patch$;
commit;
