begin;

create or replace function private.p07_storage_import_target(j private.p07_privacy_jobs,target uuid) returns core.files
 language plpgsql security invoker set search_path='' as $$
declare p core.privacy_requests;f core.files;u uuid;
begin
 select * into p from core.privacy_requests where id=j.request_id and org_id is not distinct from j.org_id for share;
 select x.* into f from core.files x join private.p06_files s on s.file_id=x.id where x.id=target for share of x,s;
 select account_id into u from private.p06_files where file_id=f.id;
 if p.id is null or p.state not in ('requested','running','partial') or f.id is null or u is null
  or f.purpose<>'import' or f.object_key is distinct from (f.org_id::text||'/'||f.id::text)
  or f.mime<>'text/csv' or f.checksum is null or f.checksum !~ '^[a-f0-9]{64}$' or f.size_bytes not between 1 and 2097152
  or exists(select 1 from core.import_jobs n where n.org_id=f.org_id and n.file_id=f.id)
  or exists(select 1 from core.report_jobs n where n.org_id=f.org_id and n.file_id=f.id)
  or exists(select 1 from private.p06_export_files n where n.file_id=f.id)
  or exists(select 1 from core.document_versions n where n.org_id=f.org_id and n.file_id=f.id)
  or exists(select 1 from private.p05_files n where n.file_id=f.id)
  or exists(select 1 from private.digital_document_contents n where n.file_id=f.id) then perform private.fail('FORBIDDEN');end if;
 if f.state='pending_upload' then
  if f.expires_at is null or f.expires_at>clock_timestamp() then perform private.fail('FORBIDDEN');end if;
 elsif f.state<>'ready' or f.expires_at is not null or j.org_id is null or p.scope->'all_data' is distinct from 'true'::jsonb then
  perform private.fail('FORBIDDEN');
 end if;
 if j.org_id is null then
  if p.kind<>'account_delete' or p.scope->>'account_id' is distinct from u::text or p.requester_account_id<>u
   or not exists(select 1 from core.accounts a where a.id=u and a.state='deletion_pending' for share) then perform private.fail('FORBIDDEN');end if;
 elsif p.kind<>'organization_delete' or p.scope->>'org_id' is distinct from f.org_id::text or f.org_id<>j.org_id
  or not exists(select 1 from core.organizations o where o.id=j.org_id and o.state='deletion_pending' for share) then perform private.fail('FORBIDDEN');
 end if;
 return f;
end$$;

create or replace function private.p07_storage_import_held(f core.files,object_id uuid) returns boolean
 language plpgsql security invoker set search_path='' as $$
begin
 lock table core.retention_holds in share mode;
 return exists(
  select 1 from core.retention_holds h
  where (h.subject_table in ('accounts','core.accounts') and h.subject_id=(select s.account_id from private.p06_files s where s.file_id=f.id))
   or (h.org_id=f.org_id and (
    (h.subject_table in ('organizations','core.organizations') and h.subject_id=f.org_id)
    or (h.subject_table in ('files','core.files','p06_files','private.p06_files') and h.subject_id=f.id)
    or (h.subject_table in ('objects','storage.objects') and h.subject_id=object_id)
    or (h.subject_table in ('people','core.people') and h.subject_id=f.owner_person_id)
    or (h.subject_table in ('centers','core.centers') and h.subject_id=f.center_id)
   ))
 );
end$$;

-- Preserve existing account and expiry receipts. The same validator proves
-- report/job/file ownership and the bytes before each organization purge.
alter table private.p06_export_purges
 drop constraint p06_export_purges_reason_check,
 drop constraint p06_export_purges_check,
 add constraint p06_export_purges_reason_check check(reason in ('expired','account_delete','organization_delete')),
 add constraint p06_export_purges_request_check check((reason<>'expired')=(request_id is not null));
create index p06_export_purges_request on private.p06_export_purges(request_id) where request_id is not null;

create table private.organization_export_erasure_scopes(
 db_role name not null,request_id uuid not null references core.privacy_requests(id),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 primary key(db_role,request_id)
);
alter table private.organization_export_erasure_scopes enable row level security;
revoke all on private.organization_export_erasure_scopes from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

create function private.p06_organization_export_candidates(target_org uuid) returns setof uuid
 language sql stable security invoker set search_path='' as $$
 select x.file_id from core.files f join private.p06_export_files x on x.file_id=f.id where f.org_id=target_org
 union
 select x.file_id from core.report_jobs r join private.p06_export_files x on x.job_id=r.id where r.org_id=target_org
 union
 select x.file_id from private.p06_jobs j join private.p06_export_files x on x.job_id=j.job_id where j.org_id=target_org
 union
 select x.file_id from core.report_jobs r join private.p06_export_files x on x.file_id=r.file_id where r.org_id=target_org
$$;

create function private.organization_export_erasure(target_request uuid,target_org uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare lease timestamptz;fid uuid;info jsonb;remaining boolean;eligible boolean;
begin
 perform private.p07_privacy_scope(target_org);
 perform 1 from private.organization_export_erasure_scopes s where s.db_role=session_user and s.request_id=target_request
  and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if not found then return jsonb_build_object('state','unbound');end if;
 select j.lease_until into lease from private.p07_privacy_jobs j
 where j.request_id=target_request and j.org_id=target_org and j.state='running' for update;
 if lease is null or lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 perform 1 from core.privacy_requests p where p.id=target_request and p.org_id=target_org and p.kind='organization_delete'
  and p.state in ('requested','running','partial') and p.scope->>'org_id'=target_org::text and p.scope->'all_data'='true'::jsonb for share;
 if not found then perform private.fail('FORBIDDEN');end if;
 perform 1 from core.organizations where id=target_org and state='deletion_pending' for no key update;
 if not found then perform private.fail('FORBIDDEN');end if;
 lock table core.retention_holds in share mode;

 -- Check a candidate even when another tenant's broken ownership edge points
 -- here. An ambiguous candidate rolls back the batch instead of crossing scope.
 for fid in select id from private.p06_organization_export_candidates(target_org) c(id)
  where not private.p06_export_held(id) order by id limit 100 loop
  if lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
  info:=private.p06_export_manifest(fid);
  if info->>'org_id' is distinct from target_org::text then perform private.fail('INTEGRITY_VIOLATION');end if;
  perform private.p06_export_purge(fid,'organization_delete',target_request);
 end loop;
 select count(*)>0,coalesce(bool_or(not private.p06_export_held(id)),false) into remaining,eligible
 from private.p06_organization_export_candidates(target_org) c(id);
 if lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 return (
  select jsonb_build_object('state',case when eligible then 'retry_wait' when remaining then 'held' else 'completed' end,
   'removed_rows',count(*),'removed_bytes',coalesce(sum(removed_bytes),0))
  from private.p06_export_purges where request_id=target_request and reason='organization_delete'
 );
end$$;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization export manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is not null then
  scopes:=jsonb_set(scopes,'{exports,organization_database_exports}',private.organization_export_erasure(p.id,org));
 end if;
$a$||anchor);
end$patch$;
revoke all on function private.p06_organization_export_candidates(uuid),private.organization_export_erasure(uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

commit;
