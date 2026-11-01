begin;
-- Delivery credentials/configuration are operational inputs, never client data.
create table private.invitation_sender_config(
 org_id uuid primary key references core.organizations(id),enabled boolean not null default false,
 from_email text not null,app_origin text not null,resend_secret_id uuid not null,
 check(from_email !~ '[\r\n]' and from_email like '%@%'),
 check(app_origin ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$')
);
create table private.invitation_delivery_state(
 job_id uuid primary key references core.outbox_jobs(id),lease_hash text,
 first_attempt_at timestamptz,from_email text,app_origin text,resend_secret_id uuid,safe_error_code text
);
create table private.invitation_ticks(request_id uuid primary key,created_at timestamptz not null default clock_timestamp());
create table private.invitation_dispatch_config(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 backend_origin text not null,anon_secret_id uuid not null,signing_secret_id uuid not null,
 check(backend_origin ~ '^https://[a-z0-9]+\.supabase\.co$')
);
grant all on private.invitation_sender_config,private.invitation_delivery_state,private.invitation_ticks to service_role;
alter table private.invitation_sender_config enable row level security;
alter table private.invitation_delivery_state enable row level security;
alter table private.invitation_ticks enable row level security;
alter table private.invitation_dispatch_config enable row level security;
revoke all on private.invitation_sender_config,private.invitation_delivery_state,private.invitation_ticks,private.invitation_dispatch_config from public,anon,authenticated;

create function private.invitation_features(org uuid,delivery boolean default false) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 perform private.require_feature(org,'F04');perform private.require_feature(org,'F06');
 if delivery then perform private.require_feature(org,'F26');end if;return true;
exception when sqlstate 'P0001' then if sqlerrm in ('PLAN_FEATURE_UNAVAILABLE','POLICY_NOT_CONFIGURED') then return false;end if;raise;
end$$;

create function private.invitation_job_scope(jid uuid,org uuid,center uuid,actor uuid,account uuid) returns core.outbox_jobs
language plpgsql security invoker set search_path='' as $$
declare q core.outbox_jobs;i core.invitations;
begin
 select j.* into q from core.outbox_jobs j join private.invitation_deliveries d on d.job_id=j.id where j.id=jid and j.org_id=org and j.kind='account_invitation';
 if q.id is null then return null;end if;
 select x.* into i from core.invitations x join private.invitation_deliveries d on d.invitation_id=x.id where d.job_id=q.id and x.org_id=org;
 if i.id is null or i.inviter_account_id is distinct from account or (center is not null and center is distinct from i.center_id)
  or (i.center_id is not null and private.center_accessible(org,i.center_id) is not true)
  or private.can_invite(org,actor,i.center_id,i.person_id) is not true then perform private.fail('NOT_FOUND');end if;
 if not private.invitation_features(org) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
 return q;
end$$;

-- Preserve the existing report/import authorization and tracking paths verbatim.
do $patch$
declare b text;a text;
begin
 b:=pg_get_functiondef('private.p06_access(text,jsonb,uuid,uuid,uuid,uuid)'::regprocedure);
 a:=$a$ elsif op in ('report_file_get_v1','job_status_get_v1','import_rows_list_v1') then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Invitation access anchor mismatch';end if;
 execute replace(b,a,$a$ elsif op='job_status_get_v1' and (private.invitation_job_scope((r->>'job_id')::uuid,org,center,actor,account)).id is not null then return;
$a$||a);
 b:=pg_get_functiondef('private.p06_tracking(text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid[])'::regprocedure);
 a:=$a$ elsif op='job_status_get_v1' then$a$;
 if array_length(string_to_array(b,a),1)<>2 then raise exception 'Invitation tracking anchor mismatch';end if;
 execute replace(b,a,$a$ elsif op='job_status_get_v1' and (private.invitation_job_scope((r->>'job_id')::uuid,org,center,actor,account)).id is not null then
  q:=private.invitation_job_scope((r->>'job_id')::uuid,org,center,actor,account);
  data:=jsonb_build_object('id',q.id,'state',q.state,'progress_count',case when q.state='succeeded' then 1 else 0 end,'total_count',1,
   'result_reference',case when q.state='succeeded' then (select jsonb_build_object('type','invitations','id',d.invitation_id) from private.invitation_deliveries d where d.job_id=q.id) end,
   'safe_error_code',(select s.safe_error_code from private.invitation_delivery_state s where s.job_id=q.id));pid:=q.id;
$a$||a);
end$patch$;

-- Revocation/supersession invalidates queued work, independently of the worker.
create function private.invitation_cancel_delivery() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.state<>'pending' then
  update core.outbox_jobs j set state='cancelled',lease_until=null,version=j.version+1
   from private.invitation_deliveries d where d.invitation_id=new.id and j.id=d.job_id and j.state in ('pending','retry_wait');
 end if;return new;
end$$;
create trigger invitation_cancel_delivery after update of state on core.invitations for each row execute function private.invitation_cancel_delivery();

-- Only the service-only Edge handoff calls this function. No human JWT, input
-- actor ID or user metadata grants worker access. Internal payloads never reach UI.
create function private.invitation_worker(r jsonb,aux jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare q core.outbox_jobs;i core.invitations;d private.invitation_deliveries;s private.invitation_delivery_state;
 cfg private.invitation_sender_config;token text;api_key text;phase text:=aux->>'invitation_phase';ok boolean;
begin
 if phase='claim' then
  insert into private.invitation_ticks(request_id) values((r->>'request_id')::uuid) on conflict do nothing;
  if not found then return jsonb_build_object('_internal_invitation',null);end if;
  delete from private.invitation_ticks where request_id in (select request_id from private.invitation_ticks where created_at<clock_timestamp()-interval '1 day' order by created_at limit 100);
  select j.* into q from core.outbox_jobs j join private.invitation_deliveries x on x.job_id=j.id
   join private.invitation_sender_config c on c.org_id=j.org_id and c.enabled
   where j.kind='account_invitation' and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp()))
   order by j.created_at,j.id limit 1;
  if q.id is null then return jsonb_build_object('_internal_invitation',null);end if;
  perform 1 from core.organizations where id=q.org_id for update;
  select j.* into q from core.outbox_jobs j where j.id=q.id and ((j.state in ('pending','retry_wait') and coalesce(j.next_attempt_at,clock_timestamp())<=clock_timestamp()) or (j.state='running' and j.lease_until<=clock_timestamp())) for update skip locked;
  if q.id is null then return jsonb_build_object('_internal_invitation',null);end if;
  insert into private.invitation_delivery_state(job_id) values(q.id) on conflict do nothing;
  select * into s from private.invitation_delivery_state where job_id=q.id for update;
  select * into d from private.invitation_deliveries where job_id=q.id;
  select * into i from core.invitations where id=d.invitation_id and org_id=q.org_id for update;
  ok:=i.id is not null and i.state='pending' and i.expires_at>clock_timestamp()
   and private.access_mode(q.org_id) in ('normal','grace')
   and private.invitation_features(q.org_id,true)
   and (i.center_id is null or private.center_accessible(q.org_id,i.center_id))
   and private.can_invite(q.org_id,private.person_for(q.org_id,i.inviter_account_id),i.center_id,i.person_id)
   and not exists(select 1 from core.account_links where org_id=q.org_id and person_id=i.person_id and state='active');
  if not coalesce(ok,false) then
   update core.outbox_jobs set state='cancelled',lease_until=null,version=version+1 where id=q.id;
   update private.invitation_delivery_state set safe_error_code='INVITATION_UNAVAILABLE' where job_id=q.id;
   return jsonb_build_object('_internal_invitation',null);
  end if;
  -- Resend retains idempotency keys for 24h. Never resend an ambiguous old job.
  if q.attempts>=3 or s.first_attempt_at<clock_timestamp()-interval '23 hours' then
   update core.outbox_jobs set state='failed',lease_until=null,version=version+1 where id=q.id;
   update private.invitation_delivery_state set safe_error_code='TEMPORARY_FAILURE' where job_id=q.id;
   return jsonb_build_object('_internal_invitation',null);
  end if;
  select * into cfg from private.invitation_sender_config where org_id=q.org_id and enabled;
  select decrypted_secret into api_key from vault.decrypted_secrets where id=coalesce(s.resend_secret_id,cfg.resend_secret_id);
  if api_key is null or api_key='' then
   update core.outbox_jobs set state='failed',lease_until=null,version=version+1 where id=q.id;
   update private.invitation_delivery_state set safe_error_code='SERVICE_UNAVAILABLE' where job_id=q.id;
   return jsonb_build_object('_internal_invitation',null);
  end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  update private.invitation_delivery_state set lease_hash=encode(extensions.digest(token,'sha256'),'hex'),
   first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),from_email=coalesce(from_email,cfg.from_email),app_origin=coalesce(app_origin,cfg.app_origin),resend_secret_id=coalesce(resend_secret_id,cfg.resend_secret_id),safe_error_code=null where job_id=q.id returning * into s;
  update core.outbox_jobs set state='running',attempts=attempts+1,lease_until=clock_timestamp()+interval '2 minutes',version=version+1 where id=q.id;
  return jsonb_build_object('_internal_invitation',jsonb_build_object('job_id',q.id,'invitation_id',i.id,'org_id',q.org_id,'lease_token',token,
   'recipient',d.recipient,'sealed_token',d.sealed_token,'from_email',s.from_email,'app_origin',s.app_origin,'api_key',api_key));
 end if;
 if phase not in ('authorize','finish') then perform private.fail('FORBIDDEN');end if;
 perform 1 from core.organizations where id=(r->>'org_id')::uuid for update;
 select * into q from core.outbox_jobs where id=(r->>'job_id')::uuid and org_id=(r->>'org_id')::uuid and kind='account_invitation' for update;
 select * into s from private.invitation_delivery_state where job_id=q.id for update;
 if q.id is null or s.job_id is null or s.lease_hash is distinct from encode(extensions.digest(r->>'lease_token','sha256'),'hex') then perform private.fail('FORBIDDEN');end if;
 if phase='finish' and q.state='succeeded' and q.provider_reference=aux->>'provider_reference' then return jsonb_build_object('state',q.state);end if;
 if q.state<>'running' or q.lease_until<=clock_timestamp() then perform private.fail('OPERATION_IN_PROGRESS');end if;
 select x.* into i from core.invitations x join private.invitation_deliveries z on z.invitation_id=x.id where z.job_id=q.id and x.org_id=q.org_id for update;
 ok:=i.state='pending' and i.expires_at>clock_timestamp() and private.access_mode(q.org_id) in ('normal','grace')
  and private.invitation_features(q.org_id,true)
  and (i.center_id is null or private.center_accessible(q.org_id,i.center_id))
  and exists(select 1 from private.invitation_sender_config where org_id=q.org_id and enabled)
  and private.can_invite(q.org_id,private.person_for(q.org_id,i.inviter_account_id),i.center_id,i.person_id)
  and not exists(select 1 from core.account_links where org_id=q.org_id and person_id=i.person_id and state='active');
 if phase='authorize' then return jsonb_build_object('authorized',coalesce(ok,false));end if;
 if aux->>'provider_reference' is not null and aux->>'provider_reference' !~ '^[a-f0-9-]{36}$' then perform private.fail('VALIDATION_FAILED');end if;
 update core.outbox_jobs set state=case when aux->>'provider_reference' is not null then 'succeeded' when not coalesce(ok,false) then 'cancelled'
  when aux->>'retryable'='true' and attempts<3 then 'retry_wait' else 'failed' end,
  provider_reference=coalesce(aux->>'provider_reference',provider_reference),lease_until=null,
  next_attempt_at=clock_timestamp()+make_interval(secs=>30*(2^greatest(attempts-1,0))::int),version=version+1 where id=q.id returning * into q;
 update private.invitation_delivery_state set safe_error_code=case when q.state='succeeded' then null when q.state='cancelled' then 'INVITATION_UNAVAILABLE' else 'TEMPORARY_FAILURE' end where job_id=q.id;
 return jsonb_build_object('state',q.state);
end$$;

-- Preserve the human/other-worker path; only trusted internal phases bypass it.
create or replace function api_v1.outbox_deliver_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select case when p_actor_auth_id is null and p_session_id is null and p_aux ? 'invitation_phase'
 then private.invitation_worker(p_request,p_aux)
 else private.execute_operation('outbox_deliver_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux) end
$$;
revoke all on function private.invitation_job_scope(uuid,uuid,uuid,uuid,uuid),private.invitation_cancel_delivery(),private.invitation_worker(jsonb,jsonb) from public,anon,authenticated;
revoke all on function private.invitation_features(uuid,boolean) from public,anon,authenticated;
grant execute on function private.invitation_features(uuid,boolean) to service_role;
grant execute on function private.invitation_job_scope(uuid,uuid,uuid,uuid,uuid),private.invitation_worker(jsonb,jsonb) to service_role;
revoke all on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;

-- Installed explicitly after accepted development delivery. The queued request
-- carries only an opaque tick UUID, public anon JWT and short-lived HMAC; never
-- service-role/provider secrets, recipient, invitation token or tenant IDs.
create function private.invitation_dispatch() returns void language plpgsql security definer set search_path='' as $$
declare cfg private.invitation_dispatch_config;body text;at text;signing text;anon_key text;
begin
 if session_user::text<>'ftk_ops_invitation' then perform private.fail('FORBIDDEN');end if;
 select * into cfg from private.invitation_dispatch_config where singleton and enabled;
 if cfg.singleton is null then return;end if;
 select decrypted_secret into signing from vault.decrypted_secrets where id=cfg.signing_secret_id;
 select decrypted_secret into anon_key from vault.decrypted_secrets where id=cfg.anon_secret_id;
 if signing is null or anon_key is null then perform private.fail('SERVICE_UNAVAILABLE');end if;
 body:=jsonb_build_object('request_id',(private.ops_uuid_bank(1))[1])::text;at:=floor(extract(epoch from clock_timestamp()))::bigint::text;
 perform net.http_post(url:=cfg.backend_origin||'/functions/v1/backend-v1/invitation_delivery_tick',body:=body::jsonb,
  headers:=jsonb_build_object('content-type','application/json','authorization','Bearer '||anon_key,
   'x-ftk-worker-time',at,'x-ftk-worker-signature',encode(extensions.hmac(at||'.'||(body::jsonb->>'request_id'),signing,'sha256'),'hex')),timeout_milliseconds:=60000);
end$$;
revoke all on function private.invitation_dispatch() from public,anon,authenticated,service_role;
do $$begin
 if not exists(select 1 from pg_roles where rolname='ftk_ops_invitation') then create role ftk_ops_invitation login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;end if;
 if exists(select 1 from pg_roles where rolname='ftk_ops_invitation' and (not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
  or exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname='ftk_ops_invitation') then raise exception 'UNSAFE_INVITATION_WORKER_ROLE';end if;
end$$;
alter role ftk_ops_invitation connection limit 1;
alter role ftk_ops_invitation set statement_timeout='5s';
grant usage on schema private to ftk_ops_invitation;
grant execute on function private.invitation_dispatch() to ftk_ops_invitation;
notify pgrst,'reload schema';
commit;
