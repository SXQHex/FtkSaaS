import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {validateGovernance,validateAppliedGates,validateProductMatrix,validateSettlementLivingDocs} from '../scripts/governance.mjs';
import {newUuidV7} from '../scripts/uuid.mjs';

const original=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
const live=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/implemented.json')).operations;
const op=(p,n)=>p['x-contract'].operations.find(o=>o.name===n);
const ds=p=>p['x-contract'].decision_sprint;
test('contract governance validates current target, not future runtime behavior',()=>assert.equal(validateGovernance(original,live).decision_behavior_acceptance,'pending'));
const mutations=[
 ['paid closure advertises unavailable after runtime acceptance',p=>op(p,'attendance_close_v1').operation_contract.runtime_outcomes.pro_business_closure='POLICY_NOT_CONFIGURED_before_domain_mutation'],
 ['paid correction still claims Starter-only conformance',p=>op(p,'attendance_correct_apply_v1').decision_delivery.runtime_conformance='starter_runtime_limited_paid_path_pending'],
 ['missing operation enum name',p=>p.$defs.OperationName.enum.pop()],
 ['duplicate operation enum name',p=>p.$defs.OperationName.enum.push(p.$defs.OperationName.enum[0])],
 ['status accepts free operation text',p=>p.$defs.Request_operation_status_get.properties.operation={$ref:'#/$defs/Text'}],
 ['audit accepts free action text',p=>p.$defs.AuditView.properties.action={$ref:'#/$defs/Text'}],
 ['unknown operation permission',p=>op(p,'attendance_close_v1').permission='invented.permission'],
 ['Starter F14 removed',p=>p['x-contract'].feature_delivery.F14.plans.starter=false],
 ['Starter F20 incorrectly enabled',p=>p['x-contract'].feature_delivery.F20.plans.starter=true],
 ['Starter close requires F20',p=>op(p,'attendance_close_v1').required_features.push('F20')],
 ['read runs closure preconditions',p=>op(p,'attendance_get_v1').semantic_guards.push('all_non_cancelled_results_complete')],
 ['read advertises ledger mutation',p=>op(p,'calendar_get_v1').operation_contract.atomic_effects=['rights.consume']],
 ['preview advertises business commit',p=>op(p,'program_preview_v1').operation_contract.business_commit=true],
 ['draft consumes rights',p=>op(p,'attendance_mark_v1').operation_contract.atomic_effects.push('rights.consume')],
 ['closure lacks rights effects',p=>op(p,'attendance_close_v1').operation_contract.atomic_effects=[]],
 ['write lacks current-state reader',p=>op(p,'negative_limit_set_v1').operation_contract.read_operation='missing_get_v1'],
 ['row version points at unknown input',p=>op(p,'session_capacity_set_v1').operation_contract.version_field='invented_id'],
 ['current-state read falsely claimed live',p=>{op(p,'management_state_get_v1').runtime_selectors=op(p,'management_state_get_v1').runtime_selectors.filter(n=>n!=='account_delete_preview_v1');op(p,'account_delete_preview_v1').operation_contract.read_path_status='implemented';}],
 ['unknown feature reference',p=>op(p,'sale_apply_v1').features.push('F99')],
 ['missing F33 trace',p=>delete p['x-contract'].feature_delivery.F33],
 ['operation count treated as feature completion',p=>p['x-contract'].feature_delivery.F14.acceptance='complete'],
 ['protected reservation blocked at closure',p=>ds(p).protected_reservations.preserve_participation_closure_earning=false],
 ['preserved obligation wiped',p=>ds(p).protected_reservations.retain_obligation=false],
 ['independent conflict bypassed',p=>ds(p).protected_reservations.independent_conflicts_preserved=false],
 ['cash mints credit',p=>ds(p).protected_reservations.cash_mints_credit=true],
 ['closed earnings repriced',p=>ds(p).agreements.closed_earning_reprice=true],
 ['package override adds instead of replaces',p=>ds(p).agreements.product_identity_override_replaces_general=false],
 ['session fixed counted repeatedly',p=>ds(p).agreements.session_fixed_once=false],
 ['effective boundary excludes equality',p=>ds(p).agreements.effective_start_inclusive=false],
 ['started agreement mutable',p=>ds(p).agreements.started_session_pinned=false],
 ['settlement waits for collection',p=>ds(p).settlement_rules.cash_payment_required=true],
 ['timed package transfers price',p=>ds(p).settlement_rules.timed_transfer=true],
 ['late deficit settlement reprices teacher',p=>ds(p).settlement_rules.late_negative_earning_reprice=true],
 ['same-account authorization incorrectly prohibited',p=>ds(p).settlement_rules.same_account_allowed_with_both_center_authorities=false],
 ['B approval fails to finalize balances',p=>ds(p).settlement_rules.approval_finalizes_record_and_balances=false],
 ['unrelated lessons stale settlement approval',p=>ds(p).settlement_rules.dependency_scope='whole_org_hash'],
 ['offset loses paired atomicity',p=>ds(p).settlement_rules.offset='one_side_first'],
 ['payment allowed by ordinary center role',p=>op(p,'settlement_request_decide_v1').permission='center.manage'],
 ['old sale scope silently follows catalog',p=>ds(p).sale_scope.catalog_new_sales_only=false],
 ['backdate creates past attendance',p=>ds(p).sale_scope.retro_reservation_attendance_earning=true],
 ['missing runtime declared accepted',p=>ds(p).delivery_gaps[0].status='passed'],
 ['contract test offered as behavior evidence',p=>ds(p).delivery_gaps[0].evidence=['tests/governance.test.mjs']],
 ['incompatible OM fallback silently restored',p=>ds(p).settlement_rules.fallback_approval='org_manager_override']
];
for(const [name,mutate] of mutations)test('contract mutation rejected: '+name,()=>{const p=structuredClone(original);mutate(p);assert.throws(()=>validateGovernance(p,live));});
const a=new Ajv({strict:false,allErrors:true});addFormats(a);a.addSchema(original,'contract');
const valid=(n,v)=>a.getSchema('contract#/$defs/'+n)(v);
const id=newUuidV7(),other=newUuidV7();
test('typed OperationName accepts all registered API names and rejects unsuffixed/unknown values',()=>{
 for(const o of original['x-contract'].operations)assert(valid('OperationName',o.name));
 assert(!valid('OperationName','attendance_close'));assert(!valid('OperationName','unknown_v1'));
});
test('agreement replacement DTO requires an explicit predecessor version, creation does not',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,person_id:id,discipline_id:id,format:'group',valid:{starts_at:'2027-01-01T00:00:00Z',ends_at:'2027-02-01T00:00:00Z'},reason:'Explicit new terms',terms:{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}}};
 assert(valid('Request_instructor_agreement_publish',r));
 assert(!valid('Request_instructor_agreement_publish',{...r,expected_version:1}));
 assert(!valid('Request_instructor_agreement_publish',{...r,supersedes_id:other}));
 assert(valid('Request_instructor_agreement_publish',{...r,supersedes_id:other,expected_version:1}));
});
test('impact apply DTO requires explicit affected-reservation acknowledgment and server preview token',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,preview:{id,token:'opaque-preview-token'},accepted_reservation_ids:[id]};
 assert(valid('Request_reservation_impact_apply',r));
 assert(!valid('Request_reservation_impact_apply',{...r,accepted_reservation_ids:[id,id]}));
 const {accepted_reservation_ids,...missing}=r;assert(!valid('Request_reservation_impact_apply',missing));
 assert(!valid('Request_reservation_impact_apply',{...r,actor_role:'owner'}));
});
test('B decision is a closed DTO; frozen proposal cannot be replaced by approval payload',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,operation_key:id,settlement_request_id:id,expected_version:1,decision:'reject',reason:'Wrong selected scope'};
 assert(valid('Request_settlement_request_decide',r));
 assert(!valid('Request_settlement_request_decide',{...r,decision:'paid'}));
 assert(!valid('Request_settlement_request_decide',{...r,amount_minor:'100'}));
 assert(!valid('Request_settlement_request_decide',{...r,fallback:true}));
 const {expected_version,...missing}=r;assert(!valid('Request_settlement_request_decide',missing));
});

test('declared runtime gates must match actually applied migration SQL, not target references',()=>{
 const p=structuredClone(original);
 assert.equal(validateAppliedGates(p,live),live.length);
 op(p,'class_save_v1').runtime_required_features=['F10','F11'];
 assert.throws(()=>validateAppliedGates(p,live),/APPLIED_FEATURE_GATE_DRIFT/);
});
test('a pending behavior case cannot be relabeled passed or supplied a static-test receipt',()=>{
 const p=structuredClone(original);ds(p).acceptance_cases[0].status='passed';assert.throws(()=>validateGovernance(p,live),/FALSE_BEHAVIOR_PASS/);
 const q=structuredClone(original);ds(q).acceptance_cases[0].evidence=['tests/governance.test.mjs'];assert.throws(()=>validateGovernance(q,live),/FAKE_CASE_EVIDENCE/);
});

test('living product plan matrix must match the machine trace, including qualitative access scope',()=>{
 const source=fs.readFileSync('../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md','utf8');
 assert.equal(validateProductMatrix(original,source),33);
 const bad=source.replace(/(\| F14 \|[^\n]*?\| M05 \|) Var \|/,'$1 — |');
 assert.notEqual(source,bad);assert.throws(()=>validateProductMatrix(original,bad),/PRODUCT_PLAN_SCOPE|PRODUCT_PLAN_ACCESS/);
});

test('management read DTO carries the actual composite row key and cannot select a different write authority',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation:'class_assignment_set_v1',selector:{operation:'class_assignment_set_v1',key:{class_id:id,person_id:other,duty:'assistant'}}};
 assert(valid('Request_management_state_get',r));
 assert(!valid('Request_management_state_get',{...r,selector:{operation:'class_assignment_set_v1',key:{class_id:id,person_id:other}}}));
 assert(!valid('Request_management_state_get',{...r,selector:{operation:'permission_set_v1',key:{person_id:other,permission:'reservation.write'}}}));
});
test('protection routing cannot turn a center entitlement permission into org policy authority',()=>{
 const p=structuredClone(original);op(p,'reservation_impact_apply_v1').permission='entitlement.correct';
 assert.throws(()=>validateGovernance(p,live),/PROTECTION_ORIGINAL_AUTHORITY/);
});

test('live policy accepts only a paired impact token and acknowledgment; protected target requires both',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,operation_key:id,key:'negative_default',value:{kind:'integer',value:2},effective_at:'2027-01-01T00:00:00Z',mandatory:true};
 assert(valid('Request_policy_publish',r));
 assert(valid('Request_policy_publish',{...r,impact_approval:{id,token:'opaque-token-value'},accepted_reservation_ids:[]}));
 assert(!valid('Request_policy_publish',{...r,impact_approval:{id,token:'opaque-token-value'}}));
 assert(!valid('Target_policy_publish_protected',r));
 assert(valid('Target_policy_publish_protected',{...r,impact_approval:{id,token:'opaque-token-value'},accepted_reservation_ids:[]}));
});
test('minimal runtime catalog has no dangling target or request/response reference',()=>{
 const runtime=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/contract.json'));
 const walk=v=>{if(v&&typeof v==='object'){if(v.$ref)assert(runtime.$defs[v.$ref.split('/').at(-1)],v.$ref);for(const w of Object.values(v))walk(w);}};
 walk(runtime);
});

test('center read requires a concrete center identity and metadata binds its row version',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation:'center_update_v1',selector:{operation:'center_update_v1',key:{}}};
 assert(valid('Request_management_state_get',r));
 const {center_id,...missing}=r;assert(!valid('Request_management_state_get',missing));
 assert(!valid('Request_management_state_get',{...r,center_id:null}));
 const p=structuredClone(original);op(p,'center_update_v1').operation_contract.version_field='org_id';
 assert.throws(()=>validateGovernance(p,live),/CENTER_VERSION_BINDING/);
});
test('CRM update selects the activity row, creation never silently upserts',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,operation_key:id,lead_id:id,kind:original.$defs.CrmActivityKind.enum[0]};
 assert(valid('Request_crm_activity_save',r));
 assert(!valid('Request_crm_activity_save',{...r,expected_version:1}));
 assert(!valid('Request_crm_activity_save',{...r,activity_id:other}));
 assert(valid('Request_crm_activity_save',{...r,activity_id:other,expected_version:1}));
 const p=structuredClone(original);op(p,'crm_activity_save_v1').operation_contract.version_field='lead_id';
 assert.throws(()=>validateGovernance(p,live),/ACTIVITY_VERSION_BINDING/);
});
test('validity change has a typed sale/end-date preview and explicit affected-reservation acknowledgment',()=>{
 const change={kind:'entitlement_extend',sale_id:id,end_date:'2027-02-01'};
 assert(valid('ReservationProtectionChange',change));
 const {end_date,...missing}=change;assert(!valid('ReservationProtectionChange',missing));
 const r={client_api_version:1,request_id:id,org_id:id,operation_key:id,expected_version:1,sale_id:id,end_date:change.end_date,reason:'Correct validity',impact_approval:{id,token:'opaque-preview-token'},accepted_reservation_ids:[]};
 assert(valid('Request_entitlement_extend',r));
 const {accepted_reservation_ids,...noAck}=r;assert(!valid('Request_entitlement_extend',noAck));
 const p=structuredClone(original);p.$defs.ReservationProtectionChange.oneOf=p.$defs.ReservationProtectionChange.oneOf.filter(v=>v.$ref!=='#/$defs/ValidityProtectionChange');
 assert.throws(()=>validateGovernance(p,live),/VALIDITY_PREVIEW_PATH/);
});

const authorityMutations=[
 ['OM role substitutes for delegation',p=>ds(p).settlement_authority_chain.center_grantor='org_manager_role'],
 ['CM may delegate',p=>ds(p).settlement_authority_chain.center_manager_delegates=true],
 ['Owner grant implies operations',p=>ds(p).settlement_authority_chain.owner_grant_implies_operations=true],
 ['old session bypasses live grant',p=>op(p,'settlement_request_submit_v1').semantic_guards=op(p,'settlement_request_submit_v1').semantic_guards.filter(g=>g!=='live_authority_before_receipt_replay')],
 ['B approval omits receipt atomicity',p=>op(p,'settlement_request_decide_v1').operation_contract.effects_by_outcome.approve.pop()],
 ['reject closes balances',p=>op(p,'settlement_request_decide_v1').operation_contract.effects_by_outcome.reject.push('selected_balances.reduce')],
 ['submission closes balance',p=>op(p,'settlement_request_submit_v1').operation_contract.atomic_effects.push('selected_balances.reduce')],
 ['grant uses unrelated entity version',p=>op(p,'settlement_authority_set_v1').operation_contract.version_field='person_id'],
 ['grantor decision still open',p=>ds(p).closed_product_choices=[]],
 ['third-stage operation restored',p=>{const o=structuredClone(op(p,'settlement_request_decide_v1'));o.name='settlement_payment_record_v1';p['x-contract'].operations.push(o);p.$defs.OperationName.enum.push(o.name);}],
 ['center-scope decision reopening hidden',p=>ds(p).closed_product_choices=ds(p).closed_product_choices.filter(v=>v.id!=='DS-OPEN-02')]
];
for(const [name,mutate] of authorityMutations)test('settlement revision mutation rejected: '+name,()=>{const p=structuredClone(original);mutate(p);assert.throws(()=>validateGovernance(p,live));});
test('settlement proposal DTO freezes actual payment, explicit paired offset or linked correction, never recorder actor',()=>{
 const line={movement_id:id,expected_version:1,amount_minor:'100'};
 const r={client_api_version:1,request_id:id,org_id:id,operation_key:id,from_center_id:id,to_center_id:other,currency:'TRY',reason:'Actual payment reported',proposal:{kind:'payment',lines:[line],amount_minor:'100',occurred_at:'2026-10-17T10:00:00Z'}};
 assert(valid('Request_settlement_request_submit',r));
 assert(!valid('Request_settlement_request_submit',{...r,proposal:{kind:'payment',lines:[line],amount_minor:'100'}}));
 assert(valid('Request_settlement_request_submit',{...r,proposal:{kind:'offset',debit_lines:[line],credit_lines:[{...line,movement_id:other}],amount_minor:'100'}}));
 assert(!valid('Request_settlement_request_submit',{...r,proposal:{kind:'offset',debit_lines:[line],amount_minor:'100'}}));
 assert(valid('Request_settlement_request_submit',{...r,proposal:{kind:'correction',original_record_id:id,expected_version:1,amount_minor:'100',allocations:[{allocation_id:id,expected_version:1,amount_minor:'100'}]}}));
 assert(!valid('Request_settlement_request_submit',{...r,recorder_role:'org_manager'}));
 assert(!valid('Request_settlement_request_submit',{...r,previous_id:other}));
 assert(valid('Request_settlement_request_submit',{...r,previous_id:other,previous_version:1}));
});
test('authority writes have scoped target, current aggregate version and reason; client cannot claim grantor role',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,operation_key:id,person_id:other,expected_version:1,granted:true,reason:'Approved authority'};
 assert(valid('Request_settlement_delegation_set',r));
 assert(!valid('Request_settlement_authority_set',r));
 assert(valid('Request_settlement_authority_set',{...r,center_id:id}));
 assert(!valid('Request_settlement_authority_set',{...r,center_id:id,actor_role:'owner'}));
 const {expected_version,...missing}=r;assert(!valid('Request_settlement_delegation_set',missing));
});

test('generic permission_set cannot provision reserved settlement authority or operational permissions',()=>{
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,expected_version:1,person_id:other,enabled:true};
 for(const permission of ['settlement.authority.manage','settlement.delegation.manage','settlement.request','settlement.decide','settlement.read'])assert(!valid('Request_permission_set',{...r,permission}));
 const p=structuredClone(original);p.$defs.Permission.enum.push('settlement.authority.manage');assert.throws(()=>validateGovernance(p,live),/GENERIC_PERMISSION_ESCALATION/);
});

test('partial correction names exact original allocations and exposes their reversible versioned scope',()=>{
 const r={kind:'correction',original_record_id:id,expected_version:1,amount_minor:'100',allocations:[{allocation_id:other,expected_version:1,amount_minor:'100'}]};
 assert(valid('SettlementCorrectionProposal',r));
 const {allocations,...missing}=r;assert(!valid('SettlementCorrectionProposal',missing));
 assert(!valid('SettlementCorrectionProposal',{...r,allocations:[{allocation_id:other,amount_minor:'100'}]}));
 const p=structuredClone(original);p.$defs.SettlementCorrectionProposal.required=p.$defs.SettlementCorrectionProposal.required.filter(k=>k!=='allocations');
 assert.throws(()=>validateGovernance(p,live),/CORRECTION_SELECTION_REQUIRED/);
 const q=structuredClone(original);q.$defs.SettlementRecordAllocationView.required=q.$defs.SettlementRecordAllocationView.required.filter(k=>k!=='unreversed_minor');
 assert.throws(()=>validateGovernance(q,live),/CORRECTION_ALLOCATION_READ/);
});

const centerScopeMutations=[
 ['B authority replaced by A',p=>op(p,'settlement_request_decide_v1').authority_binding.center='stored_request.from_center_id'],
 ['client center replaces stored B',p=>op(p,'settlement_request_decide_v1').authority_binding.center='request.center_id'],
 ['different account required',p=>op(p,'settlement_request_decide_v1').authority_binding.require_distinct_account=true],
 ['old self approval guard restored',p=>op(p,'settlement_request_decide_v1').semantic_guards.push('no_self_approval')],
 ['B role check skipped',p=>op(p,'settlement_request_decide_v1').authority_binding.required_checks=op(p,'settlement_request_decide_v1').authority_binding.required_checks.filter(v=>v!=='active_center_manager_at_step')],
 ['B grant check skipped',p=>op(p,'settlement_request_decide_v1').authority_binding.required_checks=op(p,'settlement_request_decide_v1').authority_binding.required_checks.filter(v=>v!=='explicit_current_center_grant')],
 ['scope audit omitted',p=>op(p,'settlement_request_decide_v1').authority_binding.audit_scope_fields=[]],
 ['revoked B authority bypasses receipt',p=>op(p,'settlement_request_decide_v1').semantic_guards=op(p,'settlement_request_decide_v1').semantic_guards.filter(v=>v!=='live_authority_before_receipt_replay')]
];
for(const [name,mutate]of centerScopeMutations)test('center-scope contract mutation rejected: '+name,()=>{const p=structuredClone(original);mutate(p);assert.throws(()=>validateGovernance(p,live));});
test('typed settlement projection permits equal accounts with separate server-derived A and B scope evidence (not runtime authorization)',()=>{
 const scope={account_id:id,person_id:id,org_id:id,manager_role_id:id,manager_role_version:1,settlement_grant_version:1,checked_at:'2026-10-17T12:00:00Z'};
 const line={movement_id:id,expected_version:1,amount_minor:'100'};
 const record={id,version:1,request_id:id,kind:'payment',amount_minor:'100',currency:'TRY',approved_by_account_id:id,original_record_id:null,created_at:scope.checked_at,allocations:[{id,version:1,movement_id:id,side:'payment',amount_minor:'100',unreversed_minor:'100'}]};
 const r={id,version:1,from_center_id:id,to_center_id:other,currency:'TRY',state:'approved',initiator_account_id:id,decision_account_id:id,reason:'B received payment',previous_id:null,proposal:{kind:'payment',lines:[line],amount_minor:'100',occurred_at:scope.checked_at},record,initiator_authority:{...scope,center_id:id,permission:'settlement.request'},decision_authority:{...scope,center_id:other,permission:'settlement.decide'}};
 assert(valid('SettlementRequestView',r));
 assert(!valid('SettlementRequestView',{...r,decision_authority:null}));
 const {initiator_authority,...missing}=r;assert(!valid('SettlementRequestView',missing));
 const q={client_api_version:1,request_id:id,org_id:id,operation_key:id,settlement_request_id:id,expected_version:1,decision:'approve',reason:'B received'};
 assert(valid('Request_settlement_request_decide',q));
 assert(!valid('Request_settlement_request_decide',{...q,decision_authority:r.decision_authority}));
});

test('living settlement product/technical/permission clauses cannot reopen the closed decision or retain a stale case count',()=>{
 const paths=['../../docs/contracts/01-FtkSaaS-urun-kapsam-sozlesmesi.md','../../docs/contracts/02-FtkSaaS-teknik-sozlesme.md','../../docs/contracts/06-FtkSaaS-O4-durum-hata-izin.md'];
 const sources=Object.fromEntries(paths.map(path=>[path,fs.readFileSync(path,'utf8')]));
 assert.equal(validateSettlementLivingDocs(original,sources),3);
 for(const path of paths){
  const changed={...sources,[path]:sources[path].replace('DS-OPEN-02 karar düzeyinde kapalıdır','DS-OPEN-02 istisna çelişkisi açık')};
  assert.throws(()=>validateSettlementLivingDocs(original,changed),/LIVING_CENTER_SCOPE_CLOSURE/);
  const stale={...sources,[path]:sources[path].replace('38 gerçek kabul senaryosu','34 gerçek kabul senaryosu')};
  assert.throws(()=>validateSettlementLivingDocs(original,stale),/LIVING_ACCEPTANCE_COUNT/);
 }
});

 test('settlement runtime acceptance requires executable evidence and every live operation',()=>{
 const p=structuredClone(original);ds(p).acceptance_cases.find(v=>v.id==='DS-SET-01').evidence=['tests/governance.test.mjs#static'];assert.throws(()=>validateGovernance(p,live),/FAKE_CASE_EVIDENCE/);
 const q=structuredClone(original);ds(q).acceptance_cases.find(v=>v.id==='DS-SCOPE-01').evidence=['tests/cross-center-settlement.test.mjs#missing runtime test'];assert.throws(()=>validateGovernance(q,live),/MISSING_RUNTIME_CASE/);
 const r=structuredClone(original);ds(r).acceptance_cases.find(v=>v.id==='DS-SET-01').status='pending_runtime';assert.throws(()=>validateGovernance(r,live),/FALSE_BEHAVIOR_PASS/);
 });

import {repositoryRoot,repoFile} from '../scripts/paths.mjs';
import {execFileSync} from 'node:child_process';
test('workspace layout keeps application ownership and a configuration-only repository root',()=>{
 const roots=new Set(['.github','.devcontainer','apps','packages','docs']);
 const files=new Set(['.gitignore','.nvmrc','AGENTS.md','CHANGELOG.md','README.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','vercel.json']);
 const tracked=execFileSync('git',['ls-files','-z'],{cwd:repositoryRoot,encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of tracked){const top=file.split('/')[0];assert(roots.has(top)||files.has(file),'Unexpected repository root source: '+file);assert(!/(?:^|\/)\.env(?!\.example$)/.test(file),'Tracked environment secret file: '+file);}
 const root=JSON.parse(fs.readFileSync(repoFile('package.json'))),backend=JSON.parse(fs.readFileSync(repoFile('apps/backend/package.json')));
 assert.equal(root.dependencies,undefined);assert.deepEqual(Object.keys(root.devDependencies),['turbo']);
 assert.equal(backend.name,'@ftksaas/backend');assert(backend.dependencies.pg);assert(backend.devDependencies.supabase);assert.equal(backend.devDependencies['@ftksaas/api-contracts'],'workspace:*');
 const node=fs.readFileSync(repoFile('.nvmrc'),'utf8').trim();assert.equal(root.engines.node,backend.engines.node);assert(root.engines.node.includes(node));
 assert(!fs.existsSync(repoFile('.node-version')));assert(!fs.existsSync(repoFile('package-lock.json')));
 const container=JSON.parse(fs.readFileSync(repoFile('.devcontainer/devcontainer.json')));assert.equal(container.postCreateCommand,'corepack pnpm install --frozen-lockfile');
 const image=fs.readFileSync(repoFile('.devcontainer/Dockerfile'),'utf8');assert(image.startsWith('FROM node:'+node+'-bookworm@sha256:'));
 const turbo=JSON.parse(fs.readFileSync(repoFile('turbo.json')));assert(!JSON.stringify(turbo).includes('"passThroughEnv"'));assert(!Object.keys(turbo.tasks).some(k=>k.startsWith('//#')));
});
