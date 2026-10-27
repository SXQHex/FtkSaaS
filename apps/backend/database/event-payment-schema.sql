-- Q-E01: payment preparation references the existing finance ledger.
alter table core.debts add constraint qe01_debt_person_scope unique(org_id,center_id,person_id,id);
alter table core.event_registrations add constraint qe01_registration_scope unique(org_id,center_id,event_id,person_id,id);
create table core."event_payment_preparations" (
 "id" uuid default private.new_uuid_v7() primary key,
 "created_at" timestamptz not null default transaction_timestamp(),
 "version" bigint not null default 1 check(version>0),
 "org_id" uuid not null,
 "center_id" uuid not null,
 "event_id" uuid not null,
 "person_id" uuid not null,
 "debt_id" uuid not null unique,
 "registration_id" uuid unique,
 "state" text not null check(state in ('prepared','registered','capacity_closed','event_cancelled')),
 "terms_snapshot" jsonb not null,
 "terms_hash" text not null,
 unique(org_id,id),
 unique(org_id,center_id,id),
 foreign key(org_id,center_id,event_id) references core.events(org_id,center_id,id) deferrable initially deferred,
 foreign key(org_id,person_id) references core.people(org_id,id) deferrable initially deferred,
 foreign key(org_id,center_id,person_id,debt_id) references core.debts(org_id,center_id,person_id,id) deferrable initially deferred,
 foreign key(org_id,center_id,event_id,person_id,registration_id) references core.event_registrations(org_id,center_id,event_id,person_id,id) deferrable initially deferred,
 check(state<>'registered' or registration_id is not null),
 check(state not in ('prepared','capacity_closed') or registration_id is null)
);
alter table core."event_payment_preparations" enable row level security;
revoke all on core."event_payment_preparations" from public,anon,authenticated;
grant all on core.event_payment_preparations to service_role;
create unique index qe01_open_preparation on core.event_payment_preparations(org_id,event_id,person_id) where state='prepared';
create index qe01_preparation_center on core.event_payment_preparations(org_id,center_id);
create index qe01_preparation_person on core.event_payment_preparations(org_id,person_id);
create index qe01_preparation_registration on core.event_payment_preparations(org_id,center_id,event_id,person_id,registration_id);
alter table core.student_credit_movements add column if not exists source_debt_id uuid;
alter table core.student_credit_movements add column if not exists operation_id uuid;
alter table core.student_credit_movements add constraint qe01_claim_debt_scope foreign key(org_id,center_id,source_debt_id) references core.debts(org_id,center_id,id) deferrable initially deferred;
create index qe01_claim_debt on core.student_credit_movements(org_id,center_id,source_debt_id);
create index qe01_claim_operation on core.student_credit_movements(org_id,operation_id);
alter table core.student_credit_movements add constraint qe01_credit_receipt_scope foreign key(org_id,operation_id) references core.operation_receipts(org_id,id) deferrable initially deferred;
