begin;
-- The same safe initial policies apply to every new commercial plan.
-- Existing organizations and explicit policy histories are untouched.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
a text:='if exists(select 1 from core.saas_plan_versions where id=(r->>''initial_plan_id'')::uuid and name=''starter'') then';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'New organization policy defaults drift';end if;
 execute replace(b,a,'if exists(select 1 from core.saas_plan_versions where id=(r->>''initial_plan_id'')::uuid and name in (''starter'',''pro'',''business'')) then');
 -- A zero effective limit cannot grant a deficit. It needs no invented upper.
 -- Explicitly configured limits keep their existing CREDIT_LIMIT_EXCEEDED error.
 b:=pg_get_functiondef('private.reserve_negative(uuid,uuid,uuid,uuid,uuid[],integer)'::regprocedure);
 a:='if lim is null then perform private.fail(''ENTITLEMENT_UNAVAILABLE'');end if;';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Initial zero negative limit guard drift';end if;
 execute replace(b,a,'if lim is null or (lim=0 and upper_n is null) then perform private.fail(''ENTITLEMENT_UNAVAILABLE'');end if;');
end$patch$;
notify pgrst,'reload schema';
commit;
