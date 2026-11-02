begin;
-- Instructor membership has one writable state: role_assignments. An unlinked
-- legacy membership remains an offline duty, never an authenticated capability.
lock table core.role_assignments,core.center_relationships in share row exclusive mode;
alter table core.role_assignments alter column account_link_id drop not null;
alter table core.role_assignments add constraint offline_instructor_role check
 (account_link_id is not null or (role='instructor' and scope_center_id is not null));
-- Existing roles, including revoked ones, take precedence: do not revive a role
-- from a stale relationship. Preserve IDs and original timestamps for offline rows.
alter table core.role_assignments disable trigger starter_roles;
insert into core.role_assignments(id,created_at,version,org_id,person_id,role,scope_center_id,state,account_link_id)
select distinct on (r.org_id,r.center_id,r.person_id) r.id,r.created_at,r.version,r.org_id,r.person_id,'instructor',r.center_id,r.state,null
from core.center_relationships r where r.kind='instructor'
 and not exists(select 1 from core.role_assignments a where a.org_id=r.org_id and a.scope_center_id=r.center_id and a.person_id=r.person_id and a.role='instructor')
order by r.org_id,r.center_id,r.person_id,(r.state='active') desc,r.created_at desc,r.id desc;
alter table core.role_assignments enable trigger starter_roles;
-- Retain the original records as history; they can no longer be activated.
update core.center_relationships set state='inactive',ended_at=coalesce(ended_at,transaction_timestamp()),version=version+1
where kind='instructor' and state='active';
alter table core.center_relationships add constraint instructor_membership_is_role check(kind<>'instructor' or state='inactive');
create view private.person_center_relationships with (security_invoker=true) as
select id,created_at,version,org_id,center_id,person_id,kind,state,started_at,ended_at
from core.center_relationships where kind<>'instructor'
union all
select id,created_at,version,org_id,scope_center_id,person_id,'instructor'::text,state,created_at,null::timestamptz
from (select distinct on (org_id,scope_center_id,person_id) a.* from core.role_assignments a
 where role='instructor' and scope_center_id is not null
 order by org_id,scope_center_id,person_id,(state='active') desc,created_at desc,id desc) a;
revoke all on private.person_center_relationships from public,anon,authenticated;
grant select on private.person_center_relationships to service_role;
-- Route operational relationship reads through the single projection. Physical
-- history/merge snapshots and student writes stay on their existing tables.
do $patch$
declare f record;b text;anchor text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.prokind='f' and p.prosrc ~* '(from|join) core\.center_relationships' loop
  b:=pg_get_functiondef(f.oid);
  b:=replace(b,'delete from core.center_relationships','delete from __physical_center_relationships');
  b:=replace(replace(b,'from core.center_relationships','from private.person_center_relationships'),'join core.center_relationships','join private.person_center_relationships');
  b:=replace(b,'delete from __physical_center_relationships','delete from core.center_relationships');
  execute b;
 end loop;
 -- Inactive instructor history must not hide an existing center person from
 -- its live manager. Staff still need an active operational relationship.
 b:=pg_get_functiondef('private.person_operational_access(uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$and cr.state='active'$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Historical instructor person scope anchor drift';end if;
 execute replace(b,anchor,$a$and (cr.state='active' or (cr.kind='instructor' and private.is_manager(org,actor,center)))$a$);
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$  insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(record_id,org,target,role_name,center,'active',linked);$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Canonical instructor assignment anchor drift';end if;
 execute replace(b,anchor,$a$  if role_name='instructor' and exists(select 1 from core.role_assignments a where a.org_id=org and a.scope_center_id=center and a.person_id=target and a.role='instructor' and a.state='active' and a.account_link_id is null) then
   update core.role_assignments a set account_link_id=linked,version=a.version+1 where a.org_id=org and a.scope_center_id=center and a.person_id=target and a.role='instructor' and a.state='active' and a.account_link_id is null returning a.id,a.version into record_id,version_n;
  else
   insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values(record_id,org,target,role_name,center,'active',linked);
  end if;$a$);
 -- Offline memberships are duties, not verified-account grants. Preserve them
 -- through person merge independently of the account-link transfer branch.
 b:=pg_get_functiondef('private.p07_merge(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
 anchor:=$a$and s.state='active' and not exists(select 1 from core.account_links l where l.id=s.account_link_id$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Offline merge grant cleanup anchor drift';end if;
 b:=replace(b,anchor,$a$and s.state='active' and not (s.role='instructor' and s.account_link_id is null) and not exists(select 1 from core.account_links l where l.id=s.account_link_id$a$);
 if position('perform private.starter_merge_scope(org,members,target);' in b)=0 then raise exception 'Canonical merge scope remap missing';end if;
 anchor:=$a$ update core.people p set state='merged',merged_into_id=target,version=p.version+1 where p.org_id=org and p.id=any(members);$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Offline merge membership anchor drift';end if;
 execute replace(b,anchor,anchor||$a$
 update core.role_assignments s set state='inactive',version=s.version+1
 where s.org_id=org and s.person_id=any(members) and s.role='instructor' and s.account_link_id is null and s.state='active'
 and exists(select 1 from core.role_assignments t where t.org_id=org and t.person_id=target and t.role='instructor' and t.state='active' and t.scope_center_id=s.scope_center_id);
 with ranked as (select id,row_number() over(partition by scope_center_id order by created_at,id) n from core.role_assignments
  where org_id=org and person_id=any(members) and role='instructor' and account_link_id is null and state='active')
 update core.role_assignments s set state='inactive',version=s.version+1 from ranked r where s.id=r.id and r.n>1;
 update core.role_assignments s set person_id=target,version=s.version+1
 where s.org_id=org and s.person_id=any(members) and s.role='instructor' and s.account_link_id is null and s.state='active';$a$);
 -- Removing account access is not removing the instructor's center duty.
 -- Retain an offline membership, with no automatic privilege on re-linking.
 b:=pg_get_functiondef('private.p07_revoke(text,jsonb,uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$  update core.role_assignments x set state='inactive',version=x.version+1 where x.org_id=org and x.account_link_id=target_id and x.state='active';$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Instructor account access separation anchor drift';end if;
 execute replace(b,anchor,$a$  update core.role_assignments x set state=case when x.role='instructor' then 'active' else 'inactive' end,
   account_link_id=case when x.role='instructor' then null else x.account_link_id end,version=x.version+1
   where x.org_id=org and x.account_link_id=target_id and x.state='active';$a$);
 -- Canonical alias transfer changes no membership count or account capability.
 b:=pg_get_functiondef('private.starter_role_guard()'::regprocedure);
 anchor:=$a$ perform 1 from core.organizations where id=new.org_id for update;$a$;
 if array_length(string_to_array(b,anchor),1)<>2 then raise exception 'Offline canonical role transfer anchor drift';end if;
 execute replace(b,anchor,anchor||$a$
 if tg_op='UPDATE' and old.role='instructor' and old.account_link_id is null and new.person_id<>old.person_id
 and to_jsonb(new)-'person_id'-'version'=to_jsonb(old)-'person_id'-'version'
 and private.p07_person_root(new.org_id,old.person_id)=new.person_id then return new;end if;$a$);
end$patch$;
notify pgrst,'reload schema';
commit;
