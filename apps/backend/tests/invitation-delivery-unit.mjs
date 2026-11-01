import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {build} from 'esbuild';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {configure,configurationSql,project} from '../scripts/configure-invitation-delivery.mjs';
const compiled=await build({entryPoints:['supabase/functions/backend-v1/invitation-delivery.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {invitationTick}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const workerSigning='a'.repeat(64),service='synthetic-invitation-service-key',now=Date.now(),at=String(Math.floor(now/1000)),env=n=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:service,FTK_INVITATION_TICK_SECRET:workerSigning})[n];
async function request({time=at,request_id=id(),body,signingKey}={}){
 signingKey??=workerSigning;
 const signature=createHmac('sha256',signingKey).update(time+'.'+request_id).digest('hex');
 return new Request('https://test.supabase.co/functions/v1/backend-v1/invitation_delivery_tick',{method:'POST',headers:{'x-ftk-worker-time':time,'x-ftk-worker-signature':signature},body:JSON.stringify(body??{request_id})});
}
async function fixture({provider=()=>Response.json({id:id()}),authorized=true,failFinish=false,claimOverride}={}){
 const enc=new TextEncoder(),token='a'.repeat(64),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(service)),'AES-GCM',false,['encrypt']);
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(token));
 const claim={job_id:id(),org_id:id(),invitation_id:id(),lease_token:'synthetic-private-lease',recipient:'recipient@ftksaas.invalid',sealed_token:JSON.stringify({iv:Buffer.from(iv).toString('base64'),cipher:Buffer.from(cipher).toString('base64')}),from_email:'sender@ftksaas.invalid',app_origin:'https://app.ftksaas.invalid',api_key:'synthetic-provider-key'};
 const rpc=[],sent=[];
 const send=async(url,options)=>{
  assert(options.signal,'every network call must have an abort signal');
  if(url==='https://api.resend.com/emails'){sent.push({headers:options.headers,body:JSON.parse(options.body)});return provider();}
  assert.equal(url,'https://test.supabase.co/rest/v1/rpc/outbox_deliver_v1');assert.equal(options.headers.authorization,'Bearer '+service);
  const body=JSON.parse(options.body);assert.equal(body.p_actor_auth_id,null);assert.equal(body.p_session_id,null);rpc.push(body);
  if(body.p_aux.invitation_phase==='claim')return Response.json({_internal_invitation:claimOverride===undefined?claim:claimOverride});
  if(body.p_aux.invitation_phase==='authorize')return Response.json({authorized});
  if(failFinish)return new Response('',{status:503});return Response.json({state:'succeeded'});
 };
 return {claim,token,rpc,sent,send,run:async()=>invitationTick(await request(),env,send,now)};
}
test('invitation tick rejects unsigned, expired, future, wrong-purpose and extra-field requests before RPC',async()=>{
 let calls=0;const send=async()=>{calls++;throw Error('must not run');};
 const unsigned=new Request('https://test.supabase.co',{method:'POST',body:JSON.stringify({request_id:id()})});assert.equal((await invitationTick(unsigned,env,send,now)).status,403);
 for(const options of [{time:String(Number(at)-60)},{time:String(Number(at)+60)},{signingKey:'different-purpose'}, {body:{request_id:id(),org_id:id()}}]){
  assert([400,403].includes((await invitationTick(await request(options),env,send,now)).status));
 }
 assert.equal(calls,0);
});
test('worker signing is independent of the service-role credential and missing config fails closed',async()=>{
 const workerKey='b'.repeat(64);let calls=0;
 const send=async()=>{calls++;return Response.json({_internal_invitation:null});};
 const workerEnv=n=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'a-different-valid-internal-credential',FTK_INVITATION_TICK_SECRET:workerKey})[n];
 const res=await invitationTick(await request({signingKey:workerKey}),workerEnv,send,now);
 assert.equal(res.status,200);assert.deepEqual(await res.json(),{claimed:0});assert.equal(calls,1);
 for(const absent of [undefined,'invalid']){
  const unavailable=n=>n==='FTK_INVITATION_TICK_SECRET'?absent:workerEnv(n);
  assert.equal((await invitationTick(await request({signingKey:workerKey}),unavailable,send,now)).status,503);
 }
 assert.equal(calls,1);
});
test('invitation delivery decrypts only for an authorized claim and returns no token, recipient, key or lease',async()=>{
 const f=await fixture();const res=await f.run();assert.equal(res.status,200);const text=await res.text();
 for(const value of [f.token,f.claim.recipient,f.claim.api_key,f.claim.lease_token,service])assert(!text.includes(value));
 assert.deepEqual(JSON.parse(text),{claimed:1,accepted:true});assert.equal(f.sent.length,1);
 assert.equal(f.sent[0].headers['Idempotency-Key'],'ftksaas-invitation/'+f.claim.job_id);
 assert(f.sent[0].body.text.includes('https://app.ftksaas.invalid/invite#token='+f.token));assert(!f.sent[0].body.text.includes('?token='));
 assert.equal(f.rpc.at(-1).p_aux.invitation_phase,'finish');assert.match(f.rpc.at(-1).p_aux.provider_reference,/^[a-f0-9-]{36}$/);
});
test('revocation between claim and send prevents provider invocation',async()=>{
 const f=await fixture({authorized:false});assert.equal((await f.run()).status,200);assert.equal(f.sent.length,0);assert.equal(f.rpc.at(-1).p_aux.retryable,false);
});
test('provider rejection distinguishes permanent errors from bounded retryable or unknown outcomes',async()=>{
 for(const [status,body,retryable] of [[422,{},false],[401,{},false],[429,{},true],[503,{},true],[409,{name:'concurrent_idempotent_requests'},true],[409,{name:'invalid_idempotency_key'},false],[200,{},true]]){
  const f=await fixture({provider:()=>Response.json(body,{status})});assert.equal((await f.run()).status,200);assert.equal(f.rpc.at(-1).p_aux.retryable,retryable);assert.equal(f.rpc.at(-1).p_aux.provider_reference,undefined);
 }
 const f=await fixture({provider:()=>{throw new DOMException('synthetic timeout','TimeoutError');}});await f.run();assert.equal(f.rpc.at(-1).p_aux.retryable,true);
});
test('provider retries preserve the identical idempotency key and payload',async()=>{
 const f=await fixture({provider:()=>Response.json({}, {status:503})});await f.run();await f.run();assert.equal(f.sent.length,2);assert.deepEqual(f.sent[0],f.sent[1]);
});
test('lost completion is surfaced and an empty/replayed claim never sends',async()=>{
 const f=await fixture({failFinish:true});assert.equal((await f.run()).status,503);
 const empty=await fixture({claimOverride:null});assert.deepEqual(await (await empty.run()).json(),{claimed:0});assert.equal(empty.sent.length,0);
});
test('invitation installation defaults to read-only and scopes credentials to the explicit tenant',async()=>{
 const calls=[],org=id();const source={org,origin:'https://app.ftksaas.invalid',from:'sender@ftksaas.invalid',providerKey:'re_synthetic_provider',anonKey:'synthetic-anon',signingKey:workerSigning};
 const query=configurationSql(source);assert(query.includes(Buffer.from('ftk_invitation_resend_'+org).toString('hex')));assert(!query.includes(service));
 for(const change of [{origin:'http://app.ftksaas.invalid'},{origin:'https://app.ftksaas.invalid/other'},{from:'sender@ftksaas.invalid\r\nBcc: other@ftksaas.invalid'},{org:"';invalid"}])assert.throws(()=>configurationSql({...source,...change}));
 const adversarial=configurationSql({...source,from:'sender+$config$@ftksaas.invalid',providerKey:'re_$config$quote\'payload'});assert.equal(adversarial.split('$config$').length,3);assert(!adversarial.includes('quote\'payload'));
 const result=await configure({org,origin:source.origin,from:source.from,token:'synthetic-management-token',providerKey:source.providerKey,signingKey:source.signingKey,request:async(url,options)=>{
  calls.push({url,method:options.method});assert(url.startsWith('https://api.supabase.com/v1/projects/'+project));
  if(url.endsWith('/config/auth'))return Response.json({});return Response.json([{name:'anon',api_key:source.anonKey},{name:'service_role',api_key:service}]);
 }});assert.equal(result.mode,'read-only');assert(calls.every(c=>c.method==='GET'));assert(!JSON.stringify(result).includes('synthetic'));
});
test('installation synchronizes the scoped Edge secret before scheduling and stops on secret update failure',async()=>{
 const signingKey='c'.repeat(64),org=id();
 for(const failSecret of [false,true]){
  const phases=[];let configuredSql='';
  const request=async(url,options)=>{
   if(url.endsWith('/api-keys?reveal=true'))return Response.json([{name:'anon',api_key:'synthetic-anon'}]);
   const body=JSON.parse(options.body);
   if(url.endsWith('/secrets')){phases.push('secret');assert.deepEqual(body,[{name:'FTK_INVITATION_TICK_SECRET',value:signingKey}]);return Response.json({}, {status:failSecret?503:201});}
   assert(url.endsWith('/database/query'));
   if(body.query.startsWith('do $config$')){phases.push('config');configuredSql=body.query;return Response.json([]);}
   if(body.query.includes('cron.schedule')){phases.push('scheduler');return Response.json([]);}
   return Response.json([{enabled:true,enabled_tenants:1,scheduler_count:1}]);
  };
  const run=()=>configure({org,origin:'https://app.ftksaas.invalid',from:'sender@ftksaas.invalid',apply:true,token:'synthetic-management-token',providerKey:'re_synthetic_provider',signingKey,request});
  if(failSecret){await assert.rejects(run,/HTTP 503/);assert.deepEqual(phases,['config','secret']);}
  else{const result=await run();assert.equal(result.mode,'applied');assert(!JSON.stringify(result).includes(signingKey));assert.deepEqual(phases,['config','secret','scheduler']);}
  assert(configuredSql.includes(Buffer.from(signingKey).toString('hex')),'the Vault and Edge must receive the same signing value');
 }
});
