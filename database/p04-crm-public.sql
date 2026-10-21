-- P04: one person registry; scoped CRM; explicit trial policy; public intent only.
begin;
create unique index p04_open_lead on core.leads(org_id,center_id,person_id) where state='open';
create unique index p04_publication_session on core.publications(org_id,session_id) where session_id is not null;
create unique index p04_publication_event on core.publications(org_id,event_id) where event_id is not null;
create unique index p04_open_application on core.public_applications(org_id,publication_id,target_hash) where state='pending';
create unique index p04_trial_usage on core.trial_usages(org_id,offer_id);
create unique index p04_rate_window on core.rate_limit_windows(dimension,key_hash,starts_at);
alter table core.publications add column if not exists public_details jsonb;
alter table core.publications add constraint p04_publication_target check ((session_id is null)<>(event_id is null));
alter table core.public_applications add column if not exists person_id uuid;
alter table core.public_applications add constraint p04_application_person foreign key(org_id,person_id) references core.people(org_id,id);
alter table core.trial_offers add column if not exists terms_snapshot jsonb;
-- Operator configuration: no default duration or product is invented. A configured
-- immutable product supplies the fixed price/scope; the org/person repeat policy
-- is resolved live. This is not a grant to sell/collect/change a price.
create table private.p04_trial_configuration(
 org_id uuid not null,center_id uuid not null,product_version_id uuid not null,
 offer_minutes integer not null check(offer_minutes>0),enabled boolean not null,
 primary key(org_id,product_version_id),
 foreign key(org_id,center_id,product_version_id) references core.product_versions(org_id,center_id,id)
);
alter table private.p04_trial_configuration enable row level security;
revoke all on private.p04_trial_configuration from public,anon,authenticated;
grant select,insert,update,delete on private.p04_trial_configuration to service_role;

create function private.p04_can_lead(org uuid,center uuid,actor uuid,assigned uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select private.is_manager(org,actor,center) or (assigned=actor and private.staff_grant(org,actor,center,'crm.daily'))
$$;
-- Resolve targets before permissions AND receipt replay; supplied center is never authority.
create function private.p04_center(op text,r jsonb,org uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare actual uuid;c uuid:=(r->>'center_id')::uuid;
begin
 if op in ('lead_save_v1','leads_list_v1','crm_followup_list_v1') and r->>'lead_id' is null then return c;end if;
 if op='public_application_review_v1' and r->>'application_id' is null then return c;end if;
 if op='trial_registration_confirm_v1' then select center_id into actual from core.trial_offers where org_id=org and id=(r->>'offer_id')::uuid;
 elsif op='public_application_review_v1' then select center_id into actual from core.public_applications where org_id=org and id=(r->>'application_id')::uuid;
 elsif op='publication_set_v1' then
  if (r->>'session_id' is null)=(r->>'event_id' is null) then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'session_id' is not null then select center_id into actual from core.sessions where org_id=org and id=(r->>'session_id')::uuid;
  else select center_id into actual from core.events where org_id=org and id=(r->>'event_id')::uuid;end if;
 else select center_id into actual from core.leads where org_id=org and id=(r->>'lead_id')::uuid;end if;
 if actual is null or (c is not null and c<>actual) then perform private.fail('NOT_FOUND');end if;
 return actual;
end$$;
create function private.p04_access(op text,r jsonb,org uuid,center uuid,actor uuid) returns void language plpgsql security invoker set search_path='' as $$
declare l core.leads;assigned uuid;
begin
 if op='publication_set_v1' then
  if not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;return;
 end if;
 if op in ('leads_list_v1','crm_followup_list_v1') and center is null then
  if not exists(select 1 from core.centers c where c.org_id=org and (private.is_manager(org,actor,c.id) or private.staff_grant(org,actor,c.id,'crm.daily'))) then perform private.fail('FORBIDDEN');end if;return;
 end if;
 if center is null then perform private.fail('VALIDATION_FAILED');end if;
 if op='public_application_review_v1' then
  -- Unassigned public intake belongs to the center manager. Staff cannot claim it.
  if not private.is_manager(org,actor,center) then perform private.fail('FORBIDDEN');end if;return;
 end if;
 if op='trial_registration_confirm_v1' then
  select x.* into l from core.leads x join core.trial_offers o on o.org_id=x.org_id and o.lead_id=x.id where o.org_id=org and o.id=(r->>'offer_id')::uuid;
 elsif r->>'lead_id' is not null then select * into l from core.leads where org_id=org and id=(r->>'lead_id')::uuid;end if;
 if l.id is not null then
  if not coalesce(private.p04_can_lead(org,center,actor,l.assigned_person_id),false) then perform private.fail('FORBIDDEN');end if;
 elsif not private.is_manager(org,actor,center) and not private.staff_grant(org,actor,center,'crm.daily') then perform private.fail('FORBIDDEN');end if;
 if op='lead_save_v1' and not private.is_manager(org,actor,center) then
  assigned:=coalesce((r->>'assigned_to')::uuid,actor);
  if assigned<>actor then perform private.fail('FORBIDDEN');end if;
 end if;
 -- CRM does not confer the separate student activation permission.
 if op='lead_convert_v1' and not private.is_manager(org,actor,center) and not private.staff_grant(org,actor,center,'person.activate') then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.p04_lead_view(l core.leads,due timestamptz default null) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',l.id,'person_id',l.person_id,'source',l.source,'interest',l.interest,'assigned_to',l.assigned_person_id,'state',l.state,'version',l.version,
 'last_contact',l.last_meaningful_contact_at,'due_followup',coalesce(due,(select min(a.due_at) from core.crm_activities a where a.org_id=l.org_id and a.lead_id=l.id and a.completed_at is null)))
$$;
create function private.p04_leads_page(op text,r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text:=coalesce(r#>>'{page,sort}','created_at_asc');
 h text:=md5(jsonb_build_object('op',op,'actor',actor,'request',r-'request_id'-'page','sort',sorting)::text);cur jsonb;asof timestamptz:=clock_timestamp();last_at timestamptz;last_id uuid;items jsonb;token text;days bigint;
begin
 if lim<1 or lim>200 or sorting not in ('created_at_asc','created_at_desc','due_at_asc') then perform private.fail('VALIDATION_FAILED');end if;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 select coalesce(jsonb_agg(q.data order by case when sorting<>'created_at_desc' then q.at end,case when sorting='created_at_desc' then q.at end desc,
 case when sorting<>'created_at_desc' then q.id end,case when sorting='created_at_desc' then q.id end desc),'[]'::jsonb) into items from (
 select l.id,t.at,private.p04_lead_view(l,f.due)||jsonb_build_object('_at',t.at) data from core.leads l
 join core.people p on p.org_id=l.org_id and p.id=l.person_id
 cross join lateral(select min(a.due_at) due from core.crm_activities a where a.org_id=org and a.lead_id=l.id and a.completed_at is null) f
 cross join lateral(select case when sorting='due_at_asc' then coalesce(f.due,'infinity'::timestamptz) else l.created_at end at) t
 where l.org_id=org and (center is null or l.center_id=center) and l.created_at<=asof and private.center_accessible(org,l.center_id)
 and coalesce(private.p04_can_lead(org,l.center_id,actor,l.assigned_person_id),false)
 and (r->>'query' is null or p.display_name ilike '%'||(r->>'query')||'%' or l.source ilike '%'||(r->>'query')||'%' or l.interest ilike '%'||(r->>'query')||'%')
 and (cur is null or (sorting<>'created_at_desc' and (t.at,l.id)>(last_at,last_id)) or (sorting='created_at_desc' and (t.at,l.id)<(last_at,last_id)))
 order by case when sorting<>'created_at_desc' then t.at end,case when sorting='created_at_desc' then t.at end desc,
 case when sorting<>'created_at_desc' then l.id end,case when sorting='created_at_desc' then l.id end desc limit lim+1) q;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',items->-1->'id','as_of',asof)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality z(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;

create function private.p04_trial_limit(org uuid,center uuid,target uuid) returns bigint language plpgsql security invoker set search_path='' as $$
declare lim bigint;
begin
 select (p.value->>'value')::bigint into lim from private.policy_at(org,center,'trial_repeat_limit',clock_timestamp()) p;
 if lim is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 -- All historical uses count across centers and leads. Active promises also count.
 if (select count(*) from core.trial_usages where org_id=org and person_id=target)+
 (select count(*) from core.trial_offers o join core.leads l on l.org_id=o.org_id and l.id=o.lead_id where o.org_id=org and l.person_id=target and o.state='active' and o.expires_at>clock_timestamp())>=lim then perform private.fail('QUOTA_EXCEEDED');end if;
 return lim;
end$$;
create function private.p04_trial_session(org uuid,center uuid,target uuid,product uuid,sid uuid,exclude_offer uuid default null) returns void language plpgsql security invoker set search_path='' as $$
declare s core.sessions;a record;window jsonb;n bigint;
begin
 select * into s from core.sessions where org_id=org and center_id=center and id=sid for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 if s.state<>'planned' or s.starts_at<=clock_timestamp() then perform private.fail('OFFER_UNAVAILABLE');end if;
 if not private.lesson_scope_matches(org,s.id,product) then perform private.fail('CLASS_ACCESS_DENIED');end if;
 if exists(select 1 from core.session_assignments where org_id=org and session_id=s.id and person_id=target and state='active') then perform private.fail('ASSISTANT_PARTICIPANT_CONFLICT');end if;
 if exists(select 1 from core.reservations where org_id=org and session_id=s.id and person_id=target and state='active') then perform private.fail('RESERVATION_EXISTS');end if;
 perform private.p01_wait_window(org,s);
 for a in select b.resource_kind kind,b.resource_id id from core.resource_bookings b where b.org_id=org and b.session_id=s.id and b.state='active'
 union select 'person',x.person_id from core.session_assignments x where x.org_id=org and x.session_id=s.id and x.state='active' loop
  perform private.assert_availability(org,center,a.kind,a.id,s.starts_at,s.ends_at);
 end loop;
 if coalesce((select (p.value->>'value')::bool from private.policy_at(org,center,'debt_booking',clock_timestamp()) p),false) and exists(select 1 from core.debts d where d.org_id=org and d.person_id=target and private.debt_remaining(org,d.id)>0) then perform private.fail('PARTICIPATION_BLOCKED');end if;
 select (select count(*) from core.reservations where org_id=org and session_id=s.id and state='active')+
 (select count(*) from core.seat_offers where org_id=org and session_id=s.id and state='active' and expires_at>clock_timestamp())+
 (select count(*) from core.trial_offers where org_id=org and session_id=s.id and state='active' and expires_at>clock_timestamp() and (exclude_offer is null or id<>exclude_offer)) into n;
 if n>=s.nominal then perform private.fail('CAPACITY_FULL');end if;
end$$;

-- Followup population is active students, including those who never had a lead.
create function private.p04_followups_page(r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare lim int:=coalesce((r#>>'{page,limit}')::int,50);sorting text:=coalesce(r#>>'{page,sort}','due_at_asc');cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;
 h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page','sort',sorting)::text);
begin
 if lim<1 or lim>200 or sorting not in ('created_at_asc','created_at_desc','due_at_asc') then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from private.policy_at(org,center,case when r->>'kind'='inactive_student' then 'inactive_student_days' else 'entitlement_reminder_days' end,asof)) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with population as(
 select x.*,p.value policy,l.id lead_id,l.assigned_person_id from core.center_relationships x
 left join lateral(select z.id,z.assigned_person_id from core.leads z where z.org_id=org and z.center_id=x.center_id and z.person_id=x.person_id order by z.created_at desc,z.id desc limit 1) l on true
 left join lateral private.policy_at(org,x.center_id,case when r->>'kind'='inactive_student' then 'inactive_student_days' else 'entitlement_reminder_days' end,asof) p on true
 where x.org_id=org and x.kind='student' and x.state='active' and (center is null or x.center_id=center) and x.created_at<=asof and private.center_accessible(org,x.center_id)
 and (private.is_manager(org,actor,x.center_id) or (l.assigned_person_id=actor and private.staff_grant(org,actor,x.center_id,'crm.daily')))
 ),due_rows as(
 select x.*,case when r->>'kind'='renewal_due' then
  (select min(s.valid_until) from core.sales s where s.org_id=org and s.center_id=x.center_id and s.person_id=x.person_id and s.state='active'
  and not exists(select 1 from core.sales successor where successor.org_id=org and successor.previous_sale_id=s.id and successor.state='active'))
 else coalesce((select max(coalesce(ss.actual_started_at,ss.starts_at)) from core.reservations v join core.sessions ss on ss.org_id=v.org_id and ss.id=v.session_id where v.org_id=org and v.center_id=x.center_id and v.person_id=x.person_id and v.state='completed' and exists(select 1 from core.attendance_entries ae where ae.org_id=v.org_id and ae.reservation_id=v.id and ae.result='attended')),x.started_at)+make_interval(days=>(x.policy->>'value')::int) end due
 from population x where x.policy is not null
 ),filtered as(
 select x.*,case when sorting='due_at_asc' then x.due else x.created_at end at from due_rows x where x.due is not null
 and x.due<=case when r->>'kind'='renewal_due' then asof+make_interval(days=>(x.policy->>'value')::int) else asof end
 and (r->>'interval' is null or (x.due>=(r#>>'{interval,starts_at}')::timestamptz and x.due<(r#>>'{interval,ends_at}')::timestamptz))
 ),page as(select * from filtered where cur is null or (sorting<>'created_at_desc' and (at,id)>(last_at,last_id)) or (sorting='created_at_desc' and (at,id)<(last_at,last_id))
 order by case when sorting<>'created_at_desc' then at end,case when sorting='created_at_desc' then at end desc,case when sorting<>'created_at_desc' then id end,case when sorting='created_at_desc' then id end desc limit lim+1)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'person_id',person_id,'center_id',center_id,'lead_id',lead_id,'assigned_to',assigned_person_id,'kind',r->>'kind','due_at',due,'_at',at)
 order by case when sorting<>'created_at_desc' then at end,case when sorting='created_at_desc' then at end desc,case when sorting<>'created_at_desc' then id end,case when sorting='created_at_desc' then id end desc),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',items->-1->'id','as_of',asof)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality z(x,n);
 return jsonb_build_object('items',items,'next_cursor',token,'as_of',asof);
end$$;

create function private.p04_command(op text,r jsonb,org uuid,center uuid,actor uuid,account uuid,operation uuid,ids uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare l core.leads;a core.crm_activities;o core.trial_offers;pv core.product_versions;pub core.publications;app core.public_applications;cfg private.p04_trial_configuration;
 pid uuid:=private.new_id(ids,2);ver bigint:=1;subject text:='leads';target uuid;assigned uuid;limit_n bigint;policy uuid;sid uuid;terms jsonb;due timestamptz;new_person uuid;
begin
 if op='crm_followup_list_v1' then return jsonb_build_object('data',private.p04_followups_page(r,org,center,actor),'primary_id',org,'subject','people');end if;
 if op='leads_list_v1' then return jsonb_build_object('data',private.p04_leads_page(op,r,org,center,actor),'primary_id',org,'subject','leads');end if;
 if op='lead_save_v1' then
  target:=(r->>'person_id')::uuid;
  if not exists(select 1 from core.people where org_id=org and id=target and state='active') or not (exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and state='active') or (exists(select 1 from private.person_origins where org_id=org and center_id=center and person_id=target) and not exists(select 1 from core.center_relationships where org_id=org and person_id=target))) then perform private.fail('NOT_FOUND');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind in ('student','candidate') and state='active') then
   insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(private.new_id(ids,28),org,center,target,'candidate','active',clock_timestamp());
  end if;
  assigned:=(r->>'assigned_to')::uuid;
  if not private.is_manager(org,actor,center) then assigned:=actor;end if;
  if assigned is not null and not (private.is_manager(org,assigned,center) or private.staff_grant(org,assigned,center,'crm.daily')) then perform private.fail('FORBIDDEN');end if;
  if r->>'lead_id' is null then
   if r ? 'expected_version' then perform private.fail('VALIDATION_FAILED');end if;
   if exists(select 1 from core.leads where org_id=org and center_id=center and person_id=target and state='open') then perform private.fail('INVALID_STATE_TRANSITION');end if;
   insert into core.leads(id,org_id,center_id,person_id,source,interest,assigned_person_id,state) values(pid,org,center,target,r->>'source',r->>'interest',assigned,'open');
  else
   select * into l from core.leads where org_id=org and center_id=center and id=(r->>'lead_id')::uuid for update;
   if l.person_id<>target then perform private.fail('VALIDATION_FAILED');end if;
   if l.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   if l.state<>'open' then perform private.fail('INVALID_STATE_TRANSITION');end if;
   pid:=l.id;update core.leads set source=r->>'source',interest=r->>'interest',assigned_person_id=assigned,version=version+1 where id=pid returning version into ver;
  end if;
 elsif op='crm_activity_save_v1' then
  select * into l from core.leads where org_id=org and center_id=center and id=(r->>'lead_id')::uuid for update;
  if l.state<>'open' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if r->>'activity_id' is null then
   if r ? 'expected_version' then perform private.fail('VALIDATION_FAILED');end if;
   insert into core.crm_activities(id,org_id,center_id,lead_id,kind,due_at,outcome,note,completed_at) values(pid,org,center,l.id,r->>'kind',(r->>'due_at')::timestamptz,r->>'outcome',r->>'note',case when r->>'kind' in ('contact','outcome') then clock_timestamp() end);
  else
   select * into a from core.crm_activities where org_id=org and center_id=center and lead_id=l.id and id=(r->>'activity_id')::uuid for update;
   if not found then perform private.fail('NOT_FOUND');end if;
   if a.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
   pid:=a.id;update core.crm_activities set kind=r->>'kind',due_at=(r->>'due_at')::timestamptz,outcome=r->>'outcome',note=r->>'note',completed_at=case when r->>'kind' in ('contact','outcome') then clock_timestamp() end,version=version+1 where id=pid returning version into ver;
  end if;
  if r->>'kind' in ('contact','outcome') then update core.leads set last_meaningful_contact_at=clock_timestamp(),version=version+1 where id=l.id;end if;
  subject:='crm_activities';
 elsif op='lead_convert_v1' then
  select * into l from core.leads where org_id=org and center_id=center and id=(r->>'lead_id')::uuid for update;
  if l.state<>'open' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  target:=l.person_id;
  if not exists(select 1 from core.people where org_id=org and id=target and state='active') then perform private.fail('NOT_FOUND');end if;
  if not exists(select 1 from core.center_relationships where org_id=org and person_id=target and kind='student' and state='active') then
   limit_n:=private.plan_limit(org,'active_students');if limit_n is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
   if (select count(distinct person_id) from core.center_relationships where org_id=org and kind='student' and state='active')>=limit_n then perform private.fail('PLAN_LIMIT_REACHED');end if;
  end if;
  if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind='student' and state='active') then
   insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(private.new_id(ids,21),org,center,target,'student','active',clock_timestamp());
  end if;
  update core.center_relationships set state='inactive',ended_at=clock_timestamp(),version=version+1 where org_id=org and center_id=center and person_id=target and kind='candidate' and state='active';
  pid:=l.id;update core.leads set state='converted',version=version+1 where id=pid returning version into ver;
 elsif op='trial_offer_create_v1' then
  select * into l from core.leads where org_id=org and center_id=center and id=(r->>'lead_id')::uuid for update;
  if l.state<>'open' then perform private.fail('OFFER_UNAVAILABLE');end if;
  select * into cfg from private.p04_trial_configuration where org_id=org and center_id=center and product_version_id=(r->>'product_version_id')::uuid and enabled;
  if not found then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  select v.* into pv from core.product_versions v where v.org_id=org and v.center_id=center and v.id=cfg.product_version_id and v.effective_at<=clock_timestamp();
  if not found or not exists(select 1 from core.products where org_id=org and id=pv.product_id and state='active') then perform private.fail('OFFER_UNAVAILABLE');end if;
  perform private.p04_trial_limit(org,center,l.person_id);
  sid:=(r->>'session_id')::uuid;
  if sid is not null then perform private.p04_trial_session(org,center,l.person_id,pv.id,sid);end if;
  insert into core.trial_offers(id,org_id,center_id,lead_id,product_version_id,session_id,state,expires_at,terms_snapshot)
  values(pid,org,center,l.id,pv.id,sid,'active',least(clock_timestamp()+make_interval(mins=>cfg.offer_minutes),coalesce((select starts_at from core.sessions where org_id=org and id=sid),'infinity'::timestamptz)),jsonb_build_object('price_minor',pv.price_minor::text,'currency',pv.currency,'product_version_id',pv.id));
  subject:='trial_offers';
 elsif op='trial_registration_confirm_v1' then
  select * into o from core.trial_offers where org_id=org and center_id=center and id=(r->>'offer_id')::uuid for update;
  if o.state<>'active' or o.expires_at<=clock_timestamp() or o.session_id is null then perform private.fail('OFFER_UNAVAILABLE');end if;
  select * into l from core.leads where org_id=org and center_id=center and id=o.lead_id for update;
  if l.state<>'open' then perform private.fail('OFFER_UNAVAILABLE');end if;
  -- Exclude this promise from its live cap before replacing it with a use.
  update core.trial_offers set state='accepted' where id=o.id;
  perform private.p04_trial_limit(org,center,l.person_id);
  if not exists(select 1 from private.p04_trial_configuration where org_id=org and center_id=center and product_version_id=o.product_version_id and enabled) then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  perform private.p04_trial_session(org,center,l.person_id,o.product_version_id,o.session_id,o.id);
  select p.id into policy from private.policy_at(org,center,case when (select format from core.sessions where id=o.session_id)='private' then 'student_cancel_private' else 'student_cancel_group' end,clock_timestamp()) p;
  if policy is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,trial_offer_id,booking_obligation)
  values(private.new_id(ids,22),org,center,o.session_id,l.person_id,'flexible','active',policy,o.id,
  jsonb_build_object('captured_at',clock_timestamp(),'policies',private.lesson_policy_ids(org,center),'limits',private.lesson_limits(org,center,l.person_id,(select discipline_id from core.sessions where id=o.session_id)),'blocked_policy',(select p.value from private.policy_at(org,center,'participation_block_credit',clock_timestamp()) p),'debt_participation',coalesce((select (p.value->>'value')::bool from private.policy_at(org,center,'debt_participation',clock_timestamp()) p),false)));
  if (o.terms_snapshot->>'price_minor')::bigint>0 then
   -- Paid trials require an existing separately authorized purchase; CRM creates no sale/debt/cash.
   select s.id into target from core.sales s where s.org_id=org and s.person_id=l.person_id and s.product_version_id=o.product_version_id and s.state='active' and private.available_for(org,s.id,(select starts_at from core.sessions where id=o.session_id))>=1 order by s.valid_until nulls last,s.created_at,s.id limit 1;
   if target is null then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
   target:=private.reserve_right(org,l.person_id,target,o.session_id,null,null,private.new_id(ids,22),operation,ids,30);
   if not exists(select 1 from core.sales where org_id=org and id=target and product_version_id=o.product_version_id) then perform private.fail('ENTITLEMENT_UNAVAILABLE');end if;
   update core.reservations set source_sale_id=target where id=private.new_id(ids,22);
  end if;
  perform private.p01_request_documents(org,private.new_id(ids,22));
  insert into core.trial_usages(id,org_id,person_id,offer_id,session_id) values(private.new_id(ids,23),org,l.person_id,o.id,o.session_id);
  pid:=o.id;update core.trial_offers set version=version+1 where id=pid returning version into ver;subject:='trial_offers';
 elsif op='publication_set_v1' then
  select * into pub from core.publications where org_id=org and center_id=center and ((r->>'session_id' is not null and session_id=(r->>'session_id')::uuid) or (r->>'event_id' is not null and event_id=(r->>'event_id')::uuid)) for update;
  if pub.id is null and r ? 'expected_version' then perform private.fail('VALIDATION_FAILED');end if;
  if pub.id is not null and pub.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  terms:=coalesce(r->'public_details',pub.public_details);
  if (r->>'published')::bool and terms is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
  if r->>'session_id' is not null and not exists(select 1 from core.sessions where org_id=org and id=(r->>'session_id')::uuid and state='planned') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if r->>'event_id' is not null and not exists(select 1 from core.events where org_id=org and id=(r->>'event_id')::uuid and state='published') then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if pub.id is null then insert into core.publications(id,org_id,center_id,slug,session_id,event_id,published,public_details) values(pid,org,center,org::text,(r->>'session_id')::uuid,(r->>'event_id')::uuid,(r->>'published')::bool,terms);
  else pid:=pub.id;update core.publications set published=(r->>'published')::bool,public_details=terms,version=version+1 where id=pid returning version into ver;end if;
  subject:='publications';
 elsif op='public_application_review_v1' then
  select * into app from core.public_applications where org_id=org and center_id=center and id=(r->>'application_id')::uuid for update;
  if app.state<>'pending' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if r->>'action'='close' then
   if r->>'person_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
   update core.public_applications set state='closed',version=version+1 where id=app.id returning version into ver;
  else
   if r->>'action'='match_existing' then
    target:=(r->>'person_id')::uuid;
    if target is null or not exists(select 1 from core.people where org_id=org and id=target and state='active') or not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and state='active') then perform private.fail('NOT_FOUND');end if;
   else
    if r->>'person_id' is not null then perform private.fail('VALIDATION_FAILED');end if;
    -- Do not silently create a second identity for a known contact, nor update old contact data.
    if exists(select 1 from core.person_contacts where org_id=org and lower(btrim(value))=lower(btrim(app.target_contact))) then perform private.fail('ACCOUNT_LINK_CONFLICT');end if;
    target:=private.new_id(ids,24);insert into core.people(id,org_id,display_name,state) values(target,org,app.target_contact,'active');
    insert into core.person_contacts(id,org_id,person_id,kind,value) values(private.new_id(ids,25),org,target,'email',app.target_contact);
   end if;
   if not exists(select 1 from core.center_relationships where org_id=org and center_id=center and person_id=target and kind in ('candidate','student') and state='active') then
    insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values(private.new_id(ids,26),org,center,target,'candidate','active',clock_timestamp());
   end if;
   if not exists(select 1 from core.leads where org_id=org and center_id=center and person_id=target and state='open') then
    insert into core.leads(id,org_id,center_id,person_id,source,interest,state) values(private.new_id(ids,27),org,center,target,'public_application',app.publication_id::text,'open');
   end if;
   update core.public_applications set person_id=target,state='reviewed',version=version+1 where id=app.id returning version into ver;
  end if;
  pid:=app.id;subject:='public_applications';
 else perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('primary_id',pid,'version',ver,'subject',subject);
end$$;

create table private.p04_public_security(
 singleton boolean primary key default true check(singleton),ip_max integer not null check(ip_max>0),target_org_max integer not null check(target_org_max>0)
);
insert into private.p04_public_security values(true,5,3);
alter table private.p04_public_security enable row level security;
revoke all on private.p04_public_security from public,anon,authenticated;
grant select,update on private.p04_public_security to service_role;

create table private.p04_public_requests(
 key_hash text primary key,payload_hash text not null,publication_id uuid not null references core.publications(id),created_at timestamptz not null default clock_timestamp()
);
alter table private.p04_public_requests enable row level security;
revoke all on private.p04_public_requests from public,anon,authenticated;
grant select,insert on private.p04_public_requests to service_role;
-- Public execution is a separate service-only transport, never a forged human.
create function private.p04_public(op text,r jsonb,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare trace uuid:=private.new_id(ids,1);pub core.publications;org uuid;items jsonb;token text;lim int:=coalesce((r#>>'{page,limit}')::int,50);
 cur jsonb;scope text;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();ip_hash text:=aux->>'ip_hash';v_target_hash text;
 bucket timestamptz;ip_count bigint;target_count bigint;v_key_hash text;v_payload_hash text;old_hash text;contact text:=lower(btrim(r->>'contact'));existing uuid;phase text:=aux->>'phase';
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 if op='public_calendar_get_v1' then
  if lim<1 or lim>200 or coalesce(r#>>'{page,sort}','starts_at_asc')<>'starts_at_asc' or (r#>>'{interval,starts_at}')::timestamptz>=(r#>>'{interval,ends_at}')::timestamptz then perform private.fail('VALIDATION_FAILED');end if;
  scope:=md5((r-'request_id'-'page')::text);
  if r#>>'{page,cursor}' is not null then
   begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
    if cur->>'scope' is distinct from scope or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
    last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
    if not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
   exception when others then perform private.fail('VALIDATION_FAILED');end;
  end if;
  select coalesce(jsonb_agg(q.data order by q.at,q.id),'[]'::jsonb) into items from (
   select p.id,coalesce(s.starts_at,e.starts_at) at,p.public_details||jsonb_build_object('publication_id',p.id,'interval',jsonb_build_object('starts_at',coalesce(s.starts_at,e.starts_at),'ends_at',coalesce(s.ends_at,e.ends_at)),
   'discipline_ids',case when s.id is not null then to_jsonb(array[s.discipline_id]) else coalesce((select jsonb_agg(d.discipline_id order by d.discipline_id) from core.event_disciplines d where d.org_id=p.org_id and d.event_id=e.id),'[]'::jsonb) end,'_at',coalesce(s.starts_at,e.starts_at)) data
   from core.publications p left join core.sessions s on s.org_id=p.org_id and s.id=p.session_id left join core.events e on e.org_id=p.org_id and e.id=p.event_id
   where p.slug=r->>'slug' and p.published and p.public_details is not null and p.created_at<=asof and (r->>'center_id' is null or p.center_id=(r->>'center_id')::uuid)
   and private.access_mode(p.org_id) in ('normal','grace') and private.center_accessible(p.org_id,p.center_id)
   and exists(select 1 from core.saas_subscriptions z join core.saas_plan_versions v on v.id=z.plan_version_id where z.org_id=p.org_id and 'F25'=any(v.features))
   and ((s.id is not null and s.state='planned') or (e.id is not null and e.state='published'))
   and coalesce(s.starts_at,e.starts_at)>=(r#>>'{interval,starts_at}')::timestamptz and coalesce(s.starts_at,e.starts_at)<(r#>>'{interval,ends_at}')::timestamptz
   and (cur is null or (coalesce(s.starts_at,e.starts_at),p.id)>(last_at,last_id))
   order by coalesce(s.starts_at,e.starts_at),p.id limit lim+1) q;
  if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',scope,'at',items->-1->'_at','id',items->-1->'publication_id','as_of',asof)::text,'utf8'),'hex');end if;
  select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality z(x,n);
  return jsonb_build_object('ok',true,'data',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof),'trace_id',trace);
 end if;
 if op<>'public_application_submit_v1' then perform private.fail('NOT_FOUND');end if;
 select org_id into org from core.publications where id=(r->>'publication_id')::uuid;
 if org is null then perform private.fail('SERVICE_UNAVAILABLE');end if;
 v_target_hash:=encode(extensions.digest(org::text||':'||(aux->>'target_hash'),'sha256'),'hex');
 -- Same organization lock as human commands: shutdown/plan/review races serialize.
 perform 1 from core.organizations where id=org for update;
 select * into pub from core.publications where id=(r->>'publication_id')::uuid and published;
 if not found or private.access_mode(org) not in ('normal','grace') or not private.center_accessible(org,pub.center_id)
 or (r->>'center_id' is not null and (r->>'center_id')::uuid<>pub.center_id)
 or not exists(select 1 from core.saas_subscriptions z join core.saas_plan_versions v on v.id=z.plan_version_id where z.org_id=org and 'F25'=any(v.features))
 or (pub.session_id is not null and not exists(select 1 from core.sessions where org_id=org and id=pub.session_id and state='planned' and starts_at>clock_timestamp()))
 or (pub.event_id is not null and not exists(select 1 from core.events where org_id=org and id=pub.event_id and state='published' and starts_at>clock_timestamp())) then perform private.fail('SERVICE_UNAVAILABLE');end if;
 if contact is null or length(contact)>320 or contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then perform private.fail('VALIDATION_FAILED');end if;
 if ip_hash !~ '^[a-f0-9]{64}$' or v_target_hash !~ '^[a-f0-9]{64}$' or ip_hash is null or v_target_hash is null then perform private.fail('SERVICE_UNAVAILABLE');end if;
 v_key_hash:=encode(extensions.digest(r->>'client_request_key','sha256'),'hex');v_payload_hash:=encode(extensions.digest(jsonb_build_object('publication',pub.id,'contact',contact)::text,'sha256'),'hex');
 select x.payload_hash into old_hash from private.p04_public_requests x where x.key_hash=v_key_hash;
 if old_hash is not null then
  if old_hash<>v_payload_hash then perform private.fail('VALIDATION_FAILED');end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('accepted',true),'trace_id',trace);
 end if;
 if phase='preflight' then
  -- Short-lived keyed windows never become a permanent IP/contact log.
  delete from core.rate_limit_windows where ends_at<clock_timestamp()-interval '1 hour';
  -- Count provider failures too. Returning a business rejection preserves this window.
  perform pg_advisory_xact_lock(hashtextextended(ip_hash,104));
  bucket:=date_bin(interval '15 minutes',clock_timestamp(),'2000-01-01'::timestamptz);
  insert into core.rate_limit_windows(id,key_hash,dimension,starts_at,ends_at,attempt_count,accepted_count) values(private.new_id(ids,40),ip_hash,'ip',bucket,bucket+interval '15 minutes',1,0)
  on conflict(dimension,key_hash,starts_at) do update set attempt_count=core.rate_limit_windows.attempt_count+1 returning attempt_count into ip_count;
  -- Sliding window, so a boundary cannot admit two bursts.
  select sum(attempt_count) into ip_count from core.rate_limit_windows where dimension='ip' and key_hash=ip_hash and ends_at>clock_timestamp()-interval '15 minutes';
  if ip_count>(select ip_max from private.p04_public_security where singleton) then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','RATE_LIMITED','retryable',false,'trace_id',trace));end if;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('bot_required',true),'trace_id',trace);
 end if;
 if aux->>'bot_verified'<>'true' or aux->>'bot_verified' is null then perform private.fail('BOT_VERIFICATION_FAILED');end if;
 -- Trusted Edge has made the counted preflight. No client can call this RPC.
 bucket:=date_bin(interval '1 hour',clock_timestamp(),'2000-01-01'::timestamptz);
 select coalesce(sum(accepted_count),0) into target_count from core.rate_limit_windows where dimension='target_org' and key_hash=v_target_hash and ends_at>clock_timestamp()-interval '1 hour';
 if target_count>=(select target_org_max from private.p04_public_security where singleton) then perform private.fail('RATE_LIMITED');end if;
 select id into existing from core.public_applications where org_id=org and publication_id=pub.id and target_hash=v_target_hash and state='pending';
 if existing is null then
  insert into core.public_applications(id,org_id,center_id,publication_id,target_contact,target_hash,state,bot_verified_at,request_reference)
  values(private.new_id(ids,2),org,pub.center_id,pub.id,contact,v_target_hash,'pending',clock_timestamp(),(r->>'client_request_key')::uuid);
  insert into core.rate_limit_windows(id,key_hash,dimension,starts_at,ends_at,attempt_count,accepted_count) values(private.new_id(ids,41),v_target_hash,'target_org',bucket,bucket+interval '1 hour',1,1)
  on conflict(dimension,key_hash,starts_at) do update set attempt_count=core.rate_limit_windows.attempt_count+1,accepted_count=core.rate_limit_windows.accepted_count+1;
 end if;
 insert into private.p04_public_requests(key_hash,payload_hash,publication_id) values(v_key_hash,v_payload_hash,pub.id);
 return jsonb_build_object('ok',true,'data',jsonb_build_object('accepted',true),'trace_id',trace);
exception when others then
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end,'retryable',false,'trace_id',trace));
end$$;

create function private.p04_management(r jsonb,org uuid,center uuid,actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare op text:=r->>'operation';k jsonb:=r#>'{selector,key}';lim int:=coalesce((r#>>'{page,limit}')::int,50);cur jsonb;last_at timestamptz;last_id uuid;asof timestamptz:=clock_timestamp();items jsonb;token text;feature text;
 h text:=md5(jsonb_build_object('actor',actor,'request',r-'request_id'-'page')::text);
begin
 if r#>>'{selector,operation}' is distinct from op or lim<1 or lim>200 or coalesce(r#>>'{page,sort}','created_at_asc')<>'created_at_asc' then perform private.fail('VALIDATION_FAILED');end if;
 perform private.p04_access(op,r||k,org,center,actor);
 for feature in select unnest(features) from private.runtime_operations where name=op loop perform private.require_feature(org,feature);end loop;
 if r#>>'{page,cursor}' is not null then
  begin cur:=convert_from(decode(r#>>'{page,cursor}','hex'),'utf8')::jsonb;
   if cur->>'scope' is distinct from h or cur->>'at' is null or cur->>'id' is null or cur->>'as_of' is null then perform private.fail('VALIDATION_FAILED');end if;
   last_at:=(cur->>'at')::timestamptz;last_id:=(cur->>'id')::uuid;asof:=(cur->>'as_of')::timestamptz;
   if not isfinite(last_at) or not isfinite(asof) or asof>clock_timestamp() then perform private.fail('VALIDATION_FAILED');end if;
  exception when others then perform private.fail('VALIDATION_FAILED');end;
 end if;
 with rows as(
  select l.id,l.created_at,l.version,l.state,'leads'::text subject,jsonb_build_object('lead_id',l.id,'person_id',l.person_id,'source',l.source,'interest',l.interest,'assigned_to',l.assigned_person_id) vals
  from core.leads l where op='lead_save_v1' and l.org_id=org and l.center_id=center and l.person_id=(k->>'person_id')::uuid and (k->>'lead_id' is null or l.id=(k->>'lead_id')::uuid) and coalesce(private.p04_can_lead(org,center,actor,l.assigned_person_id),false)
  union all select l.id,l.created_at,l.version,l.state,'leads',jsonb_build_object('lead_id',l.id) from core.leads l where op='lead_convert_v1' and l.org_id=org and l.center_id=center and l.id=(k->>'lead_id')::uuid
  union all select a.id,a.created_at,a.version,case when a.completed_at is null then 'open' else 'completed' end,'crm_activities',jsonb_build_object('activity_id',a.id,'lead_id',a.lead_id,'kind',a.kind,'due_at',a.due_at,'outcome',a.outcome,'note',a.note)
  from core.crm_activities a where op='crm_activity_save_v1' and a.org_id=org and a.center_id=center and a.lead_id=(k->>'lead_id')::uuid and (k->>'activity_id' is null or a.id=(k->>'activity_id')::uuid)
  union all select p.id,p.created_at,p.version,case when p.published then 'published' else 'draft' end,'publications',jsonb_build_object('session_id',p.session_id,'event_id',p.event_id,'published',p.published,'public_details',p.public_details)
  from core.publications p where op='publication_set_v1' and p.org_id=org and p.center_id=center and ((k->>'session_id' is not null and p.session_id=(k->>'session_id')::uuid) or (k->>'event_id' is not null and p.event_id=(k->>'event_id')::uuid))
  union all select a.id,a.created_at,a.version,a.state,'public_applications',jsonb_build_object('application_id',a.id,'person_id',a.person_id,'contact',a.target_contact,'publication_id',a.publication_id)
  from core.public_applications a where op='public_application_review_v1' and a.org_id=org and a.center_id=center and (k->>'application_id' is null or a.id=(k->>'application_id')::uuid)
  union all select o.id,o.created_at,o.version,case when o.state='active' and o.expires_at<=clock_timestamp() then 'expired' else o.state end,'trial_offers',
  case when op='trial_registration_confirm_v1' then jsonb_build_object('offer_id',o.id) else jsonb_build_object('lead_id',o.lead_id,'product_version_id',o.product_version_id,'session_id',o.session_id,'offer_id',o.id,'expires_at',o.expires_at) end
  from core.trial_offers o where op in ('trial_offer_create_v1','trial_registration_confirm_v1') and o.org_id=org and o.center_id=center
  and ((op='trial_registration_confirm_v1' and o.id=(k->>'offer_id')::uuid) or (op='trial_offer_create_v1' and o.lead_id=(k->>'lead_id')::uuid and o.product_version_id=(k->>'product_version_id')::uuid and (k->>'session_id' is null or o.session_id=(k->>'session_id')::uuid)))
 ),page as(select * from rows where created_at<=asof and (cur is null or (created_at,id)>(last_at,last_id)) order by created_at,id limit lim+1)
 select coalesce(jsonb_agg(jsonb_build_object('operation',op,'entity',jsonb_build_object('type',subject,'id',id),'exists',true,'state',state,
 'versions',jsonb_build_array(jsonb_build_object('entity',jsonb_build_object('type',subject,'id',id),'version',version)),
 'as_of',asof,'current',jsonb_build_object('operation',op,'values',vals),'_at',created_at) order by created_at,id),'[]'::jsonb) into items from page;
 if jsonb_array_length(items)>lim then items:=items-lim;token:=encode(convert_to(jsonb_build_object('scope',h,'at',items->-1->'_at','id',(items->-1)#>'{entity,id}','as_of',asof)::text,'utf8'),'hex');end if;
 select coalesce(jsonb_agg(x-'_at' order by n),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality z(x,n);
 return jsonb_build_object('data',jsonb_build_object('items',items,'next_cursor',token,'as_of',asof),'primary_id',center,'subject','centers');
end$$;

-- Bind the new module without rewriting any frozen migration or unrelated case.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:='  cm:=center is not null and private.is_manager(org,person,center);org_reader:=private.is_org_reader(org,person);';
 if strpos(b,old)=0 then raise exception 'P04 scope anchor missing';end if;
 b:=replace(b,old,$p$
  if p_operation='management_state_get_v1' and r->>'operation' in ('lead_save_v1','crm_activity_save_v1','trial_offer_create_v1','trial_registration_confirm_v1','lead_convert_v1','publication_set_v1','public_application_review_v1') then center:=private.p04_center(r->>'operation',r||(r#>'{selector,key}'),org);end if;
  if p_operation in ('leads_list_v1','lead_save_v1','crm_activity_save_v1','trial_offer_create_v1','trial_registration_confirm_v1','lead_convert_v1','crm_followup_list_v1','publication_set_v1','public_application_review_v1') then center:=private.p04_center(p_operation,r,org);end if;
$p$||old);
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if strpos(b,old)=0 then raise exception 'P04 live access anchor missing';end if;
 b:=replace(b,old,old||$p$
 if p_operation in ('leads_list_v1','lead_save_v1','crm_activity_save_v1','trial_offer_create_v1','trial_registration_confirm_v1','lead_convert_v1','crm_followup_list_v1','public_application_review_v1') then perform private.p04_access(p_operation,r,org,center,person);end if;
$p$);
 old:=$p$ elsif perm_code='invite.student' then$p$;
 if strpos(b,old)=0 then raise exception 'P04 permission anchor missing';end if;
 b:=replace(b,old,$p$ elsif perm_code='crm.daily' then null;
$p$||old);
 old:=$p$elsif perm_code='management.inspect' then$p$;
 if strpos(b,old)=0 then raise exception 'P04 management permission anchor missing';end if;
 b:=replace(b,old,$p$elsif perm_code='management.inspect' and r->>'operation' in ('lead_save_v1','crm_activity_save_v1','trial_offer_create_v1','trial_registration_confirm_v1','lead_convert_v1','publication_set_v1','public_application_review_v1') then
  if r#>>'{selector,operation}' is distinct from r->>'operation' then perform private.fail('VALIDATION_FAILED');end if;
  perform private.p04_access(r->>'operation',r||(r#>'{selector,key}'),org,center,person);
 $p$||old);
 old:='terms:=private.earnings_management(p_operation,r,org,center,actor.id,person,operation_id,p_ids);';
 if strpos(b,old)=0 then raise exception 'P04 management domain anchor missing';end if;
 b:=replace(b,old,$p$if p_operation='management_state_get_v1' and r->>'operation' in ('lead_save_v1','crm_activity_save_v1','trial_offer_create_v1','trial_registration_confirm_v1','lead_convert_v1','publication_set_v1','public_application_review_v1') then
  terms:=private.p04_management(r,org,center,person);
 else $p$||old||'end if;');
 old:=$p$'sale.write','finance.collect','request.write','request.resolve'$p$;
 if strpos(b,old)=0 then raise exception 'P04 staff grant anchor missing';end if;
 b:=replace(b,old,old||$p$,'crm.daily'$p$);
 old:=' -- DOMAIN_CASES';
 if strpos(b,old)=0 then raise exception 'P04 domain anchor missing';end if;
 b:=replace(b,old,$p$
 when 'leads_list_v1','lead_save_v1','crm_activity_save_v1','trial_offer_create_v1','trial_registration_confirm_v1','lead_convert_v1','crm_followup_list_v1','publication_set_v1','public_application_review_v1' then
  terms:=private.p04_command(p_operation,r,org,center,person,actor.id,operation_id,p_ids);
  out:=terms->'data';record_id:=(terms->>'primary_id')::uuid;subject:=terms->>'subject';version_n:=coalesce((terms->>'version')::bigint,1);
 -- DOMAIN_CASES$p$);
 old:=$p$(select count(*) from core.seat_offers where org_id=org and session_id=ses.id and state='active' and expires_at>now())$p$;
 if strpos(b,old)=0 then raise exception 'P04 capacity anchor missing';end if;
 b:=replace(b,old,old||$p$+(select count(*) from core.trial_offers where org_id=org and session_id=ses.id and state='active' and expires_at>clock_timestamp())$p$);
 execute b;
end$patch$;
-- Every seat allocator sees an active trial promise; same session/org locks apply.
create index p04_active_trial_session on core.trial_offers(org_id,session_id,expires_at) where state='active';
create function private.p04_trial_places(org uuid,sid uuid) returns bigint language sql stable security invoker set search_path='' as $$
 select count(*) from core.trial_offers where org_id=org and session_id=sid and state='active' and expires_at>clock_timestamp()
$$;
do $patch$
declare b text;old text;
begin
 b:=pg_get_functiondef('private.p01_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 old:=$p$(select count(*) from core.seat_offers oo where oo.org_id=p_org and oo.session_id=s.id and oo.state='active' and oo.expires_at>clock_timestamp())$p$;
 if strpos(b,old)=0 then raise exception 'P04 discovery capacity anchor missing';end if;
 b:=replace(b,old,old||'+private.p04_trial_places(p_org,s.id)');
 old:=$p$(select count(*)::text from core.seat_offers oo where oo.org_id=p_org and oo.session_id=s.id and oo.state='active' and oo.expires_at>clock_timestamp())$p$;
 if strpos(b,old)=0 then raise exception 'P04 discovery fingerprint anchor missing';end if;
 b:=replace(b,old,old||$p$||':'||private.p04_trial_places(p_org,s.id)::text$p$);execute b;
 b:=pg_get_functiondef('private.p01_worker_execute(text,jsonb,uuid[])'::regprocedure);
 old:=$p$(select count(*) from core.seat_offers where org_id=org and session_id=s.id and state='active' and expires_at>clock_timestamp())$p$;
 if strpos(b,old)=0 then raise exception 'P04 worker capacity anchor missing';end if;
 execute replace(b,old,old||'+private.p04_trial_places(org,s.id)');
 b:=pg_get_functiondef('private.lesson_finance_snapshot(uuid,uuid,jsonb)'::regprocedure);
 old:=$p$'trial',v.trial_offer_id is not null$p$;
 if strpos(b,old)=0 then raise exception 'P04 free trial snapshot anchor missing';end if;
 execute replace(b,old,$p$'trial',v.trial_offer_id is not null and coalesce((select (o.terms_snapshot->>'price_minor')::bigint=0 from core.trial_offers o where o.org_id=v.org_id and o.id=v.trial_offer_id),true)$p$);
end$patch$;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
