begin;
-- A global account hold is distinct from a tenant's business-record hold.
alter table core.retention_holds alter column org_id drop not null;
alter table core.retention_holds add constraint retention_hold_global_account
 check(org_id is not null or subject_table='accounts');
create index retention_holds_subject_scope on core.retention_holds(subject_table,subject_id);

-- Explicit bounded rollout, just like the existing native worker scope binding.
-- Migration/deploy alone never authorizes physical deletion of a hosted account.
create table private.account_profile_erasure_scopes(
 db_role name not null,account_id uuid not null references core.accounts(id),primary key(db_role,account_id)
);
create table private.account_profile_erasures(
 request_id uuid primary key references core.privacy_requests(id),account_id uuid not null references core.accounts(id),
 policy_version int not null check(policy_version=1),scope_hash text not null check(scope_hash~'^[a-f0-9]{64}$'),
 completed_at timestamptz,removed_rows bigint not null default 0 check(removed_rows>=0),
 removed_bytes bigint not null default 0 check(removed_bytes>=0)
);
alter table private.account_profile_erasure_scopes enable row level security;
alter table private.account_profile_erasures enable row level security;
revoke all on private.account_profile_erasure_scopes,private.account_profile_erasures from public,anon,authenticated,service_role,ftk_p07_privacy_worker;

-- Only the leased worker's transaction can erase immutable avatar copies.
-- All updates, other scopes and all ordinary writes remain append-only.
create function private.account_profile_media_erasure_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare request uuid;account uuid;
begin
 if TG_OP='DELETE' and TG_TABLE_SCHEMA='private' and TG_TABLE_NAME in ('settings_media_assets','settings_media_history')
  and pg_has_role(session_user,'ftk_p07_privacy_worker','member') then
  request:=nullif(current_setting('ftk.profile_erasure_request',true),'')::uuid;
  select e.account_id into account from private.account_profile_erasures e
   join core.privacy_requests p on p.id=e.request_id join core.accounts a on a.id=e.account_id
   where e.request_id=request and e.completed_at is null and p.kind='account_delete'
    and p.org_id is null and p.requester_account_id=e.account_id and p.state in ('requested','partial','running')
    and a.state='deletion_pending'
    and exists(select 1 from private.account_profile_erasure_scopes s where s.db_role=session_user and s.account_id=e.account_id);
  if account is not null and OLD.scope_key='user:'||account then
   perform private.p07_privacy_scope(null);return OLD;
  end if;
 end if;
 perform private.fail('INTEGRITY_VIOLATION');return null;
end$$;
drop trigger settings_media_assets_immutable on private.settings_media_assets;
drop trigger settings_media_history_immutable on private.settings_media_history;
create trigger settings_media_assets_immutable before update or delete on private.settings_media_assets for each row execute function private.account_profile_media_erasure_guard();
create trigger settings_media_history_immutable before update or delete on private.settings_media_history for each row execute function private.account_profile_media_erasure_guard();

create function private.account_profile_erasure(request uuid) returns jsonb
 language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p core.privacy_requests;a core.accounts;e private.account_profile_erasures;skey text;
 rows_removed bigint:=0;bytes_removed bigint:=0;n bigint;t text;previous text;hash text;held boolean;
begin
 perform private.p07_privacy_scope(null);
 select * into p from core.privacy_requests where id=request and org_id is null for update;
 if p.id is null or p.kind<>'account_delete' or p.scope->>'kind'<>'account'
  or p.scope->>'account_id' is distinct from p.requester_account_id::text or p.state not in ('requested','partial','running') then perform private.fail('FORBIDDEN');end if;
 select * into a from core.accounts where id=p.requester_account_id for update;
 hash:=encode(extensions.digest(jsonb_build_object('request_id',p.id,'account_id',a.id,'policy_version',1,'scope','account_profile_only')::text,'sha256'),'hex');
 select * into e from private.account_profile_erasures where request_id=p.id for update;
 if e.request_id is not null and (e.account_id is distinct from a.id or e.scope_hash<>hash) then perform private.fail('INTEGRITY_VIOLATION');end if;
 -- Completed evidence is immutable history, even after rollout unbinding or a
 -- later hold. Neither case authorizes another physical purge.
 if e.completed_at is not null then return jsonb_build_object('state','completed','policy_version',1,'completed_at',e.completed_at,'removed_rows',e.removed_rows,'removed_bytes',e.removed_bytes);end if;
 if a.id is null or a.state<>'deletion_pending' or private.p07_lifecycle_owner_blocked(a.id)
  or exists(select 1 from core.account_links l where l.account_id=a.id and l.state='active') then perform private.fail('FORBIDDEN');end if;
 if not exists(select 1 from private.account_profile_erasure_scopes s where s.db_role=session_user and s.account_id=a.id) then
  return jsonb_build_object('state','unbound','policy_version',1);
 end if;
 -- Serialize new/changed holds with the atomic physical purge. review_at is
 -- a review date, never an automatic permission to erase a held account.
 lock table core.retention_holds in share mode;
 with targets(subject_table,subject_id) as (
  select 'accounts',a.id union all
  select 'p07_profiles',account_id from private.p07_profiles where account_id=a.id union all
  select 'account_identity_names',account_id from private.account_identity_names where account_id=a.id union all
  select 'account_contact_projections',contact_id from private.account_contact_projections where account_id=a.id union all
  select 'account_session_labels',session_id from private.account_session_labels where account_id=a.id union all
  select 'account_google_link_intents',account_id from private.account_google_link_intents where account_id=a.id union all
  select 'account_totp_removal_intents',factor_id from private.account_totp_removal_intents where account_id=a.id union all
  select 'p07_account_inbox',id from private.p07_account_inbox where account_id=a.id union all
  select 'p07_account_events',id from private.p07_account_events where account_id=a.id union all
  select 'frontend_settings_previews',id from private.frontend_settings_previews where actor_account_id=a.id union all
  select 'p07_lifecycle_previews',id from private.p07_lifecycle_previews where account_id=a.id union all
  select 'frontend_settings',a.id from private.frontend_settings where scope_key='user:'||a.id or (scope='member' and split_part(scope_key,':',3)=a.id::text) union all
  select 'settings_media_current',asset_id from private.settings_media_current where scope_key='user:'||a.id union all
  select 'settings_media_history',operation_id from private.settings_media_history where scope_key='user:'||a.id union all
  select 'settings_media_assets',id from private.settings_media_assets where scope_key='user:'||a.id
 ) select exists(select 1 from targets t join core.retention_holds h on h.subject_id=t.subject_id
  and h.subject_table in (t.subject_table,'private.'||t.subject_table,'core.'||t.subject_table)) into held;
 if held then
  return jsonb_build_object('state','held','policy_version',1);
 end if;
 skey:='user:'||a.id;
 insert into private.account_profile_erasures(request_id,account_id,policy_version,scope_hash) values(p.id,a.id,1,hash);
 select coalesce(sum(octet_length(body)),0) into bytes_removed from private.settings_media_assets where scope_key=skey;
 previous:=current_setting('ftk.profile_erasure_request',true);
 perform set_config('ftk.profile_erasure_request',p.id::text,true);
 delete from private.settings_media_current where scope_key=skey;get diagnostics n=row_count;rows_removed:=rows_removed+n;
 delete from private.settings_media_history where scope_key=skey;get diagnostics n=row_count;rows_removed:=rows_removed+n;
 delete from private.settings_media_assets where scope_key=skey;get diagnostics n=row_count;rows_removed:=rows_removed+n;
 perform set_config('ftk.profile_erasure_request',coalesce(previous,''),true);
 -- Fixed reviewed account-only surfaces; tenant people/contacts, business
 -- receipts, financial rows, consent/security and mixed histories are preserved.
 foreach t in array array['p07_account_inbox','p07_account_events','p07_profiles','account_identity_names','account_contact_projections','account_session_labels','account_google_link_intents','account_totp_removal_intents'] loop
  execute format('delete from private.%I where account_id=$1',t) using a.id;
  get diagnostics n=row_count;rows_removed:=rows_removed+n;
 end loop;
 delete from private.frontend_settings_previews where actor_account_id=a.id;get diagnostics n=row_count;rows_removed:=rows_removed+n;
 delete from private.p07_lifecycle_previews where account_id=a.id;get diagnostics n=row_count;rows_removed:=rows_removed+n;
 delete from private.frontend_settings where scope_key=skey or (scope='member' and split_part(scope_key,':',3)=a.id::text);get diagnostics n=row_count;rows_removed:=rows_removed+n;
 update private.account_profile_erasures set completed_at=clock_timestamp(),removed_rows=rows_removed,removed_bytes=bytes_removed where request_id=p.id returning * into e;
 return jsonb_build_object('state','completed','policy_version',1,'completed_at',e.completed_at,'removed_rows',e.removed_rows,'removed_bytes',e.removed_bytes);
end$$;

do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p07_privacy_execute(jsonb,uuid[])'::regprocedure);
 a:=' insert into private.p07_privacy_manifests(request_id,scopes)';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Account profile privacy stage anchor mismatch';end if;
 execute replace(b,a,$a$ if org is null then scopes:=jsonb_set(scopes,'{database,profile}',private.account_profile_erasure(p.id));end if;
$a$||a);
 b:=pg_get_functiondef('private.p07_privacy_status(jsonb,uuid,jsonb)'::regprocedure);
 a:='jsonb_build_object(''request_state'',p.state,';
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Account profile privacy status anchor mismatch';end if;
 execute replace(b,a,'jsonb_build_object(''profile_erasure'',manifest#>''{database,profile}'',''request_state'',p.state,');
end$patch$;
revoke all on function private.account_profile_erasure(uuid),private.account_profile_media_erasure_guard() from public,anon,authenticated,service_role,ftk_p07_privacy_worker;
commit;
