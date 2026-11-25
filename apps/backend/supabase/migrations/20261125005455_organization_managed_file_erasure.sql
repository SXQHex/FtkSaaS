begin;

alter table private.p07_storage_erasure_intents add column bucket_id text not null default 'ftksaas-imports'
 check(bucket_id in ('ftksaas-imports','ftksaas-documents'));

create table private.organization_managed_file_erasure_scopes(
 db_role name not null,request_id uuid not null references core.privacy_requests(id),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 primary key(db_role,request_id)
);
create table private.organization_managed_file_erasure_receipts(
 request_id uuid primary key,org_id uuid not null unique,operation_id uuid not null unique,
 completed_at timestamptz not null default clock_timestamp(),inventory jsonb not null,
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 foreign key(org_id,operation_id) references core.operation_receipts(org_id,id)
);
create table private.organization_file_copy_erasure_receipts(
 operation_id uuid primary key,request_id uuid not null,org_id uuid not null,
 completed_at timestamptz not null default clock_timestamp(),
 removed_contexts int not null check(removed_contexts between 0 and 100),
 removed_preview_payloads int not null check(removed_preview_payloads between 0 and 100),
 check(removed_contexts+removed_preview_payloads>0),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 foreign key(org_id,operation_id) references core.operation_receipts(org_id,id)
);
create table private.organization_managed_storage_census(
 request_id uuid not null references core.privacy_requests(id),object_id uuid not null,
 bucket_id text not null,object_key_hash text not null check(object_key_hash ~ '^[a-f0-9]{64}$'),
 primary key(request_id,object_id)
);
create index organization_file_copy_erasure_receipts_request on private.organization_file_copy_erasure_receipts(request_id);
alter table private.organization_managed_file_erasure_scopes enable row level security;
alter table private.organization_managed_file_erasure_receipts enable row level security;
alter table private.organization_file_copy_erasure_receipts enable row level security;
alter table private.organization_managed_storage_census enable row level security;
revoke all on private.organization_managed_file_erasure_scopes,private.organization_managed_file_erasure_receipts,
 private.organization_file_copy_erasure_receipts,private.organization_managed_storage_census
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger organization_managed_file_erasure_receipts_immutable before update or delete on private.organization_managed_file_erasure_receipts
 for each row execute function private.append_only();
create trigger organization_file_copy_erasure_receipts_immutable before update or delete on private.organization_file_copy_erasure_receipts
 for each row execute function private.append_only();
create trigger organization_managed_storage_census_immutable before update or delete on private.organization_managed_storage_census
 for each row execute function private.append_only();

create function private.p07_managed_file_target(j private.p07_privacy_jobs,target uuid) returns core.files
 language plpgsql security invoker set search_path='' as $$
declare f core.files;
begin
 if not exists(select 1 from core.files x where x.id=target and x.purpose='document') then
  return private.p07_storage_import_target(j,target);
 end if;
 if j.org_id is null or not exists(select 1 from core.privacy_requests p
  where p.id=j.request_id and p.org_id=j.org_id and p.kind='organization_delete'
  and p.state in ('requested','running','partial') and p.scope->>'org_id'=j.org_id::text
  and p.scope->'all_data'='true'::jsonb for share)
  or not exists(select 1 from core.organizations where id=j.org_id and state='deletion_pending' for share) then
  perform private.fail('FORBIDDEN');
 end if;
 select x.* into f from core.files x join private.p05_files s on s.file_id=x.id
 where x.id=target and x.org_id=j.org_id for share of x,s;
 if f.id is null or f.purpose<>'document' or f.state<>'ready' or f.expires_at is not null
  or f.object_key is distinct from (f.org_id::text||'/'||f.id::text)
  or f.mime not in ('application/pdf','text/plain') or f.checksum is null
  or f.checksum !~ '^[a-f0-9]{64}$' or f.size_bytes not between 1 and 2097152
  or exists(select 1 from core.document_versions n where n.org_id=f.org_id and n.file_id=f.id)
  or exists(select 1 from private.digital_document_contents n where n.file_id=f.id)
  or exists(select 1 from core.report_jobs n where n.org_id=f.org_id and n.file_id=f.id)
  or exists(select 1 from core.import_jobs n where n.org_id=f.org_id and n.file_id=f.id)
  or exists(select 1 from private.p06_files n where n.file_id=f.id)
  or exists(select 1 from private.p06_export_files n where n.file_id=f.id) then
  perform private.fail('FORBIDDEN');
 end if;
 return f;
end$$;

create function private.p07_managed_file_owner(f core.files) returns uuid
 language sql stable security invoker set search_path='' as $$
 select account_id from private.p06_files where file_id=f.id and f.purpose='import'
 union all
 select account_id from private.p05_files where file_id=f.id and f.purpose='document'
$$;

create function private.p07_managed_file_held(f core.files,object_id uuid) returns boolean
 language plpgsql security invoker set search_path='' as $$
begin
 if private.p07_storage_import_held(f,object_id) then return true;end if;
 if f.purpose='import' then return false;end if;
 return exists(select 1 from core.retention_holds h where
  (h.subject_table in ('accounts','core.accounts') and h.subject_id=private.p07_managed_file_owner(f))
  or (h.org_id=f.org_id and h.subject_table in ('p05_files','private.p05_files') and h.subject_id=f.id));
end$$;

create function private.p07_confirmed_file_metadata(target_request uuid,target_org uuid) returns setof core.files
 language sql security invoker set search_path='' as $$
 select f.* from private.p07_storage_erasures e
 join private.p07_storage_erasure_intents i on i.file_id=e.file_id and i.request_id=e.request_id
 join core.files f on f.id=e.file_id and f.org_id=target_org
 where e.request_id=target_request and e.object_id=i.object_id and e.checksum=f.checksum and e.removed_bytes=f.size_bytes
  and f.purpose in ('import','document') and i.object_key=f.object_key
  and i.bucket_id=case f.purpose when 'import' then 'ftksaas-imports' else 'ftksaas-documents' end
  and not exists(select 1 from storage.objects o where o.id=e.object_id or (o.bucket_id=i.bucket_id and o.name=i.object_key))
  and not private.p07_managed_file_held(f,e.object_id)
$$;

-- Keep one native provider transaction fence and one separately authorized
-- confirmation. The object key is now interpreted together with its bucket.
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_storage_erasure_prepare(jsonb,uuid)'::regprocedure);
 anchor:=';origin text;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Managed Storage prepare declaration anchor mismatch';end if;
 body:=replace(body,anchor,';origin text;target_bucket text;');
 anchor:=' f:=private.p07_storage_import_target(j,target);';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Managed Storage prepare target anchor mismatch';end if;
 body:=replace(body,anchor,$a$ f:=private.p07_managed_file_target(j,target);
 target_bucket:=case f.purpose when 'import' then 'ftksaas-imports' else 'ftksaas-documents' end;$a$);
 anchor:=$a$(select a.auth_user_id::text from private.p06_files s join core.accounts a on a.id=s.account_id where s.file_id=f.id)$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Managed Storage owner anchor mismatch';end if;
 body:=replace(body,anchor,$a$(select a.auth_user_id::text from core.accounts a where a.id=private.p07_managed_file_owner(f))$a$);
 body:=replace(body,$a$b.id='ftksaas-imports'$a$,$a$b.id=target_bucket$a$);
 body:=replace(body,$a$bucket_id='ftksaas-imports' and name=f.object_key$a$,$a$bucket_id=target_bucket and name=f.object_key$a$);
 body:=replace(body,'i.object_id is distinct from o.id','i.bucket_id is distinct from target_bucket or i.object_id is distinct from o.id');
 body:=replace(body,'private.p07_storage_import_held(f,o.id)','private.p07_managed_file_held(f,o.id)');
 body:=replace(body,'object_version,bytes,checksum,job_id,operation_key,db_role)',
  'object_version,bytes,checksum,job_id,operation_key,db_role,bucket_id)');
 body:=replace(body,'f.checksum,j.id,j.operation_key,session_user)','f.checksum,j.id,j.operation_key,session_user,target_bucket)');
 execute replace(body,$a$'object_key',f.object_key,'bytes'$a$,$a$'object_key',f.object_key,'bucket_id',target_bucket,'mime',f.mime,'bytes'$a$);

 body:=pg_get_functiondef('private.p07_storage_erasure_confirm(jsonb,uuid)'::regprocedure);
 anchor:=$a$o.bucket_id='ftksaas-imports' and o.name=i.object_key$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Managed Storage confirmation anchor mismatch';end if;
 execute replace(body,anchor,'o.bucket_id=i.bucket_id and o.name=i.object_key');

 body:=pg_get_functiondef('private.p07_storage_object_fence()'::regprocedure);
 anchor:=$a$ if tg_op<>'DELETE' then
  if new.bucket_id='ftksaas-imports' and exists(select 1 from private.p07_storage_erasure_intents x where x.object_key=new.name) then$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Managed Storage object fence anchor mismatch';end if;
 body:=replace(body,anchor,$a$ if tg_op<>'DELETE' then
  if exists(select 1 from private.p07_storage_erasure_intents x where x.bucket_id=new.bucket_id and x.object_key=new.name)
   or exists(select 1 from private.organization_managed_file_erasure_receipts e
    where e.org_id::text=lower(split_part(new.name,'/',1)))
   or (tg_op='UPDATE' and (
    exists(select 1 from private.p07_storage_erasure_intents x where x.bucket_id=old.bucket_id and x.object_key=old.name)
    or exists(select 1 from private.organization_managed_file_erasure_receipts e where e.org_id::text=lower(split_part(old.name,'/',1)))
   )) then$a$);
 body:=replace(body,$a$ if old.bucket_id<>'ftksaas-imports' then return old;end if;
 select * into i from private.p07_storage_erasure_intents where object_key=old.name;$a$,
 $a$ select * into i from private.p07_storage_erasure_intents where bucket_id=old.bucket_id and object_key=old.name;$a$);
 body:=replace(body,'private.p07_storage_import_target(j,i.file_id)','private.p07_managed_file_target(j,i.file_id)');
 execute replace(body,'private.p07_storage_import_held(f,old.id)','private.p07_managed_file_held(f,old.id)');
end$patch$;

create function private.organization_managed_file_erasure(target_request uuid,target_org uuid,receipt uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare lease timestamptz;source jsonb;unknown_files bigint;live_objects bigint;unconfirmed_deletions bigint;live_exports bigint;
 live_import_copies bigint;live_previews bigint;live_contexts bigint;live_org_media bigint;unarchived_invoices bigint;
 contexts_removed int;payloads_removed int;observed_objects bigint;unproved_observations bigint;
begin
 perform private.p07_privacy_scope(target_org);
 perform 1 from private.organization_managed_file_erasure_scopes s where s.db_role=session_user and s.request_id=target_request
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
 begin
  -- Do not wait behind a provider DELETE whose row fence needs this job lease.
  lock table storage.objects in share mode nowait;
 exception when lock_not_available then
  return jsonb_build_object('state','retry_wait');
 end;

 -- Retain the provenance identifiers and digest, but clear an upload name
 -- once its exact immutable byte receipt exists and no retention hold applies.
 with verified as materialized (
  select f.id,f.purpose from private.p07_confirmed_file_metadata(target_request,target_org) f
 ), documents as (
  update private.p05_files p set name=p.file_id::text from verified f
   where f.id=p.file_id and f.purpose='document' and p.name<>p.file_id::text
 )
 update private.p06_files p set filename=p.file_id::text from verified f
  where f.id=p.file_id and f.purpose='import' and p.filename<>p.file_id::text;

 -- Import copies use their separate terminal-job and source fingerprint
 -- policy. Other temporary tracking and settled preview copies have exact
 -- immutable parent rows that survive this transaction.
 with available as (
  select c.receipt_id from private.p06_contexts c join core.operation_receipts r on r.id=c.receipt_id
  where c.org_id=target_org and r.org_id=target_org and c.account_id=r.actor_account_id and c.operation=r.operation
   and r.state in ('succeeded','failed_final','result_expired') and c.operation not in ('import_preview_v1','import_apply_v1')
   and not exists(select 1 from core.retention_holds h where
    (h.subject_table in ('accounts','core.accounts') and h.subject_id=c.account_id)
    or (h.org_id=target_org and (
     (h.subject_table in ('organizations','core.organizations') and h.subject_id=target_org)
     or (h.subject_table in ('operation_receipts','core.operation_receipts','p06_contexts','private.p06_contexts') and h.subject_id=c.receipt_id)
     or h.subject_id=r.business_reference
    )))
  order by c.receipt_id limit 100
 )
 delete from private.p06_contexts using available where p06_contexts.receipt_id=available.receipt_id;
 get diagnostics contexts_removed=row_count;
 with available as (
  select q.preview_id from private.preview_payloads q join core.previews p on p.id=q.preview_id
  where p.org_id=target_org and p.operation<>'import_apply_v1'
   and (p.state in ('applied','expired','invalidated') or q.expires_at<=clock_timestamp())
   and not exists(select 1 from core.retention_holds h where
    (h.subject_table in ('accounts','core.accounts') and h.subject_id=p.actor_account_id)
    or (h.org_id=target_org and (
     (h.subject_table in ('organizations','core.organizations') and h.subject_id=target_org)
     or (h.subject_table in ('previews','core.previews','preview_payloads','private.preview_payloads') and h.subject_id=p.id)
    )))
  order by q.preview_id limit 100
 )
 delete from private.preview_payloads using available where preview_payloads.preview_id=available.preview_id;
 get diagnostics payloads_removed=row_count;
 if contexts_removed+payloads_removed>0 then
  insert into private.organization_file_copy_erasure_receipts(operation_id,request_id,org_id,removed_contexts,removed_preview_payloads)
  values(receipt,target_request,target_org,contexts_removed,payloads_removed);
 end if;
 if lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;

 select count(*) into live_objects from storage.objects o
 where lower(split_part(o.name,'/',1))=target_org::text;
 insert into private.organization_managed_storage_census(request_id,object_id,bucket_id,object_key_hash)
 select target_request,o.id,o.bucket_id,encode(extensions.digest(o.name,'sha256'),'hex')
 from storage.objects o where lower(split_part(o.name,'/',1))=target_org::text
 on conflict(request_id,object_id) do nothing;
 select count(*),count(*) filter(where not exists(
  select 1 from private.p07_storage_erasures e join private.p07_storage_erasure_intents i on i.file_id=e.file_id
  where e.request_id=target_request and e.object_id=c.object_id and i.bucket_id=c.bucket_id
   and encode(extensions.digest(i.object_key,'sha256'),'hex')=c.object_key_hash
 )) into observed_objects,unproved_observations
 from private.organization_managed_storage_census c where c.request_id=target_request;
 select count(*) into unknown_files from core.files f where f.org_id=target_org and not (
  (f.purpose='export' and exists(
   select 1 from private.p06_export_purges e where e.file_id=f.id and e.checksum=f.checksum and e.removed_bytes=f.size_bytes
    and (e.request_id is not distinct from target_request or e.reason='expired')
  ))
  or (f.purpose in ('import','document') and exists(
   select 1 from private.p07_storage_erasures e join private.p07_storage_erasure_intents i on i.file_id=e.file_id
   where e.file_id=f.id and e.request_id=target_request and i.request_id=e.request_id
    and e.object_id=i.object_id and e.checksum=f.checksum and e.removed_bytes=f.size_bytes
    and i.object_key=f.object_key and i.bucket_id=case f.purpose when 'import' then 'ftksaas-imports' else 'ftksaas-documents' end
    and not exists(select 1 from storage.objects o where o.id=e.object_id)
  ))
 );
 select count(*) into unconfirmed_deletions from private.p07_storage_erasure_intents i join core.files f on f.id=i.file_id
 where f.org_id=target_org and not exists(
  select 1 from private.p07_storage_erasures e where e.file_id=i.file_id and e.request_id=target_request and e.object_id=i.object_id
 );
 select count(*) into live_exports from private.p06_organization_export_candidates(target_org);
 select count(*) into live_import_copies from core.import_rows where org_id=target_org and payload<>'{}'::jsonb;
 select (select count(*) from private.p06_previews where org_id=target_org)
  +(select count(*) from private.preview_payloads q join core.previews p on p.id=q.preview_id where p.org_id=target_org)
  into live_previews;
 select count(*) into live_contexts from private.p06_contexts c left join core.operation_receipts r on r.id=c.receipt_id
 where c.org_id=target_org or r.org_id=target_org;
 select count(*) into live_org_media from private.settings_media_assets m where m.scope_key='organization:'||target_org;
 select count(*) into unarchived_invoices from private.platform_invoices where org_id=target_org;
 source:=jsonb_build_object('live_objects',live_objects,'unproved_file_records',unknown_files,
  'unconfirmed_deletions',unconfirmed_deletions,'live_exports',live_exports,'live_import_copies',live_import_copies,
  'live_previews',live_previews,'live_contexts',live_contexts,'live_org_media',live_org_media,'unarchived_invoices',unarchived_invoices,
  'observed_objects',observed_objects,'unproved_storage_observations',unproved_observations);
 if live_objects+unknown_files+unconfirmed_deletions+live_exports+live_import_copies+live_previews+live_contexts+live_org_media
  +unarchived_invoices+unproved_observations>0 then
  return jsonb_build_object('state','blocked_residual','inventory',source);
 end if;
 if lease<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 insert into private.organization_managed_file_erasure_receipts(request_id,org_id,operation_id,inventory)
 values(target_request,target_org,receipt,source) on conflict(request_id) do nothing;
 return jsonb_build_object('state','completed','inventory',source);
end$$;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Organization managed-file manifestation anchor mismatch';end if;
 body:=replace(body,$a$(select count(*) from private.p07_storage_erasures e where e.request_id=p.id)$a$,
 $a$(select count(*) from private.p07_storage_erasures e join private.p07_storage_erasure_intents i on i.file_id=e.file_id
    where e.request_id=p.id and i.bucket_id='ftksaas-imports')$a$);
 execute replace(body,anchor,$a$ if org is not null then
  scopes:=jsonb_set(scopes,'{exports,managed_file_erasure}',private.organization_managed_file_erasure(p.id,org,receipt_id));
 end if;
$a$||anchor);
end$patch$;
revoke all on function private.p07_managed_file_target(private.p07_privacy_jobs,uuid),private.p07_managed_file_owner(core.files),
 private.p07_managed_file_held(core.files,uuid),private.p07_confirmed_file_metadata(uuid,uuid),
 private.organization_managed_file_erasure(uuid,uuid,uuid)
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

commit;
