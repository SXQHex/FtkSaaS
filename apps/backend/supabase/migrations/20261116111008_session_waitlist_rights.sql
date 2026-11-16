-- W1-BE-15/16: bounded session waitlist discovery and actual reservation source rights.
begin;
create index session_waitlist_history on core.waitlist_entries(org_id,center_id,session_id,joined_at,id);
create index session_offer_history on core.seat_offers(org_id,center_id,session_id,created_at,id);
-- Reuse management discovery, never worker issue/expire or member decisions.
create function private.session_waitlist_directory(r jsonb,org uuid,center uuid,actor uuid,account uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare k jsonb:=r#>'{selector,key}';sid uuid:=(k->>'session_id')::uuid;view_name text:=k->>'view';
 lim int:=coalesce((r#>>'{page,limit}')::int,50);h text;cur jsonb;last_at timestamptz;last_id uuid;items jsonb;token text;v jsonb;stamp timestamptz:=statement_timestamp();
begin
 if center is null or not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 if not (private.is_manager(org,actor,center) or private.staff_grant(org,actor,center,'reservation.write')) then perform private.fail('FORBIDDEN');end if;
 perform private.require_feature(org,'F12');
 if not exists(select 1 from core.sessions s where s.org_id=org and s.center_id=center and s.id=sid and private.session_readable(org,actor,s.id)) then perform private.fail('NOT_FOUND');end if;
 if not private.member_summary_enabled(org,array['reservation_list_v1','session_get_v1'],jsonb_build_object('org_id',org,'center_id',center,'session_id',sid)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if r#>>'{selector,operation}' is distinct from r->>'operation' or view_name not in ('entries','offers')
  or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 if k->>'status' is not null and not (k->>'status'=any(case when view_name='entries' then array['all','waiting','offered','converted','left','closed'] else array['all','active','accepted','rejected','expired','withdrawn'] end)) then perform private.fail('VALIDATION_FAILED');end if;
 h:=encode(extensions.digest(jsonb_build_object('actor',actor,'account',account,'request',r-'request_id'-'page','sort','created_at_asc')::text,'sha256'),'hex');
 if r#>>'{page,cursor}' is not null then
  begin
   cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;
   if not isfinite(last_at) then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 -- Each result is exactly one entry or one offer. Offer history has its own
 -- cursor; an entry never embeds an unbounded collection of old offers.
 with candidates as (
  select w.id,w.joined_at at_time,w.state,w.id entry_id,null::uuid offer_id
   from core.waitlist_entries w where view_name='entries' and w.org_id=org and w.center_id=center and w.session_id=sid
  union all
  select o.id,o.created_at,o.state,o.entry_id,o.id from core.seat_offers o
   where view_name='offers' and o.org_id=org and o.center_id=center and o.session_id=sid
 ), visible as (
  select q.*,w,private.directory_person_name(org,center,actor,w.person_id) display_name
   from candidates q join core.waitlist_entries w on w.org_id=org and w.center_id=center and w.session_id=sid and w.id=q.entry_id
   where (coalesce(k->>'status','all')='all' or q.state=k->>'status')
    and (last_id is null or (q.at_time,q.id)>(last_at,last_id))
    and (r->'entity' is null or r->'entity'='null'::jsonb or r->'entity'=jsonb_build_object('type',case when view_name='entries' then 'waitlist_entries' else 'seat_offers' end,'id',q.id))
 ) select coalesce(jsonb_agg(q.item order by q.at_time,q.id),'[]') into items from (
  select z.at_time,z.id,jsonb_build_object('operation','waitlist_join_v1','entity',jsonb_build_object('type',case when view_name='entries' then 'waitlist_entries' else 'seat_offers' end,'id',z.id),
   'exists',true,'state',z.state,'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','waitlist_entries','id',(z.w).id),'version',(z.w).version))
    ||coalesce((select jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','seat_offers','id',o.id),'version',o.version)) from core.seat_offers o where o.org_id=org and o.id=z.offer_id),'[]'),
   'as_of',stamp,'current',null,'waitlist_display_name',z.display_name,
   'waitlist_detail',(to_jsonb(z.w)-'org_id')||jsonb_build_object('subscriber_number',private.subscriber_number(org,(z.w).person_id),'offers',
    coalesce((select jsonb_build_array((to_jsonb(o)-'org_id'-'center_id')||jsonb_build_object('subscriber_number',private.subscriber_number(org,o.person_id))) from core.seat_offers o where o.org_id=org and o.id=z.offer_id),'[]')),
   '_at',z.at_time) item from visible z where z.display_name is not null order by z.at_time,z.id limit lim+1
 ) q;
 if jsonb_array_length(items)>lim then
  items:=items-lim;v:=items->(lim-1);
  token:=encode(convert_to(jsonb_build_object('scope',h,'at',v->>'_at','id',v#>>'{entity,id}')::text,'utf8'),'hex');
 end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]') into items from jsonb_array_elements(items) with ordinality a(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',stamp);
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a text:=$a$elsif p_operation='management_state_get_v1' and r->>'operation' in ('waitlist_join_v1','waitlist_leave_v1','seat_offer_accept_v1','seat_offer_reject_v1') then$a$;
begin
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Session waitlist context anchor drift';end if;
 b:=replace(b,a,replace(a,' then',$a$ and r#>>'{selector,key,directory}' is distinct from 'session' then$a$));
 a:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Session waitlist dispatch anchor drift';end if;
 execute replace(b,a,$a$  if p_operation='management_state_get_v1' and r->>'operation'='waitlist_join_v1' and r#>>'{selector,key,directory}'='session' then
   out:=private.session_waitlist_directory(r,org,center,person,actor.id);
   return jsonb_build_object('ok',true,'data',out,'trace_id',trace);
  end if;
$a$||a);
end$patch$;
revoke all on function private.session_waitlist_directory(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.session_waitlist_directory(jsonb,uuid,uuid,uuid,uuid) to service_role;
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
notify pgrst,'reload schema';
commit;
