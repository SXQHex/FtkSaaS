import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import * as validators from '../supabase/functions/backend-v1/validators.js';

test('Edge upload keeps JSON-encoded source below 4 MB with provider envelope headroom',()=>{
 const source=fs.readFileSync('supabase/functions/backend-v1/index.ts','utf8');
 assert(Buffer.byteLength(JSON.stringify(source))<4_000_000,'Edge API source upload exceeds budget');
});

test('Standalone validators retain authoritative acceptance and reject malformed shared references',()=>{
 const contract=JSON.parse(fs.readFileSync('supabase/functions/backend-v1/contract.json'));
 const ajv=new Ajv({strict:false,allErrors:false});addFormats(ajv);ajv.addSchema(contract,'contract');
 const id='019ab111-1234-7000-8000-000000000001';
 const samples=[null,{},[],{ok:true,data:{},trace_id:id},{client_api_version:1,request_id:id},
  {client_api_version:1,request_id:id,org_id:id},
  {client_api_version:1,request_id:id,org_id:id,operation_key:id,lead_id:id,kind:'contact'},
  {ok:true,data:{operation_id:id,primary_id:id,replayed:false,related:[]},trace_id:id}];
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
});
