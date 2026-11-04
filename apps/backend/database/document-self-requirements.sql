-- XREQ-016: omitted person_id resolves only to the live native actor's org person.
-- Explicit target reads retain their existing operational permission checks.
begin;
do $patch$
declare b text;old text:=$a$case when op='document_requirements_get_v1' then (r->>'person_id')::uuid else actor end$a$;replacement text:=$a$case when op='document_requirements_get_v1' then coalesce((r->>'person_id')::uuid,actor) else actor end$a$;
begin
 b:=pg_get_functiondef('private.p05_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Document self access anchor drift';end if;
 execute replace(b,old,replacement);
 b:=pg_get_functiondef('private.p05_documents(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 if array_length(string_to_array(b,old),1)<>3 then raise exception 'Document self projection anchors drift';end if;
 execute replace(b,old,replacement);
end$patch$;
commit;
