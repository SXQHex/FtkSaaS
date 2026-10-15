-- Runtime foundation draft. Executed only in isolated development; committed as a new migration after verification.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists private.platform_operators(auth_user_id uuid primary key references auth.users(id), created_at timestamptz not null default now());
alter table private.platform_operators enable row level security;
create table if not exists private.preview_payloads(preview_id uuid primary key references core.previews(id),payload jsonb not null,expires_at timestamptz not null,token_hash text not null);
alter table private.preview_payloads enable row level security;
create table if not exists private.invitation_deliveries(invitation_id uuid primary key references core.invitations(id),job_id uuid not null references core.outbox_jobs(id),recipient text not null,sealed_token text not null,created_at timestamptz not null default now());
alter table private.invitation_deliveries enable row level security;
create unique index if not exists runtime_receipt_key on core.operation_receipts(org_id,actor_fingerprint,operation,key_hash) nulls not distinct;
create unique index if not exists runtime_bootstrap_key on core.operation_receipts(actor_fingerprint,operation,key_hash) where operation='organization_create_v1';
create unique index if not exists runtime_active_account_auth on core.accounts(auth_user_id);
create unique index if not exists runtime_active_link_account on core.account_links(org_id,account_id) where state='active';
create unique index if not exists runtime_active_link_person on core.account_links(org_id,person_id) where state='active';
create unique index if not exists runtime_active_role on core.role_assignments(org_id,person_id,role,scope_center_id) nulls not distinct where state='active';
create unique index if not exists runtime_active_center_person on core.center_relationships(org_id,center_id,person_id,kind) where state='active';
create unique index if not exists runtime_event_registration on core.event_registrations(org_id,event_id,person_id) where state='active';
create unique index if not exists runtime_allocation_event on core.entitlement_allocations(org_id,event_registration_id) where state in ('reserved','consumed');
create unique index if not exists runtime_allocation_reservation on core.entitlement_allocations(org_id,reservation_id) where state in ('reserved','consumed');
create unique index if not exists runtime_quota_bucket on core.quota_buckets(org_id,sale_id,starts_at,ends_at);
create unique index if not exists runtime_outbox_dedupe on core.outbox_jobs(org_id,dedupe_key);
grant usage on schema core,private,api_v1 to service_role;
grant select,insert,update,delete on all tables in schema core to service_role;
grant select,insert,update,delete on private.platform_operators,private.preview_payloads,private.invitation_deliveries to service_role;
grant select on auth.users,auth.sessions to service_role;
revoke all on private.platform_operators,private.preview_payloads,private.invitation_deliveries from public,anon,authenticated;

create or replace function private.fail(code text) returns void language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message=code;end$$;
create or replace function private.new_id(ids uuid[],i int) returns uuid language plpgsql immutable set search_path='' as $$
begin if ids[i] is null or substring(ids[i]::text,15,1)<>'7' or substring(ids[i]::text,20,1) not in ('8','9','a','b') then perform private.fail('INTEGRITY_VIOLATION');end if;return ids[i];end$$;
create or replace function private.person_for(org uuid,account uuid) returns uuid language sql stable set search_path='' as $$
 select person_id from core.account_links where org_id=org and account_id=account and state='active' and verified_at is not null
$$;
create or replace function private.has_role(org uuid,person uuid,role_name text,center uuid default null) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.role_assignments r join core.account_links l on l.id=r.account_link_id and l.org_id=r.org_id and l.person_id=r.person_id and l.state='active' and l.verified_at is not null
 where r.org_id=org and r.person_id=person and r.role=role_name and r.state='active' and (center is null or r.scope_center_id=center))
$$;
create or replace function private.is_manager(org uuid,person uuid,center uuid) returns boolean language sql stable set search_path='' as $$select private.has_role(org,person,'center_manager',center)$$;
create or replace function private.is_org_reader(org uuid,person uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.organizations where id=org and owner_person_id=person) or private.has_role(org,person,'org_manager',null)
$$;
create or replace function private.access_mode(org uuid) returns text language plpgsql stable set search_path='' as $$
#variable_conflict use_column
declare s core.saas_subscriptions; o core.organizations;
begin
 select * into o from core.organizations where id=org;
 if not found or o.state<>'active' then return 'closed';end if;
 select * into s from core.saas_subscriptions where org_id=org order by created_at desc,id desc limit 1;
 if not found or s.state='pending_payment' then return 'bootstrap';end if;
 if s.state in ('ended','suspended') then return 'closed';end if;
 if now()<s.period_end then return 'normal';end if;
 if s.cancel_at_period_end then return 'closed';end if;
 if now()<coalesce(s.grace_until,s.period_end+interval '7 days') then return 'grace';end if;
 return 'closed';
end$$;
create or replace function private.plan_limit(org uuid,key_name text) returns bigint language sql stable set search_path='' as $$
 select case when e->>'unlimited'='true' then null else (e->>'value')::bigint end
 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id cross join lateral jsonb_array_elements(p.limits->'entries') e
 where s.org_id=org and e->>'key'=key_name order by s.created_at desc limit 1
$$;
-- Signed movement effects. Reverse chains are append-only linked corrections, never a second balance.
create or replace function private.credit_effect(org uuid,movement uuid) returns bigint language plpgsql stable set search_path='' as $$
#variable_conflict use_column
declare m core.entitlement_movements;
begin
 select * into m from core.entitlement_movements where id=movement and org_id=org;
 if not found then perform private.fail('INTEGRITY_VIOLATION');end if;
 if m.kind='reverse' then
  if m.previous_id is null then perform private.fail('INTEGRITY_VIOLATION');end if;
  return -private.credit_effect(org,m.previous_id);
 end if;
 return case when m.kind in ('grant','adjust_add') then m.quantity when m.kind in ('consume','adjust_subtract','settle_deficit') then -m.quantity else 0 end;
end$$;
create or replace function private.credit_available(org uuid,sale uuid) returns bigint language sql stable set search_path='' as $$
 select coalesce((select sum(private.credit_effect(org,m.id)) from core.entitlement_movements m where m.org_id=org and m.sale_id=sale),0)
 -coalesce((select sum(a.quantity) from core.entitlement_allocations a where a.org_id=org and a.sale_id=sale and a.state='reserved'),0)
$$;
create or replace function private.lesson_scope_matches(org uuid,session uuid,product uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from core.sessions s join core.product_scopes sc on sc.org_id=s.org_id and sc.product_version_id=product
 where s.org_id=org and s.id=session and 'lesson'=any(sc.usage_targets) and sc.event_id is null
 and (sc.class_id is null or sc.class_id=s.class_id)
 and ((sc.scope_kind in ('center_discipline','center_all_disciplines') and sc.center_id=s.center_id) or sc.scope_kind in ('organization_discipline','organization_all'))
 and (sc.scope_kind in ('center_all_disciplines','organization_all') or sc.discipline_id=s.discipline_id))
$$;
create or replace function private.assert_center(org uuid,center uuid) returns void language plpgsql stable set search_path='' as $$
#variable_conflict use_column
declare p text;
begin
 if not exists(select 1 from core.centers where org_id=org and id=center and state='active') then perform private.fail('NOT_FOUND');end if;
 select v.name into p from core.saas_subscriptions s join core.saas_plan_versions v on v.id=s.plan_version_id where s.org_id=org order by s.created_at desc limit 1;
 if p is null then perform private.fail('POLICY_NOT_CONFIGURED');end if;
 if p<>'business' and center<>(select id from core.centers where org_id=org and state='active' order by created_at,id limit 1) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
end$$;
create or replace function private.require_feature(org uuid,feature text) returns void language plpgsql stable set search_path='' as $$
begin
 if not exists(select 1 from core.saas_subscriptions s join core.saas_plan_versions p on p.id=s.plan_version_id where s.org_id=org and feature=any(p.features)) then perform private.fail('PLAN_FEATURE_UNAVAILABLE');end if;
end$$;
commit;
