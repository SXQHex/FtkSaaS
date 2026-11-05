import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import * as webhook from '../transports/crm-provider-webhook.mjs';
const route={page_id:'100',form_id:'200',api_version:'v24.0',access_token:'synthetic-page-token',mapping:{fields:{display_name:'full_name',phone:'phone_number'},consents:[],consent_key_field:'checkbox_key',consent_value_field:'is_checked'}};
const config={app_secret:'synthetic-secret',verify_token:'synthetic-verify',routes:[route]};
const event={provider:'meta',external_page_id:'100',external_form_id:'200',external_lead_id:'300',notification_sent_at:null,lead_created_at:null,attribution:{}};
const id='019a3d00-0000-7000-8000-000000000001';
const request=(ids=['300'],valid=true)=>{const body=JSON.stringify({object:'page',entry:[{id:'100',changes:ids.map(leadgen_id=>({field:'leadgen',value:{page_id:'100',form_id:'200',leadgen_id}}))}]}),signature=createHmac('sha256',config.app_secret).update(body).digest('hex');return new Request('https://example.invalid/meta',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+(valid?signature:'0'.repeat(64))},body});};

test('durable Meta ACK waits for one atomic batch receipt and performs no Graph IO',async()=>{
 let release,entered;const pending=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});let calls=0;
 const handler=webhook.createMetaQueuedWebhookHandler(config,{client:{query:async(sql,args)=>{calls++;assert.match(sql,/crm_meta_enqueue/);assert.equal(JSON.parse(args[0]).length,2);entered();await pending;return {rows:[{result:{accepted:2}}]};}},fetchImpl:async()=>{throw Error('Graph must not run during durable ACK');}});
 let done=false;const response=handler(request(['300','301'])).then(r=>{done=true;return r;});await Promise.race([started,response.then(()=>{throw Error('ACK before durable queue commit');})]);assert.equal(done,false);release();assert.equal((await response).status,200);assert.equal(calls,1);
});

test('durable Meta receiver rejects bad signature, unknown route, queue failure and malformed receipt',async()=>{
 let calls=0;const handler=webhook.createMetaQueuedWebhookHandler(config,{client:{query:async()=>{calls++;throw Error('synthetic-private-db-error');}}});
 assert.equal((await handler(request(['300'],false))).status,403);assert.equal(calls,0);
 const unknown=structuredClone(config);unknown.routes[0].form_id='999';assert.equal((await webhook.createMetaQueuedWebhookHandler(unknown,{client:{query:async()=>{throw Error('Unexpected queue call');}}})(request())).status,503);
 const failed=await handler(request());assert.equal(failed.status,503);assert(!((await failed.text()).includes('synthetic-private')));
 const invalid=webhook.createMetaQueuedWebhookHandler(config,{client:{query:async()=>({rows:[{result:{accepted:0}}]})}});assert.equal((await invalid(request())).status,503);
});

test('one worker invocation processes only its claimed notification and completes under the same lease',async()=>{
 let completed=0,fetches=0;const claim={id,lease_token:id,notification:event};
 const worker=webhook.createMetaQueueWorker({...config,lease_seconds:60,retry_seconds:30},{client:{query:async(sql,args)=>{
  if(sql.includes('crm_meta_claim'))return {rows:[{result:{...claim,lease_token:args[2]}}]};
  assert.match(sql,/crm_meta_complete/);assert.equal(args[0],id);assert.equal(args[2].external_lead_id,'300');completed++;return {rows:[{result:{application_id:id,replayed:false}}]};
 }},fetchImpl:async()=>{fetches++;return Response.json({id:'300',form_id:'200',created_time:'2026-01-01T00:00:00Z',field_data:[{name:'full_name',values:['Synthetic lead']},{name:'phone_number',values:['+905550000001']}]});}});
 assert.deepEqual(await worker.runOnce(),{claimed:true,completed:true});assert.equal(fetches,1);assert.equal(completed,1);
});

test('empty, unauthorized or malformed claims cannot trigger Graph',async()=>{
 for(const result of [null,{id,lease_token:id,notification:{...event,external_form_id:'999'}}]){
  let reads=0;const worker=webhook.createMetaQueueWorker({...config,lease_seconds:60,retry_seconds:30},{client:{query:async(sql,args)=>({rows:[{result:result===null?null:{...result,lease_token:args[2]}}]})},fetchImpl:async()=>{reads++;}});
  if(result===null)assert.deepEqual(await worker.runOnce(),{claimed:false});else await assert.rejects(worker.runOnce(),/PROVIDER_QUEUE/);assert.equal(reads,0);
 }
});

test('processing failure schedules a lease-bound retry and never pretends the lead completed',async()=>{
 const calls=[];const worker=webhook.createMetaQueueWorker({...config,lease_seconds:60,retry_seconds:30},{client:{query:async(sql,args)=>{
  calls.push(sql);if(sql.includes('crm_meta_claim'))return {rows:[{result:{id,lease_token:args[2],notification:event}}]};assert.match(sql,/crm_meta_retry/);assert.equal(args[2],30);return {rows:[{result:true}]};
 }},fetchImpl:async()=>new Response('synthetic-private-provider-error',{status:500})});
 await assert.rejects(worker.runOnce(),error=>error.message==='PROVIDER_PROCESSING');assert.equal(calls.length,2);assert(!calls.some(sql=>sql.includes('complete')));
});


test('malformed completion receipt causes retry instead of reporting completion',async()=>{
 let retries=0;const worker=webhook.createMetaQueueWorker({...config,lease_seconds:60,retry_seconds:30},{client:{query:async(sql,args)=>{
  if(sql.includes('claim'))return {rows:[{result:{id,lease_token:args[2],notification:event}}]};
  if(sql.includes('complete'))return {rows:[{result:{replayed:false}}]};retries++;return {rows:[{result:true}]};
 }},fetchImpl:async()=>Response.json({id:'300',form_id:'200',created_time:'2026-01-01T00:00:00Z',field_data:[{name:'full_name',values:['Synthetic lead']},{name:'phone_number',values:['+905550000001']}]})});
 await assert.rejects(worker.runOnce(),/PROVIDER_PROCESSING/);assert.equal(retries,1);
});
