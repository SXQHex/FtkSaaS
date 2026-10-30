import assert from 'node:assert/strict';
import fs from 'node:fs';

const equalSet=(a,b,label)=>assert.deepEqual([...new Set(a)].sort(),[...new Set(b)].sort(),label);
export function validateGovernance(p,implemented){
 const x=p['x-contract'],d=p.$defs,ops=x.operations,map=new Map(ops.map(o=>[o.name,o])),live=new Set(implemented);
 assert.equal(map.size,ops.length,'OP_DUPLICATE');
 equalSet(d.OperationName.enum,ops.map(o=>o.name),'OP_ENUM_COVERAGE');
 assert.equal(d.OperationName.enum.length,ops.length,'OP_ENUM_DUPLICATE');
 for(const [n,k] of [['AuditView','action'],['OperationStatusView','operation'],['Request_operation_status_get','operation'],['Table_audit_events','action'],['Table_operation_receipts','operation']])
  assert.equal(d[n].properties[k].$ref,'#/$defs/OperationName','OP_NAME_TYPED '+n);
 const features=x.feature_delivery;equalSet(Object.keys(features),Array.from({length:33},(_,i)=>'F'+String(i+1).padStart(2,'0')),'FEATURE_COVERAGE');
 equalSet(x.runtime.implemented_operations,[...live],'RUNTIME_SUMMARY_DRIFT');
 const allowedKinds=['read','preview','draft','closure','correction','apply','auth','worker','command'];
 for(const o of ops){
  const q=d[o.request.$ref.split('/').at(-1)],k=o.operation_contract;
  assert(x.permissions[o.permission],'UNKNOWN_PERMISSION '+o.name);
  assert(d[o.success.$ref.split('/').at(-1)],'UNKNOWN_SUCCESS '+o.name);
  assert(k&&allowedKinds.includes(k.kind),'OP_PHASE '+o.name);
  if(!['public_calendar_get_v1','public_application_submit_v1','account_password_reset_request_v1','account_signup_request_v1'].includes(o.name))assert(o.semantic_guards.includes('live_actor_and_scope'),'MISSING_LIVE_SCOPE '+o.name);
  for(const f of [...o.features,...o.required_features,...o.runtime_required_features,...o.conditional_features.map(v=>v.feature)])assert(features[f],'UNKNOWN_FEATURE '+o.name);
  for(const f of o.required_features)assert(o.features.includes(f),'REQUIRE_UNREFERENCED_FEATURE '+o.name);
  assert.equal(live.has(o.name),o.implementation_status==='operational_development_limited','RUNTIME_INVENTORY '+o.name);
  if(!live.has(o.name))assert.equal(o.runtime_required_features.length,0,'UNIMPLEMENTED_GATE_CLAIM '+o.name);
  assert(o.decision_delivery&&o.decision_delivery.accepted_contract==='DS-2026-10-17','MISSING_DECISION_STAGE '+o.name);
  assert(!o.semantic_guards.includes('plan_capabilities_from_features'),'CONFLATED_FEATURE_GATE '+o.name);
  if(['read','preview'].includes(k.kind)){
   assert.equal(k.business_commit,false,'READ_BUSINESS_COMMIT '+o.name);
   assert.equal(k.atomic_effects.length,0,'READ_EFFECT '+o.name);
   assert.equal(o.audit,false,'READ_AUDIT '+o.name);assert.equal(o.notification,'none','READ_NOTIFY '+o.name);
   for(const g of ['no_unmarked_on_closure','all_non_cancelled_results_complete','receipt_audit_outbox_atomic_domain_commit','rights_consume_release_atomic','expected_version_on_update','shared_entitlement_pool_recheck_at_commit','active_student_limit_no_candidate_event_exception'])
    assert(!o.semantic_guards.includes(g),'READ_CLOSURE_GUARD '+o.name);
   assert.equal(o.transaction_class,k.kind==='read'?'read':'preview','READ_TRANSACTION '+o.name);
  }
  if(k.kind==='draft')for(const e of k.atomic_effects)assert(!/rights|earnings|settlement/.test(e),'DRAFT_CONSUMES '+o.name);
  if(k.kind==='closure'){
   assert(o.semantic_guards.includes('all_non_cancelled_results_complete'),'CLOSURE_COMPLETENESS '+o.name);
   assert(k.atomic_effects.some(e=>e.startsWith('rights.')),'CLOSURE_RIGHTS '+o.name);
  }
  const props=q.properties;
  if(k.kind==='read'){assert.equal(o.expected_version_subject,'none','READ_VERSION '+o.name);assert.equal(k.version_field,null,'READ_REQUEST_VERSION '+o.name);}
  else if(!['auth','worker'].includes(k.kind)){
   assert(map.has(k.read_operation),'WRITE_WITHOUT_READ '+o.name);
   const read=map.get(k.read_operation);assert(['read','preview'].includes(read.operation_contract.kind),'WRITE_READ_IS_WRITE '+o.name);
   assert.equal(k.read_path_status,live.has(read.name)&&(read.name!=='management_state_get_v1'||read.runtime_selectors?.includes(o.name))?'implemented':'contract_only','FALSE_READ_AVAILABILITY '+o.name);
   if(k.version_mode==='row_version')assert(props.expected_version&&q.required.includes('expected_version'),'MISSING_ROW_VERSION '+o.name);
   if(k.version_mode==='create_absent_update_requires_version')assert(props.expected_version,'MISSING_OPTIONAL_VERSION '+o.name);
   if(k.version_field)assert(props[k.version_field]||['account_id','org_id','center_id'].includes(k.version_field),'VERSION_FIELD_NOT_READABLE '+o.name);
   if(k.version_mode==='preview_dependencies')assert(k.kind==='preview'||props.preview,'MISSING_PREVIEW_TOKEN '+o.name);
  }
 }
 for(const f of Object.keys(features)){
  const row=features[f];equalSet(row.technical_operations,ops.filter(o=>o.features.includes(f)).map(o=>o.name),'FEATURE_OPERATION_LINK '+f);
  equalSet(row.implemented_operations,row.technical_operations.filter(n=>live.has(n)),'FEATURE_RUNTIME_SUMMARY_DRIFT '+f);
  equalSet(row.contract_only_operations,row.technical_operations.filter(n=>!live.has(n)),'FEATURE_CONTRACT_ONLY_SUMMARY_DRIFT '+f);
  equalSet(row.dependencies,ops.filter(o=>o.features.includes(f)).flatMap(o=>o.decision_delivery.open_dependencies),'FEATURE_DEPENDENCY_LINK '+f);
  equalSet(row.completed_dependencies??[],ops.filter(o=>o.features.includes(f)).flatMap(o=>o.decision_delivery.completed_dependencies??[]),'FEATURE_COMPLETED_DEPENDENCY_LINK '+f);
  assert(row.decision&&row.owner,'FEATURE_TRACE '+f);
  assert.equal(row.acceptance,'pending_feature_acceptance','FALSE_FEATURE_COMPLETION '+f);
  equalSet(row.acceptance_case_ids,x.decision_sprint.acceptance_cases.filter(v=>[...row.dependencies,...(row.completed_dependencies??[])].includes(v.delivery_gap)).map(v=>v.id),'FEATURE_CASE_LINK '+f);
  assert.deepEqual(Object.keys(row.plans).sort(),['business','pro','starter'],'PLAN_MATRIX '+f);
 }
 assert.equal(features.F14.plans.starter,true,'STARTER_F14');
 assert.equal(features.F20.plans.starter,false,'STARTER_F20');
 for(const n of ['attendance_get_v1','attendance_mark_v1','attendance_close_v1','attendance_correct_preview_v1','attendance_correct_apply_v1','attendance_block_v1']){
  equalSet(map.get(n).required_features,['F14'],'STARTER_ATTENDANCE_GATE '+n);
 }
 const ds=x.decision_sprint;
 assert.equal(ds.baseline_operation_count,184,'BASELINE_REGISTRY_COUNT');
 equalSet(ops.filter(o=>!ds.introduced_operations.includes(o.name)).map(o=>o.name),d.OperationName.enum.filter(n=>!ds.introduced_operations.includes(n)),'LEGACY_OPERATION_COVERAGE');
 assert.equal(ops.length,184+ds.introduced_operations.length,'REGISTRY_COUNT');
 for(const n of ds.new_contract_only_operations)assert(!live.has(n),'UNIMPLEMENTED_PROMOTED '+n);
 assert.equal(new Set(ds.acceptance_cases.map(v=>v.id)).size,ds.acceptance_cases.length,'DUPLICATE_ACCEPTANCE_CASE');
 for(const v of ds.acceptance_cases){
  assert.equal(v.evidence_kind,'real_auth_edge_rpc','CASE_EVIDENCE_KIND '+v.id);
  if(v.id==='DS-PLAN-01'){
   assert.equal(v.status,'passed_runtime','FALSE_BEHAVIOR_PASS '+v.id);
   assert.equal(v.evidence.length,3,'FAKE_CASE_EVIDENCE '+v.id);
   for(const e of v.evidence){assert(e.startsWith('tests/starter-attendance-protection.test.mjs#'),'FAKE_CASE_EVIDENCE '+v.id);assert(fs.readFileSync(e.split('#')[0],'utf8').includes(e.split('#')[1]),'MISSING_RUNTIME_CASE '+v.id);}
   for(const n of ['attendance_get_v1','attendance_mark_v1','attendance_close_v1','attendance_correct_preview_v1','attendance_correct_apply_v1'])assert(live.has(n),'FALSE_BEHAVIOR_PASS '+v.id);
  }else if(['DS-PLAN-02','DS-AGR-01','DS-AGR-02','DS-AGR-03','DS-AGR-04','DS-AGR-05'].includes(v.id)){
   assert.equal(v.status,'passed_runtime','FALSE_BEHAVIOR_PASS '+v.id);
   assert(v.evidence.length>0,'FAKE_CASE_EVIDENCE '+v.id);
   for(const e of v.evidence){assert(e.startsWith('tests/instructor-earnings.test.mjs#'),'FAKE_CASE_EVIDENCE '+v.id);assert(fs.readFileSync(e.split('#')[0],'utf8').includes(e.split('#')[1]),'MISSING_RUNTIME_CASE '+v.id);}
   for(const n of ['instructor_agreement_publish_v1','instructor_agreements_list_v1','attendance_start_v1','earnings_list_v1'])assert(live.has(n),'FALSE_BEHAVIOR_PASS '+v.id);
  }else if(v.delivery_gap==='cross_center_settlement'){
   assert.equal(v.status,'passed_runtime','FALSE_BEHAVIOR_PASS '+v.id);
   assert(v.evidence.length>0,'FAKE_CASE_EVIDENCE '+v.id);
   const source=fs.readFileSync('tests/cross-center-settlement.test.mjs','utf8');
   for(const e of v.evidence){assert(e.startsWith('tests/cross-center-settlement.test.mjs#'),'FAKE_CASE_EVIDENCE '+v.id);const title=e.split('#')[1];assert(title&&source.includes("await t.test('"+title+"'"),'MISSING_RUNTIME_CASE '+v.id);}
   for(const n of ['settlement_authority_get_v1','settlement_delegation_set_v1','settlement_authority_set_v1','settlement_movements_list_v1','settlement_requests_list_v1','settlement_request_get_v1','settlement_request_submit_v1','settlement_request_withdraw_v1','settlement_request_decide_v1'])assert(live.has(n),'FALSE_BEHAVIOR_PASS '+v.id);
  }else{
   assert.equal(v.status,'pending_runtime','FALSE_BEHAVIOR_PASS '+v.id);
   assert.equal(v.evidence.length,0,'FAKE_CASE_EVIDENCE '+v.id);
  }
  assert(ds.delivery_gaps.some(g=>g.id===v.delivery_gap),'CASE_GAP_MISSING '+v.id);
 }
 for(const g of ds.delivery_gaps)assert(ds.acceptance_cases.some(v=>v.delivery_gap===g.id),'UNTESTED_DELIVERY_GAP '+g.id);
 for(const o of ops)assert(!JSON.stringify(o.transition).includes('authorized_current_version_or_new_if_create')&&!JSON.stringify(o.transition).includes('operation semantic_guards and input flags'),'GENERIC_LIFECYCLE_PLACEHOLDER '+o.name);
 const requiredTrue=['manager_impact_acknowledgment','preserve_participation_closure_earning','new_booking_uses_current_rules','retain_obligation','no_cancel_notification','independent_conflicts_preserved','relevant_dependency_approval','personal_limit_replaces_default','mandatory_upper_new_transactions','cancel_releases_reserved_deficit'];
 for(const k of requiredTrue)assert.equal(ds.protected_reservations[k],true,'PROTECTION_RULE '+k);
 assert.equal(ds.protected_reservations.cash_mints_credit,false,'CASH_IS_NOT_CREDIT');
 assert.deepEqual(ds.starter_closure,{required_features:['F14'],rights_consumption:true,agreement_required:false,produces_earning:false},'STARTER_CLOSURE');
 for(const n of ['attendance_close_v1','attendance_correct_preview_v1','attendance_correct_apply_v1']){
  const o=map.get(n);assert.equal(o.decision_delivery.runtime_conformance,'starter_and_paid_agreement_runtime','PAID_RUNTIME_CONFORMANCE '+n);
  assert(!o.runtime_limits.some(v=>v.includes('paid F20 engine returns POLICY_NOT_CONFIGURED')),'PAID_RUNTIME_LIMIT '+n);
  if(o.operation_contract.runtime_outcomes)assert.equal(o.operation_contract.runtime_outcomes.pro_business_closure,'explicit_performance_frozen_agreement_rights_earning_audit_outbox_receipt_atomic','PAID_RUNTIME_OUTCOME '+n);
 }
 for(const k of ['immutable_published_terms','explicit_supersedes_chain','reject_independent_overlap','effective_start_inclusive','started_session_pinned','product_identity_override_replaces_general','actual_sale_price','session_fixed_once','source_less_negative_general_snapshot','timed_fixed_offered_with_explicit_amount','variable_components_opt_in'])assert.equal(ds.agreements[k],true,'AGREEMENT_RULE '+k);
 assert.equal(ds.agreements.closed_earning_reprice,false,'HISTORICAL_EARNING_REPRICE');
 assert.equal(ds.agreements.profit_guarantee,false,'PROFIT_GUARANTEE');
 const expectedSettlement={
  credit_basis:'actual_sale_price_per_consumed_credit',earning_agreement:'service_center_actual_instructor_package_override_else_general',
  accrual_trigger:'performed_session_and_right_consumed_or_later_eligible_credit_deficit_settlement',cash_payment_required:false,timed_transfer:false,source_less_negative_initial_transfer:false,late_negative_earning_reprice:false,
  reversal:'linked_original_amount_preserving_prior_payments',rounding:'half_away_from_zero_largest_remainder_stable_tie_original_amount_on_reversal',
  scope_gate:'same_org_business_accessible_centers_and_source_sale_service_center_discipline_scope',dependency_scope:'selected_movement_versions_request_authority_plan',same_account_allowed_with_both_center_authorities:true,
  approval_finalizes_record_and_balances:true,separate_payment_recorder:false,automatic_bank_transfer:false,submit_closes_balance:false,
  fallback_approval:'disabled_no_implicit_owner_or_org_manager_authority',
  offset:'explicit_approved_same_currency_both_sides_atomic_no_auto_net_no_fx',no_double_close:true};
 assert.deepEqual(ds.settlement_rules,expectedSettlement,'SETTLEMENT_RULES');
 assert.deepEqual(Object.fromEntries(Object.entries(d.SettlementRuleSet.properties).map(([k,v])=>[k,v.const])),expectedSettlement,'SETTLEMENT_DTO_RULES');
 for(const n of ['settlement_request_submit_v1','settlement_request_withdraw_v1','settlement_request_decide_v1']){
  const o=map.get(n);equalSet(o.required_features,['F18'],'SETTLEMENT_PLAN');
  for(const g of ['same_org_business_scope','selected_dependencies_only','independent_step_center_authority','no_double_balance_close'])assert(o.semantic_guards.includes(g),'SETTLEMENT_GUARD '+n+' '+g);
 }
 assert.equal(map.get('settlement_request_decide_v1').permission,'settlement.decide','DECISION_AUTHORITY');

 const sale=ds.sale_scope;
 for(const k of ['catalog_new_sales_only','existing_sale_change_reason_preview_protection','manager_backdate_reason_real_created_at','past_consumed_deficits_before_future_reserved'])assert.equal(sale[k],true,'SALE_RULE '+k);
 for(const k of ['backdate_required_to_settle_past_deficit','retro_reservation_attendance_earning','timed_past_extension_carry'])assert.equal(sale[k],false,'SALE_RULE '+k);
 assert.equal(map.get('management_state_get_v1').permission,'management.inspect','MANAGEMENT_READ_AUTHORITY');
 for(const n of ['reservation_impact_preview_v1','reservation_impact_apply_v1']){
  assert.equal(map.get(n).permission,'reservation.protection.manage','PROTECTION_ORIGINAL_AUTHORITY');
  assert(map.get(n).semantic_guards.includes('authorize_original_change_not_generic_center_power'),'PROTECTION_AUTHORITY_GUARD');
 }
 assert.equal(map.get('center_update_v1').operation_contract.version_field,'center_id','CENTER_VERSION_BINDING');
 assert.equal(map.get('crm_activity_save_v1').operation_contract.version_field,'activity_id','ACTIVITY_VERSION_BINDING');
 const centerRead=d.Request_management_state_get.allOf.find(v=>v.if.properties.operation.const==='center_update_v1').then;
 assert(centerRead.required.includes('center_id')&&centerRead.properties.center_id.$ref==='#/$defs/FtkUuid','CENTER_READ_IDENTITY');
 assert(d.Request_crm_activity_save.properties.activity_id?.$ref==='#/$defs/FtkUuid','ACTIVITY_UPDATE_IDENTITY');
 assert(d.ManagementSelector_crm_activity_save_v1.properties.key.properties.activity_id,'ACTIVITY_READ_IDENTITY');
 assert(d.ReservationProtectionChange.oneOf.some(r=>r.$ref==='#/$defs/ValidityProtectionChange'),'VALIDITY_PREVIEW_PATH');
 for(const k of ['sale_id','end_date'])assert(d.ValidityProtectionChange.required.includes(k),'VALIDITY_PREVIEW_BINDING '+k);
 for(const n of ['Target_policy_publish_protected','Request_negative_limit_set','Request_credit_adjust','Request_entitlement_extend'])
  assert(d[n].required.includes('impact_approval')&&d[n].required.includes('accepted_reservation_ids'),'PROTECTED_WRITE_ACK '+n);
 for(const n of ['entitlement_extend_v1','negative_limit_set_v1','credit_adjust_v1','reservation_impact_apply_v1'])
  for(const g of ['exact_preview_change_binding','complete_affected_reservation_acknowledgment','single_preview_consumption_atomic'])
   assert(map.get(n).semantic_guards.includes(g),'PROTECTED_WRITE_BINDING '+n+' '+g);
 const managementNames=ops.filter(o=>!['read','auth','worker'].includes(o.operation_contract.kind)).map(o=>o.name);
 equalSet(d.ManagementOperationName.enum,managementNames,'MANAGEMENT_SELECTOR_COVERAGE');
 equalSet(d.ManagementSelector.oneOf.map(r=>d[r.$ref.split('/').at(-1)].properties.operation.const),managementNames,'MANAGEMENT_KEY_COVERAGE');
 assert(d.Request_management_state_get.required.includes('selector'),'MANAGEMENT_KEY_REQUIRED');
 assert.equal(d.Success_management_state_get.properties.data.$ref,'#/$defs/ManagementStatePage','MANAGEMENT_PAGE_VERSION_READ');

 for(const gap of ds.delivery_gaps){
  const passed=['starter_plan_and_earning_split','agreement_versions_and_selection','cross_center_settlement'].includes(gap.id);
  assert.equal(gap.status,passed?'passed_runtime':'pending_runtime_and_auth_edge_rpc_acceptance','NO_FALSE_DS_ACCEPTANCE '+gap.id);
  assert.equal(gap.acceptance_kind,'real_auth_edge_rpc','WRONG_ACCEPTANCE_KIND');
  if(passed){const cases=ds.acceptance_cases.filter(v=>v.delivery_gap===gap.id);assert(cases.length&&cases.every(v=>v.status==='passed_runtime'),'NO_FALSE_DS_ACCEPTANCE '+gap.id);equalSet(gap.evidence,cases.flatMap(v=>v.evidence),'GAP_EVIDENCE_COVERAGE '+gap.id);}
  else assert.equal(gap.evidence.length,0,'NO_SYNTHETIC_BEHAVIOR_EVIDENCE');
  for(const n of gap.operations)assert(map.has(n)&&[...map.get(n).decision_delivery.open_dependencies,...(map.get(n).decision_delivery.completed_dependencies??[])].includes(gap.id),'GAP_OPERATION_LINK '+n);
 }
 assert(ds.closed_product_choices.some(v=>v.id==='DS-OPEN-01'&&v.status==='accepted_runtime_verified'),'GRANTOR_DECISION_NOT_CLOSED');
 assert(!ds.open_product_choices.some(v=>v.id==='DS-OPEN-01'),'GRANTOR_STILL_OPEN');
 assert(ds.closed_product_choices.some(v=>v.id==='DS-OPEN-02'&&v.status==='accepted_runtime_verified'),'CENTER_SCOPE_DECISION_NOT_CLOSED');
 assert(!ds.open_product_choices.some(v=>v.id==='DS-OPEN-02'),'CENTER_SCOPE_DECISION_STILL_OPEN');
 const chain={delegation_grantor:'organization_owner_only',center_grantor:'organization_owner_or_org_manager_with_live_explicit_delegation',delegation_target:'same_org_active_org_manager',center_target:'same_org_active_center_manager_exact_center',center_manager_delegates:false,role_implies_settlement:false,owner_grant_implies_operations:false,live_check_before_receipt_replay:true,operation_actor:'active_center_manager_with_live_explicit_center_grant',authority_version:'organization_settlement_authority_aggregate',fallback_implies_om_operations:false,account_separation_required:false,initiator_scope:'from_center_id',decision_scope:'frozen_request.to_center_id',audit_step_scope_required:true};
 assert.deepEqual(ds.settlement_authority_chain,chain,'AUTHORITY_CHAIN');
 for(const n of ['settlement_payment_record_v1','settlement_offset_record_v1','settlement_adjust_v1']){
  assert(!map.has(n),'REMOVED_THIRD_STAGE '+n);
  assert(!d['Request_'+n.replace(/_v1$/,'')],'REMOVED_STAGE_DTO '+n);
 }
 assert(!x.permissions['settlement.record'],'REMOVED_RECORDER_PERMISSION');
 assert.equal(d.Request_permission_set.properties.permission.$ref,'#/$defs/Permission','GENERIC_GRANT_ROUTE');
 assert(!d.Permission.enum.some(v=>v.startsWith('settlement.')),'GENERIC_PERMISSION_ESCALATION');
 assert.equal(ds.latest_settlement_decision,'docs/contracts/02-FtkSaaS-teknik-sozlesme.md#hesaplasma','LATEST_SETTLEMENT_DECISION');

 assert.equal(map.get('settlement_delegation_set_v1').permission,'settlement.delegation.manage','OWNER_DELEGATION_PERMISSION');
 assert.equal(map.get('settlement_authority_set_v1').permission,'settlement.authority.manage','CENTER_GRANT_PERMISSION');
 for(const [n,g] of [['settlement_delegation_set_v1','owner_only_delegation_change'],['settlement_authority_set_v1','owner_or_live_delegated_om_only']]){
  const o=map.get(n);assert(live.has(n),'MISSING_AUTHORITY_RUNTIME');
  for(const v of [g,'center_manager_cannot_delegate','live_authority_before_receipt_replay','same_org_target_active_role','expected_org_authority_version','no_implicit_operational_authority'])assert(o.semantic_guards.includes(v),'AUTHORITY_GUARD '+n+' '+v);
  assert.equal(o.operation_contract.read_operation,'settlement_authority_get_v1','AUTHORITY_READ_PATH');
  assert.equal(o.operation_contract.version_field,'org_id','AUTHORITY_VERSION_BINDING');
  for(const e of ['settlement_authority.grant_or_revoke','org_authority.version_increment','audit.append','outbox.append','receipt.append'])assert(o.operation_contract.atomic_effects.includes(e),'AUTHORITY_ATOMIC '+e);
 }
 for(const n of ['settlement_movements_list_v1','settlement_requests_list_v1','settlement_request_get_v1','settlement_request_submit_v1','settlement_request_withdraw_v1','settlement_request_decide_v1']){
  const o=map.get(n);for(const g of ['active_cm_and_explicit_center_grant','live_authority_before_receipt_replay','no_owner_or_om_operational_fallback'])assert(o.semantic_guards.includes(g),'LIVE_CENTER_AUTHORITY '+n+' '+g);
  if(o.operation_contract.kind==='read')assert(d[o.request.$ref.split('/').at(-1)].required.includes('center_id'),'SETTLEMENT_READ_CENTER');
 }
 const auditScopeFields=['actor_account_id','org_id','center_id','permission','manager_role_id','manager_role_version','settlement_grant_version'];
 for(const [name,center,permission] of [
  ['settlement_request_submit_v1','request.from_center_id','settlement.request'],
  ['settlement_request_decide_v1','stored_request.to_center_id','settlement.decide'],
  ['settlement_request_withdraw_v1','stored_request.from_center_id','settlement.request']]){
  const o=map.get(name);
  assert(!o.semantic_guards.includes('no_self_approval'),'RETIRED_ACCOUNT_INEQUALITY '+name);
  for(const g of ['independent_step_center_authority','account_equality_is_not_rejection','server_derived_step_scope_audit'])assert(o.semantic_guards.includes(g),'CENTER_SCOPE_GUARD '+name+' '+g);
  assert.deepEqual(o.authority_binding,{actor:'server_verified_account_id',org:center.startsWith('stored_')?'stored_request.org_id':'request.org_id',center,permission,required_checks:['active_center_manager_at_step','explicit_current_center_grant','live_authority_before_receipt_replay','client_center_selection_is_not_authority'],require_distinct_account:false,audit_scope_fields:auditScopeFields},'STEP_AUTHORITY_BINDING '+name);
 }
 for(const [n,permission] of [['SettlementSubmitAuthority','settlement.request'],['SettlementDecisionAuthority','settlement.decide']]){
  assert.equal(d[n].additionalProperties,false,'AUTHORITY_SNAPSHOT_CLOSED');
  assert.equal(d[n].properties.permission.const,permission,'AUTHORITY_SNAPSHOT_PERMISSION');
  for(const k of ['account_id','person_id','org_id','center_id','manager_role_id','manager_role_version','settlement_grant_version','checked_at'])assert(d[n].required.includes(k),'AUTHORITY_SNAPSHOT_FIELD '+n+' '+k);
 }
 assert.equal(d.SettlementRequestView.properties.initiator_authority.$ref,'#/$defs/SettlementSubmitAuthority','INITIATOR_SCOPE_READ');
 assert(d.SettlementRequestView.required.includes('initiator_authority')&&d.SettlementRequestView.required.includes('decision_authority'),'AUDIT_SCOPE_READ_REQUIRED');
 for(const id of ['DS-SCOPE-01','DS-SCOPE-02','DS-SCOPE-03','DS-SCOPE-04'])assert(ds.acceptance_cases.some(v=>v.id===id&&v.status==='passed_runtime'),'MISSING_CENTER_SCOPE_RUNTIME_CASE '+id);
 const submit=map.get('settlement_request_submit_v1');
 assert.deepEqual(submit.operation_contract.atomic_effects,['settlement_requests.pending_immutable_scope'],'SUBMIT_CLOSES_BALANCE');
 assert.equal(d.Request_settlement_request_submit.properties.proposal.$ref,'#/$defs/SettlementProposal','MISSING_TYPED_PROPOSAL');
 equalSet(d.SettlementProposal.oneOf.map(v=>d[v.$ref.split('/').at(-1)].properties.kind.const),['payment','offset','correction'],'PROPOSAL_KINDS');
 assert(!d.Request_settlement_request_decide.properties.fallback,'UNAUTHORIZED_FALLBACK_INPUT');
 assert(d.SettlementCorrectionProposal.required.includes('allocations'),'CORRECTION_SELECTION_REQUIRED');
 assert.equal(d.SettlementCorrectionProposal.properties.allocations.items.$ref,'#/$defs/SettlementCorrectionAllocation','CORRECTION_SELECTION_TYPED');
 for(const k of ['allocation_id','expected_version','amount_minor'])assert(d.SettlementCorrectionAllocation.required.includes(k),'CORRECTION_ALLOCATION_KEY '+k);
 assert(d.SettlementRecordView.required.includes('allocations'),'CORRECTION_READ_PATH');
 for(const k of ['id','version','movement_id','side','amount_minor','unreversed_minor'])assert(d.SettlementRecordAllocationView.required.includes(k),'CORRECTION_ALLOCATION_READ '+k);

 const decide=map.get('settlement_request_decide_v1');
 assert(decide.semantic_guards.includes('B_approval_finalizes_record_and_balances_atomic'),'B_APPROVAL_NOT_FINAL');
 assert(decide.semantic_guards.includes('rejection_reason_in_app_to_A_balance_unchanged'),'REJECTION_BALANCE_EFFECT');
 assert.deepEqual(decide.operation_contract.effects_by_outcome,{
  approve:['request.approved','settlement_record.append','selected_balances.reduce_or_linked_reverse','paired_offset_atomic','audit.append','outbox.append','receipt.append'],
  reject:['request.rejected_with_reason','in_app_rejection_to_A','audit.append','outbox.append','receipt.append']},'B_APPROVAL_ATOMIC_EFFECTS');
 for(const id of ['DS-AUTH-01','DS-AUTH-02','DS-AUTH-03','DS-SET-13','DS-SET-14'])assert(ds.acceptance_cases.some(v=>v.id===id&&v.status==='passed_runtime'),'MISSING_RUNTIME_AUTH_CASE '+id);

 return {operation_count:ops.length,feature_count:33,callable_count:live.size,decision_behavior_acceptance:'pending',kind:'structural_contract_policy_not_runtime_behavior'};
}


export function validateProductMatrix(p,source=fs.readFileSync('../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md','utf8')){
 const rows=source.split('\n').filter(l=>/^\| F\d{2} \|/.test(l));
 assert.equal(rows.length,33,'PRODUCT_PLAN_MATRIX_ROWS');
 for(const line of rows){
  const [id,name,owner,starter,pro,business]=line.split('|').slice(1,-1).map(v=>v.trim());
  const row=p['x-contract'].feature_delivery[id];assert(row,'PRODUCT_FEATURE_REFERENCE '+id);
  assert.equal(row.name,name,'PRODUCT_FEATURE_NAME '+id);assert.equal(row.owner,owner,'PRODUCT_FEATURE_OWNER '+id);
  const scope={starter,pro,business};
  assert.deepEqual(row.plan_scope,scope,'PRODUCT_PLAN_SCOPE '+id);
  assert.deepEqual(row.plans,Object.fromEntries(Object.entries(scope).map(([k,v])=>[k,v!=='—'])),'PRODUCT_PLAN_ACCESS '+id);
 }
 return rows.length;
}
export function validateSettlementLivingDocs(p,sources){
 const paths=['../../docs/contracts/02-FtkSaaS-teknik-sozlesme.md'];
 for(const path of paths){
  const source=sources?.[path]??fs.readFileSync(path,'utf8');
  const start=source.lastIndexOf('## Son hesaplaşma revizyonu');
  assert(start>=0,'LIVING_SETTLEMENT_SECTION '+path);
  const current=source.slice(start);
  assert(/DS-OPEN-02[^.\\n]*karar düzeyinde kapalı/.test(current),'LIVING_CENTER_SCOPE_CLOSURE '+path);
  assert(current.includes(p['x-contract'].decision_sprint.acceptance_cases.length+' gerçek kabul senaryosu'),'LIVING_ACCEPTANCE_COUNT '+path);
  assert(!/Self-approval ve çift kapama yasaktır|Farklı açık yetkili B CM/.test(current),'LIVING_RETIRED_ACCOUNT_RULE '+path);
 }
 return paths.length;
}
export function validateAppliedGates(p,live,sql=fs.readdirSync('supabase/migrations').sort().map(n=>fs.readFileSync('supabase/migrations/'+n,'utf8')).join('\n')){
 const actual=new Map();
 const rx=/insert into private\.runtime_operations\(name,permission,billing_class,features\) values\('([^']+)','([^']+)','([^']+)',array\[([^\]]*)\]::text\[\]\)/g;
 for(const m of sql.matchAll(rx))actual.set(m[1],{permission:m[2],billing:m[3],features:[...m[4].matchAll(/'([^']+)'/g)].map(v=>v[1])});
 for(const o of p['x-contract'].operations.filter(o=>live.includes(o.name))){
  const a=actual.get(o.name);assert(a,'MISSING_APPLIED_OPERATION '+o.name);
  assert.equal(a.permission,o.permission,'APPLIED_PERMISSION_DRIFT '+o.name);
  assert.equal(a.billing,o.billing_class,'APPLIED_BILLING_DRIFT '+o.name);
  equalSet(a.features,o.runtime_required_features,'APPLIED_FEATURE_GATE_DRIFT '+o.name);
 }

 return live.length;
}
if(process.argv[1]?.endsWith('/governance.mjs')){
 const p=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
 const live=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/implemented.json')).operations;
 const result=validateGovernance(p,live);
 validateAppliedGates(p,live);
 validateProductMatrix(p);
 validateSettlementLivingDocs(p);
 console.log(JSON.stringify({...result,applied_runtime_gates_verified:live.length}));
}
