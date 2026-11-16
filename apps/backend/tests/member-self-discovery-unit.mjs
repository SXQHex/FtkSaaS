import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {newUuidV7} from '../scripts/uuid.mjs';
const schema=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),a=new Ajv({strict:false,allErrors:true});addFormats(a);a.addSchema(schema,'contract');const valid=(n,v)=>a.getSchema('contract#/$defs/'+n)?.(v)===true,id=newUuidV7(),base={client_api_version:1,request_id:id,org_id:id,center_id:id};
test('self waitlist directory requires no target or known session and keeps closed view statuses',()=>{
 const selector={operation:'waitlist_join_v1',key:{directory:'self',view:'entries',status:'waiting'}};
 assert(valid('Request_management_state_get',{...base,operation:'waitlist_join_v1',selector,page:{}}));
 for(const key of [{directory:'self',view:'entries',person_id:id},{directory:'self',view:'offers',status:'waiting'}])assert(!valid('Request_management_state_get',{...base,operation:'waitlist_join_v1',selector:{...selector,key},page:{}}));
});
test('member purchase summary and currency discovery preserve explicit currency reads',()=>{
 assert(valid('Request_entitlements_get',{...base,person_id:id,include_purchase_summary:true}));
 assert(valid('Request_member_finance_currencies_get',base));
 assert(valid('Request_finance_get',{...base,person_id:id,currency:'TRY',page:{}}));
 assert(!valid('Request_finance_get',{...base,person_id:id,page:{}}));
 assert(!valid('Request_member_finance_currencies_get',{...base,person_id:id}));
});
test('document discovery uses a separate closed reader and real context reads stay required',()=>{
 assert(valid('Request_member_document_contexts_get',{...base,page:{}}));
 assert(!valid('Request_document_requirements_get',{...base}));
 assert(!valid('Request_member_document_contexts_get',{...base,page:{},context:{gate:'sale',subject:{type:'sales',id}}}));
 assert(valid('Request_document_requirements_get',{...base,context:{gate:'sale',subject:{type:'sales',id}}}));
});

test('standalone self readers preserve all scope requirements and reject extra fields',async()=>{
 const validators=await import('../supabase/functions/backend-v1/validators.js');
 for(const [name,fn,value] of [
  ['Request_member_finance_currencies_get','request_member_finance_currencies_get_v1',base],
  ['Request_member_document_contexts_get','request_member_document_contexts_get_v1',{...base,page:{}}],
  ['Request_management_state_get','request_management_state_get_v1',{...base,operation:'waitlist_join_v1',selector:{operation:'waitlist_join_v1',key:{directory:'self',view:'entries'}},page:{}}]
 ]){
  assert(valid(name,value));assert(validators[fn](value));
  for(const field of Object.keys(value)){const changed={...value};delete changed[field];assert.equal(validators[fn](changed),valid(name,changed),name+' missing '+field);}
  for(const changed of [{...value,unexpected:true},{...value,org_id:'invalid'},{...value,center_id:null}])assert.equal(validators[fn](changed),valid(name,changed));
 }
});
test('compact enum validators keep every published safe error and reject unknown codes',async()=>{
 const {failure_envelope}=await import('../supabase/functions/backend-v1/validators.js');
 for(const code of [...schema.$defs.SafeError.properties.code.enum,'UNKNOWN_SYNTHETIC_CODE','']){const v={ok:false,error:{code,retryable:false,trace_id:id}};assert.equal(failure_envelope(v),valid('FailureEnvelope',v),code);}
});
