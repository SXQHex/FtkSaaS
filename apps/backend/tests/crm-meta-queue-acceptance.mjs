import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {providerFixture} from './crm-provider-fixture.mjs';
import {enqueueMetaNotifications,claimMetaNotification} from '../scripts/crm-meta-queue.mjs';
import {createMetaQueuedWebhookHandler,createMetaQueueWorker} from '../transports/crm-provider-webhook.mjs';

test('durable Meta ACK survives provider failure and later leads progress without rereading completed prefixes',{timeout:300000},async t=>{
 const {db,meta,metaForm,client,count}=await providerFixture(t);
 const config={app_secret:'synthetic-secret',verify_token:'synthetic-verify',routes:[{page_id:meta.external_page_id,form_id:meta.external_form_id,api_version:'v24.0',access_token:'synthetic-page-token',mapping:{fields:{display_name:'full_name',phone:'phone_number'},consents:[],consent_key_field:'checkbox_key',consent_value_field:'is_checked'}}]};
 const ids=[meta.external_lead_id,meta.external_lead_id+'1'];let reads=0,fail=true;
 const receiver=createMetaQueuedWebhookHandler(config,{client,fetchImpl:async()=>{throw Error('ACK must not read Graph');}});
 const body=JSON.stringify({object:'page',entry:[{id:meta.external_page_id,changes:ids.map(leadgen_id=>({field:'leadgen',value:{page_id:meta.external_page_id,form_id:meta.external_form_id,leadgen_id}}))}]}),signature=createHmac('sha256',config.app_secret).update(body).digest('hex');
 const send=()=>receiver(new Request('https://example.invalid/meta',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+signature},body}));
 assert.equal((await send()).status,200);assert.equal(await count(),0);
 const queued=async()=>Number((await db.query('select count(*) n from private.crm_meta_notifications where form_id=$1',[metaForm])).rows[0].n);assert.equal(await queued(),2);
 assert.equal((await send()).status,200);assert.equal(await queued(),2);
 const worker=createMetaQueueWorker({...config,lease_seconds:60,retry_seconds:60},{client,fetchImpl:async url=>{reads++;const id=url.pathname.split('/').at(-1);if(fail)return new Response('Synthetic temporary failure',{status:500});return Response.json({id,form_id:meta.external_form_id,created_time:meta.submitted_at,field_data:[{name:'full_name',values:['Synthetic durable lead']},{name:'phone_number',values:[meta.intake.phone]}]});}});
 await assert.rejects(worker.runOnce(),/PROVIDER_PROCESSING/);assert.equal(await count(),0);fail=false;
 assert.deepEqual(await worker.runOnce(),{claimed:true,completed:true});assert.equal(await count(),1);assert.deepEqual(await worker.runOnce(),{claimed:false});assert.equal(reads,2);
 await db.query('update private.crm_meta_notifications set available_at=clock_timestamp() where form_id=$1 and completed_at is null',[metaForm]);
 assert.deepEqual(await worker.runOnce(),{claimed:true,completed:true});assert.equal(await count(),2);
 assert.equal((await send()).status,200);assert.deepEqual(await worker.runOnce(),{claimed:false});assert.equal(reads,3);assert.equal(await queued(),2);
 const later=ids.map(id=>({...meta,external_lead_id:id+'2'})).map(v=>({provider:'meta',external_page_id:v.external_page_id,external_form_id:v.external_form_id,external_lead_id:v.external_lead_id,notification_sent_at:null,lead_created_at:null,attribution:{}}));
 await enqueueMetaNotifications(client,later);const crashed=await claimMetaNotification(client,config.routes[0],60);assert(crashed);
 const otherId=later.find(e=>e.external_lead_id!==crashed.notification.external_lead_id).external_lead_id;
 // Simulate 61 seconds elapsed for both pending rows, preserving their relative priority.
 await db.query("update private.crm_meta_notifications set lease_until=lease_until-interval '61 seconds',available_at=available_at-interval '61 seconds' where form_id=$1 and completed_at is null",[metaForm]);
 assert.deepEqual(await worker.runOnce(),{claimed:true,completed:true});assert.equal((await db.query('select provider_lead_id from core.public_applications where crm_form_id=$1 and provider_lead_id=$2',[metaForm,otherId])).rowCount,1);
 assert.deepEqual(await worker.runOnce(),{claimed:true,completed:true});assert.equal(await count(),4);assert.equal(reads,5);
 for(const row of (await db.query('select notification,lease_token,completed_at from private.crm_meta_notifications where form_id=$1',[metaForm])).rows){assert.equal(row.lease_token,null);assert(row.completed_at);assert(!JSON.stringify(row.notification).includes(meta.intake.phone));}
});
