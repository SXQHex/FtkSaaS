-- F24 is available to Pro and Business. Definition scope never grants center authority.
-- Keep the original frozen worker source; change only the live plan checks.
begin;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p05_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 old:=$a$and p.name='business' and 'F24'=any(p.features)$a$;
 if strpos(b,old)=0 then raise exception 'P11 automation claim plan anchor missing';end if;
 execute replace(b,old,$a$and p.name in ('pro','business') and 'F24'=any(p.features)$a$);
 b:=pg_get_functiondef('private.p05_worker_execute(text,jsonb,uuid[])'::regprocedure);
 old:=$a$where s.org_id=org and p.name='business') or not x.enabled$a$;
 if strpos(b,old)=0 then raise exception 'P11 automation execution plan anchor missing';end if;
 execute replace(b,old,$a$where s.org_id=org and p.name in ('pro','business')) or not x.enabled$a$);
end$patch$;
commit;
