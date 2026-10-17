-- Preserve immutable migration 19 and restore the Page_RoleView snapshot contract.
begin;
do $patch$
declare
 body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 old_guard text:=$old$if out ? 'items' and p_operation not in ('disciplines_list_v1','roles_list_v1') then$old$;
begin
 if strpos(body,old_guard)=0 then raise exception 'Expected role-list snapshot guard missing';end if;
 execute replace(body,old_guard,$new$if out ? 'items' and p_operation<>'disciplines_list_v1' then$new$);
end
$patch$;
notify pgrst,'reload schema';
commit;
