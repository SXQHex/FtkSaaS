begin;
create function private.organization_directory_erased(target_org uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from private.organization_managed_file_erasure_receipts f
  join private.organization_live_database_erasure_receipts d on d.request_id=f.request_id and d.org_id=f.org_id
  where f.org_id=target_org
 )
$$;
revoke all on function private.organization_directory_erased(uuid) from public,anon,authenticated;
grant execute on function private.organization_directory_erased(uuid) to service_role;

do $patch$
declare body text; anchor text;
begin
 body:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$old$from core.account_links l join core.organizations o on o.id=l.org_id where l.account_id=actor.id and l.state='active')$old$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization directory candidate anchor drift';end if;
 execute replace(body,anchor,$new$from core.account_links l join core.organizations o on o.id=l.org_id
   where l.account_id=actor.id and l.state='active' and case o.state
    when 'deleted' then false
    when 'deletion_pending' then not private.organization_directory_erased(o.id)
    else true end)$new$);
end$patch$;
commit;
