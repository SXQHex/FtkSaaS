from pathlib import Path
import hashlib,json
expected=json.loads(Path('database/migrations.sha256.json').read_text())
actual={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('supabase/migrations').glob('*.sql'))}
assert actual==expected,'Migration history changed: append a new migration and explicitly update the review manifest.'
parts=[]
for name in ['runtime.sql','kernel.sql','dispatch.sql','wrappers.sql']:
 s=Path('database',name).read_text();parts.append('\n'.join(l for l in s.splitlines() if l.strip() not in ['begin;','commit;']))
expected_runtime='-- FtkSaaS authenticated runtime v0.2.0-rc.1; backend-generated UUIDv7.\nbegin;\n'+'\n'.join(parts)+'\ncommit;\n'
assert next(Path('supabase/migrations').glob('*_runtime_foundation.sql')).read_text()==expected_runtime,'Runtime source and frozen migration differ'
print('Frozen migration history and runtime source agree:',len(actual),'migrations')

assert next(Path('supabase/migrations').glob('*_runtime_read_projection.sql')).read_text()==Path('database/runtime-read-projection.sql').read_text(),'Read projection migration source drift'

qe_parts=['event-payment-schema.sql','event-payment-functions.sql','event-payment-dispatch.sql','runtime-wrappers.sql']
qe_sql='-- Q-E01 accepted payment preparation and financial cancellation.\nbegin;\n'+'\n'.join('\n'.join(x for x in Path('database',n).read_text().splitlines() if x.strip() not in ['begin;','commit;']) for n in qe_parts)+'\ncommit;\n'
assert next(Path('supabase/migrations').glob('*_event_payment_finance.sql')).read_text()==qe_sql,'Q-E01 migration source drift'

assert next(Path('supabase/migrations').glob('*_event_operator_cancellation.sql')).read_text()=="-- Q-E02 final center cancellation acceptance; prior seven migrations remain immutable.\nbegin;\n"+Path('database/event-cancellation-dispatch.sql').read_text()+"\ncommit;\n",'Q-E02 migration source drift'

assert next(Path('supabase/migrations').glob('*_planned_start_cancellation.sql')).read_text()==Path('database/planned-start-cancellation.sql').read_text(),'Q-E03 migration source drift'
assert next(Path('supabase/migrations').glob('*_planned_start_decision_clock.sql')).read_text()==Path('database/planned-start-decision-clock.sql').read_text(),'Q-E03 decision clock migration source drift'

assert next(Path('supabase/migrations').glob('*_event_actual_start.sql')).read_text()==Path('database/event-actual-start.sql').read_text(),'Actual-start source drift'

assert next(Path('supabase/migrations').glob('*_registry_operations.sql')).read_text()==Path('database/registry-operations.sql').read_text()+Path('database/registry-wrappers.sql').read_text().replace('begin;\n','',1),'Registry source drift'

assert next(Path('supabase/migrations').glob('*_person_registry.sql')).read_text()==Path('database/person-registry.sql').read_text()+Path('database/person-registry-wrappers.sql').read_text().replace('begin;\n','',1),'Person registry source drift'

assert next(Path('supabase/migrations').glob('*_person_scope_guard.sql')).read_text()==Path('database/person-scope-guard.sql').read_text(),'Person scope source drift'

assert next(Path('supabase/migrations').glob('*_registry_read_versions.sql')).read_text()==Path('database/registry-read-versions.sql').read_text()+Path('database/registry-read-versions-wrappers.sql').read_text().replace('begin;\n','',1),'Registry read-version source drift'

assert next(Path('supabase/migrations').glob('*_discipline_read_scope.sql')).read_text()==Path('database/discipline-read-scope.sql').read_text()+Path('database/discipline-read-scope-wrappers.sql').read_text().replace('begin;\n','',1),'Discipline read scope source drift'

assert next(Path('supabase/migrations').glob('*_active_discipline_projection.sql')).read_text()==Path('database/active-discipline-projection.sql').read_text()+Path('database/active-discipline-projection-wrappers.sql').read_text().replace('begin;\n','',1),'Active discipline projection source drift'

assert next(Path('supabase/migrations').glob('*_deactivate_expired_offers.sql')).read_text()==Path('database/deactivate-expired-offers.sql').read_text()+Path('database/deactivate-expired-offers-wrappers.sql').read_text().replace('begin;\n','',1),'Deactivation expiry source drift'

assert next(Path('supabase/migrations').glob('*_room_and_role_registry.sql')).read_text()==Path('database/room-and-role-registry.sql').read_text()+Path('database/room-and-role-registry-wrappers.sql').read_text().replace('begin;\n','',1),'Room and role registry source drift'

assert next(Path('supabase/migrations').glob('*_role_list_snapshot.sql')).read_text()==Path('database/role-list-snapshot.sql').read_text(),'Role list snapshot source drift'

assert next(Path('supabase/migrations').glob('*_role_read_center_access.sql')).read_text()==Path('database/role-read-center-access.sql').read_text(),'Role read center access source drift'

assert next(Path('supabase/migrations').glob('*_availability_policies.sql')).read_text()==Path('database/availability-policies.sql').read_text()+Path('database/availability-policies-wrappers.sql').read_text(),'Availability/policy source drift'

assert next(Path('supabase/migrations').glob('*_schedule_reads.sql')).read_text()==Path('database/schedule-reads.sql').read_text()+Path('database/schedule-reads-wrappers.sql').read_text(),'Schedule read source drift'

assert next(Path('supabase/migrations').glob('*_program_session_lifecycle.sql')).read_text()==Path('database/program-session-lifecycle.sql').read_text()+Path('database/program-session-lifecycle-wrappers.sql').read_text(),'Program/session source drift'

assert next(Path('supabase/migrations').glob('*_starter_attendance_protection.sql')).read_text()==Path('database/starter-attendance-protection.sql').read_text()+Path('database/starter-attendance-protection-wrappers.sql').read_text(),'Starter attendance source drift'

assert next(Path('supabase/migrations').glob('*_starter_attendance_privacy_legacy.sql')).read_text()==Path('database/starter-attendance-privacy-legacy.sql').read_text(),'Starter privacy/legacy source drift'

assert next(Path('supabase/migrations').glob('*_instructor_earnings_workflow.sql')).read_text()==Path('database/instructor-earnings.sql').read_text()+Path('database/instructor-earnings-wrappers.sql').read_text(),'Instructor earnings source drift'

assert next(Path('supabase/migrations').glob('*_cross_center_settlement.sql')).read_text()==Path('database/cross-center-settlement.sql').read_text()+Path('database/cross-center-settlement-wrappers.sql').read_text(),'Cross-center settlement source drift'

assert next(Path('supabase/migrations').glob('*_p01_catalog_entitlement_reads.sql')).read_text()==Path('database/p01-catalog-entitlement-reads.sql').read_text()+Path('database/p01-catalog-entitlement-reads-wrappers.sql').read_text(),'P01 reads source drift'

assert next(Path('supabase/migrations').glob('*_p01_lesson_requests.sql')).read_text()==Path('database/p01-lesson-requests.sql').read_text()+Path('database/p01-lesson-requests-wrappers.sql').read_text(),'P01 requests source drift'

assert next(Path('supabase/migrations').glob('*_p01_waitlist_workers.sql')).read_text()==Path('database/p01-waitlist-workers.sql').read_text()+Path('database/p01-waitlist-workers-wrappers.sql').read_text(),'P01 waitlist source drift'

assert next(Path('supabase/migrations').glob('*_p01_worker_transport.sql')).read_text()==Path('database/p01-worker-transport.sql').read_text()+Path('database/p01-worker-transport-wrappers.sql').read_text(),'P01 worker transport source drift'

assert next(Path('supabase/migrations').glob('*_p01_final_scope_guards.sql')).read_text()==Path('database/p01-final-scope-guards.sql').read_text()+Path('database/p01-final-scope-guards-wrappers.sql').read_text(),'P01 final scope guards source drift'

assert next(Path('supabase/migrations').glob('*_p02_sessions.sql')).read_text()==Path('database/p02-sessions.sql').read_text()+Path('database/p02-sessions-wrappers.sql').read_text(),'P02 sessions source drift'

assert next(Path('supabase/migrations').glob('*_p02_entitlement_corrections.sql')).read_text()==Path('database/p02-entitlement-corrections.sql').read_text()+Path('database/p02-entitlement-corrections-wrappers.sql').read_text(),'P02 corrections source drift'

assert next(Path('supabase/migrations').glob('*_p02_freeze_lifecycle.sql')).read_text()==Path('database/p02-freeze-lifecycle.sql').read_text()+Path('database/p02-freeze-lifecycle-wrappers.sql').read_text(),'P02 freeze source drift'

assert next(Path('supabase/migrations').glob('*_p02_sale_lifecycle.sql')).read_text()==Path('database/p02-sale-lifecycle.sql').read_text()+Path('database/p02-sale-lifecycle-wrappers.sql').read_text(),'P02 sales source drift'

assert next(Path('supabase/migrations').glob('*_p02_runtime_guards.sql')).read_text()==Path('database/p02-runtime-guards.sql').read_text()+Path('database/p02-runtime-guards-wrappers.sql').read_text(),'P02 runtime guards source drift'

assert next(Path('supabase/migrations').glob('*_p02_renewal_currency.sql')).read_text()==Path('database/p02-renewal-currency.sql').read_text()+Path('database/p02-renewal-currency-wrappers.sql').read_text(),'P02 renewal currency source drift'

assert next(Path('supabase/migrations').glob('*_p03_finance_payments.sql')).read_text()==Path('database/p03-finance-payments.sql').read_text()+Path('database/p03-finance-payments-wrappers.sql').read_text(),'P03 finance source drift'

assert next(Path('supabase/migrations').glob('*_p03_finance_guardrails.sql')).read_text()==Path('database/p03-finance-guardrails.sql').read_text(),'P03 finance guardrails source drift'

assert next(Path('supabase/migrations').glob('*_p03_finance_acceptance.sql')).read_text()==Path('database/p03-finance-acceptance.sql').read_text(),'P03 acceptance source drift'

assert next(Path('supabase/migrations').glob('*_p03_finance_scope.sql')).read_text()==Path('database/p03-finance-scope.sql').read_text(),'P03 finance scope source drift'

assert next(Path('supabase/migrations').glob('*_p03_finance_payments.sql')).read_text()==Path('database/p03-finance-payments.sql').read_text()+Path('database/p03-finance-payments-wrappers.sql').read_text(),'P03 source drift p03_finance_payments'

assert next(Path('supabase/migrations').glob('*_p03_finance_guardrails.sql')).read_text()==Path('database/p03-finance-guardrails.sql').read_text(),'P03 source drift p03_finance_guardrails'

assert next(Path('supabase/migrations').glob('*_p03_finance_acceptance.sql')).read_text()==Path('database/p03-finance-acceptance.sql').read_text(),'P03 source drift p03_finance_acceptance'

assert next(Path('supabase/migrations').glob('*_p03_finance_scope.sql')).read_text()==Path('database/p03-finance-scope.sql').read_text(),'P03 source drift p03_finance_scope'

assert next(Path('supabase/migrations').glob('*_p03_finance_balances.sql')).read_text()==Path('database/p03-finance-balances.sql').read_text(),'P03 source drift p03_finance_balances'

assert next(Path('supabase/migrations').glob('*_p03_finance_results.sql')).read_text()==Path('database/p03-finance-results.sql').read_text(),'P03 source drift p03_finance_results'

assert next(Path('supabase/migrations').glob('*_p03_finance_integrity.sql')).read_text()==Path('database/p03-finance-integrity.sql').read_text(),'P03 source drift p03_finance_integrity'

assert next(Path('supabase/migrations').glob('*_p03_finance_provenance.sql')).read_text()==Path('database/p03-finance-provenance.sql').read_text(),'P03 source drift p03_finance_provenance'

assert next(Path('supabase/migrations').glob('*_p03_refund_identity.sql')).read_text()==Path('database/p03-refund-identity.sql').read_text(),'P03 source drift p03_refund_identity'

assert next(Path('supabase/migrations').glob('*_p04_crm_public.sql')).read_text()==Path('database/p04-crm-public.sql').read_text()+Path('database/p04-crm-public-wrappers.sql').read_text(),'P04 source drift'

assert next(Path('supabase/migrations').glob('*_p04_free_trial_attendance.sql')).read_text()==Path('database/p04-free-trial-attendance.sql').read_text(),'P04 trial attendance source drift'
