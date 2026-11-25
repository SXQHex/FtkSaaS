begin;

create index invitation_ticks_retention_idx on private.invitation_ticks(created_at,request_id);

-- Keep the same bounded retention sweep and signed-tick replay behavior.
do $migration$
declare
 body text:=pg_get_functiondef('private.invitation_worker(jsonb,jsonb)'::regprocedure);
 old_sweep text:=$old$where created_at<clock_timestamp()-interval '1 day' order by created_at limit 100$old$;
 new_sweep text:=$new$where created_at<statement_timestamp()-interval '1 day' order by created_at,request_id limit 100$new$;
begin
 if cardinality(string_to_array(body,old_sweep))<>2 then
  raise exception 'Invitation tick retention anchor changed';
 end if;
 execute replace(body,old_sweep,new_sweep);
end$migration$;

commit;
