-- Narrow pilot prerequisite. Preserve transaction-capable SECURITY INVOKER CALL.
begin;
-- Connection defaults cover scheduled LOGIN sessions. Also pin the executing
-- session at entry so an explicit SET by a caller cannot reintroduce lookup.
alter role ftk_ops_p01 set search_path=pg_catalog;
alter role ftk_ops_p05 set search_path=pg_catalog;
alter role ftk_ops_p06 set search_path=pg_catalog;
alter role ftk_ops_p07 set search_path=pg_catalog;
alter role ftk_ops_p07_privacy set search_path=pg_catalog;
do $patch$
declare body text:=pg_catalog.pg_get_functiondef('private.ops_run(text)'::regprocedure);anchor text:=E'begin\n perform private.ops_identity(lane);';
begin
 if pg_catalog.array_length(pg_catalog.string_to_array(body,anchor),1)<>2 then raise exception 'Operational session pin anchor mismatch';end if;
 execute pg_catalog.replace(body,anchor,E'begin\n perform pg_catalog.set_config(''search_path'',''pg_catalog'',false);\n perform private.ops_identity(lane);');
end$patch$;
-- Platform-installed event-trigger function may be absent in isolated stacks.
-- Revoke the inherited PUBLIC grant too; direct role revokes alone do not deny it.
do $grants$
begin
 if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end$grants$;
commit;
