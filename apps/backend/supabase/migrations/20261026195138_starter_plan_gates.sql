-- Starter policy revision 20261026. Historical plan, sale and session records stay immutable.
begin;
alter table private.p07_subscription_scope add column starter_scope jsonb;
create table private.starter_change_scopes(change_id uuid primary key references core.saas_change_requests(id),scope jsonb not null,subscription_version bigint not null);
alter table private.starter_change_scopes enable row level security;
revoke all on private.starter_change_scopes from public,anon,authenticated;
grant select,insert,update,delete on private.starter_change_scopes to service_role;
create function private.current_plan_name(org uuid) returns text language sql stable set search_path='' as $$
 select p.name from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org order by s.created_at desc,s.id desc limit 1
$$;
create function private.starter_limits() returns jsonb language sql immutable set search_path='' as $$
 select '{"entries":[{"key":"centers","value":1},{"key":"rooms","value":1},{"key":"disciplines","value":1},{"key":"instructors","value":1},{"key":"active_students","value":100}]}'::jsonb
$$;
create function private.starter_scope(org uuid) returns jsonb language sql stable set search_path='' as $$
 select x.starter_scope from core.saas_subscriptions s left join private.p07_subscription_scope x on x.subscription_id=s.id where s.org_id=org order by s.created_at desc,s.id desc limit 1
$$;
create or replace function private.lesson_plan(org uuid) returns jsonb language sql stable set search_path='' as $$
 select case when p.name='starter' then to_jsonb(p)||jsonb_build_object('limits',private.starter_limits(),'features',(select coalesce(jsonb_agg(f),'[]'::jsonb) from (select distinct f from unnest(p.features||array['F11','F13','F16','F25']) f where f not in ('F05','F12','F17','F18','F20','F21','F22','F23','F24','F27','F29')) q)) else to_jsonb(p) end
 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org order by s.created_at desc,s.id desc limit 1
$$;
-- Closed-scope downgrade: old resources remain active in history but cannot be operated.
create function private.starter_selected(org uuid,kind text,target uuid) returns boolean language sql stable set search_path='' as $$
 select private.current_plan_name(org) is distinct from 'starter' or private.starter_scope(org) is null or
 case when kind='student' then coalesce(private.starter_scope(org)->'student_person_ids','[]'::jsonb) ? target::text
 else private.starter_scope(org)->>(kind||'_id')=target::text end
$$;
create or replace function private.plan_limit(org uuid,key_name text) returns bigint language sql stable set search_path='' as $$
 select case when private.current_plan_name(org)='starter' and key_name in ('centers','rooms','disciplines','instructors','active_students') then case when key_name='active_students' then 100 else 1 end
 else (select case when e->>'unlimited'='true' then 9223372036854775807::bigint else (e->>'value')::bigint end from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id cross join lateral jsonb_array_elements(p.limits->'entries') e where s.org_id=org and e->>'key'=key_name order by s.created_at desc,s.id desc limit 1) end
$$;
create or replace function private.require_feature(org uuid,feature text) returns void language plpgsql stable set search_path='' as $$
begin
 if private.current_plan_name(org)='starter' then
  if feature in ('F05','F12','F17','F18','F20','F21','F22','F23','F24','F27','F29') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  if feature in ('F11','F13','F16','F25') then return;end if;
 end if;
 if not exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and feature=any(p.features) and s.id=(select id from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
end$$;
-- Existing staff grants are not a Starter licence; student/instructor authority remains independent.
create or replace function private.staff_grant(org uuid,person uuid,center uuid,perm text) returns boolean language sql stable set search_path='' as $$
 select private.current_plan_name(org)<>'starter' and private.has_role(org,person,'staff',center) and exists(select 1 from core.permission_overrides where org_id=org and center_id=center and person_id=person and permission=perm and enabled)
$$;
do $patch$
declare b text:=pg_get_functiondef('private.can_invite(uuid,uuid,uuid,uuid)'::regprocedure);anchor text:=$a$private.has_role(org,person,'staff',center)$a$;
begin
 if strpos(b,anchor)=0 then raise exception 'Starter invite staff authority anchor drift';end if;
 execute replace(b,anchor,$a$(private.current_plan_name(org)<>'starter' and private.has_role(org,person,'staff',center))$a$);
end$patch$;
create or replace function private.p06_granted(org uuid,actor uuid,center uuid,perm text) returns boolean language sql stable security invoker set search_path='' as $$
 select private.staff_grant(org,actor,center,perm)
$$;
create function private.starter_assert_selected(org uuid,kind text,target uuid) returns void language plpgsql stable set search_path='' as $$
begin
 if target is null then return;end if;
 if (kind='room' and not exists(select 1 from core.rooms where org_id=org and id=target)) or (kind='discipline' and not exists(select 1 from core.disciplines where org_id=org and id=target)) or (kind in ('student','instructor') and not exists(select 1 from core.people where org_id=org and id=target)) then perform private.fail('NOT_FOUND');end if;
 if not coalesce(private.starter_selected(org,kind,target),false) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
end$$;
create or replace function private.center_accessible(org uuid,center uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.centers c cross join lateral (select s.* from core.saas_subscriptions s where s.org_id=org order by s.created_at desc,s.id desc limit 1) s join core.saas_plan_versions p on p.id=s.plan_version_id left join private.p07_subscription_scope x on x.subscription_id=s.id
 where c.org_id=org and c.id=center and c.state='active' and (p.name='business' or c.id=coalesce(x.kept_center_id,(select id from core.centers where org_id=org and state='active' order by created_at,id limit 1))))
$$;
create function private.starter_session_allowed(org uuid,target uuid,operational boolean default true) returns boolean language sql stable set search_path='' as $$
 select private.current_plan_name(org) is distinct from 'starter' or exists(select 1 from core.sessions s where s.org_id=org and s.id=target
 and private.center_accessible(org,s.center_id) and private.starter_selected(org,'discipline',s.discipline_id)
 and (not operational or ((select count(distinct b.resource_id) from core.resource_bookings b where b.org_id=org and b.session_id=s.id and (b.state='active' or s.attendance_state='closed') and b.resource_kind='room')=1 and jsonb_array_length(private.schedule_snapshot(org,s.id)->'assignments')=1))
 and not exists(select 1 from core.resource_bookings b where b.org_id=org and b.session_id=s.id and (b.state='active' or s.attendance_state='closed' or not operational) and b.resource_kind='room' and not private.starter_selected(org,'room',b.resource_id))
 and not exists(select 1 from jsonb_array_elements(private.schedule_snapshot(org,s.id)->'assignments') a where a->>'duty'<>'instructor' or not private.starter_selected(org,'instructor',(a->>'person_id')::uuid)))
$$;
create function private.starter_instructor_active(org uuid,center uuid,target uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.center_relationships r where r.org_id=org and r.center_id=center and r.person_id=target and r.kind='instructor' and r.state='active') or private.has_role(org,target,'instructor',center)
$$;
-- A normal verified instructor role is sufficient for its resource availability.
do $patch$
declare b text:=pg_get_functiondef('private.assert_resource(uuid,uuid,text,uuid)'::regprocedure);anchor text:=$a$not exists(select 1 from core.center_relationships x where x.org_id=org and x.center_id=center and x.person_id=resource and x.state='active')$a$;
begin
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter instructor resource anchor drift';end if;
 execute replace(b,anchor,'('||anchor||' and not (private.current_plan_name(org)=''starter'' and private.starter_instructor_active(org,center,resource)))');
end$patch$;
create function private.starter_scope_required(org uuid) returns boolean language sql stable set search_path='' as $$
 select private.current_plan_name(org)='starter' and private.starter_scope(org) is null and (
 (select count(*) from core.centers where org_id=org and state='active')>1 or
 (select count(*) from core.rooms where org_id=org and state='active')>1 or
 (select count(*) from core.disciplines where org_id=org and state='active')>1 or
 (select count(distinct person_id) from (select person_id from core.center_relationships where org_id=org and kind='instructor' and state='active' union select person_id from core.role_assignments where org_id=org and role='instructor' and state='active') x)>1 or
 (select count(distinct person_id) from core.center_relationships where org_id=org and kind='student' and state='active')>100)
$$;
create function private.starter_validate_scope(org uuid,center uuid,scope jsonb) returns void language plpgsql stable set search_path='' as $$
#variable_conflict use_variable
declare target uuid;kind text;
begin
 if scope is null or jsonb_typeof(scope)<>'object' or jsonb_typeof(scope->'student_person_ids') is distinct from 'array' then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from core.centers c where c.org_id=org and c.id=center and c.state='active') then perform private.fail('VALIDATION_FAILED');end if;
 if jsonb_array_length(scope->'student_person_ids')>100 or jsonb_array_length(scope->'student_person_ids')<>(select count(distinct value) from jsonb_array_elements_text(scope->'student_person_ids')) then perform private.fail('VALIDATION_FAILED');end if;
 if exists(select 1 from jsonb_array_elements_text(scope->'student_person_ids') x where not exists(select 1 from core.center_relationships r where r.org_id=org and r.center_id=center and r.person_id=x.value::uuid and r.kind='student' and r.state='active')) then perform private.fail('VALIDATION_FAILED');end if;
 if scope->>'room_id' is not null and not exists(select 1 from core.rooms r where r.org_id=org and r.center_id=center and r.id=(scope->>'room_id')::uuid and r.state='active') then perform private.fail('VALIDATION_FAILED');end if;
 if scope->>'discipline_id' is not null and not exists(select 1 from core.center_disciplines d join core.disciplines r on r.org_id=d.org_id and r.id=d.discipline_id where d.org_id=org and d.center_id=center and d.discipline_id=(scope->>'discipline_id')::uuid and d.state='active' and r.state='active') then perform private.fail('VALIDATION_FAILED');end if;
 if scope->>'instructor_id' is not null and not private.starter_instructor_active(org,center,(scope->>'instructor_id')::uuid) then perform private.fail('VALIDATION_FAILED');end if;
 -- A nonempty resource family requires an explicit retained resource; no hidden first-row selection.
 if (scope->>'room_id' is null and exists(select 1 from core.rooms where org_id=org and center_id=center and state='active')) or
 (scope->>'discipline_id' is null and exists(select 1 from core.center_disciplines where org_id=org and center_id=center and state='active')) or
 (scope->>'instructor_id' is null and (exists(select 1 from core.center_relationships where org_id=org and center_id=center and kind='instructor' and state='active') or exists(select 1 from core.role_assignments where org_id=org and scope_center_id=center and role='instructor' and state='active'))) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
-- Boundary uses the already validated immutable selection; later revocation leaves an empty slot.
create function private.starter_boundary_scope(org uuid,center uuid,scope jsonb) returns void language plpgsql stable set search_path='' as $$
begin
 if scope is null or jsonb_typeof(scope->'student_person_ids') is distinct from 'array' or jsonb_array_length(scope->'student_person_ids')>100 then perform private.fail('VALIDATION_FAILED');end if;
 if not exists(select 1 from core.centers c where c.org_id=org and c.id=center) then perform private.fail('VALIDATION_FAILED');end if;
end$$;
create function private.starter_claim_instructor(org uuid,center uuid,target uuid) returns void language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare sc jsonb;sub uuid;
begin
 perform 1 from core.organizations where id=org for update;
 perform private.assert_center(org,center);
 if not exists(select 1 from core.people where org_id=org and id=target and state='active') then perform private.fail('NOT_FOUND');end if;
 if exists(select 1 from core.role_assignments a where a.org_id=org and a.role='instructor' and a.state='active' and a.person_id<>target and private.starter_selected(org,'instructor',a.person_id)) or exists(select 1 from core.center_relationships a where a.org_id=org and a.kind='instructor' and a.state='active' and a.person_id<>target and private.starter_selected(org,'instructor',a.person_id)) then perform private.fail('PLAN_LIMIT_REACHED');end if;
 sc:=private.starter_scope(org);
 if sc is not null and not coalesce(private.starter_selected(org,'instructor',target),false) then
  select id into sub from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
  update private.p07_subscription_scope set starter_scope=jsonb_set(sc,'{instructor_id}',to_jsonb(target::text)) where subscription_id=sub;
 end if;
end$$;
-- Database invariant: organization lock serializes human, import, worker and direct service writes.
create function private.starter_resource_guard() returns trigger language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=new.org_id;kind text;target uuid;limit_n int;n bigint;sc jsonb;sub uuid;col text;family text;
begin
 perform 1 from core.organizations where id=org for update;
 if private.current_plan_name(org) is distinct from 'starter' then return new;end if;
 if new.state<>'active' then return new;end if;
 if tg_op='UPDATE' and to_jsonb(new)-'version'-'name'-'capacity'=to_jsonb(old)-'version'-'name'-'capacity' then return new;end if;
 if tg_table_name='centers' then kind:='center';target:=new.id;limit_n:=1;
 elsif tg_table_name='rooms' then kind:='room';target:=new.id;limit_n:=1;
 elsif tg_table_name='disciplines' then kind:='discipline';target:=new.id;limit_n:=1;
 elsif tg_table_name='center_relationships' then
  if new.kind not in ('student','instructor') then return new;end if;
  kind:=new.kind;target:=new.person_id;limit_n:=case kind when 'student' then 100 else 1 end;
 else return new;end if;
 sc:=private.starter_scope(org);
 if kind='center' then select count(*) into n from core.centers r where r.org_id=org and r.state='active' and r.id<>new.id and private.center_accessible(org,r.id);
 elsif kind='room' then select count(*) into n from core.rooms r where r.org_id=org and r.state='active' and r.id<>new.id and private.starter_selected(org,kind,r.id) and private.center_accessible(org,r.center_id);
 elsif kind='discipline' then select count(*) into n from core.disciplines r where r.org_id=org and r.state='active' and r.id<>new.id and private.starter_selected(org,kind,r.id);
 else select count(distinct r.person_id) into n from core.center_relationships r where r.org_id=org and r.kind=kind and r.state='active' and r.person_id<>target and private.starter_selected(org,kind,r.person_id) and private.center_accessible(org,r.center_id);end if;
 if kind='instructor' and exists(select 1 from core.role_assignments a where a.org_id=org and a.role='instructor' and a.state='active' and a.person_id<>target and private.starter_selected(org,'instructor',a.person_id)) then perform private.fail('PLAN_LIMIT_REACHED');end if;
 if n>=limit_n then perform private.fail('PLAN_LIMIT_REACHED');end if;
 if kind<>'discipline' and kind<>'center' then perform private.assert_center(org,new.center_id);end if;
 if sc is not null and kind<>'center' and not coalesce(private.starter_selected(org,kind,target),false) then
  -- Only new/explicitly reactivated rows can replace a vacant operational slot.
  if tg_op='UPDATE' and old.state='active' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  if kind='student' then
   select jsonb_set(sc,'{student_person_ids}',coalesce(jsonb_agg(value),'[]'::jsonb)||to_jsonb(target::text)) into sc from jsonb_array_elements_text(sc->'student_person_ids') x where value<>target::text and exists(select 1 from core.center_relationships q where q.org_id=org and q.person_id=value::uuid and q.kind='student' and q.state='active' and private.center_accessible(org,q.center_id));else sc:=jsonb_set(sc,array[kind||'_id'],to_jsonb(target::text));end if;
  select id into sub from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
  update private.p07_subscription_scope set starter_scope=sc where subscription_id=sub;
 end if;
 return new;
end$$;
create trigger starter_centers before insert or update on core.centers for each row execute function private.starter_resource_guard();
create trigger starter_rooms before insert or update on core.rooms for each row execute function private.starter_resource_guard();
create trigger starter_disciplines before insert or update on core.disciplines for each row execute function private.starter_resource_guard();
create trigger starter_relationships before insert or update on core.center_relationships for each row execute function private.starter_resource_guard();
-- Reservation effects use current scope; identity-only canonical rebinding is transactional.
create function private.starter_reservation_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from core.organizations where id=new.org_id for update;
 if private.current_plan_name(new.org_id)='starter' and (new.state='active' or tg_op='UPDATE') then
  perform private.starter_assert_selected(new.org_id,'student',new.person_id);
  if tg_op='UPDATE' then
   -- Approved canonical merges change identity only, before teacher references move.
   if new.person_id<>old.person_id and to_jsonb(new)-'person_id'-'version'=to_jsonb(old)-'person_id'-'version' then return new;end if;
  end if;
  if not private.starter_session_allowed(new.org_id,new.session_id) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
 return new;
end$$;
create trigger starter_reservations before insert or update on core.reservations for each row execute function private.starter_reservation_guard();
create function private.starter_role_guard() returns trigger language plpgsql set search_path='' as $$
#variable_conflict use_variable
begin
 perform 1 from core.organizations where id=new.org_id for update;
 if private.current_plan_name(new.org_id)='starter' and new.state='active' and new.role in ('instructor','staff','assistant') then
  if new.role<>'instructor' then
   -- Canonical merge may move an already active legacy role after its verified link.
   -- This does not activate a role, change its scope, or grant a Starter staff licence.
   if tg_op='UPDATE' then
    if old.state='active' and to_jsonb(new)-'person_id'-'version'=to_jsonb(old)-'person_id'-'version' and exists(select 1 from core.account_links l where l.id=new.account_link_id and l.org_id=new.org_id and l.person_id=new.person_id and l.state='active' and l.verified_at is not null) then return new;end if;
   end if;
   perform private.fail('PLAN_FEATURE_UNAVAILABLE');
  end if;
  perform private.starter_claim_instructor(new.org_id,new.scope_center_id,new.person_id);
  if exists(select 1 from core.role_assignments a where a.org_id=new.org_id and a.role='instructor' and a.state='active' and a.person_id<>new.person_id and private.starter_selected(new.org_id,'instructor',a.person_id)) or exists(select 1 from core.center_relationships a where a.org_id=new.org_id and a.kind='instructor' and a.state='active' and a.person_id<>new.person_id and private.starter_selected(new.org_id,'instructor',a.person_id)) then perform private.fail('PLAN_LIMIT_REACHED');end if;
 end if;
 return new;
end$$;
create trigger starter_roles before insert or update on core.role_assignments for each row execute function private.starter_role_guard();
create function private.starter_product_allowed(org uuid,product uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.product_versions p where p.org_id=org and p.id=product and private.center_accessible(org,p.center_id)
 and (select count(*) from core.product_scopes sc where sc.org_id=org and sc.product_version_id=p.id)=1
 and exists(select 1 from core.product_scopes sc where sc.org_id=org and sc.product_version_id=p.id and sc.scope_kind='center_discipline' and sc.event_id is null and sc.usage_targets=array['lesson']::text[] and sc.center_id=p.center_id and private.starter_selected(org,'discipline',sc.discipline_id) and exists(select 1 from core.products z join core.disciplines d on d.org_id=z.org_id and d.id=sc.discipline_id where z.org_id=org and z.id=p.product_id and left(z.name,length(d.name))=d.name)))
$$;
-- Recheck every request before receipt replay. Caller permissions never grant plan access.
create function private.starter_request_guard(op text,r jsonb,org uuid) returns void language plpgsql set search_path='' as $$
#variable_conflict use_column
declare ses uuid;cls uuid;target uuid;item jsonb;sc jsonb;prefix text;ent jsonb;rec record;effective_op text:=op;
begin
 if private.current_plan_name(org) is distinct from 'starter' then return;end if;
 if op='management_state_get_v1' then effective_op:=r->>'operation';end if;
 if exists(select 1 from private.runtime_operations x where x.name=effective_op and x.features && array['F05','F12','F17','F18','F20','F21','F22','F23','F24','F27','F29'] and effective_op<>'public_application_review_v1') or effective_op like 'event\_%' escape '\' or effective_op like 'lead\_%' escape '\' or effective_op like 'trial\_%' escape '\' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if private.starter_scope_required(org) and (r?'operation_key' or r?'session_id' or r?'class_id') and op not in ('subscription_get_v1','subscription_upgrade_quote_v1','subscription_downgrade_request_v1','subscription_change_cancel_v1','subscription_renewal_set_v1','saas_payment_submit_v1','saas_payment_verify_v1','role_revoke_v1','student_deactivate_v1') and not (op='discipline_save_v1' and r->>'state'='inactive') then perform private.fail('PLAN_LIMIT_REACHED');end if;
 if r?'change' then perform private.starter_request_guard(op,r->'change',org);end if;
 if r?'preview' then
  select payload into item from private.preview_payloads p join core.previews v on v.id=p.preview_id where v.org_id=org and p.preview_id=(r#>>'{preview,id}')::uuid;
  if item?'request' then item:=item->'request';end if;
  if item is not null then perform private.starter_request_guard(op,item,org);end if;
 end if;
 if r->>'center_id' is not null then perform private.assert_center(org,(r->>'center_id')::uuid);end if;
 perform private.starter_assert_selected(org,'discipline',(r->>'discipline_id')::uuid);
 perform private.starter_assert_selected(org,'room',(r->>'room_id')::uuid);
 if r#>>'{resource,kind}'='room' then perform private.starter_assert_selected(org,'room',(r#>>'{resource,id}')::uuid);
 elsif r#>>'{resource,kind}'='person' then
  target:=(r#>>'{resource,id}')::uuid;
  if coalesce(private.starter_selected(org,'student',target),false) and exists(select 1 from core.center_relationships where org_id=org and person_id=target and kind='student' and state='active') then perform private.starter_assert_selected(org,'student',target);
  else perform private.starter_assert_selected(org,'instructor',target);end if;
 end if;
 if op in ('class_assignment_set_v1','session_assignment_set_v1') then
  if r->>'duty'<>'instructor' or r->>'agreement_id' is not null then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  perform private.starter_assert_selected(org,'instructor',(r->>'person_id')::uuid);
  if not private.starter_instructor_active(org,(r->>'center_id')::uuid,(r->>'person_id')::uuid) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
 if op='role_assign_v1' and r->>'role' in ('staff','instructor','assistant') then
  if r->>'role'<>'instructor' then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  -- Slot mutation occurs only in the role trigger after normal authorization.
  if exists(select 1 from core.role_assignments a where a.org_id=org and a.role='instructor' and a.state='active' and a.person_id<>(r->>'person_id')::uuid and private.starter_selected(org,'instructor',a.person_id)) or exists(select 1 from core.center_relationships a where a.org_id=org and a.kind='instructor' and a.state='active' and a.person_id<>(r->>'person_id')::uuid and private.starter_selected(org,'instructor',a.person_id)) then perform private.fail('PLAN_LIMIT_REACHED');end if;
 end if;
 if r->>'event_id' is not null then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 for rec in select c.person_id,c.center_id from core.cash_movements c where c.org_id=org and c.id=(r->>'cash_movement_id')::uuid loop perform private.assert_center(org,rec.center_id);perform private.starter_assert_selected(org,'student',rec.person_id);end loop;
 for item in select value from jsonb_array_elements(coalesce(r->'keep_reservation_ids','[]'::jsonb)||coalesce(r->'cancel_reservation_ids','[]'::jsonb)) loop perform private.starter_request_guard('reservation_cancel_v1',jsonb_build_object('reservation_id',item),org);end loop;
 if r?'context' then perform private.starter_reference_guard(org,r#>>'{context,subject,type}',(r#>>'{context,subject,id}')::uuid);perform private.starter_reference_guard(org,'product_versions',(r#>>'{context,product_version_id}')::uuid);end if;
 for item in select value from jsonb_array_elements(coalesce(r->'requirements','[]'::jsonb)) loop
  for ent in select value from jsonb_array_elements(coalesce(item#>'{scope,center_ids}','[]'::jsonb)) loop perform private.starter_reference_guard(org,'centers',trim(both '"' from ent::text)::uuid);end loop;
  for ent in select value from jsonb_array_elements(coalesce(item#>'{scope,session_ids}','[]'::jsonb)) loop perform private.starter_reference_guard(org,'sessions',trim(both '"' from ent::text)::uuid);end loop;
  for ent in select value from jsonb_array_elements(coalesce(item#>'{scope,product_version_ids}','[]'::jsonb)) loop perform private.starter_reference_guard(org,'product_versions',trim(both '"' from ent::text)::uuid);end loop;
  if jsonb_array_length(coalesce(item#>'{scope,event_ids}','[]'::jsonb))>0 then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end loop;
 if r->>'debt_id' is not null then
  select person_id into target from core.debts where org_id=org and id=(r->>'debt_id')::uuid;
  perform private.starter_assert_selected(org,'student',target);
 end if;
 for rec in select z.* from core.sales z where z.org_id=org and z.id in ((r->>'sale_id')::uuid,(r->>'previous_sale_id')::uuid) loop
  perform private.assert_center(org,rec.center_id);perform private.starter_assert_selected(org,'student',rec.person_id);
 end loop;
 for rec in select q.* from core.lesson_requests q where q.org_id=org and (q.id=(r->>'lesson_request_id')::uuid or q.id in(select a.request_id from core.request_alternatives a where a.org_id=org and a.id=(r->>'alternative_id')::uuid)) loop
  perform private.assert_center(org,rec.center_id);perform private.starter_assert_selected(org,'student',rec.person_id);perform private.starter_assert_selected(org,'discipline',rec.discipline_id);perform private.starter_assert_selected(org,'instructor',rec.preferred_instructor_id);
 end loop;
 if r->>'alternative_id' is not null then select instructor_id into target from core.request_alternatives where org_id=org and id=(r->>'alternative_id')::uuid;perform private.starter_assert_selected(org,'instructor',target);end if;
 perform private.starter_assert_selected(org,'instructor',(r->>'preferred_instructor_id')::uuid);
 for item in select value from jsonb_array_elements(coalesce(r->'alternatives','[]')) loop perform private.starter_assert_selected(org,'instructor',(item->>'instructor_id')::uuid);end loop;
 if r->>'application_id' is not null then
  select to_jsonb(p) into item from core.public_applications a join core.publications p on p.org_id=a.org_id and p.id=a.publication_id where a.org_id=org and a.id=(r->>'application_id')::uuid;
  if item is null then perform private.fail('NOT_FOUND');end if;
  if item->>'event_id' is not null or item->>'session_id' is null or not private.starter_session_allowed(org,(item->>'session_id')::uuid) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
 if r->>'session_id' is not null then ses:=(r->>'session_id')::uuid;
 elsif r->>'replaces_id' is not null then ses:=(r->>'replaces_id')::uuid;
 elsif r->>'reservation_id' is not null then select session_id,person_id into ses,target from core.reservations where org_id=org and id=(r->>'reservation_id')::uuid;perform private.starter_assert_selected(org,'student',target);end if;
 if ses is not null and not exists(select 1 from core.sessions where org_id=org and id=ses) then perform private.fail('NOT_FOUND');end if;
 if ses is not null and not private.starter_session_allowed(org,ses,op not in ('session_get_v1','attendance_get_v1','attendance_history_v1','replacement_session_create_v1')) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 if ses is not null and op in ('attendance_close_v1','session_cancel_preview_v1','session_cancel_apply_v1','replacement_session_create_v1') and exists(select 1 from core.reservations q where q.org_id=org and q.session_id=ses and q.state='active' and not coalesce(private.starter_selected(org,'student',q.person_id),false)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 for rec in select q.person_id from core.reservations q join jsonb_array_elements(coalesce(r->'corrections','[]'::jsonb)) x on q.id=(x->>'reservation_id')::uuid where q.org_id=org loop perform private.starter_assert_selected(org,'student',rec.person_id);end loop;
 cls:=(r->>'class_id')::uuid;
 if cls is not null then select discipline_id into target from core.classes where org_id=org and id=cls;perform private.starter_assert_selected(org,'discipline',target);end if;
 if op not in ('class_assignment_set_v1','session_assignment_set_v1','role_assign_v1') and r->>'person_id' is not null and exists(select 1 from core.center_relationships where org_id=org and person_id=(r->>'person_id')::uuid and kind='student' and state='active') then perform private.starter_assert_selected(org,'student',(r->>'person_id')::uuid);end if;
 for target in select x from unnest(array[(r->>'product_version_id')::uuid,(r->>'new_product_version_id')::uuid]) x where x is not null loop
  if not exists(select 1 from core.product_versions where org_id=org and id=target) then perform private.fail('NOT_FOUND');end if;
  if not private.starter_product_allowed(org,target) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end loop;
 if op='product_publish_v1' then
  if jsonb_array_length(r#>'{terms,scopes}')<>1 then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  item:=r#>'{terms,scopes,0}';target:=(item->>'discipline_id')::uuid;
  if item->>'scope_kind'<>'center_discipline' or target is null or item->>'event_id' is not null or item->'usage_targets'<>'["lesson"]'::jsonb or (item->>'center_id')::uuid is distinct from (r->>'center_id')::uuid then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
  perform private.starter_assert_selected(org,'discipline',target);
  select name into prefix from core.disciplines where org_id=org and id=target and state='active';
  if prefix is null or left(r#>>'{terms,name}',length(prefix))<>prefix then perform private.fail('VALIDATION_FAILED');end if;
  if r->>'product_id' is not null and exists(select 1 from core.products p where p.org_id=org and p.id=(r->>'product_id')::uuid and left(p.name,length(prefix))<>prefix) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
end$$;
create function private.starter_student_count(org uuid) returns bigint language sql stable set search_path='' as $$
 select count(distinct person_id) from core.center_relationships r where r.org_id=org and r.kind='student' and r.state='active' and (private.current_plan_name(org)<>'starter' or (private.starter_selected(org,'student',r.person_id) and private.center_accessible(org,r.center_id)))
$$;
create function private.starter_usage(org uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('entries',jsonb_build_array(
 jsonb_build_object('key','centers','value',(select count(*) from core.centers where org_id=org and private.center_accessible(org,id))),
 jsonb_build_object('key','rooms','value',(select count(*) from core.rooms where org_id=org and state='active' and private.center_accessible(org,center_id) and private.starter_selected(org,'room',id))),
 jsonb_build_object('key','disciplines','value',(select count(*) from core.disciplines where org_id=org and state='active' and private.starter_selected(org,'discipline',id))),
 jsonb_build_object('key','instructors','value',(select count(distinct person_id) from (select person_id from core.center_relationships where org_id=org and state='active' and kind='instructor' and private.center_accessible(org,center_id) union select person_id from core.role_assignments where org_id=org and state='active' and role='instructor' and private.center_accessible(org,scope_center_id)) q where private.starter_selected(org,'instructor',person_id))),
 jsonb_build_object('key','active_students','value',private.starter_student_count(org))))
$$;
-- Resolve nested document/source references through the same current plan admission.
create function private.starter_reference_guard(org uuid,typ text,target uuid) returns void language plpgsql stable set search_path='' as $$
declare field text;
begin
 if private.current_plan_name(org) is distinct from 'starter' or target is null then return;end if;
 if typ in ('events','event_registrations') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 field:=case typ when 'centers' then 'center_id' when 'sessions' then 'session_id' when 'reservations' then 'reservation_id' when 'lesson_requests' then 'lesson_request_id' when 'sales' then 'sale_id' when 'product_versions' then 'product_version_id' end;
 if field is not null then perform private.starter_request_guard('session_get_v1',jsonb_build_object(field,target),org);end if;
end$$;
create function private.starter_schedule_write_guard(org uuid,rows_data jsonb) returns void language plpgsql stable set search_path='' as $$
declare d jsonb;ses uuid;
begin
 if private.current_plan_name(org) is distinct from 'starter' then return;end if;
 for d in select value from jsonb_array_elements(rows_data) loop
  if not coalesce((d->>'_touch')::boolean,true) then continue;end if;ses:=(d->>'id')::uuid;
  if exists(select 1 from core.sessions where org_id=org and id=ses) and (not private.starter_session_allowed(org,ses) or exists(select 1 from core.reservations q where q.org_id=org and q.session_id=ses and q.state='active' and not coalesce(private.starter_selected(org,'student',q.person_id),false))) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end loop;
end$$;
do $patch$
declare b text;anchor text:='begin'||E'\n';
begin
 b:=pg_get_functiondef('private.schedule_write(uuid,jsonb,uuid[],integer)'::regprocedure);
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter schedule write anchor drift';end if;
 execute replace(b,anchor,anchor||' perform private.starter_schedule_write_guard(org,rows_data);'||E'\n');
 b:=pg_get_functiondef('private.lesson_right(uuid,uuid,boolean,uuid,uuid[],integer,boolean)'::regprocedure);
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter rights effect anchor drift';end if;
 execute replace(b,anchor,anchor||' perform private.starter_request_guard(''reservation_cancel_v1'',jsonb_build_object(''reservation_id'',reservation),org);'||E'\n');
 b:=pg_get_functiondef('private.p05_context(uuid,uuid,uuid,jsonb)'::regprocedure);
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter document target anchor drift';end if;
 execute replace(b,anchor,anchor||$a$ if private.current_plan_name(org)='starter' then
  if exists(select 1 from core.center_relationships q where q.org_id=org and q.person_id=target and q.kind='student') then perform private.starter_assert_selected(org,'student',target);end if;
  perform private.starter_reference_guard(org,ctx#>>'{subject,type}',(ctx#>>'{subject,id}')::uuid);
  perform private.starter_reference_guard(org,'product_versions',(ctx->>'product_version_id')::uuid);
 end if;
$a$);
end$patch$;
create function private.starter_replay_guard(op text,org uuid,reference uuid) returns void language plpgsql stable set search_path='' as $$
declare target uuid;product uuid;
begin
 if private.current_plan_name(org) is distinct from 'starter' then return;end if;
 if op='center_create_v1' then perform private.assert_center(org,reference);
 elsif op='room_save_v1' then perform private.starter_assert_selected(org,'room',reference);
 elsif op='discipline_save_v1' then perform private.starter_assert_selected(org,'discipline',reference);
 elsif op='student_activate_v1' then select person_id into target from core.center_relationships where org_id=org and id=reference;perform private.starter_assert_selected(org,'student',target);
 elsif op='class_save_v1' then select discipline_id into target from core.classes where org_id=org and id=reference;perform private.starter_assert_selected(org,'discipline',target);
 elsif op='product_publish_v1' then if not private.starter_product_allowed(org,reference) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
end$$;
-- Patch the current dispatcher, not a historical copy. Fail closed on changed anchors.
do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor text:='  mode:=private.access_mode(org);';
begin
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter dispatcher anchor drift';end if;
 if strpos(b,$a$private.has_role(org,person,'staff',center)$a$)=0 then raise exception 'Starter staff permission anchor drift';end if;
 b:=replace(b,$a$private.has_role(org,person,'staff',center)$a$,$a$(private.current_plan_name(org)<>'starter' and private.has_role(org,person,'staff',center))$a$);
 b:=replace(b,anchor,'  perform private.starter_request_guard(p_operation,r,org);'||E'\n'||anchor);
 if strpos(b,'''limits'',plan.limits')=0 then raise exception 'Starter subscription view anchor drift';end if;
 b:=replace(b,$a$(select count(distinct person_id) from core.center_relationships where org_id=org and kind='student' and state='active')$a$,'private.starter_student_count(org)');
 if array_length(string_to_array(b,'   out:=receipt.result;'),1)<>2 then raise exception 'Starter replay anchor drift';end if;
 b:=replace(b,'   out:=receipt.result;','   perform private.starter_replay_guard(p_operation,org,receipt.business_reference);'||E'\n'||'   out:=receipt.result;');
 if array_length(string_to_array(b,$a$ when 'product_publish_v1' then$a$),1)<>2 then raise exception 'Starter scope view anchor drift';end if;
 b:=replace(b,$a$ when 'product_publish_v1' then$a$,$a$
  if plan.name='starter' then out:=out||jsonb_build_object('usage',private.starter_usage(org));end if;
  if plan.name='starter' or exists(select 1 from core.saas_change_requests c join private.starter_change_scopes x on x.change_id=c.id where c.org_id=org and c.state='scheduled') then
   out:=out||jsonb_build_object('subscription_version',sub.version,'starter_scope_required',private.starter_scope_required(org),
    'starter_scope',(select jsonb_build_object('center_id',x.kept_center_id,'scope',x.starter_scope) from private.p07_subscription_scope x where x.subscription_id=sub.id and x.starter_scope is not null),
    'pending_starter_scope',(select jsonb_build_object('center_id',c.kept_center_id,'scope',x.scope) from core.saas_change_requests c join private.starter_change_scopes x on x.change_id=c.id where c.org_id=org and c.state='scheduled' order by c.created_at desc,c.id desc limit 1));
  end if;
 when 'product_publish_v1' then$a$);
 b:=replace(b,'''limits'',plan.limits','''limits'',case when plan.name=''starter'' then private.starter_limits() else plan.limits end');execute b;
end$patch$;
-- Import rows use the same selected student budget and live Starter scope as human commands.
do $patch$
declare b text:=pg_get_functiondef('private.p06_import_row_check(uuid,uuid,jsonb,text)'::regprocedure);anchor text;
begin
 anchor:=$a$(select count(distinct person_id) from core.center_relationships where org_id=org and kind='student' and state='active')$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter import budget anchor drift';end if;
 b:=replace(b,anchor,'private.starter_student_count(org)');
 anchor:='begin'||E'\n';
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter import scope anchor drift';end if;
 b:=replace(b,anchor,anchor||$a$ if private.current_plan_name(org)='starter' then
  if private.starter_scope_required(org) then perform private.fail('PLAN_LIMIT_REACHED');end if;
  perform private.starter_assert_selected(org,'student',(payload->>'person_ref')::uuid);
  if coalesce((payload->>'opening_credits')::bigint,0)>0 and not private.starter_product_allowed(org,(payload->>'product_version_ref')::uuid) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end if;
$a$);execute b;
end$patch$;
-- Downgrade selections are explicit and versioned; boundary applies the captured scope.
do $patch$
declare b text:=pg_get_functiondef('private.p07_subscription_command(text,jsonb,uuid,uuid,uuid,uuid[])'::regprocedure);anchor text;
begin
 anchor:=$a$  update core.saas_change_requests set state='cancelled',version=version+1 where org_id=org and state='scheduled';$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter downgrade validation anchor drift';end if;
 b:=replace(b,anchor,$a$  if t.name='starter' then
   if (r->>'expected_version')::bigint is distinct from s.version then perform private.fail('VERSION_CONFLICT');end if;
   perform private.starter_validate_scope(org,kept,r->'kept_scope');
  end if;
$a$||anchor);
 anchor:=$a$ returning version into v;subject:='saas_change_requests';$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter downgrade capture anchor drift';end if;
 b:=replace(b,anchor,$a$ returning version into v;subject:='saas_change_requests';
  if t.name='starter' then
   update core.saas_subscriptions set version=version+1 where id=s.id;
   insert into private.starter_change_scopes(change_id,scope,subscription_version) values(id,r->'kept_scope',s.version+1);
  end if;$a$);execute b;
 b:=pg_get_functiondef('private.p07_boundary(uuid,uuid,uuid,uuid[])'::regprocedure);
 anchor:=$a$  update core.saas_subscriptions set plan_version_id=c.target_plan_id,version=version+1 where id=s.id;$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter boundary validation anchor drift';end if;
 b:=replace(b,anchor,$a$  if p.name='starter' then perform private.starter_boundary_scope(org,c.kept_center_id,(select scope from private.starter_change_scopes where change_id=c.id));end if;
$a$||anchor);
 anchor:=$a$  update core.saas_change_requests set state='applied',version=version+1 where id=c.id;changed:=true;$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter boundary capture anchor drift';end if;
 b:=replace(b,anchor,$a$  update private.p07_subscription_scope set starter_scope=case when p.name='starter' then (select scope from private.starter_change_scopes where change_id=c.id) else null end where subscription_id=s.id;
$a$||anchor);execute b;
end$patch$;
do $patch$
declare b text:=pg_get_functiondef('private.p07_subscription_management(jsonb,uuid,uuid,boolean)'::regprocedure);anchor text:=$a$vals:=r#>'{selector,key}';$a$;
begin
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter scope read anchor drift';end if;
 execute replace(b,anchor,anchor||$a$if op='subscription_downgrade_request_v1' then vals:=vals||jsonb_build_object('expected_version',s.version);end if;$a$);
end$patch$;
create function private.starter_schedule_guard(org uuid,d jsonb) returns void language plpgsql stable set search_path='' as $$
declare a jsonb;room uuid;
begin
 if private.current_plan_name(org) is distinct from 'starter' then return;end if;
 perform private.starter_assert_selected(org,'discipline',(d->>'discipline_id')::uuid);
 if (select count(*) from jsonb_array_elements(d->'resources') x where x->>'kind'='room')<>1 then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 select (x->>'id')::uuid into room from jsonb_array_elements(d->'resources') x where x->>'kind'='room';
 perform private.starter_assert_selected(org,'room',room);
 if not exists(select 1 from core.rooms where org_id=org and id=room and state='active') then perform private.fail('NOT_FOUND');end if;
 if (select count(*) from jsonb_array_elements(d->'assignments') x where x->>'duty'='instructor')<>1 or exists(select 1 from jsonb_array_elements(d->'assignments') x where x->>'duty'<>'instructor') then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 for a in select value from jsonb_array_elements(d->'assignments') loop
  perform private.starter_assert_selected(org,'instructor',(a->>'person_id')::uuid);
  if not private.starter_instructor_active(org,(d->>'center_id')::uuid,(a->>'person_id')::uuid) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 end loop;
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.schedule_validate(uuid,uuid,jsonb)'::regprocedure);anchor text:=$a$ for d in select x from jsonb_array_elements(rows_data) x loop$a$;
begin
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter schedule validation anchor drift';end if;
 execute replace(b,anchor,anchor||E'\n'||'  perform private.starter_schedule_guard(org,d);');
end$patch$;
-- Public calendars and replayed submissions cannot retain event access after downgrade.
do $patch$
declare b text:=pg_get_functiondef('private.p04_public(text,jsonb,uuid[],jsonb)'::regprocedure);anchor text;
begin
 anchor:=$a$and exists(select 1 from core.saas_subscriptions z join core.saas_plan_versions v on v.id=z.plan_version_id where z.org_id=p.org_id and 'F25'=any(v.features))$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter public calendar anchor drift';end if;
 b:=replace(b,anchor,$a$and (private.current_plan_name(p.org_id)='starter' or exists(select 1 from core.saas_subscriptions z join core.saas_plan_versions v on v.id=z.plan_version_id where z.org_id=p.org_id and 'F25'=any(v.features)))
   and (private.current_plan_name(p.org_id)<>'starter' or (p.event_id is null and p.session_id is not null and not private.starter_scope_required(p.org_id) and private.starter_session_allowed(p.org_id,p.session_id)))$a$);
 anchor:=$a$ select * into pub from core.publications where id=(r->>'publication_id')::uuid and published;$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter public submit anchor drift';end if;
 b:=replace(b,anchor,anchor||$a$
 if private.current_plan_name(org)='starter' and (private.starter_scope_required(org) or pub.event_id is not null or pub.session_id is null or not private.starter_session_allowed(org,pub.session_id)) then perform private.fail('SERVICE_UNAVAILABLE');end if;$a$);
 b:=replace(b,$a$or not exists(select 1 from core.saas_subscriptions z join core.saas_plan_versions v on v.id=z.plan_version_id where z.org_id=org and 'F25'=any(v.features))$a$,$a$or (private.current_plan_name(org)<>'starter' and not exists(select 1 from core.saas_subscriptions z join core.saas_plan_versions v on v.id=z.plan_version_id where z.org_id=org and 'F25'=any(v.features)))$a$);execute b;
end$patch$;
-- Narrow Starter intake review creates/matches a person, never a general CRM lead.
do $patch$
declare b text:=pg_get_functiondef('private.p04_command(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);anchor text;
begin
 anchor:=$a$   if not exists(select 1 from core.leads where org_id=org and center_id=center and person_id=target and state='open') then$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter intake lead anchor drift';end if;
 execute replace(b,anchor,$a$   if private.current_plan_name(org)<>'starter' and not exists(select 1 from core.leads where org_id=org and center_id=center and person_id=target and state='open') then$a$);
end$patch$;
insert into private.runtime_operations(name,permission,billing_class,features) values('session_assignment_set_v1','schedule.manage','maintenance',array[]::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
insert into private.runtime_operations(name,permission,billing_class,features) values('public_application_review_v1','crm.daily','new',array['F25']::text[]) on conflict(name) do update set permission=excluded.permission,billing_class=excluded.billing_class,features=excluded.features;
-- Approved canonical merges remap only current/pending scope, before live references move.
create function private.starter_remap_scope(scope jsonb,members uuid[],target uuid) returns jsonb language sql immutable set search_path='' as $$
 select case when scope is null then null else jsonb_set(case when (scope->>'instructor_id')::uuid=any(members) then jsonb_set(scope,'{instructor_id}',to_jsonb(target::text)) else scope end,'{student_person_ids}',(select coalesce(jsonb_agg(v order by v),'[]'::jsonb) from (select distinct case when value::uuid=any(members) then target::text else value end v from jsonb_array_elements_text(scope->'student_person_ids')) q)) end
$$;
create function private.starter_merge_scope(org uuid,members uuid[],target uuid) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from core.organizations where id=org for update;
 update private.p07_subscription_scope s set starter_scope=private.starter_remap_scope(s.starter_scope,members,target) where exists(select 1 from core.saas_subscriptions z where z.id=s.subscription_id and z.org_id=org) and s.starter_scope is not null;
 update private.starter_change_scopes s set scope=private.starter_remap_scope(s.scope,members,target) where exists(select 1 from core.saas_change_requests z where z.id=s.change_id and z.org_id=org and z.state='scheduled');
end$$;
do $patch$
declare b text:=pg_get_functiondef('private.p07_merge(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);anchor text:=$a$ -- Current operational references move; inactive rows remain linked history.$a$;
begin
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Starter merge anchor drift';end if;
 execute replace(b,anchor,' perform private.starter_merge_scope(org,members,target);'||E'\n'||anchor);
end$patch$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on all functions in schema private to service_role;
commit;
