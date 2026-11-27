begin;

create table private.pending_team_invitation_roles(
 invitation_id uuid not null references core.invitations(id) on delete cascade,
 role text not null check (role in ('center_manager','staff','instructor')),
 assignment_id uuid not null,
 assigned_by_account_id uuid not null references core.accounts(id),
 primary key(invitation_id,role)
);
revoke all on private.pending_team_invitation_roles from public,anon,authenticated;
grant select,insert on private.pending_team_invitation_roles to service_role;

create function private.apply_team_invitation_roles(inv core.invitations, link_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare planned record; grantor uuid;
begin
 for planned in
  select * from private.pending_team_invitation_roles p where p.invitation_id=inv.id order by p.role
 loop
  select private.person_for(inv.org_id,a.id) into grantor
   from core.accounts a where a.id=planned.assigned_by_account_id and a.state='active';
  if private.access_mode(inv.org_id) is distinct from 'normal'
   or not exists(select 1 from core.people p where p.org_id=inv.org_id and p.id=inv.person_id and p.state='active')
   or grantor is null
   or (planned.role='center_manager' and grantor is distinct from (select o.owner_person_id from core.organizations o where o.id=inv.org_id))
   or (planned.role<>'center_manager' and not private.is_manager(inv.org_id,grantor,inv.center_id))
  then perform private.fail('INVITATION_UNAVAILABLE');end if;
  if planned.role='staff' then perform private.require_feature(inv.org_id,'F05');end if;

  -- The explicit assignment may have selected an existing offline instructor.
  update core.role_assignments a set account_link_id=link_id,version=a.version+1
   where a.id=planned.assignment_id and a.org_id=inv.org_id and a.person_id=inv.person_id
    and a.scope_center_id=inv.center_id and a.role='instructor' and planned.role='instructor'
    and a.account_link_id is null and a.state='active';
  if not found then
   insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id)
   values(planned.assignment_id,inv.org_id,inv.person_id,planned.role,inv.center_id,'active',link_id)
   on conflict do nothing;
   if not found then perform private.fail('INVALID_STATE_TRANSITION');end if;
  end if;
 end loop;
end$$;
revoke all on function private.apply_team_invitation_roles(core.invitations,uuid) from public,anon,authenticated;
grant execute on function private.apply_team_invitation_roles(core.invitations,uuid) to service_role;

do $patch$
declare body text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure); anchor text;
begin
 anchor:=$a$  if linked is null then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
  if role_name='center_manager' and center is null then perform private.fail('VALIDATION_FAILED');end if;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Team invitation assignment anchor drift';end if;
 body:=replace(body,anchor,$a$  if role_name='center_manager' and center is null then perform private.fail('VALIDATION_FAILED');end if;
  if linked is null then
   if p_operation not in ('role_assign_v1','center_manager_assign_v1') or center is null
    or role_name not in ('center_manager','staff','instructor') then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
   select i.* into inv from core.invitations i join core.people p on p.org_id=i.org_id and p.id=i.person_id
    where i.org_id=org and i.center_id=center and i.person_id=target and i.state='pending'
     and i.expires_at>clock_timestamp() and p.state='active'
    order by i.created_at desc,i.id desc limit 1;
   if not found then perform private.fail('ACCOUNT_LINK_REQUIRED');end if;
   if role_name='instructor' then
    select a.id,a.version into selected,version_n from core.role_assignments a
     where a.org_id=org and a.scope_center_id=center and a.person_id=target
      and a.role='instructor' and a.state='active' and a.account_link_id is null;
    record_id:=coalesce(selected,record_id);version_n:=coalesce(version_n,1);
   end if;
   insert into private.pending_team_invitation_roles(invitation_id,role,assignment_id,assigned_by_account_id)
    values(inv.id,role_name,record_id,actor.id) on conflict do nothing;
   if not found then perform private.fail('INVALID_STATE_TRANSITION');end if;
  else$a$);
 anchor:=$a$  subject:='role_assignments';
 when 'role_revoke_preview_v1' then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Team invitation assignment end anchor drift';end if;
 body:=replace(body,anchor,'  end if;'||E'\n'||anchor);
 anchor:=$a$  update core.invitations set state='accepted',version=version+1 where id=inv.id;$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Team invitation acceptance anchor drift';end if;
 execute replace(body,anchor,'  perform private.apply_team_invitation_roles(inv,record_id);'||E'\n'||anchor);
end$patch$;

commit;
