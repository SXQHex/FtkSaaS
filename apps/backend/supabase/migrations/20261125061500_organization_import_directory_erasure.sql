begin;

-- Only completed student jobs with independently witnessed Storage deletion
-- can enter the directory disposition. Imported financial graphs stay intact.
create function private.organization_directory_import_sources(target_request uuid,target_org uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare job_ids uuid[];file_ids uuid[];preview_ids uuid[];unaudited_ops uuid[];hold_ids uuid[];
begin
 select coalesce(array_agg(i.id order by i.id),'{}'),coalesce(array_agg(distinct f.id order by f.id),'{}'),
  coalesce(array_agg(distinct p.id order by p.id),'{}'),
  coalesce(array_agg(distinct account.id),'{}')||coalesce(array_agg(distinct account.auth_user_id),'{}')
 into job_ids,file_ids,preview_ids,hold_ids
 from core.import_jobs i
 join core.files f on f.id=i.file_id and f.org_id=i.org_id and f.center_id=i.center_id
  and f.purpose='import' and f.state='ready' and f.expires_at is null and f.mime='text/csv'
  and f.object_key=i.org_id::text||'/'||f.id::text and f.checksum=i.file_checksum
 join private.p06_files u on u.file_id=f.id and u.account_id=i.requester_account_id and u.filename=f.id::text
 join core.accounts account on account.id=u.account_id
 join private.organization_import_source_erasure_approvals a on a.request_id=target_request
  and a.org_id=i.org_id and a.import_job_id=i.id and a.file_id=f.id and a.checksum=f.checksum
  and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
 join private.p07_storage_erasures e on e.request_id=a.request_id and e.file_id=f.id
  and e.checksum=f.checksum and e.removed_bytes=f.size_bytes
 join private.p07_storage_erasure_intents s on s.file_id=e.file_id and s.request_id=e.request_id
  and s.object_id=e.object_id and s.checksum=e.checksum and s.bytes=e.removed_bytes and s.object_key=f.object_key
  and s.bucket_id='ftksaas-imports' and s.metadata_deleted_at is not null
  and s.linked_import_attestation and s.linked_import_acknowledged_at is not null
 join private.p06_jobs w on w.job_id=i.id and w.org_id=i.org_id and w.center_id=i.center_id
  and w.account_id=u.account_id and w.person_id=f.owner_person_id and w.phase='apply'
  and w.operation='import_rows_process_v1' and w.request->>'file_id'=f.id::text
  and w.request->>'source_namespace'=i.source_namespace and w.request->'mapping'=i.mapping
  and w.safe_error_code is null and w.progress_count=w.total_count and w.total_count>0
  and w.result_reference=jsonb_build_object('type','import_jobs','id',i.id)
 join core.previews p on p.id=i.preview_id and p.org_id=i.org_id and p.actor_account_id=u.account_id
  and p.operation='import_apply_v1' and p.state='applied' and p.scope_hash=md5(w.request::text)
 join core.outbox_jobs o on o.id=i.id and o.org_id=i.org_id and o.kind='p06.import'
  and o.dedupe_key='p06.import:'||i.id::text and o.state='succeeded'
  and o.lease_until is null and o.provider_reference is null
 where i.org_id=target_org and i.state='succeeded' and coalesce(i.mapping->>'kind','students')='students'
  and not exists(select 1 from storage.objects x where x.id=e.object_id or (x.bucket_id=s.bucket_id and x.name=s.object_key))
  and not exists(select 1 from private.preview_payloads x where x.preview_id=p.id)
  and not exists(select 1 from private.p06_previews x where x.preview_id=p.id)
  and w.total_count=(select count(*) from core.import_rows x where x.job_id=i.id)
  and exists(select 1 from core.operation_receipts x join core.audit_events event
   on event.org_id=x.org_id and event.operation_id=x.id and event.action=x.operation
   where x.org_id=i.org_id and x.business_reference=i.id and x.operation='import_rows_process_v1'
    and event.subject_table='import_jobs' and event.subject_id=i.id
    and event.actor_account_id=w.account_id and event.actor_person_id=w.person_id
    and event.diff=jsonb_build_object('progress_count',w.total_count,'total_count',w.total_count,'phase','apply')
    and ((x.state='succeeded' and x.result#>'{data,result_reference}'=w.result_reference
      and x.result#>>'{data,state}'='succeeded') or (x.state='result_expired' and x.result is null)));

 if cardinality(job_ids)<>cardinality(file_ids) or cardinality(job_ids)<>cardinality(preview_ids)
  or exists(select 1 from core.import_jobs i where i.org_id=target_org and not i.id=any(job_ids))
  or exists(select 1 from private.p06_jobs w where w.org_id=target_org and not w.job_id=any(job_ids)
   and (w.operation='import_rows_process_v1' or cardinality(job_ids)>0))
  or (cardinality(job_ids)>0 and exists(select 1 from core.report_jobs r where r.org_id=target_org))
  or exists(select 1 from core.import_rows r left join core.import_jobs i on i.id=r.job_id
    where (r.org_id=target_org or r.job_id=any(job_ids)) and (
      not r.job_id=any(job_ids) or r.org_id is distinct from i.org_id or r.center_id is distinct from i.center_id
      or r.source_namespace is distinct from i.source_namespace or r.payload<>'{}'::jsonb
      or exists(select 1 from core.public_applications x where x.import_row_id=r.id)
      or case r.state
       when 'applied' then not exists(select 1 from private.p06_sources s
        where s.org_id=r.org_id and s.center_id=r.center_id and s.source_namespace=r.source_namespace
         and s.source_key=r.source_key and s.import_kind='students'
         and jsonb_path_query_array(s.created_references,'$[*].id')=to_jsonb(r.created_references))
       when 'invalid' then cardinality(r.created_references)<>0 or not exists(
        select 1 from private.organization_import_rejected_row_evidence e where e.request_id=target_request
        and e.org_id=r.org_id and e.import_job_id=i.id and e.file_id=i.file_id and e.file_checksum=i.file_checksum
        and e.import_row_id=r.id and e.row_version=r.version and e.row_state=r.state)
       when 'failed' then cardinality(r.created_references)<>0 or not exists(
        select 1 from private.organization_import_rejected_row_evidence e where e.request_id=target_request
        and e.org_id=r.org_id and e.import_job_id=i.id and e.file_id=i.file_id and e.file_checksum=i.file_checksum
        and e.import_row_id=r.id and e.row_version=r.version and e.row_state=r.state)
       else true end))
  or exists(select 1 from private.p06_sources s where s.org_id=target_org and (
   s.import_kind<>'students' or jsonb_typeof(s.created_references)<>'array'
   or s.created_references->0 is distinct from jsonb_build_object('type','people','id',s.person_id)
   or jsonb_array_length(s.created_references)>2
   or (jsonb_array_length(s.created_references)=2 and not exists(select 1 from core.center_relationships r
     where r.org_id=s.org_id and r.center_id=s.center_id and r.person_id=s.person_id
      and r.kind='student' and s.created_references->1=jsonb_build_object('type','center_relationships','id',r.id)))
   or not exists(select 1 from core.import_rows r join core.operation_receipts x
     on x.id=s.operation_id and x.org_id=s.org_id and x.business_reference=r.job_id
     and x.operation='import_rows_process_v1' and x.state in ('succeeded','result_expired')
     where r.job_id=any(job_ids) and r.org_id=s.org_id and r.center_id=s.center_id
      and r.source_namespace=s.source_namespace and r.source_key=s.source_key and r.state='applied')))
 then return jsonb_build_object('state','blocked','reason','unproved_import_history');end if;

 if exists(select 1 from core.retention_holds h where h.subject_id=any(hold_ids||job_ids||file_ids||preview_ids))
 then return jsonb_build_object('state','held');end if;

 select coalesce(array_agg(r.id order by r.id),'{}') into unaudited_ops
 from core.operation_receipts r join core.import_jobs i on i.id=r.business_reference and i.org_id=r.org_id
 where i.org_id=target_org and i.id=any(job_ids) and r.operation='import_preview_v1'
  and r.actor_account_id=i.requester_account_id and r.state in ('succeeded','result_expired')
  and (r.result->'data'=jsonb_build_object('job_id',i.id,'state','pending') or (r.state='result_expired' and r.result is null))
  and not exists(select 1 from core.audit_events x where x.operation_id=r.id)
  and not exists(select 1 from core.outbox_jobs x where x.org_id=r.org_id and x.dedupe_key=r.id::text);
 return jsonb_build_object('state','ready','jobs',job_ids,'files',file_ids,'previews',preview_ids,'unaudited_ops',unaudited_ops);
end$$;
revoke all on function private.organization_directory_import_sources(uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_directory_operation_subject(text)'::regprocedure);
 anchor:=$q$  when 'file_upload_complete_v1' then 'files'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory operations anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
  when 'import_upload_prepare_v1' then 'files'
  when 'import_apply_v1' then 'import_jobs'
  when 'import_rows_process_v1' then 'import_jobs'$q$);

 body:=pg_get_functiondef('private.organization_directory_archive_source(uuid,uuid)'::regprocedure);
 anchor:=$q$ selected jsonb;fingerprint text;scope jsonb;counts jsonb;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory declarations anchor mismatch';end if;
 body:=replace(body,anchor,anchor||$q$
 import_src jsonb;import_jobs uuid[];import_files uuid[];import_previews uuid[];import_unaudited uuid[];$q$);
 anchor:=$q$ sale_subjects:=coalesce$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory source anchor mismatch';end if;
 body:=replace(body,anchor,$q$ import_src:=private.organization_directory_import_sources(target_request,target_org);
 if import_src->>'state'<>'ready' then return import_src;end if;
 import_jobs:=array(select x::uuid from jsonb_array_elements_text(import_src->'jobs') x);
 import_files:=array(select x::uuid from jsonb_array_elements_text(import_src->'files') x);
 import_previews:=array(select x::uuid from jsonb_array_elements_text(import_src->'previews') x);
 import_unaudited:=array(select x::uuid from jsonb_array_elements_text(import_src->'unaudited_ops') x);
$q$||anchor);
 anchor:=$q$ if cardinality(events)<>cardinality(ops) or exists($q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory audit count anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if cardinality(events)<>cardinality(ops)-cardinality(import_unaudited) or exists($q$);
 anchor:=$q$  where r.id=any(ops) and ($q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory audit validation anchor mismatch';end if;
 body:=replace(body,anchor,$q$  where r.id=any(ops) and not r.id=any(import_unaudited) and ($q$);
 anchor:=$q$     when 'files' then not e.subject_id=any(document_subjects)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory audit subjects anchor mismatch';end if;
 body:=replace(body,anchor,$q$     when 'files' then not (e.subject_id=any(document_subjects) or (
      e.subject_id=any(import_files) and r.operation in ('import_upload_prepare_v1','file_upload_complete_v1')))
     when 'import_jobs' then not e.subject_id=any(import_jobs)$q$);
 anchor:=$q$ if exists(select 1 from core.outbox_jobs q where q.org_id=target_org and not q.id=any(job_ids)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory queue anchor mismatch';end if;
 body:=replace(body,anchor,anchor||$q$
  and not q.id=any(import_jobs)$q$);
 anchor:=$q$  union all select 'jobs',q.id::text,to_jsonb(q) from core.outbox_jobs q where q.id=any(job_ids)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory fingerprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  union all select 'jobs',q.id::text,to_jsonb(q) from core.outbox_jobs q where q.id=any(job_ids||import_jobs)
  union all select 'import_jobs',i.id::text,to_jsonb(i) from core.import_jobs i where i.id=any(import_jobs)
  union all select 'import_rows',r.id::text,to_jsonb(r) from core.import_rows r where r.job_id=any(import_jobs)
  union all select 'import_workers',w.job_id::text,to_jsonb(w) from private.p06_jobs w where w.job_id=any(import_jobs)
  union all select 'import_previews',p.id::text,to_jsonb(p) from core.previews p where p.id=any(import_previews)
  union all select 'import_files',f.id::text,to_jsonb(f) from core.files f where f.id=any(import_files)
  union all select 'import_upload_owners',u.file_id::text,to_jsonb(u) from private.p06_files u where u.file_id=any(import_files)
  union all select 'import_sources',target_org::text,jsonb_agg(to_jsonb(s) order by s.source_namespace,s.source_key)
   from private.p06_sources s where s.org_id=target_org having count(*)>0
  union all select 'import_config',c.org_id::text,to_jsonb(c) from private.p06_configuration c
   where c.org_id=target_org and cardinality(import_jobs)>0
  union all select 'import_worker_scopes',s.db_role::text,to_jsonb(s) from private.p06_worker_scopes s
   where s.org_id=target_org and cardinality(import_jobs)>0$q$);

 body:=pg_get_functiondef('private.organization_directory_erasure_stage(jsonb,text,text)'::regprocedure);
 anchor:=$q$   lock table core.account_links,core.audit_events$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory locks anchor mismatch';end if;
 body:=replace(body,anchor,$q$   lock table storage.objects,private.p07_storage_erasures,private.p07_storage_erasure_intents,
    private.organization_import_source_erasure_approvals,private.organization_import_rejected_row_evidence,
    core.public_applications,private.p06_previews,private.preview_payloads,core.report_jobs in share mode nowait;
   lock table core.import_jobs,core.import_rows,core.previews,core.files,private.p06_files,private.p06_jobs,
    private.p06_sources,private.p06_configuration,private.p06_worker_scopes in share row exclusive mode nowait;
$q$||anchor);
 anchor:=$q$'uploads','subscriber_numbers','subscriber_counter'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory receipt subjects anchor mismatch';end if;
 body:=replace(body,anchor,anchor||$q$,'import_sources','import_config','import_worker_scopes'$q$);
 anchor:=$q$ delete from core.outbox_jobs where org_id=j.org_id and (selection->'jobs')?id::text;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory physical erasure anchor mismatch';end if;
 body:=replace(body,anchor,$q$ delete from private.p06_sources where org_id=j.org_id and (selection->'import_sources')?j.org_id::text;
 delete from core.import_rows where org_id=j.org_id and (selection->'import_rows')?id::text;
 delete from core.import_jobs where org_id=j.org_id and (selection->'import_jobs')?id::text;
 delete from core.previews where org_id=j.org_id and (selection->'import_previews')?id::text;
 delete from private.p06_jobs where org_id=j.org_id and (selection->'import_workers')?job_id::text;
 delete from private.p06_configuration where org_id=j.org_id and (selection->'import_config')?org_id::text;
 delete from private.p06_worker_scopes where org_id=j.org_id and (selection->'import_worker_scopes')?db_role::text;
 delete from private.p06_files using core.files f where p06_files.file_id=f.id and f.org_id=j.org_id
  and (selection->'import_upload_owners')?f.id::text;
 update core.files set center_id=null,owner_person_id=null,version=version+1 where org_id=j.org_id
  and (selection->'import_files')?id::text;
$q$||anchor);
 anchor:=$q$ if exists(select 1 from core.outbox_jobs where id=any(erased_ids))$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory absence anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
  or exists(select 1 from core.import_rows where org_id=j.org_id)
  or exists(select 1 from core.import_jobs where org_id=j.org_id)
  or exists(select 1 from core.previews where id=any(erased_ids))
  or exists(select 1 from private.p06_sources where org_id=j.org_id)
  or exists(select 1 from private.p06_jobs where org_id=j.org_id and operation='import_rows_process_v1')
  or (selection?'import_jobs' and (exists(select 1 from private.p06_configuration where org_id=j.org_id)
      or exists(select 1 from private.p06_worker_scopes where org_id=j.org_id)))
  or exists(select 1 from private.p06_files where (selection->'import_files')?file_id::text)
  or exists(select 1 from core.files where (selection->'import_files')?id::text
      and (center_id is not null or owner_person_id is not null))$q$);

 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_import_rejected_row_evidence'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory census anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_import_copy_erasure_scopes' then
   'r.request_id=$6 and r.db_role=session_user and r.instance_id=(pg_catalog.pg_control_system()).system_identifier::text'
  when 'private.organization_import_copy_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.operation_id=any($8)'
$q$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$    select 1 from private.p06_files s where s.file_id=f.id and s.account_id=p.requester_account_id and s.filename=s.file_id::text
   ))) order by f.id$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import directory retained file receipt anchor mismatch';end if;
 execute replace(body,anchor,$q$    select 1 from private.p06_files s where s.file_id=f.id and s.account_id=p.requester_account_id and s.filename=s.file_id::text
   )) or (f.purpose='import' and f.center_id is null and f.owner_person_id is null and exists(
    select 1 from private.organization_directory_erasures a where a.request_id=target_request and a.org_id=target_org
     and a.completed_at is not null and f.id=any(a.erased_subject_ids)
   ))) order by f.id$q$);
end$patch$;

commit;
