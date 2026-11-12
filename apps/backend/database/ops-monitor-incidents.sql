begin;
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
 ),integrity_keys as (
  select encode(extensions.digest('integrity/'||id::text,'sha256'),'hex') fingerprint from private.ops_integrity_events order by fingerprint limit 1000
 ),totals as (
  select (select count(*) from terminal) exhausted,(select count(*) from private.ops_integrity_events) integrity
 )
 select jsonb_build_object(
  'checkedAt',statement_timestamp(),
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
commit;
