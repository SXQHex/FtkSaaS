begin;

-- Count each held-capacity component once for a consistent read projection.
create or replace function private.capacity_view(org uuid,sid uuid) returns jsonb language sql stable set search_path='' as $$
 with holds as materialized (
  select s.id,s.nominal,s.category_capacities,private.capacity_holds(org,s.id) as held,
   case when s.category_capacities is not null then private.capacity_holds(org,s.id,'male') end as male_held,
   case when s.category_capacities is not null then private.capacity_holds(org,s.id,'female') end as female_held
  from core.sessions s where s.org_id=org and s.id=sid
 )
 select jsonb_build_object('total',s.nominal,'categories',s.category_capacities,'held',s.held,
 'remaining',greatest(0,s.nominal-s.held),
 'category_held',case when s.category_capacities is null then null else jsonb_build_object('male',s.male_held,'female',s.female_held) end,
 'category_remaining',case when s.category_capacities is null then null else jsonb_build_object('male',greatest(0,(s.category_capacities->>'male')::bigint-s.male_held),'female',greatest(0,(s.category_capacities->>'female')::bigint-s.female_held)) end,
 'room_capacity',(select case when bool_or(z.capacity is null) then null else min(z.capacity) end from core.resource_bookings b join core.rooms z on z.org_id=b.org_id and z.center_id=b.center_id and z.id=b.resource_id where b.org_id=org and b.session_id=sid and b.resource_kind='room' and b.state='active'))
 from holds s
$$;

-- Project instructor presence from the same explicit and legacy duties.
create or replace function private.session_needs_instructor(org uuid,sid uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from core.sessions s
  where s.org_id=org and s.id=sid and s.state='planned' and s.attendance_state='open' and s.actual_started_at is null
  and not exists(
   select 1 from core.session_assignments a where a.org_id=s.org_id and a.session_id=s.id and a.state='active' and a.duty='instructor'
  )
  and not (s.assignment_mode='legacy' and exists(
   select 1 from core.class_assignments a where a.org_id=s.org_id and a.class_id=s.class_id and a.state='active' and a.duty='instructor'
  ))
 )
$$;

commit;
