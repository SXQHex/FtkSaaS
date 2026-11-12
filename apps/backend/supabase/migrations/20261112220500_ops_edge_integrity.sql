begin;
create table private.ops_edge_integrity_events(
 id uuid primary key,
 observed_at timestamptz not null default clock_timestamp(),
 operation text not null references private.runtime_operations(name)
);
alter table private.ops_edge_integrity_events enable row level security;
revoke all on private.ops_edge_integrity_events from public,anon,authenticated,service_role,ftk_ops_monitor;
create function private.ops_edge_integrity_record(r jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(r) is distinct from 'object' or (r-array['operation','trace_id'])<>'{}'::jsonb
 or jsonb_typeof(r->'operation') is distinct from 'string' or jsonb_typeof(r->'trace_id') is distinct from 'string'
 or r->>'trace_id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 or not exists(select 1 from private.runtime_operations where name=r->>'operation') then raise exception using errcode='P0001',message='VALIDATION_FAILED';end if;
 insert into private.ops_edge_integrity_events(id,operation) values((r->>'trace_id')::uuid,r->>'operation') on conflict(id) do nothing;
 if exists(select 1 from private.ops_edge_integrity_events where id=(r->>'trace_id')::uuid and operation is distinct from r->>'operation') then raise exception using errcode='P0001',message='IDEMPOTENCY_PAYLOAD_MISMATCH';end if;
 return jsonb_build_object('accepted',true);
end$$;
revoke all on function private.ops_edge_integrity_record(jsonb) from public,anon,authenticated,ftk_ops_monitor;
grant execute on function private.ops_edge_integrity_record(jsonb) to service_role;
-- Extend only the private operator projection. No job or evidence row is edited.
create or replace function ops_monitor.snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if session_user::text<>'ftk_ops_monitor' then raise exception using errcode='P0001',message='FORBIDDEN';end if;
 with delivery as materialized (
  select provider_reference::text reference,max(case kind when 'complained' then 3 when 'bounced' then 2 else 1 end) damage
  from private.email_provider_events where kind in ('bounced','complained','failed') group by provider_reference
 ),terminal as materialized (
  select 'outbox/'||j.id::text||'/'||j.version::text||'/'||coalesce(d.damage,0)::text fault
  from core.outbox_jobs j left join delivery d on d.reference=j.provider_reference where j.state='failed' or d.reference is not null
  union all
  select 'privacy/'||id::text||'/'||coalesce(operation_key::text,'unclaimed')||'/'||attempts::text||'/'||stage_runs::text
  from private.p07_privacy_jobs where state='failed'
 ),terminal_keys as (
  select encode(extensions.digest(fault,'sha256'),'hex') fingerprint from terminal order by fingerprint limit 1000
 ),critical as materialized (
  select encode(extensions.digest('integrity/'||id::text,'sha256'),'hex') fingerprint from private.ops_integrity_events
  union all select encode(extensions.digest('edge/'||id::text,'sha256'),'hex') from private.ops_edge_integrity_events
 ),integrity_keys as (
  select fingerprint from critical order by fingerprint limit 1000
 ),totals as (
  select (select count(*) from terminal) exhausted,(select count(*) from critical) integrity
 )
 select jsonb_build_object(
  'checkedAt',statement_timestamp(),
  'deliveryWorker',(select jsonb_build_object('enabled',enabled,'lastFinishedAt',(select max(created_at) from private.invitation_ticks),'lastStatus',case when exists(select 1 from private.invitation_ticks) then 'succeeded' else 'not_started' end) from private.invitation_dispatch_config where singleton),
  'workers',(select jsonb_agg(jsonb_build_object('lane',lane,'enabled',enabled,'lastFinishedAt',last_finished_at,'lastStatus',last_status) order by lane) from private.ops_worker_health),
  'jobs',jsonb_build_object(
   'stuck',(select count(*) from core.outbox_jobs where state='running' and (lease_until is null or lease_until<statement_timestamp()))+(select count(*) from private.p07_privacy_jobs where state='running' and (lease_until is null or lease_until<statement_timestamp())),
   'exhausted',totals.exhausted,'integrity',totals.integrity),
  'incidents',jsonb_build_object(
   'exhausted',jsonb_build_object('keys',coalesce((select jsonb_agg(fingerprint order by fingerprint) from terminal_keys),'[]'::jsonb),'total',totals.exhausted),
   'integrity',jsonb_build_object('keys',coalesce((select jsonb_agg(fingerprint order by fingerprint) from integrity_keys),'[]'::jsonb),'total',totals.integrity))) into result from totals;
 return result;
end$$;
revoke all on function ops_monitor.snapshot() from public,anon,authenticated,service_role;
grant execute on function ops_monitor.snapshot() to ftk_ops_monitor;
create or replace function api_v1.outbox_deliver_v1(p_request jsonb,p_actor_auth_id uuid,p_session_id uuid,p_ids uuid[],p_aux jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select case when p_actor_auth_id is null and p_session_id is null and p_aux->>'ops_integrity_event'='true' then private.ops_edge_integrity_record(p_request) when p_actor_auth_id is null and p_session_id is null and p_aux->>'email_event'='true' then private.email_event_ingest(p_request) when p_actor_auth_id is null and p_session_id is null and p_aux ? 'email_phase' then private.transactional_email_worker(p_request,p_aux) when p_actor_auth_id is null and p_session_id is null and p_aux ? 'invitation_phase' then private.invitation_worker(p_request,p_aux) else private.execute_operation('outbox_deliver_v1',p_request,p_actor_auth_id,p_session_id,p_ids,p_aux) end$$;
revoke all on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function api_v1.outbox_deliver_v1(jsonb,uuid,uuid,uuid[],jsonb) to service_role;
commit;
