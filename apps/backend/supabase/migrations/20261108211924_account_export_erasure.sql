begin;
-- Temporary DB export bytes are separate from retained reports/source records.
create index p06_export_expiry on core.files(org_id,expires_at,id) where purpose='export';
create index p06_export_job on private.p06_export_files(job_id);
create index p06_jobs_account on private.p06_jobs(account_id,org_id,job_id);
create table private.p06_export_purges(
 file_id uuid primary key references core.files(id),job_id uuid not null references core.report_jobs(id),
 -- This stable audit identifier is validated against the owning job before
 -- insertion. An account FK here would invert expiry(org->account) against
 -- privacy(account->org), and needlessly couple retained proof to a live profile.
 account_id uuid not null,request_id uuid references core.privacy_requests(id),
 reason text not null check(reason in ('expired','account_delete')),policy_version int not null check(policy_version=1),
 removed_bytes bigint not null check(removed_bytes>=0),checksum text not null check(checksum~'^[a-f0-9]{64}$'),
 purged_at timestamptz not null default clock_timestamp(),
 check((reason='account_delete')=(request_id is not null))
);
create table private.account_export_erasure_scopes(
 db_role name not null,account_id uuid not null references core.accounts(id),primary key(db_role,account_id)
);
create table private.account_export_erasures(
 request_id uuid primary key references core.privacy_requests(id),account_id uuid not null references core.accounts(id),
 policy_version int not null check(policy_version=1),completed_at timestamptz,
 removed_rows bigint not null check(removed_rows>=0),removed_bytes bigint not null check(removed_bytes>=0)
);
alter table private.p06_export_purges enable row level security;
alter table private.account_export_erasure_scopes enable row level security;
alter table private.account_export_erasures enable row level security;
revoke all on private.p06_export_purges,private.account_export_erasure_scopes,private.account_export_erasures from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker;
create trigger p06_export_purge_immutable before update or delete on private.p06_export_purges for each row execute function private.p05_immutable();
create trigger account_export_erasure_immutable before update or delete on private.account_export_erasures for each row execute function private.p05_immutable();

-- Validate every ownership edge. Independent FKs alone do not establish that
-- a report's sole byte object belongs to the same account/tenant/person.
create function private.p06_export_manifest(fid uuid) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare f core.files;x private.p06_export_files;r core.report_jobs;c private.p06_jobs;
begin
 select * into x from private.p06_export_files where file_id=fid;
 select * into f from core.files where id=fid;
 select * into r from core.report_jobs where id=x.job_id;
 select * into c from private.p06_jobs where job_id=x.job_id;
 if x.file_id is null or f.id is null or r.id is null or c.job_id is null
  or f.org_id is distinct from c.org_id or r.org_id is distinct from c.org_id
  or r.requester_account_id is distinct from c.account_id or r.file_id is distinct from f.id
  or f.owner_person_id is distinct from c.person_id or f.center_id is distinct from c.center_id
  or c.operation<>'report_build_v1' or c.phase<>'report' or r.state<>'succeeded'
  or f.purpose<>'export' or f.state<>'ready' or f.mime<>'text/csv'
  or f.object_key is distinct from 'p06-db-export/'||f.org_id||'/'||f.id
  or f.expires_at is null or r.expires_at is null
  or f.size_bytes is distinct from octet_length(x.body)::bigint
  or f.checksum is distinct from encode(extensions.digest(x.body,'sha256'),'hex')
  or not exists(select 1 from core.people where org_id=c.org_id and id=c.person_id)
  or exists(select 1 from core.report_jobs where file_id=f.id and id<>r.id)
 then perform private.fail('INTEGRITY_VIOLATION');end if;
 return jsonb_build_object('file_id',f.id,'job_id',r.id,'org_id',f.org_id,'account_id',c.account_id,'removed_bytes',f.size_bytes,'checksum',f.checksum);
end$$;
create function private.p06_export_held(fid uuid) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from private.p06_export_files x join core.files f on f.id=x.file_id
  join private.p06_jobs c on c.job_id=x.job_id
  cross join lateral(values('files',f.id),('p06_export_files',f.id),('report_jobs',x.job_id),('outbox_jobs',x.job_id),('p06_jobs',x.job_id),('accounts',c.account_id),('organizations',f.org_id)) t(kind,id)
  join core.retention_holds h on h.subject_id=t.id and h.subject_table in(t.kind,'core.'||t.kind,'private.'||t.kind)
   and (t.kind='accounts' or h.org_id is null or h.org_id=f.org_id)
  where x.file_id=fid
 )
$$;
create function private.p06_export_purge(fid uuid,why text,request uuid default null) returns bigint
 language plpgsql security invoker set search_path='' as $$
declare info jsonb;n bigint;
begin
 info:=private.p06_export_manifest(fid);
 if private.p06_export_held(fid) then perform private.fail('INTEGRITY_VIOLATION');end if;
 insert into private.p06_export_purges(file_id,job_id,account_id,request_id,reason,policy_version,removed_bytes,checksum)
 values(fid,(info->>'job_id')::uuid,(info->>'account_id')::uuid,request,why,1,(info->>'removed_bytes')::bigint,info->>'checksum');
 delete from private.p06_export_files where file_id=fid;get diagnostics n=row_count;
 if n<>1 then perform private.fail('INTEGRITY_VIOLATION');end if;
 return (info->>'removed_bytes')::bigint;
end$$;
create function private.p06_expire_exports(org uuid,lim int default 100) returns int
 language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare fid uuid;n int:=0;
begin
 perform private.p06_worker_scope(org);
 if lim not between 1 and 500 then perform private.fail('VALIDATION_FAILED');end if;
 perform 1 from core.organizations where id=org for update;
 lock table core.retention_holds in share mode;
 for fid in select f.id from core.files f join private.p06_export_files x on x.file_id=f.id
  where f.org_id=org and f.expires_at<=clock_timestamp() and not private.p06_export_held(f.id)
  order by f.expires_at,f.id limit lim loop
  perform private.p06_export_purge(fid,'expired');n:=n+1;
 end loop;
 return n;
end$$;
create function private.account_export_candidates(account uuid) returns setof uuid
 language sql stable security invoker set search_path='' as $$
 select x.file_id from private.p06_export_files x
 left join core.report_jobs r on r.id=x.job_id left join private.p06_jobs c on c.job_id=x.job_id
 where r.requester_account_id=account or c.account_id=account
  or exists(select 1 from core.report_jobs q where q.file_id=x.file_id and q.requester_account_id=account)
$$;
create function private.account_export_lease(request uuid) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 perform private.p07_privacy_scope(null);
 if not exists(select 1 from private.p07_privacy_jobs where request_id=request and org_id is null and state='running' and lease_until>clock_timestamp()) then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if not exists(select 1 from core.privacy_requests p join core.accounts a on a.id=p.requester_account_id
  join private.account_export_erasure_scopes s on s.account_id=a.id and s.db_role=session_user
  where p.id=request and p.org_id is null and p.kind='account_delete' and p.state in('requested','partial','running')
   and a.state='deletion_pending' and not private.p07_lifecycle_owner_blocked(a.id)
   and not exists(select 1 from core.account_links where account_id=a.id and state='active')) then perform private.fail('FORBIDDEN');end if;
end$$;
create function private.account_export_erasure(request uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p core.privacy_requests;a core.accounts;e private.account_export_erasures;org uuid;fid uuid;info jsonb;
 n bigint:=0;bytes bigint:=0;held boolean:=false;
begin
 perform private.p07_privacy_scope(null);
 select * into p from core.privacy_requests where id=request and org_id is null for update;
 if p.id is null or p.kind<>'account_delete' or p.scope->>'kind'<>'account' or p.scope->>'account_id' is distinct from p.requester_account_id::text
  or p.state not in('requested','partial','running') then perform private.fail('FORBIDDEN');end if;
 select * into a from core.accounts where id=p.requester_account_id for update;
 select * into e from private.account_export_erasures where request_id=p.id;
 if e.request_id is not null and e.account_id is distinct from a.id then perform private.fail('INTEGRITY_VIOLATION');end if;
 if e.completed_at is not null then return jsonb_build_object('state','completed','policy_version',1,'completed_at',e.completed_at,'removed_rows',e.removed_rows,'removed_bytes',e.removed_bytes);end if;
 if a.id is null or a.state<>'deletion_pending' or private.p07_lifecycle_owner_blocked(a.id)
  or exists(select 1 from core.account_links where account_id=a.id and state='active') then perform private.fail('FORBIDDEN');end if;
 if not exists(select 1 from private.account_export_erasure_scopes where db_role=session_user and account_id=a.id) then return jsonb_build_object('state','unbound','policy_version',1);end if;
 -- Serialize operator unbinding with this one approved transaction.
 perform 1 from private.account_export_erasure_scopes where db_role=session_user and account_id=a.id for share;
 perform 1 from private.p07_privacy_worker_scopes where db_role=session_user and org_id is null for share;
 -- Historic links cover a producer admitted before account revocation whose
 -- report rows are still uncommitted. Every p06 producer locks its organization.
 for org in select distinct id from(
  select org_id id from core.account_links where account_id=a.id
  union select org_id from private.p06_jobs where account_id=a.id
  union select org_id from core.report_jobs where requester_account_id=a.id
  union select f.org_id from core.files f where f.id in(select private.account_export_candidates(a.id))
 ) q order by id loop perform 1 from core.organizations where id=org for update;end loop;
 lock table core.retention_holds in share mode;
 perform private.account_export_lease(p.id);
 held:=exists(select 1 from core.retention_holds where subject_id=a.id and subject_table in('accounts','core.accounts'));
 -- Validate the entire set before deleting any member, including bad/shared
 -- edges. An inner join must never silently hide an ambiguous target.
 for fid in select private.account_export_candidates(a.id) loop
  info:=private.p06_export_manifest(fid);
  if info->>'account_id' is distinct from a.id::text then perform private.fail('INTEGRITY_VIOLATION');end if;
  held:=held or private.p06_export_held(fid);
 end loop;
 if held then return jsonb_build_object('state','held','policy_version',1);end if;
 for fid in select private.account_export_candidates(a.id) loop
  perform private.account_export_lease(p.id);
  bytes:=bytes+private.p06_export_purge(fid,'account_delete',p.id);n:=n+1;
 end loop;
 perform private.account_export_lease(p.id);
 insert into private.account_export_erasures(request_id,account_id,policy_version,completed_at,removed_rows,removed_bytes)
 values(p.id,a.id,1,clock_timestamp(),n,bytes) returning * into e;
 perform private.account_export_lease(p.id);
 return jsonb_build_object('state','completed','policy_version',1,'completed_at',e.completed_at,'removed_rows',n,'removed_bytes',bytes);
end$$;
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p06_jobs_claim(uuid,uuid[],integer)'::regprocedure);
 a:=' delete from private.p06_export_files x using core.files f where f.id=x.file_id and f.org_id=org and f.expires_at<=clock_timestamp();';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Export expiry anchor mismatch';end if;
 execute replace(b,a,' perform private.p06_expire_exports(org);');
 b:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 a:=' insert into private.p07_privacy_manifests(request_id,scopes)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Account export stage anchor mismatch';end if;
 execute replace(b,a,$a$ if org is null then scopes:=jsonb_set(scopes,'{exports,database_exports}',private.account_export_erasure(p.id));end if;
$a$||a);
end$patch$;
revoke all on function private.p06_export_manifest(uuid),private.p06_export_held(uuid),private.p06_export_purge(uuid,text,uuid),private.p06_expire_exports(uuid,int),private.account_export_candidates(uuid),private.account_export_lease(uuid),private.account_export_erasure(uuid) from public,anon,authenticated,service_role,ftk_p06_worker,ftk_p07_privacy_worker;
commit;
