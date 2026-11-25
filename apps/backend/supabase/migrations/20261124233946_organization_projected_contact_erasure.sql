begin;

create table private.organization_projected_contact_erasure_scopes(
 db_role name not null,org_id uuid not null references core.organizations(id),
 primary key(db_role,org_id)
);
create table private.organization_projected_contact_erasures(
 operation_id uuid primary key,request_id uuid not null,org_id uuid not null,
 completed_at timestamptz not null default clock_timestamp(),
 removed_rows bigint not null check(removed_rows between 1 and 100),
 foreign key(org_id,operation_id) references core.operation_receipts(org_id,id),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
create index organization_projected_contact_erasures_request_idx
 on private.organization_projected_contact_erasures(org_id,request_id);
alter table private.organization_projected_contact_erasure_scopes enable row level security;
alter table private.organization_projected_contact_erasures enable row level security;
revoke all on private.organization_projected_contact_erasure_scopes,private.organization_projected_contact_erasures
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
create trigger organization_projected_contact_erasures_immutable before update or delete on private.organization_projected_contact_erasures
 for each row execute function private.append_only();

create function private.organization_projected_contact_erasure(target_request uuid,target_org uuid,receipt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare job private.p07_privacy_jobs;remaining bigint;ready bigint;removed bigint;
 contacts uuid[];accounts uuid[];account uuid;unresolved boolean;
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
 perform 1 from private.organization_projected_contact_erasure_scopes
 where db_role=session_user and org_id=target_org for share;
 if not found then return jsonb_build_object('state','unbound');end if;

 lock table core.retention_holds in share mode;
 if job.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if exists(
  select 1 from private.account_contact_projections m
  join core.person_contacts c on c.id=m.contact_id
  where c.org_id=target_org and m.org_id<>target_org
 ) then perform private.fail('INTEGRITY_VIOLATION');end if;
 with candidates as materialized (
  select m.*,private.p07_person_root(target_org,m.person_id) person_root,
   c.org_id=target_org and c.person_id=m.person_id and c.kind=m.kind and not c.account_projection_retired
   and exists(
    select 1 from core.account_links l
    where l.org_id=target_org and l.person_id=m.person_id and l.account_id=m.account_id and l.verified_at is not null
   ) valid
  from private.account_contact_projections m
  join core.person_contacts c on c.id=m.contact_id
  where m.org_id=target_org
 ), unheld as materialized (
  select m.* from candidates m
  where m.valid and m.person_root is not null and not exists(
   select 1 from core.retention_holds h
   where (h.subject_table in ('accounts','core.accounts') and h.subject_id=m.account_id)
    or (h.org_id=target_org and (
     (h.subject_table in ('organizations','core.organizations') and h.subject_id=target_org)
     or (h.subject_table in ('person_contacts','core.person_contacts','account_contact_projections','private.account_contact_projections')
      and h.subject_id=m.contact_id)
     or (h.subject_table in ('people','core.people') and private.p07_person_root(target_org,h.subject_id)=m.person_root)
     or (h.subject_table in ('account_links','core.account_links') and exists(
      select 1 from core.account_links l where l.org_id=target_org and l.id=h.subject_id
       and l.account_id=m.account_id and private.p07_person_root(target_org,l.person_id)=m.person_root
     ))
     or (h.subject_table in ('centers','core.centers') and (
      exists(select 1 from core.center_relationships r where r.org_id=target_org and r.center_id=h.subject_id
       and private.p07_person_root(target_org,r.person_id)=m.person_root)
      or exists(select 1 from private.person_origins o where o.org_id=target_org and o.center_id=h.subject_id
       and private.p07_person_root(target_org,o.person_id)=m.person_root)
     ))
    ))
  )
 ), batch as materialized (
  select m.contact_id,m.account_id from unheld u
  join private.account_contact_projections m on m.org_id=target_org and m.contact_id=u.contact_id
   and (m.account_id,m.person_id,m.kind)=(u.account_id,u.person_id,u.kind)
  join core.person_contacts c on c.id=m.contact_id and c.org_id=target_org and c.person_id=m.person_id
   and c.kind=m.kind and not c.account_projection_retired
  order by m.contact_id limit 100 for update of m,c
 )
 select (select count(*) from candidates),(select count(*) from unheld),
  (select exists(select 1 from candidates where not valid or person_root is null)),
  array(select contact_id from batch),array(select distinct account_id from batch order by account_id)
 into remaining,ready,unresolved,contacts,accounts;
 if unresolved then perform private.fail('INTEGRITY_VIOLATION');end if;
 if cardinality(contacts)<>least(ready,100) then perform private.fail('OPERATION_IN_PROGRESS');end if;

 -- Identity synchronization also uses this lock. Never wait on it after row locks.
 foreach account in array accounts loop
  if not pg_try_advisory_xact_lock(hashtextextended('account.identity.'||account,0)) then
   perform private.fail('OPERATION_IN_PROGRESS');
  end if;
 end loop;
 if cardinality(contacts)>0 then
  -- Retire the exact tenant copy and its ownership map together with the proof.
  -- Do not relax the live identity guard or update the shared account.
  delete from private.account_contact_projections where org_id=target_org and contact_id=any(contacts);
  get diagnostics removed=row_count;
  if removed<>cardinality(contacts) then perform private.fail('INTEGRITY_VIOLATION');end if;
  delete from core.person_contacts where org_id=target_org and id=any(contacts);
  get diagnostics removed=row_count;
  if removed<>cardinality(contacts) then perform private.fail('INTEGRITY_VIOLATION');end if;
  insert into private.organization_projected_contact_erasures(operation_id,request_id,org_id,removed_rows)
  values(receipt,target_request,target_org,removed);
 end if;
 if job.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 return jsonb_build_object(
  'state',case when ready>cardinality(contacts) then 'pending'
   when remaining>cardinality(contacts) then 'held' else 'completed' end,
  'removed_rows',cardinality(contacts)
 );
end$$;
revoke all on function private.organization_projected_contact_erasure(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization projected contact manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is not null then
  scopes:=jsonb_set(scopes,'{database,organization_contact_projections}',private.organization_projected_contact_erasure(p.id,org,receipt_id));
 end if;
$a$||anchor);
end$patch$;

commit;
