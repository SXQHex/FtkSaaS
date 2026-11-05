import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHmac} from 'node:crypto';
import {context} from './api-client.mjs';
import {providerFixture} from './crm-provider-fixture.mjs';
import {createProviderHost,startProviderServer} from '../transports/crm-provider-host.mjs';
import {createNativeReceiverClient} from '../transports/crm-provider-host-db.mjs';

test('real HTTP host uses native bounded LOGIN, durable ACK, worker and scoped safe queue monitoring',{timeout:300000},async t=>{
 const {db,meta,metaForm,role,client,count}=await providerFixture(t),url=new URL(context().env.DB_URL);url.username=role;url.password=client.connectionParameters.password;
 const monitor='synthetic-monitor-token-0123456789abcdef',logs=[],config={monitor_token:monitor,worker_enabled:true,google:null,meta:{app_secret:'synthetic-secret',verify_token:'synthetic-verify',routes:[{page_id:meta.external_page_id,form_id:meta.external_form_id,api_version:'v24.0',access_token:'synthetic-page-token',mapping:{fields:{display_name:'full_name',phone:'phone_number'},consents:[],consent_key_field:'checkbox_key',consent_value_field:'is_checked'}}]}};
 let reads=0;const host=createProviderHost(config,{clientFactory:()=>createNativeReceiverClient(url.href),emit:e=>logs.push(e),fetchImpl:async()=>{reads++;return Response.json({id:meta.external_lead_id,form_id:meta.external_form_id,created_time:meta.submitted_at,field_data:[{name:'full_name',values:['Synthetic host candidate']},{name:'phone_number',values:[meta.intake.phone]}]});}}),server=startProviderServer(host,{port:0});
 t.after(async()=>{await host.stop();server.closeAllConnections();await new Promise(r=>server.close(r));});await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(origin+'/healthz')).status,200);assert.equal((await fetch(origin+'/ops/status')).status,401);
 const body=JSON.stringify({object:'page',entry:[{id:meta.external_page_id,changes:[{field:'leadgen',value:{page_id:meta.external_page_id,form_id:meta.external_form_id,leadgen_id:meta.external_lead_id}}]}]}),signature=createHmac('sha256',config.meta.app_secret).update(body).digest('hex');
 const send=()=>fetch(origin+'/webhooks/meta',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+signature},body});assert.equal((await send()).status,200);assert.equal(await count(),0);assert.equal(reads,0);
 const status=async()=>{const response=await fetch(origin+'/ops/status',{headers:{authorization:'Bearer '+monitor}});assert.equal(response.status,200);return response.json();};assert.equal((await status()).queue.pending,1);
 assert.deepEqual(await host.tick(),{claimed:true,completed:true});assert.equal(await count(),1);assert.equal(reads,1);const done=await status();assert.equal(done.queue.completed,1);assert.equal(done.queue.pending,0);assert.equal(done.worker.completed,1);
 await db.query('update private.crm_intake_forms set enabled=false where id=$1',[metaForm]);assert.equal((await status()).queue.admission_open,false);assert.equal((await send()).status,503);
 assert(!JSON.stringify(logs).includes(meta.intake.phone));assert(!JSON.stringify(logs).includes(config.meta.app_secret));assert(!JSON.stringify(done).includes(meta.external_lead_id));
 for(const who of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'private.crm_meta_status(text,text)','EXECUTE') allowed",[who])).rows[0].allowed,false);
 await db.query('delete from private.crm_provider_receiver_scopes where db_role=$1 and form_id=$2',[role,metaForm]);assert.equal((await fetch(origin+'/ops/status',{headers:{authorization:'Bearer '+monitor}})).status,503);
});
