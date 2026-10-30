import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {signPublicRequest} from '../scripts/p04-public-ingress.mjs';
import {handleAccountSignup,signupPath} from '../transports/account-signup-gateway.mjs';
const compiled=await build({entryPoints:['supabase/functions/backend-v1/account-signup.ts'],bundle:true,platform:'browser',format:'esm',write:false});
export const {accountSignup}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
export const signupConfig={FTK_PUBLIC_INGRESS_SECRET:'synthetic-signup-ingress-secret-32-bytes',FTK_PUBLIC_HASH_SECRET:'synthetic-signup-hash-secret-32-bytes'};
export function signupInput(email,extra={},forwarded=false){
 const request={client_api_version:1,request_id:id(),email,password:'Synthetic-signup-password!42',...extra},body=JSON.stringify(request);
 const headers=signPublicRequest(body,'192.0.2.81',signupConfig.FTK_PUBLIC_INGRESS_SECRET,signupPath);
 return {request,body,req:new Request('http://kong:8000'+(forwarded?signupPath.replace('/functions/v1',''):signupPath),{method:'POST',headers,body})};
}
const settings={disable_signup:false,mailer_autoconfirm:false,external:{email:true}};
const run=(input,rpc,fetcher,env=k=>signupConfig[k])=>accountSignup(input.req,input.body,input.request,'http://kong:8000','synthetic-anon',env,rpc,fetcher);

test('XREQ-001: existing result stops native signup; signed ingress, config and normalization',async()=>{
 for(const forwarded of [false,true]){
  const input=signupInput(' EXISTING@ftksaas.invalid ',{},forwarded);let calls=0;
  const result=await run(input,async(r,aux)=>{assert.deepEqual(Object.keys(r).sort(),['client_api_version','email','request_id']);assert.equal(r.email,'existing@ftksaas.invalid');assert.equal(aux.phase,'dispatch');assert.match(aux.target_hash,/^[a-f0-9]{64}$/);return {data:{status:'account_exists'}};},async(url,options)=>{calls++;assert(url.endsWith('/settings'));assert.equal(options.headers.apikey,'synthetic-anon');return Response.json(settings);});
  assert.deepEqual(result,{data:{status:'account_exists'}});assert.equal(calls,1);
 }
 const input=signupInput('new@ftksaas.invalid'),never=()=>{throw Error('must not dispatch');};
 assert.equal((await run({...input,req:new Request(input.req,{headers:{}})},never,never)).error,'TEMPORARY_FAILURE');
 assert.equal((await run(input,never,never,()=>undefined)).error,'TEMPORARY_FAILURE');
 assert.equal((await run(input,never,async()=>Response.json({...settings,mailer_autoconfirm:true}))).error,'SERVICE_UNAVAILABLE');
});

test('XREQ-001: native anonymous signup receives PKCE/redirect/CAPTCHA once; SQL and output receive no credentials',async()=>{
 const input=signupInput('new@ftksaas.invalid',{code_challenge:'a'.repeat(43),code_challenge_method:'s256',email_redirect_to:'https://app.ftksaas.invalid/auth/callback',captcha_token:'synthetic-once'}),attempt=id(),nativeId=id();let posts=0;
 const rpc=async(r,aux)=>{assert.equal(r.password,undefined);assert.equal(r.captcha_token,undefined);assert.equal(r.code_challenge,undefined);if(aux.phase==='dispatch')return {_internal_signup_dispatch:true,attempt_id:attempt};assert.equal(aux.phase,'complete');assert.equal(aux.attempt_id,attempt);assert.equal(aux.auth_user_id,nativeId);return {data:{status:'confirmation_required'}};};
 const fetcher=async(url,options)=>{if(url.endsWith('/settings'))return Response.json(settings);posts++;assert.equal(new URL(url).searchParams.get('redirect_to'),input.request.email_redirect_to);assert.equal(options.headers.apikey,'synthetic-anon');assert.equal(options.headers.authorization,undefined);assert.deepEqual(JSON.parse(options.body),{email:input.request.email,password:input.request.password,code_challenge:input.request.code_challenge,code_challenge_method:'s256',gotrue_meta_security:{captcha_token:'synthetic-once'}});return Response.json({id:nativeId,identities:[{id:id()}],email:'private@ftksaas.invalid',role:'private-role'});};
 assert.deepEqual(await run(input,rpc,fetcher),{data:{status:'confirmation_required'}});assert.equal(posts,1);
});

test('XREQ-001: timeout, malformed response and 5xx never release/retry dispatch; weak password can retry',async()=>{
 for(const outcome of ['timeout','malformed','server','rate','session','obfuscated','weak','captcha']){
  const phases=[],input=signupInput('new@ftksaas.invalid');
  const rpc=async(r,aux)=>{phases.push(aux.phase);return aux.phase==='dispatch'?{_internal_signup_dispatch:true,attempt_id:id()}:{_internal_signup_released:true};};
  const fetcher=async url=>{if(url.endsWith('/settings'))return Response.json(settings);if(outcome==='timeout')throw Error('timeout');if(outcome==='malformed')return new Response('oops');if(outcome==='server')return Response.json({message:'private'}, {status:500});if(outcome==='rate')return Response.json({code:'over_email_send_rate_limit'}, {status:429});if(outcome==='captcha')return Response.json({error_code:'captcha_failed'}, {status:400});if(outcome==='weak')return Response.json({code:'weak_password',message:'private'}, {status:422});if(outcome==='session')return Response.json({access_token:'private-token'});return Response.json({id:id(),identities:[]});};
  const result=await run(input,rpc,fetcher);
  assert.deepEqual(phases,['weak','captcha'].includes(outcome)?['dispatch','reject']:['dispatch']);
  assert.deepEqual(result,outcome==='weak'?{error:'WEAK_PASSWORD'}:outcome==='captcha'?{error:'BOT_VERIFICATION_FAILED'}:outcome==='obfuscated'?{data:{status:'account_exists'}}:{error:'RESULT_NOT_CONFIRMED'});
 }
});

test('XREQ-001: corrected native CAPTCHA retries only after a confirmed claim release',async()=>{
 let claimed=false,posts=0;const input=signupInput('captcha@ftksaas.invalid');
 const rpc=async(r,aux)=>{if(aux.phase==='dispatch'){if(claimed)return {error:'RESULT_NOT_CONFIRMED'};claimed=true;return {_internal_signup_dispatch:true,attempt_id:id()};}if(aux.phase==='reject'){claimed=false;return {_internal_signup_released:true};}return {data:{status:'confirmation_required'}};};
 const fetcher=async url=>{if(url.endsWith('/settings'))return Response.json(settings);posts++;return posts===1?Response.json({error_code:'captcha_failed'},{status:400}):Response.json({id:id(),identities:[{id:id()}]});};
 assert.deepEqual(await run(input,rpc,fetcher),{error:'BOT_VERIFICATION_FAILED'});assert.equal(claimed,false);
 assert.deepEqual(await run(input,rpc,fetcher),{data:{status:'confirmation_required'}});assert.equal(posts,2);
 const failedRelease=async(r,aux)=>aux.phase==='dispatch'?{_internal_signup_dispatch:true,attempt_id:id()}:{error:'TEMPORARY_FAILURE'};
 assert.deepEqual(await run(input,failedRelease,async url=>url.endsWith('/settings')?Response.json(settings):Response.json({code:'weak_password'},{status:422})),{error:'RESULT_NOT_CONFIRMED'});
});

test('XREQ-001: gateway signs the verified connection, strips caller authority and returns a closed safe response',async()=>{
 const env={...signupConfig,FTK_SIGNUP_HOSTNAME:'app.ftksaas.invalid',FTK_PUBLIC_ANON_KEY:'synthetic-anon',FTK_PUBLIC_BACKEND_ORIGIN:'https://backend.supabase.co'};
 const request=(extra={})=>new Request('https://app.ftksaas.invalid/api/signup',{method:'POST',body:'{}',headers:{origin:'https://app.ftksaas.invalid','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.81',authorization:'Bearer caller',cookie:'private','x-ftk-client-ip':'spoof',...extra}});
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.equal(url,env.FTK_PUBLIC_BACKEND_ORIGIN+signupPath);assert.equal(options.headers.authorization,'Bearer synthetic-anon');assert.equal(options.headers.cookie,undefined);assert.equal(options.headers['x-ftk-client-ip'],'192.0.2.81');return Response.json({ok:true,data:{status:'account_exists',email:'private',role:'private'},trace_id:id(),user:'private'});};
 const result=await handleAccountSignup(request(),env,fetcher);assert.equal(result.headers.get('cache-control'),'no-store');const body=await result.json();assert.deepEqual(body.data,{status:'account_exists'});assert.equal(body.user,undefined);assert.equal(calls,1);
 assert.equal((await handleAccountSignup(request({origin:'https://evil.invalid'}),env,fetcher)).status,403);assert.equal(calls,1);
 assert.equal((await handleAccountSignup(request({'x-vercel-forwarded-for':'untrusted, 192.0.2.1'}),env,fetcher)).status,503);assert.equal(calls,1);
});
