begin;
-- FD07 defaults apply only at creation; existing policy histories are untouched.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
a text:='if exists(select 1 from core.saas_plan_versions where id=(r->>''initial_plan_id'')::uuid and name=''starter'') then';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'New organization policy defaults drift';end if;
 execute replace(b,a,'if exists(select 1 from core.saas_plan_versions where id=(r->>''initial_plan_id'')::uuid and name in (''starter'',''pro'',''business'')) then');
end$patch$;
notify pgrst,'reload schema';
commit;
