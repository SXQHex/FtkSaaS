import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {optimizeStandaloneValidators} from '../scripts/optimize-standalone-validators.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';

test('Edge upload keeps JSON-encoded source within 4,999,999 bytes',()=>{
 const source=fs.readFileSync('supabase/functions/backend-v1/index.js','utf8');
 assert(Buffer.byteLength(JSON.stringify(source))<=4_999_999,'Edge API source upload exceeds budget');
});

test('Generated JavaScript gateway loads and retains typed method rejection',async()=>{
 const previous=globalThis.Deno;let handler;
 globalThis.Deno={serve:value=>{handler=value;},env:{get:()=>undefined}};
 try{
  await import('../supabase/functions/backend-v1/index.js');
  assert.equal(typeof handler,'function');
  const response=await handler(new Request('http://localhost/functions/v1/backend-v1/account_get_v1'));
  assert.equal(response.status,400);assert.equal(response.headers.get('content-type'),'application/json');
  const body=await response.json();assert(validators.failure_envelope(body));assert.equal(body.error.code,'VALIDATION_FAILED');
 }finally{if(previous===undefined)delete globalThis.Deno;else globalThis.Deno=previous;}
});

test('Standalone optimization preserves exact errors and live schema constants',()=>{
 const source=`
"use strict";
const schema0 = {"properties":{"value":{"enum":["one","two"],"default":"unused-marker"},"unused":{"type":"number"}}};
const schema1 = {"enum":["one","two"],"default":"dynamic-marker"};
function validate1(data){
 const instancePath = "";
 if (data?.checkDirective) return this;
 if (data === null) {
  validate1.errors = [{instancePath,schemaPath:"",keyword:"type",params:{type:"object"}}];
  return false;
 }
 if (data.branch !== undefined) return schema1[data.branch];
 if (!schema0.properties.value.enum.includes(data.value)) {
  validate1.errors = [
   {instancePath:instancePath+"/value",schemaPath:"#/properties/value/enum",keyword:"enum",params:{allowedValues:schema0.properties.value.enum}},
   {instancePath,schemaPath:"",keyword:"required",params:{missingProperty:"value"}}
  ];
  return false;
 }
 validate1.errors = null;
 return true;
}
module.exports = validate1;`;
 const load=code=>{const mod={};new Function('module',code)(mod);return mod.exports;};
 const optimized=optimizeStandaloneValidators(source);
 assert.doesNotMatch(optimized,/unused-marker/);
 assert.match(optimized,/dynamic-marker/);
 assert.match(optimized,/return rejectStandalone\(validate1,/);
 const reference=load(source),candidate=load(optimized);
 for(const payload of [null,{}, {value:'invalid'}, {value:'one'}, {branch:'default'}, {checkDirective:true}]){
  assert.equal(candidate(payload),reference(payload));
  assert.deepEqual(candidate.errors,reference.errors);
  assert.equal(JSON.stringify(candidate.errors),JSON.stringify(reference.errors));
 }
});

test('Standalone validators retain authoritative acceptance and reject malformed shared references',()=>{
 const contract=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/contract.json'));
 const ajv=new Ajv({strict:false,allErrors:false});addFormats(ajv);ajv.addSchema(contract,'contract');
 const id='019ab111-1234-7000-8000-000000000001';
 const samples=[null,{},[],{ok:true,data:{},trace_id:id},{client_api_version:1,request_id:id},
  {client_api_version:1,request_id:id,org_id:id},
  {client_api_version:1,request_id:id,org_id:id,operation_key:id,lead_id:id,kind:'contact'},
  {ok:true,data:{operation_id:id,primary_id:id,replayed:false,related:[]},trace_id:id},
  {client_api_version:1,request_id:id,org_id:id,operation_key:id,read:true,all_unread:true},
  {client_api_version:1,request_id:id,org_id:id,operation_key:id,read:false,notifications:[{id,expected_version:1}]}];
 for(const operation of contract['x-contract'].operations)for(const kind of ['request','success']){
  const reference=ajv.getSchema('contract'+operation[kind].$ref),standalone=validators[kind+'_'+operation.name];
  for(const sample of samples){
   assert.equal(standalone(sample),reference(sample),kind+' '+operation.name);
   if(reference(sample)){
    assert(standalone(sample),operation.name+' valid control');
    for(const field of Object.keys(sample)){
     const missing={...sample};delete missing[field];
     for(const changed of [missing,{...sample,[field]:{}},{...sample,unexpected:true}])assert.equal(standalone(changed),reference(changed),operation.name+' '+field);
    }
   }
  }
 }
 assert(validators.request_account_get_v1(samples[4]));
 assert(validators.request_organization_get_v1(samples[5]));
 assert(validators.request_crm_activity_save_v1(samples[6]));
 assert(validators.success_crm_activity_save_v1(samples[7]));
 assert(!validators.success_crm_activity_save_v1({...samples[7],data:{...samples[7].data,primary_id:'not-a-uuid'}}));
 assert(!validators.request_account_get_v1({...samples[4],request_id:'not-a-uuid'}));
 assert(validators.request_notifications_read_set_v1(samples[8]));
 assert(validators.request_notifications_read_set_v1(samples[9]));
 assert(!validators.request_notifications_read_set_v1({...samples[8],notifications:samples[9].notifications}));
});
