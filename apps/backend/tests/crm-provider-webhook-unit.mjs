import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createMetaWebhookHandler,createGoogleWebhookHandler} from '../transports/crm-provider-webhook.mjs';
const mapping={fields:{display_name:'full_name',phone:'phone_number'},consents:[],consent_key_field:'checkbox_key',consent_value_field:'is_checked'};
const meta={app_secret:'synthetic-app-secret',verify_token:'synthetic-verify',routes:[{page_id:'100',form_id:'200',api_version:'v24.0',access_token:'synthetic-page-token',mapping}]};
const raw=JSON.stringify({object:'page',entry:[{id:'100',changes:[{field:'leadgen',value:{page_id:'100',form_id:'200',leadgen_id:'300'}}]}]});
const request=(body=raw,signature=createHmac('sha256',meta.app_secret).update(body).digest('hex'))=>new Request('https://example.invalid/meta',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+signature},body});
const google={google_key:'synthetic-google-key',form_id:'200',mapping:{fields:{},consents:[]}},googleBody=JSON.stringify({google_key:google.google_key,form_id:200,lead_id:'synthetic-google-lead',user_column_data:[{column_id:'FULL_NAME',string_value:'Synthetic lead'},{column_id:'PHONE_NUMBER',string_value:'+905550000001'}]});
const googleRequest=(body=googleBody)=>new Request('https://example.invalid/google',{method:'POST',headers:{'content-type':'application/json'},body});
const graph=()=>new Response(JSON.stringify({id:'300',form_id:'200',created_time:'2026-01-01T00:00:00+0000',field_data:[{name:'full_name',values:['Synthetic lead']},{name:'phone_number',values:['+905550000001']}]}));

test('Meta challenge and invalid signatures never touch the database or Graph',async()=>{
 let effects=0;const handler=createMetaWebhookHandler(meta,{client:{query:async()=>{effects++;}},fetchImpl:async()=>{effects++;}});
 const challenge=await handler(new Request('https://example.invalid/meta?hub.mode=subscribe&hub.verify_token=synthetic-verify&hub.challenge=00123'));assert.equal(challenge.status,200);assert.equal(await challenge.text(),'00123');
 assert.equal((await handler(request(raw,'0'.repeat(64)))).status,403);assert.equal(effects,0);assert.equal((await handler(new Request('https://example.invalid/meta',{method:'DELETE'}))).status,405);
});

test('Meta authorizes a live native route before Graph and cannot acknowledge an unfinished write',async()=>{
 const calls=[];let release,entered;const pending=new Promise(resolve=>{release=resolve;}),submitted=new Promise(resolve=>{entered=resolve;});
 const client={query:async(sql,args)=>{calls.push(sql);if(sql.includes('authorize'))return {rows:[{allowed:true}]};assert.equal(args[0].provider,'meta');entered();await pending;return {rows:[{result:{application_id:'019a3d00-0000-7000-8000-000000000001',replayed:false}}]};}};
 const handler=createMetaWebhookHandler(meta,{client,fetchImpl:async()=>{assert.equal(calls.length,1);return graph();}});
 let done=false;const result=handler(request()).then(value=>{done=true;return value;});
 await Promise.race([submitted,result.then(()=>{throw Error('Handler finished before persistence');})]);assert.equal(done,false);release();const response=await result;assert.equal(response.status,200);assert.deepEqual(await response.json(),{});
});

test('authenticated route, mapping, Graph and persistence failures request retry without leaking details',async()=>{
 let fetched=0;
 const denied=createMetaWebhookHandler(meta,{client:{query:async()=>{throw Error('synthetic-private-db-diagnostic');}},fetchImpl:async()=>{fetched++;return graph();}});
 const response=await denied(request());assert.equal(response.status,503);assert.equal(fetched,0);assert.equal((await response.text()).includes('synthetic-private'),false);
 const graphFailure=createMetaWebhookHandler(meta,{client:{query:async()=>({rows:[{allowed:true}]})},fetchImpl:async()=>new Response('synthetic-page-token',{status:401})});assert.equal((await graphFailure(request())).status,503);
 const missingReceipt=createGoogleWebhookHandler(google,{client:{query:async sql=>sql.includes('authorize')?{rows:[{allowed:true}]}:{rows:[{result:{replayed:true}}]}}});assert.equal((await missingReceipt(googleRequest())).status,503);
 const databaseFailure=createGoogleWebhookHandler(google,{client:{query:async(sql)=>{if(sql.includes('authorize'))return {rows:[{allowed:true}]};throw Error('synthetic-private-db-diagnostic');}}});assert.equal((await databaseFailure(googleRequest())).status,503);
});

test('Google returns the documented empty acknowledgement only after authenticated durable submission',async()=>{
 let calls=0;const handler=createGoogleWebhookHandler(google,{client:{query:async(sql,args)=>{calls++;if(sql.includes('authorize'))return {rows:[{allowed:true}]};assert.equal(args[0].provider,'google_ads');assert.equal(args[0].external_page_id,null);return {rows:[{result:{application_id:'019a3d00-0000-7000-8000-000000000001',replayed:true}}]};}}});
 assert.equal((await handler(googleRequest(googleBody.replace(google.google_key,'invalid')))).status,403);assert.equal(calls,0);
 const response=await handler(googleRequest());assert.equal(response.status,200);assert.deepEqual(await response.json(),{});assert.equal(calls,2);assert.match(response.headers.get('cache-control'),/no-store/);
});

test('webhooks reject oversized or malformed streamed bodies and unsupported content types',async()=>{
 const handler=createGoogleWebhookHandler(google,{client:{query:async()=>{throw Error('Unexpected database call');}}});
 assert.equal((await handler(googleRequest('x'.repeat(65537)))).status,413);assert.equal((await handler(googleRequest('{'))).status,400);
 assert.equal((await handler(new Request('https://example.invalid/google',{method:'POST',headers:{'content-type':'text/plain'},body:googleBody}))).status,415);
 assert.equal((await handler(new Request('https://example.invalid/google',{method:'POST',headers:{'content-type':'application/json'},body:new Uint8Array([255])}))).status,400);
 const broken=new ReadableStream({start(controller){controller.error(Error('Synthetic body transport failure'));}});assert.equal((await handler(new Request('https://example.invalid/google',{method:'POST',headers:{'content-type':'application/json'},body:broken,duplex:'half'}))).status,503);
});

test('a stalled body expires without accepting a partial JSON document',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const handler=createGoogleWebhookHandler(google,{client:{query:async()=>{throw Error('Unexpected database call');}}});
 const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(googleBody));}}),request=new Request('https://example.invalid/google',{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'});
 const response=handler(request);t.mock.timers.tick(10000);assert.equal((await response).status,503);
});
