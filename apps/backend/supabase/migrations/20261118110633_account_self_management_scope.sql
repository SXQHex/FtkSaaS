-- W1-BE-42: extend only the session's organization self-read.
begin;
create function private.account_self_management_scope(p_org uuid,p_self jsonb,p_access_mode text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 self_person uuid:=(p_self->>'person_id')::uuid;
 is_owner boolean;
 is_org_manager boolean;
 managed_center_ids jsonb;
begin
 if self_person is null or p_access_mode is null or p_access_mode not in ('normal','grace') then return null;end if;
 select exists(select 1 from core.organizations o where o.id=p_org and o.owner_person_id=self_person)
 into is_owner;
 is_org_manager:=private.has_role(p_org,self_person,'org_manager',null);
 select coalesce(jsonb_agg(c.value->'center_id' order by c.value->>'center_id'),'[]'::jsonb)
 into managed_center_ids
 from jsonb_array_elements(p_self->'centers') c
 where private.is_manager(p_org,self_person,(c.value->>'center_id')::uuid);
 if not is_owner and not is_org_manager and managed_center_ids='[]'::jsonb then return null;end if;
 return jsonb_build_object('owner',is_owner,'org_manager',is_org_manager,'managed_center_ids',managed_center_ids);
end$$;
revoke all on function private.account_self_management_scope(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function private.account_self_management_scope(uuid,jsonb,text) to service_role;

do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor text:=$old$ if p_operation='organizations_list_v1' then
  out:=jsonb_set(out,'{items}',coalesce((select jsonb_agg(x||jsonb_build_object('self_context',private.account_self_context((x->>'id')::uuid,actor.id)) order by n)
   from jsonb_array_elements(out->'items') with ordinality e(x,n)),'[]'::jsonb));
 end if;$old$;
begin
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization self projection anchor drift';end if;
 execute replace(body,anchor,anchor||$new$
 if p_operation='organizations_list_v1' and r->'include_self_management_scope'='true'::jsonb then
  out:=jsonb_set(out,'{items}',coalesce((
   select jsonb_agg(x||jsonb_build_object('self_management_scope',
    private.account_self_management_scope((x->>'id')::uuid,x->'self_context',x->>'access_mode')) order by n)
   from jsonb_array_elements(out->'items') with ordinality e(x,n)
  ),'[]'::jsonb));
 end if;$new$);
end$patch$;
commit;
