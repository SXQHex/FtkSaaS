begin;
-- Student history is not current status: an active relationship wins over
-- inactive rows in the same center and canonical person/alias component.
create function private.student_status_matches(org uuid,person uuid,center uuid,status text) returns boolean
language sql stable security invoker set search_path='' as $$
 with members as materialized(select private.p07_person_members($1,$2) ids),
 states as(select coalesce(bool_or(cr.state='active'),false) active,coalesce(bool_or(cr.state='inactive'),false) inactive
  from core.center_relationships cr where cr.org_id=$1 and cr.center_id=$3 and cr.kind='student'
   and cr.person_id=any((select ids from members)::uuid[]))
 select case $4 when 'active' then active when 'inactive' then inactive and not active else false end from states
$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text;
begin
 a:=$a$ when 'people_list_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Student status dispatch anchor drift';end if;
 b:=replace(b,a,a||$a$
  if r?'student_status' and (center is null or r->>'student_status' is null or r->>'student_status' not in ('active','inactive')
   or (r->>'relationship' is not null and r->>'relationship'<>'student')) then perform private.fail('VALIDATION_FAILED');end if;$a$);
 a:=$a$    and (r->>'relationship' is null or exists$a$;
 -- The optimized self route and normal route both filter before keyset/limit.
 if array_length(string_to_array(b,a),1)<>3 then raise exception 'Student status page route anchor drift';end if;
 b:=replace(b,a,$a$    and (r->>'student_status' is null or private.student_status_matches(org,p.id,center,r->>'student_status'))
$a$||a);
 execute b;
end$patch$;
-- Existing cursor digest includes the whole request except request_id/page;
-- student_status, center, query and relationship are therefore all bound.
revoke all on function private.student_status_matches(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.student_status_matches(uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
