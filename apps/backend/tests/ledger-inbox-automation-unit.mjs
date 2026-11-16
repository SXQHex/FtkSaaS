import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {newUuidV7} from '../scripts/uuid.mjs';
import standalone from 'ajv/dist/standalone/index.js';import {createRequire} from 'node:module';import {compactValidatorErrors} from '../scripts/compact-validator-errors.mjs';
const contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),a=new Ajv({strict:false,allErrors:true});addFormats(a);a.addSchema(contract,'contract');const valid=(n,v)=>a.getSchema('contract#/$defs/'+n)?.(v)===true,id=newUuidV7(),base={client_api_version:1,request_id:id,org_id:id,center_id:id};
test('self instructor earnings supports the real all-period ledger while legacy earnings still requires interval',()=>{
 assert(valid('Request_instructor_account_get',{...base,person_id:id,view:'earnings',page:{}}));
 assert(!valid('Request_earnings_list',{...base,person_id:id,page:{}}));
 assert(!valid('Request_instructor_account_get',{...base,person_id:id,view:'earnings',interval:null,page:{}}));
});
test('validator compaction preserves Boolean predicates, const data and useful error diagnostics',()=>{
 const business={instancePath:'business',schemaPath:'business_value',keyword:'user',params:{x:1}},ajv=new Ajv({strict:false,allErrors:true,code:{source:true}}),schema={type:'object',required:['payload','count'],additionalProperties:false,properties:{payload:{const:business},count:{type:'integer',minimum:2},list:{type:'array',items:{enum:['a','b']}}}},original=ajv.compile(schema),code=standalone(ajv,original),module={exports:{}};
 new Function('module','exports','require',compactValidatorErrors(code))(module,module.exports,createRequire(import.meta.url));const compact=module.exports;
 for(const value of [{payload:business,count:2,list:['a']},{payload:{...business,schemaPath:'changed'},count:2},{payload:business,count:1},{payload:business,count:2,list:['c']},{payload:business,count:2,extra:true},{}]){
  assert.equal(compact(value),original(value));const errors=x=>JSON.parse(JSON.stringify(x??[])).map(({schemaPath,...rest})=>rest);assert.deepEqual(errors(compact.errors),errors(original.errors));if(original.errors)assert(compact.errors.every((x,i)=>x.schemaPath===''||x.schemaPath===original.errors[i].schemaPath));
 }
 assert(code.includes('schemaPath'));assert(compactValidatorErrors(code).includes('business_value'));
});
test('inbox filtering and atomic selected read-state command stay closed and versioned',()=>{
 assert(valid('Request_notifications_list',{...base,page:{},unread_only:false,query:'offer',work_state:'pending',include_work:true,include_summary:true}));
 assert(valid('Request_notifications_read_set',{...base,operation_key:id,read:false,notifications:[{id,expected_version:1}]}));
 for(const notifications of [[],[{id}],Array.from({length:101},()=>({id,expected_version:1}))])assert(!valid('Request_notifications_read_set',{...base,operation_key:id,read:true,notifications}));
 assert(!valid('Request_notifications_list',{...base,page:{},unread_only:false,query:' '}));
});
test('native automation insights expose explicit execution-center segment samples and scoped job history only',()=>{
 const request=(operation,key)=>({...base,operation,selector:{operation,key},page:{}});
 assert(valid('Request_management_state_get',request('segment_save_v1',{scope:{kind:'center',center_id:id},segment_id:id,discovery:'matches',execution_center_id:id})));
 assert(valid('Request_management_state_get',request('segment_save_v1',{scope:{kind:'center',center_id:id},segment_id:id,discovery:'automations'})));
 assert(valid('Request_management_state_get',request('automation_save_v1',{scope:{kind:'center',center_id:id},discovery:'jobs',state:'failed'})));
 assert(!valid('Request_management_state_get',request('segment_save_v1',{scope:{kind:'organization'},segment_id:id,discovery:'matches'})));
});
