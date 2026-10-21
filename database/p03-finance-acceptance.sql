-- Bind the exact refund amount across local date boundaries; apply the accepted rounding rule.
begin;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p03_finance(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old:='  dep:=private.p03_dependencies(org,center,account,s.id);';
 if strpos(b,old)=0 then raise exception 'P03 refund amount binding anchor missing';end if;
 b:=replace(b,old,old||$p$
  if is_refund then dep:=jsonb_set(dep,'{policy_hashes}',dep->'policy_hashes'||jsonb_build_array(md5(quote::text)));end if;$p$);
 execute b;
 b:=pg_get_functiondef('private.p02_refund_quote(uuid,uuid)'::regprocedure);
 old:='floor(s.net_minor::numeric*unused/p.credits)';
 if strpos(b,old)=0 then raise exception 'P03 credit ratio rounding anchor missing';end if;
 b:=replace(b,old,'round(s.net_minor::numeric*unused/p.credits)');
 old:='floor(s.net_minor::numeric*unused/s.paid_days)';
 if strpos(b,old)=0 then raise exception 'P03 time ratio rounding anchor missing';end if;
 b:=replace(b,old,'round(s.net_minor::numeric*unused/s.paid_days)');execute b;
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
