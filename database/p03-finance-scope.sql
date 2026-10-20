-- Full student finance history is not a collection staff grant.
begin;
do $patch$
declare b text:=pg_get_functiondef('private.p03_finance_read(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);old text;
begin
 old:=$p$ or private.staff_grant(org,person,center,'finance.collect')$p$;
 if strpos(b,old)=0 then raise exception 'P03 finance disclosure anchor missing';end if;
 execute replace(b,old,'');
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
