begin;

create table private.organization_contact_erasure_scopes(
 db_role name not null,
 org_id uuid not null references core.organizations(id),
 primary key(db_role,org_id)
);
create table private.organization_contact_erasures(
 operation_id uuid primary key,
 request_id uuid not null,
 org_id uuid not null,
 completed_at timestamptz not null default clock_timestamp(),
 removed_rows bigint not null check(removed_rows between 1 and 100),
 foreign key(org_id,operation_id) references core.operation_receipts(org_id,id),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
create index organization_contact_erasures_request_idx on private.organization_contact_erasures(org_id,request_id);
alter table private.organization_contact_erasure_scopes enable row level security;
alter table private.organization_contact_erasures enable row level security;
revoke all on private.organization_contact_erasure_scopes,private.organization_contact_erasures
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
create trigger organization_contact_erasures_immutable before update or delete on private.organization_contact_erasures
 for each row execute function private.append_only();

create function private.organization_contact_erasure(target_request uuid,target_org uuid,receipt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare job private.p07_privacy_jobs;remaining bigint;ready bigint;removed bigint;
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
 perform 1 from core.organizations where id=target_org and state='deletion_pending' for update;
 if not found then perform private.fail('FORBIDDEN');end if;
 perform 1 from private.organization_contact_erasure_scopes
 where db_role=session_user and org_id=target_org for share;
 if not found then return jsonb_build_object('state','unbound');end if;

 lock table core.retention_holds in share mode;
 if job.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 -- Linked, projected and merged identities can still serve other data or evidence.
 with independent as materialized (
  select c.id,c.person_id
  from core.person_contacts c
  join core.people p on p.org_id=c.org_id and p.id=c.person_id
  where c.org_id=target_org and c.kind in ('email','phone') and not c.account_projection_retired
   and p.state='active' and p.merged_into_id is null
   and not exists(select 1 from core.people alias where alias.org_id=target_org and alias.merged_into_id=p.id)
   and not exists(select 1 from core.account_links l where l.org_id=target_org and l.person_id=p.id)
   and not exists(select 1 from private.account_contact_projections ap where ap.contact_id=c.id)
 ), unheld as materialized (
  select c.id from independent c
  where not exists (
   select 1 from core.retention_holds h
   where h.org_id=target_org and (
    (h.subject_table in ('organizations','core.organizations') and h.subject_id=target_org)
    or (h.subject_table in ('person_contacts','core.person_contacts') and h.subject_id=c.id)
    or (h.subject_table in ('people','core.people') and h.subject_id=c.person_id)
    or (h.subject_table in ('centers','core.centers') and exists(
     select 1 from core.center_relationships rel
     where rel.org_id=target_org and rel.person_id=c.person_id and rel.center_id=h.subject_id
    ))
   )
  )
 ), batch as (
  select id from unheld order by id limit 100
 ), deleted as (
  delete from core.person_contacts c using batch b where c.org_id=target_org and c.id=b.id returning c.id
 )
 select (select count(*) from independent),(select count(*) from unheld),count(*)
 into remaining,ready,removed from deleted;
 if removed<>least(ready,100) then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if job.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if removed>0 then
  insert into private.organization_contact_erasures(operation_id,request_id,org_id,removed_rows)
  values(receipt,target_request,target_org,removed);
 end if;
 return jsonb_build_object('state',case when ready>removed then 'pending' when remaining>removed then 'held' else 'completed' end,
  'pass_rows',removed);
end$$;
revoke all on function private.organization_contact_erasure(uuid,uuid,uuid) from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization contact erasure manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is not null then
  scopes:=jsonb_set(scopes,'{database,organization_contacts}',private.organization_contact_erasure(p.id,org,receipt_id));
 end if;
$a$||anchor);
end$patch$;

commit;
