import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {signPublicRequest} from '../scripts/p04-public-ingress.mjs';
import {spaIngress} from '../transports/spa-ingress-worker.mjs';
const env={FTK_BROWSER_ORIGINS:'https://app.ftksaas.invalid',FTK_PUBLIC_BACKEND_ORIGIN:'https://backend.supabase.co',FTK_PUBLIC_ANON_KEY:'synthetic-anon',FTK_PUBLIC_INGRESS_SECRET:randomBytes(32).toString('hex')};
const input={client_api_version:1,request_id:id(),email:'user@ftksaas.invalid'};
function request(body=input,headers={},cf=true){
 const req=new Request('https://ingress.workers.dev/api/auth/signup-check',{method:'POST',body:JSON.stringify(body),headers:{origin:'https://app.ftksaas.invalid','content-type':'application/json','cf-connecting-ip':'192.0.2.81','x-vercel-forwarded-for':'198.51.100.2','x-forwarded-for':'198.51.100.3','x-ftk-client-ip':'198.51.100.4','x-ftk-ingress-signature':'forged',...headers}});
 if(cf)Object.defineProperty(req,'cf',{value:{colo:'TEST'}});return req;
}
test('SPA signup signs only Cloudflare connection IP and excludes caller authority',async()=>{
 let calls=0;const fetcher=async(url,init)=>{
  calls++;assert.equal(url,env.FTK_PUBLIC_BACKEND_ORIGIN+'/functions/v1/backend-v1/account_signup_check_v1');
  const expected=signPublicRequest(init.body,'192.0.2.81',env.FTK_PUBLIC_INGRESS_SECRET,'/functions/v1/backend-v1/account_signup_check_v1');
  assert.equal(init.headers['x-ftk-client-ip'],expected['x-ftk-client-ip']);assert.equal(init.headers['x-ftk-ingress-signature'],expected['x-ftk-ingress-signature']);
  assert.equal(init.headers.authorization,'Bearer synthetic-anon');assert.equal(init.headers.cookie,undefined);
  return Response.json({ok:true,data:{status:'available',email:'private'},trace_id:id()});
 };
 const res=await spaIngress(request(),env,fetcher);assert.equal(res.status,200);assert.equal(res.headers.get('access-control-allow-origin'),'https://app.ftksaas.invalid');assert.deepEqual((await res.json()).data,{status:'available'});
 for(const headers of [{origin:'https://evil.invalid'},{'cf-connecting-ip':'broken'},{'cf-connecting-ip':'192.0.2.81, 198.51.100.3'},{'cf-worker':'foreign.invalid'}])assert.notEqual((await spaIngress(request(input,headers),env,fetcher)).status,200);
 assert.notEqual((await spaIngress(request(input,{},false),env,fetcher)).status,200);assert.equal(calls,1);
});
test('SPA signup rejects credential fields, handles preflight and preserves safe errors',async()=>{
 assert.equal((await spaIngress(request({...input,password:'do-not-forward'}),env,()=>{throw Error();})).status,400);
 const options=new Request('https://ingress.workers.dev/api/auth/signup-check',{method:'OPTIONS',headers:{origin:'https://app.ftksaas.invalid','access-control-request-method':'POST','access-control-request-headers':'content-type'}});
 assert.equal((await spaIngress(options,env)).status,204);
 const res=await spaIngress(request(),env,async()=>Response.json({ok:false,error:{code:'RATE_LIMITED',trace_id:id(),debug:'private'}}));assert.deepEqual(Object.keys((await res.json()).error).sort(),['code','retryable','trace_id']);
 assert.equal((await spaIngress(request(),env,async()=>{throw Error('private');})).status,503);
});

test('SPA public application uses the unchanged wire, exact HMAC route and safe failure envelope',async()=>{
 const body={client_api_version:1,request_id:id(),publication_id:id(),contact:'student@ftksaas.invalid',bot_proof:'provider-proof',client_request_key:id()};
 const req=request(body);const publicReq=new Request('https://ingress.workers.dev/api/public/application',req);Object.defineProperty(publicReq,'cf',{value:req.cf});
 let calls=0;
 const response=await spaIngress(publicReq,env,async(url,init)=>{calls++;assert.equal(url,env.FTK_PUBLIC_BACKEND_ORIGIN+'/functions/v1/backend-v1/public_application_submit_v1');assert.deepEqual(JSON.parse(init.body),body);assert.equal(init.headers['x-ftk-client-ip'],'192.0.2.81');return Response.json({ok:true,data:{accepted:true},trace_id:id()});});
 assert.equal(response.status,200);assert.deepEqual((await response.json()).data,{accepted:true});assert.equal(calls,1);
 const invalid=new Request('https://ingress.workers.dev/api/public/application',request({...body,org_id:id()}));Object.defineProperty(invalid,'cf',{value:req.cf});
 assert.equal((await spaIngress(invalid,env,()=>{throw Error('must not fetch');})).status,400);
});
test('SPA anonymous calendar validates the published DTO and never forwards session or IP authority',async()=>{
 const payload={client_api_version:1,request_id:id(),slug:id(),interval:{starts_at:'2026-11-14T00:00:00Z',ends_at:'2026-11-15T00:00:00Z'},page:{}};
 const req=new Request('https://ingress.workers.dev/api/public/calendar',request(payload));
 const result={ok:true,data:{items:[],next_cursor:null,as_of:'2026-11-13T00:00:00Z',organization_profile:null,center_profile:null},trace_id:id()};
 const res=await spaIngress(req,env,async(url,init)=>{assert.equal(url,env.FTK_PUBLIC_BACKEND_ORIGIN+'/functions/v1/backend-v1/public_calendar_get_v1');assert.equal(init.headers.authorization,'Bearer synthetic-anon');assert.equal(init.headers['x-ftk-client-ip'],undefined);return Response.json(result);});
 assert.equal(res.status,200);assert.deepEqual(await res.json(),result);
 const corrupt=await spaIngress(new Request('https://ingress.workers.dev/api/public/calendar',request(payload)),env,async()=>Response.json({...result,private:'hidden'}));assert.equal(corrupt.status,503);
});

test('Worker entry uses runtime context separately from its upstream fetch function',async()=>{
 const {default:worker}=await import('../transports/spa-ingress-worker.mjs');
 const previous=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({ok:true,data:{status:'available'},trace_id:id()});};
  const response=await worker.fetch(request(),env,{waitUntil(){throw Error('Unexpected background work');}});
  assert.equal(response.status,200);assert.equal((await response.json()).data.status,'available');assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});

test('Turnstile admits explicitly configured SPA and existing hostnames together',async()=>{
 const {build}=await import('esbuild');const compiled=await build({entryPoints:['supabase/functions/backend-v1/public-ingress.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {verifyPublicBot}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const cfg={FTK_TURNSTILE_SECRET:'synthetic-provider',FTK_PUBLIC_APPLICATION_HOSTNAME:'existing.ftksaas.invalid',FTK_PUBLIC_APPLICATION_HOSTNAMES:'spa.ftksaas.invalid'};
 const verify=(hostname,action='public_application')=>verifyPublicBot('proof','192.0.2.81',k=>cfg[k],async()=>Response.json({success:true,hostname,action}));
 assert.equal(await verify('existing.ftksaas.invalid'),true);assert.equal(await verify('spa.ftksaas.invalid'),true);
 assert.equal(await verify('evil.invalid'),false);assert.equal(await verify('spa.ftksaas.invalid','wrong_action'),false);
 cfg.FTK_PUBLIC_APPLICATION_HOSTNAMES='*';assert.equal(await verify('existing.ftksaas.invalid'),false);
});

test('dedicated SPA ingress key preserves legacy signatures and the same authoritative rate identity',async()=>{
 const {build}=await import('esbuild');const compiled=await build({entryPoints:['supabase/functions/backend-v1/public-ingress.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const {publicIngress}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const cfg={FTK_PUBLIC_INGRESS_SECRET:randomBytes(32).toString('hex'),FTK_SPA_INGRESS_SECRET:randomBytes(32).toString('hex'),FTK_PUBLIC_HASH_SECRET:'synthetic-common-public-hash-secret'};
 const path='/functions/v1/backend-v1/account_signup_check_v1',body=JSON.stringify(input);let hash;
 for(const secret of [cfg.FTK_PUBLIC_INGRESS_SECRET,cfg.FTK_SPA_INGRESS_SECRET]){
  const req=new Request('https://edge.invalid'+path,{method:'POST',headers:signPublicRequest(body,'192.0.2.81',secret,path),body});
  const accepted=await publicIngress(req,body,k=>cfg[k]);assert(accepted);if(hash)assert.equal(accepted.ip_hash,hash);hash=accepted.ip_hash;
 }
 const headers=signPublicRequest(body,'192.0.2.81','synthetic-untrusted-ingress-secret-32-bytes',path);
 assert.equal(await publicIngress(new Request('https://edge.invalid'+path,{method:'POST',headers,body}),body,k=>cfg[k]),null);
});

test('calendar diagnostics expose only fixed stage and status when explicitly enabled',async()=>{
 const {publicCalendarGateway}=await import('../transports/public-calendar-gateway.mjs');
 const payload={client_api_version:1,request_id:id(),slug:id(),interval:{starts_at:'2026-11-14T00:00:00Z',ends_at:'2026-11-15T00:00:00Z'},page:{}};
 for(const enabled of [undefined,'1']){
  const req=request(payload);const res=await publicCalendarGateway(req,{...env,FTK_SPA_DIAGNOSTICS:enabled},async()=>new Response('private provider diagnostic',{status:502}));
  assert.equal(res.status,503);assert.equal(res.headers.get('x-ftk-ingress-failure'),enabled?'upstream-body':null);assert.equal(res.headers.get('x-ftk-upstream-status'),enabled?'502':null);assert(!(await res.text()).includes('private'));
 }
});

test('Cloudflare ingress uses manual redirects and rejects upstream relocation without forwarding credentials',async()=>{
 const req=request();let calls=0,redirect;
 const response=await spaIngress(req,env,async(url,init)=>{calls++;redirect=init.redirect;return Response.json({ok:false,error:{code:'TEMPORARY_FAILURE',retryable:true,trace_id:id()}},{status:302,headers:{location:'https://foreign.invalid/collect'}});});
 assert.equal(redirect,'manual','Workers do not implement redirect:error');assert.equal(calls,1);assert.equal(response.status,503);assert.equal((await response.json()).error.code,'TEMPORARY_FAILURE');
});

test('native clients share the same public ingress without Origin and cannot choose IP or credentials',async()=>{
 const req=request();req.headers.delete('origin');req.headers.set('authorization','Bearer caller-private-token');let sent;
 const res=await spaIngress(req,env,async(url,init)=>{sent=init;return Response.json({ok:true,data:{status:'available'},trace_id:id()});});
 assert.equal(res.status,200);assert.equal((await res.json()).data.status,'available');assert.equal(res.headers.get('access-control-allow-origin'),null);
 assert.equal(sent.headers.authorization,'Bearer synthetic-anon');assert.equal(sent.headers['x-ftk-client-ip'],'192.0.2.81');assert.equal(sent.headers.cookie,undefined);
 const bad=request();bad.headers.set('origin','null');assert.equal((await spaIngress(bad,env,()=>{throw Error('must not forward');})).status,403);
});
