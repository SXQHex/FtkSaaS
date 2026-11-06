do $catalog_version$
declare b text;a text:='''catalog_version'',11';
begin
 select pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure) into b;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Settings behavior catalog version drift';end if;
 execute replace(b,a,'''catalog_version'',12');
end$catalog_version$;
