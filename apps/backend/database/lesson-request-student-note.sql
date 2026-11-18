-- W1-BE-44: optional, self-authored note on a private lesson request.
begin;

alter table core.lesson_requests add column if not exists student_note text
 check (char_length(student_note) between 1 and 1000 and student_note ~ '[^[:space:]]');

do $patch$
declare
 body text;
 anchor text;
begin
 body:=pg_get_functiondef('private.p01_request_access(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=$old$ if actor is null then perform private.fail('FORBIDDEN');end if;$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Request note authority anchor drift';end if;
 execute replace(body,anchor,anchor||$new$
 if op='lesson_request_create_v1' and r?'student_note' then
  if private.p07_same_person(org,actor,target) is not true then perform private.fail('FORBIDDEN');end if;
  if jsonb_typeof(r->'student_note') is distinct from 'string'
   or char_length(r->>'student_note') not between 1 and 1000
   or (r->>'student_note') !~ '[^[:space:]]' then perform private.fail('VALIDATION_FAILED');end if;
 end if;$new$);

 body:=pg_get_functiondef('private.p01_request_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 anchor:=$old$insert into core.lesson_requests(id,org_id,center_id,person_id,format,requested_start,duration_minutes,preferred_instructor_id,state,discipline_id)
   values(entity_id,org,center,(r->>'person_id')::uuid,'private',(r->>'requested_start')::timestamptz,(r->>'duration_minutes')::bigint,instructor,'pending',(r->>'discipline_id')::uuid);$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Request note write anchor drift';end if;
 execute replace(body,anchor,$new$insert into core.lesson_requests(id,org_id,center_id,person_id,format,requested_start,duration_minutes,preferred_instructor_id,state,discipline_id,student_note)
   values(entity_id,org,center,(r->>'person_id')::uuid,'private',(r->>'requested_start')::timestamptz,(r->>'duration_minutes')::bigint,instructor,'pending',(r->>'discipline_id')::uuid,r->>'student_note');$new$);

 body:=pg_get_functiondef('private.p01_requests_page(jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=$old$(to_jsonb(q)-'org_id')||$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Request note read anchor drift';end if;
 execute replace(body,anchor,$new$(to_jsonb(q)-'org_id'-'student_note')||
  case when q.student_note is not null and (private.p07_same_person(org,actor,q.person_id)
   or private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'request.resolve'))
  then jsonb_build_object('student_note',q.student_note) else '{}'::jsonb end||$new$);

 -- The receipt payload digest is calculated before tracking. Keep the note
 -- in the request row and omit it from the stored authorization context.
 body:=pg_get_functiondef('private.p06_capture(text,jsonb,uuid,uuid,uuid,text,jsonb)'::regprocedure);
 anchor:=$old$private.p06_scrub(r),subject$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Request note tracking anchor drift';end if;
 execute replace(body,anchor,$new$private.p06_scrub(case when op='lesson_request_create_v1' then r-'student_note' else r end),subject$new$);
end$patch$;

commit;
