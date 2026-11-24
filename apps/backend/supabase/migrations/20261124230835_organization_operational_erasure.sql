begin;

create table private.organization_operational_erasure_scopes(
 db_role name not null,org_id uuid not null references core.organizations(id),
 primary key(db_role,org_id)
);
create table private.organization_operational_erasures(
 operation_id uuid primary key,request_id uuid not null,org_id uuid not null,
 completed_at timestamptz not null default clock_timestamp(),
 invitation_rows bigint not null check(invitation_rows>=0),
 activity_rows bigint not null check(activity_rows>=0),
 check(invitation_rows+activity_rows between 1 and 100),
 foreign key(org_id,operation_id) references core.operation_receipts(org_id,id),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
create index organization_operational_erasures_request_idx on private.organization_operational_erasures(org_id,request_id);
alter table private.organization_operational_erasure_scopes enable row level security;
alter table private.organization_operational_erasures enable row level security;
revoke all on private.organization_operational_erasure_scopes,private.organization_operational_erasures
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
create trigger organization_operational_erasures_immutable before update or delete on private.organization_operational_erasures
 for each row execute function private.append_only();

-- Keep the delivery/job association used for delivery evidence and replay.
alter table private.invitation_deliveries
 alter column recipient drop not null,alter column sealed_token drop not null,
 add constraint invitation_deliveries_payload_pair check((recipient is null)=(sealed_token is null));

create function private.organization_operational_erasure(target_request uuid,target_org uuid,receipt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare job private.p07_privacy_jobs;remaining bigint;ready bigint;waiting bigint;
 invitations bigint;activities bigint;unresolved boolean;
begin
 perform private.p07_privacy_scope(target_org);
 select * into job from private.p07_privacy_jobs where request_id=target_request and org_id=target_org for update;
 if job.id is null or job.state<>'running' or job.lease_until is null or job.lease_until<=clock_timestamp() then
  perform private.fail('OPERATION_IN_PROGRESS');
 end if;
 perform 1 from core.privacy_requests r
 where r.id=target_request and r.org_id=target_org and r.kind='organization_delete'
  and r.state in ('requested','running','partial') and r.scope->>'org_id'=target_org::text
  and r.scope->'all_data'='true'::jsonb for update;
 if not found then perform private.fail('FORBIDDEN');end if;
 perform 1 from core.organizations where id=target_org and state='deletion_pending' for no key update;
 if not found then perform private.fail('FORBIDDEN');end if;
 perform 1 from private.organization_operational_erasure_scopes
 where db_role=session_user and org_id=target_org for share;
 if not found then return jsonb_build_object('state','unbound');end if;

 lock table core.retention_holds in share mode;
 if job.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if exists(
  select 1 from private.invitation_deliveries d
  join core.invitations i on i.id=d.invitation_id
  join core.outbox_jobs q on q.id=d.job_id
  where (i.org_id=target_org or q.org_id=target_org) and d.recipient is not null
   and (i.org_id<>q.org_id or q.kind<>'account_invitation' or q.dedupe_key is distinct from i.id::text
    or lower(btrim(d.recipient)) is distinct from lower(btrim(i.email)))
 ) then perform private.fail('INTEGRITY_VIOLATION');end if;

 with candidates as materialized (
  select 'invitation'::text surface,i.id,i.center_id,i.person_id,null::uuid lead_id,i.inviter_account_id inviter,q.id outbox_id,
   (i.state='pending' or q.state not in ('succeeded','failed','cancelled') or q.lease_until is not null) in_flight
  from core.invitations i
  join private.invitation_deliveries d on d.invitation_id=i.id
  join core.outbox_jobs q on q.org_id=i.org_id and q.id=d.job_id
  where i.org_id=target_org and d.recipient is not null
  union all
  select 'activity',a.id,a.center_id,coalesce(a.person_id,l.person_id),a.lead_id,null,null,false
  from core.crm_activities a
  left join core.leads l on l.org_id=a.org_id and l.center_id=a.center_id and l.id=a.lead_id
  where a.org_id=target_org and a.kind in ('contact','followup') and a.note is not null
 ), rooted as materialized (
  select c.*,private.p07_person_root(target_org,c.person_id) person_root from candidates c
 ), unheld as materialized (
  select c.* from rooted c
  where c.person_root is not null and not exists(
   select 1 from core.retention_holds h
   where (h.org_id=target_org and (
    (h.subject_table in ('organizations','core.organizations') and h.subject_id=target_org)
    or (h.subject_table in ('centers','core.centers') and h.subject_id=c.center_id)
    or (h.subject_table in ('people','core.people') and private.p07_person_root(target_org,h.subject_id)=c.person_root)
    or (h.subject_table in ('leads','core.leads') and h.subject_id=c.lead_id)
    or (h.subject_table in ('outbox_jobs','core.outbox_jobs') and h.subject_id=c.outbox_id)
    or (h.subject_table in ('invitations','core.invitations','invitation_deliveries','private.invitation_deliveries')
     and c.surface='invitation' and h.subject_id=c.id)
    or (h.subject_table in ('crm_activities','core.crm_activities') and c.surface='activity' and h.subject_id=c.id)
   )) or (h.subject_table in ('accounts','core.accounts') and (
    h.subject_id=c.inviter or exists(
     select 1 from core.account_links l
     where l.org_id=target_org and l.account_id=h.subject_id and private.p07_person_root(target_org,l.person_id)=c.person_root
    )
   ))
  )
 ), batch as materialized (
  select surface,id from unheld where not in_flight order by surface,id limit 100
 ), cleared_deliveries as (
  update private.invitation_deliveries d set recipient=null,sealed_token=null
  from batch b where b.surface='invitation' and d.invitation_id=b.id and d.recipient is not null returning d.invitation_id
 ), cleared_notes as (
  update core.crm_activities a set note=null from batch b
  where b.surface='activity' and a.org_id=target_org and a.id=b.id and a.note is not null
    and (a.kind='contact' or (a.kind='followup' and (a.due_at is null or a.followup_due_at=a.due_at)))
  returning a.id
 )
 select (select count(*) from rooted),(select count(*) from unheld where not in_flight),
  (select count(*) from unheld where in_flight),(select exists(select 1 from rooted where person_root is null)),
  (select count(*) from cleared_deliveries),(select count(*) from cleared_notes)
 into remaining,ready,waiting,unresolved,invitations,activities;
 if unresolved or invitations+activities<>least(ready,100) then perform private.fail('INTEGRITY_VIOLATION');end if;
 if job.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if invitations+activities>0 then
  insert into private.organization_operational_erasures(operation_id,request_id,org_id,invitation_rows,activity_rows)
  values(receipt,target_request,target_org,invitations,activities);
 end if;
 return jsonb_build_object(
  'state',case when ready>invitations+activities or waiting>0 then 'pending'
   when remaining>invitations+activities then 'held' else 'completed' end,
  'invitation_rows',invitations,'activity_rows',activities
 );
end$$;
revoke all on function private.organization_operational_erasure(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_contact_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:='from core.organizations where id=target_org and state=''deletion_pending'' for update';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization contact hold lock anchor mismatch';end if;
 -- A concurrent hold insert needs to finish its foreign key KEY SHARE check.
 execute replace(body,anchor,replace(anchor,'for update','for no key update'));
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 anchor:=' insert into private.p07_privacy_manifests(request_id,scopes)';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization operational erasure manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is not null then
  scopes:=jsonb_set(scopes,'{database,organization_operational}',private.organization_operational_erasure(p.id,org,receipt_id));
 end if;
$a$||anchor);
end$patch$;

commit;
