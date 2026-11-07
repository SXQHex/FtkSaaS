begin;
create index sale_change_reservations_source on core.reservations(org_id,source_sale_id,id) where state='active';
create index sale_change_event_allocations on core.entitlement_allocations(org_id,sale_id,event_registration_id) where event_registration_id is not null and state in ('reserved','consumed');
-- Source discovery for the existing change preview. The writer's exact set and
-- dependency checks remain authoritative; reads never prepare or apply a change.
create function private.sale_change_inventory_page(r jsonb,org uuid,center uuid,account uuid,person uuid,auth_id uuid,session_id uuid,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';op text:='sale_change_preview_v1';s core.sales;items jsonb;result jsonb;context jsonb;at timestamptz:=clock_timestamp();
begin
 if center is null or r->>'operation' is distinct from op or r#>>'{selector,operation}' is distinct from op then perform private.fail('VALIDATION_FAILED');end if;
 perform private.p06_original_authorize(op,jsonb_build_object('client_api_version',1,'request_id',r->'request_id','org_id',org,'center_id',center)||k,auth_id,session_id,ids);
 select * into s from core.sales where org_id=org and center_id=center and id=(k->>'sale_id')::uuid;
 if s.id is null then perform private.fail('NOT_FOUND');end if;
 if s.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
 if k->>'new_product_version_id' is not null and not exists(select 1 from core.product_versions p where p.org_id=org and p.id=(k->>'new_product_version_id')::uuid) then perform private.fail('NOT_FOUND');end if;
 if r->'entity' is not null and r->'entity'<>'null'::jsonb and r->'entity'<>jsonb_build_object('type','sales','id',s.id) then perform private.fail('NOT_FOUND');end if;
 with records as (
  select 'reservation'::text kind,'reservations'::text typ,v.id,v.person_id,v.center_id,v.state,v.version,'sessions'::text parent_type,ss.id parent_id,ss.version parent_version,ss.starts_at
  from core.reservations v join core.sessions ss on ss.org_id=v.org_id and ss.id=v.session_id
  where v.org_id=org and v.source_sale_id=s.id and v.state='active' and ss.starts_at>=at
  union all
  select 'event_registration','event_registrations',er.id,er.person_id,er.center_id,er.state,er.version,'events',e.id,e.version,e.starts_at
  from core.event_registrations er join core.events e on e.org_id=er.org_id and e.id=er.event_id
  where er.org_id=org and er.state='active' and e.starts_at>=at and exists(
   select 1 from core.entitlement_allocations ea where ea.org_id=org and ea.event_registration_id=er.id and ea.sale_id=s.id and ea.state in ('reserved','consumed'))
 )
 select coalesce(jsonb_agg(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',typ,'id',id),'exists',true,'state',state,
  'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'version',s.version),
   jsonb_build_object('entity',jsonb_build_object('type',typ,'id',id),'version',version),jsonb_build_object('entity',jsonb_build_object('type',parent_type,'id',parent_id),'version',parent_version)),
  'current',jsonb_build_object('operation',op,'values',k),
  'sale_change_record',jsonb_build_object('person_id',person_id,'center_id',center_id,'parent',jsonb_build_object('type',parent_type,'id',parent_id),'starts_at',starts_at)
 ) order by kind,id),'[]'::jsonb) into items from records;
 -- Authorize the whole inventory before paging, including cross-center rights.
 -- Partial lists would force the caller to guess a destructive keep/cancel set.
 if exists(select 1 from jsonb_array_elements(items) x where not private.is_manager(org,person,(x#>>'{sale_change_record,center_id}')::uuid)
  or not private.center_accessible(org,(x#>>'{sale_change_record,center_id}')::uuid)) then perform private.fail('FORBIDDEN');end if;
 context:=jsonb_build_object('entity',jsonb_build_object('type','sales','id',s.id),'version',s.version);
 -- Volatile evaluation time is added only AFTER fingerprinting; unchanged next
 -- pages stay readable. A boundary crossing or any source/version change fails
 -- the existing cursor fingerprint and requires restarting the inventory.
 result:=private.p06_page(items,r->'page',md5(jsonb_build_object('account',account,'request',r-'page'-'request_id')::text),at);
 select coalesce(jsonb_agg(x||jsonb_build_object('as_of',at) order by n),'[]'::jsonb) into items from jsonb_array_elements(result->'items') with ordinality a(x,n);
 return jsonb_set(result,'{items}',items)||jsonb_build_object('sale_change_context',context);
end$$;
revoke all on function private.sale_change_inventory_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.sale_change_inventory_page(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[]) to service_role;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);a text:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Sale change inventory dispatch anchor drift';end if;
 execute replace(b,a,$branch$ if p_operation='management_state_get_v1' and r->>'operation'='sale_change_preview_v1' then
  out:=private.sale_change_inventory_page(r,org,center,actor.id,person,p_actor_auth_id,p_session_id,p_ids);
  return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
 end if;
$branch$||a);
end$patch$;
notify pgrst,'reload schema';
commit;
