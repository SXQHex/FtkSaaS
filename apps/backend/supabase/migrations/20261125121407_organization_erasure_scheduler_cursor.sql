begin;

do $migration$
declare
 body text:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 old_fallback text:=$old$  else 'false'$old$;
 new_fallback text:=$new$  when 'private.ops_worker_health' then
   'r.last_org=$2 and lower((to_jsonb(r)-''last_org'')::text)!~$1'
  else 'false'$new$;
begin
 if cardinality(string_to_array(body,old_fallback))<>2 then
  raise exception 'Organization erasure footprint fallback changed';
 end if;
 execute replace(body,old_fallback,new_fallback);
end$migration$;

commit;
