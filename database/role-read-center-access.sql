-- CM role reads obey active-center and subscription-plan access, including unscoped requests.
begin;
do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
begin
 if strpos(body,$old$a.scope_center_id is not null and private.is_manager(org,person,a.scope_center_id) and (center is null or a.scope_center_id=center)$old$)=0 then raise exception 'Expected CM role-read guard missing';end if;
 body:=replace(body,$old$a.scope_center_id is not null and private.is_manager(org,person,a.scope_center_id) and (center is null or a.scope_center_id=center)$old$,$new$a.scope_center_id is not null and private.center_accessible(org,a.scope_center_id) and private.is_manager(org,person,a.scope_center_id) and (center is null or a.scope_center_id=center)$new$);
 if strpos(body,$old$and (org_reader or (a.scope_center_id is not null and private.is_manager(org,person,a.scope_center_id)))$old$)=0 then raise exception 'Expected CM role-read guard missing';end if;
 body:=replace(body,$old$and (org_reader or (a.scope_center_id is not null and private.is_manager(org,person,a.scope_center_id)))$old$,$new$and (org_reader or (a.scope_center_id is not null and private.center_accessible(org,a.scope_center_id) and private.is_manager(org,person,a.scope_center_id)))$new$);
 execute body;
end
$patch$;
notify pgrst,'reload schema';
commit;
