begin;
create or replace function private.debt_remaining(org uuid,debt uuid) returns bigint language sql stable set search_path='' as $$
 select greatest(0,d.amount_minor-coalesce((select sum(a.amount_minor) from core.debt_allocations a where a.org_id=org and a.debt_id=d.id),0)
 -coalesce((select sum(case when direction='subtract' then amount_minor else -amount_minor end) from core.debt_adjustments a where a.org_id=org and a.debt_id=d.id),0))
 from core.debts d where d.org_id=org and d.id=debt
$$;
create or replace function private.allocation_time(a core.entitlement_allocations) returns timestamptz language sql stable set search_path='' as $$
 select coalesce((select s.starts_at from core.reservations r join core.sessions s on s.id=r.session_id and s.org_id=r.org_id where r.org_id=a.org_id and r.id=a.reservation_id),
 (select e.starts_at from core.event_registrations r join core.events e on e.id=r.event_id and e.org_id=r.org_id where r.org_id=a.org_id and r.id=a.event_registration_id))
$$;
create or replace function private.quota_bounds(sale core.sales,quota jsonb,at_time timestamptz) returns table(starts_at timestamptz,ends_at timestamptz) language plpgsql stable set search_path='' as $$
#variable_conflict use_column
declare target date; n int; b date; e date;
begin
 target:=(at_time at time zone sale.timezone)::date;
 if quota->>'period'='week' then
  n:=(target-sale.start_date)/7;b:=sale.start_date+n*7;e:=b+7;
 elsif quota->>'period'='month' then
  n:=extract(year from age(date_trunc('month',target),date_trunc('month',sale.start_date)))::int*12+extract(month from age(date_trunc('month',target),date_trunc('month',sale.start_date)))::int;
  b:=(sale.start_date+make_interval(months=>n))::date;
  if b>target then n:=n-1;b:=(sale.start_date+make_interval(months=>n))::date;end if;
  e:=(sale.start_date+make_interval(months=>n+1))::date;
 else perform private.fail('POLICY_NOT_CONFIGURED');end if;
 return query select b::timestamp at time zone sale.timezone,least(e,sale.end_date)::timestamp at time zone sale.timezone;
end$$;
create or replace function private.available_for(org uuid,sale_id uuid,at_time timestamptz) returns bigint language plpgsql stable set search_path='' as $$
#variable_conflict use_column
declare s core.sales;p core.product_versions; b record;used bigint;
begin
 select * into s from core.sales where org_id=org and id=sale_id;
 if not found or s.state<>'active' or at_time<s.valid_from or (s.valid_until is not null and at_time>=s.valid_until) or not exists(select 1 from core.entitlement_accounts where org_id=org and sale_id=s.id and state='active') then return 0;end if;
 select * into p from core.product_versions where org_id=org and id=s.product_version_id;
 if p.kind='credits' then return private.credit_available(org,s.id);end if;
 if p.quota is null then return 1;end if;
 select * into b from private.quota_bounds(s,p.quota,at_time);
 select coalesce(sum(a.quantity),0) into used from core.entitlement_allocations a where a.org_id=org and a.sale_id=s.id and a.state in ('reserved','consumed') and private.allocation_time(a)>=b.starts_at and private.allocation_time(a)<b.ends_at;
 return greatest(0,(p.quota->>'limit')::bigint-used);
end$$;
create or replace function private.sync_quota(org uuid,sale_id uuid,at_time timestamptz,new_id uuid) returns void language plpgsql set search_path='' as $$
#variable_conflict use_column
declare s core.sales;p core.product_versions;b record;r bigint;c bigint;
begin
 select * into s from core.sales where org_id=org and id=sale_id;
 select * into p from core.product_versions where org_id=org and id=s.product_version_id;
 if p.kind<>'timed' or p.quota is null then return;end if;
 select * into b from private.quota_bounds(s,p.quota,at_time);
 select coalesce(sum(quantity) filter(where state='reserved'),0),coalesce(sum(quantity) filter(where state='consumed'),0) into r,c from core.entitlement_allocations a
 where a.org_id=org and a.sale_id=s.id and private.allocation_time(a)>=b.starts_at and private.allocation_time(a)<b.ends_at and a.state in ('reserved','consumed');
 if r+c>(p.quota->>'limit')::bigint then perform private.fail('QUOTA_EXCEEDED');end if;
 insert into core.quota_buckets(id,org_id,sale_id,starts_at,ends_at,limit_count,reserved_count,consumed_count)
 values(new_id,org,s.id,b.starts_at,b.ends_at,(p.quota->>'limit')::bigint,r,c)
 on conflict(org_id,sale_id,starts_at,ends_at) do update set reserved_count=excluded.reserved_count,consumed_count=excluded.consumed_count,version=core.quota_buckets.version+1;
end$$;
create or replace function private.reserve_right(org uuid,person uuid,requested_sale uuid,target_session uuid,target_event uuid,registration uuid,reservation uuid,op uuid,ids uuid[],offset_i int) returns uuid language plpgsql set search_path='' as $$
#variable_conflict use_column
declare at_time timestamptz;s core.sales;p core.product_versions; e core.events;candidate uuid;av bigint;
begin
 if target_event is not null then
  select * into e from core.events where org_id=org and id=target_event;
  at_time:=e.starts_at;
 else select starts_at into at_time from core.sessions where org_id=org and id=target_session;end if;
 for s in select * from core.sales where org_id=org and person_id=person and state='active' and (requested_sale is null or id=requested_sale)
 order by valid_until asc nulls last,created_at,id loop
  select * into p from core.product_versions where org_id=org and id=s.product_version_id;
  if target_event is not null then
   if not private.event_package_scope_matches(org,target_event,p.id) or not (e.terms->'allowed_product_version_ids' @> to_jsonb(array[p.id::text])) then continue;end if;
   if coalesce((e.terms->>'full_payment_required')::bool,false) and exists(select 1 from core.debts d where d.org_id=org and d.sale_id=s.id and private.debt_remaining(org,d.id)>0) then continue;end if;
  elsif not private.lesson_scope_matches(org,target_session,p.id) then continue;
  end if;
  perform 1 from core.entitlement_accounts where org_id=org and sale_id=s.id for update;
  av:=private.available_for(org,s.id,at_time);
  if av<1 then continue;end if;
  insert into core.entitlement_allocations(id,org_id,sale_id,reservation_id,event_registration_id,quantity,state)
   values(private.new_id(ids,offset_i),org,s.id,reservation,registration,1,'reserved');
  insert into core.entitlement_movements(id,org_id,sale_id,person_id,reservation_id,event_registration_id,kind,quantity,operation_id)
   values(private.new_id(ids,offset_i+1),org,s.id,person,reservation,registration,'reserve',1,op);
  update core.entitlement_accounts set balance_version=balance_version+1,version=version+1 where org_id=org and sale_id=s.id;
  perform private.sync_quota(org,s.id,at_time,private.new_id(ids,offset_i+2));
  return s.id;
 end loop;
 if requested_sale is not null and target_event is not null and exists(select 1 from core.sales s where s.org_id=org and s.id=requested_sale and s.person_id=person and not private.event_package_scope_matches(org,target_event,s.product_version_id)) then perform private.fail('CLASS_ACCESS_DENIED');end if;
 perform private.fail('ENTITLEMENT_UNAVAILABLE');
 return null;
end$$;
create or replace function private.set_right_state(org uuid,registration uuid,reservation uuid,consume bool,op uuid,ids uuid[],offset_i int,correction bool default false) returns void language plpgsql set search_path='' as $$
#variable_conflict use_column
declare a core.entitlement_allocations; old_move uuid;person uuid;at_time timestamptz; desired text;done_kind text;
begin
 select * into a from core.entitlement_allocations where org_id=org and (event_registration_id=registration or reservation_id=reservation) order by created_at desc,id desc limit 1 for update;
 if not found then return;end if;
 perform 1 from core.entitlement_accounts where org_id=org and sale_id=a.sale_id for update;
 at_time:=private.allocation_time(a);desired:=case when consume then 'consumed' else 'released' end;
 if a.state=desired then return;end if;
 if registration is not null then select person_id into person from core.event_registrations where org_id=org and id=registration;
 else select person_id into person from core.reservations where org_id=org and id=reservation;end if;
 if a.state='consumed' then
  if not correction then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select id into old_move from core.entitlement_movements m where m.org_id=org and m.sale_id=a.sale_id and m.kind='consume'
  and (m.event_registration_id=registration or m.reservation_id=reservation)
  and not exists(select 1 from core.entitlement_movements r where r.org_id=org and r.previous_id=m.id and r.kind='reverse') order by created_at desc,id desc limit 1;
  if old_move is null then perform private.fail('INTEGRITY_VIOLATION');end if;
  insert into core.entitlement_movements(id,org_id,sale_id,person_id,reservation_id,event_registration_id,kind,quantity,previous_id,operation_id)
   values(private.new_id(ids,offset_i),org,a.sale_id,person,reservation,registration,'reverse',a.quantity,old_move,op);
 end if;
 if a.state='released' and consume then
  if not correction then perform private.fail('INVALID_STATE_TRANSITION');end if;
  -- Historical correction preserves the already-authorized validity/scope; only pool/quota capacity is rechecked.
  if exists(select 1 from core.product_versions p join core.sales s on s.org_id=p.org_id and s.product_version_id=p.id where s.org_id=org and s.id=a.sale_id and p.kind='credits')
    and private.credit_available(org,a.sale_id)<a.quantity then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
 end if;
 update core.entitlement_allocations set state=desired,version=version+1 where id=a.id;
 insert into core.entitlement_movements(id,org_id,sale_id,person_id,reservation_id,event_registration_id,kind,quantity,operation_id)
  values(private.new_id(ids,offset_i+1),org,a.sale_id,person,reservation,registration,case when consume then 'consume' else 'release' end,a.quantity,op);
 update core.entitlement_accounts set balance_version=balance_version+1,version=version+1 where org_id=org and sale_id=a.sale_id;
 perform private.sync_quota(org,a.sale_id,at_time,private.new_id(ids,offset_i+2));
end$$;
create or replace function private.event_view(org uuid,event uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',e.id,'name',e.name,'center_id',e.center_id,'interval',jsonb_build_object('starts_at',e.starts_at,'ends_at',e.ends_at),'timezone',e.timezone,'venue',e.venue,'terms',e.terms,'state',e.state,
 'capacity',jsonb_build_object('nominal',e.nominal,'maximum',e.maximum),'attendance_state',e.attendance_state,'version',e.version,
 'discipline_ids',coalesce((select jsonb_agg(d.discipline_id order by d.discipline_id) from core.event_disciplines d where d.org_id=org and d.event_id=e.id),'[]'::jsonb),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty)) from core.event_assignments a where a.org_id=org and a.event_id=e.id),'[]'::jsonb))
 from core.events e where e.org_id=org and e.id=event
$$;
commit;
