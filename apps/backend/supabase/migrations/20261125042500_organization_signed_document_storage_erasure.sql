begin;

alter table private.organization_signed_document_erasures add column provider_origin text
 check(provider_origin~'^https://[a-z]{20}\.supabase\.co$' or provider_origin~'^http://(127\.0\.0\.1|localhost):[0-9]+$');

create table private.organization_signed_document_objects(
 file_id uuid primary key,request_id uuid not null,org_id uuid not null,
 object_id uuid not null unique,object_key text not null unique,descriptor jsonb not null,
 authorized_lease_hash text not null check(authorized_lease_hash~'^[a-f0-9]{64}$'),
 metadata_deleted_at timestamptz,provider_deleted_at timestamptz,
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 check(object_key=org_id::text||'/'||file_id::text),
 check(provider_deleted_at is null or (metadata_deleted_at is not null and provider_deleted_at>=metadata_deleted_at))
);
alter table private.organization_signed_document_objects enable row level security;
revoke all on private.organization_signed_document_objects from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_signed_document_objects_immutable before update or delete on private.organization_signed_document_objects
 for each row when(old.provider_deleted_at is not null) execute function private.append_only();

create or replace function private.organization_signed_document_archive_source(target_request uuid,target_org uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare policy_request core.privacy_requests;scope jsonb;selection jsonb;fingerprint text;
 version_ids uuid[];file_ids uuid[];document_ids uuid[];requirement_ids uuid[];
 acceptance_ids uuid[];render_ids uuid[];template_ids uuid[];hold_ids uuid[];
 stored_files jsonb;stored_ids uuid[];
begin
 select * into policy_request from core.privacy_requests p where p.id=target_request and p.org_id=target_org
  and p.kind='organization_delete' and p.state in ('requested','running','partial')
  and p.scope=jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true);
 if policy_request.id is null or not exists(select 1 from core.organizations where id=target_org and state='deletion_pending')
 then perform private.fail('FORBIDDEN');end if;

 with sources as (
  select v.id,v.file_id,v.document_id from core.document_versions v
  where v.org_id=target_org
 )
 select array(select s.id from sources s order by s.id),
  array(select distinct s.file_id from sources s order by s.file_id),
  array(select distinct s.document_id from sources s order by s.document_id)
 into version_ids,file_ids,document_ids;
 if cardinality(version_ids)=0 then return jsonb_build_object('state','blocked','reason','signed_document_source_missing');end if;
 if exists(select 1 from core.files f where f.id=any(file_ids) and (
    f.org_id<>target_org or f.purpose<>'document' or f.state<>'ready' or f.expires_at is not null
    or f.object_key<>target_org::text||'/'||f.id::text
    or f.checksum is null or f.checksum!~'^[a-f0-9]{64}$'
    or not exists(select 1 from private.p05_files a where a.file_id=f.id)
    or exists(select 1 from storage.objects o where o.name=f.object_key and o.bucket_id<>'ftksaas-documents')
 )) or cardinality(file_ids)<>cardinality(version_ids)
 then return jsonb_build_object('state','blocked','reason','unverified_document_file');end if;

 with candidates as (
  select v.id as version_id,f.id as file_id,f.object_key,f.checksum,f.size_bytes,f.mime,
   d.file_id is not null as is_inline,
   o.id as object_id,o.version as object_version,
   coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner') as object_owner,
   a.auth_user_id::text as expected_owner,
   removed.descriptor as former_object
  from core.document_versions v
  join core.files f on f.org_id=v.org_id and f.id=v.file_id
  join private.p05_files pf on pf.file_id=f.id
  left join core.accounts a on a.id=pf.account_id
  left join private.digital_document_contents d on d.org_id=v.org_id and d.file_id=f.id
  left join storage.objects o on o.bucket_id='ftksaas-documents' and o.name=f.object_key
  left join private.organization_signed_document_objects removed
    on removed.request_id=target_request and removed.org_id=target_org and removed.file_id=f.id
   and removed.metadata_deleted_at is not null and o.id is null
  where v.org_id=target_org and v.id=any(version_ids)
 ), descriptors as (
  select c.*,
   case when is_inline then null
    when object_id is not null then jsonb_build_object('version_id',version_id,'file_id',file_id,'object_key',object_key,
     'object_id',object_id,'object_version',object_version,'mime',mime,'bytes',size_bytes,'checksum',checksum)
    else former_object end as descriptor
  from candidates c
 )
 select coalesce(jsonb_agg(descriptor order by version_id) filter(where not is_inline),'[]'::jsonb)
 into stored_files from descriptors
 having count(*)=cardinality(version_ids) and bool_and(
  case when is_inline then mime='text/plain' and object_id is null and former_object is null
  else mime in ('text/plain','application/pdf') and size_bytes between 1 and 2097152
   and jsonb_typeof(descriptor)='object' and descriptor->>'object_version' is not null
   and descriptor->>'version_id'=version_id::text and descriptor->>'object_key'=object_key
   and descriptor->>'file_id'=file_id::text and descriptor->>'checksum'=checksum
   and descriptor->>'mime'=mime and (descriptor->>'bytes')::bigint=size_bytes
   and (object_owner is null or object_owner=expected_owner)
  end is true
 );
 if stored_files is null or (jsonb_array_length(stored_files)>0 and not exists(
   select 1 from storage.buckets b where b.id='ftksaas-documents' and not b.public
    and coalesce(to_jsonb(b)->>'versioning_status','DISABLED')='DISABLED'
 )) then return jsonb_build_object('state','blocked','reason','unverified_document_storage');end if;
 stored_ids:=array(select (x->>'object_id')::uuid from jsonb_array_elements(stored_files) x);

 select array(select r.id from core.document_requirements r
   where r.org_id=target_org and r.document_version_id=any(version_ids) order by r.id),
  array(select r.id from core.document_acceptances r
   where r.org_id=target_org and r.document_version_id=any(version_ids) order by r.id),
  array(select d.id from private.rendered_documents d
   where d.org_id=target_org and d.document_version_id=any(version_ids) order by d.id),
  array(select t.id from private.content_templates t join core.document_versions v
   on t.org_id=v.org_id and t.source_version=v.id::text and t.code='document.'||v.document_id::text
   where v.org_id=target_org and v.id=any(version_ids) and t.channel='document' order by t.id)
 into requirement_ids,acceptance_ids,render_ids,template_ids;
 if cardinality(acceptance_ids)=0 then return jsonb_build_object('state','blocked','reason','signed_document_acceptance_missing');end if;

 hold_ids:=array[target_request,target_org]||document_ids||version_ids||file_ids||requirement_ids||acceptance_ids||render_ids||template_ids||stored_ids
  ||array(select unnest(array[a.person_id,a.account_id,a.account_link_id,a.center_id,a.operation_id,
    (a.context#>>'{subject,id}')::uuid,(a.context->>'purchase_preview_id')::uuid]) from core.document_acceptances a where a.id=any(acceptance_ids));
 if exists(select 1 from core.retention_holds h where h.subject_id=any(hold_ids) and (h.org_id=target_org or h.org_id is null))
 then return jsonb_build_object('state','held');end if;

 if exists(
  select 1 from core.document_versions v join core.files f on f.org_id=v.org_id and f.id=v.file_id
  join private.digital_document_contents d on d.org_id=v.org_id and d.file_id=v.file_id
  where v.id=any(version_ids) and (v.content_hash<>d.content_hash or f.checksum is distinct from d.content_hash
   or f.size_bytes<>octet_length(d.content->>'text') or d.content_hash<>private.digital_document_hash(d.content))
 ) or exists(
  select 1 from core.document_versions v join core.files f on f.org_id=v.org_id and f.id=v.file_id
  where v.id=any(version_ids) and v.content_hash is distinct from f.checksum
 ) or exists(
  select 1 from private.rendered_documents d join core.document_versions v on v.org_id=d.org_id and v.id=d.document_version_id
  join private.content_templates t on t.id=d.template_id
  where d.id=any(render_ids) and (not d.template_id=any(template_ids) or t.source_version<>v.id::text or d.source_version<>v.id::text
   or t.code<>'document.'||v.document_id::text or d.source_content_hash<>v.content_hash or d.content_hash<>private.digital_document_hash(d.content))
 ) or exists(
  select 1 from private.document_presentations p join private.rendered_documents d on d.org_id=p.org_id and d.id=p.rendered_document_id
  where p.org_id=target_org and p.document_version_id=any(version_ids) and d.document_version_id is distinct from p.document_version_id
 ) then return jsonb_build_object('state','blocked','reason','unverified_document_content');end if;

 if exists(
  select 1 from core.document_acceptances a
  left join private.digital_document_acceptances e on e.org_id=a.org_id and e.acceptance_id=a.id
  left join private.rendered_documents d on d.org_id=a.org_id and d.id=e.rendered_document_id and d.document_version_id=a.document_version_id
  left join private.document_presentations p on p.org_id=a.org_id and p.document_version_id=a.document_version_id
   and p.person_id=a.person_id and p.context=a.context and p.rendered_document_id=d.id
  left join core.account_links l on l.org_id=a.org_id and l.id=a.account_link_id and l.account_id=a.account_id and l.person_id=a.person_id
  left join core.operation_receipts r on r.org_id=a.org_id and r.id=a.operation_id
  where a.id=any(acceptance_ids) and (
   (exists(select 1 from jsonb_array_elements(stored_files) x where x->>'version_id'=a.document_version_id::text)
    and e.acceptance_id is not null)
   or (not exists(select 1 from jsonb_array_elements(stored_files) x where x->>'version_id'=a.document_version_id::text)
    and p.rendered_document_id is null)
   or l.verified_at is null or l.verified_at>a.accepted_at
   or a.auth_session_id is null or a.center_id is null or r.operation is distinct from 'document_accept_v1'
   or r.business_reference is distinct from a.id or r.state not in ('succeeded','result_expired')
   or (a.context-array['gate','subject','product_version_id','purchase_preview_id'])<>'{}'::jsonb
   or a.context#>>'{subject,type}' is null or a.context#>>'{subject,id}' is null or a.context->>'gate' is null)
 ) then return jsonb_build_object('state','blocked','reason','unproved_signed_acceptance');end if;

 if exists(select 1 from private.p05_document_protections p where p.org_id=target_org and p.document_version_id=any(version_ids))
  or exists(select 1 from private.purchase_documents p cross join lateral jsonb_array_elements(p.requirements) x
   where p.org_id=target_org and x->>'version_id'=any(array(select v::text from unnest(version_ids) v)))
  or exists(select 1 from private.rendered_documents d where d.template_id=any(template_ids) and not d.id=any(render_ids))
  then return jsonb_build_object('state','blocked','reason','dependent_document_work');end if;

 select jsonb_build_object('request_id',target_request,'org_id',target_org,
  'versions',(select jsonb_agg(jsonb_build_object('document_id',v.document_id,'version_id',v.id,'version_label',v.version_label,
   'effective_at',v.effective_at,'source_sha256',v.content_hash)
   ||case when d.file_id is not null then jsonb_build_object('source_content',d.content)
    else jsonb_build_object('storage',s.value-'object_key'-'version_id'-'checksum') end order by v.id)
   from core.document_versions v
   left join private.digital_document_contents d on d.org_id=v.org_id and d.file_id=v.file_id
   left join lateral (select x as value from jsonb_array_elements(stored_files) x where x->>'version_id'=v.id::text) s on true
   where v.id=any(version_ids) and exists(select 1 from core.document_acceptances a where a.document_version_id=v.id and a.id=any(acceptance_ids))),
  'acceptances',(select jsonb_agg(jsonb_build_object('acceptance_id',a.id,'version_id',a.document_version_id,'person_id',a.person_id,
   'account_id',a.account_id,'account_link_id',a.account_link_id,'operation_id',a.operation_id,'accepted_at',a.accepted_at,
   'center_id',a.center_id,'gate',a.context->>'gate',
   'subject',jsonb_build_object('type',a.context#>>'{subject,type}','id',a.context#>>'{subject,id}'),
   'link_verified_at',l.verified_at,'purchase_preview_id',a.context->>'purchase_preview_id',
   'product_version_id',a.context->>'product_version_id')
   ||case when d.id is not null then jsonb_build_object('shown_content',d.content,'shown_sha256',d.content_hash,'rendered_document_id',d.id)
    else jsonb_build_object('shown_sha256',v.content_hash) end
   order by a.id) from core.document_acceptances a
   join core.document_versions v on v.org_id=a.org_id and v.id=a.document_version_id
   left join private.digital_document_acceptances e on e.org_id=a.org_id and e.acceptance_id=a.id
   left join private.rendered_documents d on d.org_id=e.org_id and d.id=e.rendered_document_id
   join core.account_links l on l.org_id=a.org_id and l.id=a.account_link_id where a.id=any(acceptance_ids))
 ) into scope;

 selection:=jsonb_build_object('documents',document_ids,'versions',version_ids,'files',file_ids,'requirements',requirement_ids,
  'acceptances',acceptance_ids,'renders',render_ids,'templates',template_ids);
 if cardinality(stored_ids)>0 then selection:=selection||jsonb_build_object('storage_objects',stored_ids);end if;
 fingerprint:=encode(extensions.digest(jsonb_build_array(scope,selection,
  (select jsonb_agg(to_jsonb(d) order by d.id) from core.documents d where d.id=any(document_ids)),
  (select jsonb_agg(to_jsonb(v) order by v.id) from core.document_versions v where v.id=any(version_ids)),
  (select jsonb_agg(to_jsonb(a) order by a.id) from core.document_acceptances a where a.id=any(acceptance_ids)),
  (select jsonb_agg(to_jsonb(e) order by e.acceptance_id) from private.digital_document_acceptances e where e.acceptance_id=any(acceptance_ids)),
  (select jsonb_agg(to_jsonb(f) order by f.id) from core.files f where f.id=any(file_ids)),
  (select jsonb_agg(to_jsonb(d) order by d.file_id) from private.digital_document_contents d where d.file_id=any(file_ids)),
  (select jsonb_agg(to_jsonb(p) order by p.file_id) from private.p05_files p where p.file_id=any(file_ids)),
  (select jsonb_agg(to_jsonb(d) order by d.id) from private.rendered_documents d where d.id=any(render_ids)),
  (select jsonb_agg(to_jsonb(t) order by t.id) from private.content_templates t where t.id=any(template_ids)),
  (select jsonb_agg(to_jsonb(t) order by t.template_id) from private.content_retirements t where t.template_id=any(template_ids)),
  (select jsonb_agg(to_jsonb(t) order by t.template_id) from private.content_invalidations t where t.template_id=any(template_ids)),
  (select jsonb_agg(to_jsonb(r) order by r.id) from core.document_requirements r where r.id=any(requirement_ids)),
  (select jsonb_agg(to_jsonb(p) order by p.person_id,p.document_version_id,p.context) from private.document_presentations p
    where p.org_id=target_org and p.document_version_id=any(version_ids))
 )::text,'sha256'),'hex');
 if cardinality(stored_ids)>0 then fingerprint:=encode(extensions.digest(jsonb_build_array(fingerprint,stored_files)::text,'sha256'),'hex');end if;
 return jsonb_build_object('state','ready','scope',scope,'source_fingerprint',fingerprint,'selected',selection,'storage_files',stored_files);
end$$;

create or replace function private.organization_signed_document_stage(r jsonb,phase text,archive_digest text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_signed_document_erasures;src jsonb;
 file_ids uuid[];version_ids uuid[];template_ids uuid[];acceptance_ids uuid[];erased_ids uuid[];
begin
 if phase is null or phase not in ('prepare','authorize','confirm') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 if phase='prepare' then perform private.p07_privacy_scope(j.org_id);
 elsif not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;

 select * into a from private.organization_signed_document_erasures where request_id=j.request_id and org_id=j.org_id
  and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for update;
 if a.request_id is null and phase='prepare' then return jsonb_build_object('state','unbound');end if;
 if a.request_id is null or (phase='prepare' and a.worker_role<>session_user)
  or (phase<>'prepare' and (a.attestor_role<>session_user or archive_digest is distinct from a.archive_sha256))
  or not pg_has_role(a.worker_role,'ftk_p07_privacy_worker','member')
  or not pg_has_role(a.attestor_role,'ftk_p07_storage_attestor','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=a.worker_role and s.org_id=j.org_id for share)
  then perform private.fail('FORBIDDEN');end if;
 if a.completed_at is not null then return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp()
  then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if a.retain_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;

 if phase<>'prepare' then
  perform 1 from core.organizations where id=j.org_id and state='deletion_pending' for no key update;
  if not found then perform private.fail('FORBIDDEN');end if;
  begin
   lock table core.retention_holds,core.operation_receipts,core.account_links,
    private.p05_document_protections,private.purchase_documents,storage.objects in share mode nowait;
   lock table core.documents,core.document_versions,core.document_requirements,core.document_acceptances,core.files,
    private.digital_document_contents,private.digital_document_acceptances,private.p05_files,private.document_presentations,
    private.rendered_documents,private.content_templates,private.content_retirements,private.content_invalidations
    in share row exclusive mode nowait;
  exception when lock_not_available then
   return jsonb_build_object('state','retry_wait');
  end;
 end if;

 src:=private.organization_signed_document_archive_source(j.request_id,j.org_id);
 if src->>'state'<>'ready' then return src;end if;
 if src->>'source_fingerprint' is distinct from a.source_fingerprint then perform private.fail('SIGNED_DOCUMENT_ARCHIVE_SOURCE_CHANGED');end if;
 if phase='prepare' then return (src-'selected'-'storage_files')||jsonb_build_object(
  'source_project_ref',a.source_project_ref,'approval_id',a.approval_id,'retain_until',a.retain_until,
  'archive_scope_sha256',a.archive_scope_sha256,'archive_sha256',a.archive_sha256);
 end if;
 if jsonb_array_length(src->'storage_files')>0 and a.provider_origin is null then perform private.fail('FORBIDDEN');end if;
 if phase='authorize' then
  insert into private.organization_signed_document_objects(request_id,org_id,file_id,object_id,object_key,descriptor,authorized_lease_hash)
  select a.request_id,a.org_id,(x->>'file_id')::uuid,(x->>'object_id')::uuid,x->>'object_key',x,j.lease_hash
  from jsonb_array_elements(src->'storage_files') x
  on conflict(file_id) do update set authorized_lease_hash=excluded.authorized_lease_hash
   where private.organization_signed_document_objects.request_id=excluded.request_id
    and private.organization_signed_document_objects.descriptor=excluded.descriptor
    and private.organization_signed_document_objects.metadata_deleted_at is null;
  if exists(select 1 from jsonb_array_elements(src->'storage_files') x where not exists(
   select 1 from private.organization_signed_document_objects e
   where e.request_id=a.request_id and e.org_id=a.org_id and e.descriptor=x
    and (e.metadata_deleted_at is not null or e.authorized_lease_hash=j.lease_hash)
  )) then perform private.fail('RESULT_NOT_CONFIRMED');end if;
  return jsonb_build_object('state','authorized','objects',coalesce((
   select jsonb_agg(e.descriptor||jsonb_build_object('bucket_id','ftksaas-documents','provider_origin',a.provider_origin,
    'state',case when e.provider_deleted_at is not null then 'readback' when e.metadata_deleted_at is not null then 'unconfirmed' else 'ready' end)
    order by e.file_id) from private.organization_signed_document_objects e
   where e.request_id=a.request_id and e.org_id=a.org_id
  ),'[]'::jsonb));
 end if;
 if exists(select 1 from jsonb_array_elements(src->'storage_files') x where not exists(
  select 1 from private.organization_signed_document_objects e where e.request_id=a.request_id and e.org_id=a.org_id
   and e.descriptor=x and e.provider_deleted_at is not null
   and not exists(select 1 from storage.objects o where o.id=e.object_id or (o.bucket_id='ftksaas-documents' and o.name=e.object_key))
 )) then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 if j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;

 version_ids:=array(select x::uuid from jsonb_array_elements_text(src#>'{selected,versions}') x);
 template_ids:=array(select x::uuid from jsonb_array_elements_text(src#>'{selected,templates}') x);
 acceptance_ids:=array(select x::uuid from jsonb_array_elements_text(src#>'{selected,acceptances}') x);
 file_ids:=array(select x::uuid from jsonb_array_elements_text(src#>'{selected,files}') x);
 erased_ids:=array(select distinct id::uuid from jsonb_each(src->'selected') s cross join lateral jsonb_array_elements_text(s.value) id order by id::uuid);

 update private.organization_signed_document_erasures
 set permit_transaction=pg_catalog.pg_current_xact_id(),permit_rows=src->'selected' where request_id=j.request_id;
 delete from private.digital_document_acceptances where org_id=j.org_id and acceptance_id=any(acceptance_ids);
 delete from core.document_acceptances where org_id=j.org_id and id=any(acceptance_ids);
 delete from private.document_presentations where org_id=j.org_id and document_version_id=any(version_ids);
 delete from private.rendered_documents where org_id=j.org_id and document_version_id=any(version_ids);
 delete from private.content_invalidations where template_id=any(template_ids);
 delete from private.content_retirements where template_id=any(template_ids);
 delete from private.content_templates where org_id=j.org_id and id=any(template_ids);
 delete from core.document_requirements where org_id=j.org_id and document_version_id=any(version_ids);
 delete from core.document_versions where org_id=j.org_id and id=any(version_ids);
 delete from private.digital_document_contents where org_id=j.org_id and file_id=any(file_ids);
 delete from private.p05_files where file_id=any(file_ids);
 delete from core.files where org_id=j.org_id and id=any(file_ids);
 delete from core.documents where org_id=j.org_id and (src#>'{selected,documents}')?id::text;
 set constraints all immediate;

 if exists(select 1 from core.document_acceptances where id=any(acceptance_ids))
  or exists(select 1 from private.digital_document_acceptances where acceptance_id=any(acceptance_ids))
  or exists(select 1 from private.document_presentations where org_id=j.org_id and document_version_id=any(version_ids))
  or exists(select 1 from private.rendered_documents where org_id=j.org_id and document_version_id=any(version_ids))
  or exists(select 1 from core.document_requirements where org_id=j.org_id and document_version_id=any(version_ids))
  or exists(select 1 from core.document_versions where id=any(version_ids))
  or exists(select 1 from private.content_templates where id=any(template_ids))
  or exists(select 1 from core.files where id=any(file_ids))
  or exists(select 1 from private.digital_document_contents where file_id=any(file_ids))
  or exists(select 1 from private.p05_files where file_id=any(file_ids))
  or exists(select 1 from private.content_retirements where template_id=any(template_ids))
  or exists(select 1 from private.content_invalidations where template_id=any(template_ids))
  or exists(select 1 from core.documents where org_id=j.org_id and (src#>'{selected,documents}')?id::text)
  then perform private.fail('INTEGRITY_VIOLATION');end if;
 if j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 update private.organization_signed_document_erasures set completed_at=clock_timestamp(),erased_subject_ids=erased_ids,
  permit_transaction=null,permit_rows=null where request_id=j.request_id;
 return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);
end$$;

-- A Storage metadata tombstone records the guarded DELETE attempt. Only a
-- successful Storage API response, recorded by the attestor, can advance it.
create function private.organization_signed_document_storage_ack(r jsonb,target uuid,archive_digest text) returns void
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_signed_document_erasures;e private.organization_signed_document_objects;
begin
 if not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 select * into a from private.organization_signed_document_erasures
 where request_id=j.request_id and org_id=j.org_id and attestor_role=session_user
  and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if a.request_id is null or a.archive_sha256 is distinct from archive_digest then perform private.fail('FORBIDDEN');end if;
 select * into e from private.organization_signed_document_objects
 where file_id=target and request_id=j.request_id and org_id=j.org_id for update;
 if e.file_id is null or e.metadata_deleted_at is null or j.state<>'running' or j.lease_until is null
  or j.lease_until<=clock_timestamp() or e.authorized_lease_hash is distinct from j.lease_hash
  or exists(select 1 from storage.objects o where o.id=e.object_id or (o.bucket_id='ftksaas-documents' and o.name=e.object_key))
 then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 if e.provider_deleted_at is null then
  update private.organization_signed_document_objects set provider_deleted_at=clock_timestamp() where file_id=e.file_id;
 end if;
end$$;

create function private.organization_signed_document_storage_fence() returns trigger
 language plpgsql security definer set search_path='' as $$
declare e private.organization_signed_document_objects;j private.p07_privacy_jobs;a private.organization_signed_document_erasures;src jsonb;
begin
 if tg_op<>'DELETE' and new.bucket_id='ftksaas-documents' and exists(
  select 1 from private.organization_signed_document_objects where object_key=new.name
 ) then perform private.fail('FORBIDDEN');end if;
 if tg_op='INSERT' then return new;end if;
 if old.bucket_id='ftksaas-documents' then
  select * into e from private.organization_signed_document_objects where object_key=old.name;
 end if;
 if e.file_id is null then
  if tg_op='DELETE' then return old;end if;
  return new;
 end if;
 if tg_op<>'DELETE' then perform private.fail('FORBIDDEN');end if;

 select * into j from private.p07_privacy_jobs where request_id=e.request_id and org_id=e.org_id for share;
 select * into a from private.organization_signed_document_erasures where request_id=e.request_id and org_id=e.org_id for share;
 select * into e from private.organization_signed_document_objects where file_id=e.file_id for update;
 if e.file_id is null or a.request_id is null or a.completed_at is not null or j.state is distinct from 'running'
  or j.lease_until is null or j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp()
  or e.authorized_lease_hash is distinct from j.lease_hash or e.metadata_deleted_at is not null
  or e.object_id<>old.id or e.descriptor->>'object_version' is distinct from to_jsonb(old)->>'version'
  or a.instance_id<>(pg_catalog.pg_control_system()).system_identifier::text
  or not pg_has_role(a.worker_role,'ftk_p07_privacy_worker','member')
  or not pg_has_role(a.attestor_role,'ftk_p07_storage_attestor','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=a.worker_role and s.org_id=e.org_id for share)
 then perform private.fail('FORBIDDEN');end if;

 perform 1 from core.organizations where id=e.org_id and state='deletion_pending' for share;
 if not found then perform private.fail('FORBIDDEN');end if;
 lock table core.retention_holds,core.operation_receipts,core.account_links,
  core.documents,core.document_versions,core.document_requirements,core.document_acceptances,core.files,
  private.p05_document_protections,private.purchase_documents,private.p05_files,
  private.digital_document_contents,private.digital_document_acceptances,private.document_presentations,
  private.rendered_documents,private.content_templates,private.content_retirements,private.content_invalidations
  in share mode nowait;
 src:=private.organization_signed_document_archive_source(e.request_id,e.org_id);
 if src->>'state' is distinct from 'ready' or src->>'source_fingerprint' is distinct from a.source_fingerprint
  or not (src->'storage_files') @> jsonb_build_array(e.descriptor)
  or j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp()
 then perform private.fail('FORBIDDEN');end if;

 update private.organization_signed_document_objects set metadata_deleted_at=clock_timestamp() where file_id=e.file_id;
 return old;
end$$;
create trigger organization_signed_document_storage_fence before insert or update or delete on storage.objects
 for each row execute function private.organization_signed_document_storage_fence();

revoke all on function private.organization_signed_document_storage_fence(),
 private.organization_signed_document_storage_ack(jsonb,uuid,text)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.organization_signed_document_storage_ack(jsonb,uuid,text) to ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$     and encode(extensions.digest(a.object_key,''sha256''),''hex'')=r.object_key_hash
   )'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Published document DB census anchor mismatch';end if;
 body:=replace(body,anchor,$q$     and encode(extensions.digest(a.object_key,''sha256''),''hex'')=r.object_key_hash
   ) or r.request_id=$6 and exists(
    select 1 from private.organization_signed_document_objects e where e.request_id=$6 and e.org_id=$2
     and e.object_id=r.object_id and e.provider_deleted_at is not null and r.bucket_id=''ftksaas-documents''
     and encode(extensions.digest(e.object_key,''sha256''),''hex'')=r.object_key_hash
   )'$q$);
 anchor:=$q$  when 'private.organization_signed_document_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Published document DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_signed_document_objects' then 'r.request_id=$6 and r.org_id=$2 and r.provider_deleted_at is not null'
$q$||anchor);

 body:=pg_get_functiondef('private.organization_managed_file_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$   and encode(extensions.digest(a.object_key,'sha256'),'hex')=c.object_key_hash
 )) into observed_objects,unproved_observations$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Published document managed-file census anchor mismatch';end if;
 body:=replace(body,anchor,$q$   and encode(extensions.digest(a.object_key,'sha256'),'hex')=c.object_key_hash
 ) and not exists(
  select 1 from private.organization_signed_document_objects e where e.request_id=target_request and e.org_id=target_org
   and e.object_id=c.object_id and e.provider_deleted_at is not null and c.bucket_id='ftksaas-documents'
   and encode(extensions.digest(e.object_key,'sha256'),'hex')=c.object_key_hash
 )) into observed_objects,unproved_observations$q$);
 anchor:=$q$ if invoice_purges+pending_invoice_purges>0 then$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Published document inventory anchor mismatch';end if;
 execute replace(body,anchor,$q$ source:=source||coalesce((
  select jsonb_build_object('published_document_storage_purges',count(*),
   'published_document_storage_sha256',encode(extensions.digest(
    jsonb_agg(jsonb_build_array(e.file_id,e.object_id,e.descriptor->>'checksum',e.descriptor->'bytes') order by e.file_id)::text,'sha256'),'hex'))
  from private.organization_signed_document_objects e
  join private.organization_signed_document_erasures a on a.request_id=e.request_id and a.org_id=e.org_id and a.completed_at is not null
  where e.request_id=target_request and e.org_id=target_org and e.provider_deleted_at is not null having count(*)>0
 ),'{}'::jsonb);
$q$||anchor);
end$patch$;
commit;
