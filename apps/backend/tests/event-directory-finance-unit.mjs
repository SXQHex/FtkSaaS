import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';import {newUuidV7} from '../scripts/uuid.mjs';
const schema=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),a=new Ajv({strict:false,allErrors:true});addFormats(a);a.addSchema(schema,'contract');const valid=(n,v)=>a.getSchema('contract#/$defs/'+n)?.(v)===true,id=newUuidV7();
const base={client_api_version:1,request_id:id,org_id:id,interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2026-02-01T00:00:00Z'},page:{}};
test('event directory adds bound title/status filters and explicit-center summary without breaking legacy reads',()=>{
 assert(valid('Request_event_list',base));assert(valid('Request_event_list',{...base,center_id:id,query:'Workshop',status:'published',include_summary:true}));
 for(const extra of [{include_summary:true},{center_id:null,include_summary:true},{status:'past_clock'},{query:' '}])assert(!valid('Request_event_list',{...base,...extra}));
 assert(valid('Request_event_get',{client_api_version:1,request_id:id,org_id:id,event_id:id,include_payment_summary:true}));
});

test('compact standalone event validators preserve every required field and nested closed contract',async()=>{
 const {request_event_save_v1:standalone,success_event_get_v1:response}=await import('../supabase/functions/backend-v1/validators.js');
 const terms={fee_minor:'1000',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'}};
 const event={id,name:'Synthetic event',center_id:id,interval:base.interval,timezone:'UTC',venue:{kind:'external',name:'Synthetic venue',address:'Synthetic',timezone:'UTC'},capacity:{nominal:1,maximum:1},terms,state:'published',attendance_state:'open',assignments:[],version:1,discipline_ids:[]};
 const request={...base,operation_key:id,name:event.name,timezone:event.timezone,venue:event.venue,capacity:event.capacity,terms,assignments:[],discipline_ids:[]};delete request.page;
 const success={ok:true,data:event,trace_id:id};
 for(const [name,value,validator] of [['Request_event_save',request,standalone],['Success_event_get',success,response]]){
  assert(valid(name,value),name+' authoritative positive');assert(validator(value),name+' standalone positive');
  const nested=name==='Success_event_get';const required=schema.$defs[nested?'EventView':name].required;
  for(const field of required){const changed=structuredClone(value),target=nested?changed.data:changed;delete target[field];assert(!valid(name,changed),field+' authoritative required');assert(!validator(changed),field+' standalone required');}
  const extra=structuredClone(value);(nested?extra.data:extra).unexpected=true;assert(!valid(name,extra));assert(!validator(extra));
 }
});
