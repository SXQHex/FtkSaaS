begin;

-- Project the center of the session already selected by the existing read scope.
do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor constant text:=$old$   out:=private.schedule_session_view(org,ses.id,org_reader or private.is_manager(org,person,ses.center_id));$old$;
begin
 if cardinality(string_to_array(body,anchor))<>2 then raise exception 'Session center projection anchor changed';end if;
 execute replace(body,anchor,anchor||$new$
   if r->'include_center_id'='true'::jsonb then
    out:=out||jsonb_build_object('center_id',ses.center_id);
   end if;$new$);
end$patch$;

commit;
