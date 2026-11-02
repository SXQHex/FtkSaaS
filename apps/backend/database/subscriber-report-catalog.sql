begin;
-- The previous catalog/migrations stay immutable; new No columns use catalog version 10.
do $patch$
declare b text:=pg_get_functiondef('private.frontend_settings_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=$a$'catalog_version',9$a$;
begin
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Subscriber report catalog version anchor drift';end if;
 execute replace(b,anchor,$a$'catalog_version',10$a$);
end$patch$;
notify pgrst,'reload schema';
commit;
