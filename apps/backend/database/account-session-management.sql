begin;
create table private.account_session_labels(
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 account_id uuid not null references core.accounts(id),label text check(label is null or (length(btrim(label)) between 1 and 80 and label !~ '[[:cntrl:]]')),
 version bigint not null default 1 check(version>0)
);
create table private.account_security_events(
 id uuid primary key,account_id uuid not null references core.accounts(id),operation_id uuid unique references core.operation_receipts(id),
 at timestamptz not null default clock_timestamp(),action text not null check(action in('session_labelled','session_revoked','other_sessions_revoked','totp_enabled','totp_disabled')),
 session_id uuid,affected_count bigint not null check(affected_count>=0),
 check((action in ('totp_enabled','totp_disabled')) = (operation_id is null))
);
create index account_security_events_page on private.account_security_events(account_id,at desc,id desc);
create trigger account_security_events_immutable before update or delete on private.account_security_events for each row execute function private.append_only();
alter table private.account_session_labels enable row level security;alter table private.account_security_events enable row level security;
revoke all on private.account_session_labels,private.account_security_events from public,anon,authenticated;
grant select,insert,update on private.account_session_labels to service_role;grant select,insert on private.account_security_events to service_role;

create function private.account_session_page_cursor(value text,account uuid,kind text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare c jsonb;at timestamptz;until_at timestamptz;
begin
 if value is null then return jsonb_build_object('as_of',clock_timestamp());end if;
 begin
  c:=convert_from(decode(value,'hex'),'UTF8')::jsonb;at:=(c->>'at')::timestamptz;until_at:=(c->>'as_of')::timestamptz;
  if c->>'scope' is distinct from md5(account::text||':'||kind) or at is null or until_at is null or not isfinite(at) or not isfinite(until_at) or at>until_at or until_at>clock_timestamp() or c->>'id' is null then perform private.fail('VALIDATION_FAILED');end if;
  perform (c->>'id')::uuid;
 exception when others then perform private.fail('VALIDATION_FAILED');end;
 return c;
end$$;

create function private.account_sessions_page(r jsonb,account uuid,current_session uuid,history boolean) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare c jsonb;rows jsonb;next text;kind text:=case when history then 'history' else 'sessions' end;auth_id uuid;until_at timestamptz;after_at timestamptz;after_id uuid;
begin
 c:=private.account_session_page_cursor(r->>'cursor',account,kind);until_at:=(c->>'as_of')::timestamptz;after_at:=(c->>'at')::timestamptz;after_id:=(c->>'id')::uuid;
 if history then
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'at',e.at,'action',e.action,'session_id',e.session_id,'affected_count',e.affected_count) order by e.at desc,e.id desc),'[]') into rows
  from(select * from private.account_security_events e where e.account_id=account and e.at<=until_at and (after_at is null or (e.at,e.id)<(after_at,after_id)) order by e.at desc,e.id desc limit 51)e;
 else
  select a.auth_user_id into auth_id from core.accounts a where a.id=account;
  select coalesce(jsonb_agg(jsonb_build_object('session_id',s.id,'current',s.id=current_session,'created_at',s.created_at,
   'last_refreshed_at',coalesce((to_jsonb(s)->>'refreshed_at')::timestamptz,s.updated_at,s.created_at),'expires_at',s.not_after,
   'aal',case when to_jsonb(s)->>'aal' in ('aal1','aal2') then to_jsonb(s)->>'aal' else null end,
   'user_agent',left(regexp_replace(to_jsonb(s)->>'user_agent','[[:cntrl:]]',' ','g'),400),'label',l.label,'version',coalesce(l.version,0)) order by s.created_at desc,s.id desc),'[]') into rows
  from(select * from auth.sessions s where s.user_id=auth_id and (s.not_after is null or s.not_after>clock_timestamp()) and s.created_at<=until_at and (after_at is null or (s.created_at,s.id)<(after_at,after_id)) order by s.created_at desc,s.id desc limit 51)s
  left join private.account_session_labels l on l.session_id=s.id and l.account_id=account;
 end if;
 if jsonb_array_length(rows)>50 then
  rows:=rows-50;
  next:=encode(convert_to(jsonb_build_object('scope',md5(account::text||':'||kind),'at',case when history then rows#>>'{49,at}' else rows#>>'{49,created_at}' end,'id',case when history then rows#>>'{49,id}' else rows#>>'{49,session_id}' end,'as_of',until_at)::text,'UTF8'),'hex');
 end if;
 return jsonb_build_object('items',rows,'next_cursor',next,'as_of',until_at);
end$$;

-- Narrow private administrative primitive. Never expose a provider session deletion RPC directly.
create function private.account_sessions_remove(account uuid,current_session uuid,mode text,target uuid) returns bigint language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare auth_id uuid;n bigint;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 select a.auth_user_id into auth_id from core.accounts a where a.id=account and a.state='active';
 if auth_id is null or not exists(select 1 from auth.sessions s where s.id=current_session and s.user_id=auth_id and (s.not_after is null or s.not_after>clock_timestamp())) then perform private.fail('SESSION_REVOKED');end if;
 if mode='others' then
  delete from auth.sessions s where s.user_id=auth_id and s.id<>current_session;get diagnostics n=row_count;
  -- Legacy unbound refresh rows are also other sessions; modern session refresh rows cascade.
  delete from auth.refresh_tokens t where t.user_id=auth_id::text and to_jsonb(t)->>'session_id' is null;
 elsif mode in('selected','current') then
  if mode='current' then target:=current_session;end if;
  delete from auth.sessions s where s.user_id=auth_id and s.id=target;get diagnostics n=row_count;
  if n=0 then perform private.fail('NOT_FOUND');end if;
 else perform private.fail('VALIDATION_FAILED');end if;
 return n;
end$$;

create function private.account_sessions_execute(op text,r jsonb,account uuid,current_session uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare auth_id uuid;target uuid:=(r->>'session_id')::uuid;version bigint;mode text:=r->>'mode';n bigint;action text;
begin
 if op='account_sessions_list_v1' then return private.account_sessions_page(r,account,current_session,false);end if;
 if op='account_security_history_get_v1' then return private.account_sessions_page(r,account,current_session,true);end if;
 select a.auth_user_id into auth_id from core.accounts a where a.id=account;
 if op='account_session_label_v1' then
  if not exists(select 1 from auth.sessions s where s.id=target and s.user_id=auth_id and (s.not_after is null or s.not_after>clock_timestamp())) then perform private.fail('NOT_FOUND');end if;
  if r->>'label' is not null and (length(btrim(r->>'label')) not between 1 and 80 or r->>'label' ~ '[[:cntrl:]]') then perform private.fail('VALIDATION_FAILED');end if;
  select l.version into version from private.account_session_labels l where l.session_id=target and l.account_id=account for update;
  if coalesce(version,0) is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  insert into private.account_session_labels(session_id,account_id,label) values(target,account,r->>'label') on conflict(session_id) do update set label=excluded.label,version=private.account_session_labels.version+1 where private.account_session_labels.account_id=excluded.account_id returning private.account_session_labels.version into version;
  if not found then perform private.fail('INTEGRITY_VIOLATION');end if;
  action:='session_labelled';n:=1;
 elsif op='account_sessions_revoke_v1' then
  if mode='others' then
   perform private.p07_lifecycle_reauth(account,aux);
   -- Adopt the fresh sign-in as the current session before requesting others; it survives retries.
   if aux->>'reauth_session_id' is distinct from current_session::text then perform private.fail('AUTH_REQUIRED');end if;
  end if;
  n:=private.account_sessions_remove(account,current_session,mode,target);action:=case when mode='others' then 'other_sessions_revoked' else 'session_revoked' end;
  if mode='current' then target:=current_session;end if;
 else perform private.fail('NOT_FOUND');end if;
 insert into private.account_security_events(id,account_id,operation_id,action,session_id,affected_count) values(private.new_id(ids,11),account,operation,action,target,n);
 if op='account_session_label_v1' then return jsonb_build_object('operation_id',operation,'primary_id',account,'version',version,'replayed',false,'related','[]'::jsonb);end if;
 return jsonb_build_object('operation_id',operation,'affected_count',n,'current_revoked',mode='current' or (mode='selected' and target=current_session),'replayed',false);
end$$;
revoke all on function private.account_session_page_cursor(text,uuid,text),private.account_sessions_page(jsonb,uuid,uuid,boolean),private.account_sessions_remove(uuid,uuid,text,uuid),private.account_sessions_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.account_session_page_cursor(text,uuid,text),private.account_sessions_page(jsonb,uuid,uuid,boolean),private.account_sessions_remove(uuid,uuid,text,uuid),private.account_sessions_execute(text,jsonb,uuid,uuid,uuid,uuid[],jsonb) to service_role;


-- Verified native factor state + verified signed JWT assurance are both required.
-- Session DB AAL alone would incorrectly upgrade a previously stolen aal1 token.
create function private.account_mfa_assert(auth_id uuid,session uuid,aux jsonb) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 if exists(select 1 from auth.mfa_factors f where f.user_id=auth_id and f.status::text='verified')
  and (aux->>'verified_aal' is distinct from 'aal2' or not exists(select 1 from auth.sessions s where s.id=session and s.user_id=auth_id and to_jsonb(s)->>'aal'='aal2')) then perform private.fail('AUTH_REQUIRED');end if;
end$$;
revoke all on function private.account_mfa_assert(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.account_mfa_assert(uuid,uuid,jsonb) to service_role;
create or replace function private.p07_lifecycle_reauth(account uuid,aux jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare max_age int;auth_id uuid;
begin
 select reauth_max_age_seconds into max_age from private.p07_lifecycle_config where singleton;
 if max_age is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select auth_user_id into auth_id from core.accounts where id=account and state in ('active','deletion_pending');
 if aux->>'reauth_verified' is distinct from 'true' or aux->>'reauth_auth_id' is distinct from auth_id::text or not exists(select 1 from auth.sessions s where s.id=(aux->>'reauth_session_id')::uuid and s.user_id=auth_id and s.created_at>=clock_timestamp()-make_interval(secs=>max_age) and s.created_at<=clock_timestamp() and (s.not_after is null or s.not_after>clock_timestamp())) then perform private.fail('AUTH_REQUIRED');end if;
 perform private.account_mfa_assert(auth_id,(aux->>'reauth_session_id')::uuid,jsonb_build_object('verified_aal',aux->>'reauth_aal'));
end$$;

create or replace function private.p07_password_preflight(r jsonb,auth_id uuid,session uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare checked jsonb;
begin
 checked:=private.execute_operation('account_get_v1',r,auth_id,session,ids,aux);
 if checked->>'ok' is distinct from 'true' then return checked;end if;
 return jsonb_build_object('_internal_auth_ready',true);
end$$;


-- Native factor verification/removal and mandatory account history commit together.
-- Unverified enrollment never creates a false enabled event; no secret/code/factor payload is retained.
create function private.account_totp_security_event() returns trigger language plpgsql security definer set search_path='' as $$
declare auth_id uuid;account uuid;action text;new_id uuid;
begin
 if TG_OP='DELETE' then
  if old.factor_type::text<>'totp' or old.status::text<>'verified' then return old;end if;
  auth_id:=old.user_id;action:='totp_disabled';
 else
  if new.factor_type::text<>'totp' or new.status::text<>'verified' then return new;end if;
  if TG_OP='UPDATE' and old.status::text='verified' then return new;end if;
  auth_id:=new.user_id;action:='totp_enabled';
 end if;
 select a.id into account from core.accounts a where a.auth_user_id=auth_id and a.state='active';
 if account is not null then
  new_id:=(private.ops_uuid_bank(1))[1];
  insert into private.account_security_events(id,account_id,action,affected_count) values(new_id,account,action,0);
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end$$;
revoke all on function private.account_totp_security_event() from public,anon,authenticated,service_role;
create trigger ftk_account_totp_security after insert or update or delete on auth.mfa_factors for each row execute function private.account_totp_security_event();

create table private.account_totp_removal_intents(
 factor_id uuid primary key,account_id uuid not null references core.accounts(id),session_id uuid not null,
 expires_at timestamptz not null,completed boolean not null default false,completed_at timestamptz,
 check(completed=(completed_at is not null))
);
alter table private.account_totp_removal_intents enable row level security;
revoke all on private.account_totp_removal_intents from public,anon,authenticated,service_role;

create function private.account_totp_removal_fence() returns trigger language plpgsql security definer set search_path='' as $$
declare intent private.account_totp_removal_intents;
begin
 if old.factor_type::text<>'totp' or old.status::text<>'verified' then return old;end if;
 if exists(select 1 from core.accounts a where a.auth_user_id=old.user_id and a.state='deletion_pending') then return old;end if;
 select i.* into intent from private.account_totp_removal_intents i join core.accounts a on a.id=i.account_id
 where i.factor_id=old.id and a.auth_user_id=old.user_id and a.state='active' and exists(select 1 from auth.users u where u.id=old.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())) and not i.completed and i.expires_at>clock_timestamp() for update of i;
 if not found or intent.expires_at<=clock_timestamp() or not exists(select 1 from auth.sessions s where s.id=intent.session_id and s.user_id=old.user_id and (s.not_after is null or s.not_after>clock_timestamp()) and to_jsonb(s)->>'aal'='aal2') then perform private.fail('FORBIDDEN');end if;
 update private.account_totp_removal_intents set completed=true,completed_at=clock_timestamp() where factor_id=old.id;
 return old;
end$$;
revoke all on function private.account_totp_removal_fence() from public,anon,authenticated,service_role;
create trigger ftk_account_totp_removal_fence before delete on auth.mfa_factors for each row execute function private.account_totp_removal_fence();

create function private.account_totp_remove(r jsonb,auth_id uuid,session uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare account uuid;factor uuid:=(r->>'factor_id')::uuid;checked jsonb;trace uuid:=private.new_id(ids,1);code text;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 if not exists(select 1 from auth.users u where u.id=auth_id and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())) then perform private.fail('AUTH_REQUIRED');end if;
 if not exists(select 1 from auth.sessions s where s.id=session and s.user_id=auth_id and (s.not_after is null or s.not_after>clock_timestamp())) then perform private.fail('SESSION_REVOKED');end if;
 select a.id into account from core.accounts a where a.auth_user_id=auth_id and a.state='active';
 -- A narrowly completed own intent is a status read even after native AAL downgrade.
 if account is not null and exists(select 1 from private.account_totp_removal_intents i where i.factor_id=factor and i.account_id=account and i.completed) and not exists(select 1 from auth.mfa_factors f where f.id=factor) then
  return jsonb_build_object('ok',true,'data',jsonb_build_object('factor_id',factor,'removed',true,'provider','supabase_auth'),'trace_id',trace);
 end if;
 if aux->>'phase'='totp_complete' then perform private.fail('TEMPORARY_FAILURE');end if;
 if aux->>'phase' is distinct from 'totp_prepare' then perform private.fail('VALIDATION_FAILED');end if;
 checked:=private.execute_operation('account_get_v1',r,auth_id,session,ids,aux);if checked->>'ok' is distinct from 'true' then return checked;end if;
 account:=(checked#>>'{data,id}')::uuid;
 perform private.p07_lifecycle_reauth(account,aux);
 if aux->>'reauth_session_id' is distinct from session::text then perform private.fail('AUTH_REQUIRED');end if;
 if aux->>'verified_aal' is distinct from 'aal2' or not exists(select 1 from auth.sessions s where s.id=session and s.user_id=auth_id and to_jsonb(s)->>'aal'='aal2') then perform private.fail('AUTH_REQUIRED');end if;
 perform 1 from auth.mfa_factors f where f.id=factor and f.user_id=auth_id and f.factor_type::text='totp' and f.status::text='verified' for update;
 if not found then perform private.fail('NOT_FOUND');end if;
 insert into private.account_totp_removal_intents(factor_id,account_id,session_id,expires_at) values(factor,account,session,clock_timestamp()+interval '10 seconds')
 on conflict(factor_id) do update set session_id=excluded.session_id,expires_at=excluded.expires_at where private.account_totp_removal_intents.account_id=excluded.account_id and not private.account_totp_removal_intents.completed;
 if not found then perform private.fail('INTEGRITY_VIOLATION');end if;
 return jsonb_build_object('_internal_totp_remove',jsonb_build_object('factor_id',factor));
exception when others then
 code:=case when SQLSTATE='P0001' then SQLERRM else 'INTEGRITY_VIOLATION' end;
 return jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'retryable',code='TEMPORARY_FAILURE','trace_id',trace));
end$$;
revoke all on function private.account_totp_remove(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function private.account_totp_remove(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

do $patch$
declare b text:=pg_get_functiondef('private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)'::regprocedure);old text;
begin
 old:=$a$ perform 1 from auth.sessions where id=p_session_id and user_id=p_actor_auth_id and (not_after is null or not_after>now());
 if not found then perform private.fail('SESSION_REVOKED');end if;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Native MFA guard anchor mismatch';end if;
 b:=replace(b,old,old||$a$
 if not (p_operation='account_sessions_revoke_v1' and r->>'mode'='current') then perform private.account_mfa_assert(usr.id,p_session_id,p_aux);end if;
$a$);
 old:=' -- Central permission mapping; no user_metadata or request actor/role can grant access.';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Account session access anchor mismatch';end if;
 b:=replace(b,old,$a$ if p_operation in('account_sessions_list_v1','account_session_label_v1','account_sessions_revoke_v1','account_security_history_get_v1') then
  if org is not null or center is not null then perform private.fail('VALIDATION_FAILED');end if;
  perform pg_advisory_xact_lock(hashtextextended('account.sessions.'||actor.id,0));
 end if;
$a$||old);
 old:=$a$ elsif p_operation in ('account_profile_update_v1','account_delete_preview_v1','account_delete_apply_v1') then null;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Account session self permission anchor mismatch';end if;
 b:=replace(b,old,old||$a$
 elsif p_operation in('account_sessions_list_v1','account_session_label_v1','account_sessions_revoke_v1','account_security_history_get_v1') then null;$a$);
 old:=$a$ if p_operation in ('account_delete_apply_v1','organization_delete_apply_v1') then r:=r-'reauth';end if;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Account session reauth canonicalization anchor mismatch';end if;
 b:=replace(b,old,$a$ if p_operation in ('account_delete_apply_v1','organization_delete_apply_v1','account_sessions_revoke_v1') then r:=r-'reauth';end if;$a$);
 old:=' -- DOMAIN_CASES';
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Account session execution anchor mismatch';end if;
 b:=replace(b,old,$a$
 when 'account_sessions_list_v1','account_session_label_v1','account_sessions_revoke_v1','account_security_history_get_v1' then
  out:=private.account_sessions_execute(p_operation,r,actor.id,p_session_id,operation_id,p_ids,p_aux);record_id:=actor.id;subject:='accounts';
 -- DOMAIN_CASES$a$);
 old:=$a$ if out ? 'items' and p_operation not in ('disciplines_list_v1','settings_history_get_v1') then out:=out||jsonb_build_object('as_of',now());end if;$a$;
 if array_length(string_to_array(b,old),1)<>2 then raise exception 'Account session pagination timestamp anchor mismatch';end if;
 b:=replace(b,old,$a$ if out ? 'items' and p_operation not in ('disciplines_list_v1','settings_history_get_v1','account_sessions_list_v1','account_security_history_get_v1') then out:=out||jsonb_build_object('as_of',now());end if;$a$);
 execute b;
end$patch$;
commit;
