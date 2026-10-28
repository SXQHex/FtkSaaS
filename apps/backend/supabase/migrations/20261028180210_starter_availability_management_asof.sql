begin;
-- Preserve this selector's snapshot bound instead of replacing it in the shared list envelope.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='if out ? ''items'' and p_operation not in';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Availability list envelope anchor drift';end if;
 execute replace(b,a,'if out ? ''items'' and not (p_operation=''management_state_get_v1'' and r->>''operation''=''availability_save_v1'') and p_operation not in');
end$patch$;
commit;
