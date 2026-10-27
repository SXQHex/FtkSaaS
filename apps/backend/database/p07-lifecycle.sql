begin;
-- Account deletion has global scope; previews and technical audit never invent a tenant.
create table private.p07_lifecycle_config(singleton boolean primary key default true check(singleton),reauth_max_age_seconds int not null check(reauth_max_age_seconds between 1 and 900));
create table private.p07_lifecycle_previews(id uuid primary key,account_id uuid not null references core.accounts(id),org_id uuid references core.organizations(id),operation text not null,token_hash text not null,snapshot_hash text not null,payload jsonb not null,expires_at timestamptz not null,used boolean not null default false);
create table private.p07_lifecycle_events(id uuid primary key,account_id uuid not null references core.accounts(id),operation_id uuid not null references core.operation_receipts(id),action text not null,created_at timestamptz not null default clock_timestamp(),detail jsonb not null);
create trigger p07_lifecycle_event_immutable before update or delete on private.p07_lifecycle_events for each row execute function private.append_only();
create table private.p07_closure_epochs(org_id uuid not null references core.organizations(id),closed_at timestamptz not null,reopened_at timestamptz,primary key(org_id,closed_at));
alter table private.p07_lifecycle_config enable row level security;
alter table private.p07_lifecycle_previews enable row level security;
alter table private.p07_lifecycle_events enable row level security;
alter table private.p07_closure_epochs enable row level security;
revoke all on private.p07_lifecycle_config,private.p07_lifecycle_previews,private.p07_lifecycle_events,private.p07_closure_epochs from public,anon,authenticated;
grant select on private.p07_lifecycle_config to service_role;
grant select,insert,update on private.p07_lifecycle_previews,private.p07_closure_epochs to service_role;
grant select,insert on private.p07_lifecycle_events to service_role;
alter table core.privacy_requests add constraint p07_privacy_scope check((kind='account_delete' and org_id is null and scope->>'kind'='account' and scope->>'account_id' is not null) or (kind in ('organization_close','organization_delete') and org_id is not null and scope->>'kind'='organization' and scope->>'org_id'=org_id::text));

create function private.p07_lifecycle_snapshot(org uuid,account uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
#variable_conflict use_variable
declare snapshot jsonb;part jsonb;t text;
begin
 if org is null then
  return jsonb_build_object('account',(select to_jsonb(a) from core.accounts a where id=account),'links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from core.account_links l where l.account_id=account),'owned_organizations',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]') from core.organizations o where exists(select 1 from core.account_links l where l.account_id=account and l.org_id=o.id and l.person_id=o.owner_person_id)));
 end if;
 snapshot:='{}';
 -- Fixed reviewed table allowlist. Hash private snapshots; never expose financial rows in previews.
 foreach t in array array['organizations','saas_subscriptions','saas_change_requests','account_links','role_assignments','centers','sessions','reservations','lesson_requests','waitlist_entries','event_registrations','debts','debt_allocations','cash_movements','student_credit_movements','sales','earnings','files'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]''::jsonb) from core.%I x where x.org_id=$1',t) into part using org;
  snapshot:=snapshot||jsonb_build_object(t,part);
 end loop;return snapshot;
end$$;
create function private.p07_lifecycle_hash(org uuid,account uuid) returns text language sql stable security invoker set search_path='' as $$select encode(extensions.digest(private.p07_lifecycle_snapshot(org,account)::text,'sha256'),'hex')$$;
create function private.p07_lifecycle_owner_blocked(account uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where l.account_id=account and l.state='active' and o.state in ('active','deletion_pending'))
$$;
create function private.p07_lifecycle_impact(org uuid,account uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('active_account_links',(select count(*) from core.account_links l where l.account_id=account and l.state='active' and ($1 is null or l.org_id=$1)),
 'open_sessions',(select count(*) from core.sessions s where s.org_id=$1 and s.state='planned'),
 'open_requests',(select count(*) from core.lesson_requests q where q.org_id=$1 and q.state not in ('cancelled','expired','rejected','completed')),
 'active_reservations',(select count(*) from core.reservations r where r.org_id=$1 and r.state='active'),
 'active_event_registrations',(select count(*) from core.event_registrations r where r.org_id=$1 and r.state='active'),
 'open_debts',(select count(*) from core.debts d where d.org_id=$1 and private.debt_remaining($1,d.id)>0),
 'student_credit_accounts',(select count(*) from (select distinct person_id,center_id,currency from core.student_credit_movements where org_id=$1) x),
 'export_operation','report_export_start_v1','export_requires_scope_check',true,'export_before_closure',true,'physical_erasure_complete',false)
$$;
create function private.p07_lifecycle_reauth(account uuid,aux jsonb) returns void language plpgsql stable security invoker set search_path='' as $$
declare max_age int;auth_id uuid;
begin
 select reauth_max_age_seconds into max_age from private.p07_lifecycle_config where singleton;
 if max_age is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 select auth_user_id into auth_id from core.accounts where id=account and state in ('active','deletion_pending');
 if aux->>'reauth_verified' is distinct from 'true' or aux->>'reauth_auth_id' is distinct from auth_id::text or not exists(select 1 from auth.sessions s where s.id=(aux->>'reauth_session_id')::uuid and s.user_id=auth_id and s.created_at>=clock_timestamp()-make_interval(secs=>max_age) and s.created_at<=clock_timestamp() and (s.not_after is null or s.not_after>clock_timestamp())) then perform private.fail('AUTH_REQUIRED');end if;
end$$;
create function private.p07_invalidate_auth_sessions(account uuid) returns void language plpgsql security definer set search_path='' as $$
declare auth_id uuid;
begin
 -- Only the validated lifecycle command calls this private administrative primitive.
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' then perform private.fail('FORBIDDEN');end if;
 select auth_user_id into auth_id from core.accounts a where a.id=account and a.state='deletion_pending';
 if auth_id is null then perform private.fail('FORBIDDEN');end if;
 -- Auth's FK cascades session-bound refresh tokens and AMR claims. Legacy refresh
 -- rows without a session also lose validity; Auth user/identity erasure is a later scope.
 delete from auth.refresh_tokens where user_id=auth_id::text;
 delete from auth.sessions where user_id=auth_id;
end$$;
create function private.p07_lifecycle_preview(op text,r jsonb,org uuid,account uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare preview_id_v uuid:=private.new_id(ids,2);h text;blocks jsonb:='[]';effects jsonb;entity jsonb;deps jsonb;until_at timestamptz:=clock_timestamp()+interval '15 minutes';
begin
 if org is null then
  if op<>'account_delete_preview_v1' then perform private.fail('VALIDATION_FAILED');end if;
  entity:=jsonb_build_object('type','accounts','id',account);
  if private.p07_lifecycle_owner_blocked(account) then blocks:=jsonb_build_array(jsonb_build_object('code','OWNER_TRANSFER_REQUIRED','retryable',false,'trace_id',private.new_id(ids,1)));end if;
 else
  if not exists(select 1 from core.organizations o join core.account_links l on l.org_id=o.id and l.person_id=o.owner_person_id where o.id=org and l.account_id=account and l.state='active' and l.verified_at is not null) then perform private.fail('FORBIDDEN');end if;
  if exists(select 1 from core.organizations where id=org and state in ('deletion_pending','deleted')) then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if btrim(coalesce(r->>'reason',''))='' or (op='organization_delete_preview_v1' and r->>'all_data' is distinct from 'true') then perform private.fail('VALIDATION_FAILED');end if;
  entity:=jsonb_build_object('type','organizations','id',org);
 end if;
 if coalesce(aux->>'token','')='' then perform private.fail('TEMPORARY_FAILURE');end if;
 h:=private.p07_lifecycle_hash(org,account);
 deps:=jsonb_build_object('versions',jsonb_build_array(jsonb_build_object('entity',entity,'version',case when org is null then (select version from core.accounts where id=account) else (select version from core.organizations where id=org) end)),'policy_hashes',jsonb_build_array(h),'permission_hash',account::text);
 effects:=jsonb_build_array(jsonb_build_object('entity',entity,'action',case when op='organization_close_preview_v1' then 'close' else 'delete' end,'reason',case when op='organization_close_preview_v1' then 'Immediate service closure; obligations/history retained; no automatic refunds or attendance.' else 'Immediate access revocation; physical erasure separately tracked, legal holds and external copies require confirmation.' end));
 insert into private.p07_lifecycle_previews(id,account_id,org_id,operation,token_hash,snapshot_hash,payload,expires_at) values(preview_id_v,account,org,replace(op,'_preview_','_apply_'),encode(extensions.digest(aux->>'token','sha256'),'hex'),h,r-'request_id',until_at);
 return jsonb_build_object('id',preview_id_v,'token',aux->'token','scope_hash',h,'dependencies',deps,'effects',effects,'blockers',blocks,'expires_at',until_at,'lifecycle_impact',private.p07_lifecycle_impact(org,account));
end$$;
create function private.p07_lifecycle_command(op text,r jsonb,org uuid,account uuid,operation uuid,ids uuid[],aux jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p private.p07_lifecycle_previews;o core.organizations;s core.saas_subscriptions;request_id_v uuid:=private.new_id(ids,2);ver bigint:=1;scope jsonb;link core.account_links;email_v text;at timestamptz:=clock_timestamp();
begin
 if org is null and op<>'account_delete_apply_v1' then perform private.fail('VALIDATION_FAILED');end if;
 if org is not null then
  select * into o from core.organizations where id=org for update;
  if not exists(select 1 from core.account_links where org_id=org and account_id=account and person_id=o.owner_person_id and state='active' and verified_at is not null) then perform private.fail('FORBIDDEN');end if;
 end if;
 if op='organization_reopen_v1' then
  if o.state<>'closed' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1 for update;
  if s.state<>'active' or s.starts_at is null or s.starts_at>at or s.period_end<=at then perform private.fail('SERVICE_UNAVAILABLE');end if;
  -- Suppress stale queued notifications/automation; preserve their source history.
  update core.outbox_jobs set state='cancelled',lease_until=null,version=version+1 where org_id=org and (kind='in_app' or kind like 'p05.%') and state in ('pending','running','retry_wait');
  update private.p07_closure_epochs set reopened_at=at where org_id=org and reopened_at is null;
  update core.organizations set state='active',closed_at=null,version=version+1 where id=org returning version into ver;
  return jsonb_build_object('data',jsonb_build_object('operation_id',operation,'primary_id',org,'version',ver,'replayed',false,'related','[]'::jsonb),'primary_id',org,'version',ver,'subject','organizations');
 end if;
 select * into p from private.p07_lifecycle_previews where id=(r#>>'{preview,id}')::uuid for update;
 if p.id is null or p.used or p.account_id<>account or p.org_id is distinct from org or p.operation<>op or p.expires_at<=at or p.token_hash is distinct from encode(extensions.digest(r#>>'{preview,token}','sha256'),'hex') then perform private.fail('PREVIEW_STALE');end if;
 if org is null then
  -- Stable lock order across all affected organizations; do not fabricate a tenant for the global request.
  perform 1 from core.organizations where id in (select org_id from core.account_links where account_id=account) order by id for update;
 else
  if o.state in ('deletion_pending','deleted') then perform private.fail('INVALID_STATE_TRANSITION');end if;
 end if;
 if p.snapshot_hash<>private.p07_lifecycle_hash(org,account) then perform private.fail('PREVIEW_STALE');end if;
 if op='organization_close_apply_v1' then
  if o.state<>'active' then perform private.fail('INVALID_STATE_TRANSITION');end if;
  if o.version is distinct from (r->>'expected_version')::bigint then perform private.fail('VERSION_CONFLICT');end if;
  update core.organizations set state='closed',closed_at=at,version=version+1 where id=org returning version into ver;
  insert into private.p07_closure_epochs(org_id,closed_at) values(org,at);
  update core.saas_subscriptions set cancel_at_period_end=true,version=version+1 where org_id=org and not cancel_at_period_end;
  update core.saas_change_requests set state='cancelled',version=version+1 where org_id=org and state='scheduled';
  update private.p07_lifecycle_previews set used=true where id=p.id;
  return jsonb_build_object('data',jsonb_build_object('operation_id',operation,'primary_id',org,'version',ver,'replayed',false,'related','[]'::jsonb),'primary_id',org,'version',ver,'subject','organizations','reason',p.payload->'reason');
 end if;
 perform private.p07_lifecycle_reauth(account,aux);
 if op='account_delete_apply_v1' then
  if private.p07_lifecycle_owner_blocked(account) then perform private.fail('OWNER_TRANSFER_REQUIRED');end if;
  select u.email into email_v from auth.users u join core.accounts a on a.auth_user_id=u.id where a.id=account;
  for link in select * from core.account_links where account_id=account and state='active' order by org_id,id for update loop
   update core.role_assignments set state='inactive',version=version+1 where account_link_id=link.id and state='active';
   update core.permission_overrides set enabled=false,version=version+1 where org_id=link.org_id and person_id=link.person_id and enabled;
   update private.settlement_grants set granted=false,version=version+1 where org_id=link.org_id and person_id=link.person_id and granted;
  end loop;
  update core.account_links set state='revoked',version=version+1 where account_id=account and state='active';
  update core.invitations set state='revoked',version=version+1 where state='pending' and (lower(email)=lower(email_v) or inviter_account_id=account);
  update core.accounts set state='deletion_pending',disabled_at=at,version=version+1 where id=account;
  perform private.p07_invalidate_auth_sessions(account);
  scope:=jsonb_build_object('kind','account','account_id',account,'org_id',null,'all_data',false);
 else
  if op<>'organization_delete_apply_v1' or r->>'all_data' is distinct from 'true' or p.payload->>'all_data' is distinct from 'true' then perform private.fail('VALIDATION_FAILED');end if;
  update core.organizations set state='deletion_pending',closed_at=coalesce(closed_at,at),version=version+1 where id=org;
  update core.invitations set state='revoked',version=version+1 where org_id=org and state='pending';
  update core.saas_subscriptions set cancel_at_period_end=true,version=version+1 where org_id=org and not cancel_at_period_end;
  update core.saas_change_requests set state='cancelled',version=version+1 where org_id=org and state='scheduled';
  scope:=jsonb_build_object('kind','organization','account_id',null,'org_id',org,'all_data',true);
 end if;
 insert into core.privacy_requests(id,org_id,kind,requester_account_id,scope,state,requested_at) values(request_id_v,org,case when org is null then 'account_delete' else 'organization_delete' end,account,scope,'requested',at);
 perform private.p07_privacy_enqueue(request_id_v,org,private.new_id(ids,12));
 insert into private.p07_lifecycle_events(id,account_id,operation_id,action,detail) values(private.new_id(ids,11),account,operation,op,jsonb_build_object('privacy_request_id',request_id_v,'scope',scope,'state','requested'));
 update private.p07_lifecycle_previews set used=true where id=p.id;
 return jsonb_build_object('data',jsonb_build_object('job_id',private.new_id(ids,12),'state','pending'),'primary_id',request_id_v,'version',1,'subject','privacy_requests','reason',p.payload->'reason');
end$$;
commit;
