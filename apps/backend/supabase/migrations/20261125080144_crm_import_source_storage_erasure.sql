begin;

alter table private.p07_storage_erasure_intents
 add column crm_import_verified_lease_hash text check(crm_import_verified_lease_hash~'^[a-f0-9]{64}$'),
 add column crm_import_rows_sha256 text check(crm_import_rows_sha256~'^[a-f0-9]{64}$'),
 add constraint p07_crm_import_source_witness_check
 check((crm_import_verified_lease_hash is null)=(crm_import_rows_sha256 is null)
  and (crm_import_verified_lease_hash is null or linked_import_attestation));

create function private.p07_crm_import_source_rows(i core.import_jobs)
 returns table(row_number bigint,source_key text,payload_hash text,application_id uuid,intake jsonb)
 language sql stable security invoker set search_path='' as $$
 select r.row_number,r.source_key,s.payload_hash,a.id,a.intake
 from core.import_rows r
 join private.p06_sources s on s.org_id=r.org_id and s.center_id=r.center_id
  and s.source_namespace=r.source_namespace and s.source_key=r.source_key and s.import_kind='crm_applications'
  and s.payload_hash~'^[a-f0-9]{64}$'
  and s.created_references=jsonb_build_array(jsonb_build_object('type','public_applications','id',s.application_id))
 join core.public_applications a on a.org_id=r.org_id and a.id=s.application_id
 join core.import_rows original on original.org_id=a.org_id and original.id=a.import_row_id
  and original.center_id=r.center_id and original.source_namespace=r.source_namespace and original.source_key=r.source_key
  and original.state='applied' and original.created_references=array[a.id]
 join core.import_jobs source_job on source_job.org_id=original.org_id and source_job.center_id=original.center_id
  and source_job.id=original.job_id and source_job.source_namespace=original.source_namespace
  and source_job.mapping->>'kind'='crm_applications' and source_job.state='succeeded'
 join core.operation_receipts op on op.id=s.operation_id and op.org_id=r.org_id
  and op.business_reference=source_job.id and op.operation='import_rows_process_v1'
  and ((op.state='succeeded' and op.result#>'{data,result_reference}'=jsonb_build_object('type','import_jobs','id',source_job.id)
        and op.result#>>'{data,state}'='succeeded') or (op.state='result_expired' and op.result is null))
 where r.job_id=i.id and r.org_id=i.org_id and r.center_id=i.center_id and r.source_namespace=i.source_namespace
  and i.mapping->>'kind'='crm_applications' and r.state='applied' and r.payload='{}'::jsonb
  and r.created_references=array[a.id]
  and a.target_contact=a.intake->>'phone'
  and a.target_hash=encode(extensions.digest(a.org_id::text||':'||encode(extensions.digest(a.target_contact,'sha256'),'hex'),'sha256'),'hex')
  and a.source_snapshot @> jsonb_build_object('channel','legacy_import','import_job_id',source_job.id,
   'row_number',original.row_number,'source_namespace',r.source_namespace,'source_key',r.source_key,
   'file_checksum',source_job.file_checksum)
$$;

create function private.p07_crm_import_source_fingerprint(i core.import_jobs) returns text
 language sql stable security invoker set search_path='' as $$
 select encode(extensions.digest(jsonb_build_array(i.mapping,
  jsonb_agg(to_jsonb(x) order by x.row_number))::text,'sha256'),'hex')
 from private.p07_crm_import_source_rows(i) x
 having count(*)>0
$$;

-- The existing attestor still binds the physical source to the lease and
-- object version. Only the normalized CSV rows enter this check and they are
-- compared in memory, with no new copy written.
create function private.p07_crm_import_storage_authorize(r jsonb,target uuid,checksum text,bytes bigint,parsed jsonb)
 returns void language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;i core.import_jobs;row_count int;fingerprint text;
begin
 if jsonb_typeof(parsed) is distinct from 'array' then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 row_count:=jsonb_array_length(parsed);
 if row_count not between 1 and 5000 then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 perform private.p07_linked_import_storage_witness(r,target,'authorize',checksum,bytes);
 j:=private.p07_storage_erasure_job(r);
 select * into i from core.import_jobs x where x.org_id=j.org_id and x.file_id=target and x.mapping->>'kind'='crm_applications';
 if i.id is null or row_count<>(select count(*) from private.p07_crm_import_source_rows(i)) then
  perform private.fail('RESULT_NOT_CONFIRMED');
 end if;
 if exists(
  select 1 from jsonb_to_recordset(parsed) as x(row_number bigint,payload jsonb)
  full join private.p07_crm_import_source_rows(i) y using(row_number)
  where x.row_number is null or y.row_number is null
   or x.payload->'consents' is distinct from '[]'::jsonb
   or x.payload-ARRAY['source_key','display_name','phone','email','consents']<>'{}'::jsonb
   or x.payload->>'source_key' is distinct from y.source_key
   or encode(extensions.digest(x.payload::text,'sha256'),'hex') is distinct from y.payload_hash
   or x.payload-'source_key' is distinct from y.intake
  ) or row_count<>(select count(distinct x.row_number) from jsonb_to_recordset(parsed) as x(row_number bigint))
 then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 fingerprint:=private.p07_crm_import_source_fingerprint(i);
 if fingerprint is null or j.lease_until<=clock_timestamp() then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 update private.p07_storage_erasure_intents e set crm_import_verified_lease_hash=j.lease_hash,crm_import_rows_sha256=fingerprint
 where e.file_id=target and e.request_id=j.request_id and e.linked_import_lease_hash=j.lease_hash;
 if not found then perform private.fail('RESULT_NOT_CONFIRMED');end if;
end$$;

revoke all on function private.p07_crm_import_source_rows(core.import_jobs),private.p07_crm_import_source_fingerprint(core.import_jobs),
 private.p07_crm_import_storage_authorize(jsonb,uuid,text,bigint,jsonb)
 from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.p07_crm_import_storage_authorize(jsonb,uuid,text,bigint,jsonb) to ftk_p07_storage_attestor;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_linked_import_source_ready(private.p07_privacy_jobs,core.files,uuid)'::regprocedure);
 anchor:=$q$ return not exists(
  select 1 from core.import_rows r$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM original source readiness anchor mismatch';end if;
 execute replace(body,anchor,$q$ if i.mapping->>'kind'='crm_applications' then
  lock table core.leads in share mode nowait;
  return w.request->'mapping' is not distinct from i.mapping and exists(
   select 1 from core.previews p where p.id=i.preview_id and p.org_id=i.org_id and p.scope_hash=md5(w.request::text))
   and w.total_count=(select count(*) from private.p07_crm_import_source_rows(i));
 end if;
$q$||anchor);

 body:=pg_get_functiondef('private.p07_linked_import_source_held(core.files)'::regprocedure);
 anchor:=$q$ select exists(
  select 1 from core.import_jobs i join core.retention_holds h on h.org_id=i.org_id$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM original source hold anchor mismatch';end if;
 execute replace(body,anchor,$q$ select exists(
  select 1 from core.import_jobs i where i.org_id=f.org_id and i.file_id=f.id and i.mapping->>'kind'='crm_applications'
   and (exists(select 1 from private.p06_held_crm_import_rows(i.org_id,i.id))
    or exists(select 1 from private.p07_crm_import_source_rows(i) x where x.intake->'consents' is distinct from '[]'::jsonb))
 ) or exists(
  select 1 from core.import_jobs i join core.retention_holds h on h.org_id=i.org_id$q$);

 body:=pg_get_functiondef('private.p07_storage_erasure_prepare(jsonb,uuid)'::regprocedure);
 anchor:=$q$'bytes',f.size_bytes,'checksum',f.checksum,'linked_import_attestation',linked);$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM original source mapping anchor mismatch';end if;
 execute replace(body,anchor,$q$'bytes',f.size_bytes,'checksum',f.checksum,'linked_import_attestation',linked)
  ||coalesce((select jsonb_build_object('crm_import_mapping',x.mapping)
   from core.import_jobs x where x.file_id=f.id and x.org_id=f.org_id and x.mapping->>'kind'='crm_applications'),'{}'::jsonb);$q$);

 body:=pg_get_functiondef('private.p07_storage_object_fence()'::regprocedure);
 anchor:=$q$ if f.object_key<>i.object_key or f.size_bytes<>i.bytes or f.checksum<>i.checksum$q$;
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'CRM original source Storage fence anchor mismatch';end if;
 execute replace(body,anchor,$q$ if exists(
  select 1 from core.import_jobs x where x.file_id=f.id and x.org_id=f.org_id and x.mapping->>'kind'='crm_applications'
   and (i.crm_import_verified_lease_hash is distinct from j.lease_hash or i.crm_import_rows_sha256 is null
    or i.crm_import_rows_sha256 is distinct from private.p07_crm_import_source_fingerprint(x))
 ) then perform private.fail('FORBIDDEN');end if;
$q$||anchor);
end$patch$;

commit;
