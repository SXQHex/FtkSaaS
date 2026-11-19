begin;

do $patch$
declare
 body text:=pg_get_functiondef('private.content_catalog_execute(text,jsonb,uuid[])'::regprocedure);
 anchor text:=$a$'retired',exists(select 1 from private.content_retirements x where x.template_id=c.id)$a$;
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Content catalog status projection drift';end if;
 execute replace(body,anchor,anchor||$a$,
   'invalidated',exists(select 1 from private.content_invalidations x where x.template_id=c.id)$a$);
end$patch$;

commit;
