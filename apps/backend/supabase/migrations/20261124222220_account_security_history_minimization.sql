begin;

create index account_security_events_session_lookup on private.account_security_events(session_id) where session_id is not null;

create table private.account_security_history_minimizations(
 request_id uuid primary key references core.privacy_requests(id),
 account_id uuid not null references core.accounts(id),
 completed_at timestamptz not null default clock_timestamp(),
 minimized_rows bigint not null check(minimized_rows>=0)
);
alter table private.account_security_history_minimizations enable row level security;
revoke all on private.account_security_history_minimizations from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
create trigger account_security_history_minimizations_immutable before update or delete
 on private.account_security_history_minimizations for each row execute function private.append_only();

create function private.account_security_history_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare request uuid:=nullif(current_setting('ftk.security_history_erasure_request',true),'')::uuid;
begin
 if tg_op='UPDATE' and request is not null and old.session_id is not null and new.session_id is null
  and (to_jsonb(new)-'session_id')=(to_jsonb(old)-'session_id')
  and pg_has_role(session_user,'ftk_p07_privacy_worker','member')
  and exists(
   select 1 from private.p07_privacy_jobs j join core.privacy_requests p on p.id=j.request_id
   join private.account_auth_erasure_scopes s on s.account_id=p.requester_account_id and s.db_role=session_user
   where j.request_id=request and j.org_id is null and j.state='running' and j.lease_until>clock_timestamp()
    and p.kind='account_delete' and p.requester_account_id=old.account_id
  ) then
  return new;
 end if;
 perform private.fail('INTEGRITY_VIOLATION');
 return null;
end$$;
drop trigger account_security_events_immutable on private.account_security_events;
create trigger account_security_events_immutable before update or delete on private.account_security_events
 for each row execute function private.account_security_history_guard();

create function private.account_security_history_minimize(request uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p core.privacy_requests;a core.accounts;j private.p07_privacy_jobs;
 proof private.account_security_history_minimizations;n bigint;previous text;
begin
 perform private.p07_privacy_scope(null);
 select * into j from private.p07_privacy_jobs where request_id=request and org_id is null for update;
 if j.id is null or j.state<>'running' or j.lease_until is null or j.lease_until<=clock_timestamp() then
  perform private.fail('OPERATION_IN_PROGRESS');
 end if;
 select * into p from core.privacy_requests where id=request and org_id is null for update;
 select * into a from core.accounts where id=p.requester_account_id for update;
 if p.id is null or p.kind<>'account_delete' or p.scope->>'kind'<>'account'
  or p.scope->>'account_id' is distinct from a.id::text or p.state not in ('requested','running','partial')
  or a.id is null or a.state<>'deletion_pending' or a.auth_user_id is null
  or private.p07_lifecycle_owner_blocked(a.id) or exists(select 1 from core.account_links where account_id=a.id and state='active')
  or exists(select 1 from private.platform_operators where auth_user_id=a.auth_user_id) then
  perform private.fail('FORBIDDEN');
 end if;
 perform 1 from private.account_auth_erasure_scopes
 where db_role=session_user and account_id=a.id and instance_id=(pg_catalog.pg_control_system()).system_identifier::text for share;
 if not found then return jsonb_build_object('state','unbound');end if;
 if not exists(select 1 from private.account_profile_erasures e where e.request_id=request and e.account_id=a.id and e.completed_at is not null)
  or not exists(select 1 from private.account_auth_erasures e where e.request_id=request and e.account_id=a.id and e.auth_user_id=a.auth_user_id)
  or exists(select 1 from auth.users where id=a.auth_user_id) then
  perform private.fail('INTEGRITY_VIOLATION');
 end if;

 lock table core.retention_holds in share mode;
 if exists(
  select 1 from core.retention_holds h
  where (h.subject_table in ('accounts','core.accounts') and h.subject_id=a.id)
   or (h.subject_table in ('users','auth.users') and h.subject_id=a.auth_user_id)
   or exists(
    select 1 from private.account_security_events e where e.account_id=a.id and e.session_id is not null
     and ((h.subject_table in ('account_security_events','private.account_security_events') and h.subject_id=e.id)
      or (h.subject_table in ('sessions','auth.sessions') and h.subject_id=e.session_id)
      or (h.subject_table in ('operation_receipts','core.operation_receipts') and h.subject_id=e.operation_id))
   )
 ) then return jsonb_build_object('state','held');end if;
 if exists(
  select 1 from private.account_security_events e where e.account_id=a.id and e.session_id is not null
   and (exists(select 1 from auth.sessions s where s.id=e.session_id)
    or exists(select 1 from private.account_security_events x where x.session_id=e.session_id and x.account_id<>a.id))
 ) then perform private.fail('INTEGRITY_VIOLATION');end if;
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;

 previous:=current_setting('ftk.security_history_erasure_request',true);
 perform set_config('ftk.security_history_erasure_request',request::text,true);
 update private.account_security_events set session_id=null where account_id=a.id and session_id is not null;
 get diagnostics n=row_count;
 perform set_config('ftk.security_history_erasure_request',coalesce(previous,''),true);
 if j.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 if exists(select 1 from private.account_security_events where account_id=a.id and session_id is not null) then
  perform private.fail('INTEGRITY_VIOLATION');
 end if;
 insert into private.account_security_history_minimizations(request_id,account_id,minimized_rows)
 values(request,a.id,n) on conflict(request_id) do nothing;
 select * into proof from private.account_security_history_minimizations where request_id=request;
 if proof.account_id is distinct from a.id then perform private.fail('INTEGRITY_VIOLATION');end if;
 return jsonb_build_object('state','completed','completed_at',proof.completed_at,'minimized_rows',proof.minimized_rows,'pass_rows',n);
end$$;

do $patch$
declare body text;anchor text:=' insert into private.p07_privacy_manifests(request_id,scopes)';
begin
 body:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 if array_length(string_to_array(body,anchor),1)<>2 then raise exception 'Account security history manifest anchor mismatch';end if;
 execute replace(body,anchor,$a$ if org is null and exists(select 1 from private.account_auth_erasures e where e.request_id=p.id) then
  scopes:=jsonb_set(scopes,'{database,security_history}',private.account_security_history_minimize(p.id));
 end if;
$a$||anchor);
end$patch$;
revoke all on function private.account_security_history_guard(),private.account_security_history_minimize(uuid)
 from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

commit;
