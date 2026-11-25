begin;

-- A failed row may still name an existing person or product. Bind those
-- references to this request before the live row payload is scrubbed.
create table private.organization_import_rejected_row_evidence(
 request_id uuid not null,org_id uuid not null,import_job_id uuid not null,
 file_id uuid not null,import_row_id uuid not null,
 file_checksum text not null check(file_checksum~'^[a-f0-9]{64}$'),
 row_version bigint not null check(row_version>0),
 row_state text not null check(row_state in ('invalid','failed')),
 person_reference_sha256 text check(person_reference_sha256~'^[a-f0-9]{64}$'),
 product_reference_sha256 text check(product_reference_sha256~'^[a-f0-9]{64}$'),
 primary key(request_id,import_row_id),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id)
);
create index organization_import_rejected_evidence_file
 on private.organization_import_rejected_row_evidence(org_id,import_job_id,file_id);
alter table private.organization_import_rejected_row_evidence enable row level security;
revoke all on private.organization_import_rejected_row_evidence
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_import_rejected_evidence_immutable
 before update or delete on private.organization_import_rejected_row_evidence
 for each row execute function private.append_only();

create function private.organization_import_reference_hash(target_request uuid,raw_reference text) returns text
 language sql immutable strict security invoker set search_path='' as $$
 select case when raw_reference~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  then encode(extensions.digest(target_request::text||':'||lower(raw_reference),'sha256'),'hex') end
$$;

create function private.capture_organization_import_rejected_evidence(target_request uuid,target_org uuid,target_row uuid)
 returns boolean language sql security invoker set search_path='' as $$
 with recorded as (
  insert into private.organization_import_rejected_row_evidence(
   request_id,org_id,import_job_id,file_id,import_row_id,file_checksum,row_version,row_state,
   person_reference_sha256,product_reference_sha256
  )
  select target_request,r.org_id,i.id,i.file_id,r.id,i.file_checksum,
   case when r.payload='{}'::jsonb then r.version else r.version+1 end,r.state,
   private.organization_import_reference_hash(target_request,r.payload->>'person_ref'),
   private.organization_import_reference_hash(target_request,r.payload->>'product_version_ref')
  from core.import_rows r join core.import_jobs i on i.id=r.job_id and i.org_id=r.org_id and i.center_id=r.center_id
  where r.id=target_row and r.org_id=target_org and r.state in ('invalid','failed') and cardinality(r.created_references)=0
   and i.source_namespace=r.source_namespace and coalesce(i.mapping->>'kind','students')='students'
   and (r.payload<>'{}'::jsonb or (r.state='invalid' and r.version=1))
  for update of r
  returning import_row_id
 )
 select exists(select 1 from recorded)
$$;
revoke all on function private.organization_import_reference_hash(uuid,text),
 private.capture_organization_import_rejected_evidence(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p06_import_copy_candidates(uuid)'::regprocedure);
 anchor:=$q$private.p06_import_copy_candidates(target_org uuid)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import copy request argument anchor mismatch';end if;
 body:=replace(body,anchor,'private.p06_import_copy_candidates(target_org uuid, target_request uuid)');
 anchor:=$q$x.payload<>'{}'::jsonb has_payload,$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Pristine invalid import row anchor mismatch';end if;
 body:=replace(body,anchor,$q$x.payload<>'{}'::jsonb has_payload,
   (x.payload='{}'::jsonb and x.state='invalid' and x.version=1
    and cardinality(x.created_references)=0
    and exists(select 1 from core.import_jobs i where i.id=x.job_id and i.org_id=x.org_id
      and i.source_namespace=x.source_namespace and coalesce(i.mapping->>'kind','students')='students')
    and not exists(select 1 from private.organization_import_rejected_row_evidence e where e.request_id=target_request
      and e.import_row_id=x.id)) pristine_invalid,$q$);
 anchor:=$q$ select 'row',x.id,x.hold_row,x.unproved from staged_rows x where x.has_payload$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import evidence-only row anchor mismatch';end if;
 body:=replace(body,anchor,anchor||$q$
 union all
 select 'row_evidence',x.id,x.hold_row,x.unproved from staged_rows x where x.pristine_invalid$q$);
 anchor:=$q$    or (h.subject_table in ('people','core.people') and h.subject_id::text=x.payload->>'person_ref')$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import row raw hold anchor mismatch';end if;
 execute replace(body,anchor,$q$    or h.subject_id::text in (lower(x.payload->>'person_ref'),lower(x.payload->>'product_version_ref'))
    or exists(select 1 from core.person_contacts c where c.id=h.subject_id and c.org_id=x.org_id
     and c.person_id::text=lower(x.payload->>'person_ref'))$q$);

 body:=pg_get_functiondef('private.organization_import_copy_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:='private.p06_import_copy_candidates(target_org)';
 if array_length(string_to_array(body,anchor),1)<>3 then raise exception 'Import copy request call anchor mismatch';end if;
 body:=replace(body,anchor,'private.p06_import_copy_candidates(target_org,target_request)');
 anchor:=$q$   when 'row' then
    update core.import_rows$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import row capture anchor mismatch';end if;
 execute replace(body,anchor,$q$   when 'row' then
    perform private.capture_organization_import_rejected_evidence(target_request,target_org,item.copy_id);
    update core.import_rows$q$);
 body:=pg_get_functiondef('private.organization_import_copy_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$   when 'preview' then$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import rejected evidence receipt anchor mismatch';end if;
 execute replace(body,anchor,$q$   when 'row_evidence' then
    if not private.capture_organization_import_rejected_evidence(target_request,target_org,item.copy_id)
     then perform private.fail('INTEGRITY_VIOLATION');end if;
    n:=1;
$q$||anchor);
 execute 'drop function private.p06_import_copy_candidates(uuid)';
 execute 'revoke all on function private.p06_import_copy_candidates(uuid,uuid) from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker';

 body:=pg_get_functiondef('private.p07_linked_import_source_ready(private.p07_privacy_jobs,core.files,uuid)'::regprocedure);
 anchor:=$q$   and op.operation='import_rows_process_v1' and op.state='succeeded'
  where r.job_id=i.id and ($q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import row readiness evidence anchor mismatch';end if;
 body:=replace(body,anchor,$q$   and op.operation='import_rows_process_v1' and op.state='succeeded'
  left join private.organization_import_rejected_row_evidence w0 on w0.request_id=j.request_id
   and w0.org_id=i.org_id and w0.import_job_id=i.id and w0.file_id=f.id and w0.file_checksum=f.checksum
   and w0.import_row_id=r.id and w0.row_version=r.version and w0.row_state=r.state
  where r.job_id=i.id and ($q$);
 anchor:=$q$   or r.payload<>'{}'::jsonb or r.state<>'applied'
   or op.id is null or s.import_kind<>'students' or s.payload_hash!~'^[a-f0-9]{64}$'
   or s.created_references->0 is distinct from jsonb_build_object('type','people','id',s.person_id)
   or jsonb_path_query_array(s.created_references,'$[*].id') is distinct from to_jsonb(r.created_references)$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import row readiness state anchor mismatch';end if;
 execute replace(body,anchor,$q$   or r.payload<>'{}'::jsonb or case r.state
    when 'applied' then op.id is null or s.import_kind<>'students' or s.payload_hash!~'^[a-f0-9]{64}$'
     or s.created_references->0 is distinct from jsonb_build_object('type','people','id',s.person_id)
     or jsonb_path_query_array(s.created_references,'$[*].id') is distinct from to_jsonb(r.created_references)
    when 'invalid' then w0.import_row_id is null or cardinality(r.created_references)<>0
    when 'failed' then w0.import_row_id is null or cardinality(r.created_references)<>0
    else true
   end$q$);

 body:=pg_get_functiondef('private.p07_linked_import_source_held(core.files)'::regprocedure);
 anchor:=$q$   or exists(select 1 from core.operation_receipts op$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import rejected row hold anchor mismatch';end if;
 execute replace(body,anchor,$q$   or (h.subject_table in ('person_contacts','core.person_contacts') and not exists(
    select 1 from core.person_contacts c where c.org_id=i.org_id and c.id=h.subject_id))
   or exists(select 1 from private.organization_import_rejected_row_evidence e
    where e.org_id=i.org_id and e.import_job_id=i.id and e.file_id=f.id and e.file_checksum=f.checksum
     and (private.organization_import_reference_hash(e.request_id,h.subject_id::text)
       in (e.person_reference_sha256,e.product_reference_sha256)
      or exists(select 1 from core.person_contacts c where c.org_id=i.org_id and c.id=h.subject_id
       and private.organization_import_reference_hash(e.request_id,c.person_id::text)=e.person_reference_sha256)))
$q$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_import_source_erasure_approvals'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Import rejected row census anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_import_rejected_row_evidence' then
   'r.request_id=$6 and r.org_id=$2 and r.file_id=any($9)'
$q$||anchor);
end$patch$;

commit;
