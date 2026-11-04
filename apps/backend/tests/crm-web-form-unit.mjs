import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {mapCrmWebForm,createCrmWebFormHandler} from '../transports/crm-web-form-gateway.mjs';
const id='019a4c1d-7000-7000-8000-000000000001';
const config={form_id:id,consent:{purpose:'synthetic-contact',version:'synthetic-v1'},marketingConsent:{purpose:'synthetic-marketing',version:'synthetic-v2'}};
const delivery={request_id:id,client_request_key:id,bot_proof:'synthetic-proof',submitted_at:'2026-01-01T00:00:00.000Z'};
const contact={...delivery,name:'Synthetic lead',phone:'00 90 (555) 000-00.01',level:'beginner',consent:true,marketingConsent:false};
const schema=JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url)));
const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(schema,'contract');
const valid=ajv.getSchema('contract#/$defs/Request_public_application_submit');
const env={FTK_PUBLIC_APPLICATION_HOSTNAME:'forms.example.invalid',FTK_PUBLIC_INGRESS_SECRET:'synthetic-32-byte-gateway-ingress-secret',FTK_PUBLIC_ANON_KEY:'synthetic-anon-jwt'};
const request=(input=contact,headers={},path='/api/contact')=>new Request('https://forms.example.invalid'+path,{method:'POST',headers:{origin:'https://forms.example.invalid','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.30',...headers},body:typeof input==='string'?input:JSON.stringify(input)});

test('contact maps legacy fields and separate positive/negative consent evidence to the published request',()=>{
 const result=mapCrmWebForm('contact',contact,config);
 assert(valid(result),JSON.stringify(valid.errors));
 assert.equal(result.form_id,id);assert.equal(result.intake.display_name,contact.name);assert.equal(result.intake.phone,contact.phone);assert.equal(result.intake.interest,'beginner');
 assert.deepEqual(result.intake.consents,[{...config.consent,accepted:true,occurred_at:delivery.submitted_at},{...config.marketingConsent,accepted:false,occurred_at:delivery.submitted_at}]);
 assert.equal(result.client_request_key,delivery.client_request_key);assert.equal(result.bot_proof,delivery.bot_proof);
 assert.equal(result.center_id,undefined);assert.equal(result.publication_id,undefined);
});

test('kayit retains partner, mode and all claimed attribution; equivalent retry is stable',()=>{
 const {name,...common}=contact;
 const input={...common,fullName:name,mode:'paired',partnerName:'Synthetic partner',attribution:{campaign_id:'campaign',ad_id:'ad',utm_source:'source',utm_medium:'medium',utm_campaign:'campaign',utm_term:'term',utm_content:'content',page_url:'https://example.invalid/tr/kayit'}};
 const result=mapCrmWebForm('kayit',input,config);
 assert(valid(result),JSON.stringify(valid.errors));assert.equal(result.intake.partner_name,input.partnerName);assert.equal(result.intake.mode,input.mode);assert.deepEqual(result.intake.attribution,input.attribution);
 assert.deepEqual(mapCrmWebForm('kayit',JSON.parse(JSON.stringify(input)),config),result);
 const newer=mapCrmWebForm('kayit',{...input,client_request_key:'019a4c1d-7000-7000-8000-000000000002'},config);assert.notEqual(newer.client_request_key,result.client_request_key);
 assert.deepEqual(newer.intake,result.intake);
});

test('missing evidence/config and unknown scope or source fields cannot become a signed request',()=>{
 for(const field of ['client_request_key','request_id','bot_proof','submitted_at','consent','marketingConsent']){const input={...contact};delete input[field];assert.throws(()=>mapCrmWebForm('contact',input,config),/VALIDATION/);}
 for(const patch of [{consent:'true'},{marketingConsent:1},{submitted_at:'invalid'},{phone:123},{name:''},{level:'x'.repeat(1001)},{form_id:id},{org_id:id},{source:'facebook'},{attribution:{provider_verified:true}},{fullName:'wrong dialect'}])assert.throws(()=>mapCrmWebForm('contact',{...contact,...patch},config),/VALIDATION/);
 for(const patch of [{form_id:'bad'},{consent:{purpose:'a'}},{marketingConsent:{...config.consent}},{center_id:id},{consent:{...config.consent,accepted:true}}])assert.throws(()=>createCrmWebFormHandler('contact',{...config,...patch},env),/CONFIG/);
 assert.throws(()=>createCrmWebFormHandler('unknown',config,env),/CONFIG/);
});

test('gateway signs only mapped bytes with trusted platform IP and scrubs upstream response',async()=>{
 let sent;
 const gateway=createCrmWebFormHandler('contact',config,env,async(url,options)=>{
  assert.equal(url,'https://gwyprhenabtpkbojephw.supabase.co/functions/v1/backend-v1/public_application_submit_v1');sent=JSON.parse(options.body);assert(valid(sent));
  const h=options.headers;assert.equal(h['x-ftk-client-ip'],'192.0.2.30');assert.equal(h.cookie,undefined);assert.equal(h.authorization,'Bearer '+env.FTK_PUBLIC_ANON_KEY);
  const digest=createHash('sha256').update(options.body).digest('hex');
  const expected=createHmac('sha256',env.FTK_PUBLIC_INGRESS_SECRET).update(['POST',new URL(url).pathname,h['x-ftk-ingress-time'],'192.0.2.30',digest].join('\n')).digest('hex');assert.equal(h['x-ftk-ingress-signature'],expected);
  return Response.json({ok:true,data:{accepted:true},trace_id:id},{headers:{'set-cookie':'must-not-leak'}});
 });
 const response=await gateway(request(contact,{authorization:'Bearer caller',cookie:'caller=secret','x-ftk-ingress-signature':'forged'}));
 assert.equal(response.status,200);assert.deepEqual(sent,mapCrmWebForm('contact',contact,config));assert.deepEqual(await response.json(),{ok:true,data:{accepted:true},trace_id:id});assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store');
});

test('bad origin, route, size, evidence or IP never reaches backend; no false success on upstream error',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('synthetic upstream timeout');};const gateway=createCrmWebFormHandler('contact',config,env,fetcher);
 for(const req of [request(contact,{origin:'https://other.invalid'}),request(contact,{},'/api/kayit'),request(contact,{'x-vercel-forwarded-for':'192.0.2.30, 192.0.2.31'}),request(contact,{'content-type':'text/plain'}),request('x'.repeat(65537)),request('{'),request({...contact,org_id:id})])assert.notEqual((await gateway(req)).status,200);
 assert.equal(calls,0);
 const failed=await gateway(request());assert.equal(calls,1);assert.equal(failed.status,503);assert.equal((await failed.json()).error.code,'TEMPORARY_FAILURE');
 const denied=createCrmWebFormHandler('contact',config,env,async()=>Response.json({ok:false,error:{code:'RATE_LIMITED',retryable:false,trace_id:id}}));assert.equal((await (await denied(request())).json()).error.code,'RATE_LIMITED');
});

test('site adapter reaches real Edge HMAC, counted preflight and CAPTCHA gates before mapped submit',async()=>{
 const {build}=await import('esbuild');
 const built=await build({entryPoints:[new URL('../supabase/functions/backend-v1/handler.ts',import.meta.url).pathname],bundle:true,platform:'browser',format:'esm',write:false});
 const edgeEnv={SUPABASE_URL:'https://supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',FTK_PUBLIC_HASH_SECRET:'synthetic-hash',FTK_TURNSTILE_SECRET:'synthetic-provider',...env};
 const oldDeno=globalThis.Deno,oldFetch=globalThis.fetch;let handler,botAccepted=true;const phases=[];
 try{
  globalThis.Deno={serve:fn=>{handler=fn;},env:{get:key=>edgeEnv[key]}};
  globalThis.fetch=async(url,options)=>{
   if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){
    assert.equal(options.body.get('response'),delivery.bot_proof);assert.equal(options.body.get('remoteip'),'192.0.2.30');
    return Response.json({success:botAccepted,hostname:env.FTK_PUBLIC_APPLICATION_HOSTNAME,action:'public_application'});
   }
   assert.equal(url,'https://supabase.invalid/rest/v1/rpc/public_application_submit_v1');
   const rpc=JSON.parse(options.body);phases.push(rpc.p_aux.phase);assert.deepEqual(rpc.p_request,mapCrmWebForm('contact',contact,config));
   assert.equal(rpc.p_aux.target_hash,createHmac('sha256',edgeEnv.FTK_PUBLIC_HASH_SECRET).update('target:+905550000001').digest('hex'));
   return Response.json({ok:true,data:rpc.p_aux.phase==='preflight'?{bot_required:true}:{accepted:true},trace_id:id});
  };
  await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64')+'#crm-web-form');
  const gateway=createCrmWebFormHandler('contact',config,env,(url,options)=>handler(new Request(url,options)));
  const accepted=await gateway(request());assert.equal((await accepted.json()).ok,true);assert.deepEqual(phases,['preflight','submit']);
  phases.length=0;botAccepted=false;
  const rejected=await gateway(request());assert.equal((await rejected.json()).error.code,'BOT_VERIFICATION_FAILED');assert.deepEqual(phases,['preflight']);
 }finally{globalThis.fetch=oldFetch;if(oldDeno===undefined)delete globalThis.Deno;else globalThis.Deno=oldDeno;}
});
