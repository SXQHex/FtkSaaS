begin;

-- An import job finishing does not itself authorize destruction of its
-- original upload. The operator records a decision for this exact source.
create table private.organization_import_source_erasure_approvals(
 request_id uuid not null,org_id uuid not null,file_id uuid not null,import_job_id uuid not null,
 approval_id uuid not null unique,checksum text not null check(checksum~'^[a-f0-9]{64}$'),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 primary key(request_id,file_id),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
alter table private.organization_import_source_erasure_approvals enable row level security;
revoke all on private.organization_import_source_erasure_approvals
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor,ftk_p06_worker;
create trigger organization_import_source_erasure_approval_immutable
 before update or delete on private.organization_import_source_erasure_approvals
 for each row execute function private.append_only();

create function private.p07_linked_import_source_ready(j private.p07_privacy_jobs,f core.files,u uuid)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare i core.import_jobs;w private.p06_jobs;approval private.organization_import_source_erasure_approvals;
begin
 if j.org_id is distinct from f.org_id or j.org_id is null or f.state<>'ready' or f.expires_at is not null
  or pg_catalog.current_setting('transaction_isolation')<>'read committed' then return false;end if;
 -- The native Storage DELETE rechecks this same snapshot under the locks.
 -- Never wait behind an import that needs the leased source.
 lock table core.retention_holds,core.import_jobs,core.import_rows,core.outbox_jobs,core.previews,core.operation_receipts,
  core.public_applications,core.person_contacts,private.p06_jobs,private.p06_previews,private.p06_sources,private.p06_contexts,
  private.preview_payloads in share mode nowait;
 select * into approval from private.organization_import_source_erasure_approvals a
 where a.request_id=j.request_id and a.org_id=f.org_id and a.file_id=f.id and a.checksum=f.checksum
  and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if approval.approval_id is null then return false;end if;
 select * into i from core.import_jobs where id=approval.import_job_id and org_id=f.org_id
  and center_id=f.center_id and file_id=f.id and requester_account_id=u and file_checksum=f.checksum and state='succeeded';
 if i.id is null or exists(select 1 from core.import_jobs x where x.file_id=f.id and x.id<>i.id) then return false;end if;
 select * into w from private.p06_jobs where job_id=i.id and org_id=i.org_id and center_id=i.center_id
  and account_id=i.requester_account_id and person_id=f.owner_person_id and phase='apply' and operation='import_rows_process_v1'
  and request->>'file_id'=f.id::text and request->>'source_namespace'=i.source_namespace
  and safe_error_code is null and progress_count=total_count and total_count>0
  and result_reference=jsonb_build_object('type','import_jobs','id',i.id);
 if w.job_id is null or not exists(select 1 from core.outbox_jobs o where o.id=i.id and o.org_id=i.org_id
  and o.kind='p06.import' and o.dedupe_key='p06.import:'||i.id::text and o.state='succeeded'
  and o.lease_until is null and o.provider_reference is null)
  or not exists(select 1 from core.previews p where p.id=i.preview_id and p.org_id=i.org_id
   and p.actor_account_id=u and p.operation='import_apply_v1' and p.state='applied')
  or exists(select 1 from core.import_jobs x where x.preview_id=i.preview_id and x.id<>i.id)
  or not exists(select 1 from core.operation_receipts r where r.business_reference=i.id and r.org_id=i.org_id
   and r.operation='import_rows_process_v1' and r.state='succeeded'
   and r.result#>'{data,result_reference}'=w.result_reference and r.result#>>'{data,state}'='succeeded')
 then return false;end if;
 if exists(select 1 from private.p06_previews p where p.preview_id=i.preview_id)
  or exists(select 1 from private.preview_payloads p where p.preview_id=i.preview_id)
  or exists(select 1 from private.p06_contexts c join core.operation_receipts r on r.id=c.receipt_id
   where r.org_id=i.org_id and r.business_reference=i.id and c.operation in ('import_preview_v1','import_apply_v1'))
  or w.total_count<>(select count(*) from core.import_rows r where r.job_id=i.id)
 then return false;end if;
 return not exists(
  select 1 from core.import_rows r
  left join private.p06_sources s on s.org_id=r.org_id and s.center_id=r.center_id
   and s.source_namespace=r.source_namespace and s.source_key=r.source_key
  left join core.operation_receipts op on op.id=s.operation_id and op.org_id=r.org_id
   and op.operation='import_rows_process_v1' and op.state='succeeded'
  where r.job_id=i.id and (
   r.org_id<>i.org_id or r.center_id<>i.center_id or r.source_namespace<>i.source_namespace
   or r.payload<>'{}'::jsonb or r.state<>'applied'
   or op.id is null or s.import_kind<>'students' or s.payload_hash!~'^[a-f0-9]{64}$'
   or s.created_references->0 is distinct from jsonb_build_object('type','people','id',s.person_id)
   or jsonb_path_query_array(s.created_references,'$[*].id') is distinct from to_jsonb(r.created_references)
   or exists(select 1 from core.public_applications a where a.org_id=r.org_id and a.import_row_id=r.id)
  )
 );
end$$;
revoke all on function private.p07_linked_import_source_ready(private.p07_privacy_jobs,core.files,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

create function private.p07_linked_import_source_held(f core.files) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from core.import_jobs i join core.retention_holds h on h.org_id=i.org_id
  where i.org_id=f.org_id and i.file_id=f.id and (
   h.subject_id in (i.id,i.preview_id,i.requester_account_id)
   or exists(select 1 from private.organization_import_source_erasure_approvals a
    where a.org_id=i.org_id and a.import_job_id=i.id and h.subject_id in (a.request_id,a.approval_id))
   or exists(select 1 from core.operation_receipts op
    where op.org_id=i.org_id and op.business_reference=i.id and h.subject_id=op.id)
   or exists(
    select 1 from core.import_rows r
    left join private.p06_sources s on s.org_id=r.org_id and s.center_id=r.center_id
     and s.source_namespace=r.source_namespace and s.source_key=r.source_key
    where r.org_id=i.org_id and r.job_id=i.id and
     (h.subject_id in (r.id,s.operation_id,s.person_id) or h.subject_id=any(r.created_references)
      or exists(select 1 from core.person_contacts c where c.org_id=r.org_id and c.person_id=s.person_id and c.id=h.subject_id))
   )
  )
 )
$$;
revoke all on function private.p07_linked_import_source_held(core.files)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_storage_import_target(private.p07_privacy_jobs,uuid)'::regprocedure);
 anchor:=$q$  or exists(select 1 from core.import_jobs n where n.org_id=f.org_id and n.file_id=f.id)
$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked import storage admission anchor mismatch';end if;
 body:=replace(body,anchor,'');
 anchor:=' return f;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked import source proof anchor mismatch';end if;
 execute replace(body,anchor,$q$ if exists(select 1 from core.import_jobs i where i.file_id=f.id)
  and not private.p07_linked_import_source_ready(j,f,u) then perform private.fail('FORBIDDEN');end if;
$q$||anchor);

 body:=pg_get_functiondef('private.p07_managed_file_held(core.files,uuid)'::regprocedure);
 anchor:=$q$ if f.purpose='import' then return false;end if;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked import source hold anchor mismatch';end if;
 execute replace(body,anchor,$q$ if f.purpose='import' then return private.p07_linked_import_source_held(f);end if;$q$);

 body:=pg_get_functiondef('private.organization_check_untracked_storage_delete(text,text)'::regprocedure);
 anchor:=$q$ perform private.organization_require_erasure_fence(p.id,o.id);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked import source provider guard anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
 if target_bucket='ftksaas-imports' and exists(
  select 1 from core.files f join core.import_jobs i on i.file_id=f.id
  where f.org_id=o.id and f.object_key=target_key and f.purpose='import'
 ) then perform private.fail('FORBIDDEN');end if;$q$);

 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_r2_erasure_bindings'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked import approval census anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_import_source_erasure_approvals' then
   'r.request_id=$6 and r.org_id=$2 and r.file_id=any($9)
    and r.instance_id=(pg_catalog.pg_control_system()).system_identifier::text'
$q$||anchor);
end$patch$;

commit;
