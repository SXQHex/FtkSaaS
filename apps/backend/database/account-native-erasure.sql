begin;
-- Explicit opt-in only: installing this migration binds no hosted account.
create table private.account_auth_erasure_scopes(
 db_role name not null,account_id uuid not null references core.accounts(id),
 provider_origin text not null check(provider_origin ~ '^https://[a-z]{20}\.supabase\.co$' or provider_origin ~ '^http://(127\.0\.0\.1|localhost):[0-9]+$'),
 instance_id text not null default (pg_catalog.pg_control_system()).system_identifier::text,primary key(db_role,account_id)
);
create table private.account_auth_erasure_permits(
 request_id uuid primary key references core.privacy_requests(id),account_id uuid not null unique references core.accounts(id),
 auth_user_id uuid not null unique,db_role name not null,job_id uuid not null references private.p07_privacy_jobs(id),
 operation_key uuid not null,lease_hash text not null,expires_at timestamptz not null
);
create table private.account_auth_erasures(
 request_id uuid primary key references core.privacy_requests(id),account_id uuid not null references core.accounts(id),
 auth_user_id uuid not null,completed_at timestamptz not null default clock_timestamp(),policy_version int not null check(policy_version=1)
);
alter table private.account_auth_erasure_scopes enable row level security;
alter table private.account_auth_erasure_permits enable row level security;
alter table private.account_auth_erasures enable row level security;
revoke all on private.account_auth_erasure_scopes,private.account_auth_erasure_permits,private.account_auth_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
create trigger account_auth_erasures_immutable before update or delete on private.account_auth_erasures for each row execute function private.append_only();

-- Called by the scoped preparer and again INSIDE the provider DELETE transaction.
-- A runner-held lock alone cannot fence a timed-out HTTP request that arrives late.
create function private.account_auth_erasure_readiness(request uuid,worker name) returns jsonb
 language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p core.privacy_requests;a core.accounts;binding private.account_auth_erasure_scopes;
begin
 select * into p from core.privacy_requests where id=request and org_id is null for update;
 select * into a from core.accounts where id=p.requester_account_id for update;
 if p.id is null or p.kind<>'account_delete' or p.scope->>'kind'<>'account'
  or p.scope->>'account_id' is distinct from a.id::text or p.state not in ('requested','running','partial')
  or a.id is null or a.state<>'deletion_pending' or a.auth_user_id is null
  or private.p07_lifecycle_owner_blocked(a.id)
  or exists(select 1 from core.account_links l where l.account_id=a.id and l.state='active')
  or exists(select 1 from private.platform_operators o where o.auth_user_id=a.auth_user_id) then perform private.fail('FORBIDDEN');end if;
 select * into binding from private.account_auth_erasure_scopes where db_role=worker and account_id=a.id;
 if not pg_has_role(worker,'ftk_p07_privacy_worker','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=worker and s.org_id is null)
  or binding.account_id is null or binding.instance_id is distinct from (pg_catalog.pg_control_system()).system_identifier::text then
  return jsonb_build_object('state','unbound');
 end if;
 if not exists(select 1 from private.account_profile_erasures e where e.request_id=p.id and e.account_id=a.id and e.completed_at is not null) then
  return jsonb_build_object('state','blocked_profile');
 end if;
 lock table core.retention_holds in share mode;
 if exists(select 1 from core.retention_holds h where
  (h.subject_table in ('accounts','core.accounts') and h.subject_id=a.id)
  or (h.subject_table in ('users','auth.users') and h.subject_id=a.auth_user_id)
  or (h.subject_table in ('identities','auth.identities') and h.subject_id in (select i.id from auth.identities i where i.user_id=a.auth_user_id))
  or (h.subject_table in ('sessions','auth.sessions') and h.subject_id in (select s.id from auth.sessions s where s.user_id=a.auth_user_id))
  or (h.subject_table in ('mfa_factors','auth.mfa_factors') and h.subject_id in (select f.id from auth.mfa_factors f where f.user_id=a.auth_user_id))) then
  return jsonb_build_object('state','held');
 end if;
 -- Native ownership is a blocker, never permission to erase business objects or
 -- to edit Storage metadata. Physical object removal belongs to the Storage API.
 if exists(select 1 from storage.objects o where coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner')=a.auth_user_id::text) then
  return jsonb_build_object('state','blocked_storage');
 end if;
 return jsonb_build_object('state','ready','auth_user_id',a.auth_user_id,'provider_origin',binding.provider_origin);
end$$;

create function private.p07_auth_erasure_prepare(r jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.p07_privacy_jobs;status jsonb;prior private.account_auth_erasure_permits;proof private.account_auth_erasures;
begin
 perform private.p07_privacy_scope(null);
 if r->>'org_id' is not null or r->>'center_id' is not null then perform private.fail('FORBIDDEN');end if;
 select * into j from private.p07_privacy_jobs where id=(r->>'job_id')::uuid and org_id is null for update;
 if j.id is null or j.operation_key is distinct from (r->>'operation_key')::uuid
  or j.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') then perform private.fail('FORBIDDEN');end if;
 select * into proof from private.account_auth_erasures where request_id=j.request_id;
 if proof.request_id is not null then return jsonb_build_object('state','completed','completed_at',proof.completed_at);end if;
 if j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 status:=private.account_auth_erasure_readiness(j.request_id,session_user);
 if status->>'state'<>'ready' then return status;end if;
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 select * into prior from private.account_auth_erasure_permits where request_id=j.request_id for update;
 if prior.auth_user_id is not null and prior.auth_user_id is distinct from (status->>'auth_user_id')::uuid then perform private.fail('INTEGRITY_VIOLATION');end if;
 insert into private.account_auth_erasure_permits(request_id,account_id,auth_user_id,db_role,job_id,operation_key,lease_hash,expires_at)
 select j.request_id,p.requester_account_id,(status->>'auth_user_id')::uuid,session_user,j.id,j.operation_key,j.lease_hash,j.lease_until
 from core.privacy_requests p where p.id=j.request_id
 on conflict(request_id) do update set db_role=excluded.db_role,job_id=excluded.job_id,operation_key=excluded.operation_key,lease_hash=excluded.lease_hash,expires_at=excluded.expires_at;
 return status;
end$$;

create function private.account_native_delete_fence() returns trigger
 language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare a core.accounts;p private.account_auth_erasure_permits;j private.p07_privacy_jobs;status jsonb;
begin
 select * into a from core.accounts where auth_user_id=OLD.id;
 select * into p from private.account_auth_erasure_permits where auth_user_id=OLD.id;
 -- Ordinary native administration outside this prepared lifecycle is unchanged.
 if p.request_id is null and (a.id is null or a.state<>'deletion_pending') then return OLD;end if;
 if p.request_id is null or p.account_id is distinct from a.id then perform private.fail('FORBIDDEN');end if;
 select * into j from private.p07_privacy_jobs where id=p.job_id for update;
 if j.id is null or j.request_id is distinct from p.request_id or j.org_id is not null or j.state<>'running'
  or j.operation_key is distinct from p.operation_key or j.lease_hash is distinct from p.lease_hash
  or p.expires_at<=clock_timestamp() or j.lease_until is null or j.lease_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;
 status:=private.account_auth_erasure_readiness(p.request_id,p.db_role);
 -- Same lock order as preparation: job, request/account, permit.
 select * into p from private.account_auth_erasure_permits where auth_user_id=OLD.id for update;
 if p.request_id is null or p.job_id is distinct from j.id or p.request_id is distinct from j.request_id
  or p.operation_key is distinct from j.operation_key or p.lease_hash is distinct from j.lease_hash
  or p.expires_at<=clock_timestamp() or j.lease_until<=clock_timestamp() then perform private.fail('FORBIDDEN');end if;
 if status->>'state'<>'ready' or status->>'auth_user_id' is distinct from OLD.id::text then perform private.fail('FORBIDDEN');end if;
 return OLD;
end$$;
create function private.account_native_delete_proof() returns trigger
 language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p private.account_auth_erasure_permits;
begin
 select * into p from private.account_auth_erasure_permits where auth_user_id=OLD.id;
 if p.request_id is null then return OLD;end if;
 if exists(select 1 from auth.users u where u.id=OLD.id)
  or exists(select 1 from auth.identities i where i.user_id=OLD.id)
  or exists(select 1 from auth.sessions s where s.user_id=OLD.id)
  or exists(select 1 from auth.mfa_factors f where f.user_id=OLD.id)
  or exists(select 1 from auth.refresh_tokens t where t.user_id=OLD.id::text) then perform private.fail('INTEGRITY_VIOLATION');end if;
 insert into private.account_auth_erasures(request_id,account_id,auth_user_id,policy_version) values(p.request_id,p.account_id,OLD.id,1);
 return OLD;
end$$;
create trigger ftk_account_native_delete_fence before delete on auth.users for each row execute function private.account_native_delete_fence();
create trigger zzz_ftk_account_native_delete_proof after delete on auth.users for each row execute function private.account_native_delete_proof();

-- Principal deletion is a substage. Provider audit/other Auth data still needs
-- retention minimization; never turn this proof into whole Auth completion.
do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 anchor:=' insert into private.p07_privacy_manifests(request_id,scopes)';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Native Auth privacy manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is null and exists(select 1 from private.account_auth_erasures e where e.request_id=p.id) then
  scopes:=jsonb_set(scopes,'{auth,principal_erasure}',jsonb_build_object('state','completed','evidence','native_delete_transaction'));
 end if;
$a$||anchor);
end$patch$;
revoke all on function private.account_auth_erasure_readiness(uuid,name),private.p07_auth_erasure_prepare(jsonb),private.account_native_delete_fence(),private.account_native_delete_proof() from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
grant execute on function private.p07_auth_erasure_prepare(jsonb) to ftk_p07_privacy_worker;
commit;
