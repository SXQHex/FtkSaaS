begin;

create table private.organization_signed_document_erasures(
 request_id uuid primary key,org_id uuid not null,
 source_project_ref text not null check(source_project_ref~'^[a-z]{20}$'),
 source_fingerprint text not null check(source_fingerprint~'^[a-f0-9]{64}$'),
 archive_scope_sha256 text not null check(archive_scope_sha256~'^[a-f0-9]{64}$'),
 archive_sha256 text not null check(archive_sha256~'^[a-f0-9]{64}$'),
 approval_id uuid not null unique,retain_until timestamptz not null,
 worker_role name not null,attestor_role name not null check(attestor_role<>worker_role),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 permit_transaction xid8,permit_rows jsonb,completed_at timestamptz,erased_subject_ids uuid[],
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 check((permit_transaction is null)=(permit_rows is null)),
 check((completed_at is null and erased_subject_ids is null) or
       (completed_at is not null and permit_transaction is null and coalesce(cardinality(erased_subject_ids),0)>0))
);
alter table private.organization_signed_document_erasures enable row level security;
revoke all on private.organization_signed_document_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_signed_document_erasure_immutable before update or delete on private.organization_signed_document_erasures
 for each row when(old.completed_at is not null) execute function private.append_only();

create function private.organization_signed_document_delete_permitted(kind text,row_id text,row_org uuid) returns boolean
 language sql volatile security invoker set search_path='' as $$
 select exists(
  select 1 from private.organization_signed_document_erasures a
  join private.p07_privacy_jobs j on j.request_id=a.request_id and j.org_id=a.org_id
  where (row_org is null or a.org_id=row_org) and (a.permit_rows->kind)?row_id and a.attestor_role=session_user
   and a.instance_id=(pg_catalog.pg_control_system()).system_identifier::text
   and a.permit_transaction=pg_catalog.pg_current_xact_id_if_assigned() and a.completed_at is null
   and a.retain_until>clock_timestamp() and j.state='running' and j.lease_until>clock_timestamp()
 )
$$;

create function private.organization_signed_document_immutable_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
declare original jsonb:=to_jsonb(old);
begin
 if tg_op='DELETE' and private.organization_signed_document_delete_permitted(tg_argv[0],original->>tg_argv[1],(original->>'org_id')::uuid)
 then return old;end if;
 perform private.fail('INTEGRITY_VIOLATION');
 return null;
end$$;

create function private.organization_signed_document_template_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' and private.organization_signed_document_delete_permitted('templates',old.id::text,old.org_id)
 then return old;end if;
 if tg_op='DELETE' or old.state='published' or (new.id,new.scope_key,new.code,new.channel,new.language,new.version,new.source_version,new.org_id,new.center_id)
 is distinct from (old.id,old.scope_key,old.code,old.channel,old.language,old.version,old.source_version,old.org_id,old.center_id)
 then perform private.fail('INTEGRITY_VIOLATION');end if;
 return new;
end$$;

do $permit$
declare guard record;
begin
 for guard in select * from (values
  ('core','document_acceptances','p05_acceptance_immutable','acceptances','id'),
  ('core','document_versions','p05_version_immutable','versions','id'),
  ('core','document_requirements','p05_requirement_immutable','requirements','id'),
  ('private','digital_document_acceptances','digital_document_acceptances_immutable','acceptances','acceptance_id'),
  ('private','digital_document_contents','digital_document_contents_immutable','files','file_id'),
  ('private','document_presentations','document_presentations_immutable','versions','document_version_id'),
  ('private','rendered_documents','rendered_documents_immutable','renders','id'),
  ('private','content_retirements','content_retirement_immutable','templates','template_id'),
  ('private','content_invalidations','content_invalidations_immutable','templates','template_id')
 ) as targets(schema_name,table_name,trigger_name,category,key_name)
 loop
  execute format('drop trigger %I on %I.%I',guard.trigger_name,guard.schema_name,guard.table_name);
  execute format('create trigger %I before update or delete on %I.%I for each row execute function private.organization_signed_document_immutable_guard(%L,%L)',
   guard.trigger_name,guard.schema_name,guard.table_name,guard.category,guard.key_name);
 end loop;
end$permit$;
drop trigger content_immutable on private.content_templates;
create trigger content_immutable before update or delete on private.content_templates
 for each row execute function private.organization_signed_document_template_guard();

create function private.organization_signed_document_archive_source(target_request uuid,target_org uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare policy_request core.privacy_requests;scope jsonb;selection jsonb;fingerprint text;
 version_ids uuid[];file_ids uuid[];document_ids uuid[];requirement_ids uuid[];
 acceptance_ids uuid[];render_ids uuid[];template_ids uuid[];hold_ids uuid[];
begin
 select * into policy_request from core.privacy_requests p where p.id=target_request and p.org_id=target_org
  and p.kind='organization_delete' and p.state in ('requested','running','partial')
  and p.scope=jsonb_build_object('kind','organization','org_id',target_org,'account_id',null,'all_data',true);
 if policy_request.id is null or not exists(select 1 from core.organizations where id=target_org and state='deletion_pending')
 then perform private.fail('FORBIDDEN');end if;

 with sources as (
  select v.id,v.file_id,v.document_id from core.document_versions v
  join private.digital_document_contents d on d.org_id=v.org_id and d.file_id=v.file_id
  where v.org_id=target_org
 )
 select array(select s.id from sources s order by s.id),
  array(select distinct s.file_id from sources s order by s.file_id),
  array(select distinct s.document_id from sources s order by s.document_id)
 into version_ids,file_ids,document_ids;
 if cardinality(version_ids)=0 then return jsonb_build_object('state','blocked','reason','inline_document_source_missing');end if;
 if exists(select 1 from core.document_versions v where v.org_id=target_org and v.document_id=any(document_ids) and not v.id=any(version_ids))
  or exists(select 1 from core.files f where f.id=any(file_ids) and (
    f.purpose<>'document' or f.state<>'ready' or f.mime<>'text/plain' or f.expires_at is not null
    or f.object_key<>target_org::text||'/'||f.id::text
    or not exists(select 1 from private.p05_files a where a.file_id=f.id)
    or exists(select 1 from storage.objects o where o.name=f.object_key)
  )) then return jsonb_build_object('state','blocked','reason','mixed_document_family');end if;

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

 hold_ids:=array[target_request,target_org]||document_ids||version_ids||file_ids||requirement_ids||acceptance_ids||render_ids||template_ids
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
  where a.id=any(acceptance_ids) and (p.rendered_document_id is null or l.verified_at is null or l.verified_at>a.accepted_at
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
   'effective_at',v.effective_at,'source_sha256',v.content_hash,'source_content',d.content) order by v.id)
   from core.document_versions v join private.digital_document_contents d on d.org_id=v.org_id and d.file_id=v.file_id
   where v.id=any(version_ids) and exists(select 1 from core.document_acceptances a where a.document_version_id=v.id and a.id=any(acceptance_ids))),
  'acceptances',(select jsonb_agg(jsonb_build_object('acceptance_id',a.id,'version_id',a.document_version_id,'person_id',a.person_id,
   'account_id',a.account_id,'account_link_id',a.account_link_id,'operation_id',a.operation_id,'accepted_at',a.accepted_at,
   'center_id',a.center_id,'gate',a.context->>'gate',
   'subject',jsonb_build_object('type',a.context#>>'{subject,type}','id',a.context#>>'{subject,id}'),
   'link_verified_at',l.verified_at,'purchase_preview_id',a.context->>'purchase_preview_id',
   'product_version_id',a.context->>'product_version_id','shown_content',d.content,'shown_sha256',d.content_hash,'rendered_document_id',d.id)
   order by a.id) from core.document_acceptances a
   join private.digital_document_acceptances e on e.org_id=a.org_id and e.acceptance_id=a.id
   join private.rendered_documents d on d.org_id=e.org_id and d.id=e.rendered_document_id
   join core.account_links l on l.org_id=a.org_id and l.id=a.account_link_id where a.id=any(acceptance_ids))
 ) into scope;

 selection:=jsonb_build_object('documents',document_ids,'versions',version_ids,'files',file_ids,'requirements',requirement_ids,
  'acceptances',acceptance_ids,'renders',render_ids,'templates',template_ids);
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
 return jsonb_build_object('state','ready','scope',scope,'source_fingerprint',fingerprint,'selected',selection);
end$$;

create function private.organization_signed_document_stage(r jsonb,phase text,archive_digest text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_signed_document_erasures;src jsonb;
 file_ids uuid[];version_ids uuid[];template_ids uuid[];acceptance_ids uuid[];erased_ids uuid[];
begin
 if phase is null or phase not in ('prepare','confirm') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 if phase='prepare' then perform private.p07_privacy_scope(j.org_id);
 elsif not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;

 select * into a from private.organization_signed_document_erasures where request_id=j.request_id and org_id=j.org_id
  and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for update;
 if a.request_id is null and phase='prepare' then return jsonb_build_object('state','unbound');end if;
 if a.request_id is null or (phase='prepare' and a.worker_role<>session_user)
  or (phase='confirm' and (a.attestor_role<>session_user or archive_digest is distinct from a.archive_sha256))
  or not pg_has_role(a.worker_role,'ftk_p07_privacy_worker','member')
  or not pg_has_role(a.attestor_role,'ftk_p07_storage_attestor','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=a.worker_role and s.org_id=j.org_id for share)
  then perform private.fail('FORBIDDEN');end if;
 if a.completed_at is not null then return jsonb_build_object('state','completed','archive_sha256',a.archive_sha256);end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp()
  then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if a.retain_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;

 if phase='confirm' then
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
 if phase='prepare' then return (src-'selected')||jsonb_build_object(
  'source_project_ref',a.source_project_ref,'approval_id',a.approval_id,'retain_until',a.retain_until,
  'archive_scope_sha256',a.archive_scope_sha256,'archive_sha256',a.archive_sha256);
 end if;
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

revoke all on function private.organization_signed_document_delete_permitted(text,text,uuid),
 private.organization_signed_document_immutable_guard(),private.organization_signed_document_template_guard(),
 private.organization_signed_document_archive_source(uuid,uuid),private.organization_signed_document_stage(jsonb,text,text)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.organization_signed_document_stage(jsonb,text,text) to ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$q$  when 'private.organization_billing_history_erasures'$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Signed document DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$q$  when 'private.organization_signed_document_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.completed_at is not null'
$q$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$q$  ||coalesce((select a.erased_subject_ids from private.organization_billing_history_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Signed document DB scope anchor mismatch';end if;
 execute replace(body,anchor,$q$  ||coalesce((select a.erased_subject_ids from private.organization_billing_history_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}')
  ||coalesce((select a.erased_subject_ids from private.organization_signed_document_erasures a
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null),'{}');$q$);
end$patch$;
commit;
