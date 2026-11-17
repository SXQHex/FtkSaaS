import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {newUuidV7 as key} from '../scripts/uuid.mjs';
const c=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),a=new Ajv({strict:false});addFormats(a);a.addSchema(c,'c');const valid=(n,x)=>a.getSchema('c#/$defs/'+n)?.(x)===true,id=key(),base={client_api_version:1,request_id:id,org_id:id,center_id:id,page:{}};
test('document management discovery has closed scopes and explicit detail targets',()=>{
 assert(valid('Request_document_directory_get',{...base,view:'documents'}));assert(valid('Request_document_directory_get',{...base,view:'versions',document_id:id}));assert(valid('Request_document_directory_get',{...base,view:'acceptances',document_id:id,acceptance_filter:'pending'}));
 assert(!valid('Request_document_directory_get',{...base,view:'versions'}));assert(!valid('Request_document_directory_get',{...base,view:'acceptances',document_id:id,account_id:id}));assert(!valid('Request_document_directory_get',{...base,view:'documents',center_id:null}));
});

test('document directory standalone validators preserve required fields and closed nested metadata',async()=>{
 const v=await import('../supabase/functions/backend-v1/validators.js'),instant='2026-11-17T00:00:00Z',version={version_id:id,version:1,version_label:'1',published_at:instant,effective_at:instant,requirements:[]};
 const summary={published_documents:1,unpublished_files:0,pending_members:0,total_members:1,last_publication:instant,acceptance_records:1};
 const success={ok:true,data:{view:'versions',items:[version],as_of:instant,next_cursor:null,history_available:true,summary},trace_id:id};
 assert(valid('Success_document_directory_get',success));assert(v.success_document_directory_get_v1(success));
 for(const path of [[],['data'],['data','summary'],['data','items',0]]){
  let target=success;for(const k of path)target=target[k];
  for(const field of Object.keys(target)){
   const changed=structuredClone(success);let nested=changed;for(const k of path)nested=nested[k];delete nested[field];
   assert(!valid('Success_document_directory_get',changed),String(path)+'/'+field);assert.equal(v.success_document_directory_get_v1(changed),valid('Success_document_directory_get',changed));
  }
 }
 for(const request of [{...base,view:'versions',document_id:id},{...base,view:'documents',version_id:id},{...base,view:'versions',document_id:id,acceptance_filter:'pending'}])assert.equal(v.request_document_directory_get_v1(request),valid('Request_document_directory_get',request));
 const extra=structuredClone(success);extra.data.items[0].account_id=id;assert(!valid('Success_document_directory_get',extra));assert(!v.success_document_directory_get_v1(extra));
});
