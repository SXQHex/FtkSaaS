-- P03 correction results return the actionable root payment and its aggregate version.
begin;
do $patch$
declare b text:=pg_get_functiondef('private.p03_finance(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=$p$data:=jsonb_build_object('operation_id',operation,'primary_id',pid,'version',ver,'replayed',false,'related','[]'::jsonb);$p$;
 if strpos(b,old)=0 then raise exception 'P03 payment result anchor missing';end if;
 execute replace(b,old,$p$data:=jsonb_build_object('operation_id',operation,'primary_id',case when op='instructor_payment_correct_v1' then root else pid end,'version',ver,'replayed',false,
 'related',case when op='instructor_payment_correct_v1' then jsonb_build_array(jsonb_build_object('type','instructor_payments','id',pid)) else '[]'::jsonb end);$p$);
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
