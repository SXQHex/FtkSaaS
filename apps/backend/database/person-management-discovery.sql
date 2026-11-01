begin;
-- Keep existing by-ID selectors compatible. Discovery never returns account IDs,
-- addresses or invitation tokens, and every command still rechecks live authority.
alter function private.p07_revoke_management(jsonb,uuid,uuid,uuid) rename to p07_revoke_management_by_id;
create function private.person_management_page(items jsonb,r jsonb,account uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;at timestamptz:=clock_timestamp();
begin
 -- Volatile read time must not invalidate an otherwise unchanged cursor.
 select coalesce(jsonb_agg(x-'as_of' order by n),'[]') into items from jsonb_array_elements(items) with ordinality e(x,n);
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]') into items from jsonb_array_elements(result->'items') with ordinality e(x,n);
 return jsonb_set(result,'{items}',items);
end$$;
create function private.p07_revoke_management(r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';pid uuid:=(k->>'person_id')::uuid;entry record;target jsonb;vals jsonb;items jsonb:='[]';actionable boolean;at timestamptz:=clock_timestamp();
begin
 if not k?'person_id' then return private.p07_revoke_management_by_id(r,org,center,actor);end if;
 if r#>>'{selector,operation}' is distinct from op or center is null then perform private.fail('VALIDATION_FAILED');end if;
 perform private.assert_center(org,center);
 if not exists(select 1 from core.people p where p.org_id=org and p.id=pid) then perform private.fail('NOT_FOUND');end if;
 if not private.can_invite(org,actor,center,pid) then perform private.fail('FORBIDDEN');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','people','id',pid) then perform private.fail('NOT_FOUND');end if;
 if private.access_mode(org)='bootstrap' then perform private.fail('SUBSCRIPTION_NOT_STARTED');end if;
 if private.access_mode(org)='closed' then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if op='account_access_revoke_v1' then
  for entry in select i.id,i.person_id,i.version,i.state,i.expires_at from core.invitations i where i.org_id=org and i.center_id=center and private.p07_same_person(org,i.person_id,pid) order by i.created_at,i.id loop
   vals:=jsonb_build_object('person_id',entry.person_id,'invitation_id',entry.id,'center_id',center,'expires_at',entry.expires_at,'actionable',entry.state='pending' and entry.expires_at>at);
   items:=items||jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type','invitations','id',entry.id),'exists',true,'state',entry.state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','invitations','id',entry.id),'version',entry.version)),'current',jsonb_build_object('operation',op,'values',vals)));
  end loop;
 elsif op='account_link_remove_v1' then
  -- Link identity spans the organization: only a manager of a real person scope
  -- may discover it. Removal may still require authority at additional centers.
  if not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;
  if not exists(select 1 from core.center_relationships x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,pid))
   and not exists(select 1 from core.invitations x where x.org_id=org and x.center_id=center and private.p07_same_person(org,x.person_id,pid))
   and not exists(select 1 from core.role_assignments x where x.org_id=org and private.p07_same_person(org,x.person_id,pid) and (x.scope_center_id=center or x.scope_center_id is null)) then perform private.fail('NOT_FOUND');end if;
  for entry in select l.id,l.person_id,l.version,l.state from core.account_links l where l.org_id=org and private.p07_same_person(org,l.person_id,pid) order by l.created_at,l.id loop
   actionable:=false;
   begin
    target:=private.p07_revoke_access(op,jsonb_build_object('link_id',entry.id),org,center,actor);
    actionable:=entry.state='active' and not exists(select 1 from core.organizations o where o.id=org and o.owner_person_id=entry.person_id);
   exception when SQLSTATE 'P0001' then
    if sqlerrm not in ('FORBIDDEN','BILLING_OPERATION_RESTRICTED') then raise;end if;
   end;
   vals:=jsonb_build_object('person_id',entry.person_id,'link_id',entry.id,'actionable',actionable);
   items:=items||jsonb_build_array(jsonb_build_object('operation',op,'entity',jsonb_build_object('type','account_links','id',entry.id),'exists',true,'state',entry.state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','account_links','id',entry.id),'version',entry.version)),'current',jsonb_build_object('operation',op,'values',vals)));
  end loop;
 else perform private.fail('FORBIDDEN');end if;
 return jsonb_build_object('data',private.person_management_page(items,r,(select l.account_id from core.account_links l where l.org_id=org and l.person_id=actor and l.state='active' and l.verified_at is not null limit 1)),'primary_id',pid,'subject','people');
end$$;

revoke all on function private.person_management_page(jsonb,jsonb,uuid),private.p07_revoke_management(jsonb,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.person_management_page(jsonb,jsonb,uuid),private.p07_revoke_management(jsonb,uuid,uuid,uuid) to service_role;
commit;
