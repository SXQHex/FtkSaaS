begin;
-- Discovery must advertise the same live organization permission as the writer.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:='''writable'',';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sharing catalogue authority anchor drift';end if;
 execute replace(b,a,a||$a$(f->>'key'<>'sharing_restrictions' or coalesce((select (values->>'allow_center_sharing_restrictions')::boolean from private.frontend_settings where scope_key='organization:'||org),false)) and $a$);
end$patch$;
notify pgrst,'reload schema';
commit;
