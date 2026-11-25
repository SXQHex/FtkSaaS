begin;

-- Only the operator can bind an approved archive receipt to this exact P07 source.
create table private.organization_invoice_erasures(
 invoice_id uuid primary key,request_id uuid not null,org_id uuid not null,
 object_id uuid not null unique,object_version text not null,
 object_key text generated always as (org_id::text||'/'||invoice_id::text) stored unique,
 source_fingerprint text not null check(source_fingerprint~'^[a-f0-9]{64}$'),
 source_project_ref text not null check(source_project_ref~'^[a-z]{20}$'),
 archive_receipt_sha256 text not null check(archive_receipt_sha256~'^[a-f0-9]{64}$'),
 archive_scope_sha256 text not null check(archive_scope_sha256~'^[a-f0-9]{64}$'),
 approval_id uuid not null unique,retain_until timestamptz not null,
 worker_role name not null,attestor_role name not null check(attestor_role<>worker_role),
 provider_origin text not null check(provider_origin~'^https://[a-z]{20}\.supabase\.co$' or provider_origin~'^http://(127\.0\.0\.1|localhost):[0-9]+$'),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 authorized_lease_hash text,metadata_deleted_at timestamptz,completed_at timestamptz,
 blob_sha256 text check(blob_sha256~'^[a-f0-9]{64}$'),
 removed_bytes int check(removed_bytes between 1 and 2097152),
 foreign key(org_id,request_id) references core.privacy_requests(org_id,id),
 check(metadata_deleted_at is null or authorized_lease_hash is not null),
 check((completed_at is null and blob_sha256 is null and removed_bytes is null) or
  (completed_at is not null and metadata_deleted_at is not null and blob_sha256 is not null and removed_bytes is not null))
);
create index organization_invoice_erasures_request on private.organization_invoice_erasures(org_id,request_id);
alter table private.organization_invoice_erasures enable row level security;
revoke all on private.organization_invoice_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;

create function private.organization_invoice_erasure_immutable() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if old.completed_at is not null then perform private.fail('INTEGRITY_VIOLATION');end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end$$;
create trigger organization_invoice_erasure_immutable before update or delete on private.organization_invoice_erasures
 for each row execute function private.organization_invoice_erasure_immutable();

create function private.organization_invoice_source_fingerprint(i private.platform_invoices) returns text
 language sql stable security invoker set search_path='' as $$
 select encode(extensions.digest(jsonb_build_array(i.id,i.org_id,i.invoice_number,i.issued_on-date '2000-01-01',extract(epoch from i.published_at),i.mime,i.bytes,i.checksum)::text,'sha256'),'hex')
$$;

create function private.organization_invoice_erasure_source(j private.p07_privacy_jobs,a private.organization_invoice_erasures)
 returns private.platform_invoices language plpgsql security invoker set search_path='' as $$
declare p core.privacy_requests;i private.platform_invoices;
begin
 if j.id is null or j.org_id is distinct from a.org_id or j.request_id<>a.request_id
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=a.worker_role and s.org_id=a.org_id for share)
  or not pg_has_role(a.worker_role,'ftk_p07_privacy_worker','member')
  or not pg_has_role(a.attestor_role,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;
 select * into p from core.privacy_requests where id=a.request_id and org_id=a.org_id for share;
 if p.id is null or p.kind<>'organization_delete' or p.state not in ('requested','running','partial')
  or p.scope is distinct from jsonb_build_object('kind','organization','org_id',a.org_id,'account_id',null,'all_data',true)
  or not exists(select 1 from core.organizations o where o.id=a.org_id and o.state='deletion_pending' for share)
  or not exists(select 1 from storage.buckets b where b.id='ftksaas-invoices' and not b.public
   and coalesce(to_jsonb(b)->>'versioning_status','DISABLED')='DISABLED' for share)
  then perform private.fail('FORBIDDEN');end if;
 lock table core.retention_holds in share mode;
 if exists(select 1 from core.retention_holds h where
  (h.org_id=a.org_id and h.subject_id in (a.request_id,a.org_id,a.invoice_id,a.object_id))
  or (h.org_id is null and h.subject_table='accounts' and h.subject_id=p.requester_account_id)) then return null;end if;
 select * into i from private.platform_invoices where id=a.invoice_id and org_id=a.org_id and published_at is not null for update;
 if i.id is null or private.organization_invoice_source_fingerprint(i)<>a.source_fingerprint
  or a.retain_until<=clock_timestamp() then perform private.fail('INTEGRITY_VIOLATION');end if;
 return i;
end$$;

create function private.organization_invoice_erasure_stage(r jsonb,target uuid,phase text,archive_sha text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;a private.organization_invoice_erasures;i private.platform_invoices;o storage.objects;
begin
 if phase not in ('prepare','authorize','confirm') or phase is null then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 if phase='prepare' then perform private.p07_privacy_scope(j.org_id);
 elsif not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;
 select * into a from private.organization_invoice_erasures where invoice_id=target and request_id=j.request_id and org_id=j.org_id
  and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for update;
 if phase='prepare' and a.invoice_id is null then return jsonb_build_object('state','unbound');end if;
 if a.invoice_id is null or (phase='prepare' and a.worker_role<>session_user)
  or (phase<>'prepare' and a.attestor_role<>session_user)
  then perform private.fail('FORBIDDEN');end if;
 if a.completed_at is not null then
  return jsonb_build_object('state','completed','archive_receipt_sha256',a.archive_receipt_sha256);
 end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 i:=private.organization_invoice_erasure_source(j,a);
 if i.id is null then return jsonb_build_object('state','held');end if;
 select * into o from storage.objects where bucket_id='ftksaas-invoices' and name=a.object_key;
 if phase='confirm' then
  if archive_sha is distinct from a.archive_receipt_sha256 or a.authorized_lease_hash is distinct from j.lease_hash
   or a.metadata_deleted_at is null or o.id is not null or exists(select 1 from storage.objects where id=a.object_id)
   or j.lease_until<=clock_timestamp() then perform private.fail('RESULT_NOT_CONFIRMED');end if;
  delete from private.platform_invoices where id=a.invoice_id and org_id=a.org_id;
  update private.organization_invoice_erasures set completed_at=clock_timestamp(),blob_sha256=i.checksum,removed_bytes=i.bytes
   where invoice_id=a.invoice_id;
  return jsonb_build_object('state','completed','archive_receipt_sha256',a.archive_receipt_sha256);
 end if;
 if a.metadata_deleted_at is not null then return jsonb_build_object('state','unconfirmed');end if;
 if o.id is distinct from a.object_id or to_jsonb(o)->>'version' is distinct from a.object_version
  or j.lease_until<=clock_timestamp() then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 if phase='authorize' then
  if archive_sha is distinct from a.archive_receipt_sha256 then perform private.fail('FORBIDDEN');end if;
  update private.organization_invoice_erasures set authorized_lease_hash=j.lease_hash where invoice_id=a.invoice_id;
  return jsonb_build_object('state','authorized');
 end if;
 return jsonb_build_object('state','ready','request_id',a.request_id,'org_id',a.org_id,'object_id',a.object_id,
  'object_version',a.object_version,'source_fingerprint',a.source_fingerprint,'source_project_ref',a.source_project_ref,'archive_receipt_sha256',a.archive_receipt_sha256,
  'archive_scope_sha256',a.archive_scope_sha256,'approval_id',a.approval_id,'retain_until',a.retain_until,
  'provider_origin',a.provider_origin,'bucket_id','ftksaas-invoices','object_key',a.object_key,'bytes',i.bytes,'mime',i.mime,'checksum',i.checksum);
end$$;

create function private.organization_invoice_object_fence() returns trigger
 language plpgsql security definer set search_path='' as $$
declare a private.organization_invoice_erasures;j private.p07_privacy_jobs;i private.platform_invoices;
begin
 if tg_op<>'DELETE' and new.bucket_id='ftksaas-invoices' and
  exists(select 1 from private.organization_invoice_erasures x where x.object_key=new.name) then perform private.fail('FORBIDDEN');end if;
 if tg_op='INSERT' then return new;end if;
 if old.bucket_id='ftksaas-invoices' then
  select * into a from private.organization_invoice_erasures where object_key=old.name;
 end if;
 if a.invoice_id is null then
  if tg_op='DELETE' then return old;end if;
  return new;
 end if;
 if tg_op<>'DELETE' then perform private.fail('FORBIDDEN');end if;
 select * into j from private.p07_privacy_jobs where request_id=a.request_id and org_id=a.org_id for share;
 select * into a from private.organization_invoice_erasures where invoice_id=a.invoice_id for update;
 if a.invoice_id is null or j.state is distinct from 'running' or j.lease_until<=clock_timestamp()
  or j.lease_until is null or j.lease_hash is null or a.authorized_lease_hash is distinct from j.lease_hash
  or a.instance_id<>(pg_catalog.pg_control_system()).system_identifier::text or a.metadata_deleted_at is not null
  or old.id<>a.object_id or to_jsonb(old)->>'version' is distinct from a.object_version
  then perform private.fail('FORBIDDEN');end if;
 i:=private.organization_invoice_erasure_source(j,a);
 if i.id is null or j.lease_until<=clock_timestamp() or a.retain_until<=clock_timestamp()
  then perform private.fail('FORBIDDEN');end if;
 update private.organization_invoice_erasures set metadata_deleted_at=clock_timestamp() where invoice_id=a.invoice_id;
 return old;
end$$;
create trigger organization_invoice_object_fence before insert or update or delete on storage.objects
 for each row execute function private.organization_invoice_object_fence();

revoke all on function private.organization_invoice_erasure_immutable(),private.organization_invoice_source_fingerprint(private.platform_invoices),
 private.organization_invoice_erasure_source(private.p07_privacy_jobs,private.organization_invoice_erasures),
 private.organization_invoice_erasure_stage(jsonb,uuid,text,text),private.organization_invoice_object_fence()
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.organization_invoice_erasure_stage(jsonb,uuid,text,text) to ftk_p07_privacy_worker,ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.organization_live_database_footprint(text)'::regprocedure);
 anchor:=$a$      and r.object_key_hash=encode(extensions.digest(f.object_key,''sha256''),''hex'')
   )'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice DB census anchor mismatch';end if;
 body:=replace(body,anchor,$a$      and r.object_key_hash=encode(extensions.digest(f.object_key,''sha256''),''hex'')
   ) or r.request_id=$6 and exists(
    select 1 from private.organization_invoice_erasures a where a.request_id=$6 and a.org_id=$2
     and a.object_id=r.object_id and a.completed_at is not null and r.bucket_id=''ftksaas-invoices''
     and encode(extensions.digest(a.object_key,''sha256''),''hex'')=r.object_key_hash
   )'$a$);

 anchor:=$a$  when 'private.organization_live_database_erasure_receipts'$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice DB footprint anchor mismatch';end if;
 execute replace(body,anchor,$a$  when 'private.organization_invoice_erasures' then 'r.request_id=$6 and r.org_id=$2 and r.completed_at is not null'
$a$||anchor);

 body:=pg_get_functiondef('private.organization_live_database_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=$a$ ||array(select id from private.p07_lifecycle_events where operation_id=any(operation_ids));$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice DB scope anchor mismatch';end if;
 execute replace(body,anchor,$a$ ||array(select id from private.p07_lifecycle_events where operation_id=any(operation_ids))
  ||array(select id from private.organization_invoice_erasures a
    cross join lateral unnest(array[a.invoice_id,a.object_id]) as subject(id)
    where a.request_id=target_request and a.org_id=target_org and a.completed_at is not null);$a$);

 body:=pg_get_functiondef('private.organization_managed_file_erasure(uuid,uuid,uuid)'::regprocedure);
 anchor:=' contexts_removed int;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice census declaration anchor mismatch';end if;
 body:=replace(body,anchor,' invoice_purges bigint;pending_invoice_purges bigint;invoice_archives_sha256 text;'||anchor);
 anchor:=$a$ )) into observed_objects,unproved_observations$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice census proof anchor mismatch';end if;
 body:=replace(body,anchor,$a$ ) and not exists(
  select 1 from private.organization_invoice_erasures a where a.request_id=target_request and a.org_id=target_org
   and a.object_id=c.object_id and a.completed_at is not null and c.bucket_id='ftksaas-invoices'
   and encode(extensions.digest(a.object_key,'sha256'),'hex')=c.object_key_hash
 )) into observed_objects,unproved_observations$a$);
 anchor:=' source:=jsonb_build_object(';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice inventory anchor mismatch';end if;
 body:=replace(body,anchor,$a$ select count(*) filter(where a.completed_at is not null),count(*) filter(where a.completed_at is null),
  encode(extensions.digest(jsonb_agg(jsonb_build_array(a.invoice_id,a.object_id,a.source_fingerprint,a.archive_receipt_sha256,
   a.blob_sha256,a.removed_bytes) order by a.invoice_id) filter(where a.completed_at is not null)::text,'sha256'),'hex')
 into invoice_purges,pending_invoice_purges,invoice_archives_sha256 from private.organization_invoice_erasures a
 where a.request_id=target_request and a.org_id=target_org;
$a$||anchor);
 anchor:=$a$'observed_objects',observed_objects,'unproved_storage_observations',unproved_observations);$a$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice receipt inventory anchor mismatch';end if;
 body:=replace(body,anchor,$a$'observed_objects',observed_objects,'unproved_storage_observations',unproved_observations);
 if invoice_purges+pending_invoice_purges>0 then source:=source||jsonb_build_object(
  'archived_invoice_purges',invoice_purges,'pending_invoice_purges',pending_invoice_purges,'invoice_archives_sha256',invoice_archives_sha256);end if;$a$);
 anchor:='  +unarchived_invoices+unproved_observations>0 then';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Invoice residual gate anchor mismatch';end if;
 execute replace(body,anchor,'  +unarchived_invoices+unproved_observations+pending_invoice_purges>0 then');
end$patch$;
commit;
