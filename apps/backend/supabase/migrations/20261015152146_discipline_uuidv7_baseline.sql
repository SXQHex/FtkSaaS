-- Generated baseline. No business endpoint is enabled by this migration.
begin;
create schema if not exists core;
create schema if not exists api_v1;
create schema if not exists private;
revoke all on schema core, private from public, anon, authenticated;
revoke all on schema api_v1 from public, anon, authenticated;
alter default privileges in schema core revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
create function private.new_uuid_v7() returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare result uuid;
begin
 if pg_catalog.to_regprocedure('pg_catalog.uuidv7(interval)') is not null then
   execute 'select pg_catalog.uuidv7()' into result;
 elsif pg_catalog.to_regprocedure('extensions.uuid_generate_v7()') is not null then
   execute 'select extensions.uuid_generate_v7()' into result;
 else
   raise exception using errcode='0A000', message='UUIDV7_GENERATOR_UNAVAILABLE';
 end if;
 return result;
end $$;
revoke all on function private.new_uuid_v7() from public, anon, authenticated;
create table core."organizations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "name" text not null,
  "owner_person_id" uuid not null,
  "state" text not null,
  "closed_at" timestamptz,
  unique (org_id,id)
);
alter table core."organizations" enable row level security;
revoke all on core."organizations" from public, anon, authenticated;
create table core."centers" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "name" text not null,
  "timezone" text not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."centers" enable row level security;
revoke all on core."centers" from public, anon, authenticated;
create table core."rooms" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "name" text not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."rooms" enable row level security;
revoke all on core."rooms" from public, anon, authenticated;
create table core."room_capacities" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "room_id" uuid not null,
  "nominal" bigint not null,
  "maximum" bigint not null,
  "discipline_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."room_capacities" enable row level security;
revoke all on core."room_capacities" from public, anon, authenticated;
create table core."availability_rules" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "resource_kind" text not null,
  "resource_id" uuid not null,
  "weekdays" bigint[] not null,
  "local_start" text not null,
  "local_end" text not null,
  "valid_from" date not null,
  "valid_until" date,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."availability_rules" enable row level security;
revoke all on core."availability_rules" from public, anon, authenticated;
create table core."availability_exceptions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "resource_kind" text not null,
  "resource_id" uuid not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "reason" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."availability_exceptions" enable row level security;
revoke all on core."availability_exceptions" from public, anon, authenticated;
create table core."policy_versions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "scope_center_id" uuid,
  "key" text not null,
  "effective_at" timestamptz not null,
  "mandatory" boolean not null,
  "value" jsonb not null,
  "previous_id" uuid,
  unique (org_id,id)
);
alter table core."policy_versions" enable row level security;
revoke all on core."policy_versions" from public, anon, authenticated;
create table core."accounts" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "auth_user_id" uuid,
  "state" text not null,
  "disabled_at" timestamptz
);
alter table core."accounts" enable row level security;
revoke all on core."accounts" from public, anon, authenticated;
create table core."account_links" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "account_id" uuid not null,
  "person_id" uuid not null,
  "state" text not null,
  "verified_at" timestamptz,
  unique (org_id,id)
);
alter table core."account_links" enable row level security;
revoke all on core."account_links" from public, anon, authenticated;
create table core."role_assignments" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "person_id" uuid not null,
  "role" text not null,
  "scope_center_id" uuid,
  "state" text not null,
  "account_link_id" uuid not null,
  unique (org_id,id)
);
alter table core."role_assignments" enable row level security;
revoke all on core."role_assignments" from public, anon, authenticated;
create table core."permission_overrides" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "permission" text not null,
  "enabled" boolean not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."permission_overrides" enable row level security;
revoke all on core."permission_overrides" from public, anon, authenticated;
create table core."invitations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "email" text not null,
  "token_hash" text not null,
  "inviter_account_id" uuid not null,
  "expires_at" timestamptz not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."invitations" enable row level security;
revoke all on core."invitations" from public, anon, authenticated;
create table core."people" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "display_name" text not null,
  "state" text not null,
  "merged_into_id" uuid,
  unique (org_id,id)
);
alter table core."people" enable row level security;
revoke all on core."people" from public, anon, authenticated;
create table core."person_contacts" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "person_id" uuid not null,
  "kind" text not null,
  "value" text not null,
  "verified_at" timestamptz,
  unique (org_id,id)
);
alter table core."person_contacts" enable row level security;
revoke all on core."person_contacts" from public, anon, authenticated;
create table core."center_relationships" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "kind" text not null,
  "state" text not null,
  "started_at" timestamptz not null,
  "ended_at" timestamptz,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."center_relationships" enable row level security;
revoke all on core."center_relationships" from public, anon, authenticated;
create table core."merge_requests" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "source_person_id" uuid not null,
  "target_person_id" uuid not null,
  "preview_id" uuid not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."merge_requests" enable row level security;
revoke all on core."merge_requests" from public, anon, authenticated;
create table core."merge_approvals" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "merge_request_id" uuid not null,
  "approver_person_id" uuid not null,
  "scope_hash" text not null,
  "approved_at" timestamptz not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."merge_approvals" enable row level security;
revoke all on core."merge_approvals" from public, anon, authenticated;
create table core."classes" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "name" text not null,
  "external_open" boolean not null,
  "state" text not null,
  "discipline_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."classes" enable row level security;
revoke all on core."classes" from public, anon, authenticated;
create table core."program_versions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "class_id" uuid not null,
  "weekdays" bigint[] not null,
  "local_start" text not null,
  "duration_minutes" bigint not null,
  "starts_on" date not null,
  "ends_on" date not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."program_versions" enable row level security;
revoke all on core."program_versions" from public, anon, authenticated;
create table core."sessions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "class_id" uuid,
  "program_id" uuid,
  "format" text not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "nominal" bigint not null,
  "maximum" bigint not null,
  "state" text not null,
  "attendance_state" text not null,
  "replaces_id" uuid,
  "discipline_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."sessions" enable row level security;
revoke all on core."sessions" from public, anon, authenticated;
create table core."session_assignments" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "session_id" uuid not null,
  "person_id" uuid not null,
  "duty" text not null,
  "agreement_id" uuid,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."session_assignments" enable row level security;
revoke all on core."session_assignments" from public, anon, authenticated;
create table core."resource_bookings" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "session_id" uuid,
  "event_id" uuid,
  "resource_kind" text not null,
  "resource_id" uuid not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."resource_bookings" enable row level security;
revoke all on core."resource_bookings" from public, anon, authenticated;
create table core."lesson_requests" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "format" text not null,
  "requested_start" timestamptz not null,
  "duration_minutes" bigint not null,
  "preferred_instructor_id" uuid,
  "state" text not null,
  "reservation_id" uuid,
  "expires_at" timestamptz,
  "discipline_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."lesson_requests" enable row level security;
revoke all on core."lesson_requests" from public, anon, authenticated;
create table core."request_alternatives" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "request_id" uuid not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "instructor_id" uuid,
  "state" text not null,
  "selected_at" timestamptz,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."request_alternatives" enable row level security;
revoke all on core."request_alternatives" from public, anon, authenticated;
create table core."reservations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "session_id" uuid not null,
  "person_id" uuid not null,
  "mode" text not null,
  "state" text not null,
  "policy_version_id" uuid not null,
  "source_sale_id" uuid,
  "cancellation_reason" text,
  "previous_id" uuid,
  "trial_offer_id" uuid,
  "negative_basis_minor" bigint,
  "negative_basis_currency" text,
  "negative_basis_policy_id" uuid,
  "eligibility_snapshot" jsonb,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."reservations" enable row level security;
revoke all on core."reservations" from public, anon, authenticated;
create table core."waitlist_entries" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "session_id" uuid not null,
  "person_id" uuid not null,
  "joined_at" timestamptz not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."waitlist_entries" enable row level security;
revoke all on core."waitlist_entries" from public, anon, authenticated;
create table core."seat_offers" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "entry_id" uuid not null,
  "session_id" uuid not null,
  "person_id" uuid not null,
  "expires_at" timestamptz not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."seat_offers" enable row level security;
revoke all on core."seat_offers" from public, anon, authenticated;
create table core."attendance_entries" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "reservation_id" uuid not null,
  "result" text not null,
  "blocked_reason" text,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."attendance_entries" enable row level security;
revoke all on core."attendance_entries" from public, anon, authenticated;
create table core."attendance_closures" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "session_id" uuid not null,
  "revision" bigint not null,
  "closed_by" uuid not null,
  "closed_at" timestamptz not null,
  "corrects_id" uuid,
  "reason" text,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."attendance_closures" enable row level security;
revoke all on core."attendance_closures" from public, anon, authenticated;
create table core."products" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "name" text not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."products" enable row level security;
revoke all on core."products" from public, anon, authenticated;
create table core."product_versions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "product_id" uuid not null,
  "kind" text not null,
  "booking_mode" text not null,
  "credits" bigint,
  "price_minor" bigint not null,
  "currency" text not null,
  "refund_method" text not null,
  "freeze_terms" jsonb not null,
  "quota" jsonb,
  "effective_at" timestamptz not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."product_versions" enable row level security;
revoke all on core."product_versions" from public, anon, authenticated;
create table core."product_scopes" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "product_version_id" uuid not null,
  "scope_kind" text not null,
  "center_id" uuid,
  "discipline_id" uuid,
  "class_id" uuid,
  "event_id" uuid,
  "usage_targets" text[] not null,
  unique (org_id,id)
);
alter table core."product_scopes" enable row level security;
revoke all on core."product_scopes" from public, anon, authenticated;
create table core."sales" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "product_version_id" uuid not null,
  "net_minor" bigint not null,
  "currency" text not null,
  "valid_from" timestamptz not null,
  "valid_until" timestamptz,
  "state" text not null,
  "previous_sale_id" uuid,
  "terms_hash" text not null,
  "start_date" date not null,
  "end_date" date not null,
  "timezone" text not null,
  "paid_days" bigint not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."sales" enable row level security;
revoke all on core."sales" from public, anon, authenticated;
create table core."entitlement_accounts" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "sale_id" uuid not null,
  "person_id" uuid not null,
  "state" text not null,
  "balance_version" bigint not null,
  unique (org_id,id)
);
alter table core."entitlement_accounts" enable row level security;
revoke all on core."entitlement_accounts" from public, anon, authenticated;
create table core."entitlement_movements" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "sale_id" uuid,
  "person_id" uuid not null,
  "reservation_id" uuid,
  "event_registration_id" uuid,
  "kind" text not null,
  "quantity" bigint not null,
  "previous_id" uuid,
  "operation_id" uuid not null,
  unique (org_id,id)
);
alter table core."entitlement_movements" enable row level security;
revoke all on core."entitlement_movements" from public, anon, authenticated;
create table core."entitlement_allocations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "sale_id" uuid not null,
  "reservation_id" uuid,
  "event_registration_id" uuid,
  "quantity" bigint not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."entitlement_allocations" enable row level security;
revoke all on core."entitlement_allocations" from public, anon, authenticated;
create table core."credit_deficits" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "person_id" uuid not null,
  "reservation_id" uuid not null,
  "quantity" bigint not null,
  "state" text not null,
  "settled_sale_id" uuid,
  "center_id" uuid not null,
  "discipline_id" uuid not null,
  "session_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."credit_deficits" enable row level security;
revoke all on core."credit_deficits" from public, anon, authenticated;
create table core."quota_buckets" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "sale_id" uuid not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "limit_count" bigint not null,
  "reserved_count" bigint not null,
  "consumed_count" bigint not null,
  unique (org_id,id)
);
alter table core."quota_buckets" enable row level security;
revoke all on core."quota_buckets" from public, anon, authenticated;
create table core."freezes" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "sale_id" uuid not null,
  "starts_at" timestamptz not null,
  "planned_end" timestamptz not null,
  "actual_end" timestamptz,
  "state" text not null,
  "extension_until" timestamptz,
  "preview_id" uuid not null,
  unique (org_id,id)
);
alter table core."freezes" enable row level security;
revoke all on core."freezes" from public, anon, authenticated;
create table core."negative_limit_overrides" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "person_id" uuid not null,
  "limit_count" bigint not null,
  "reason" text not null,
  "center_id" uuid not null,
  "discipline_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."negative_limit_overrides" enable row level security;
revoke all on core."negative_limit_overrides" from public, anon, authenticated;
create table core."debts" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "sale_id" uuid,
  "event_registration_id" uuid,
  "amount_minor" bigint not null,
  "currency" text not null,
  "due_at" timestamptz not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."debts" enable row level security;
revoke all on core."debts" from public, anon, authenticated;
create table core."cash_movements" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "kind" text not null,
  "amount_minor" bigint not null,
  "currency" text not null,
  "occurred_at" timestamptz not null,
  "previous_id" uuid,
  "reason" text,
  "operation_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."cash_movements" enable row level security;
revoke all on core."cash_movements" from public, anon, authenticated;
create table core."debt_allocations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "debt_id" uuid not null,
  "cash_movement_id" uuid,
  "credit_movement_id" uuid,
  "amount_minor" bigint not null,
  "previous_id" uuid,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."debt_allocations" enable row level security;
revoke all on core."debt_allocations" from public, anon, authenticated;
create table core."student_credit_movements" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "kind" text not null,
  "amount_minor" bigint not null,
  "currency" text not null,
  "source_cash_id" uuid,
  "source_sale_id" uuid,
  "previous_id" uuid,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."student_credit_movements" enable row level security;
revoke all on core."student_credit_movements" from public, anon, authenticated;
create table core."debt_adjustments" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "debt_id" uuid not null,
  "amount_minor" bigint not null,
  "direction" text not null,
  "previous_id" uuid,
  "reason" text not null,
  "operation_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."debt_adjustments" enable row level security;
revoke all on core."debt_adjustments" from public, anon, authenticated;
create table core."instructor_agreements" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "format" text not null,
  "valid_from" timestamptz not null,
  "valid_until" timestamptz,
  "model" text not null,
  "terms" jsonb not null,
  "state" text not null,
  "discipline_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."instructor_agreements" enable row level security;
revoke all on core."instructor_agreements" from public, anon, authenticated;
create table core."earnings" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "session_id" uuid,
  "event_assignment_id" uuid,
  "agreement_id" uuid,
  "amount_minor" bigint not null,
  "currency" text not null,
  "basis" jsonb not null,
  "previous_id" uuid,
  "operation_id" uuid not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."earnings" enable row level security;
revoke all on core."earnings" from public, anon, authenticated;
create table core."instructor_payments" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "amount_minor" bigint not null,
  "currency" text not null,
  "occurred_at" timestamptz not null,
  "reason" text,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."instructor_payments" enable row level security;
revoke all on core."instructor_payments" from public, anon, authenticated;
create table core."earning_allocations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "payment_id" uuid not null,
  "earning_id" uuid not null,
  "amount_minor" bigint not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."earning_allocations" enable row level security;
revoke all on core."earning_allocations" from public, anon, authenticated;
create table core."leads" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "source" text not null,
  "interest" text not null,
  "assigned_person_id" uuid,
  "state" text not null,
  "last_meaningful_contact_at" timestamptz,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."leads" enable row level security;
revoke all on core."leads" from public, anon, authenticated;
create table core."crm_activities" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "lead_id" uuid not null,
  "kind" text not null,
  "due_at" timestamptz,
  "completed_at" timestamptz,
  "outcome" text,
  "note" text,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."crm_activities" enable row level security;
revoke all on core."crm_activities" from public, anon, authenticated;
create table core."trial_offers" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "lead_id" uuid not null,
  "product_version_id" uuid not null,
  "session_id" uuid,
  "state" text not null,
  "expires_at" timestamptz not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."trial_offers" enable row level security;
revoke all on core."trial_offers" from public, anon, authenticated;
create table core."trial_usages" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "person_id" uuid not null,
  "offer_id" uuid not null,
  "session_id" uuid not null,
  "used_at" timestamptz,
  unique (org_id,id)
);
alter table core."trial_usages" enable row level security;
revoke all on core."trial_usages" from public, anon, authenticated;
create table core."segments" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "name" text not null,
  "definition" jsonb not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."segments" enable row level security;
revoke all on core."segments" from public, anon, authenticated;
create table core."automations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "name" text not null,
  "trigger" jsonb not null,
  "segment_id" uuid,
  "action" jsonb not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."automations" enable row level security;
revoke all on core."automations" from public, anon, authenticated;
create table core."automation_runs" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "automation_id" uuid not null,
  "person_id" uuid not null,
  "event_key" text not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."automation_runs" enable row level security;
revoke all on core."automation_runs" from public, anon, authenticated;
create table core."notification_preferences" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "person_id" uuid not null,
  "channel" text not null,
  "purpose" text not null,
  "enabled" boolean not null,
  unique (org_id,id)
);
alter table core."notification_preferences" enable row level security;
revoke all on core."notification_preferences" from public, anon, authenticated;
create table core."notifications" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "recipient_person_id" uuid not null,
  "kind" text not null,
  "subject_id" uuid not null,
  "payload" jsonb not null,
  "read_at" timestamptz,
  unique (org_id,id)
);
alter table core."notifications" enable row level security;
revoke all on core."notifications" from public, anon, authenticated;
create table core."outbox_jobs" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "notification_id" uuid,
  "kind" text not null,
  "dedupe_key" text not null,
  "state" text not null,
  "attempts" bigint not null,
  "next_attempt_at" timestamptz,
  "lease_until" timestamptz,
  "provider_reference" text,
  unique (org_id,id)
);
alter table core."outbox_jobs" enable row level security;
revoke all on core."outbox_jobs" from public, anon, authenticated;
create table core."report_jobs" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "requester_account_id" uuid not null,
  "report_kind" text not null,
  "filters" jsonb not null,
  "state" text not null,
  "file_id" uuid,
  "expires_at" timestamptz,
  unique (org_id,id)
);
alter table core."report_jobs" enable row level security;
revoke all on core."report_jobs" from public, anon, authenticated;
create table core."saas_plan_versions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "name" text not null,
  "effective_at" timestamptz not null,
  "price_minor" bigint not null,
  "currency" text not null,
  "period" text not null,
  "limits" jsonb not null,
  "features" text[] not null
);
alter table core."saas_plan_versions" enable row level security;
revoke all on core."saas_plan_versions" from public, anon, authenticated;
create table core."saas_subscriptions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "plan_version_id" uuid not null,
  "starts_at" timestamptz not null,
  "period_end" timestamptz not null,
  "grace_until" timestamptz,
  "state" text not null,
  "cancel_at_period_end" boolean not null,
  unique (org_id,id)
);
alter table core."saas_subscriptions" enable row level security;
revoke all on core."saas_subscriptions" from public, anon, authenticated;
create table core."saas_change_requests" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "target_plan_id" uuid not null,
  "kept_center_id" uuid,
  "effective_at" timestamptz not null,
  "quote_id" uuid,
  "state" text not null,
  unique (org_id,id)
);
alter table core."saas_change_requests" enable row level security;
revoke all on core."saas_change_requests" from public, anon, authenticated;
create table core."saas_quotes" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "from_plan_id" uuid not null,
  "to_plan_id" uuid not null,
  "amount_minor" bigint not null,
  "currency" text not null,
  "expires_at" timestamptz not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."saas_quotes" enable row level security;
revoke all on core."saas_quotes" from public, anon, authenticated;
create table core."saas_payment_verifications" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "amount_minor" bigint not null,
  "currency" text not null,
  "occurred_at" timestamptz not null,
  "verified_at" timestamptz,
  "verified_by" uuid,
  "state" text not null,
  "reference" text not null,
  unique (org_id,id)
);
alter table core."saas_payment_verifications" enable row level security;
revoke all on core."saas_payment_verifications" from public, anon, authenticated;
create table core."events" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "name" text not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "timezone" text not null,
  "venue" jsonb not null,
  "nominal" bigint not null,
  "maximum" bigint not null,
  "state" text not null,
  "terms" jsonb not null,
  "published" boolean not null,
  "attendance_state" text not null,
  "attendance_revision" bigint not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."events" enable row level security;
revoke all on core."events" from public, anon, authenticated;
create table core."event_assignments" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "event_id" uuid not null,
  "person_id" uuid not null,
  "duty" text not null,
  "fee_minor" bigint not null,
  "currency" text not null,
  "verified_at" timestamptz,
  "verified_by" uuid,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."event_assignments" enable row level security;
revoke all on core."event_assignments" from public, anon, authenticated;
create table core."event_registrations" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "event_id" uuid not null,
  "person_id" uuid not null,
  "amount_minor" bigint not null,
  "currency" text not null,
  "terms_hash" text not null,
  "state" text not null,
  "attendance_result" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."event_registrations" enable row level security;
revoke all on core."event_registrations" from public, anon, authenticated;
create table core."documents" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "name" text not null,
  "scope_center_id" uuid,
  "state" text not null,
  unique (org_id,id)
);
alter table core."documents" enable row level security;
revoke all on core."documents" from public, anon, authenticated;
create table core."document_versions" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "document_id" uuid not null,
  "file_id" uuid not null,
  "version_label" text not null,
  "content_hash" text not null,
  "effective_at" timestamptz not null,
  unique (org_id,id)
);
alter table core."document_versions" enable row level security;
revoke all on core."document_versions" from public, anon, authenticated;
create table core."document_requirements" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "document_version_id" uuid not null,
  "scope" jsonb not null,
  "operation" text not null,
  "renewed_acceptance" boolean not null,
  unique (org_id,id)
);
alter table core."document_requirements" enable row level security;
revoke all on core."document_requirements" from public, anon, authenticated;
create table core."document_acceptances" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "person_id" uuid not null,
  "account_id" uuid,
  "document_version_id" uuid not null,
  "accepted_at" timestamptz not null,
  "operation_id" uuid not null,
  "context" jsonb not null,
  unique (org_id,id)
);
alter table core."document_acceptances" enable row level security;
revoke all on core."document_acceptances" from public, anon, authenticated;
create table core."files" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid,
  "owner_person_id" uuid,
  "object_key" text not null,
  "mime" text not null,
  "size_bytes" bigint not null,
  "checksum" text,
  "purpose" text not null,
  "state" text not null,
  "expires_at" timestamptz,
  unique (org_id,id)
);
alter table core."files" enable row level security;
revoke all on core."files" from public, anon, authenticated;
create table core."previews" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "actor_account_id" uuid not null,
  "operation" text not null,
  "scope_hash" text not null,
  "dependencies" jsonb not null,
  "result" jsonb not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."previews" enable row level security;
revoke all on core."previews" from public, anon, authenticated;
create table core."operation_receipts" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid,
  "actor_account_id" uuid,
  "actor_fingerprint" text not null,
  "operation" text not null,
  "key_hash" text not null,
  "payload_hash" text not null,
  "state" text not null,
  "result" jsonb,
  "result_expires_at" timestamptz not null,
  "business_reference" uuid,
  unique (org_id,id)
);
alter table core."operation_receipts" enable row level security;
revoke all on core."operation_receipts" from public, anon, authenticated;
create table core."audit_events" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "actor_account_id" uuid,
  "actor_person_id" uuid,
  "action" text not null,
  "subject_table" text not null,
  "subject_id" uuid not null,
  "reason" text,
  "diff" jsonb,
  "operation_id" uuid,
  unique (org_id,id)
);
alter table core."audit_events" enable row level security;
revoke all on core."audit_events" from public, anon, authenticated;
create table core."import_jobs" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "requester_account_id" uuid not null,
  "file_id" uuid not null,
  "mapping" jsonb not null,
  "state" text not null,
  "file_checksum" text not null,
  "preview_id" uuid,
  "source_namespace" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."import_jobs" enable row level security;
revoke all on core."import_jobs" from public, anon, authenticated;
create table core."import_rows" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "job_id" uuid not null,
  "row_number" bigint not null,
  "source_key" text not null,
  "payload" jsonb not null,
  "state" text not null,
  "created_references" uuid[] not null,
  "error_code" text,
  "source_namespace" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."import_rows" enable row level security;
revoke all on core."import_rows" from public, anon, authenticated;
create table core."publications" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "slug" text not null,
  "session_id" uuid,
  "event_id" uuid,
  "published" boolean not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."publications" enable row level security;
revoke all on core."publications" from public, anon, authenticated;
create table core."public_applications" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "publication_id" uuid not null,
  "target_contact" text not null,
  "target_hash" text not null,
  "state" text not null,
  "bot_verified_at" timestamptz not null,
  "request_reference" uuid,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."public_applications" enable row level security;
revoke all on core."public_applications" from public, anon, authenticated;
create table core."privacy_requests" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid,
  "kind" text not null,
  "requester_account_id" uuid,
  "scope" jsonb not null,
  "state" text not null,
  "requested_at" timestamptz not null,
  "completed_at" timestamptz,
  unique (org_id,id)
);
alter table core."privacy_requests" enable row level security;
revoke all on core."privacy_requests" from public, anon, authenticated;
create table core."retention_holds" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "subject_table" text not null,
  "subject_id" uuid not null,
  "reason" text not null,
  "authority_reference" text not null,
  "review_at" timestamptz not null,
  unique (org_id,id)
);
alter table core."retention_holds" enable row level security;
revoke all on core."retention_holds" from public, anon, authenticated;
create table core."deletion_receipts" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid,
  "request_id" uuid not null,
  "system" text not null,
  "scope_hash" text not null,
  "completed_at" timestamptz,
  "state" text not null,
  unique (org_id,id)
);
alter table core."deletion_receipts" enable row level security;
revoke all on core."deletion_receipts" from public, anon, authenticated;
create table core."class_assignments" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "class_id" uuid not null,
  "person_id" uuid not null,
  "duty" text not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."class_assignments" enable row level security;
revoke all on core."class_assignments" from public, anon, authenticated;
create table core."rate_limit_windows" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1,
  "key_hash" text not null,
  "dimension" text not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "attempt_count" bigint not null,
  "accepted_count" bigint not null
);
alter table core."rate_limit_windows" enable row level security;
revoke all on core."rate_limit_windows" from public, anon, authenticated;
create table core."disciplines" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1 not null,
  "org_id" uuid not null,
  "name" text not null,
  "state" text not null,
  unique (org_id,id)
);
alter table core."disciplines" enable row level security;
revoke all on core."disciplines" from public, anon, authenticated;
create table core."center_disciplines" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1 not null,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "discipline_id" uuid not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."center_disciplines" enable row level security;
revoke all on core."center_disciplines" from public, anon, authenticated;
create table core."person_disciplines" (
  "id" uuid default private.new_uuid_v7() primary key,
  "created_at" timestamptz default transaction_timestamp() not null,
  "version" bigint default 1 not null,
  "org_id" uuid not null,
  "center_id" uuid not null,
  "person_id" uuid not null,
  "discipline_id" uuid not null,
  "kind" text not null,
  "state" text not null,
  unique (org_id,id),
  unique (org_id,center_id,id)
);
alter table core."person_disciplines" enable row level security;
revoke all on core."person_disciplines" from public, anon, authenticated;
alter table core."organizations" add constraint "fk_organizations_owner_person_id" foreign key ("org_id","owner_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_0_organizations" on core."organizations" ("org_id","owner_person_id");
alter table core."centers" add constraint "fk_centers_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_1_centers" on core."centers" ("org_id");
alter table core."rooms" add constraint "fk_rooms_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_2_rooms" on core."rooms" ("org_id");
alter table core."rooms" add constraint "fk_rooms_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_3_rooms" on core."rooms" ("org_id","center_id");
alter table core."room_capacities" add constraint "fk_room_capacities_room_id" foreign key ("org_id","center_id","room_id") references core."rooms" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_4_room_capacities" on core."room_capacities" ("org_id","center_id","room_id");
alter table core."room_capacities" add constraint "fk_room_capacities_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_5_room_capacities" on core."room_capacities" ("org_id","discipline_id");
alter table core."room_capacities" add constraint "fk_room_capacities_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_6_room_capacities" on core."room_capacities" ("org_id");
alter table core."room_capacities" add constraint "fk_room_capacities_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_7_room_capacities" on core."room_capacities" ("org_id","center_id");
alter table core."availability_rules" add constraint "fk_availability_rules_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_8_availability_rules" on core."availability_rules" ("org_id");
alter table core."availability_rules" add constraint "fk_availability_rules_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_9_availability_rules" on core."availability_rules" ("org_id","center_id");
alter table core."availability_exceptions" add constraint "fk_availability_exceptions_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_10_availability_exceptions" on core."availability_exceptions" ("org_id");
alter table core."availability_exceptions" add constraint "fk_availability_exceptions_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_11_availability_exceptions" on core."availability_exceptions" ("org_id","center_id");
alter table core."policy_versions" add constraint "fk_policy_versions_scope_center_id" foreign key ("org_id","scope_center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_12_policy_versions" on core."policy_versions" ("org_id","scope_center_id");
alter table core."policy_versions" add constraint "fk_policy_versions_previous_id" foreign key ("org_id","previous_id") references core."policy_versions" ("org_id","id") deferrable initially deferred;
create index "ix_13_policy_versions" on core."policy_versions" ("org_id","previous_id");
alter table core."policy_versions" add constraint "fk_policy_versions_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_14_policy_versions" on core."policy_versions" ("org_id");
alter table core."account_links" add constraint "fk_account_links_account_id" foreign key ("account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_15_account_links" on core."account_links" ("account_id");
alter table core."account_links" add constraint "fk_account_links_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_16_account_links" on core."account_links" ("org_id","person_id");
alter table core."account_links" add constraint "fk_account_links_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_17_account_links" on core."account_links" ("org_id");
alter table core."role_assignments" add constraint "fk_role_assignments_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_18_role_assignments" on core."role_assignments" ("org_id","person_id");
alter table core."role_assignments" add constraint "fk_role_assignments_scope_center_id" foreign key ("org_id","scope_center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_19_role_assignments" on core."role_assignments" ("org_id","scope_center_id");
alter table core."role_assignments" add constraint "fk_role_assignments_account_link_id" foreign key ("org_id","account_link_id") references core."account_links" ("org_id","id") deferrable initially deferred;
create index "ix_20_role_assignments" on core."role_assignments" ("org_id","account_link_id");
alter table core."role_assignments" add constraint "fk_role_assignments_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_21_role_assignments" on core."role_assignments" ("org_id");
alter table core."permission_overrides" add constraint "fk_permission_overrides_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_22_permission_overrides" on core."permission_overrides" ("org_id","person_id");
alter table core."permission_overrides" add constraint "fk_permission_overrides_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_23_permission_overrides" on core."permission_overrides" ("org_id");
alter table core."permission_overrides" add constraint "fk_permission_overrides_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_24_permission_overrides" on core."permission_overrides" ("org_id","center_id");
alter table core."invitations" add constraint "fk_invitations_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_25_invitations" on core."invitations" ("org_id","center_id");
alter table core."invitations" add constraint "fk_invitations_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_26_invitations" on core."invitations" ("org_id","person_id");
alter table core."invitations" add constraint "fk_invitations_inviter_account_id" foreign key ("inviter_account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_27_invitations" on core."invitations" ("inviter_account_id");
alter table core."invitations" add constraint "fk_invitations_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_28_invitations" on core."invitations" ("org_id");
alter table core."people" add constraint "fk_people_merged_into_id" foreign key ("org_id","merged_into_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_29_people" on core."people" ("org_id","merged_into_id");
alter table core."people" add constraint "fk_people_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_30_people" on core."people" ("org_id");
alter table core."person_contacts" add constraint "fk_person_contacts_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_31_person_contacts" on core."person_contacts" ("org_id","person_id");
alter table core."person_contacts" add constraint "fk_person_contacts_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_32_person_contacts" on core."person_contacts" ("org_id");
alter table core."center_relationships" add constraint "fk_center_relationships_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_33_center_relationships" on core."center_relationships" ("org_id","person_id");
alter table core."center_relationships" add constraint "fk_center_relationships_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_34_center_relationships" on core."center_relationships" ("org_id");
alter table core."center_relationships" add constraint "fk_center_relationships_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_35_center_relationships" on core."center_relationships" ("org_id","center_id");
alter table core."merge_requests" add constraint "fk_merge_requests_source_person_id" foreign key ("org_id","source_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_36_merge_requests" on core."merge_requests" ("org_id","source_person_id");
alter table core."merge_requests" add constraint "fk_merge_requests_target_person_id" foreign key ("org_id","target_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_37_merge_requests" on core."merge_requests" ("org_id","target_person_id");
alter table core."merge_requests" add constraint "fk_merge_requests_preview_id" foreign key ("org_id","preview_id") references core."previews" ("org_id","id") deferrable initially deferred;
create index "ix_38_merge_requests" on core."merge_requests" ("org_id","preview_id");
alter table core."merge_requests" add constraint "fk_merge_requests_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_39_merge_requests" on core."merge_requests" ("org_id");
alter table core."merge_approvals" add constraint "fk_merge_approvals_merge_request_id" foreign key ("org_id","merge_request_id") references core."merge_requests" ("org_id","id") deferrable initially deferred;
create index "ix_40_merge_approvals" on core."merge_approvals" ("org_id","merge_request_id");
alter table core."merge_approvals" add constraint "fk_merge_approvals_approver_person_id" foreign key ("org_id","approver_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_41_merge_approvals" on core."merge_approvals" ("org_id","approver_person_id");
alter table core."merge_approvals" add constraint "fk_merge_approvals_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_42_merge_approvals" on core."merge_approvals" ("org_id");
alter table core."merge_approvals" add constraint "fk_merge_approvals_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_43_merge_approvals" on core."merge_approvals" ("org_id","center_id");
alter table core."classes" add constraint "fk_classes_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_44_classes" on core."classes" ("org_id","discipline_id");
alter table core."classes" add constraint "fk_classes_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_45_classes" on core."classes" ("org_id");
alter table core."classes" add constraint "fk_classes_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_46_classes" on core."classes" ("org_id","center_id");
alter table core."program_versions" add constraint "fk_program_versions_class_id" foreign key ("org_id","center_id","class_id") references core."classes" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_47_program_versions" on core."program_versions" ("org_id","center_id","class_id");
alter table core."program_versions" add constraint "fk_program_versions_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_48_program_versions" on core."program_versions" ("org_id");
alter table core."program_versions" add constraint "fk_program_versions_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_49_program_versions" on core."program_versions" ("org_id","center_id");
alter table core."sessions" add constraint "fk_sessions_class_id" foreign key ("org_id","center_id","class_id") references core."classes" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_50_sessions" on core."sessions" ("org_id","center_id","class_id");
alter table core."sessions" add constraint "fk_sessions_program_id" foreign key ("org_id","center_id","program_id") references core."program_versions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_51_sessions" on core."sessions" ("org_id","center_id","program_id");
alter table core."sessions" add constraint "fk_sessions_replaces_id" foreign key ("org_id","center_id","replaces_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_52_sessions" on core."sessions" ("org_id","center_id","replaces_id");
alter table core."sessions" add constraint "fk_sessions_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_53_sessions" on core."sessions" ("org_id","discipline_id");
alter table core."sessions" add constraint "fk_sessions_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_54_sessions" on core."sessions" ("org_id");
alter table core."sessions" add constraint "fk_sessions_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_55_sessions" on core."sessions" ("org_id","center_id");
alter table core."session_assignments" add constraint "fk_session_assignments_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_56_session_assignments" on core."session_assignments" ("org_id","center_id","session_id");
alter table core."session_assignments" add constraint "fk_session_assignments_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_57_session_assignments" on core."session_assignments" ("org_id","person_id");
alter table core."session_assignments" add constraint "fk_session_assignments_agreement_id" foreign key ("org_id","center_id","agreement_id") references core."instructor_agreements" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_58_session_assignments" on core."session_assignments" ("org_id","center_id","agreement_id");
alter table core."session_assignments" add constraint "fk_session_assignments_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_59_session_assignments" on core."session_assignments" ("org_id");
alter table core."session_assignments" add constraint "fk_session_assignments_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_60_session_assignments" on core."session_assignments" ("org_id","center_id");
alter table core."resource_bookings" add constraint "fk_resource_bookings_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_61_resource_bookings" on core."resource_bookings" ("org_id","center_id","session_id");
alter table core."resource_bookings" add constraint "fk_resource_bookings_event_id" foreign key ("org_id","center_id","event_id") references core."events" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_62_resource_bookings" on core."resource_bookings" ("org_id","center_id","event_id");
alter table core."resource_bookings" add constraint "fk_resource_bookings_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_63_resource_bookings" on core."resource_bookings" ("org_id");
alter table core."resource_bookings" add constraint "fk_resource_bookings_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_64_resource_bookings" on core."resource_bookings" ("org_id","center_id");
alter table core."lesson_requests" add constraint "fk_lesson_requests_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_65_lesson_requests" on core."lesson_requests" ("org_id","person_id");
alter table core."lesson_requests" add constraint "fk_lesson_requests_preferred_instructor_id" foreign key ("org_id","preferred_instructor_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_66_lesson_requests" on core."lesson_requests" ("org_id","preferred_instructor_id");
alter table core."lesson_requests" add constraint "fk_lesson_requests_reservation_id" foreign key ("org_id","center_id","reservation_id") references core."reservations" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_67_lesson_requests" on core."lesson_requests" ("org_id","center_id","reservation_id");
alter table core."lesson_requests" add constraint "fk_lesson_requests_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_68_lesson_requests" on core."lesson_requests" ("org_id","discipline_id");
alter table core."lesson_requests" add constraint "fk_lesson_requests_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_69_lesson_requests" on core."lesson_requests" ("org_id");
alter table core."lesson_requests" add constraint "fk_lesson_requests_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_70_lesson_requests" on core."lesson_requests" ("org_id","center_id");
alter table core."request_alternatives" add constraint "fk_request_alternatives_request_id" foreign key ("org_id","center_id","request_id") references core."lesson_requests" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_71_request_alternatives" on core."request_alternatives" ("org_id","center_id","request_id");
alter table core."request_alternatives" add constraint "fk_request_alternatives_instructor_id" foreign key ("org_id","instructor_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_72_request_alternatives" on core."request_alternatives" ("org_id","instructor_id");
alter table core."request_alternatives" add constraint "fk_request_alternatives_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_73_request_alternatives" on core."request_alternatives" ("org_id");
alter table core."request_alternatives" add constraint "fk_request_alternatives_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_74_request_alternatives" on core."request_alternatives" ("org_id","center_id");
alter table core."reservations" add constraint "fk_reservations_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_75_reservations" on core."reservations" ("org_id","center_id","session_id");
alter table core."reservations" add constraint "fk_reservations_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_76_reservations" on core."reservations" ("org_id","person_id");
alter table core."reservations" add constraint "fk_reservations_policy_version_id" foreign key ("org_id","policy_version_id") references core."policy_versions" ("org_id","id") deferrable initially deferred;
create index "ix_77_reservations" on core."reservations" ("org_id","policy_version_id");
alter table core."reservations" add constraint "fk_reservations_source_sale_id" foreign key ("org_id","source_sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_78_reservations" on core."reservations" ("org_id","source_sale_id");
alter table core."reservations" add constraint "fk_reservations_previous_id" foreign key ("org_id","center_id","previous_id") references core."reservations" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_79_reservations" on core."reservations" ("org_id","center_id","previous_id");
alter table core."reservations" add constraint "fk_reservations_trial_offer_id" foreign key ("org_id","center_id","trial_offer_id") references core."trial_offers" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_80_reservations" on core."reservations" ("org_id","center_id","trial_offer_id");
alter table core."reservations" add constraint "fk_reservations_negative_basis_policy_id" foreign key ("org_id","negative_basis_policy_id") references core."policy_versions" ("org_id","id") deferrable initially deferred;
create index "ix_81_reservations" on core."reservations" ("org_id","negative_basis_policy_id");
alter table core."reservations" add constraint "fk_reservations_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_82_reservations" on core."reservations" ("org_id");
alter table core."reservations" add constraint "fk_reservations_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_83_reservations" on core."reservations" ("org_id","center_id");
alter table core."waitlist_entries" add constraint "fk_waitlist_entries_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_84_waitlist_entries" on core."waitlist_entries" ("org_id","center_id","session_id");
alter table core."waitlist_entries" add constraint "fk_waitlist_entries_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_85_waitlist_entries" on core."waitlist_entries" ("org_id","person_id");
alter table core."waitlist_entries" add constraint "fk_waitlist_entries_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_86_waitlist_entries" on core."waitlist_entries" ("org_id");
alter table core."waitlist_entries" add constraint "fk_waitlist_entries_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_87_waitlist_entries" on core."waitlist_entries" ("org_id","center_id");
alter table core."seat_offers" add constraint "fk_seat_offers_entry_id" foreign key ("org_id","center_id","entry_id") references core."waitlist_entries" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_88_seat_offers" on core."seat_offers" ("org_id","center_id","entry_id");
alter table core."seat_offers" add constraint "fk_seat_offers_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_89_seat_offers" on core."seat_offers" ("org_id","center_id","session_id");
alter table core."seat_offers" add constraint "fk_seat_offers_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_90_seat_offers" on core."seat_offers" ("org_id","person_id");
alter table core."seat_offers" add constraint "fk_seat_offers_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_91_seat_offers" on core."seat_offers" ("org_id");
alter table core."seat_offers" add constraint "fk_seat_offers_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_92_seat_offers" on core."seat_offers" ("org_id","center_id");
alter table core."attendance_entries" add constraint "fk_attendance_entries_reservation_id" foreign key ("org_id","center_id","reservation_id") references core."reservations" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_93_attendance_entries" on core."attendance_entries" ("org_id","center_id","reservation_id");
alter table core."attendance_entries" add constraint "fk_attendance_entries_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_94_attendance_entries" on core."attendance_entries" ("org_id");
alter table core."attendance_entries" add constraint "fk_attendance_entries_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_95_attendance_entries" on core."attendance_entries" ("org_id","center_id");
alter table core."attendance_closures" add constraint "fk_attendance_closures_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_96_attendance_closures" on core."attendance_closures" ("org_id","center_id","session_id");
alter table core."attendance_closures" add constraint "fk_attendance_closures_closed_by" foreign key ("org_id","closed_by") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_97_attendance_closures" on core."attendance_closures" ("org_id","closed_by");
alter table core."attendance_closures" add constraint "fk_attendance_closures_corrects_id" foreign key ("org_id","center_id","corrects_id") references core."attendance_closures" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_98_attendance_closures" on core."attendance_closures" ("org_id","center_id","corrects_id");
alter table core."attendance_closures" add constraint "fk_attendance_closures_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_99_attendance_closures" on core."attendance_closures" ("org_id");
alter table core."attendance_closures" add constraint "fk_attendance_closures_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_100_attendance_closures" on core."attendance_closures" ("org_id","center_id");
alter table core."products" add constraint "fk_products_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_101_products" on core."products" ("org_id");
alter table core."products" add constraint "fk_products_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_102_products" on core."products" ("org_id","center_id");
alter table core."product_versions" add constraint "fk_product_versions_product_id" foreign key ("org_id","center_id","product_id") references core."products" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_103_product_versions" on core."product_versions" ("org_id","center_id","product_id");
alter table core."product_versions" add constraint "fk_product_versions_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_104_product_versions" on core."product_versions" ("org_id");
alter table core."product_versions" add constraint "fk_product_versions_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_105_product_versions" on core."product_versions" ("org_id","center_id");
alter table core."product_scopes" add constraint "fk_product_scopes_product_version_id" foreign key ("org_id","product_version_id") references core."product_versions" ("org_id","id") deferrable initially deferred;
create index "ix_106_product_scopes" on core."product_scopes" ("org_id","product_version_id");
alter table core."product_scopes" add constraint "fk_product_scopes_class_id" foreign key ("org_id","class_id") references core."classes" ("org_id","id") deferrable initially deferred;
create index "ix_107_product_scopes" on core."product_scopes" ("org_id","class_id");
alter table core."product_scopes" add constraint "fk_product_scopes_event_id" foreign key ("org_id","event_id") references core."events" ("org_id","id") deferrable initially deferred;
create index "ix_108_product_scopes" on core."product_scopes" ("org_id","event_id");
alter table core."product_scopes" add constraint "fk_product_scopes_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_109_product_scopes" on core."product_scopes" ("org_id","center_id");
alter table core."product_scopes" add constraint "fk_product_scopes_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_110_product_scopes" on core."product_scopes" ("org_id","discipline_id");
alter table core."product_scopes" add constraint "fk_product_scopes_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_111_product_scopes" on core."product_scopes" ("org_id");
alter table core."sales" add constraint "fk_sales_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_112_sales" on core."sales" ("org_id","person_id");
alter table core."sales" add constraint "fk_sales_product_version_id" foreign key ("org_id","center_id","product_version_id") references core."product_versions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_113_sales" on core."sales" ("org_id","center_id","product_version_id");
alter table core."sales" add constraint "fk_sales_previous_sale_id" foreign key ("org_id","previous_sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_114_sales" on core."sales" ("org_id","previous_sale_id");
alter table core."sales" add constraint "fk_sales_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_115_sales" on core."sales" ("org_id");
alter table core."sales" add constraint "fk_sales_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_116_sales" on core."sales" ("org_id","center_id");
alter table core."entitlement_accounts" add constraint "fk_entitlement_accounts_sale_id" foreign key ("org_id","sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_117_entitlement_accounts" on core."entitlement_accounts" ("org_id","sale_id");
alter table core."entitlement_accounts" add constraint "fk_entitlement_accounts_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_118_entitlement_accounts" on core."entitlement_accounts" ("org_id","person_id");
alter table core."entitlement_accounts" add constraint "fk_entitlement_accounts_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_119_entitlement_accounts" on core."entitlement_accounts" ("org_id");
alter table core."entitlement_movements" add constraint "fk_entitlement_movements_sale_id" foreign key ("org_id","sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_120_entitlement_movements" on core."entitlement_movements" ("org_id","sale_id");
alter table core."entitlement_movements" add constraint "fk_entitlement_movements_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_121_entitlement_movements" on core."entitlement_movements" ("org_id","person_id");
alter table core."entitlement_movements" add constraint "fk_entitlement_movements_reservation_id" foreign key ("org_id","reservation_id") references core."reservations" ("org_id","id") deferrable initially deferred;
create index "ix_122_entitlement_movements" on core."entitlement_movements" ("org_id","reservation_id");
alter table core."entitlement_movements" add constraint "fk_entitlement_movements_event_registration_id" foreign key ("org_id","event_registration_id") references core."event_registrations" ("org_id","id") deferrable initially deferred;
create index "ix_123_entitlement_movements" on core."entitlement_movements" ("org_id","event_registration_id");
alter table core."entitlement_movements" add constraint "fk_entitlement_movements_previous_id" foreign key ("org_id","previous_id") references core."entitlement_movements" ("org_id","id") deferrable initially deferred;
create index "ix_124_entitlement_movements" on core."entitlement_movements" ("org_id","previous_id");
alter table core."entitlement_movements" add constraint "fk_entitlement_movements_operation_id" foreign key ("org_id","operation_id") references core."operation_receipts" ("org_id","id") deferrable initially deferred;
create index "ix_125_entitlement_movements" on core."entitlement_movements" ("org_id","operation_id");
alter table core."entitlement_movements" add constraint "fk_entitlement_movements_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_126_entitlement_movements" on core."entitlement_movements" ("org_id");
alter table core."entitlement_allocations" add constraint "fk_entitlement_allocations_sale_id" foreign key ("org_id","sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_127_entitlement_allocations" on core."entitlement_allocations" ("org_id","sale_id");
alter table core."entitlement_allocations" add constraint "fk_entitlement_allocations_reservation_id" foreign key ("org_id","reservation_id") references core."reservations" ("org_id","id") deferrable initially deferred;
create index "ix_128_entitlement_allocations" on core."entitlement_allocations" ("org_id","reservation_id");
alter table core."entitlement_allocations" add constraint "fk_entitlement_allocations_event_registration_id" foreign key ("org_id","event_registration_id") references core."event_registrations" ("org_id","id") deferrable initially deferred;
create index "ix_129_entitlement_allocations" on core."entitlement_allocations" ("org_id","event_registration_id");
alter table core."entitlement_allocations" add constraint "fk_entitlement_allocations_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_130_entitlement_allocations" on core."entitlement_allocations" ("org_id");
alter table core."credit_deficits" add constraint "fk_credit_deficits_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_131_credit_deficits" on core."credit_deficits" ("org_id","person_id");
alter table core."credit_deficits" add constraint "fk_credit_deficits_reservation_id" foreign key ("org_id","reservation_id") references core."reservations" ("org_id","id") deferrable initially deferred;
create index "ix_132_credit_deficits" on core."credit_deficits" ("org_id","reservation_id");
alter table core."credit_deficits" add constraint "fk_credit_deficits_settled_sale_id" foreign key ("org_id","settled_sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_133_credit_deficits" on core."credit_deficits" ("org_id","settled_sale_id");
alter table core."credit_deficits" add constraint "fk_credit_deficits_session_id" foreign key ("org_id","session_id") references core."sessions" ("org_id","id") deferrable initially deferred;
create index "ix_134_credit_deficits" on core."credit_deficits" ("org_id","session_id");
alter table core."credit_deficits" add constraint "fk_credit_deficits_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_135_credit_deficits" on core."credit_deficits" ("org_id","discipline_id");
alter table core."credit_deficits" add constraint "fk_credit_deficits_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_136_credit_deficits" on core."credit_deficits" ("org_id","center_id");
alter table core."credit_deficits" add constraint "fk_credit_deficits_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_137_credit_deficits" on core."credit_deficits" ("org_id");
alter table core."quota_buckets" add constraint "fk_quota_buckets_sale_id" foreign key ("org_id","sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_138_quota_buckets" on core."quota_buckets" ("org_id","sale_id");
alter table core."quota_buckets" add constraint "fk_quota_buckets_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_139_quota_buckets" on core."quota_buckets" ("org_id");
alter table core."freezes" add constraint "fk_freezes_sale_id" foreign key ("org_id","sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_140_freezes" on core."freezes" ("org_id","sale_id");
alter table core."freezes" add constraint "fk_freezes_preview_id" foreign key ("org_id","preview_id") references core."previews" ("org_id","id") deferrable initially deferred;
create index "ix_141_freezes" on core."freezes" ("org_id","preview_id");
alter table core."freezes" add constraint "fk_freezes_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_142_freezes" on core."freezes" ("org_id");
alter table core."negative_limit_overrides" add constraint "fk_negative_limit_overrides_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_143_negative_limit_overrides" on core."negative_limit_overrides" ("org_id","person_id");
alter table core."negative_limit_overrides" add constraint "fk_negative_limit_overrides_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_144_negative_limit_overrides" on core."negative_limit_overrides" ("org_id","discipline_id");
alter table core."negative_limit_overrides" add constraint "fk_negative_limit_overrides_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_145_negative_limit_overrides" on core."negative_limit_overrides" ("org_id","center_id");
alter table core."negative_limit_overrides" add constraint "fk_negative_limit_overrides_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_146_negative_limit_overrides" on core."negative_limit_overrides" ("org_id");
alter table core."debts" add constraint "fk_debts_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_147_debts" on core."debts" ("org_id","person_id");
alter table core."debts" add constraint "fk_debts_sale_id" foreign key ("org_id","center_id","sale_id") references core."sales" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_148_debts" on core."debts" ("org_id","center_id","sale_id");
alter table core."debts" add constraint "fk_debts_event_registration_id" foreign key ("org_id","center_id","event_registration_id") references core."event_registrations" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_149_debts" on core."debts" ("org_id","center_id","event_registration_id");
alter table core."debts" add constraint "fk_debts_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_150_debts" on core."debts" ("org_id");
alter table core."debts" add constraint "fk_debts_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_151_debts" on core."debts" ("org_id","center_id");
alter table core."cash_movements" add constraint "fk_cash_movements_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_152_cash_movements" on core."cash_movements" ("org_id","person_id");
alter table core."cash_movements" add constraint "fk_cash_movements_previous_id" foreign key ("org_id","center_id","previous_id") references core."cash_movements" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_153_cash_movements" on core."cash_movements" ("org_id","center_id","previous_id");
alter table core."cash_movements" add constraint "fk_cash_movements_operation_id" foreign key ("org_id","operation_id") references core."operation_receipts" ("org_id","id") deferrable initially deferred;
create index "ix_154_cash_movements" on core."cash_movements" ("org_id","operation_id");
alter table core."cash_movements" add constraint "fk_cash_movements_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_155_cash_movements" on core."cash_movements" ("org_id");
alter table core."cash_movements" add constraint "fk_cash_movements_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_156_cash_movements" on core."cash_movements" ("org_id","center_id");
alter table core."debt_allocations" add constraint "fk_debt_allocations_debt_id" foreign key ("org_id","center_id","debt_id") references core."debts" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_157_debt_allocations" on core."debt_allocations" ("org_id","center_id","debt_id");
alter table core."debt_allocations" add constraint "fk_debt_allocations_cash_movement_id" foreign key ("org_id","center_id","cash_movement_id") references core."cash_movements" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_158_debt_allocations" on core."debt_allocations" ("org_id","center_id","cash_movement_id");
alter table core."debt_allocations" add constraint "fk_debt_allocations_credit_movement_id" foreign key ("org_id","center_id","credit_movement_id") references core."student_credit_movements" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_159_debt_allocations" on core."debt_allocations" ("org_id","center_id","credit_movement_id");
alter table core."debt_allocations" add constraint "fk_debt_allocations_previous_id" foreign key ("org_id","center_id","previous_id") references core."debt_allocations" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_160_debt_allocations" on core."debt_allocations" ("org_id","center_id","previous_id");
alter table core."debt_allocations" add constraint "fk_debt_allocations_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_161_debt_allocations" on core."debt_allocations" ("org_id");
alter table core."debt_allocations" add constraint "fk_debt_allocations_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_162_debt_allocations" on core."debt_allocations" ("org_id","center_id");
alter table core."student_credit_movements" add constraint "fk_student_credit_movements_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_163_student_credit_movements" on core."student_credit_movements" ("org_id","person_id");
alter table core."student_credit_movements" add constraint "fk_student_credit_movements_source_cash_id" foreign key ("org_id","center_id","source_cash_id") references core."cash_movements" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_164_student_credit_movements" on core."student_credit_movements" ("org_id","center_id","source_cash_id");
alter table core."student_credit_movements" add constraint "fk_student_credit_movements_source_sale_id" foreign key ("org_id","source_sale_id") references core."sales" ("org_id","id") deferrable initially deferred;
create index "ix_165_student_credit_movements" on core."student_credit_movements" ("org_id","source_sale_id");
alter table core."student_credit_movements" add constraint "fk_student_credit_movements_previous_id" foreign key ("org_id","center_id","previous_id") references core."student_credit_movements" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_166_student_credit_movements" on core."student_credit_movements" ("org_id","center_id","previous_id");
alter table core."student_credit_movements" add constraint "fk_student_credit_movements_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_167_student_credit_movements" on core."student_credit_movements" ("org_id");
alter table core."student_credit_movements" add constraint "fk_student_credit_movements_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_168_student_credit_movements" on core."student_credit_movements" ("org_id","center_id");
alter table core."debt_adjustments" add constraint "fk_debt_adjustments_debt_id" foreign key ("org_id","center_id","debt_id") references core."debts" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_169_debt_adjustments" on core."debt_adjustments" ("org_id","center_id","debt_id");
alter table core."debt_adjustments" add constraint "fk_debt_adjustments_previous_id" foreign key ("org_id","center_id","previous_id") references core."debt_adjustments" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_170_debt_adjustments" on core."debt_adjustments" ("org_id","center_id","previous_id");
alter table core."debt_adjustments" add constraint "fk_debt_adjustments_operation_id" foreign key ("org_id","operation_id") references core."operation_receipts" ("org_id","id") deferrable initially deferred;
create index "ix_171_debt_adjustments" on core."debt_adjustments" ("org_id","operation_id");
alter table core."debt_adjustments" add constraint "fk_debt_adjustments_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_172_debt_adjustments" on core."debt_adjustments" ("org_id");
alter table core."debt_adjustments" add constraint "fk_debt_adjustments_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_173_debt_adjustments" on core."debt_adjustments" ("org_id","center_id");
alter table core."instructor_agreements" add constraint "fk_instructor_agreements_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_174_instructor_agreements" on core."instructor_agreements" ("org_id","person_id");
alter table core."instructor_agreements" add constraint "fk_instructor_agreements_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_175_instructor_agreements" on core."instructor_agreements" ("org_id","discipline_id");
alter table core."instructor_agreements" add constraint "fk_instructor_agreements_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_176_instructor_agreements" on core."instructor_agreements" ("org_id");
alter table core."instructor_agreements" add constraint "fk_instructor_agreements_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_177_instructor_agreements" on core."instructor_agreements" ("org_id","center_id");
alter table core."earnings" add constraint "fk_earnings_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_178_earnings" on core."earnings" ("org_id","person_id");
alter table core."earnings" add constraint "fk_earnings_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_179_earnings" on core."earnings" ("org_id","center_id","session_id");
alter table core."earnings" add constraint "fk_earnings_event_assignment_id" foreign key ("org_id","center_id","event_assignment_id") references core."event_assignments" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_180_earnings" on core."earnings" ("org_id","center_id","event_assignment_id");
alter table core."earnings" add constraint "fk_earnings_agreement_id" foreign key ("org_id","center_id","agreement_id") references core."instructor_agreements" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_181_earnings" on core."earnings" ("org_id","center_id","agreement_id");
alter table core."earnings" add constraint "fk_earnings_previous_id" foreign key ("org_id","center_id","previous_id") references core."earnings" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_182_earnings" on core."earnings" ("org_id","center_id","previous_id");
alter table core."earnings" add constraint "fk_earnings_operation_id" foreign key ("org_id","operation_id") references core."operation_receipts" ("org_id","id") deferrable initially deferred;
create index "ix_183_earnings" on core."earnings" ("org_id","operation_id");
alter table core."earnings" add constraint "fk_earnings_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_184_earnings" on core."earnings" ("org_id");
alter table core."earnings" add constraint "fk_earnings_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_185_earnings" on core."earnings" ("org_id","center_id");
alter table core."instructor_payments" add constraint "fk_instructor_payments_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_186_instructor_payments" on core."instructor_payments" ("org_id","person_id");
alter table core."instructor_payments" add constraint "fk_instructor_payments_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_187_instructor_payments" on core."instructor_payments" ("org_id");
alter table core."instructor_payments" add constraint "fk_instructor_payments_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_188_instructor_payments" on core."instructor_payments" ("org_id","center_id");
alter table core."earning_allocations" add constraint "fk_earning_allocations_payment_id" foreign key ("org_id","center_id","payment_id") references core."instructor_payments" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_189_earning_allocations" on core."earning_allocations" ("org_id","center_id","payment_id");
alter table core."earning_allocations" add constraint "fk_earning_allocations_earning_id" foreign key ("org_id","center_id","earning_id") references core."earnings" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_190_earning_allocations" on core."earning_allocations" ("org_id","center_id","earning_id");
alter table core."earning_allocations" add constraint "fk_earning_allocations_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_191_earning_allocations" on core."earning_allocations" ("org_id");
alter table core."earning_allocations" add constraint "fk_earning_allocations_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_192_earning_allocations" on core."earning_allocations" ("org_id","center_id");
alter table core."leads" add constraint "fk_leads_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_193_leads" on core."leads" ("org_id","person_id");
alter table core."leads" add constraint "fk_leads_assigned_person_id" foreign key ("org_id","assigned_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_194_leads" on core."leads" ("org_id","assigned_person_id");
alter table core."leads" add constraint "fk_leads_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_195_leads" on core."leads" ("org_id");
alter table core."leads" add constraint "fk_leads_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_196_leads" on core."leads" ("org_id","center_id");
alter table core."crm_activities" add constraint "fk_crm_activities_lead_id" foreign key ("org_id","center_id","lead_id") references core."leads" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_197_crm_activities" on core."crm_activities" ("org_id","center_id","lead_id");
alter table core."crm_activities" add constraint "fk_crm_activities_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_198_crm_activities" on core."crm_activities" ("org_id");
alter table core."crm_activities" add constraint "fk_crm_activities_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_199_crm_activities" on core."crm_activities" ("org_id","center_id");
alter table core."trial_offers" add constraint "fk_trial_offers_lead_id" foreign key ("org_id","center_id","lead_id") references core."leads" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_200_trial_offers" on core."trial_offers" ("org_id","center_id","lead_id");
alter table core."trial_offers" add constraint "fk_trial_offers_product_version_id" foreign key ("org_id","center_id","product_version_id") references core."product_versions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_201_trial_offers" on core."trial_offers" ("org_id","center_id","product_version_id");
alter table core."trial_offers" add constraint "fk_trial_offers_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_202_trial_offers" on core."trial_offers" ("org_id","center_id","session_id");
alter table core."trial_offers" add constraint "fk_trial_offers_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_203_trial_offers" on core."trial_offers" ("org_id");
alter table core."trial_offers" add constraint "fk_trial_offers_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_204_trial_offers" on core."trial_offers" ("org_id","center_id");
alter table core."trial_usages" add constraint "fk_trial_usages_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_205_trial_usages" on core."trial_usages" ("org_id","person_id");
alter table core."trial_usages" add constraint "fk_trial_usages_offer_id" foreign key ("org_id","offer_id") references core."trial_offers" ("org_id","id") deferrable initially deferred;
create index "ix_206_trial_usages" on core."trial_usages" ("org_id","offer_id");
alter table core."trial_usages" add constraint "fk_trial_usages_session_id" foreign key ("org_id","session_id") references core."sessions" ("org_id","id") deferrable initially deferred;
create index "ix_207_trial_usages" on core."trial_usages" ("org_id","session_id");
alter table core."trial_usages" add constraint "fk_trial_usages_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_208_trial_usages" on core."trial_usages" ("org_id");
alter table core."segments" add constraint "fk_segments_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_209_segments" on core."segments" ("org_id");
alter table core."automations" add constraint "fk_automations_segment_id" foreign key ("org_id","segment_id") references core."segments" ("org_id","id") deferrable initially deferred;
create index "ix_210_automations" on core."automations" ("org_id","segment_id");
alter table core."automations" add constraint "fk_automations_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_211_automations" on core."automations" ("org_id");
alter table core."automation_runs" add constraint "fk_automation_runs_automation_id" foreign key ("org_id","automation_id") references core."automations" ("org_id","id") deferrable initially deferred;
create index "ix_212_automation_runs" on core."automation_runs" ("org_id","automation_id");
alter table core."automation_runs" add constraint "fk_automation_runs_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_213_automation_runs" on core."automation_runs" ("org_id","person_id");
alter table core."automation_runs" add constraint "fk_automation_runs_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_214_automation_runs" on core."automation_runs" ("org_id");
alter table core."notification_preferences" add constraint "fk_notification_preferences_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_215_notification_preferences" on core."notification_preferences" ("org_id","person_id");
alter table core."notification_preferences" add constraint "fk_notification_preferences_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_216_notification_preferences" on core."notification_preferences" ("org_id");
alter table core."notifications" add constraint "fk_notifications_recipient_person_id" foreign key ("org_id","recipient_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_217_notifications" on core."notifications" ("org_id","recipient_person_id");
alter table core."notifications" add constraint "fk_notifications_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_218_notifications" on core."notifications" ("org_id");
alter table core."outbox_jobs" add constraint "fk_outbox_jobs_notification_id" foreign key ("org_id","notification_id") references core."notifications" ("org_id","id") deferrable initially deferred;
create index "ix_219_outbox_jobs" on core."outbox_jobs" ("org_id","notification_id");
alter table core."outbox_jobs" add constraint "fk_outbox_jobs_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_220_outbox_jobs" on core."outbox_jobs" ("org_id");
alter table core."report_jobs" add constraint "fk_report_jobs_requester_account_id" foreign key ("requester_account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_221_report_jobs" on core."report_jobs" ("requester_account_id");
alter table core."report_jobs" add constraint "fk_report_jobs_file_id" foreign key ("org_id","file_id") references core."files" ("org_id","id") deferrable initially deferred;
create index "ix_222_report_jobs" on core."report_jobs" ("org_id","file_id");
alter table core."report_jobs" add constraint "fk_report_jobs_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_223_report_jobs" on core."report_jobs" ("org_id");
alter table core."saas_subscriptions" add constraint "fk_saas_subscriptions_plan_version_id" foreign key ("plan_version_id") references core."saas_plan_versions" ("id") deferrable initially deferred;
create index "ix_224_saas_subscriptions" on core."saas_subscriptions" ("plan_version_id");
alter table core."saas_subscriptions" add constraint "fk_saas_subscriptions_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_225_saas_subscriptions" on core."saas_subscriptions" ("org_id");
alter table core."saas_change_requests" add constraint "fk_saas_change_requests_target_plan_id" foreign key ("target_plan_id") references core."saas_plan_versions" ("id") deferrable initially deferred;
create index "ix_226_saas_change_requests" on core."saas_change_requests" ("target_plan_id");
alter table core."saas_change_requests" add constraint "fk_saas_change_requests_kept_center_id" foreign key ("org_id","kept_center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_227_saas_change_requests" on core."saas_change_requests" ("org_id","kept_center_id");
alter table core."saas_change_requests" add constraint "fk_saas_change_requests_quote_id" foreign key ("org_id","quote_id") references core."saas_quotes" ("org_id","id") deferrable initially deferred;
create index "ix_228_saas_change_requests" on core."saas_change_requests" ("org_id","quote_id");
alter table core."saas_change_requests" add constraint "fk_saas_change_requests_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_229_saas_change_requests" on core."saas_change_requests" ("org_id");
alter table core."saas_quotes" add constraint "fk_saas_quotes_from_plan_id" foreign key ("from_plan_id") references core."saas_plan_versions" ("id") deferrable initially deferred;
create index "ix_230_saas_quotes" on core."saas_quotes" ("from_plan_id");
alter table core."saas_quotes" add constraint "fk_saas_quotes_to_plan_id" foreign key ("to_plan_id") references core."saas_plan_versions" ("id") deferrable initially deferred;
create index "ix_231_saas_quotes" on core."saas_quotes" ("to_plan_id");
alter table core."saas_quotes" add constraint "fk_saas_quotes_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_232_saas_quotes" on core."saas_quotes" ("org_id");
alter table core."saas_payment_verifications" add constraint "fk_saas_payment_verifications_verified_by" foreign key ("verified_by") references core."accounts" ("id") deferrable initially deferred;
create index "ix_233_saas_payment_verificatio" on core."saas_payment_verifications" ("verified_by");
alter table core."saas_payment_verifications" add constraint "fk_saas_payment_verifications_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_234_saas_payment_verificatio" on core."saas_payment_verifications" ("org_id");
alter table core."events" add constraint "fk_events_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_235_events" on core."events" ("org_id");
alter table core."events" add constraint "fk_events_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_236_events" on core."events" ("org_id","center_id");
alter table core."event_assignments" add constraint "fk_event_assignments_event_id" foreign key ("org_id","center_id","event_id") references core."events" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_237_event_assignments" on core."event_assignments" ("org_id","center_id","event_id");
alter table core."event_assignments" add constraint "fk_event_assignments_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_238_event_assignments" on core."event_assignments" ("org_id","person_id");
alter table core."event_assignments" add constraint "fk_event_assignments_verified_by" foreign key ("org_id","verified_by") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_239_event_assignments" on core."event_assignments" ("org_id","verified_by");
alter table core."event_assignments" add constraint "fk_event_assignments_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_240_event_assignments" on core."event_assignments" ("org_id");
alter table core."event_assignments" add constraint "fk_event_assignments_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_241_event_assignments" on core."event_assignments" ("org_id","center_id");
alter table core."event_registrations" add constraint "fk_event_registrations_event_id" foreign key ("org_id","center_id","event_id") references core."events" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_242_event_registrations" on core."event_registrations" ("org_id","center_id","event_id");
alter table core."event_registrations" add constraint "fk_event_registrations_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_243_event_registrations" on core."event_registrations" ("org_id","person_id");
alter table core."event_registrations" add constraint "fk_event_registrations_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_244_event_registrations" on core."event_registrations" ("org_id");
alter table core."event_registrations" add constraint "fk_event_registrations_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_245_event_registrations" on core."event_registrations" ("org_id","center_id");
alter table core."documents" add constraint "fk_documents_scope_center_id" foreign key ("org_id","scope_center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_246_documents" on core."documents" ("org_id","scope_center_id");
alter table core."documents" add constraint "fk_documents_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_247_documents" on core."documents" ("org_id");
alter table core."document_versions" add constraint "fk_document_versions_document_id" foreign key ("org_id","document_id") references core."documents" ("org_id","id") deferrable initially deferred;
create index "ix_248_document_versions" on core."document_versions" ("org_id","document_id");
alter table core."document_versions" add constraint "fk_document_versions_file_id" foreign key ("org_id","file_id") references core."files" ("org_id","id") deferrable initially deferred;
create index "ix_249_document_versions" on core."document_versions" ("org_id","file_id");
alter table core."document_versions" add constraint "fk_document_versions_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_250_document_versions" on core."document_versions" ("org_id");
alter table core."document_requirements" add constraint "fk_document_requirements_document_version_id" foreign key ("org_id","document_version_id") references core."document_versions" ("org_id","id") deferrable initially deferred;
create index "ix_251_document_requirements" on core."document_requirements" ("org_id","document_version_id");
alter table core."document_requirements" add constraint "fk_document_requirements_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_252_document_requirements" on core."document_requirements" ("org_id");
alter table core."document_acceptances" add constraint "fk_document_acceptances_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_253_document_acceptances" on core."document_acceptances" ("org_id","person_id");
alter table core."document_acceptances" add constraint "fk_document_acceptances_account_id" foreign key ("account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_254_document_acceptances" on core."document_acceptances" ("account_id");
alter table core."document_acceptances" add constraint "fk_document_acceptances_document_version_id" foreign key ("org_id","document_version_id") references core."document_versions" ("org_id","id") deferrable initially deferred;
create index "ix_255_document_acceptances" on core."document_acceptances" ("org_id","document_version_id");
alter table core."document_acceptances" add constraint "fk_document_acceptances_operation_id" foreign key ("org_id","operation_id") references core."operation_receipts" ("org_id","id") deferrable initially deferred;
create index "ix_256_document_acceptances" on core."document_acceptances" ("org_id","operation_id");
alter table core."document_acceptances" add constraint "fk_document_acceptances_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_257_document_acceptances" on core."document_acceptances" ("org_id");
alter table core."files" add constraint "fk_files_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_258_files" on core."files" ("org_id","center_id");
alter table core."files" add constraint "fk_files_owner_person_id" foreign key ("org_id","owner_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_259_files" on core."files" ("org_id","owner_person_id");
alter table core."files" add constraint "fk_files_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_260_files" on core."files" ("org_id");
alter table core."previews" add constraint "fk_previews_actor_account_id" foreign key ("actor_account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_261_previews" on core."previews" ("actor_account_id");
alter table core."previews" add constraint "fk_previews_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_262_previews" on core."previews" ("org_id");
alter table core."operation_receipts" add constraint "fk_operation_receipts_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_263_operation_receipts" on core."operation_receipts" ("org_id");
alter table core."operation_receipts" add constraint "fk_operation_receipts_actor_account_id" foreign key ("actor_account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_264_operation_receipts" on core."operation_receipts" ("actor_account_id");
alter table core."audit_events" add constraint "fk_audit_events_actor_account_id" foreign key ("actor_account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_265_audit_events" on core."audit_events" ("actor_account_id");
alter table core."audit_events" add constraint "fk_audit_events_actor_person_id" foreign key ("org_id","actor_person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_266_audit_events" on core."audit_events" ("org_id","actor_person_id");
alter table core."audit_events" add constraint "fk_audit_events_operation_id" foreign key ("org_id","operation_id") references core."operation_receipts" ("org_id","id") deferrable initially deferred;
create index "ix_267_audit_events" on core."audit_events" ("org_id","operation_id");
alter table core."audit_events" add constraint "fk_audit_events_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_268_audit_events" on core."audit_events" ("org_id");
alter table core."import_jobs" add constraint "fk_import_jobs_requester_account_id" foreign key ("requester_account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_269_import_jobs" on core."import_jobs" ("requester_account_id");
alter table core."import_jobs" add constraint "fk_import_jobs_file_id" foreign key ("org_id","file_id") references core."files" ("org_id","id") deferrable initially deferred;
create index "ix_270_import_jobs" on core."import_jobs" ("org_id","file_id");
alter table core."import_jobs" add constraint "fk_import_jobs_preview_id" foreign key ("org_id","preview_id") references core."previews" ("org_id","id") deferrable initially deferred;
create index "ix_271_import_jobs" on core."import_jobs" ("org_id","preview_id");
alter table core."import_jobs" add constraint "fk_import_jobs_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_272_import_jobs" on core."import_jobs" ("org_id");
alter table core."import_jobs" add constraint "fk_import_jobs_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_273_import_jobs" on core."import_jobs" ("org_id","center_id");
alter table core."import_rows" add constraint "fk_import_rows_job_id" foreign key ("org_id","center_id","job_id") references core."import_jobs" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_274_import_rows" on core."import_rows" ("org_id","center_id","job_id");
alter table core."import_rows" add constraint "fk_import_rows_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_275_import_rows" on core."import_rows" ("org_id");
alter table core."import_rows" add constraint "fk_import_rows_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_276_import_rows" on core."import_rows" ("org_id","center_id");
alter table core."publications" add constraint "fk_publications_session_id" foreign key ("org_id","center_id","session_id") references core."sessions" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_277_publications" on core."publications" ("org_id","center_id","session_id");
alter table core."publications" add constraint "fk_publications_event_id" foreign key ("org_id","center_id","event_id") references core."events" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_278_publications" on core."publications" ("org_id","center_id","event_id");
alter table core."publications" add constraint "fk_publications_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_279_publications" on core."publications" ("org_id");
alter table core."publications" add constraint "fk_publications_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_280_publications" on core."publications" ("org_id","center_id");
alter table core."public_applications" add constraint "fk_public_applications_publication_id" foreign key ("org_id","center_id","publication_id") references core."publications" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_281_public_applications" on core."public_applications" ("org_id","center_id","publication_id");
alter table core."public_applications" add constraint "fk_public_applications_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_282_public_applications" on core."public_applications" ("org_id");
alter table core."public_applications" add constraint "fk_public_applications_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_283_public_applications" on core."public_applications" ("org_id","center_id");
alter table core."privacy_requests" add constraint "fk_privacy_requests_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_284_privacy_requests" on core."privacy_requests" ("org_id");
alter table core."privacy_requests" add constraint "fk_privacy_requests_requester_account_id" foreign key ("requester_account_id") references core."accounts" ("id") deferrable initially deferred;
create index "ix_285_privacy_requests" on core."privacy_requests" ("requester_account_id");
alter table core."retention_holds" add constraint "fk_retention_holds_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_286_retention_holds" on core."retention_holds" ("org_id");
alter table core."deletion_receipts" add constraint "fk_deletion_receipts_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_287_deletion_receipts" on core."deletion_receipts" ("org_id");
alter table core."deletion_receipts" add constraint "fk_deletion_receipts_request_id" foreign key ("org_id","request_id") references core."privacy_requests" ("org_id","id") deferrable initially deferred;
create index "ix_288_deletion_receipts" on core."deletion_receipts" ("org_id","request_id");
alter table core."class_assignments" add constraint "fk_class_assignments_class_id" foreign key ("org_id","center_id","class_id") references core."classes" ("org_id","center_id","id") deferrable initially deferred;
create index "ix_289_class_assignments" on core."class_assignments" ("org_id","center_id","class_id");
alter table core."class_assignments" add constraint "fk_class_assignments_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_290_class_assignments" on core."class_assignments" ("org_id","person_id");
alter table core."class_assignments" add constraint "fk_class_assignments_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_291_class_assignments" on core."class_assignments" ("org_id");
alter table core."class_assignments" add constraint "fk_class_assignments_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_292_class_assignments" on core."class_assignments" ("org_id","center_id");
alter table core."disciplines" add constraint "fk_disciplines_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_293_disciplines" on core."disciplines" ("org_id");
alter table core."center_disciplines" add constraint "fk_center_disciplines_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_294_center_disciplines" on core."center_disciplines" ("org_id","discipline_id");
alter table core."center_disciplines" add constraint "fk_center_disciplines_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_295_center_disciplines" on core."center_disciplines" ("org_id");
alter table core."center_disciplines" add constraint "fk_center_disciplines_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_296_center_disciplines" on core."center_disciplines" ("org_id","center_id");
alter table core."person_disciplines" add constraint "fk_person_disciplines_person_id" foreign key ("org_id","person_id") references core."people" ("org_id","id") deferrable initially deferred;
create index "ix_297_person_disciplines" on core."person_disciplines" ("org_id","person_id");
alter table core."person_disciplines" add constraint "fk_person_disciplines_discipline_id" foreign key ("org_id","discipline_id") references core."disciplines" ("org_id","id") deferrable initially deferred;
create index "ix_298_person_disciplines" on core."person_disciplines" ("org_id","discipline_id");
alter table core."person_disciplines" add constraint "fk_person_disciplines_org_id" foreign key ("org_id") references core."organizations" ("id") deferrable initially deferred;
create index "ix_299_person_disciplines" on core."person_disciplines" ("org_id");
alter table core."person_disciplines" add constraint "fk_person_disciplines_center_id" foreign key ("org_id","center_id") references core."centers" ("org_id","id") deferrable initially deferred;
create index "ix_300_person_disciplines" on core."person_disciplines" ("org_id","center_id");
alter table core.center_disciplines add unique (org_id,center_id,discipline_id);
alter table core."room_capacities" add constraint "cd_room_capacities" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_room_capacities" on core."room_capacities" (org_id,center_id,discipline_id);
alter table core."classes" add constraint "cd_classes" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_classes" on core."classes" (org_id,center_id,discipline_id);
alter table core."sessions" add constraint "cd_sessions" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_sessions" on core."sessions" (org_id,center_id,discipline_id);
alter table core."lesson_requests" add constraint "cd_lesson_requests" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_lesson_requests" on core."lesson_requests" (org_id,center_id,discipline_id);
alter table core."instructor_agreements" add constraint "cd_instructor_agreements" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_instructor_agreements" on core."instructor_agreements" (org_id,center_id,discipline_id);
alter table core."person_disciplines" add constraint "cd_person_disciplines" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_person_disciplines" on core."person_disciplines" (org_id,center_id,discipline_id);
alter table core."credit_deficits" add constraint "cd_credit_deficits" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_credit_deficits" on core."credit_deficits" (org_id,center_id,discipline_id);
alter table core."negative_limit_overrides" add constraint "cd_negative_limit_overrides" foreign key (org_id,center_id,discipline_id) references core.center_disciplines (org_id,center_id,discipline_id) deferrable initially deferred;
create index "ix_cd_negative_limit_overrides" on core."negative_limit_overrides" (org_id,center_id,discipline_id);
alter table core.negative_limit_overrides add unique (org_id,center_id,discipline_id,person_id);
alter table core.negative_limit_overrides add check (limit_count>=0);
alter table core.room_capacities add unique (org_id,center_id,room_id,discipline_id);
create unique index person_discipline_active on core.person_disciplines(org_id,center_id,discipline_id,person_id,kind) where state='active';
alter table core.person_disciplines add check(kind in ('student','instructor'));
alter table core.entitlement_accounts add unique (org_id,sale_id);
create unique index active_reservation on core.reservations(org_id,session_id,person_id) where state='active';
alter table core.sessions add unique(org_id,center_id,discipline_id,id);
alter table core.reservations add unique(org_id,center_id,session_id,person_id,id);
alter table core.credit_deficits add unique(org_id,reservation_id);
alter table core.credit_deficits add foreign key (org_id,center_id,discipline_id,session_id) references core.sessions(org_id,center_id,discipline_id,id) deferrable initially deferred;
alter table core.credit_deficits add foreign key (org_id,center_id,session_id,person_id,reservation_id) references core.reservations(org_id,center_id,session_id,person_id,id) deferrable initially deferred;
create index ix_deficit_scope on core.credit_deficits(org_id,center_id,discipline_id,person_id,state,created_at,id);
alter table core.credit_deficits add check(quantity>0);
alter table core.product_scopes add check ((scope_kind='center_discipline' and center_id is not null and discipline_id is not null) or (scope_kind='center_all_disciplines' and center_id is not null and discipline_id is null) or (scope_kind='organization_discipline' and center_id is null and discipline_id is not null) or (scope_kind='organization_all' and center_id is null and discipline_id is null));
alter table core.product_scopes add check (cardinality(usage_targets)>0 and usage_targets <@ array['lesson','event']::text[]);
alter table core.product_scopes add check (not (class_id is not null and event_id is not null));
alter table core.product_scopes add check ((class_id is null or 'lesson'=any(usage_targets)) and (event_id is null or 'event'=any(usage_targets)));
alter table core."organizations" add check ("version">=1);
alter table core."organizations" add check ("state" in ('active','closed','deletion_pending','deleted'));
alter table core."centers" add check ("version">=1);
alter table core."centers" add check ("state" in ('active','inactive'));
alter table core."rooms" add check ("version">=1);
alter table core."rooms" add check ("state" in ('active','inactive'));
alter table core."room_capacities" add check ("version">=1);
alter table core."room_capacities" add check(0<=nominal and nominal<=maximum);
alter table core."availability_rules" add check ("version">=1);
alter table core."availability_rules" add check ("resource_kind" in ('room','person'));
alter table core."availability_exceptions" add check ("version">=1);
alter table core."availability_exceptions" add check ("resource_kind" in ('room','person'));
alter table core."availability_exceptions" add check(starts_at<ends_at);
alter table core."policy_versions" add check ("version">=1);
alter table core."accounts" add check ("version">=1);
alter table core."accounts" add check ("state" in ('pending','active','deletion_pending','deleted'));
alter table core."account_links" add check ("version">=1);
alter table core."account_links" add check ("state" in ('active','revoked'));
alter table core."role_assignments" add check ("version">=1);
alter table core."role_assignments" add check ("role" in ('owner','org_manager','center_manager','staff','instructor','assistant','student'));
alter table core."role_assignments" add check ("state" in ('active','inactive'));
alter table core."permission_overrides" add check ("version">=1);
alter table core."permission_overrides" add check ("permission" in ('account.self','org.read','org.manage','org.owner','center.manage','policy.manage','person.read','person.manage','person.activate','person.merge','invite.student','invite.accept','schedule.read','schedule.manage','request.write','request.resolve','reservation.write','attendance.draft','attendance.close','attendance.correct','product.manage','sale.write','entitlement.correct','finance.read','finance.collect','finance.refund','earnings.manage','crm.daily','crm.manage','notification.self','report.read','report.export','import.execute','subscription.owner','saas.operator','event.manage','event.register','document.manage','document.accept','public.apply','system.worker','earnings.read','platform.owner','center.manager.assign','org.configuration','auth.recover','event.attendance','event.close','attendance.block'));
alter table core."invitations" add check ("version">=1);
alter table core."invitations" add check ("state" in ('pending','accepted','expired','revoked'));
alter table core."people" add check ("version">=1);
alter table core."people" add check ("state" in ('active','merged'));
alter table core."person_contacts" add check ("version">=1);
alter table core."person_contacts" add check ("kind" in ('email','phone'));
alter table core."center_relationships" add check ("version">=1);
alter table core."center_relationships" add check ("kind" in ('student','instructor','staff','candidate'));
alter table core."center_relationships" add check ("state" in ('active','inactive'));
alter table core."merge_requests" add check ("version">=1);
alter table core."merge_requests" add check ("state" in ('pending','accepted','rejected','cancelled'));
alter table core."merge_approvals" add check ("version">=1);
alter table core."classes" add check ("version">=1);
alter table core."classes" add check ("state" in ('active','inactive'));
alter table core."program_versions" add check ("version">=1);
alter table core."program_versions" add check ("state" in ('active','inactive'));
alter table core."sessions" add check ("version">=1);
alter table core."sessions" add check ("format" in ('group','private'));
alter table core."sessions" add check ("state" in ('planned','occurred','cancelled'));
alter table core."sessions" add check ("attendance_state" in ('open','closed'));
alter table core."sessions" add check(0<=nominal and nominal<=maximum);
alter table core."sessions" add check(starts_at<ends_at);
alter table core."session_assignments" add check ("version">=1);
alter table core."session_assignments" add check ("duty" in ('instructor','assistant'));
alter table core."session_assignments" add check ("state" in ('active','inactive'));
alter table core."resource_bookings" add check ("version">=1);
alter table core."resource_bookings" add check ("resource_kind" in ('room','person'));
alter table core."resource_bookings" add check ("state" in ('active','inactive'));
alter table core."resource_bookings" add check(starts_at<ends_at);
alter table core."lesson_requests" add check ("version">=1);
alter table core."lesson_requests" add check ("format" in ('group','private'));
alter table core."lesson_requests" add check ("state" in ('pending','alternative_offered','approved','rejected','withdrawn','expired'));
alter table core."request_alternatives" add check ("version">=1);
alter table core."request_alternatives" add check ("state" in ('offered','accepted','rejected','superseded','expired'));
alter table core."request_alternatives" add check(starts_at<ends_at);
alter table core."reservations" add check ("version">=1);
alter table core."reservations" add check ("mode" in ('priority','flexible'));
alter table core."reservations" add check ("state" in ('active','cancelled','completed'));
alter table core."waitlist_entries" add check ("version">=1);
alter table core."waitlist_entries" add check ("state" in ('waiting','offered','converted','left','closed'));
alter table core."seat_offers" add check ("version">=1);
alter table core."seat_offers" add check ("state" in ('active','accepted','rejected','expired','withdrawn'));
alter table core."attendance_entries" add check ("version">=1);
alter table core."attendance_entries" add check ("result" in ('unmarked','attended','no_show','blocked'));
alter table core."attendance_closures" add check ("version">=1);
alter table core."products" add check ("version">=1);
alter table core."products" add check ("state" in ('active','inactive'));
alter table core."product_versions" add check ("version">=1);
alter table core."product_versions" add check ("kind" in ('credits','timed'));
alter table core."product_versions" add check ("booking_mode" in ('priority','flexible'));
alter table core."product_versions" add check ("refund_method" in ('none','credit_ratio','used_at_unit_price','time_ratio'));
alter table core."product_scopes" add check ("version">=1);
alter table core."product_scopes" add check ("scope_kind" in ('center_discipline','center_all_disciplines','organization_discipline','organization_all'));
alter table core."sales" add check ("version">=1);
alter table core."sales" add check ("state" in ('active','terminated','expired'));
alter table core."entitlement_accounts" add check ("version">=1);
alter table core."entitlement_accounts" add check ("state" in ('active','suspended','closed'));
alter table core."entitlement_movements" add check ("version">=1);
alter table core."entitlement_movements" add check ("kind" in ('grant','reserve','consume','release','adjust_add','adjust_subtract','settle_deficit','reverse'));
alter table core."entitlement_allocations" add check ("version">=1);
alter table core."entitlement_allocations" add check ("state" in ('reserved','consumed','released'));
alter table core."credit_deficits" add check ("version">=1);
alter table core."credit_deficits" add check ("state" in ('reserved','consumed','settled','released'));
alter table core."quota_buckets" add check ("version">=1);
alter table core."quota_buckets" add check(starts_at<ends_at);
alter table core."freezes" add check ("version">=1);
alter table core."freezes" add check ("state" in ('scheduled','active','ended','cancelled'));
alter table core."negative_limit_overrides" add check ("version">=1);
alter table core."debts" add check ("version">=1);
alter table core."debts" add check ("state" in ('open','settled'));
alter table core."cash_movements" add check ("version">=1);
alter table core."cash_movements" add check ("kind" in ('collection','refund','correction_in','correction_out'));
alter table core."debt_allocations" add check ("version">=1);
alter table core."student_credit_movements" add check ("version">=1);
alter table core."student_credit_movements" add check ("kind" in ('surplus_add','refund_claim_add','offset_subtract','refund_subtract','reverse'));
alter table core."debt_adjustments" add check ("version">=1);
alter table core."debt_adjustments" add check ("direction" in ('increase','decrease'));
alter table core."instructor_agreements" add check ("version">=1);
alter table core."instructor_agreements" add check ("format" in ('group','private'));
alter table core."instructor_agreements" add check ("model" in ('percentage','session_fixed','per_person','fixed_plus_person','explicit_mixed'));
alter table core."instructor_agreements" add check ("state" in ('active','inactive'));
alter table core."earnings" add check ("version">=1);
alter table core."instructor_payments" add check ("version">=1);
alter table core."earning_allocations" add check ("version">=1);
alter table core."leads" add check ("version">=1);
alter table core."leads" add check ("state" in ('open','converted','closed'));
alter table core."crm_activities" add check ("version">=1);
alter table core."crm_activities" add check ("kind" in ('contact','followup','outcome'));
alter table core."trial_offers" add check ("version">=1);
alter table core."trial_offers" add check ("state" in ('active','accepted','rejected','expired','withdrawn'));
alter table core."trial_usages" add check ("version">=1);
alter table core."segments" add check ("version">=1);
alter table core."segments" add check ("state" in ('active','inactive'));
alter table core."automations" add check ("version">=1);
alter table core."automations" add check ("state" in ('active','inactive'));
alter table core."automation_runs" add check ("version">=1);
alter table core."automation_runs" add check ("state" in ('pending','running','retry_wait','succeeded','failed','cancelled'));
alter table core."notification_preferences" add check ("version">=1);
alter table core."notification_preferences" add check ("channel" in ('in_app','email'));
alter table core."notification_preferences" add check ("purpose" in ('transactional','reminder','marketing'));
alter table core."notifications" add check ("version">=1);
alter table core."outbox_jobs" add check ("version">=1);
alter table core."outbox_jobs" add check ("state" in ('pending','running','retry_wait','succeeded','failed','cancelled'));
alter table core."report_jobs" add check ("version">=1);
alter table core."report_jobs" add check ("report_kind" in ('collections_debts','lesson_attendance','renewal','occupancy','resource_usage','earnings','crm_conversion','cross_center_usage'));
alter table core."report_jobs" add check ("state" in ('pending','running','retry_wait','succeeded','failed','cancelled'));
alter table core."saas_plan_versions" add check ("version">=1);
alter table core."saas_plan_versions" add check ("name" in ('starter','pro','business'));
alter table core."saas_plan_versions" add check ("period" in ('monthly','yearly'));
alter table core."saas_subscriptions" add check ("version">=1);
alter table core."saas_subscriptions" add check ("state" in ('pending_payment','active','grace','suspended','ended'));
alter table core."saas_change_requests" add check ("version">=1);
alter table core."saas_change_requests" add check ("state" in ('scheduled','applied','cancelled'));
alter table core."saas_quotes" add check ("version">=1);
alter table core."saas_quotes" add check ("state" in ('active','accepted','rejected','expired','withdrawn'));
alter table core."saas_payment_verifications" add check ("version">=1);
alter table core."saas_payment_verifications" add check ("state" in ('pending','accepted','rejected','cancelled'));
alter table core."events" add check ("version">=1);
alter table core."events" add check ("state" in ('draft','published','occurred','cancelled'));
alter table core."events" add check ("attendance_state" in ('open','closed'));
alter table core."events" add check(0<=nominal and nominal<=maximum);
alter table core."events" add check(starts_at<ends_at);
alter table core."event_assignments" add check ("version">=1);
alter table core."event_assignments" add check ("duty" in ('instructor','assistant'));
alter table core."event_registrations" add check ("version">=1);
alter table core."event_registrations" add check ("state" in ('active','cancelled','completed'));
alter table core."event_registrations" add check ("attendance_result" in ('unmarked','attended','no_show','blocked'));
alter table core."documents" add check ("version">=1);
alter table core."documents" add check ("state" in ('active','inactive'));
alter table core."document_versions" add check ("version">=1);
alter table core."document_requirements" add check ("version">=1);
alter table core."document_requirements" add check ("operation" in ('sale','reservation','attendance','event_registration'));
alter table core."document_acceptances" add check ("version">=1);
alter table core."files" add check ("version">=1);
alter table core."files" add check ("purpose" in ('document','import','export'));
alter table core."files" add check ("state" in ('pending_upload','ready','rejected','deleted'));
alter table core."previews" add check ("version">=1);
alter table core."previews" add check ("state" in ('current','applied','invalidated','expired'));
alter table core."operation_receipts" add check ("version">=1);
alter table core."operation_receipts" add check ("state" in ('in_progress','succeeded','failed_final','result_expired'));
alter table core."audit_events" add check ("version">=1);
alter table core."import_jobs" add check ("version">=1);
alter table core."import_jobs" add check ("state" in ('pending','running','retry_wait','succeeded','failed','cancelled'));
alter table core."import_rows" add check ("version">=1);
alter table core."import_rows" add check ("state" in ('pending','valid','invalid','applied','failed'));
alter table core."publications" add check ("version">=1);
alter table core."public_applications" add check ("version">=1);
alter table core."public_applications" add check ("state" in ('pending','reviewed','closed'));
alter table core."privacy_requests" add check ("version">=1);
alter table core."privacy_requests" add check ("kind" in ('account_delete','organization_close','organization_delete'));
alter table core."privacy_requests" add check ("state" in ('requested','running','partial','completed','failed'));
alter table core."retention_holds" add check ("version">=1);
alter table core."deletion_receipts" add check ("version">=1);
alter table core."deletion_receipts" add check ("state" in ('pending','running','retry_wait','succeeded','failed','cancelled'));
alter table core."class_assignments" add check ("version">=1);
alter table core."class_assignments" add check ("duty" in ('instructor','assistant'));
alter table core."class_assignments" add check ("state" in ('active','inactive'));
alter table core."rate_limit_windows" add check ("version">=1);
alter table core."rate_limit_windows" add check ("dimension" in ('ip','target_org'));
alter table core."rate_limit_windows" add check(starts_at<ends_at);
alter table core."disciplines" add check ("version">=1);
alter table core."disciplines" add check ("state" in ('active','inactive'));
alter table core."center_disciplines" add check ("version">=1);
alter table core."center_disciplines" add check ("state" in ('active','inactive'));
alter table core."person_disciplines" add check ("version">=1);
alter table core."person_disciplines" add check ("kind" in ('student','instructor'));
alter table core."person_disciplines" add check ("state" in ('active','inactive'));
alter table core.organizations add check(org_id=id);
alter table core.centers add check(center_id=id);
alter table core.accounts add unique(auth_user_id);
commit;
