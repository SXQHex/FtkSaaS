begin;
create table private.account_auth_residue_erasures(
 request_id uuid primary key references core.privacy_requests(id),account_id uuid not null references core.accounts(id),
 auth_user_id uuid not null,completed_at timestamptz not null default clock_timestamp(),policy_version int not null check(policy_version=1),
 flow_rows bigint not null check(flow_rows>=0),refresh_rows bigint not null check(refresh_rows>=0),audit_rows bigint not null check(audit_rows>=0)
);
alter table private.account_auth_residue_erasures enable row level security;
revoke all on private.account_auth_residue_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
create trigger account_auth_residue_erasures_immutable before update or delete on private.account_auth_residue_erasures for each row execute function private.append_only();

-- Keep event identity/action/time and stable subject IDs, never a profile copy.
-- A mixed event's other actor/subject is outside the erased account's scope.
create function private.account_auth_audit_minimized(payload jsonb,subject uuid) returns jsonb
 language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=payload;
begin
 if lower(payload#>>'{traits,user_id}')=subject::text then
  result:=jsonb_set(result,'{traits}',(result->'traits')-'user_email'-'user_phone');
 end if;
 if lower(payload->>'actor_id')=subject::text then
  result:=result-'actor_username'-'actor_name';
 end if;
 return result;
end$$;

create function private.account_auth_residue_erasure(request uuid,worker name,native_transaction boolean) returns jsonb
 language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare j private.p07_privacy_jobs;p core.privacy_requests;a core.accounts;permit private.account_auth_erasure_permits;
 proof private.account_auth_residue_erasures;auth uuid;flows bigint;refreshes bigint;audits bigint;
begin
 select * into proof from private.account_auth_residue_erasures where request_id=request;
 -- Recheck on each newly leased pass: an in-flight provider audit writer may
 -- commit after the first minimization. The immutable receipt records first pass.
 -- Match the existing fence/executor lock order, including historical-principal retry.
 select * into j from private.p07_privacy_jobs where request_id=request and org_id is null for update;
 select * into p from core.privacy_requests where id=request and org_id is null for update;
 select * into a from core.accounts where id=p.requester_account_id for update;
 auth:=a.auth_user_id;
 if j.id is null or j.operation_key is null or j.lease_hash is null or j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp()
  or p.kind<>'account_delete' or p.scope->>'kind'<>'account' or p.scope->>'account_id' is distinct from a.id::text
  or p.state not in ('requested','running','partial') or a.id is null or a.state<>'deletion_pending' or auth is null
  or private.p07_lifecycle_owner_blocked(a.id) or exists(select 1 from core.account_links l where l.account_id=a.id and l.state='active')
  or exists(select 1 from private.platform_operators o where o.auth_user_id=auth) then perform private.fail('FORBIDDEN');end if;
 select * into permit from private.account_auth_erasure_permits where request_id=request for update;
 if native_transaction is not true and worker is distinct from session_user then perform private.fail('FORBIDDEN');end if;
 if worker is null or not pg_has_role(worker,'ftk_p07_privacy_worker','member')
  or not exists(select 1 from private.p07_privacy_worker_scopes s where s.db_role=worker and s.org_id is null)
  or not exists(select 1 from private.account_auth_erasure_scopes s where s.db_role=worker and s.account_id=a.id and s.instance_id=(pg_catalog.pg_control_system()).system_identifier::text) then return jsonb_build_object('state','unbound');end if;
 if exists(select 1 from auth.users u where u.id=auth) then return jsonb_build_object('state','blocked_principal');end if;
 if not exists(select 1 from private.account_auth_erasures e where e.request_id=request and e.account_id=a.id and e.auth_user_id=auth)
  and ((native_transaction is true and pg_trigger_depth()>0 and permit.db_role=worker and permit.account_id=a.id and permit.auth_user_id=auth and permit.job_id=j.id and permit.operation_key=j.operation_key
   and permit.lease_hash=j.lease_hash and permit.expires_at>clock_timestamp()) is not true) then perform private.fail('FORBIDDEN');end if;
 lock table core.retention_holds in share mode;
 if exists(select 1 from core.retention_holds h where
  (h.subject_table in ('accounts','core.accounts') and h.subject_id=a.id)
  or (h.subject_table in ('users','auth.users') and h.subject_id=auth)
  or (h.subject_table in ('flow_state','auth.flow_state') and h.subject_id in (select f.id from auth.flow_state f where f.user_id=auth or to_jsonb(f)->>'linking_target_id'=auth::text))
  or (h.subject_table in ('audit_log_entries','auth.audit_log_entries') and h.subject_id in (select e.id from auth.audit_log_entries e where lower(e.payload->>'actor_id')=auth::text or lower(e.payload#>>'{traits,user_id}')=auth::text))) then return jsonb_build_object('state','held');end if;
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if exists(select 1 from auth.flow_state f where
  (f.user_id=auth and to_jsonb(f)->>'linking_target_id' is not null and to_jsonb(f)->>'linking_target_id'<>auth::text)
  or (to_jsonb(f)->>'linking_target_id'=auth::text and f.user_id is not null and f.user_id<>auth)) then perform private.fail('INTEGRITY_VIOLATION');end if;
 -- A malformed cross-account session binding is corruption, not purge authority.
 if exists(select 1 from auth.refresh_tokens r join auth.sessions s on s.id=r.session_id where r.user_id=auth::text and s.user_id is distinct from auth) then perform private.fail('INTEGRITY_VIOLATION');end if;
 delete from auth.flow_state f where
  (f.user_id=auth and (to_jsonb(f)->>'linking_target_id' is null or to_jsonb(f)->>'linking_target_id'=auth::text))
  or (to_jsonb(f)->>'linking_target_id'=auth::text and (f.user_id is null or f.user_id=auth));get diagnostics flows=row_count;
 delete from auth.refresh_tokens r where r.user_id=auth::text
  and not exists(select 1 from auth.sessions s where s.id=r.session_id and s.user_id is distinct from auth);get diagnostics refreshes=row_count;
 update auth.audit_log_entries e set payload=private.account_auth_audit_minimized(e.payload::jsonb,auth)::json,
  ip_address=case when lower(e.payload->>'actor_id')=auth::text then '' else e.ip_address end
 where (lower(e.payload->>'actor_id')=auth::text or lower(e.payload#>>'{traits,user_id}')=auth::text)
  and (e.payload::jsonb is distinct from private.account_auth_audit_minimized(e.payload::jsonb,auth) or (lower(e.payload->>'actor_id')=auth::text and coalesce(e.ip_address,'')<>''));get diagnostics audits=row_count;
 if exists(select 1 from auth.flow_state f where f.user_id=auth or to_jsonb(f)->>'linking_target_id'=auth::text)
  or exists(select 1 from auth.refresh_tokens r where r.user_id=auth::text)
  or exists(select 1 from auth.audit_log_entries e where
   (lower(e.payload->>'actor_id')=auth::text or lower(e.payload#>>'{traits,user_id}')=auth::text)
   and (e.payload::jsonb is distinct from private.account_auth_audit_minimized(e.payload::jsonb,auth) or (lower(e.payload->>'actor_id')=auth::text and coalesce(e.ip_address,'')<>''))) then perform private.fail('INTEGRITY_VIOLATION');end if;
 insert into private.account_auth_residue_erasures(request_id,account_id,auth_user_id,policy_version,flow_rows,refresh_rows,audit_rows)
 values(request,a.id,auth,1,flows,refreshes,audits) on conflict(request_id) do nothing;
 select * into proof from private.account_auth_residue_erasures where request_id=request;
 if proof.account_id is distinct from a.id or proof.auth_user_id is distinct from auth then perform private.fail('INTEGRITY_VIOLATION');end if;
 return jsonb_build_object('state','completed','completed_at',proof.completed_at,'checked_at',clock_timestamp(),'policy_version',proof.policy_version,'pass_rows',jsonb_build_object('flows',flows,'refresh_tokens',refreshes,'audit',audits));
end$$;

do $patch$
declare body text;anchor text;
begin
 body:=pg_get_functiondef('private.account_auth_erasure_readiness(uuid,name)'::regprocedure);
 anchor:=' -- Native ownership is a blocker';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Auth residue readiness anchor mismatch';end if;
 execute replace(body,anchor,$a$ if exists(select 1 from core.retention_holds h where
  (h.subject_table in ('flow_state','auth.flow_state') and h.subject_id in (select f.id from auth.flow_state f where f.user_id=a.auth_user_id or to_jsonb(f)->>'linking_target_id'=a.auth_user_id::text))
  or (h.subject_table in ('audit_log_entries','auth.audit_log_entries') and h.subject_id in (select e.id from auth.audit_log_entries e where lower(e.payload->>'actor_id')=a.auth_user_id::text or lower(e.payload#>>'{traits,user_id}')=a.auth_user_id::text))) then return jsonb_build_object('state','held');end if;
 if exists(select 1 from auth.flow_state f where
  (f.user_id=a.auth_user_id and to_jsonb(f)->>'linking_target_id' is not null and to_jsonb(f)->>'linking_target_id'<>a.auth_user_id::text)
  or (to_jsonb(f)->>'linking_target_id'=a.auth_user_id::text and f.user_id is not null and f.user_id<>a.auth_user_id)) then perform private.fail('INTEGRITY_VIOLATION');end if;
$a$||anchor);
 body:=pg_get_functiondef('private.account_native_delete_proof()'::regprocedure);
 anchor:='declare p private.account_auth_erasure_permits;';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Auth residue proof declaration mismatch';end if;
 body:=replace(body,anchor,anchor||'status jsonb;');
 anchor:=' if exists(select 1 from auth.users u where u.id=OLD.id)';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Auth residue proof boundary mismatch';end if;
 execute replace(body,anchor,$a$ status:=private.account_auth_residue_erasure(p.request_id,p.db_role,true);
 if status->>'state'<>'completed' then perform private.fail('FORBIDDEN');end if;
$a$||anchor);
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 anchor:=' insert into private.p07_privacy_manifests(request_id,scopes)';
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Auth residue manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is null and exists(select 1 from private.account_auth_erasures e where e.request_id=p.id) then
  scopes:=jsonb_set(scopes,'{auth,residue_erasure}',private.account_auth_residue_erasure(p.id,session_user,false));
 end if;
$a$||anchor);
end$patch$;
revoke all on function private.account_auth_audit_minimized(jsonb,uuid),private.account_auth_residue_erasure(uuid,name,boolean) from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
commit;
