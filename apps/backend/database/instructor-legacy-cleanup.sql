begin;
-- PR143 has transferred legacy membership to role_assignments. A missing
-- canonical role is a deployment error, never permission to discard a duty.
lock table core.role_assignments,core.center_relationships in share row exclusive mode;
do $check$
begin
 if exists(select 1 from core.center_relationships r where r.kind='instructor'
  and not exists(select 1 from core.role_assignments a where a.org_id=r.org_id and a.scope_center_id=r.center_id
   and a.role='instructor' and a.person_id in (r.person_id,private.p07_person_root(r.org_id,r.person_id)))) then
  raise exception 'Instructor cleanup requires canonical role transfer';
 end if;
end$check$;
delete from core.center_relationships where kind='instructor';
alter table core.center_relationships drop constraint instructor_membership_is_role;
alter table core.center_relationships drop constraint center_relationships_kind_check;
alter table core.center_relationships add constraint center_relationships_kind_check check(kind in ('student','staff','candidate'));
-- Offline duty is a role too; verified-account capability remains has_role's concern.
create or replace function private.starter_instructor_active(org uuid,center uuid,target uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.role_assignments a where a.org_id=org and a.scope_center_id=center and a.person_id=target and a.role='instructor' and a.state='active')
$$;
-- Remove the old dual-source quota branches and the now redundant Starter-only
-- resource fallback. Person read projection remains derived, not writable state.
do $patch$
declare item record;body text;
begin
 for item in select * from (values
  ('private.starter_scope_required(uuid)',$a$(select count(distinct person_id) from (select person_id from private.person_center_relationships where org_id=org and kind='instructor' and state='active' union select person_id from core.role_assignments where org_id=org and role='instructor' and state='active') x)$a$,$a$(select count(distinct person_id) from core.role_assignments where org_id=org and role='instructor' and state='active')$a$),
  ('private.starter_validate_scope(uuid,uuid,jsonb)',$a$(exists(select 1 from private.person_center_relationships where org_id=org and center_id=center and kind='instructor' and state='active') or exists(select 1 from core.role_assignments where org_id=org and scope_center_id=center and role='instructor' and state='active'))$a$,$a$exists(select 1 from core.role_assignments where org_id=org and scope_center_id=center and role='instructor' and state='active')$a$),
  ('private.starter_claim_instructor(uuid,uuid,uuid)',$a$ or exists(select 1 from private.person_center_relationships a where a.org_id=org and a.kind='instructor' and a.state='active' and a.person_id<>target and private.starter_selected(org,'instructor',a.person_id))$a$,$a$$a$),
  ('private.starter_role_guard()',$a$ or exists(select 1 from private.person_center_relationships a where a.org_id=new.org_id and a.kind='instructor' and a.state='active' and a.person_id<>new.person_id and private.starter_selected(new.org_id,'instructor',a.person_id))$a$,$a$$a$),
  ('private.starter_request_guard(text,jsonb,uuid)',$a$ or exists(select 1 from private.person_center_relationships a where a.org_id=org and a.kind='instructor' and a.state='active' and a.person_id<>(r->>'person_id')::uuid and private.starter_selected(org,'instructor',a.person_id))$a$,$a$$a$),
  ('private.starter_usage(uuid)',$a$(select count(distinct person_id) from (select person_id from private.person_center_relationships where org_id=org and state='active' and kind='instructor' and private.center_accessible(org,center_id) union select person_id from core.role_assignments where org_id=org and state='active' and role='instructor' and private.center_accessible(org,scope_center_id)) q where private.starter_selected(org,'instructor',person_id))$a$,$a$(select count(distinct person_id) from core.role_assignments where org_id=org and state='active' and role='instructor' and private.center_accessible(org,scope_center_id) and private.starter_selected(org,'instructor',person_id))$a$),
  ('private.starter_resource_guard()',$a$if new.kind not in ('student','instructor') then return new;end if;
  kind:=new.kind;target:=new.person_id;limit_n:=case kind when 'student' then 100 else 1 end;$a$,$a$if new.kind<>'student' then return new;end if;
  kind:='student';target:=new.person_id;limit_n:=100;$a$),
  ('private.starter_resource_guard()',$a$ if kind='instructor' and exists(select 1 from core.role_assignments a where a.org_id=org and a.role='instructor' and a.state='active' and a.person_id<>target and private.starter_selected(org,'instructor',a.person_id)) then perform private.fail('PLAN_LIMIT_REACHED');end if;
$a$,$a$$a$),
  ('private.assert_resource(uuid,uuid,text,uuid)',$a$(not exists(select 1 from private.person_center_relationships x where x.org_id=org and x.center_id=center and x.person_id=resource and x.state='active') and not (private.current_plan_name(org)='starter' and private.starter_instructor_active(org,center,resource)))$a$,$a$not exists(select 1 from private.person_center_relationships x where x.org_id=org and x.center_id=center and x.person_id=resource and x.state='active')$a$)
 ) as patches(signature,anchor,replacement) loop
  body:=pg_get_functiondef(item.signature::regprocedure);
  if array_length(string_to_array(body,item.anchor),1)<>2 then raise exception 'Instructor cleanup anchor drift: %',item.signature;end if;
  execute replace(body,item.anchor,item.replacement);
 end loop;
end$patch$;
notify pgrst,'reload schema';
commit;
