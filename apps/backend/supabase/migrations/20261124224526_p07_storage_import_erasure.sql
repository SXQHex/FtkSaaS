begin;

do $$begin
 if not exists(select 1 from pg_roles where rolname='ftk_p07_storage_attestor') then create role ftk_p07_storage_attestor nologin;end if;
end$$;
grant usage on schema private to ftk_p07_storage_attestor;
create table private.p07_storage_erasure_scopes(
 db_role name not null,request_id uuid not null references core.privacy_requests(id),
 file_id uuid not null references core.files(id),
 provider_origin text not null check(provider_origin ~ '^https://[a-z]{20}\.supabase\.co$' or provider_origin ~ '^http://(127\.0\.0\.1|localhost):[0-9]+$'),
 attestor_role name not null check(attestor_role<>db_role),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,
 primary key(db_role,request_id,file_id)
);
create table private.p07_storage_erasure_intents(
 file_id uuid primary key references core.files(id),request_id uuid not null references core.privacy_requests(id),
 object_id uuid not null unique,object_key text not null unique,object_version text,
 bytes bigint not null check(bytes between 1 and 2097152),checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 job_id uuid not null references private.p07_privacy_jobs(id),operation_key uuid not null,db_role name not null,
 metadata_deleted_at timestamptz
);
create table private.p07_storage_erasures(
 file_id uuid primary key references private.p07_storage_erasure_intents(file_id),
 request_id uuid not null references core.privacy_requests(id),object_id uuid not null,
 removed_bytes bigint not null check(removed_bytes between 1 and 2097152),
 checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 completed_at timestamptz not null default clock_timestamp()
);
create index p07_storage_erasures_request on private.p07_storage_erasures(request_id);
alter table private.p07_storage_erasure_scopes enable row level security;
alter table private.p07_storage_erasure_intents enable row level security;
alter table private.p07_storage_erasures enable row level security;
revoke all on private.p07_storage_erasure_scopes,private.p07_storage_erasure_intents,private.p07_storage_erasures
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
create trigger p07_storage_erasures_immutable before update or delete on private.p07_storage_erasures
 for each row execute function private.append_only();

create function private.p07_storage_erasure_job(r jsonb) returns private.p07_privacy_jobs
 language plpgsql security invoker set search_path='' as $$
declare j private.p07_privacy_jobs;org uuid:=(r->>'org_id')::uuid;
begin
 select * into j from private.p07_privacy_jobs
 where id=(r->>'job_id')::uuid and org_id is not distinct from org for update;
 if j.id is null or r->>'center_id' is not null or j.operation_key is distinct from (r->>'operation_key')::uuid
  or j.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') then perform private.fail('FORBIDDEN');end if;
 return j;
end$$;

create function private.p07_storage_import_target(j private.p07_privacy_jobs,target uuid) returns core.files
 language plpgsql security invoker set search_path='' as $$
declare p core.privacy_requests;f core.files;u uuid;
begin
 select * into p from core.privacy_requests where id=j.request_id and org_id is not distinct from j.org_id for share;
 select x.* into f from core.files x join private.p06_files s on s.file_id=x.id where x.id=target for share of x,s;
 select account_id into u from private.p06_files where file_id=f.id;
 if p.id is null or p.state not in ('requested','running','partial') or f.id is null or u is null
  or f.purpose<>'import' or f.state<>'pending_upload' or f.object_key is distinct from (f.org_id::text||'/'||f.id::text)
  or f.expires_at is null or f.expires_at>clock_timestamp() or f.mime<>'text/csv'
  or f.checksum is null or f.checksum !~ '^[a-f0-9]{64}$' or f.size_bytes not between 1 and 2097152
  or exists(select 1 from core.import_jobs n where n.org_id=f.org_id and n.file_id=f.id) then perform private.fail('FORBIDDEN');end if;
 if j.org_id is null then
  if p.kind<>'account_delete' or p.scope->>'account_id' is distinct from u::text or p.requester_account_id<>u
   or not exists(select 1 from core.accounts a where a.id=u and a.state='deletion_pending' for share) then perform private.fail('FORBIDDEN');end if;
 elsif p.kind<>'organization_delete' or p.scope->>'org_id' is distinct from f.org_id::text or f.org_id<>j.org_id
  or not exists(select 1 from core.organizations o where o.id=j.org_id and o.state='deletion_pending' for share) then perform private.fail('FORBIDDEN');
 end if;
 return f;
end$$;

create function private.p07_storage_import_held(f core.files,object_id uuid) returns boolean
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
   ))
 );
end$$;

create function private.p07_storage_erasure_prepare(r jsonb,target uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;f core.files;o storage.objects;i private.p07_storage_erasure_intents;origin text;
begin
 perform private.p07_privacy_scope((r->>'org_id')::uuid);
 j:=private.p07_storage_erasure_job(r);
 select s.provider_origin into origin from private.p07_storage_erasure_scopes s
 where s.db_role=session_user and s.request_id=j.request_id and s.file_id=target
  and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if origin is null then return jsonb_build_object('state','unbound');end if;
 if exists(select 1 from private.p07_storage_erasures e where e.request_id=j.request_id and e.file_id=target) then
  return jsonb_build_object('state','completed');
 end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 f:=private.p07_storage_import_target(j,target);
 if not exists(select 1 from storage.buckets b where b.id='ftksaas-imports' and not b.public
  and coalesce(to_jsonb(b)->>'versioning_status','DISABLED')='DISABLED') then perform private.fail('INTEGRITY_VIOLATION');end if;
 select * into o from storage.objects where bucket_id='ftksaas-imports' and name=f.object_key;
 select * into i from private.p07_storage_erasure_intents where file_id=target;
 if i.file_id is not null and i.request_id<>j.request_id then perform private.fail('FORBIDDEN');end if;
 if o.id is null then return jsonb_build_object('state',case when i.file_id is null then 'absent' else 'unconfirmed' end);end if;
 if private.p07_storage_import_held(f,o.id) then return jsonb_build_object('state','held');end if;
 if (i.file_id is not null and (i.object_id is distinct from o.id or i.object_version is distinct from to_jsonb(o)->>'version'
  or i.bytes<>f.size_bytes or i.checksum<>f.checksum))
  or exists(select 1 from storage.objects x where x.bucket_id=o.bucket_id and x.name=o.name and x.id<>o.id)
  or (coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner') is not null
   and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner') is distinct from
    (select a.auth_user_id::text from private.p06_files s join core.accounts a on a.id=s.account_id where s.file_id=f.id)) then
  perform private.fail('INTEGRITY_VIOLATION');
 end if;
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 insert into private.p07_storage_erasure_intents(file_id,request_id,object_id,object_key,object_version,bytes,checksum,job_id,operation_key,db_role)
 values(f.id,j.request_id,o.id,f.object_key,to_jsonb(o)->>'version',f.size_bytes,f.checksum,j.id,j.operation_key,session_user)
 on conflict(file_id) do update set job_id=excluded.job_id,operation_key=excluded.operation_key,db_role=excluded.db_role;
 return jsonb_build_object('state','ready','provider_origin',origin,'object_key',f.object_key,'bytes',f.size_bytes,'checksum',f.checksum);
end$$;

-- The provider transaction checks the live lease and holds before removing the
-- targeted metadata. This marker alone cannot attest backend byte deletion.
create function private.p07_storage_object_fence() returns trigger
 language plpgsql security definer set search_path='' as $$
declare i private.p07_storage_erasure_intents;j private.p07_privacy_jobs;f core.files;
begin
 if tg_op<>'DELETE' then
  if new.bucket_id='ftksaas-imports' and exists(select 1 from private.p07_storage_erasure_intents x where x.object_key=new.name) then
   perform private.fail('FORBIDDEN');
  end if;
  return new;
 end if;
 if old.bucket_id<>'ftksaas-imports' then return old;end if;
 select * into i from private.p07_storage_erasure_intents where object_key=old.name;
 if i.file_id is null then return old;end if;
 select * into j from private.p07_privacy_jobs where id=i.job_id for share;
 if j.id is null or j.request_id<>i.request_id or j.state<>'running'
  or j.operation_key is distinct from i.operation_key or j.lease_until is null or j.lease_until<=clock_timestamp()
  or i.object_id<>old.id or i.object_version is distinct from to_jsonb(old)->>'version'
  or not pg_has_role(i.db_role,'ftk_p07_privacy_worker','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=i.db_role and s.org_id is not distinct from j.org_id for share)
  or not exists(select 1 from private.p07_storage_erasure_scopes s where s.db_role=i.db_role and s.request_id=i.request_id
   and s.file_id=i.file_id and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share) then
  perform private.fail('FORBIDDEN');
 end if;
 f:=private.p07_storage_import_target(j,i.file_id);
 if f.object_key<>i.object_key or f.size_bytes<>i.bytes or f.checksum<>i.checksum
  or private.p07_storage_import_held(f,old.id) or j.lease_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;
 update private.p07_storage_erasure_intents set metadata_deleted_at=clock_timestamp() where file_id=i.file_id;
 return old;
end$$;
create trigger p07_storage_object_fence before insert or update or delete on storage.objects
 for each row execute function private.p07_storage_object_fence();

create function private.p07_storage_erasure_confirm(r jsonb,target uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare j private.p07_privacy_jobs;i private.p07_storage_erasure_intents;
begin
 if not pg_has_role(session_user,'ftk_p07_storage_attestor','member') then perform private.fail('FORBIDDEN');end if;
 j:=private.p07_storage_erasure_job(r);
 perform 1 from private.p07_storage_erasure_scopes s
 where s.attestor_role=session_user and s.request_id=j.request_id and s.file_id=target
  and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if not found then perform private.fail('FORBIDDEN');end if;
 if exists(select 1 from private.p07_storage_erasures e where e.request_id=j.request_id and e.file_id=target) then
  return jsonb_build_object('state','completed');
 end if;
 select * into i from private.p07_storage_erasure_intents where file_id=target;
 if i.file_id is null or i.request_id<>j.request_id
  or not exists(select 1 from private.p07_storage_erasure_scopes s where s.db_role=i.db_role
   and s.attestor_role=session_user and s.request_id=i.request_id and s.file_id=i.file_id
   and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share)
  or j.state<>'running' or j.lease_until is null
  or i.operation_key is distinct from j.operation_key or i.metadata_deleted_at is null
  or exists(select 1 from storage.objects o where o.bucket_id='ftksaas-imports' and o.name=i.object_key)
  or j.lease_until<=clock_timestamp() then perform private.fail('RESULT_NOT_CONFIRMED');end if;
 insert into private.p07_storage_erasures(file_id,request_id,object_id,removed_bytes,checksum)
 values(i.file_id,i.request_id,i.object_id,i.bytes,i.checksum);
 return jsonb_build_object('state','completed');
end$$;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Storage erasure manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if exists(select 1 from private.p07_storage_erasures e where e.request_id=p.id) then
  scopes:=jsonb_set(scopes,'{storage,import_uploads}',jsonb_build_object('confirmed_objects',
   (select count(*) from private.p07_storage_erasures e where e.request_id=p.id)));
 end if;
$a$||anchor);
end$patch$;
revoke all on function private.p07_storage_erasure_job(jsonb),private.p07_storage_import_target(private.p07_privacy_jobs,uuid),
 private.p07_storage_import_held(core.files,uuid),private.p07_storage_object_fence(),
 private.p07_storage_erasure_prepare(jsonb,uuid),private.p07_storage_erasure_confirm(jsonb,uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker,ftk_p07_storage_attestor;
grant execute on function private.p07_storage_erasure_prepare(jsonb,uuid) to ftk_p07_privacy_worker;
grant execute on function private.p07_storage_erasure_confirm(jsonb,uuid) to ftk_p07_storage_attestor;
commit;
