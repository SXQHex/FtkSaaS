begin;
-- Current rights on the actual source, not the booking eligibility catalog.
create function private.reservation_source_summary(org uuid,center uuid,actor uuid,reservation uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_column
declare v core.reservations;s core.sales;p core.product_versions;a core.entitlement_accounts;
 stamp timestamptz:=statement_timestamp();request jsonb;empty jsonb:=jsonb_build_object('as_of',stamp);
begin
 select x.* into v from core.reservations x where x.org_id=org and x.center_id=center and x.id=reservation;
 if v.id is null then perform private.fail('NOT_FOUND');end if;
 request:=jsonb_build_object('org_id',org,'center_id',center,'person_id',v.person_id);
 if not (private.p07_same_person(org,actor,v.person_id) or private.is_org_reader(org,actor)
  or (private.is_manager(org,actor,center) and private.person_operational_access(org,actor,center,v.person_id))) then return empty||'{"status":"restricted"}'::jsonb;end if;
 if not private.member_summary_enabled(org,array['entitlements_get_v1'],request) then return empty||'{"status":"not_enabled"}'::jsonb;end if;
 if v.source_sale_id is null then return empty||'{"status":"unassigned"}'::jsonb;end if;
 select x.* into s from core.sales x where x.org_id=org and x.id=v.source_sale_id and private.p07_same_person(org,x.person_id,v.person_id);
 if s.id is null then perform private.fail('INTEGRITY_VIOLATION');end if;
 if not private.center_accessible(org,s.center_id) or not (private.p07_same_person(org,actor,s.person_id) or private.is_org_reader(org,actor)
  or (private.is_manager(org,actor,s.center_id) and private.person_operational_access(org,actor,s.center_id,s.person_id))) then return empty||'{"status":"restricted"}'::jsonb;end if;
 select x.* into p from core.product_versions x where x.org_id=org and x.id=s.product_version_id;
 select x.* into a from core.entitlement_accounts x where x.org_id=org and x.sale_id=s.id;
 if p.id is null or a.id is null then perform private.fail('INTEGRITY_VIOLATION');end if;
 if p.kind='timed' then
  begin perform private.require_feature(org,'F16');exception when sqlstate 'P0001' then
   if sqlerrm='PLAN_FEATURE_UNAVAILABLE' then return empty||'{"status":"not_enabled"}'::jsonb;end if;raise;
  end;
 end if;
 if not private.member_summary_enabled(org,array['entitlements_get_v1'],request||jsonb_build_object('center_id',s.center_id)) then return empty||'{"status":"not_enabled"}'::jsonb;end if;
 return empty||jsonb_build_object('status','available','source_sale_id',s.id,'product_version_id',p.id,'product_name',p.published_name,
  'kind',p.kind,'booking_mode',p.booking_mode,'sale_state',s.state,'state',a.state,'start_date',s.start_date,'end_date',s.end_date,'timezone',s.timezone,'sale_version',s.version,
  'available_credits',case when p.kind='credits' then case when s.state<>'active' or a.state<>'active' then '0' else greatest(0,private.credit_available(org,s.id))::text end end,
  'reserved',coalesce((select sum(x.quantity) from core.entitlement_allocations x where x.org_id=org and x.sale_id=s.id and x.state='reserved'),0)::text,
  'consumed',coalesce((select sum(private.credit_effect(org,x.id)*-1) from core.entitlement_movements x where x.org_id=org and x.sale_id=s.id and x.kind in ('consume','reverse')),0)::text);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 a text:=' return jsonb_build_object(''items'',items,''next_cursor'',token,''as_of'',';
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Reservation source summary anchor drift';end if;
 execute replace(b,a,$a$ if op='reservation_list_v1' and coalesce((r->>'include_source_summary')::bool,false) then
  select coalesce(jsonb_agg(x||jsonb_build_object('source_summary',private.reservation_source_summary(org,(select v.center_id from core.reservations v where v.org_id=org and v.id=(x->>'id')::uuid),actor,(x->>'id')::uuid)) order by n),'[]')
   into items from jsonb_array_elements(items) with ordinality t(x,n);
 end if;
$a$||a);
end$patch$;
revoke all on function private.reservation_source_summary(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.reservation_source_summary(uuid,uuid,uuid,uuid) to service_role;
commit;
