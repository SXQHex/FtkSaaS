begin;

do $patch$
declare
 body text:=pg_get_functiondef('private.p06_scrub(jsonb)'::regprocedure);
 anchor text:=$keys$'tax_office','tax_identifier')$keys$;
begin
 if array_length(string_to_array(body,anchor),1)<>2 then
  raise exception 'Tracking media redaction anchor drift';
 end if;
 execute replace(body,anchor,$keys$'tax_office','tax_identifier','logo_image','photo')$keys$);
end$patch$;

commit;
