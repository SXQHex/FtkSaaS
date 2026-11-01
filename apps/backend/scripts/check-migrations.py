from pathlib import Path
import hashlib,json
expected=json.loads(Path('database/migrations.sha256.json').read_text())
actual={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('supabase/migrations').glob('*.sql'))}
assert actual==expected,'Migration history changed: append a new migration and explicitly update the review manifest.'
assert json.loads(Path("../../packages/api-contracts/schema/contract.json").read_text())["x-contract"]["runtime"]["migration_count"]==len(actual),"Contract migration inventory drift"
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

assert next(Path('supabase/migrations').glob('*_p04_followup_policy_guard.sql')).read_text()==Path('database/p04-followup-policy-guard.sql').read_text(),'P04 followup policy source drift'

assert next(Path('supabase/migrations').glob('*_p05_documents_notifications.sql')).read_text()==''.join(Path('database/p05-'+n+'.sql').read_text() for n in ['documents', 'document-protection', 'notifications', 'followups', 'workers', 'bind', 'wrappers']),'P05 source drift'

assert next(Path('supabase/migrations').glob('*_p06_reports_imports_tracking.sql')).read_text()==''.join(Path('database/p06-'+n+'.sql').read_text() for n in ['access','reports','imports','workers','tracking','bind','wrappers']),'P06 source drift'

assert next(Path('supabase/migrations').glob('*_ops_w01_hosted_scheduler.sql')).read_text()==Path('database/ops-hosted-workers.sql').read_text(),'Hosted worker source drift'

assert next(Path('supabase/migrations').glob('*_p07_account_revocation.sql')).read_text()==Path('database/p07-account-revocation.sql').read_text()+Path('database/p07-account-revocation-wrappers.sql').read_text(),'P07 revocation source drift'

assert next(Path('supabase/migrations').glob('*_p07_account_profile_auth_merge.sql')).read_text()==''.join(Path('database',n).read_text() for n in ['p07-account-profile.sql','p07-account-auth.sql','p07-person-merge.sql','p07-person-merge-bind.sql','p07-account-profile-auth-merge-wrappers.sql']),'P07 completion source drift'

assert next(Path('supabase/migrations').glob('*_p07_subscription_lifecycle.sql')).read_text()==''.join(Path('database',n).read_text() for n in ['p07-subscriptions.sql', 'p07-subscription-payments.sql', 'p07-subscription-workers.sql', 'p07-subscription-bind.sql', 'p07-lifecycle.sql', 'p07-privacy-workers.sql', 'p07-lifecycle-bind.sql', 'p07-reopen-workers.sql', 'p07-hosted-workers.sql', 'p07-subscription-lifecycle-wrappers.sql']),'P07 subscription/lifecycle source drift'

assert next(Path('supabase/migrations').glob('*_p07_payment_response_contract.sql')).read_text()==Path('database/p07-payment-response.sql').read_text(),'P07 payment response source drift'

assert next(Path('supabase/migrations').glob('*_session_capacity.sql')).read_text()==Path('database/session-capacity.sql').read_text(),'Session capacity source drift'
assert next(Path('supabase/migrations').glob('*_frontend_settings.sql')).read_text()==Path('database/frontend-settings-catalog.sql').read_text()+Path('database/frontend-settings.sql').read_text().replace('commit;\n','',1)+Path('database/frontend-settings-wrappers.sql').read_text().replace('begin;\n','',1),'Frontend settings source drift'

settings_fields=json.loads(Path('config/frontend-settings.json').read_text())['fields']
settings_catalog="begin;\ncreate or replace function private.frontend_settings_fields() returns jsonb language sql immutable security invoker set search_path='' as $fields$select '"+json.dumps(settings_fields,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb$fields$;\n"
settings_version=json.loads(Path('config/frontend-settings.json').read_text())['version']
assert Path(f'database/settings-catalog-v{settings_version}.sql').read_text()==settings_catalog+'commit;\n','Frontend field catalog SQL drift'
installed_catalogs=[line for p in sorted(Path('supabase/migrations').glob('*.sql')) for line in p.read_text().splitlines() if line.startswith('create or replace function private.frontend_settings_fields()')]
assert installed_catalogs[-1]==settings_catalog.splitlines()[1],'Latest applied catalog must match the current typed field source'
settings_contract=json.loads(Path('../../packages/api-contracts/schema/contract.json').read_text())
for scope in ['user','member','center','organization','platform']:
 assert settings_contract['$defs'][scope.title()+'SettingsValues']['properties']=={f['key']:f['schema'] for f in settings_fields if f['scope']==scope},'Frontend field DTO drift: '+scope

assert next(Path('supabase/migrations').glob('*_pilot_operational_security.sql')).read_text()==Path('database/pilot-operational-security.sql').read_text(),'Pilot operational security source drift'

assert next(Path('supabase/migrations').glob('*_user_settings_context.sql')).read_text()==Path('database/user-settings-catalog.sql').read_text()+Path('database/user-settings-context.sql').read_text(),'User settings extension source drift'

# Scoped response variants keep the same closed field set/catalog version as the base definitions.
settings_defs=settings_contract['$defs']
for variant in settings_defs['SettingsView']['oneOf']:
 scope=variant['properties']['scope']['const']
 assert set(variant['properties']['overridden_fields']['items']['enum'])=={f['key'] for f in settings_fields if f['scope']==scope},'Scoped settings field drift: '+scope
for variant in settings_defs['SettingsCatalog']['oneOf']:
 assert variant['properties']['catalog_version']=={'const':json.loads(Path('config/frontend-settings.json').read_text())['version']},'Scoped settings catalog version drift'

assert next(Path('supabase/migrations').glob('*_account_session_management.sql')).read_text()==Path('database/account-session-management.sql').read_text()+Path('database/account-session-management-wrappers.sql').read_text(),'Account sessions source drift'

account_session_names=['account_sessions_list_v1','account_session_label_v1','account_sessions_revoke_v1','account_security_history_get_v1']
account_session_entries=[line for line in Path('database/runtime-wrappers-current.sql').read_text().splitlines() if any("'"+name+"'" in line or 'api_v1.'+name+'(' in line for name in account_session_names)]
assert len(account_session_entries)==4*len(account_session_names),'Account session wrapper inventory'
historical_session_entries=[line for line in Path('database/account-session-management-wrappers.sql').read_text().splitlines() if any("'"+name+"'" in line or 'api_v1.'+name+'(' in line for name in account_session_names)]
assert historical_session_entries==account_session_entries,'Account sessions wrapper drift or privilege expansion'
assert 'account_totp_remove_v1' not in Path('database/runtime-wrappers-current.sql').read_text(),'Retired MFA adapter remains callable'

assert next(Path('supabase/migrations').glob('*_account_identity_projection.sql')).read_text()==Path('database/account-identity-projection.sql').read_text(),'Account identity source drift'

assert next(Path('supabase/migrations').glob('*_starter_plan_gates.sql')).read_text()==Path('database/starter-plan-gates.sql').read_text(),'Starter gates source drift'

assert next(Path('supabase/migrations').glob('*_starter_studio_product_names.sql')).read_text()==Path('database/starter-studio-product-names.sql').read_text(),'Starter studio name snapshot source drift'

assert next(Path("supabase/migrations").glob("*_starter_onboarding_defaults.sql")).read_text()==Path("database/starter-onboarding-defaults.sql").read_text(),"Starter onboarding source drift"

assert next(Path('supabase/migrations').glob('*_starter_preparation_settings.sql')).read_text()==Path('database/starter-settings-catalog.sql').read_text()+Path('database/starter-preparation-settings.sql').read_text(),'Starter preparation source drift'

assert next(Path('supabase/migrations').glob('*_starter_peer_sharing.sql')).read_text()==Path('database/starter-peer-sharing.sql').read_text(),'Starter peer sharing source drift'

assert next(Path('supabase/migrations').glob('*_canonical_settings_scope.sql')).read_text()==Path('database/canonical-settings-scope.sql').read_text(),'Canonical settings scope source drift'

assert next(Path('supabase/migrations').glob('*_starter_settings_media.sql')).read_text()==Path('database/starter-settings-media.sql').read_text().replace('commit;\n','',1)+Path('database/starter-settings-media-wrappers.sql').read_text().replace('begin;\n','',1),'Starter media source drift'

assert next(Path('supabase/migrations').glob('*_starter_work_templates.sql')).read_text()==Path('database/settings-catalog-v4.sql').read_text().replace('commit;\n','',1)+Path('database/starter-work-templates.sql').read_text().replace('begin;\n','',1).replace('commit;\n','',1)+Path('database/starter-work-templates-wrappers.sql').read_text().replace('begin;\n','',1),'Work templates source drift'

assert next(Path("supabase/migrations").glob("*_starter_public_settings.sql")).read_text()==Path("database/settings-catalog-v5.sql").read_text().replace("commit;\n","",1)+Path("database/starter-public-settings.sql").read_text().replace("begin;\n","",1),"Public settings source drift"

assert next(Path("supabase/migrations").glob("*_starter_collection_methods.sql")).read_text()==Path("database/starter-collection-methods.sql").read_text(),"Collection methods source drift"

assert next(Path("supabase/migrations").glob("*_personal_calendar_links.sql")).read_text()==Path("database/personal-calendar-links.sql").read_text().replace("commit;\n","",1)+Path("database/personal-calendar-links-wrappers.sql").read_text().replace("begin;\n","",1),"Personal calendar source drift"

assert next(Path("supabase/migrations").glob("*_starter_domain_preparations.sql")).read_text()==Path("database/settings-catalog-v6.sql").read_text().replace("commit;\n","",1)+Path("database/starter-domain-preparations.sql").read_text().replace("begin;\n","",1).replace("commit;\n","",1)+Path("database/starter-domain-preparations-wrappers.sql").read_text().replace("begin;\n","",1),"Domain preparations source drift"

assert next(Path("supabase/migrations").glob("*_starter_notification_support.sql")).read_text()==Path("database/starter-notification-support.sql").read_text(),"Notification support source drift"

assert next(Path("supabase/migrations").glob("*_starter_calendar_preferences.sql")).read_text()==Path("database/settings-catalog-v7.sql").read_text().replace("commit;\n","",1)+Path("database/starter-calendar-preferences.sql").read_text().replace("begin;\n","",1),"Calendar preferences source drift"

assert next(Path("supabase/migrations").glob("*_starter_availability_day_boundaries.sql")).read_text()==Path("database/settings-catalog-v8.sql").read_text().replace("commit;\n","",1)+Path("database/starter-availability-day-boundaries.sql").read_text().replace("begin;\n","",1),"Availability day boundaries source drift"

assert next(Path("supabase/migrations").glob("*_starter_availability_management.sql")).read_text()==Path("database/starter-availability-management.sql").read_text(),"Availability management source drift"

assert next(Path("supabase/migrations").glob("*_starter_availability_management_asof.sql")).read_text()==Path("database/starter-availability-management-asof.sql").read_text(),"Availability management snapshot source drift"

assert next(Path('supabase/migrations').glob('*_organization_brand_colors.sql')).read_text()==Path('database/organization-brand-colors.sql').read_text(),'Organization brand colors migration source drift'

assert next(Path('supabase/migrations').glob('*_account_signup_guard.sql')).read_text()==Path('database/account-signup.sql').read_text()+Path('database/account-signup-wrappers.sql').read_text(),'Signup guard source drift'

assert next(Path('supabase/migrations').glob('*_native_auth_signup_check.sql')).read_text()==Path('database/native-auth-signup-check.sql').read_text(),'Native Auth signup check source drift'

assert next(Path('supabase/migrations').glob('*_invitation_delivery_tracking.sql')).read_text()==Path('database/invitation-delivery.sql').read_text(),'Invitation delivery source drift'
