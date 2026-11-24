begin;

do $migration$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old_lock text:=$old$  ) then
   -- Reads can overlap, but still conflict with organization writes and revocations.$old$;
 new_lock text:=$new$  ) or (
   p_operation='management_state_get_v1'
   and r->>'operation' in ('center_discipline_set_v1','availability_exception_save_v1')
   and r#>>'{selector,operation}'=r->>'operation'
  ) then
   -- Reads can overlap, but still conflict with organization writes and revocations.$new$;
begin
 if cardinality(string_to_array(body,old_lock))<>2 then
  raise exception 'Shared organization access lock anchor changed';
 end if;
 execute replace(body,old_lock,new_lock);
end$migration$;

commit;
