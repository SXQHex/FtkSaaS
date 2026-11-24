begin;

do $migration$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old_reads text:=$old$   'settings_catalog_get_v1','settings_get_v1','subscription_get_v1'$old$;
 new_reads text:=$new$   'settings_catalog_get_v1','settings_get_v1','subscription_get_v1',
   'products_list_v1'$new$;
begin
 if cardinality(string_to_array(body,old_reads))<>2 then
  raise exception 'Shared organization reads anchor changed';
 end if;
 execute replace(body,old_reads,new_reads);
end$migration$;

commit;
