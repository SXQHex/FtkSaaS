begin;

alter table private.p07_storage_erasure_intents
 add column linked_import_attestation boolean not null default false,
 add column linked_import_lease_hash text check(linked_import_lease_hash~'^[a-f0-9]{64}$'),
 add column linked_import_operation_key uuid,
 add column linked_import_attestor_role name,
 add column linked_import_origin text,
 add column linked_import_acknowledged_at timestamptz,
 add constraint p07_linked_import_storage_attestation_check
 check((linked_import_lease_hash is null or linked_import_attestation)
  and (linked_import_lease_hash is null)=(linked_import_operation_key is null)
  and (linked_import_lease_hash is null)=(linked_import_attestor_role is null)
  and (linked_import_lease_hash is null)=(linked_import_origin is null)
  and (linked_import_acknowledged_at is null or (linked_import_lease_hash is not null and metadata_deleted_at is not null)));

create function private.p07_linked_import_storage_witness(r jsonb,target uuid,phase text,expected_checksum text,expected_bytes bigint) returns void
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;i private.p07_storage_erasure_intents;f core.files;origin text;
begin
 if not pg_has_role(session_user,'ftk_p07_storage_attestor','member') or phase is null or phase not in ('authorize','acknowledge')
  or pg_catalog.current_setting('transaction_isolation')<>'read committed'
 then perform private.fail('FORBIDDEN');end if;
 if phase='acknowledge' then
  -- A definitive provider response can arrive after the deletion lease has
  -- expired. The metadata tombstone ties it to the historical authorization.
  select x.* into i from private.p07_storage_erasure_intents x
  join private.p07_privacy_jobs old_job on old_job.id=x.job_id and old_job.request_id=x.request_id
  where x.file_id=target and x.job_id=(r->>'job_id')::uuid and old_job.org_id=(r->>'org_id')::uuid
   and r->>'center_id' is null and x.linked_import_attestation and x.linked_import_attestor_role=session_user
   and x.linked_import_operation_key=(r->>'operation_key')::uuid
   and x.linked_import_lease_hash=encode(extensions.digest(r->>'lease_token','sha256'),'hex')
   and x.checksum=expected_checksum and x.bytes=expected_bytes for update of x;
  if i.file_id is null or i.metadata_deleted_at is null or exists(
   select 1 from storage.objects o where o.id=i.object_id or (o.bucket_id=i.bucket_id and o.name=i.object_key)
  ) then perform private.fail('RESULT_NOT_CONFIRMED');end if;
  perform private.organization_require_erasure_fence(i.request_id,(r->>'org_id')::uuid);
  update private.p07_storage_erasure_intents
  set linked_import_acknowledged_at=coalesce(i.linked_import_acknowledged_at,clock_timestamp()) where file_id=target;
  return;
 end if;

 j:=private.p07_storage_erasure_job(r);
 select x.* into i from private.p07_storage_erasure_intents x
 where x.file_id=target and x.request_id=j.request_id and x.job_id=j.id
  and x.operation_key=j.operation_key and x.linked_import_attestation
  and x.bucket_id='ftksaas-imports' and x.object_key=j.org_id::text||'/'||target::text
  and x.checksum=expected_checksum and x.bytes=expected_bytes for update;
 select s.provider_origin into origin from private.p07_storage_erasure_scopes s
 where s.db_role=i.db_role and s.attestor_role=session_user and s.file_id=target and s.request_id=i.request_id
  and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if i.file_id is null or j.org_id is null or j.state<>'running' or j.lease_hash is null or j.lease_until is null
  or j.lease_until<=clock_timestamp() or origin is null
  or (i.linked_import_origin is not null and i.linked_import_origin<>origin) then perform private.fail('FORBIDDEN');end if;

 f:=private.p07_storage_import_target(j,target);
 if i.metadata_deleted_at is not null or private.p07_managed_file_held(f,i.object_id) or not exists(
  select 1 from storage.objects o where o.id=i.object_id and o.bucket_id=i.bucket_id and o.name=i.object_key
   and to_jsonb(o)->>'version' is not distinct from i.object_version
 ) or j.lease_until<=clock_timestamp() then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 update private.p07_storage_erasure_intents
 set linked_import_lease_hash=j.lease_hash,linked_import_operation_key=j.operation_key,
  linked_import_attestor_role=session_user,linked_import_origin=origin where file_id=target;
end$$;
revoke all on function private.p07_linked_import_storage_witness(jsonb,uuid,text,text,bigint)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
grant execute on function private.p07_linked_import_storage_witness(jsonb,uuid,text,text,bigint) to ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_storage_erasure_prepare(jsonb,uuid)'::regprocedure);
 anchor:=';target_bucket text;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation declaration anchor mismatch';end if;
 body:=replace(body,anchor,';target_bucket text;linked boolean;');
 anchor:=$q$ f:=private.p07_managed_file_target(j,target);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation prep target anchor mismatch';end if;
 body:=replace(body,anchor,anchor||$q$
 linked:=f.purpose='import' and exists(select 1 from core.import_jobs x where x.file_id=f.id);$q$);
 anchor:=$q$ if o.id is null then return jsonb_build_object('state',case when i.file_id is null then 'absent' else 'unconfirmed' end);end if;$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation readback anchor mismatch';end if;
 body:=replace(body,anchor,$q$ if o.id is null and linked and i.linked_import_acknowledged_at is not null
  and i.job_id=j.id and i.bucket_id=target_bucket and i.linked_import_origin=origin
  and i.object_key=f.object_key and i.checksum=f.checksum and i.bytes=f.size_bytes
  and not exists(select 1 from storage.objects old where old.id=i.object_id)
  and not private.p07_managed_file_held(f,i.object_id) and j.lease_until>clock_timestamp() then
  update private.p07_storage_erasure_intents set operation_key=j.operation_key,db_role=session_user where file_id=f.id;
  return jsonb_build_object('state','readback','provider_origin',origin,'object_key',f.object_key,
   'bucket_id',target_bucket,'mime',f.mime,'bytes',f.size_bytes,'checksum',f.checksum,'linked_import_attestation',true);
 end if;
$q$||anchor);
 anchor:='operation_key,db_role,bucket_id)';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation intent column anchor mismatch';end if;
 body:=replace(body,anchor,'operation_key,db_role,bucket_id,linked_import_attestation)');
 anchor:='session_user,target_bucket)';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation intent value anchor mismatch';end if;
 body:=replace(body,anchor,'session_user,target_bucket,linked)');
 anchor:='operation_key=excluded.operation_key,db_role=excluded.db_role;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation intent refresh anchor mismatch';end if;
 body:=replace(body,anchor,'operation_key=excluded.operation_key,db_role=excluded.db_role,linked_import_attestation=excluded.linked_import_attestation;');
 anchor:=$q$'bytes',f.size_bytes,'checksum',f.checksum);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation prep evidence anchor mismatch';end if;
 execute replace(body,anchor,$q$'bytes',f.size_bytes,'checksum',f.checksum,'linked_import_attestation',linked);$q$);

 body:=pg_get_functiondef('private.p07_storage_object_fence()'::regprocedure);
 anchor:=$q$ f:=private.p07_managed_file_target(j,i.file_id);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation provider guard anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
 if (i.linked_import_attestation or exists(select 1 from core.import_jobs x where x.file_id=f.id))
  and (not i.linked_import_attestation or i.linked_import_lease_hash is distinct from j.lease_hash
   or i.linked_import_lease_hash is null or i.linked_import_acknowledged_at is not null
   or not exists(select 1 from private.p07_storage_erasure_scopes s where s.db_role=i.db_role
    and s.attestor_role=i.linked_import_attestor_role and s.request_id=i.request_id and s.file_id=i.file_id
    and s.provider_origin=i.linked_import_origin for share))
 then perform private.fail('FORBIDDEN');end if;$q$);

 body:=pg_get_functiondef('private.p07_storage_erasure_confirm(jsonb,uuid)'::regprocedure);
 anchor:=$q$   and s.attestor_role=session_user and s.request_id=i.request_id and s.file_id=i.file_id$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation confirmation origin anchor mismatch';end if;
 body:=replace(body,anchor,anchor||$q$
   and (not i.linked_import_attestation or s.provider_origin=i.linked_import_origin)$q$);
 anchor:=$q$  or i.operation_key is distinct from j.operation_key or i.metadata_deleted_at is null$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Linked attestation confirmation anchor mismatch';end if;
 execute replace(body,anchor,anchor||$q$
  or (i.linked_import_attestation and i.linked_import_acknowledged_at is null)$q$);
end$patch$;

commit;
