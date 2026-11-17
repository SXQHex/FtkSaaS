-- W1-BE-35: filter stored assignments without changing reader or writer authority.
begin;
create index role_assignment_directory_filter on core.role_assignments(org_id,role,state,created_at,id);
do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 first_at int;last_at int;section text;
 anchor text:=$a$    and (r->>'person_id' is null or a.person_id=(r->>'person_id')::uuid)$a$;
begin
 first_at:=strpos(body,' when ''roles_list_v1'' then');
 last_at:=strpos(body,' when ''availability_save_v1'' then');
 if first_at=0 or last_at<=first_at then raise exception 'Role directory dispatch drift';end if;
 section:=substring(body from first_at for last_at-first_at);
 if array_length(string_to_array(section,anchor),1)<>2 then raise exception 'Role directory filter anchor drift';end if;
 section:=replace(section,anchor,anchor||$a$
    and (r->>'role' is null or a.role=r->>'role')
    and (r->>'state' is null or a.state=r->>'state')$a$);
 execute substring(body from 1 for first_at-1)||section||substring(body from last_at);
end
$patch$;
commit;
