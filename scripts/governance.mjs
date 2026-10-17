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
 const allowedKinds=['read','preview','draft','closure','correction','apply','auth','worker','command'];
 for(const o of ops){
  const q=d[o.request.$ref.split('/').at(-1)],k=o.operation_contract;
  assert(x.permissions[o.permission],'UNKNOWN_PERMISSION '+o.name);
  assert(d[o.success.$ref.split('/').at(-1)],'UNKNOWN_SUCCESS '+o.name);
  assert(k&&allowedKinds.includes(k.kind),'OP_PHASE '+o.name);
  if(!['public_calendar_get_v1','public_application_submit_v1','account_password_reset_request_v1'].includes(o.name))assert(o.semantic_guards.includes('live_actor_and_scope'),'MISSING_LIVE_SCOPE '+o.name);
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
   assert.equal(k.read_path_status,live.has(read.name)?'implemented':'contract_only','FALSE_READ_AVAILABILITY '+o.name);
   if(k.version_mode==='row_version')assert(props.expected_version&&q.required.includes('expected_version'),'MISSING_ROW_VERSION '+o.name);
   if(k.version_mode==='create_absent_update_requires_version')assert(props.expected_version,'MISSING_OPTIONAL_VERSION '+o.name);
   if(k.version_field)assert(props[k.version_field]||['account_id','org_id','center_id'].includes(k.version_field),'VERSION_FIELD_NOT_READABLE '+o.name);
   if(k.version_mode==='preview_dependencies')assert(k.kind==='preview'||props.preview,'MISSING_PREVIEW_TOKEN '+o.name);
  }
 }
 for(const f of Object.keys(features)){
  const row=features[f];equalSet(row.technical_operations,ops.filter(o=>o.features.includes(f)).map(o=>o.name),'FEATURE_OPERATION_LINK '+f);
  equalSet(row.dependencies,ops.filter(o=>o.features.includes(f)).flatMap(o=>o.decision_delivery.open_dependencies),'FEATURE_DEPENDENCY_LINK '+f);
  assert(row.decision&&row.owner,'FEATURE_TRACE '+f);
  assert.equal(row.acceptance,'pending_feature_acceptance','FALSE_FEATURE_COMPLETION '+f);
  equalSet(row.acceptance_case_ids,x.decision_sprint.acceptance_cases.filter(v=>row.dependencies.includes(v.delivery_gap)).map(v=>v.id),'FEATURE_CASE_LINK '+f);
  assert.deepEqual(Object.keys(row.plans).sort(),['business','pro','starter'],'PLAN_MATRIX '+f);
 }
 assert.equal(features.F14.plans.starter,true,'STARTER_F14');
 assert.equal(features.F20.plans.starter,false,'STARTER_F20');
 for(const n of ['attendance_get_v1','attendance_mark_v1','attendance_close_v1','attendance_correct_preview_v1','attendance_correct_apply_v1','attendance_block_v1']){
  equalSet(map.get(n).required_features,['F14'],'STARTER_ATTENDANCE_GATE '+n);
 }
 const ds=x.decision_sprint;
 assert.equal(ds.baseline_operation_count,184,'BASELINE_REGISTRY_COUNT');
 equalSet(ops.filter(o=>!ds.new_contract_only_operations.includes(o.name)).map(o=>o.name),d.OperationName.enum.filter(n=>!ds.new_contract_only_operations.includes(n)),'LEGACY_OPERATION_COVERAGE');
 assert.equal(ops.length,184+ds.new_contract_only_operations.length,'REGISTRY_COUNT');
 for(const n of ds.new_contract_only_operations)assert(!live.has(n),'UNIMPLEMENTED_PROMOTED '+n);
 assert.equal(new Set(ds.acceptance_cases.map(v=>v.id)).size,ds.acceptance_cases.length,'DUPLICATE_ACCEPTANCE_CASE');
 for(const v of ds.acceptance_cases){
  assert.equal(v.status,'pending_runtime','FALSE_BEHAVIOR_PASS '+v.id);
  assert.equal(v.evidence_kind,'real_auth_edge_rpc','CASE_EVIDENCE_KIND '+v.id);
  assert.equal(v.evidence.length,0,'FAKE_CASE_EVIDENCE '+v.id);
  assert(ds.delivery_gaps.some(g=>g.id===v.delivery_gap),'CASE_GAP_MISSING '+v.id);
 }
 for(const g of ds.delivery_gaps)assert(ds.acceptance_cases.some(v=>v.delivery_gap===g.id),'UNTESTED_DELIVERY_GAP '+g.id);
 for(const o of ops)assert(!JSON.stringify(o.transition).includes('authorized_current_version_or_new_if_create')&&!JSON.stringify(o.transition).includes('operation semantic_guards and input flags'),'GENERIC_LIFECYCLE_PLACEHOLDER '+o.name);
 const requiredTrue=['manager_impact_acknowledgment','preserve_participation_closure_earning','new_booking_uses_current_rules','retain_obligation','no_cancel_notification','independent_conflicts_preserved','relevant_dependency_approval','personal_limit_replaces_default','mandatory_upper_new_transactions','cancel_releases_reserved_deficit'];
 for(const k of requiredTrue)assert.equal(ds.protected_reservations[k],true,'PROTECTION_RULE '+k);
 assert.equal(ds.protected_reservations.cash_mints_credit,false,'CASH_IS_NOT_CREDIT');
 assert.deepEqual(ds.starter_closure,{required_features:['F14'],rights_consumption:true,agreement_required:false,produces_earning:false},'STARTER_CLOSURE');
 for(const k of ['immutable_published_terms','explicit_supersedes_chain','reject_independent_overlap','effective_start_inclusive','started_session_pinned','product_identity_override_replaces_general','actual_sale_price','session_fixed_once','source_less_negative_general_snapshot','timed_fixed_offered_with_explicit_amount','variable_components_opt_in'])assert.equal(ds.agreements[k],true,'AGREEMENT_RULE '+k);
 assert.equal(ds.agreements.closed_earning_reprice,false,'HISTORICAL_EARNING_REPRICE');
 assert.equal(ds.agreements.profit_guarantee,false,'PROFIT_GUARANTEE');
 const expectedSettlement={
  credit_basis:'actual_sale_price_per_consumed_credit',earning_agreement:'service_center_actual_instructor_package_override_else_general',
  accrual_trigger:'performed_session_and_right_consumed_or_later_eligible_credit_deficit_settlement',cash_payment_required:false,timed_transfer:false,source_less_negative_initial_transfer:false,late_negative_earning_reprice:false,
  reversal:'linked_original_amount_preserving_prior_payments',rounding:'half_away_from_zero_largest_remainder_stable_tie_original_amount_on_reversal',
  scope_gate:'same_org_business_accessible_centers_and_source_sale_service_center_discipline_scope',dependency_scope:'selected_movement_versions_request_authority_plan',self_approval:false,approval_is_payment:false,
  payment_recorder:'org_manager_with_separate_settlement_permission',fallback_approval:'different_authorized_org_manager_only_if_no_other_B_manager_with_reason',
  offset:'explicit_approved_same_currency_both_sides_atomic_no_auto_net_no_fx',no_double_close:true};
 assert.deepEqual(ds.settlement_rules,expectedSettlement,'SETTLEMENT_RULES');
 assert.deepEqual(Object.fromEntries(Object.entries(d.SettlementRuleSet.properties).map(([k,v])=>[k,v.const])),expectedSettlement,'SETTLEMENT_DTO_RULES');
 for(const n of ['settlement_request_submit_v1','settlement_request_withdraw_v1','settlement_request_decide_v1','settlement_payment_record_v1','settlement_offset_record_v1','settlement_adjust_v1']){
  const o=map.get(n);equalSet(o.required_features,['F18'],'SETTLEMENT_PLAN');
  for(const g of ['same_org_business_scope','selected_dependencies_only','no_self_approval','no_double_balance_close'])assert(o.semantic_guards.includes(g),'SETTLEMENT_GUARD '+n+' '+g);
 }
 assert.equal(map.get('settlement_request_decide_v1').permission,'settlement.decide','DECISION_AUTHORITY');
 for(const n of ['settlement_payment_record_v1','settlement_offset_record_v1','settlement_adjust_v1'])assert.equal(map.get(n).permission,'settlement.record','PAYMENT_AUTHORITY');
 const sale=ds.sale_scope;
 for(const k of ['catalog_new_sales_only','existing_sale_change_reason_preview_protection','manager_backdate_reason_real_created_at','past_consumed_deficits_before_future_reserved'])assert.equal(sale[k],true,'SALE_RULE '+k);
 for(const k of ['backdate_required_to_settle_past_deficit','retro_reservation_attendance_earning','timed_past_extension_carry'])assert.equal(sale[k],false,'SALE_RULE '+k);
 assert.equal(map.get('management_state_get_v1').permission,'management.inspect','MANAGEMENT_READ_AUTHORITY');
 for(const n of ['reservation_impact_preview_v1','reservation_impact_apply_v1']){
  assert.equal(map.get(n).permission,'reservation.protection.manage','PROTECTION_ORIGINAL_AUTHORITY');
  assert(map.get(n).semantic_guards.includes('authorize_original_change_not_generic_center_power'),'PROTECTION_AUTHORITY_GUARD');
 }
 const managementNames=ops.filter(o=>!['read','auth','worker'].includes(o.operation_contract.kind)).map(o=>o.name);
 equalSet(d.ManagementOperationName.enum,managementNames,'MANAGEMENT_SELECTOR_COVERAGE');
 equalSet(d.ManagementSelector.oneOf.map(r=>d[r.$ref.split('/').at(-1)].properties.operation.const),managementNames,'MANAGEMENT_KEY_COVERAGE');
 assert(d.Request_management_state_get.required.includes('selector'),'MANAGEMENT_KEY_REQUIRED');
 assert.equal(d.Success_management_state_get.properties.data.$ref,'#/$defs/ManagementStatePage','MANAGEMENT_PAGE_VERSION_READ');

 for(const gap of ds.delivery_gaps){
  assert.equal(gap.status,'pending_runtime_and_auth_edge_rpc_acceptance','NO_FALSE_DS_ACCEPTANCE '+gap.id);
  assert.equal(gap.acceptance_kind,'real_auth_edge_rpc','WRONG_ACCEPTANCE_KIND');
  assert.equal(gap.evidence.length,0,'NO_SYNTHETIC_BEHAVIOR_EVIDENCE');
  for(const n of gap.operations)assert(map.has(n)&&map.get(n).decision_delivery.open_dependencies.includes(gap.id),'GAP_OPERATION_LINK '+n);
 }
 assert(ds.open_product_choices.some(v=>v.id==='DS-OPEN-01'),'UNRESOLVED_GRANTOR_HIDDEN');
 return {operation_count:ops.length,feature_count:33,callable_count:live.size,decision_behavior_acceptance:'pending',kind:'structural_contract_policy_not_runtime_behavior'};
}


export function validateProductMatrix(p,source=fs.readFileSync('contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md','utf8')){
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
 const p=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));
 const live=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/implemented.json')).operations;
 const result=validateGovernance(p,live);
 validateAppliedGates(p,live);
 validateProductMatrix(p);
 console.log(JSON.stringify({...result,applied_runtime_gates_verified:live.length}));
}
