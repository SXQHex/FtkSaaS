begin;
-- Preserve the existing Mutation contract at the SQL -> Edge response boundary.
-- Domain writes, receipt atomicity and response validators remain unchanged.
do $patch$
declare signature regprocedure;b text;a text:=$a$jsonb_build_object('primary_id',id,'version',v,'affected',$a$;
begin
 foreach signature in array array['private.p07_normal_payment(text,jsonb,uuid,uuid,uuid,uuid[])'::regprocedure,'private.p07_subscription_command(text,jsonb,uuid,uuid,uuid,uuid[])'::regprocedure] loop
  b:=pg_get_functiondef(signature);
  if array_length(string_to_array(b,a),1)<>2 then raise exception 'P07 payment response anchor mismatch: %',signature;end if;
  b:=replace(b,a,$a$jsonb_build_object('operation_id',operation_id,'primary_id',id,'version',v,'related',$a$);
  execute b;
 end loop;
end$patch$;
commit;
