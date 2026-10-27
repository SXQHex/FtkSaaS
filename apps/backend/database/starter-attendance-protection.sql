-- Starter lesson attendance and acknowledged reservation protection.
begin;
alter table core.sales add column if not exists participation_block_policy_snapshot jsonb;
alter table core.reservations add column if not exists booking_obligation jsonb;
alter table core.attendance_entries add column if not exists consumes_on_close boolean;
alter table core.attendance_entries add column if not exists policy_snapshot jsonb;
alter table core.attendance_closures add column if not exists plan_snapshot jsonb;
alter table core.attendance_closures add column if not exists rights_snapshot jsonb;
create unique index if not exists lesson_one_attendance_entry on core.attendance_entries(org_id,reservation_id);
create unique index if not exists lesson_closure_revision on core.attendance_closures(org_id,session_id,revision);
create table if not exists private.reservation_protections(
 id uuid primary key,org_id uuid not null,reservation_id uuid not null,preview_id uuid not null,
 change jsonb not null,obligation jsonb not null,actor_account_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(org_id,preview_id,reservation_id),foreign key(org_id,reservation_id) references core.reservations(org_id,id)
);
create index if not exists lesson_protection_reservation on private.reservation_protections(org_id,reservation_id);
create table if not exists private.lesson_deficit_movements(
 id uuid primary key,org_id uuid not null,reservation_id uuid not null,deficit_id uuid not null,
 from_state text not null,to_state text not null,quantity bigint not null check(quantity>0),
 operation_id uuid not null,previous_id uuid,created_at timestamptz not null default clock_timestamp(),
 foreign key(org_id,reservation_id) references core.reservations(org_id,id),
 foreign key(org_id,deficit_id) references core.credit_deficits(org_id,id),
 foreign key(previous_id) references private.lesson_deficit_movements(id)
);
create index if not exists lesson_deficit_history on private.lesson_deficit_movements(org_id,reservation_id,created_at,id);
alter table private.reservation_protections enable row level security;
alter table private.lesson_deficit_movements enable row level security;
create or replace function private.lesson_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$;
drop trigger if exists lesson_protection_immutable on private.reservation_protections;
create trigger lesson_protection_immutable before update or delete on private.reservation_protections for each row execute function private.lesson_immutable();
drop trigger if exists lesson_deficit_immutable on private.lesson_deficit_movements;
create trigger lesson_deficit_immutable before update or delete on private.lesson_deficit_movements for each row execute function private.lesson_immutable();

create or replace function private.lesson_duty(org uuid,person uuid,session uuid,closing boolean) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.sessions s where s.org_id=org and s.id=session and (
 exists(select 1 from core.session_assignments a where a.org_id=org and a.session_id=s.id and a.person_id=person and a.state='active' and (not closing or a.duty='instructor') and private.has_role(org,person,a.duty,s.center_id))
 or exists(select 1 from core.class_assignments a where s.assignment_mode='legacy' and a.org_id=org and a.center_id=s.center_id and a.class_id=s.class_id and a.person_id=person and a.state='active' and (not closing or a.duty='instructor') and private.has_role(org,person,a.duty,s.center_id))))
$$;
create or replace function private.lesson_plan(org uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(p) from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id
 where s.org_id=org order by s.created_at desc,s.id desc limit 1
$$;
create or replace function private.lesson_limits(org uuid,center uuid,target uuid,discipline uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare def core.policy_versions;upper_p core.policy_versions;personal core.negative_limit_overrides;reserved bigint;consumed bigint;lim bigint;
begin
 select * into def from private.policy_at(org,center,'negative_default',clock_timestamp());
 select * into upper_p from private.policy_at(org,center,'negative_upper',clock_timestamp());
 select * into personal from core.negative_limit_overrides n where n.org_id=org and n.center_id=center and n.person_id=target and n.discipline_id=discipline;
 lim:=coalesce(personal.limit_count,(def.value->>'value')::bigint);
 if upper_p.id is not null and lim is not null then lim:=least(lim,(upper_p.value->>'value')::bigint);end if;
 select coalesce(sum(quantity) filter(where state='reserved'),0),coalesce(sum(quantity) filter(where state='consumed'),0) into reserved,consumed
 from core.credit_deficits d where d.org_id=org and d.center_id=center and d.person_id=target and d.discipline_id=discipline;
 return jsonb_build_object('override',personal.limit_count,'default_limit',(def.value->>'value')::bigint,'upper_limit',(upper_p.value->>'value')::bigint,
 'effective_limit',lim,'reserved_deficit',reserved,'consumed_deficit',consumed,'policy_version_ids',
 to_jsonb(array_remove(array[def.id,upper_p.id],null)),'override_version',personal.version);
end$$;
create or replace function private.lesson_obligation(org uuid,reservation uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('reservation_id',v.id,'session_id',v.session_id,'person_id',v.person_id,'existing_version',v.version,
 'source_sale_id',v.source_sale_id,
 'allocation_ids',coalesce((select jsonb_agg(a.id order by a.id) from core.entitlement_allocations a where a.org_id=org and a.reservation_id=v.id and a.state in('reserved','consumed')),'[]'::jsonb),
 'deficit_ids',coalesce((select jsonb_agg(a.id order by a.id) from core.credit_deficits a where a.org_id=org and a.reservation_id=v.id and a.state in('reserved','consumed')),'[]'::jsonb),
 'quantity',coalesce((select sum(a.quantity) from core.entitlement_allocations a where a.org_id=org and a.reservation_id=v.id and a.state in('reserved','consumed')),0)+coalesce((select sum(a.quantity) from core.credit_deficits a where a.org_id=org and a.reservation_id=v.id and a.state in('reserved','consumed')),0))
 from core.reservations v where v.org_id=org and v.id=reservation
$$;
create or replace function private.lesson_policy_ids(org uuid,center uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(k,coalesce(to_jsonb(p.id),'null'::jsonb)),'{}'::jsonb)
 from unnest(array['negative_default','negative_upper','debt_participation','participation_block_credit']) k
 left join lateral private.policy_at(org,center,k,clock_timestamp()) p on true
$$;
create or replace function private.lesson_future_policy_protected(org uuid,reservation uuid,reason text) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare v core.reservations;ss core.sessions;l jsonb;p core.policy_versions;k text;lim bigint;before_lim bigint;
begin
 select * into v from core.reservations q where q.org_id=org and q.id=reservation;
 if v.booking_obligation is null then return false;end if;
 select * into ss from core.sessions q where q.org_id=org and q.id=v.session_id;
 if reason is null then return private.lesson_future_policy_protected(org,reservation,'credit_limit_exceeded') or private.lesson_future_policy_protected(org,reservation,'debt_policy');end if;
 if reason='credit_limit_exceeded' then
  l:=private.lesson_limits(org,v.center_id,v.person_id,ss.discipline_id);lim:=(l->>'effective_limit')::bigint;before_lim:=(v.booking_obligation#>>'{limits,effective_limit}')::bigint;
  if lim is null or before_lim is null or lim>=before_lim then return false;end if;
  foreach k in array array['negative_default','negative_upper'] loop
   select * into p from private.policy_at(org,v.center_id,k,clock_timestamp());
   -- Publication preceded this booking, but activation followed its actual authorization.
   if p.id is not null and p.created_at<=(v.booking_obligation->>'captured_at')::timestamptz
    and p.effective_at>(v.booking_obligation->>'captured_at')::timestamptz
    and v.booking_obligation#>>array['policies',k] is distinct from p.id::text then
    return not exists(select 1 from core.credit_deficits d where d.org_id=org and d.center_id=v.center_id and d.person_id=v.person_id and d.discipline_id=ss.discipline_id
     and d.state in('reserved','consumed') and d.created_at>p.effective_at);
   end if;
  end loop;
 elsif reason='debt_policy' then
  select * into p from private.policy_at(org,v.center_id,'debt_participation',clock_timestamp());
  if coalesce((v.booking_obligation->>'debt_participation')::bool,false) then return false;end if;
  return p.id is not null and coalesce((p.value->>'value')::bool,false) and p.created_at<=(v.booking_obligation->>'captured_at')::timestamptz
   and p.effective_at>(v.booking_obligation->>'captured_at')::timestamptz
   and not exists(select 1 from core.debts d where d.org_id=org and d.person_id=v.person_id and private.debt_remaining(org,d.id)>0 and d.created_at>p.effective_at);
 end if;return false;
end$$;
create or replace function private.lesson_protected(org uuid,reservation uuid,reason text default null) returns boolean language sql stable security invoker set search_path='' as $$
 select private.lesson_future_policy_protected(org,reservation,reason) or exists(select 1 from private.reservation_protections p
 join core.reservations v on v.org_id=p.org_id and v.id=p.reservation_id
 join core.sessions s on s.org_id=v.org_id and s.id=v.session_id
 where p.org_id=org and p.reservation_id=reservation and
 (reason is null
 or (reason='credit_limit_exceeded' and p.change#>>'{_proof,reason}'='credit_limit_exceeded'
 and (private.lesson_limits(org,v.center_id,v.person_id,s.discipline_id)->>'reserved_deficit')::bigint+
 (private.lesson_limits(org,v.center_id,v.person_id,s.discipline_id)->>'consumed_deficit')::bigint<=(p.change#>>'{_proof,deficit_ceiling}')::bigint)
 or (reason='debt_policy' and p.change#>>'{_proof,reason}'='debt_policy' and not exists(
 select 1 from core.debts d where d.org_id=org and d.person_id=v.person_id and private.debt_remaining(org,d.id)>0
 and not (p.change#>'{_proof,debt_ids}') ? d.id::text))))
$$;
create or replace function private.lesson_eligibility(org uuid,reservation uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v core.reservations;s core.sessions;l jsonb;reason text;pol core.policy_versions;allowed bool:=true;
begin
 select * into v from core.reservations where org_id=org and id=reservation;
 select * into s from core.sessions where org_id=org and id=v.session_id;
 l:=private.lesson_limits(org,v.center_id,v.person_id,s.discipline_id);
 if (l->>'effective_limit')::bigint is not null and (l->>'reserved_deficit')::bigint+(l->>'consumed_deficit')::bigint>(l->>'effective_limit')::bigint
 and not private.lesson_protected(org,v.id,'credit_limit_exceeded') then allowed:=false;reason:='credit_limit_exceeded';end if;
 select * into pol from private.policy_at(org,v.center_id,'debt_participation',clock_timestamp());
 if coalesce((pol.value->>'value')::bool,false) and exists(select 1 from core.debts q where q.org_id=org and q.person_id=v.person_id and private.debt_remaining(org,q.id)>0)
 and not private.lesson_protected(org,v.id,'debt_policy') then allowed:=false;reason:='debt_policy';end if;
 return jsonb_build_object('evaluated_for',clock_timestamp(),'limit',l->'effective_limit','reserved_deficit',l->'reserved_deficit','consumed_deficit',l->'consumed_deficit',
 'this_reservation_counted',exists(select 1 from core.credit_deficits q where q.org_id=org and q.reservation_id=v.id and q.state in('reserved','consumed')),
 'eligible',allowed,'reason',reason,'policy_version_ids',l->'policy_version_ids','center_id',v.center_id,'discipline_id',s.discipline_id,
 'evidence_hash',md5(jsonb_build_object('obligation',private.lesson_obligation(org,v.id),'limits',l,'debt_policy',pol.id)::text));
end$$;
create or replace function private.lesson_impact_authorize(org uuid,center uuid,person uuid,change jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
begin
 if change->>'kind'='policy' then
  if center is null then if not private.is_org_reader(org,person) then perform private.fail('FORBIDDEN');end if;
  elsif not private.is_manager(org,person,center) and not private.is_org_reader(org,person) then perform private.fail('FORBIDDEN');end if;
 elsif change->>'kind'='negative_limit' then
  if center is null or not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
  if not exists(select 1 from core.people p join core.center_relationships c on c.org_id=p.org_id and c.person_id=p.id where p.org_id=org and p.id=(change->>'person_id')::uuid and p.state='active' and c.center_id=center and c.state='active')
   or not exists(select 1 from core.center_disciplines d where d.org_id=org and d.center_id=center and d.discipline_id=(change->>'discipline_id')::uuid and d.state='active') then perform private.fail('NOT_FOUND');end if;
 else perform private.fail('POLICY_NOT_CONFIGURED');end if;
end$$;
create or replace function private.lesson_validate_policy(org uuid,center uuid,change jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare prior core.policy_versions;
begin
 perform private.validate_policy(change->>'key',change->'value');
 if change->>'key' in('negative_default','negative_upper') and (change#>>'{value,value}')::bigint<0 then perform private.fail('VALIDATION_FAILED');end if;
 if center is not null then
  if private.lesson_plan(org)->>'name'<>'business' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  select * into prior from private.policy_at(org,null,change->>'key',(change->>'effective_at')::timestamptz);
  if prior.id is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if prior.mandatory or coalesce((select p.mandatory from private.policy_at(org,null,change->>'key',clock_timestamp()) p),false) or (change->>'mandatory')::bool then perform private.fail('FORBIDDEN');end if;
 end if;
 if change#>>'{value,kind}'='valuation' and not exists(select 1 from core.disciplines d where d.org_id=org and d.id=(change#>>'{value,discipline_id}')::uuid and d.state='active') then perform private.fail('NOT_FOUND');end if;
end$$;
create or replace function private.lesson_change_adverse(org uuid,center uuid,target uuid,discipline uuid,change jsonb,change_center uuid default null,reservation uuid default null) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare l jsonb:=private.lesson_limits(org,center,target,discipline);old_lim bigint;new_lim bigint;used bigint;p core.policy_versions;
begin
 if change->>'kind'='policy' and change_center is null and not coalesce((change->>'mandatory')::bool,false) then
  select * into p from private.policy_at(org,center,change->>'key',(change->>'effective_at')::timestamptz);
  if p.scope_center_id is not null then return false;end if;
 end if;
 old_lim:=(l->>'effective_limit')::bigint;used:=(l->>'reserved_deficit')::bigint+(l->>'consumed_deficit')::bigint;
 if change->>'kind'='negative_limit' then new_lim:=(change->>'allowed_negative_credits')::bigint;
 elsif change->>'key'='negative_default' then new_lim:=coalesce((l->>'override')::bigint,(change#>>'{value,value}')::bigint);
 elsif change->>'key'='negative_upper' then new_lim:=least(coalesce((l->>'override')::bigint,(l->>'default_limit')::bigint),(change#>>'{value,value}')::bigint);
 elsif change->>'key'='debt_participation' then
  select * into p from private.policy_at(org,center,'debt_participation',clock_timestamp());
  return coalesce((change#>>'{value,value}')::bool,false) and not coalesce((p.value->>'value')::bool,false)
  and exists(select 1 from core.debts d where d.org_id=org and d.person_id=target and private.debt_remaining(org,d.id)>0);
 else return false;end if;
 if change->>'key' is distinct from 'negative_upper' and l->>'upper_limit' is not null then new_lim:=least(new_lim,(l->>'upper_limit')::bigint);end if;
 return old_lim is not null and new_lim<old_lim and used>new_lim and (used<=old_lim or (reservation is not null and private.lesson_protected(org,reservation,'credit_limit_exceeded')));
end$$;
create or replace function private.lesson_affected(org uuid,center uuid,change jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(private.lesson_obligation(org,v.id) order by v.id),'[]'::jsonb)
 from core.reservations v join core.sessions s on s.org_id=v.org_id and s.id=v.session_id
 where v.org_id=org and v.state='active' and (center is null or v.center_id=center)
 and (change->>'kind'<>'negative_limit' or (v.person_id=(change->>'person_id')::uuid and s.discipline_id=(change->>'discipline_id')::uuid))
 and private.lesson_change_adverse(org,v.center_id,v.person_id,s.discipline_id,change,center,v.id)
$$;
create or replace function private.lesson_dependencies(org uuid,center uuid,account uuid,change jsonb default null,session uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare hashes jsonb:='{}';t text;h text;versions jsonb:='[]';persons uuid[];actor_person uuid;
begin
 select l.person_id into actor_person from core.account_links l where l.org_id=org and l.account_id=account and l.state='active';
 if session is not null then
  select array_agg(distinct v.person_id) into persons from core.reservations v where v.org_id=org and v.session_id=session;
 elsif change->>'kind'='negative_limit' then persons:=array[(change->>'person_id')::uuid];
 else select array_agg(distinct v.person_id) into persons from core.reservations v where v.org_id=org and v.state='active' and (center is null or v.center_id=center);
 end if;
 persons:=coalesce(persons,array[]::uuid[]);
 foreach t in array array['people','policy_versions','negative_limit_overrides','reservations','attendance_entries','attendance_closures','entitlement_allocations','entitlement_accounts','credit_deficits','sales','product_versions','freezes','quota_buckets','debts','collections','saas_subscriptions','account_links','role_assignments','permission_overrides'] loop
  if not exists(select 1 from information_schema.tables where table_schema='core' and table_name=t) then continue;end if;
  execute format($q$select md5(coalesce(string_agg(to_jsonb(q)::text,'' order by id),'')) from core.%I q where org_id=$1 and
   case
   when $2='people' then id=any($3)
   when $2='policy_versions' then (to_jsonb(q)->>'scope_center_id' is null or $4 is null or to_jsonb(q)->>'scope_center_id'=$4::text) and (to_jsonb(q)->>'key' in('negative_default','negative_upper','debt_participation','participation_block_credit','debt_booking') or to_jsonb(q)->>'key'=$8->>'key')
   when $2='saas_subscriptions' then true
   when $2='account_links' then to_jsonb(q)->>'account_id'=$5::text
   when $2 in('role_assignments','permission_overrides') then to_jsonb(q)->>'person_id'=$6::text
   when $2 in('attendance_entries','attendance_closures') then
    case when $7 is not null then coalesce(to_jsonb(q)->>'session_id',(select v.session_id::text from core.reservations v where v.org_id=$1 and v.id::text=to_jsonb(q)->>'reservation_id'))=$7::text else false end
   when $2 in('entitlement_allocations','quota_buckets','freezes') then exists(select 1 from core.sales x where x.org_id=$1 and x.id::text=to_jsonb(q)->>'sale_id' and x.person_id=any($3))
   when $2='product_versions' then exists(select 1 from core.sales x where x.org_id=$1 and x.product_version_id=q.id and x.person_id=any($3))
   when $2='reservations' and $7 is not null then to_jsonb(q)->>'session_id'=$7::text
   when $2 in('reservations','credit_deficits','negative_limit_overrides') then to_jsonb(q)->>'person_id'=any(select unnest($3)::text) and ($4 is null or to_jsonb(q)->>'center_id'=$4::text)
   else to_jsonb(q)->>'person_id'=any(select unnest($3)::text)
   end$q$,t) into h using org,t,persons,center,account,actor_person,session,change;
  hashes:=hashes||jsonb_build_object(t,h);
 end loop;
 select md5(coalesce(jsonb_agg(jsonb_build_object('id',d.id,'remaining',private.debt_remaining(org,d.id)) order by d.id)::text,'')) into h
 from core.debts d where d.org_id=org and d.person_id=any(persons);
 hashes:=hashes||jsonb_build_object('debt_remainders',h);
 select md5(coalesce(jsonb_agg(jsonb_build_object('center',c.id,'active',private.lesson_policy_ids(org,c.id)) order by c.id)::text,'')) into h
 from core.centers c where c.org_id=org and (center is null or c.id=center);
 hashes:=hashes||jsonb_build_object('active_policy_versions',h);
 if session is not null then
  select jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type','sessions','id',s.id),'version',s.version)) into versions from core.sessions s where s.org_id=org and s.id=session;
 end if;
 return jsonb_build_object('versions',coalesce(versions,'[]'::jsonb),'policy_hashes',jsonb_build_array(md5(hashes::text)),'permission_hash',md5(jsonb_build_object('actor',account,'roles',hashes->'role_assignments','links',hashes->'account_links','grants',hashes->'permission_overrides')::text));
end$$;
create or replace function private.lesson_consumes(org uuid,reservation uuid,result text,policy_terms jsonb) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if result='attended' then return true;
 elsif result='no_show' then
  if policy_terms#>>'{cancellation,no_show}' is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  return policy_terms#>>'{cancellation,no_show}'='consume';
 elsif result='blocked' then
  if policy_terms#>>'{blocked,effect}' is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  return policy_terms#>>'{blocked,effect}'='consume';
 end if;perform private.fail('ATTENDANCE_INCOMPLETE');return false;
end$$;
create or replace function private.lesson_terms(org uuid,reservation uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('cancellation',coalesce(p.value->'terms',p.value),'blocked',case when v.source_sale_id is not null then (select x.participation_block_policy_snapshot from core.sales x where x.org_id=org and x.id=v.source_sale_id) else v.booking_obligation->'blocked_policy' end)
 from core.reservations v join core.policy_versions p on p.org_id=v.org_id and p.id=v.policy_version_id
 where v.org_id=org and v.id=reservation
$$;
create or replace function private.lesson_right(org uuid,reservation uuid,consume bool,op uuid,ids uuid[],offset_i int,correction bool) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a core.entitlement_allocations;d core.credit_deficits;desired text:=case when consume then 'consumed' else 'released' end;prior uuid;before_data jsonb;
begin
 select * into a from core.entitlement_allocations q where q.org_id=org and q.reservation_id=reservation order by q.created_at desc,q.id desc limit 1 for update;
 if found then
  before_data:=to_jsonb(a);perform private.set_right_state(org,null,reservation,consume,op,ids,offset_i,correction);
  return jsonb_build_object('kind','allocation','before',before_data,'after',(select to_jsonb(q) from core.entitlement_allocations q where q.org_id=org and q.id=a.id));
 end if;
 select * into d from core.credit_deficits q where q.org_id=org and q.reservation_id=reservation order by q.created_at desc,q.id desc limit 1 for update;
 if not found then perform private.fail('INTEGRITY_VIOLATION');end if;
 before_data:=to_jsonb(d);
 if d.state='settled' then perform private.fail('POLICY_NOT_CONFIGURED');end if; -- sale-settlement correction consumer is a separate dependency.
 if d.state<>desired then
  if d.state<>'reserved' and not correction then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select m.id into prior from private.lesson_deficit_movements m where m.org_id=org and m.deficit_id=d.id order by m.created_at desc,m.id desc limit 1;
  insert into private.lesson_deficit_movements(id,org_id,reservation_id,deficit_id,from_state,to_state,quantity,operation_id,previous_id)
   values(private.new_id(ids,offset_i),org,reservation,d.id,d.state,desired,d.quantity,op,prior);
  update core.credit_deficits set state=desired,version=version+1 where org_id=org and id=d.id;
 end if;
 return jsonb_build_object('kind','deficit','before',before_data,'after',(select to_jsonb(q) from core.credit_deficits q where q.org_id=org and q.id=d.id));
end$$;
create or replace function private.lesson_view(org uuid,session uuid,financial boolean default false) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('session_id',s.id,'session_version',s.version,'closure_state',s.attendance_state,
 'revision',coalesce((select max(c.revision) from core.attendance_closures c where c.org_id=org and c.session_id=s.id),0),
 'entries',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('reservation_id',v.id,'person_id',v.person_id,'result',coalesce(a.result,'unmarked'),'blocked_reason',a.blocked_reason,'version',v.version,
 'protected',private.lesson_protected(org,v.id)))||jsonb_build_object('eligibility_snapshot',case when financial then v.eligibility_snapshot else null end) order by v.person_id,v.id)
 from core.reservations v left join core.attendance_entries a on a.org_id=v.org_id and a.reservation_id=v.id where v.org_id=org and v.session_id=s.id and v.state in('active','completed')),'[]'::jsonb))
 from core.sessions s where s.org_id=org and s.id=session
$$;

create or replace function private.lesson_dispatch(op text,r jsonb,org uuid,center uuid,account uuid,person uuid,operation uuid,ids uuid[],aux jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare result jsonb;primary_id uuid:=private.new_id(ids,2);subject text;ver bigint:=1;idx int:=20;
 change jsonb;affected jsonb;ack jsonb;dep jsonb;token text;scope_hash text;pv core.previews;payload private.preview_payloads;request_data jsonb;row_data jsonb;
 s core.sessions;v core.reservations;a core.attendance_entries;cl core.attendance_closures;last_cl core.attendance_closures;policy core.policy_versions;
 e jsonb;facts jsonb;terms jsonb;effects jsonb:='[]';plan jsonb;consumes bool;rev bigint;before_data jsonb;current_ids jsonb;protected_qty bigint;
begin
 if op='negative_limits_get_v1' then
  perform private.lesson_impact_authorize(org,center,person,jsonb_build_object('kind','negative_limit','person_id',r->'person_id','discipline_id',r->'discipline_id'));
  if not exists(select 1 from core.people p join core.center_relationships q on q.org_id=p.org_id and q.person_id=p.id where p.org_id=org and p.id=(r->>'person_id')::uuid and q.center_id=center and q.state='active') then perform private.fail('NOT_FOUND');end if;
  result:=private.lesson_limits(org,center,(r->>'person_id')::uuid,(r->>'discipline_id')::uuid)||jsonb_build_object('person_id',r->'person_id','center_id',center,'discipline_id',r->'discipline_id','version',(select p.version from core.people p where p.org_id=org and p.id=(r->>'person_id')::uuid));
  return jsonb_build_object('data',result,'primary_id',r->'person_id','subject','negative_limit_overrides');
 end if;
 if op in('reservation_impact_preview_v1','reservation_impact_apply_v1','negative_limit_set_v1','policy_publish_v1') then
  if op='reservation_impact_preview_v1' then
   change:=r->'change';perform private.lesson_impact_authorize(org,center,person,change);
   if change->>'kind'='policy' then perform private.lesson_validate_policy(org,center,change);end if;
   if length(btrim(r->>'reason'))=0 then perform private.fail('VALIDATION_FAILED');end if;
   affected:=private.lesson_affected(org,center,change);dep:=private.lesson_dependencies(org,center,account,change);
   token:=aux->>'token';if token is null then perform private.fail('INTEGRITY_VIOLATION');end if;
   scope_hash:=md5(jsonb_build_object('actor',account,'org',org,'center',center,'change',change,'reason',r->'reason')::text);
   result:=jsonb_build_object('id',primary_id,'token',token,'scope_hash',scope_hash,'dependencies',dep,'effects','[]'::jsonb,'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
   insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(primary_id,org,account,'reservation_impact_apply_v1',scope_hash,dep,result-'token','current');
   insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(primary_id,jsonb_build_object('center_id',center,'request',r,'affected',affected,'proofs',coalesce((select jsonb_object_agg(v.id::text,jsonb_build_object(
 'reason',case when change->>'key'='debt_participation' then 'debt_policy' else 'credit_limit_exceeded' end,
 'deficit_ceiling',(private.lesson_limits(org,v.center_id,v.person_id,s.discipline_id)->>'reserved_deficit')::bigint+(private.lesson_limits(org,v.center_id,v.person_id,s.discipline_id)->>'consumed_deficit')::bigint,
 'debt_ids',coalesce((select jsonb_agg(d.id) from core.debts d where d.org_id=org and d.person_id=v.person_id and private.debt_remaining(org,d.id)>0),'[]'::jsonb)))
 from core.reservations v join core.sessions s on s.org_id=v.org_id and s.id=v.session_id where v.org_id=org and v.id in(select (x->>'reservation_id')::uuid from jsonb_array_elements(affected) x)),'{}'::jsonb)),(result->>'expires_at')::timestamptz,encode(extensions.digest(token,'sha256'),'hex'));
   return jsonb_build_object('data',jsonb_build_object('preview',result,'change',change,'affected',affected,'preserves_reservations',true,'waives_independent_blocks',false),'primary_id',primary_id,'subject','previews');
  end if;
  if op='reservation_impact_apply_v1' then token:=r#>>'{preview,token}';primary_id:=(r#>>'{preview,id}')::uuid;
  elsif r ? 'impact_approval' then token:=r#>>'{impact_approval,token}';primary_id:=(r#>>'{impact_approval,id}')::uuid;else token:=null;end if;
  if token is not null then
   select * into pv from core.previews p where p.org_id=org and p.id=primary_id for update;
   select * into payload from private.preview_payloads p where p.preview_id=pv.id;
   if pv.id is null or pv.operation<>'reservation_impact_apply_v1' or pv.actor_account_id<>account or pv.state<>'current' or payload.expires_at<=clock_timestamp()
   or payload.token_hash is distinct from encode(extensions.digest(token,'sha256'),'hex') or (payload.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
   request_data:=payload.payload->'request';change:=request_data->'change';
   perform private.lesson_impact_authorize(org,center,person,change);
   if private.lesson_dependencies(org,center,account,change)<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
   if op='negative_limit_set_v1' and change<>jsonb_build_object('kind','negative_limit','person_id',r->'person_id','discipline_id',r->'discipline_id','allowed_negative_credits',r->'allowed_negative_credits') then perform private.fail('PREVIEW_STALE');end if;
   if op='policy_publish_v1' and change<>jsonb_build_object('kind','policy','key',r->'key','value',r->'value','effective_at',r->'effective_at','mandatory',r->'mandatory') then perform private.fail('PREVIEW_STALE');end if;
   if op<>'reservation_impact_apply_v1' and r->>'reason' is not null and r->>'reason'<>request_data->>'reason' then perform private.fail('PREVIEW_STALE');end if;
   affected:=payload.payload->'affected';
   select coalesce(jsonb_agg(x->'reservation_id' order by x->>'reservation_id'),'[]'::jsonb) into current_ids from jsonb_array_elements(affected) x;
   select coalesce(jsonb_agg(x order by x#>>'{}'),'[]'::jsonb) into ack from jsonb_array_elements(r->'accepted_reservation_ids') x;
   if ack is distinct from current_ids then perform private.fail('VALIDATION_FAILED');end if;
  else
   if op='negative_limit_set_v1' or op='reservation_impact_apply_v1' then perform private.fail('PREVIEW_STALE');end if;
   change:=jsonb_build_object('kind','policy','key',r->'key','value',r->'value','effective_at',r->'effective_at','mandatory',r->'mandatory');
   perform private.lesson_impact_authorize(org,center,person,change);affected:=private.lesson_affected(org,center,change);
   if jsonb_array_length(affected)>0 then perform private.fail('PREVIEW_STALE');end if;
  end if;
  if change->>'kind'='policy' then
   perform private.lesson_validate_policy(org,center,change);
   select * into policy from core.policy_versions p where p.org_id=org and p.scope_center_id is not distinct from center and p.key=change->>'key' order by p.version desc,p.id desc limit 1;
   ver:=coalesce(policy.version,0)+1;primary_id:=private.new_id(ids,2);
   insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value,previous_id,version) values(primary_id,org,center,change->>'key',(change->>'effective_at')::timestamptz,(change->>'mandatory')::bool,change->'value',policy.id,ver);subject:='policy_versions';
  else
   if op='negative_limit_set_v1' and (select p.version from core.people p where p.org_id=org and p.id=(change->>'person_id')::uuid)<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   select id into primary_id from core.negative_limit_overrides n where n.org_id=org and n.center_id=center and n.person_id=(change->>'person_id')::uuid and n.discipline_id=(change->>'discipline_id')::uuid for update;
   if primary_id is null then primary_id:=private.new_id(ids,2);
    insert into core.negative_limit_overrides(id,org_id,center_id,person_id,discipline_id,limit_count,reason) values(primary_id,org,center,(change->>'person_id')::uuid,(change->>'discipline_id')::uuid,(change->>'allowed_negative_credits')::bigint,request_data->>'reason');
   else update core.negative_limit_overrides set limit_count=(change->>'allowed_negative_credits')::bigint,reason=request_data->>'reason',version=version+1 where id=primary_id;end if;
   update core.people set version=version+1 where org_id=org and id=(change->>'person_id')::uuid returning version into ver;subject:='negative_limit_overrides';
  end if;
  for e in select x from jsonb_array_elements(affected) x loop
   insert into private.reservation_protections(id,org_id,reservation_id,preview_id,change,obligation,actor_account_id) values(private.new_id(ids,idx),org,(e->>'reservation_id')::uuid,pv.id,change||jsonb_build_object('_proof',payload.payload#>array['proofs',e->>'reservation_id']),e,account);idx:=idx+1;
   update core.reservations set version=version+1 where org_id=org and id=(e->>'reservation_id')::uuid;
  end loop;
  if pv.id is not null then update core.previews set state='applied',version=version+1 where id=pv.id;end if;
 else
  -- Only the Starter financial path is implemented; never silently omit F20 earnings.
  select * into s from core.sessions q where q.org_id=org and q.id=coalesce((r->>'session_id')::uuid,(select v.session_id from core.reservations v where v.org_id=org and v.id=(r->>'reservation_id')::uuid)) and q.center_id=center for update;
  if op='attendance_correct_apply_v1' then
   select * into pv from core.previews p where p.org_id=org and p.id=(r#>>'{preview,id}')::uuid for update;
   select * into payload from private.preview_payloads p where p.preview_id=pv.id;
   if pv.id is null or pv.operation<>op or pv.actor_account_id<>account or pv.state<>'current' or payload.expires_at<=clock_timestamp() or payload.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') or (payload.payload->>'center_id')::uuid is distinct from center then perform private.fail('PREVIEW_STALE');end if;
   request_data:=payload.payload->'request';
   select * into s from core.sessions q where q.org_id=org and q.id=(request_data->>'session_id')::uuid and q.center_id=center for update;
   if private.lesson_dependencies(org,center,account,null,s.id)<>pv.dependencies then perform private.fail('PREVIEW_STALE');end if;
  end if;
  if s.id is null then perform private.fail('NOT_FOUND');end if;
  primary_id:=s.id;subject:='sessions';ver:=s.version;
  if op='attendance_get_v1' then return jsonb_build_object('data',private.lesson_view(org,s.id,private.is_manager(org,person,center) or private.is_org_reader(org,person)),'primary_id',s.id,'subject','sessions');end if;
  if op in('attendance_mark_v1','attendance_block_v1') then
   if s.attendance_state<>'open' or s.state<>'planned' then perform private.fail('ATTENDANCE_CLOSED');end if;
   select * into v from core.reservations q where q.org_id=org and q.id=(r->>'reservation_id')::uuid and q.session_id=s.id and q.state='active' for update;
   if v.id is null then perform private.fail('NOT_FOUND');end if;
   if v.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   facts:=private.lesson_eligibility(org,v.id);
   if op='attendance_mark_v1' then
    if exists(select 1 from core.attendance_entries q where q.org_id=org and q.reservation_id=v.id and q.result='blocked') then perform private.fail('FORBIDDEN');end if;
    if not (facts->>'eligible')::bool then perform private.fail('FORBIDDEN');end if;
    for e in select jsonb_build_object('kind',b.resource_kind,'id',b.resource_id) from core.resource_bookings b where b.org_id=org and b.session_id=s.id and b.state='active' loop
     perform private.assert_availability(org,center,e->>'kind',(e->>'id')::uuid,s.starts_at,s.ends_at);
    end loop;
   else
    if (facts->>'eligible')::bool or facts->>'reason'<>r->>'reason' then perform private.fail('FORBIDDEN');end if;
   end if;
   terms:=private.lesson_terms(org,v.id);consumes:=private.lesson_consumes(org,v.id,case when op='attendance_block_v1' then 'blocked' else r->>'result' end,terms);
   insert into core.attendance_entries(id,org_id,center_id,reservation_id,result,blocked_reason,consumes_on_close,policy_snapshot)
    values(private.new_id(ids,idx),org,center,v.id,case when op='attendance_block_v1' then 'blocked' else r->>'result' end,case when op='attendance_block_v1' then r->>'reason' end,consumes,terms)
    on conflict(org_id,reservation_id) do update set result=excluded.result,blocked_reason=excluded.blocked_reason,consumes_on_close=excluded.consumes_on_close,policy_snapshot=excluded.policy_snapshot,version=core.attendance_entries.version+1;
   update core.reservations set eligibility_snapshot=facts,version=version+1 where org_id=org and id=v.id returning version into ver;
   update core.sessions set version=version+1 where org_id=org and id=s.id;primary_id:=v.id;subject:='reservations';
  elsif op='attendance_close_v1' then
   plan:=private.lesson_plan(org);
   if plan->>'name'<>'starter' or (plan->'features') ? 'F20' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   if s.attendance_state<>'open' or s.state<>'planned' then perform private.fail('ATTENDANCE_CLOSED');end if;
   if s.version<>(r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   if clock_timestamp()<s.starts_at then perform private.fail('INVALID_STATE_TRANSITION');end if;
   if exists(select 1 from core.reservations q left join core.attendance_entries a on a.org_id=q.org_id and a.reservation_id=q.id where q.org_id=org and q.session_id=s.id and q.state='active' and (a.id is null or a.result='unmarked')) then perform private.fail('ATTENDANCE_INCOMPLETE');end if;
   for v in select * from core.reservations q where q.org_id=org and q.session_id=s.id and q.state='active' order by q.id for update loop
    select * into a from core.attendance_entries q where q.org_id=org and q.reservation_id=v.id;
    if a.consumes_on_close is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
    e:=private.lesson_right(org,v.id,a.consumes_on_close,operation,ids,idx,false);idx:=idx+4;
    effects:=effects||jsonb_build_array(jsonb_build_object('reservation_id',v.id,'result',a.result,'policy_snapshot',a.policy_snapshot,'right',e));
    update core.reservations set state='completed',version=version+1 where org_id=org and id=v.id;
   end loop;
   insert into core.attendance_closures(id,org_id,center_id,session_id,revision,closed_by,closed_at,plan_snapshot,rights_snapshot)
    values(private.new_id(ids,idx),org,center,s.id,1,person,clock_timestamp(),jsonb_build_object('id',plan->'id','name',plan->'name','financial_mode','starter_no_earning','captured_at',clock_timestamp()),effects);
   update core.sessions set attendance_state='closed',state='occurred',version=version+1 where org_id=org and id=s.id returning version into ver;
  elsif op in('attendance_correct_preview_v1','attendance_correct_apply_v1') then
   select * into last_cl from core.attendance_closures q where q.org_id=org and q.session_id=s.id order by q.revision desc limit 1;
   if s.attendance_state<>'closed' or last_cl.id is null then perform private.fail('INVALID_STATE_TRANSITION');end if;
   if last_cl.plan_snapshot->>'financial_mode' is distinct from 'starter_no_earning' then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   if op='attendance_correct_preview_v1' then request_data:=r;end if;
   if length(btrim(request_data->>'reason'))=0 or jsonb_array_length(request_data->'corrections')=0 or exists(select 1 from jsonb_array_elements(request_data->'corrections') x group by x->>'reservation_id' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
   for e in select x from jsonb_array_elements(request_data->'corrections') x loop
    select * into v from core.reservations q where q.org_id=org and q.id=(e->>'reservation_id')::uuid and q.session_id=s.id and q.state='completed';
    if not found then perform private.fail('NOT_FOUND');end if;
    if e->>'result'='unmarked' or (e->>'result'='blocked' and e->>'reason' is null) then perform private.fail('VALIDATION_FAILED');end if;
    if e->>'result'='blocked' and private.lesson_protected(org,v.id,e->>'reason') then perform private.fail('FORBIDDEN');end if;
   end loop;
   if op='attendance_correct_preview_v1' then
    primary_id:=private.new_id(ids,2);token:=aux->>'token';dep:=private.lesson_dependencies(org,center,account,null,s.id);
    select coalesce(jsonb_agg(jsonb_build_object('entity',jsonb_build_object('type','reservations','id',x->'reservation_id'),
     'action',case when private.lesson_consumes(org,(x->>'reservation_id')::uuid,x->>'result',a.policy_snapshot) then 'consume' else 'release' end,
     'quantity',coalesce((select q.quantity from core.entitlement_allocations q where q.org_id=org and q.reservation_id=a.reservation_id order by q.created_at desc,q.id desc limit 1),(select q.quantity from core.credit_deficits q where q.org_id=org and q.reservation_id=a.reservation_id order by q.created_at desc,q.id desc limit 1),0),'reason',request_data->'reason')),'[]'::jsonb) into effects
     from jsonb_array_elements(request_data->'corrections') x join core.attendance_entries a on a.org_id=org and a.reservation_id=(x->>'reservation_id')::uuid;
    scope_hash:=md5((r-'request_id')::text);
    result:=jsonb_build_object('id',primary_id,'token',token,'scope_hash',scope_hash,'dependencies',dep,'effects',effects,'blockers','[]'::jsonb,'expires_at',clock_timestamp()+interval '15 minutes');
    insert into core.previews(id,org_id,actor_account_id,operation,scope_hash,dependencies,result,state) values(primary_id,org,account,'attendance_correct_apply_v1',scope_hash,dep,result-'token','current');
    insert into private.preview_payloads(preview_id,payload,expires_at,token_hash) values(primary_id,jsonb_build_object('center_id',center,'request',r),(result->>'expires_at')::timestamptz,encode(extensions.digest(token,'sha256'),'hex'));
    return jsonb_build_object('data',result,'primary_id',primary_id,'subject','previews');
   end if;
   effects:='[]'::jsonb;
   for row_data in select x from jsonb_array_elements(request_data->'corrections') x loop
    select * into v from core.reservations q where q.org_id=org and q.id=(row_data->>'reservation_id')::uuid for update;
    select * into a from core.attendance_entries q where q.org_id=org and q.reservation_id=v.id for update;
    consumes:=private.lesson_consumes(org,v.id,row_data->>'result',a.policy_snapshot);
    e:=private.lesson_right(org,v.id,consumes,operation,ids,idx,true);idx:=idx+4;
    effects:=effects||jsonb_build_array(jsonb_build_object('reservation_id',v.id,'before_result',a.result,'result',row_data->>'result','policy_snapshot',a.policy_snapshot,'right',e));
    update core.attendance_entries set result=row_data->>'result',blocked_reason=case when row_data->>'result'='blocked' then row_data->>'reason' end,consumes_on_close=consumes,version=version+1 where org_id=org and id=a.id;
    update core.reservations set version=version+1 where org_id=org and id=v.id;
   end loop;
   insert into core.attendance_closures(id,org_id,center_id,session_id,revision,closed_by,closed_at,corrects_id,reason,plan_snapshot,rights_snapshot)
    values(private.new_id(ids,idx),org,center,s.id,last_cl.revision+1,person,clock_timestamp(),last_cl.id,request_data->>'reason',last_cl.plan_snapshot,effects);
   update core.sessions set version=version+1 where org_id=org and id=s.id returning version into ver;
   update core.previews set state='applied',version=version+1 where org_id=org and id=pv.id;
  else perform private.fail('NOT_FOUND');end if;
 end if;
 result:=jsonb_build_object('operation_id',operation,'primary_id',primary_id,'version',ver,'replayed',false,'related','[]'::jsonb);
 return jsonb_build_object('data',result,'primary_id',primary_id,'subject',subject,'audit',jsonb_build_object('request',coalesce(request_data,r),'protected_obligations',affected,'right_effects',effects));
end$$;

-- Starter does not select or require an instructor fee agreement; paid plans keep the existing validation.
do $patch$
declare b text;
begin
 b:=pg_get_functiondef('private.schedule_resolve_agreements(uuid,uuid,uuid,text,timestamptz,jsonb)'::regprocedure);
 b:=replace(b,'begin'||chr(10)||' if exists', $n$begin
 if private.lesson_plan(org)->>'name'='starter' then
  if exists(select 1 from jsonb_array_elements(duties) e group by e->>'person_id',e->>'duty' having count(*)>1) then perform private.fail('VALIDATION_FAILED');end if;
  return coalesce((select jsonb_agg(e-'agreement_id') from jsonb_array_elements(duties) e),'[]'::jsonb);
 end if;
 if exists$n$);
 execute b;
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 b:=replace(b,$o$when 'center_manager_assign_v1','manager_self_assign_center_v1','org_manager_assign_v1','role_assign_v1' then$o$,$n$when 'center_manager_assign_v1','manager_self_assign_center_v1','org_manager_assign_v1','role_assign_v1' then
  if p_operation='role_assign_v1' and r->>'role'='staff' then perform private.require_feature(org,'F05');end if;$n$);
 b:=replace(b,$o$when 'reservation_create_v1' then$o$,$n$when 'reservation_create_v1' then
  if r->>'mode'='priority' then perform private.require_feature(org,'F10');end if;
  if r->>'mode'='flexible' and not cm and not private.staff_grant(org,person,center,'reservation.write') and exists(select 1 from core.sessions s where s.org_id=org and s.id=(r->>'session_id')::uuid and s.format='group') then perform private.require_feature(org,'F11');end if;$n$);
 b:=replace(b,$o$when 'product_publish_v1' then$o$,$n$when 'product_publish_v1' then
  if coalesce((r#>>'{terms,freeze,enabled}')::bool,false) or coalesce((r#>>'{terms,freeze,extends_validity}')::bool,false) then perform private.require_feature(org,'F17');end if;
  if exists(select 1 from jsonb_array_elements(r#>'{terms,scopes}') x where x->>'center_id' is not null and x->>'center_id'<>center::text) then perform private.require_feature(org,'F18');end if;$n$);
 b:=replace(b,$o$when 'sale_preview_v1' then$o$,$n$when 'sale_preview_v1' then
  if exists(select 1 from core.product_versions p where p.org_id=org and p.id=(r->>'product_version_id')::uuid and p.kind='timed') then perform private.require_feature(org,'F16');end if;$n$);
 b:=replace(b,$o$when 'sale_apply_v1' then$o$,$n$when 'sale_apply_v1' then
  if exists(select 1 from private.preview_payloads x join core.product_versions p on p.org_id=org and p.id=(x.payload->>'product_version_id')::uuid where x.preview_id=(r#>>'{preview,id}')::uuid and p.kind='timed') then perform private.require_feature(org,'F16');end if;$n$);
 -- Conditional plan capabilities are not unconditional feature-reference gates.
 b:=replace(b,$o$when 'class_save_v1' then$o$,$n$when 'class_save_v1' then
  if coalesce((r->>'external_open')::bool,false) then perform private.require_feature(org,'F11');end if;$n$);
 b:=replace(b,$o$when 'session_create_v1' then$o$,$n$when 'session_create_v1' then
  if r->>'format'='private' then perform private.require_feature(org,'F09');end if;
  if exists(select 1 from jsonb_array_elements(r->'assignments') a where a->>'agreement_id' is not null) then perform private.require_feature(org,'F20');end if;$n$);
 b:=replace(b,$o$when 'program_preview_v1','session_change_preview_v1' then$o$,$n$when 'program_preview_v1','session_change_preview_v1' then
  if exists(select 1 from jsonb_array_elements(coalesce(r#>'{schedule,assignments}',r#>'{patch,assignments}','[]'::jsonb)) a where a->>'agreement_id' is not null) then perform private.require_feature(org,'F20');end if;
  if p_operation='session_change_preview_v1' and r#>'{patch,assignments}' is not null then perform private.require_feature(org,'F13');end if;$n$);
 -- Dedicated authorization before receipts, using original change authority.
 b:=replace(b,$o$elsif perm_code='event.attendance' then$o$,$n$elsif perm_code='reservation.protection.manage' then
  if p_operation='reservation_impact_preview_v1' then entry:=r->'change';
  else select v.payload#>'{request,change}' into entry from private.preview_payloads v join core.previews p on p.id=v.preview_id where p.org_id=org and p.actor_account_id=actor.id and p.id=(r#>>'{preview,id}')::uuid;end if;
  if entry is null then perform private.fail('FORBIDDEN');end if;
  perform private.lesson_impact_authorize(org,center,person,entry);
 elsif perm_code in('attendance.draft','attendance.close') then
  if not cm and not (perm_code='attendance.draft' and private.staff_grant(org,person,center,'attendance.draft'))
   and not private.lesson_duty(org,person,coalesce((r->>'session_id')::uuid,(select q.session_id from core.reservations q where q.org_id=org and q.id=(r->>'reservation_id')::uuid)),perm_code='attendance.close') then perform private.fail('FORBIDDEN');end if;
 elsif perm_code='event.attendance' then$n$);
 -- Reject the current debt-booking barrier for NEW requests only.
 b:=replace(b,$o$insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,source_sale_id)$o$,$n$if coalesce((select (p.value->>'value')::bool from private.policy_at(org,center,'debt_booking',clock_timestamp()) p),false) and exists(select 1 from core.debts q where q.org_id=org and q.person_id=target and private.debt_remaining(org,q.id)>0) then perform private.fail('FORBIDDEN');end if;
  insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,source_sale_id)$n$);
 b:=replace(b,$o$update core.reservations set source_sale_id=selected where id=record_id;subject:='reservations';$o$,$n$update core.reservations set source_sale_id=selected,booking_obligation=jsonb_build_object('captured_at',clock_timestamp(),'policies',private.lesson_policy_ids(org,center),'limits',private.lesson_limits(org,center,target,ses.discipline_id),'blocked_policy',case when selected is not null then (select x.participation_block_policy_snapshot from core.sales x where x.org_id=org and x.id=selected) else (select p.value from private.policy_at(org,center,'participation_block_credit',clock_timestamp()) p) end,'debt_participation',coalesce((select (p.value->>'value')::bool from private.policy_at(org,center,'debt_participation',clock_timestamp()) p),false),'obligation',private.lesson_obligation(org,record_id)) where id=record_id;subject:='reservations';$n$);
 b:=replace(b,$o$ if out ? 'items' and p_operation<>'disciplines_list_v1' then$o$,$n$ if p_operation='sale_apply_v1' then
  update core.sales set participation_block_policy_snapshot=(select p.value from private.policy_at(org,center,'participation_block_credit',clock_timestamp()) p) where org_id=org and id=record_id;
 end if;
 if out ? 'items' and p_operation<>'disciplines_list_v1' then$n$);
 -- Replace only policy_publish's case, retaining all other domain behavior.
 b:=regexp_replace(b,$rx$when 'policy_publish_v1' then.*?(?=when 'policies_get_v1' then)$rx$,$n$when 'policy_publish_v1' then
  terms:=private.lesson_dispatch(p_operation,r,org,center,actor.id,person,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';audit_delta:=terms->'audit';
  if terms#>>'{audit,request,reason}' is not null then r:=r||jsonb_build_object('reason',terms#>>'{audit,request,reason}');end if;
 $n$,'s');
 b:=replace(b,' -- DOMAIN_CASES',$n$
 when 'negative_limits_get_v1','negative_limit_set_v1','reservation_impact_preview_v1','reservation_impact_apply_v1',
 'attendance_get_v1','attendance_mark_v1','attendance_block_v1','attendance_close_v1','attendance_correct_preview_v1','attendance_correct_apply_v1' then
  terms:=private.lesson_dispatch(p_operation,r,org,center,actor.id,person,operation_id,p_ids,p_aux);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';audit_delta:=terms->'audit';
  if terms#>>'{audit,request,reason}' is not null then r:=r||jsonb_build_object('reason',terms#>>'{audit,request,reason}');end if;
 -- DOMAIN_CASES$n$);
 execute b;
end$patch$;
-- Personal override substitutes for default; the configured upper still limits NEW reservations.
do $patch$
declare b text;
begin
 b:=pg_get_functiondef('private.reserve_negative(uuid,uuid,uuid,uuid,uuid[],integer)'::regprocedure);
 b:=replace(b,$o$if lim is null then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;$o$,'');
 b:=replace(b,$o$if upper_n is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;$o$,'');
 b:=replace(b,$o$select coalesce(sum(quantity),0) into used$o$,$n$if lim is null then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
 if upper_n is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select coalesce(sum(quantity),0) into used$n$);
 execute b;
end$patch$;
revoke all on private.reservation_protections,private.lesson_deficit_movements from public,anon,authenticated;
grant select,insert on private.reservation_protections,private.lesson_deficit_movements to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
