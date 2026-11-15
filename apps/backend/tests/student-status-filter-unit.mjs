import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import test from 'node:test';import assert from 'node:assert/strict';
import * as validators from '../supabase/functions/backend-v1/validators.js';import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Selected-center student filter is typed, compatible and rejects contradictory or missing scope',()=>{
 const valid=validators.request_people_list_v1,base={client_api_version:1,request_id:key(),org_id:key(),page:{}};
 assert(valid(base));assert(valid({...base,center_id:null,relationship:'instructor'}));
 for(const student_status of ['active','inactive']){
  const r={...base,center_id:key(),student_status};assert(valid(r));assert(valid({...r,relationship:'student'}));assert(valid({...r,relationship:null,query:'Ada',page:{limit:1,cursor:'opaque'}}));
  assert.equal(valid({...r,center_id:null}),false);const noCenter={...r};delete noCenter.center_id;assert.equal(valid(noCenter),false);
  assert.equal(valid({...r,relationship:'instructor'}),false);
 }
 for(const student_status of [null,'suspended','all',true,1])assert.equal(valid({...base,center_id:key(),student_status}),false);
});

test('Member summaries are opt in, exact and distinguish withheld data from known zero',()=>{
 const base={client_api_version:1,request_id:key(),org_id:key(),page:{}};
 assert(validators.request_people_list_v1({...base,include_member_summary:false}));assert(validators.request_people_list_v1({...base,center_id:key(),include_member_summary:true}));assert.equal(validators.request_people_list_v1({...base,include_member_summary:true}),false);assert.equal(validators.request_people_list_v1({...base,center_id:null,include_member_summary:true}),false);
 const summary={as_of:new Date().toISOString(),rights:{status:'available',available_credits:'0',available_timed_packages:0},debt:{status:'available',by_currency:[{currency:'USD',remaining_minor:'9007199254741005'},{currency:'EUR',remaining_minor:'30'}]},next_lesson:{status:'available',lesson:{session_id:key(),starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+3600000).toISOString()}}};
 const response=x=>({ok:true,trace_id:key(),data:{items:[{id:key(),display_name:'Synthetic',relationships:[],member_summary:x}],next_cursor:null,as_of:new Date().toISOString()}});
 assert(validators.success_people_list_v1(response(summary)));assert(validators.success_people_list_v1(response({...summary,rights:{status:'restricted'},debt:{status:'not_enabled'},next_lesson:{status:'available',lesson:null}})));
 for(const invalid of [{...summary,debt:{status:'restricted',by_currency:[]}},{...summary,rights:{status:'available',available_credits:10}},{...summary,next_lesson:{status:'available'}},{...summary,debt:{status:'available',by_currency:[{remaining_minor:'30'}]}}])assert.equal(validators.success_people_list_v1(response(invalid)),false);
});

test('Center invitation/link discovery is closed, scoped and independently typed',()=>{
 const base={client_api_version:1,request_id:key(),org_id:key(),center_id:key(),page:{limit:1}};
 for(const operation of ['account_access_revoke_v1','account_link_remove_v1']){
  const req={...base,operation,selector:{operation,key:{directory:'center',query:'Ada',status:operation==='account_access_revoke_v1'?'expired':'active'}}};assert(validators.request_management_state_get_v1(req));assert.equal(validators.request_management_state_get_v1({...req,center_id:null}),false);
  assert.equal(validators.request_management_state_get_v1({...req,selector:{operation,key:{...req.selector.key,account_id:key()}}}),false);
  assert.equal(validators.request_management_state_get_v1({...req,selector:{operation,key:{directory:'center',status:'unknown'}}}),false);
 }
});

test('Access discovery delivery/name metadata is closed and keeps hidden facts unknown',()=>{
 const now=new Date().toISOString(),id=key(),operation='account_access_revoke_v1';
 const detail={kind:'invitation',display_name:null,created_at:now,expires_at:now,can_resend:false,delivery:{visibility:'restricted'}};
 const response=d=>({ok:true,trace_id:key(),data:{items:[{operation,entity:{type:'invitations',id},exists:true,state:'pending',versions:[{entity:{type:'invitations',id},version:1}],as_of:now,current:{operation,values:{person_id:key(),invitation_id:id,center_id:key(),expires_at:now,actionable:false}},access_detail:d}],next_cursor:null,as_of:now,access_summary:{total:1,filtered:1,by_state:[{state:'pending',count:1}]}}});
 assert(validators.success_management_state_get_v1(response(detail)));assert(validators.success_management_state_get_v1(response({...detail,delivery:{visibility:'available',state:'succeeded',sent_at:null}})));
 for(const bad of [{...detail,account_id:key()},{...detail,delivery:{visibility:'restricted',sent_at:now}},{...detail,delivery:{visibility:'available',state:'succeeded',sent_at:now,provider_reference:key()}}])assert.equal(validators.success_management_state_get_v1(response(bad)),false);
});


test('Shared compound validators preserve deep canonical request and response acceptance',()=>{
 const schema=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/contract.json')),ajv=new Ajv({strict:false,allErrors:false});addFormats(ajv);ajv.addSchema(schema,'contract');
 const now=new Date().toISOString(),operation='account_access_revoke_v1',id=key();
 const cases=[['management_state_get_v1','request',{client_api_version:1,request_id:key(),org_id:key(),center_id:key(),operation,selector:{operation,key:{directory:'center',status:'expired'}},page:{}}],
 ['people_list_v1','success',{ok:true,trace_id:key(),data:{items:[{id:key(),display_name:'Synthetic',relationships:[],member_summary:{as_of:now,rights:{status:'available',available_credits:'3',available_timed_packages:1},debt:{status:'restricted'},next_lesson:{status:'available',lesson:null}}}],next_cursor:null,as_of:now}}],
 ['management_state_get_v1','success',{ok:true,trace_id:key(),data:{items:[{operation,entity:{type:'invitations',id},exists:true,state:'expired',versions:[],as_of:now,current:null,access_detail:{kind:'invitation',display_name:null,created_at:now,expires_at:now,can_resend:false,delivery:{visibility:'available',state:'succeeded',sent_at:null}}}],next_cursor:null,as_of:now,access_summary:{total:1,filtered:1,by_state:[{state:'expired',count:1}]}}}]];
 for(const [op,kind,sample] of cases){const def=schema['x-contract'].operations.find(x=>x.name===op),canonical=ajv.getSchema('contract'+def[kind].$ref),standalone=validators[kind+'_'+op];assert(canonical(sample));assert(standalone(sample));
  for(const mutated of [{...sample,injected:'no'}, {...sample,...(kind==='request'?{center_id:null}:{data:{...sample.data,items:[{...sample.data.items[0],access_detail:{kind:'invitation',display_name:null}}]}})}]){assert.equal(canonical(mutated),false);assert.equal(standalone(mutated),canonical(mutated));}
 }
});
