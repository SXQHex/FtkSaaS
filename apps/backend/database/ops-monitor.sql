begin;
-- Independent operator LOGIN; no tenant table, Auth or worker authority.
do $$begin
 if not exists(select 1 from pg_roles where rolname='ftk_ops_monitor') then
  create role ftk_ops_monitor login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;
 end if;
 if exists(select 1 from pg_roles where rolname='ftk_ops_monitor' and (not rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
 or exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname='ftk_ops_monitor') then raise exception 'UNSAFE_MONITOR_ROLE';end if;
end$$;
alter role ftk_ops_monitor connection limit 2;
alter role ftk_ops_monitor set statement_timeout='15s';
alter role ftk_ops_monitor set lock_timeout='5s';
alter role ftk_ops_monitor set default_transaction_read_only=on;
create schema ops_monitor;
revoke all on schema ops_monitor from public,anon,authenticated,service_role;
grant usage on schema ops_monitor to ftk_ops_monitor;

-- A later idle heartbeat must not erase a critical worker observation.
create table private.ops_integrity_events(
 id uuid primary key,
 observed_at timestamptz not null default clock_timestamp(),
 lane text not null check(lane in ('p01','p05','p06','p07','p07_privacy'))
);
alter table private.ops_integrity_events enable row level security;
revoke all on private.ops_integrity_events from public,anon,authenticated,service_role,ftk_ops_monitor;
create function private.ops_record_integrity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.ops_integrity_events(id,lane) values((private.ops_uuid_bank(1))[1],new.lane);
 return new;
end$$;
revoke all on function private.ops_record_integrity() from public,anon,authenticated,service_role,ftk_ops_monitor;
create trigger ops_record_integrity after update on private.ops_worker_health for each row
 when(new.last_status in ('claim_error','job_error') and new.last_error_code='INTEGRITY_VIOLATION') execute function private.ops_record_integrity();

create function ops_monitor.snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if session_user::text<>'ftk_ops_monitor' then raise exception using errcode='P0001',message='FORBIDDEN';end if;
 select jsonb_build_object(
  'checkedAt',statement_timestamp(),
  'workers',(select jsonb_agg(jsonb_build_object('lane',lane,'enabled',enabled,'lastFinishedAt',last_finished_at,'lastStatus',last_status) order by lane) from private.ops_worker_health),
  'jobs',jsonb_build_object(
   'stuck',(select count(*) from core.outbox_jobs where state='running' and (lease_until is null or lease_until<statement_timestamp()))+(select count(*) from private.p07_privacy_jobs where state='running' and (lease_until is null or lease_until<statement_timestamp())),
   'exhausted',(select count(*) from core.outbox_jobs j where state='failed' or exists(select 1 from private.email_provider_events e where e.provider_reference::text=j.provider_reference and e.kind in ('bounced','complained','failed')))+(select count(*) from private.p07_privacy_jobs where state='failed'),
   'integrity',(select count(*) from private.ops_integrity_events))) into result;
 return result;
end$$;
revoke all on function ops_monitor.snapshot() from public,anon,authenticated,service_role;
grant execute on function ops_monitor.snapshot() to ftk_ops_monitor;
commit;
