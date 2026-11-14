begin;
-- Aggregate only existing evidence; no recipient, file, account or token discovery.
create function private.center_setup_status(org uuid,center uuid,person uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare stamp timestamptz:=clock_timestamp();
begin
 if center is null then perform private.fail('VALIDATION_FAILED');end if;
 if not private.is_manager(org,person,center) then perform private.fail('FORBIDDEN');end if;
 if not private.center_accessible(org,center) then perform private.fail('NOT_FOUND');end if;
 return jsonb_build_object('as_of',stamp,'document_published',exists(
  select 1 from core.documents d join core.document_versions v on v.org_id=d.org_id and v.document_id=d.id
  join core.files f on f.org_id=v.org_id and f.id=v.file_id and f.state='ready'
  where d.org_id=org and d.state='active' and (d.scope_center_id is null or d.scope_center_id=center) and v.effective_at<=stamp
  and not exists(select 1 from core.document_versions newer where newer.org_id=v.org_id and newer.document_id=v.document_id
   and newer.effective_at<=stamp and (newer.effective_at,newer.created_at,newer.id)>(v.effective_at,v.created_at,v.id))
 ),'member_invitation_sent',exists(
  select 1 from core.invitations i join private.invitation_deliveries d on d.invitation_id=i.id
  join core.outbox_jobs j on j.org_id=i.org_id and j.id=d.job_id and j.kind='account_invitation'
  where i.org_id=org and i.center_id=center and j.state='succeeded' and j.provider_reference is not null
 ));
end$$;
create function private.role_account_access_granted(org uuid,assignment uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.role_assignments r
 join core.account_links l on l.org_id=r.org_id and l.id=r.account_link_id and l.person_id=r.person_id and l.state='active' and l.verified_at is not null
 join core.accounts a on a.id=l.account_id and a.state='active'
 join auth.users u on u.id=a.auth_user_id and u.email_confirmed_at is not null and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<=statement_timestamp())
 where r.org_id=org and r.id=assignment and r.state='active')
$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);
 a:=$a$ when 'centers_list_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Setup center dispatch anchor drift';end if;
 b:=replace(b,a,a||$a$
  if coalesce((r->>'include_setup_status')::boolean,false) then
   entry:=private.center_setup_status(org,center,person);
   select jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',c.id,'name',c.name,'timezone',c.timezone,'state',c.state,'accessible',true,'version',c.version,'setup_status',entry)),'next_cursor',null)
    into out from core.centers c where c.org_id=org and c.id=center;
  else$a$);
 a:=$a$ when 'center_manager_assign_v1','manager_self_assign_center_v1','org_manager_assign_v1','role_assign_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Setup center end anchor drift';end if;
 b:=replace(b,a,$a$  end if;
$a$||a);
 a:=$a$'id',x.id,'person_id',x.person_id,'subscriber_number',private.subscriber_number(org,x.person_id),'role',x.role$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Role access read anchor drift';end if;
 b:=replace(b,a,a||$a$,'account_access_granted',private.role_account_access_granted(org,x.id)$a$);
 execute b;
 b:=pg_get_functiondef('private.instructor_management_page(jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$'exists',true,'state',state,$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Instructor access read anchor drift';end if;
 execute replace(b,a,a||$a$'account_access_granted',private.role_account_access_granted(org,id),$a$);
end$patch$;
revoke all on function private.center_setup_status(uuid,uuid,uuid),private.role_account_access_granted(uuid,uuid) from public,anon,authenticated;
grant execute on function private.center_setup_status(uuid,uuid,uuid),private.role_account_access_granted(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
