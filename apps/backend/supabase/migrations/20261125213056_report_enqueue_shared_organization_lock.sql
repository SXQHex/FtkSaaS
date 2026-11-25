begin;

-- Enqueue inserts an owned report job. The shared organization lock continues
-- to fence closure. Receipts and the source-job row serialize duplicate writes.
do $migration$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old_lock_group text:=$old$   'products_list_v1','person_get_v1','calendar_get_v1'$old$;
 new_lock_group text:=$new$   'products_list_v1','person_get_v1','calendar_get_v1','report_export_start_v1'$new$;
begin
 if cardinality(string_to_array(body,old_lock_group))<>2 then
  raise exception 'Shared organization lock anchor changed';
 end if;
 execute replace(body,old_lock_group,new_lock_group);
end$migration$;

commit;
