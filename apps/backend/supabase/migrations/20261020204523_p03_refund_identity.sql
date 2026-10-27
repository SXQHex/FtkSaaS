-- P03 refund Mutation and audit reference the real sale, retaining the private immutable fact.
begin;
do $patch$
declare b text:=pg_get_functiondef('private.p03_finance(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=$old$data:=jsonb_build_object('operation_id',operation,'primary_id',case when op='instructor_payment_correct_v1' then root else pid end,'version',ver,$old$;
 if strpos(b,old)=0 then raise exception 'P03 refund identity anchor missing';end if;
 b:=replace(b,old,$new$if is_refund then ver:=s.version;end if;
 data:=jsonb_build_object('operation_id',operation,'primary_id',case when is_refund then s.id when op='instructor_payment_correct_v1' then root else pid end,'version',ver,$new$);
 old:=$old$return jsonb_build_object('data',data,'primary_id',pid,'version',ver,'subject',case$old$;
 if strpos(b,old)=0 then raise exception 'P03 refund identity anchor missing';end if;
 b:=replace(b,old,$new$return jsonb_build_object('data',data,'primary_id',case when is_refund then s.id else pid end,'version',ver,'subject',case$new$);
 old:=$old$'root_payment',root));$old$;
 if strpos(b,old)=0 then raise exception 'P03 refund identity anchor missing';end if;
 b:=replace(b,old,$new$'root_payment',root,'refund_fact_id',case when is_refund then (select x.id from private.p03_sale_refunds x where x.org_id=org and x.sale_id=s.id) else null end));$new$);
 execute b;
end$patch$;
commit;
