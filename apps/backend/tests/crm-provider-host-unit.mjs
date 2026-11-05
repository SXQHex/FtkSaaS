import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderHost,HOST_LIMITS} from '../transports/crm-provider-host.mjs';
const token='synthetic-monitor-token-0123456789abcdef';
const config={monitor_token:token,meta:null,google:null,worker_enabled:false};
const request=(path,init={})=>new Request('https://example.invalid'+path,init);
test('provider host exposes process liveness but disables unconfigured providers and protects monitoring',async()=>{
 let queries=0;const host=createProviderHost(config,{client:{query:async()=>{queries++;throw Error('Unexpected DB');}}});
 assert.equal((await host.handle(request('/healthz'))).status,200);assert.equal((await host.handle(request('/webhooks/meta',{method:'POST',body:'{}'}))).status,503);
 assert.equal((await host.handle(request('/ops/status'))).status,401);assert.equal(queries,0);assert.equal((await host.handle(request('/webhooks/meta/extra'))).status,404);
 const response=await host.handle(request('/ops/status',{headers:{authorization:'Bearer '+token}}));assert.equal(response.status,200);const status=await response.json();assert.equal(status.configured.meta,false);assert.equal(status.worker.enabled,false);assert.equal(status.queue,null);
 await host.stop();
});
test('host telemetry never copies request URLs, authorization, body or arbitrary thrown diagnostics',async()=>{
 const logs=[];const host=createProviderHost(config,{client:{query:async()=>{throw Error('synthetic-private-diagnostic');}},emit:e=>logs.push(e)});
 await host.handle(request('/healthz?token=synthetic-private-token'));await host.handle(request('/ops/status',{headers:{authorization:'Bearer synthetic-private-token'}}));
 assert(logs.length>0);assert(logs.every(e=>e.request_id&&e.entry_point&&Number.isFinite(e.duration_ms)));assert(!JSON.stringify(logs).includes('synthetic-private'));await host.stop();
});
test('scheduler configuration is fail-closed when no Meta route exists',()=>{
 assert.throws(()=>createProviderHost({...config,worker_enabled:true},{client:{query:async()=>({})}}),/HOST_CONFIG/);
 assert(HOST_LIMITS.statement_ms<HOST_LIMITS.http_ms);assert(HOST_LIMITS.worker_ms<HOST_LIMITS.lease_seconds*1000);
});

const meta={app_secret:'synthetic-app-secret',verify_token:'synthetic-verify',routes:[{page_id:'100',form_id:'200',api_version:'v24.0',access_token:'synthetic-page-token',mapping:{fields:{display_name:'full_name',phone:'phone_number'},consents:[],consent_key_field:'checkbox_key',consent_value_field:'is_checked'}}]};
test('worker tick does not overlap and stop prevents every future claim',async()=>{
 let entered,release;const started=new Promise(r=>{entered=r;}),pending=new Promise(r=>{release=r;});let claims=0;
 const host=createProviderHost({...config,meta,worker_enabled:true},{client:{query:async()=>{claims++;entered();await pending;return {rows:[{result:null}]};}},emit:()=>undefined});
 const first=host.tick();await started;assert.deepEqual(await host.tick(),{busy:true});assert.equal(claims,1);release();assert.deepEqual(await first,{claimed:false});await host.stop();assert.deepEqual(await host.tick(),{disabled:true});assert.equal(claims,1);
});
test('HTTP total deadline returns503 and cancels native IO without exposing database diagnostics',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let aborted=0;
 const host=createProviderHost({...config,meta},{client:{query:async()=>new Promise(()=>undefined),abort:()=>{aborted++;}},emit:()=>undefined});
 const result=host.handle(request('/ops/status',{headers:{authorization:'Bearer '+token}}));t.mock.timers.tick(HOST_LIMITS.http_ms);const response=await result;assert.equal(response.status,503);assert(aborted>0);await host.stop();
});
test('scheduler starts once, waits for each run, and stops its timer',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let claims=0;
 const host=createProviderHost({...config,meta,worker_enabled:true},{client:{query:async()=>{claims++;return {rows:[{result:null}]};}},emit:()=>undefined});
 host.startScheduler();host.startScheduler();t.mock.timers.tick(HOST_LIMITS.interval_ms);await new Promise(r=>setImmediate(r));assert.equal(claims,1);
 await host.stop();t.mock.timers.tick(HOST_LIMITS.interval_ms*2);await new Promise(r=>setImmediate(r));assert.equal(claims,1);
});

test('real Node listener forwards the signed raw stream to durable ingress',async t=>{
 const {startProviderServer}=await import('../transports/crm-provider-host.mjs'),{once}=await import('node:events'),{createHmac}=await import('node:crypto');let queries=0;
 const host=createProviderHost({...config,meta},{client:{query:async(sql,args)=>{queries++;assert.match(sql,/crm_meta_enqueue/);assert.equal(JSON.parse(args[0])[0].external_lead_id,'300');return {rows:[{result:{accepted:1}}]};}},emit:()=>undefined}),server=startProviderServer(host,{port:0});
 t.after(async()=>{await host.stop();server.closeAllConnections();await new Promise(r=>server.close(r));});await once(server,'listening');
 const body=JSON.stringify({object:'page',entry:[{id:'100',changes:[{field:'leadgen',value:{page_id:'100',form_id:'200',leadgen_id:'300'}}]}]}),signature=createHmac('sha256',meta.app_secret).update(body).digest('hex');
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/webhooks/meta',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+signature},body});assert.equal(response.status,200);assert.deepEqual(await response.json(),{});assert.equal(queries,1);
});
test('host body deadline expires before database admission',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let queries=0;const host=createProviderHost({...config,meta},{client:{query:async()=>{queries++;}},emit:()=>undefined});
 const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));}}),result=host.handle(request('/webhooks/meta',{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'}));
 t.mock.timers.tick(HOST_LIMITS.body_ms);assert.equal((await result).status,503);assert.equal(queries,0);await host.stop();
});

test('host bounds concurrent native work and keeps liveness available under saturation',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let queries=0;const host=createProviderHost({...config,meta},{client:{query:async()=>{queries++;return new Promise(()=>undefined);},abort:()=>undefined},emit:()=>undefined});
 const pending=Array.from({length:HOST_LIMITS.max_inflight},()=>host.handle(request('/ops/status',{headers:{authorization:'Bearer '+token}})));
 assert.equal((await host.handle(request('/ops/status',{headers:{authorization:'Bearer '+token}}))).status,503);assert.equal(queries,HOST_LIMITS.max_inflight);assert.equal((await host.handle(request('/healthz'))).status,200);
 t.mock.timers.tick(HOST_LIMITS.http_ms);assert((await Promise.all(pending)).every(r=>r.status===503));await host.stop();
});
test('worker deadline does not allow a second run while the underlying claim is still settling',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let release,queries=0;const pending=new Promise(r=>{release=r;});
 const host=createProviderHost({...config,meta,worker_enabled:true},{client:{query:async()=>{queries++;await pending;return {rows:[{result:null}]};},abort:()=>undefined},emit:()=>undefined});
 const tick=host.tick();t.mock.timers.tick(HOST_LIMITS.worker_ms);await assert.rejects(tick,/HOST_WORKER_UNAVAILABLE/);assert.deepEqual(await host.tick(),{busy:true});assert.equal(queries,1);release();await new Promise(r=>setImmediate(r));await host.stop();
});
