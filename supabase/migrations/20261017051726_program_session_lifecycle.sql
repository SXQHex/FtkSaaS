-- Finite programs and future occurrence maintenance; prior migrations stay immutable.
begin;
alter table core.sessions add column if not exists assignment_mode text not null default 'legacy' check (assignment_mode in ('legacy','inherit','explicit'));
alter table core.session_assignments add column if not exists origin_class_assignment_id uuid;
alter table core.resource_bookings add column if not exists duty_assignment boolean not null default false;
alter table core.program_versions add column if not exists timezone text;
alter table core.program_versions add column if not exists spec_snapshot jsonb;
alter table core.session_assignments add constraint schedule_class_origin_fk foreign key(org_id,center_id,origin_class_assignment_id) references core.class_assignments(org_id,center_id,id) deferrable initially deferred;
create unique index schedule_active_duty on core.session_assignments(org_id,session_id,person_id,duty) where state='active';
create unique index schedule_class_duty on core.class_assignments(org_id,class_id,person_id,duty);
create index schedule_program_occurrences on core.sessions(org_id,program_id,starts_at,id);
create or replace function private.schedule_local_instant(local_at timestamp,tz text,offset_minutes int default null)
returns timestamptz language plpgsql stable security invoker set search_path='' as $$
declare candidates timestamptz[];candidate timestamptz;
begin
 select array_agg(distinct u order by u) into candidates from (
  select local_at at time zone 'UTC' - ((s at time zone tz)-(s at time zone 'UTC')) u
  from generate_series((local_at at time zone 'UTC')-interval '3 days',(local_at at time zone 'UTC')+interval '3 days',interval '6 hours') s
 ) c where u at time zone tz=local_at;
 if coalesce(cardinality(candidates),0)=0 then perform private.fail('VALIDATION_FAILED');end if;
 if offset_minutes is null then
  if cardinality(candidates)<>1 then perform private.fail('VALIDATION_FAILED');end if;
  return candidates[1];
 end if;
 candidate:=(local_at at time zone 'UTC')-make_interval(mins=>offset_minutes);
 if not candidate=any(candidates) then perform private.fail('VALIDATION_FAILED');end if;
 return candidate;
end$$;
create or replace function private.schedule_class_views(org uuid,class uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'person_id',a.person_id,'duty',a.duty,'state',a.state,'version',a.version) order by a.person_id,a.duty),'[]'::jsonb)
 from core.class_assignments a where a.org_id=org and a.class_id=class
$$;
create or replace function private.schedule_defaults(org uuid,class uuid,explicit_duties jsonb,inherit bool)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if exists(select 1 from jsonb_array_elements(explicit_duties) d group by d->>'person_id',d->>'duty' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
 select coalesce(jsonb_agg(d order by d->>'person_id',d->>'duty'),'[]'::jsonb) into result from (
  select e d from jsonb_array_elements(explicit_duties) e
  union all
  select jsonb_build_object('person_id',a.person_id,'duty',a.duty,'origin_class_assignment_id',a.id) from core.class_assignments a
  where inherit and a.org_id=org and a.class_id=class and a.state='active'
  and not exists(select 1 from jsonb_array_elements(explicit_duties) e where (e->>'person_id')::uuid=a.person_id and e->>'duty'=a.duty)
 ) x;
 return result;
end$$;
create or replace function private.schedule_snapshot(org uuid,session uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',s.id,'class_id',s.class_id,'program_id',s.program_id,'center_id',s.center_id,'discipline_id',s.discipline_id,'format',s.format,
 'starts_at',s.starts_at,'ends_at',s.ends_at,'nominal',s.nominal,'maximum',s.maximum,'expected_version',s.version,'assignment_mode',s.assignment_mode,'_touch',false,
 'resources',coalesce((select jsonb_agg(jsonb_build_object('kind',b.resource_kind,'id',b.resource_id) order by b.resource_kind,b.resource_id) from core.resource_bookings b where b.org_id=org and b.session_id=s.id and b.state='active' and not b.duty_assignment),'[]'::jsonb),
 'assignments',private.schedule_defaults(org,s.class_id,coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty,'agreement_id',a.agreement_id,'origin_class_assignment_id',a.origin_class_assignment_id) order by a.person_id,a.duty) from core.session_assignments a where a.org_id=org and a.session_id=s.id and a.state='active'),'[]'::jsonb),s.assignment_mode='legacy'))
 from core.sessions s where s.org_id=org and s.id=session
$$;
create or replace function private.schedule_resources(row_data jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'duty_assignment',duty_only) order by kind,id),'[]'::jsonb)
 from (select d->>'kind' kind,d->>'id' id,bool_and(duty_only) duty_only from (
 select e d,false duty_only from jsonb_array_elements(row_data->'resources') e
 union all select jsonb_build_object('kind','person','id',a->>'person_id'),true from jsonb_array_elements(row_data->'assignments') a
 ) x group by d->>'kind',d->>'id') y
$$;
create or replace function private.schedule_build_program(org uuid,center uuid,r jsonb,ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c core.classes;tz text;spec jsonb:=r->'schedule';dt date;local_at timestamp;at_time timestamptz;off int;idx int:=21;rows_data jsonb:='[]';resources jsonb;duties jsonb;pid uuid;
begin
 select * into c from core.classes where org_id=org and center_id=center and id=(r->>'class_id')::uuid and state='active';
 if not found then perform private.fail('NOT_FOUND');end if;
 select timezone into tz from core.centers where org_id=org and id=center;
 if spec->>'local_start'!~'^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' or (spec->>'starts_on')::date>=(spec->>'ends_on')::date then perform private.fail('VALIDATION_FAILED');end if;
 -- Preflight the existing bounded UUID bank before expanding pathological input. Gateway may retry with a larger bank.
 if (spec->>'ends_on')::date-(spec->>'starts_on')::date>cardinality(ids) then raise exception using errcode='54000',message='UUID_BANK_EXHAUSTED';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(spec->'offset_choices','[]')) x group by x->>'date' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(coalesce(spec->'offset_choices','[]')) x where (x->>'date')::date<(spec->>'starts_on')::date or (x->>'date')::date>=(spec->>'ends_on')::date or not extract(isodow from (x->>'date')::date)::int=any(array(select jsonb_array_elements_text(spec->'weekdays')::int))) then perform private.fail('VALIDATION_FAILED');end if;
 pid:=private.new_id(ids,20);
 resources:=case when spec->>'room_id' is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('kind','room','id',spec->>'room_id')) end;
 duties:=private.schedule_defaults(org,c.id,spec->'assignments',coalesce((spec->>'inherit_class_assignments')::bool,true));
 for dt in select d::date from generate_series((spec->>'starts_on')::date::timestamp,((spec->>'ends_on')::date-1)::timestamp,interval '1 day') d
 where extract(isodow from d)::int=any(array(select jsonb_array_elements_text(spec->'weekdays')::int)) loop
  local_at:=dt+(spec->>'local_start')::time;
  select (x->>'offset_minutes')::int into off from jsonb_array_elements(coalesce(spec->'offset_choices','[]')) x where (x->>'date')::date=dt;
  at_time:=private.schedule_local_instant(local_at,tz,off);
  rows_data:=rows_data||jsonb_build_array(jsonb_build_object('id',private.new_id(ids,idx),'class_id',c.id,'program_id',pid,'center_id',center,'discipline_id',c.discipline_id,'format','group',
   'starts_at',at_time,'ends_at',at_time+make_interval(mins=>(spec->>'duration_minutes')::int),'nominal',spec#>'{capacity,nominal}','maximum',spec#>'{capacity,maximum}',
   'resources',resources,'assignments',duties,'assignment_mode',case when coalesce((spec->>'inherit_class_assignments')::bool,true) then 'inherit' else 'explicit' end,'_touch',true));idx:=idx+1;
 end loop;
 if jsonb_array_length(rows_data)=0 then perform private.fail('VALIDATION_FAILED');end if;
 return jsonb_build_object('program_id',pid,'class_id',c.id,'timezone',tz,'spec',spec,'rows',rows_data);
end$$;
create or replace function private.schedule_build_change(org uuid,center uuid,r jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare anchor core.sessions;s core.sessions;p jsonb:=r->'patch';row_data jsonb;rows_data jsonb:='[]';tz text;delta interval;duration interval;new_local timestamp;new_start timestamptz;off int;
begin
 select * into anchor from core.sessions where org_id=org and center_id=center and id=(r->>'session_id')::uuid;
 if not found then perform private.fail('NOT_FOUND');end if;
 if length(btrim(r->>'reason'))=0 then perform private.fail('VALIDATION_FAILED');end if;
 if r->>'scope'='this_and_future' and anchor.program_id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select timezone into tz from core.centers where org_id=org and id=center;
 if p ? 'interval' then
  if (p#>>'{interval,starts_at}')::timestamptz>=(p#>>'{interval,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
  delta:=((p#>>'{interval,starts_at}')::timestamptz at time zone tz)-(anchor.starts_at at time zone tz);
  duration:=(p#>>'{interval,ends_at}')::timestamptz-(p#>>'{interval,starts_at}')::timestamptz;
 end if;
 if exists(select 1 from jsonb_array_elements(coalesce(r->'offset_choices','[]')) x group by x->>'date' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
 for s in select * from core.sessions where org_id=org and center_id=center and (
  id=anchor.id or (r->>'scope'='this_and_future' and program_id=anchor.program_id and (starts_at,id)>(anchor.starts_at,anchor.id) and state='planned' and attendance_state='open' and starts_at>clock_timestamp()))
 order by starts_at,id loop
  row_data:=private.schedule_snapshot(org,s.id);
  row_data:=row_data||jsonb_build_object('_touch',p ? 'interval' or p ? 'resources' or p ? 'assignments');
  if p ? 'interval' then
   if s.id=anchor.id then new_start:=(p#>>'{interval,starts_at}')::timestamptz;
   else
    new_local:=(s.starts_at at time zone tz)+delta;
    select (x->>'offset_minutes')::int into off from jsonb_array_elements(coalesce(r->'offset_choices','[]')) x where (x->>'date')::date=new_local::date;
    new_start:=private.schedule_local_instant(new_local,tz,off);
   end if;
   row_data:=row_data||jsonb_build_object('starts_at',new_start,'ends_at',new_start+duration);
  end if;
  if p ? 'resources' then row_data:=jsonb_set(row_data,'{resources}',p->'resources');end if;
  if p ? 'assignments' then row_data:=row_data||jsonb_build_object('assignments',p->'assignments','assignment_mode','explicit');end if;
  if p ? 'capacity' then row_data:=row_data||jsonb_build_object('nominal',p#>'{capacity,nominal}','maximum',p#>'{capacity,maximum}');end if;
  if row_data->>'assignment_mode'='legacy' and (row_data->>'_touch')::bool then row_data:=jsonb_set(row_data,'{assignment_mode}','"inherit"');end if;
  rows_data:=rows_data||jsonb_build_array(row_data);
 end loop;
 if exists(select 1 from jsonb_array_elements(coalesce(r->'offset_choices','[]')) x where not exists(select 1 from jsonb_array_elements(rows_data) d where ((d->>'starts_at')::timestamptz at time zone tz)::date=(x->>'date')::date)) then perform private.fail('VALIDATION_FAILED');end if;
 -- Explicit instants (including the anchor) must agree with any supplied local offset choice.
 for row_data in select d from jsonb_array_elements(rows_data) d loop
  new_start:=(row_data->>'starts_at')::timestamptz;
  select (x->>'offset_minutes')::int into off from jsonb_array_elements(coalesce(r->'offset_choices','[]')) x where (x->>'date')::date=(new_start at time zone tz)::date;
  if off is not null and private.schedule_local_instant(new_start at time zone tz,tz,off)<>new_start then perform private.fail('VALIDATION_FAILED');end if;
 end loop;
 return jsonb_build_object('class_id',anchor.class_id,'rows',rows_data);
end$$;
create or replace function private.schedule_dependencies(org uuid,center uuid,account uuid,class uuid,rows_data jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare table_name text;h text;all_hashes jsonb:='{}';versions jsonb:='[]';s record;permissions text;
begin
 foreach table_name in array array['organizations','centers','disciplines','center_disciplines','classes','program_versions','sessions','session_assignments','class_assignments','resource_bookings','people','center_relationships','person_disciplines','rooms','room_capacities','availability_rules','availability_exceptions','policy_versions','instructor_agreements','reservations','seat_offers','sales','product_versions','product_scopes','entitlement_accounts','entitlement_allocations','credit_deficits','quota_buckets','freezes','saas_subscriptions','account_links','role_assignments','permission_overrides'] loop
  execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' order by id),'''')) from core.%I t where org_id=$1',table_name) into h using org;
  all_hashes:=all_hashes||jsonb_build_object(table_name,h);
 end loop;
 select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) into h from core.saas_plan_versions p where id in(select plan_version_id from core.saas_subscriptions where org_id=org);
 all_hashes:=all_hashes||jsonb_build_object('plans',h);
 permissions:=md5(jsonb_build_object('actor',account,'links',all_hashes->'account_links','roles',all_hashes->'role_assignments','overrides',all_hashes->'permission_overrides','org',all_hashes->'organizations')::text);
 for s in select 'centers' t,c.id,c.version from core.centers c where c.org_id=org and c.id=center
 union all select 'classes',c.id,c.version from core.classes c where c.org_id=org and c.id=class
 union all select 'sessions',c.id,c.version from core.sessions c where c.org_id=org and c.id in(select (d->>'id')::uuid from jsonb_array_elements(rows_data) d) order by t,id loop
  versions:=versions||jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',s.t,'id',s.id),'version',s.version));
 end loop;
 return jsonb_build_object('versions',versions,'policy_hashes',jsonb_build_array(md5(all_hashes::text)),'permission_hash',permissions);
end$$;

create or replace function private.schedule_resolve_agreements(org uuid,center uuid,discipline uuid,format_name text,at_time timestamptz,duties jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare d jsonb;result jsonb:='[]';agreement uuid;n int;
begin
 if exists(select 1 from jsonb_array_elements(duties) e group by e->>'person_id',e->>'duty' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
 for d in select e from jsonb_array_elements(duties) e loop
  perform private.assert_resource(org,center,'person',(d->>'person_id')::uuid);
  agreement:=(d->>'agreement_id')::uuid;
  if agreement is not null then
   if not exists(select 1 from core.instructor_agreements a where a.org_id=org and a.center_id=center and a.id=agreement and a.person_id=(d->>'person_id')::uuid and a.discipline_id=discipline and a.format=format_name and a.state='active' and a.valid_from<=at_time and (a.valid_until is null or at_time<a.valid_until)) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  elsif d->>'duty'='instructor' then
   select count(*),min(a.id::text)::uuid into n,agreement from core.instructor_agreements a where a.org_id=org and a.center_id=center and a.person_id=(d->>'person_id')::uuid and a.discipline_id=discipline and a.format=format_name and a.state='active' and a.valid_from<=at_time and (a.valid_until is null or at_time<a.valid_until);
   if n<>1 then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  end if;
  result:=result||jsonb_build_array(d||jsonb_build_object('agreement_id',agreement));
 end loop;
 return result;
end$$;
create or replace function private.schedule_validate(org uuid,center uuid,rows_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare d jsonb;e jsonb;f jsonb;resolved jsonb:='[]';s core.sessions;r record;sale core.sales;p core.product_versions;at_time timestamptz;end_time timestamptz;quota record;used bigint;
 ids uuid[]:=array(select (x->>'id')::uuid from jsonb_array_elements(rows_data) x);
begin
 for d in select x from jsonb_array_elements(rows_data) x loop
  at_time:=(d->>'starts_at')::timestamptz;end_time:=(d->>'ends_at')::timestamptz;
  if (d->>'center_id')::uuid<>center or at_time>=end_time or (d->>'nominal')::bigint<0 or (d->>'maximum')::bigint<(d->>'nominal')::bigint then perform private.fail('VALIDATION_FAILED');end if;
  if at_time<=clock_timestamp() then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if d ? 'expected_version' then
   select * into s from core.sessions where org_id=org and center_id=center and id=(d->>'id')::uuid;
   if not found then perform private.fail('NOT_FOUND');end if;
   if s.version<>(d->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   if s.state<>'planned' or s.starts_at<=clock_timestamp() then perform private.fail('INVALID_STATE_TRANSITION');end if;
   if s.attendance_state<>'open' then perform private.fail('ATTENDANCE_CLOSED');end if;
  end if;
  if not exists(select 1 from core.center_disciplines c join core.disciplines z on z.org_id=c.org_id and z.id=c.discipline_id where c.org_id=org and c.center_id=center and c.discipline_id=(d->>'discipline_id')::uuid and c.state='active' and z.state='active') then perform private.fail('NOT_FOUND');end if;
  if d->>'class_id' is not null and not exists(select 1 from core.classes c where c.org_id=org and c.center_id=center and c.id=(d->>'class_id')::uuid and c.discipline_id=(d->>'discipline_id')::uuid and c.state='active') then perform private.fail('NOT_FOUND');end if;
  if coalesce((d->>'_touch')::bool,true) then
   if exists(select 1 from jsonb_array_elements(d->'resources') x group by x->>'kind',x->>'id' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
   d:=jsonb_set(d,'{assignments}',private.schedule_resolve_agreements(org,center,(d->>'discipline_id')::uuid,d->>'format',at_time,d->'assignments'));
   for e in select x from jsonb_array_elements(private.schedule_resources(d)) x loop
    perform private.assert_resource(org,center,e->>'kind',(e->>'id')::uuid);
    perform private.assert_availability(org,center,e->>'kind',(e->>'id')::uuid,at_time,end_time);
    if exists(select 1 from core.resource_bookings b where b.org_id=org and b.resource_kind=e->>'kind' and b.resource_id=(e->>'id')::uuid and b.state='active'
     and (b.session_id is null or not b.session_id=any(ids)) and b.starts_at<end_time and b.ends_at>at_time) then perform private.fail('RESOURCE_CONFLICT');end if;
    -- Older session writers did not materialize person bookings. They still participate in conflicts.
    if e->>'kind'='person' and exists(select 1 from core.session_assignments a join core.sessions ss on ss.org_id=a.org_id and ss.id=a.session_id
     where a.org_id=org and a.person_id=(e->>'id')::uuid and a.state='active' and ss.state<>'cancelled' and not ss.id=any(ids) and ss.starts_at<end_time and ss.ends_at>at_time) then perform private.fail('RESOURCE_CONFLICT');end if;
    if e->>'kind'='person' and exists(select 1 from core.class_assignments a join core.sessions ss on ss.org_id=a.org_id and ss.class_id=a.class_id and ss.center_id=a.center_id
     where a.org_id=org and a.person_id=(e->>'id')::uuid and a.state='active' and ss.assignment_mode='legacy' and ss.state<>'cancelled' and not ss.id=any(ids) and ss.starts_at<end_time and ss.ends_at>at_time) then perform private.fail('RESOURCE_CONFLICT');end if;
   end loop;
   if exists(select 1 from jsonb_array_elements(d->'assignments') a join core.reservations v on v.org_id=org and v.session_id=(d->>'id')::uuid and v.person_id=(a->>'person_id')::uuid and v.state='active' where a->>'duty'='assistant') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
   if exists(select 1 from core.seat_offers o where o.org_id=org and o.session_id=(d->>'id')::uuid and o.state='active' and o.expires_at>clock_timestamp() and o.expires_at>at_time) then perform private.fail('OFFER_UNAVAILABLE');end if;
   for r in select a.*,v.person_id from core.entitlement_allocations a join core.reservations v on v.org_id=a.org_id and v.id=a.reservation_id
    where v.org_id=org and v.session_id=(d->>'id')::uuid and v.state='active' and a.state='reserved' order by a.sale_id,a.id loop
    select * into sale from core.sales where org_id=org and id=r.sale_id;
    if sale.state<>'active' or sale.person_id<>r.person_id or at_time<sale.valid_from or (sale.valid_until is not null and at_time>=sale.valid_until)
     or not private.lesson_scope_matches(org,(d->>'id')::uuid,sale.product_version_id)
     or not exists(select 1 from core.entitlement_accounts a where a.org_id=org and a.sale_id=sale.id and a.state='active')
     or exists(select 1 from core.freezes z where z.org_id=org and z.sale_id=sale.id and z.state in ('scheduled','active','ended') and z.starts_at<=at_time and coalesce(z.actual_end,z.planned_end)>at_time)
    then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
    select * into p from core.product_versions where org_id=org and id=sale.product_version_id;
    if p.kind='timed' and p.quota is not null then
     select * into quota from private.quota_bounds(sale,p.quota,at_time);
     select coalesce(sum(a.quantity),0) into used from core.entitlement_allocations a where a.org_id=org and a.sale_id=sale.id and a.state in ('reserved','consumed')
      and coalesce((select (n->>'starts_at')::timestamptz from jsonb_array_elements(rows_data) n where (n->>'id')::uuid=(select v.session_id from core.reservations v where v.org_id=org and v.id=a.reservation_id)),private.allocation_time(a))>=quota.starts_at
      and coalesce((select (n->>'starts_at')::timestamptz from jsonb_array_elements(rows_data) n where (n->>'id')::uuid=(select v.session_id from core.reservations v where v.org_id=org and v.id=a.reservation_id)),private.allocation_time(a))<quota.ends_at;
     if used>(p.quota->>'limit')::bigint then perform private.fail('QUOTA_EXCEEDED');end if;
    end if;
   end loop;
  end if;
  resolved:=resolved||jsonb_build_array(d);
 end loop;
 -- Compare the proposed batch with itself after excluding its old bookings.
 if exists(select 1 from jsonb_array_elements(resolved) a cross join jsonb_array_elements(resolved) b
  where a->>'id'<b->>'id' and (a->>'starts_at')::timestamptz<(b->>'ends_at')::timestamptz and (a->>'ends_at')::timestamptz>(b->>'starts_at')::timestamptz
  and exists(select 1 from jsonb_array_elements(private.schedule_resources(a)) ar join jsonb_array_elements(private.schedule_resources(b)) br on ar->>'kind'=br->>'kind' and ar->>'id'=br->>'id')) then perform private.fail('RESOURCE_CONFLICT');end if;
 return resolved;
end$$;
create or replace function private.schedule_write(org uuid,rows_data jsonb,ids uuid[],offset_i int)
returns int language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare d jsonb;e jsonb;s core.sessions;a core.session_assignments;idx int:=offset_i;old_times jsonb:='[]';q record;at_time timestamptz;
begin
 -- Finish every session update before recomputing shared quota buckets.
 for d in select x from jsonb_array_elements(rows_data) x order by x->>'id' loop
  select * into s from core.sessions where org_id=org and id=(d->>'id')::uuid for update;
  if found then
   old_times:=old_times||jsonb_build_array(jsonb_build_object('id',s.id,'starts_at',s.starts_at));
   update core.sessions set starts_at=(d->>'starts_at')::timestamptz,ends_at=(d->>'ends_at')::timestamptz,nominal=(d->>'nominal')::bigint,maximum=(d->>'maximum')::bigint,assignment_mode=d->>'assignment_mode',version=version+1 where org_id=org and id=s.id;
  else
   insert into core.sessions(id,org_id,center_id,class_id,program_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state,assignment_mode)
   values((d->>'id')::uuid,org,(d->>'center_id')::uuid,(d->>'class_id')::uuid,(d->>'program_id')::uuid,(d->>'discipline_id')::uuid,d->>'format',(d->>'starts_at')::timestamptz,(d->>'ends_at')::timestamptz,(d->>'nominal')::bigint,(d->>'maximum')::bigint,'planned','open',d->>'assignment_mode');
  end if;
 end loop;
 for d in select x from jsonb_array_elements(rows_data) x order by x->>'id' loop
  if not coalesce((d->>'_touch')::bool,true) then continue;end if;
  update core.session_assignments a set state='inactive',version=version+1 where a.org_id=org and a.session_id=(d->>'id')::uuid and a.state='active'
   and not exists(select 1 from jsonb_array_elements(d->'assignments') n where (n->>'person_id')::uuid=a.person_id and n->>'duty'=a.duty);
  for e in select x from jsonb_array_elements(d->'assignments') x loop
   select * into a from core.session_assignments x where x.org_id=org and x.session_id=(d->>'id')::uuid and x.person_id=(e->>'person_id')::uuid and x.duty=e->>'duty' order by x.created_at desc,x.id desc limit 1 for update;
   if found then
    update core.session_assignments set state='active',agreement_id=(e->>'agreement_id')::uuid,origin_class_assignment_id=(e->>'origin_class_assignment_id')::uuid,version=version+1 where org_id=org and id=a.id;
   else
    insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,agreement_id,origin_class_assignment_id,state)
    values(private.new_id(ids,idx),org,(d->>'center_id')::uuid,(d->>'id')::uuid,(e->>'person_id')::uuid,e->>'duty',(e->>'agreement_id')::uuid,(e->>'origin_class_assignment_id')::uuid,'active');idx:=idx+1;
   end if;
  end loop;
  update core.resource_bookings set state='inactive',version=version+1 where org_id=org and session_id=(d->>'id')::uuid and state='active';
  for e in select x from jsonb_array_elements(private.schedule_resources(d)) x loop
   insert into core.resource_bookings(id,org_id,center_id,session_id,resource_kind,resource_id,starts_at,ends_at,state,duty_assignment)
   values(private.new_id(ids,idx),org,(d->>'center_id')::uuid,(d->>'id')::uuid,e->>'kind',(e->>'id')::uuid,(d->>'starts_at')::timestamptz,(d->>'ends_at')::timestamptz,'active',(e->>'duty_assignment')::bool);idx:=idx+1;
  end loop;
 end loop;
 for q in select distinct a.sale_id,v.session_id from core.entitlement_allocations a join core.reservations v on v.org_id=a.org_id and v.id=a.reservation_id
  where a.org_id=org and a.state in ('reserved','consumed') and v.session_id in(select (n->>'id')::uuid from jsonb_array_elements(rows_data) n join jsonb_array_elements(old_times) o on n->>'id'=o->>'id' where (n->>'starts_at')::timestamptz<>(o->>'starts_at')::timestamptz) order by a.sale_id,v.session_id loop
  select (n->>'starts_at')::timestamptz into at_time from jsonb_array_elements(old_times) n where (n->>'id')::uuid=q.session_id;
  if at_time is not null then perform private.sync_quota(org,q.sale_id,at_time,private.new_id(ids,idx));idx:=idx+1;end if;
  select starts_at into at_time from core.sessions where org_id=org and id=q.session_id;
  perform private.sync_quota(org,q.sale_id,at_time,private.new_id(ids,idx));idx:=idx+1;
 end loop;
 return idx;
end$$;
create or replace function private.schedule_preview_rows(rows_data jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('session_id',n->'id','interval',jsonb_build_object('starts_at',n->'starts_at','ends_at',n->'ends_at'),
 'resources',n->'resources','assignments',coalesce((select jsonb_agg(a-'origin_class_assignment_id' order by a->>'person_id',a->>'duty') from jsonb_array_elements(n->'assignments') a),'[]'::jsonb),
 'capacity',jsonb_build_object('nominal',n->'nominal','maximum',n->'maximum'))||case when n ? 'expected_version' then jsonb_build_object('expected_version',n->'expected_version') else '{}'::jsonb end order by (n->>'starts_at')::timestamptz,n->>'id'),'[]'::jsonb)
 from jsonb_array_elements(rows_data) n
$$;

-- Managed occurrences use materialized duties; legacy rows retain the previous class-read fallback.
create or replace function private.session_assignee(org uuid,actor uuid,session uuid)
returns bool language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.sessions s where s.org_id=org and s.id=session and (
 exists(select 1 from core.session_assignments a where a.org_id=org and a.center_id=s.center_id and a.session_id=s.id and a.person_id=actor and a.state='active' and private.has_role(org,actor,a.duty,s.center_id))
 or (s.assignment_mode='legacy' and exists(select 1 from core.class_assignments a where a.org_id=org and a.center_id=s.center_id and a.class_id=s.class_id and a.person_id=actor and a.state='active' and private.has_role(org,actor,a.duty,s.center_id)))
 ))
$$;
create or replace function private.schedule_session_view(org uuid,session uuid,financial bool)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',s.id,'class_id',s.class_id,'format',s.format,'discipline_id',s.discipline_id,
 'starts_at',s.starts_at,'ends_at',s.ends_at,'nominal',s.nominal,'maximum',s.maximum,'state',s.state,'attendance_state',s.attendance_state,'version',s.version,
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('person_id',a.person_id,'duty',a.duty) ||
 case when financial then jsonb_build_object('agreement_id',a.agreement_id) else '{}'::jsonb end order by a.person_id,a.duty)
 from core.session_assignments a where a.org_id=org and a.session_id=s.id and a.state='active'),'[]'::jsonb))
 ||case when financial and s.class_id is not null then jsonb_build_object('class_assignments',private.schedule_class_views(org,s.class_id),'class_version',(select version from core.classes where org_id=org and id=s.class_id)) else '{}'::jsonb end
 from core.sessions s where s.org_id=org and s.id=session
$$;
create or replace function private.schedule_before(org uuid,rows_data jsonb)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(private.schedule_snapshot(org,s.id) order by s.id),'[]'::jsonb) from core.sessions s where s.org_id=org and s.id in(select (n->>'id')::uuid from jsonb_array_elements(rows_data) n)
$$;
do $calendar$
declare body text:=pg_get_functiondef('private.schedule_page(text,jsonb,uuid,uuid,uuid)'::regprocedure);old text;new text;
begin
 old:=$old$where s.org_id=org and s.id=c.id and a.person_id=(r#>>'{resource,id}')::uuid and a.state='active'$old$;
 new:=$new$where s.org_id=org and s.id=c.id and s.assignment_mode='legacy' and a.person_id=(r#>>'{resource,id}')::uuid and a.state='active'$new$;
 if strpos(body,old)=0 then raise exception 'Calendar class resource anchor missing';end if;body:=replace(body,old,new);
 execute body;
end $calendar$;
do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;new text;
begin
 old:=$old$audit_delta jsonb; audit_recorded_at timestamptz;$old$;
 new:=old||$new$
 schedule_plan jsonb;schedule_rows jsonb;schedule_blockers jsonb;schedule_class uuid;desired_state text;assignment_row core.class_assignments;duty_row core.session_assignments;proposal jsonb;before_rows jsonb;
 $new$;
 if strpos(body,old)=0 then raise exception 'Schedule declaration anchor missing';end if;body:=replace(body,old,new);
 old:=$old$if center is null and r ? 'session_id' then$old$;
 new:=$new$if center is null and r ? 'class_id' then select center_id into center from core.classes where org_id=org and id=(r->>'class_id')::uuid;end if;
  if center is null and r ? 'session_id' then$new$;
 if strpos(body,old)=0 then raise exception 'Class center scope anchor missing';end if;body:=replace(body,old,new);
 -- Route the existing single-session writer through the same resource and duty checks.
 old:=substring(body from $rx$ when 'session_create_v1' then.*? when 'reservation_create_v1' then$rx$);
 if old is null then raise exception 'Session create anchor missing';end if;
 new:=$new$ when 'session_create_v1' then
  schedule_rows:=jsonb_build_array(jsonb_build_object('id',record_id,'class_id',r->'class_id','center_id',center,'discipline_id',r->'discipline_id','format',r->'format',
   'starts_at',r#>'{interval,starts_at}','ends_at',r#>'{interval,ends_at}','nominal',r#>'{capacity,nominal}','maximum',r#>'{capacity,maximum}','resources',r->'resources',
   'assignments',private.schedule_defaults(org,(r->>'class_id')::uuid,r->'assignments',coalesce((r->>'inherit_class_assignments')::bool,true)),
   'assignment_mode',case when coalesce((r->>'inherit_class_assignments')::bool,true) then 'inherit' else 'explicit' end,'_touch',true));
  schedule_rows:=private.schedule_validate(org,center,schedule_rows);
  idx:=private.schedule_write(org,schedule_rows,p_ids,idx);subject:='sessions';
 when 'reservation_create_v1' then$new$;
 body:=replace(body,old,new);
 old:=$old$ -- DOMAIN_CASES$old$;
 new:=$new$
 when 'program_preview_v1','session_change_preview_v1' then
  if p_operation='program_preview_v1' then schedule_plan:=private.schedule_build_program(org,center,r,p_ids);
  else schedule_plan:=private.schedule_build_change(org,center,r);end if;
  schedule_class:=(schedule_plan->>'class_id')::uuid;schedule_rows:=schedule_plan->'rows';schedule_blockers:='[]';
  begin schedule_rows:=private.schedule_validate(org,center,schedule_rows);schedule_plan:=jsonb_set(schedule_plan,'{rows}',schedule_rows);
  exception when sqlstate 'P0001' then
   schedule_blockers:=jsonb_build_array(jsonb_build_object('code',SQLERRM,'retryable',false,'trace_id',trace));
  end;
  dependencies:=private.schedule_dependencies(org,center,actor.id,schedule_class,schedule_rows);
  scope_hash:=md5(jsonb_build_object('actor',actor.id,'org',org,'center',center,'operation',p_operation,'request',r-'request_id')::text);
  token:=p_aux->>'token';if token is null then perform private.fail('INTEGRITY_VIOLATION');end if;
  select coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','sessions','id',n->'id'),'action',case when p_operation='program_preview_v1' then 'create' else 'adjust' end,'quantity',1) order by n->>'starts_at',n->>'id'),'[]'::jsonb) into entry from jsonb_array_elements(schedule_rows) n;
  out:=jsonb_build_object('id',record_id,'token',token,'scope_hash',scope_hash,'dependencies',dependencies,'effects',entry,'blockers',schedule_blockers,'expires_at',clock_timestamp()+interval '15 minutes',
   'sessions',private.schedule_preview_rows(schedule_rows),'class_assignments',private.schedule_class_views(org,schedule_class));
  if schedule_class is not null then out:=out||jsonb_build_object('class_version',(select version from core.classes where org_id=org and id=schedule_class));end if;
  insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state)
   values(record_id,org,actor.id,replace(p_operation,'_preview_','_apply_'),scope_hash,dependencies,out-'token','current');
  insert into private.preview_payloads(preview_id,payload,expires_at,token_hash)
   values(record_id,jsonb_build_object('center_id',center,'plan',schedule_plan,'request',r),(out->>'expires_at')::timestamptz,encode(extensions.digest(token,'sha256'),'hex'));
 when 'program_apply_v1','session_change_apply_v1' then
  select * into preview from core.previews where org_id=org and id=(r#>>'{preview,id}')::uuid for update;
  select * into preview_data from private.preview_payloads where preview_id=preview.id;
  if preview.id is null or preview.operation<>p_operation or preview.actor_account_id<>actor.id or preview.state<>'current' or preview_data.expires_at<=clock_timestamp()
   or preview_data.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or (preview_data.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
  schedule_plan:=preview_data.payload->'plan';schedule_rows:=schedule_plan->'rows';schedule_class:=(schedule_plan->>'class_id')::uuid;
  if private.schedule_dependencies(org,center,actor.id,schedule_class,schedule_rows)<>preview.dependencies then perform private.fail('PREVIEW_STALE');end if;
  if jsonb_array_length(preview.result->'blockers')>0 then perform private.fail(preview.result#>>'{blockers,0,code}');end if;
  schedule_rows:=private.schedule_validate(org,center,schedule_rows);
  before_rows:=private.schedule_before(org,schedule_rows);
  if p_operation='program_apply_v1' then
   record_id:=(schedule_plan->>'program_id')::uuid;
   insert into core.program_versions(id,org_id,center_id,class_id,weekdays,local_start,duration_minutes,starts_on,ends_on,state,timezone,spec_snapshot)
    values(record_id,org,center,schedule_class,array(select jsonb_array_elements_text(schedule_plan#>'{spec,weekdays}')::bigint),schedule_plan#>>'{spec,local_start}',(schedule_plan#>>'{spec,duration_minutes}')::bigint,
    (schedule_plan#>>'{spec,starts_on}')::date,(schedule_plan#>>'{spec,ends_on}')::date,'active',schedule_plan->>'timezone',schedule_plan->'spec');subject:='program_versions';
  else record_id:=((schedule_rows->0)->>'id')::uuid;subject:='sessions';end if;
  idx:=private.schedule_write(org,schedule_rows,p_ids,idx);
  if p_operation='session_change_apply_v1' then select version into version_n from core.sessions where org_id=org and id=record_id;end if;
  audit_delta:=jsonb_build_object('before',before_rows,'after',schedule_rows,'request',preview_data.payload->'request');
  update core.previews set state='applied',version=version+1 where id=preview.id;
  select coalesce(jsonb_agg(jsonb_build_object('type','sessions','id',n->'id') order by n->>'id'),'[]'::jsonb) into entry from jsonb_array_elements(schedule_rows) n;
  out:=jsonb_build_object('operation_id',operation_id,'primary_id',record_id,'version',version_n,'replayed',false,'related',entry);
 when 'session_capacity_set_v1','session_assignment_set_v1' then
  select * into ses from core.sessions where org_id=org and center_id=center and id=(r->>'session_id')::uuid for update;
  if not found then perform private.fail('NOT_FOUND');end if;
  if ses.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  proposal:=private.schedule_snapshot(org,ses.id);before_rows:=jsonb_build_array(proposal);
  if p_operation='session_capacity_set_v1' then
   if length(btrim(r->>'reason'))=0 then perform private.fail('VALIDATION_FAILED');end if;
   proposal:=proposal||jsonb_build_object('nominal',r->'nominal','maximum',r->'maximum');
  else
   desired_state:=coalesce(r->>'state','active');
   select * into duty_row from core.session_assignments a where a.org_id=org and a.session_id=ses.id and a.person_id=(r->>'person_id')::uuid and a.duty=r->>'duty' order by created_at desc,id desc limit 1;
   if desired_state='inactive' and duty_row.id is null and not exists(select 1 from jsonb_array_elements(proposal->'assignments') a where (a->>'person_id')::uuid=(r->>'person_id')::uuid and a->>'duty'=r->>'duty') then perform private.fail('NOT_FOUND');end if;
   select coalesce(jsonb_agg(a order by a->>'person_id',a->>'duty'),'[]'::jsonb) into entry from jsonb_array_elements(proposal->'assignments') a where not ((a->>'person_id')::uuid=(r->>'person_id')::uuid and a->>'duty'=r->>'duty');
   if desired_state='active' then entry:=entry||jsonb_build_array(jsonb_build_object('person_id',r->'person_id','duty',r->'duty','agreement_id',r->'agreement_id'));end if;
   proposal:=proposal||jsonb_build_object('assignments',entry,'_touch',true);
   if ses.assignment_mode='legacy' then proposal:=jsonb_set(proposal,'{assignment_mode}','"inherit"');end if;
  end if;
  schedule_rows:=private.schedule_validate(org,center,jsonb_build_array(proposal));idx:=private.schedule_write(org,schedule_rows,p_ids,idx);
  if p_operation='session_assignment_set_v1' and desired_state='inactive' then
   if duty_row.id is null then
    -- A legacy class-only duty has no physical row to retain as an explicit tombstone.
    insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,state,origin_class_assignment_id)
     values(private.new_id(p_ids,idx),org,center,ses.id,(r->>'person_id')::uuid,r->>'duty','inactive',null);idx:=idx+1;
   else
    update core.session_assignments set origin_class_assignment_id=null where org_id=org and session_id=ses.id and person_id=(r->>'person_id')::uuid and duty=r->>'duty' and state='inactive';
   end if;
  end if;
  record_id:=ses.id;select version into version_n from core.sessions where org_id=org and id=record_id;subject:='sessions';
  audit_delta:=jsonb_build_object('before',before_rows,'after',schedule_rows);
 when 'class_assignment_set_v1' then
  schedule_class:=(r->>'class_id')::uuid;
  if not exists(select 1 from core.classes c where c.org_id=org and c.center_id=center and c.id=schedule_class and c.state='active') then perform private.fail('NOT_FOUND');end if;
  perform private.assert_resource(org,center,'person',(r->>'person_id')::uuid);
  desired_state:=coalesce(r->>'state','active');
  select * into assignment_row from core.class_assignments a where a.org_id=org and a.class_id=schedule_class and a.person_id=(r->>'person_id')::uuid and a.duty=r->>'duty' for update;
  if found then
   if assignment_row.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   record_id:=assignment_row.id;
   update core.class_assignments set state=desired_state,version=version+1 where org_id=org and id=record_id returning version into version_n;
  else
   if r ? 'expected_version' then perform private.fail('VERSION_CONFLICT');end if;
   if desired_state='inactive' then perform private.fail('NOT_FOUND');end if;
   insert into core.class_assignments(id,org_id,center_id,class_id,person_id,duty,state) values(record_id,org,center,schedule_class,(r->>'person_id')::uuid,r->>'duty','active');
  end if;
  schedule_rows:='[]';
  for ses in select * from core.sessions s where s.org_id=org and s.center_id=center and s.class_id=schedule_class and s.state='planned' and s.attendance_state='open' and s.starts_at>clock_timestamp() and s.assignment_mode<>'explicit' order by s.id for update loop
   select * into duty_row from core.session_assignments a where a.org_id=org and a.session_id=ses.id and a.person_id=(r->>'person_id')::uuid and a.duty=r->>'duty' order by a.created_at desc,a.id desc limit 1;
   if duty_row.id is not null and duty_row.origin_class_assignment_id is null then continue;end if;
   proposal:=private.schedule_snapshot(org,ses.id);
   select coalesce(jsonb_agg(a order by a->>'person_id',a->>'duty'),'[]'::jsonb) into entry from jsonb_array_elements(proposal->'assignments') a where not ((a->>'person_id')::uuid=(r->>'person_id')::uuid and a->>'duty'=r->>'duty');
   if desired_state='active' then entry:=entry||jsonb_build_array(jsonb_build_object('person_id',r->'person_id','duty',r->'duty','origin_class_assignment_id',record_id));end if;
   proposal:=proposal||jsonb_build_object('assignments',entry,'assignment_mode','inherit','_touch',true);
   schedule_rows:=schedule_rows||jsonb_build_array(proposal);
  end loop;
  before_rows:=private.schedule_before(org,schedule_rows);schedule_rows:=private.schedule_validate(org,center,schedule_rows);
  idx:=private.schedule_write(org,schedule_rows,p_ids,idx);
  update core.classes set version=version+1 where org_id=org and id=schedule_class;
  subject:='class_assignments';audit_delta:=jsonb_build_object('before',to_jsonb(assignment_row),'after',r,'sessions_before',before_rows,'sessions_after',schedule_rows);
  select coalesce(jsonb_agg(jsonb_build_object('type','sessions','id',n->'id') order by n->>'id'),'[]'::jsonb) into entry from jsonb_array_elements(schedule_rows) n;
  out:=jsonb_build_object('operation_id',operation_id,'primary_id',record_id,'version',version_n,'replayed',false,'related',entry);
 -- DOMAIN_CASES
 $new$;
 if strpos(body,old)=0 then raise exception 'Program domain anchor missing';end if;body:=replace(body,old,new);
 execute body;
end
$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
notify pgrst,'reload schema';
commit;
begin;
insert into private.runtime_operations(name,permission,billing_class,features) values('program_preview_v1','schedule.manage','new',array['F08','F10']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.program_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('program_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.program_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.program_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('program_apply_v1','schedule.manage','new',array['F08','F10']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.program_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('program_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.program_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.program_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_change_preview_v1','schedule.manage','maintenance',array['F08','F13','F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_change_preview_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_change_preview_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_change_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_change_preview_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_change_apply_v1','schedule.manage','maintenance',array['F08','F13','F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_change_apply_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_change_apply_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_change_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_change_apply_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_capacity_set_v1','schedule.manage','maintenance',array['F08']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_capacity_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_capacity_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_capacity_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_capacity_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_assignment_set_v1','schedule.manage','maintenance',array['F13']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.session_assignment_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('session_assignment_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.session_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.session_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
insert into private.runtime_operations(name,permission,billing_class,features) values('class_assignment_set_v1','schedule.manage','config',array['F10','F14']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
create or replace function api_v1.class_assignment_set_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.execute_operation('class_assignment_set_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux)$$;
revoke all on function api_v1.class_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.class_assignment_set_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
notify pgrst,'reload schema';
commit;
