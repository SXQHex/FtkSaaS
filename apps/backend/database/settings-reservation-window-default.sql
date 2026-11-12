begin;
-- User decision, 12 November 2026: every new commercial organization starts
-- with a seven-day reservation window. Existing policy histories are unchanged.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
a text:=$a$(private.new_id(p_ids,33),org,null,'debt_participation',transaction_timestamp(),false,'{"kind":"boolean","value":true}'::jsonb,null,1);$a$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Initial reservation window anchor drift';end if;
 b:=replace(b,a,$a$(private.new_id(p_ids,33),org,null,'debt_participation',transaction_timestamp(),false,'{"kind":"boolean","value":true}'::jsonb,null,1),
          (private.new_id(p_ids,34),org,null,'reservation_window',transaction_timestamp(),false,'{"kind":"window","opens_minutes_before":10080,"closes_minutes_before":0,"manager_exception":false}'::jsonb,null,1);$a$);
 a:=$a$'debt_participation_policy_id',private.new_id(p_ids,33)$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Initial reservation window audit drift';end if;
 execute replace(b,a,a||$a$,'reservation_window_policy_id',private.new_id(p_ids,34)$a$);
end$patch$;
notify pgrst,'reload schema';
commit;
