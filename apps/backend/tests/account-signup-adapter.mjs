import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {signPublicRequest} from '../scripts/p04-public-ingress.mjs';
import {handleAccountSignupCheck,signupPath} from '../transports/account-signup-gateway.mjs';
const compiled=await build({entryPoints:['supabase/functions/backend-v1/account-signup.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {accountSignupCheck}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const cfg={FTK_PUBLIC_INGRESS_SECRET:'synthetic-signup-ingress-secret-32-bytes',FTK_PUBLIC_HASH_SECRET:'synthetic-signup-hash-secret-32-bytes'};
const input={client_api_version:1,request_id:id(),email:' USER@ftksaas.invalid '},body=JSON.stringify(input);
test('email-only lookup requires trusted ingress and normalizes authoritative lookup input',async()=>{
 let calls=0;const rpc=async(r,aux)=>{calls++;assert.deepEqual(r,{...input,email:'user@ftksaas.invalid'});assert.deepEqual(Object.keys(aux),['ip_hash']);assert.match(aux.ip_hash,/^[a-f0-9]{64}$/);return {data:{status:'account_exists'}};};
 assert.deepEqual(await accountSignupCheck(new Request('https://example.invalid'+signupPath),body,input,k=>cfg[k],rpc),{error:'TEMPORARY_FAILURE'});assert.equal(calls,0);
 for(const path of [signupPath,signupPath.replace('/functions/v1','')]){
  const req=new Request('https://example.invalid'+path,{method:'POST',body,headers:signPublicRequest(body,'192.0.2.81',cfg.FTK_PUBLIC_INGRESS_SECRET,signupPath)});
  assert.deepEqual(await accountSignupCheck(req,body,input,k=>cfg[k],rpc),{data:{status:'account_exists'}});
 }
 assert.equal(calls,2);
});
test('signup check gateway excludes credentials, strips private response fields and never owns signup',async()=>{
 const env={...cfg,FTK_SIGNUP_HOSTNAME:'app.ftksaas.invalid',FTK_PUBLIC_ANON_KEY:'synthetic-anon',FTK_PUBLIC_BACKEND_ORIGIN:'https://backend.supabase.co'};
 const req=(payload=input,origin='https://app.ftksaas.invalid')=>new Request('https://app.ftksaas.invalid/api/signup-check',{method:'POST',body:JSON.stringify(payload),headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.81',authorization:'Bearer caller',cookie:'private','x-ftk-client-ip':'spoof'}});
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.equal(url,env.FTK_PUBLIC_BACKEND_ORIGIN+signupPath);assert.equal(options.headers.authorization,'Bearer synthetic-anon');assert.equal(options.headers.cookie,undefined);assert.equal(options.headers['x-ftk-client-ip'],'192.0.2.81');assert.deepEqual(JSON.parse(options.body),input);return Response.json({ok:true,data:{status:'account_exists',email:'private',role:'private'},trace_id:id(),user:'private'});};
 const res=await handleAccountSignupCheck(req(),env,fetcher);assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');const out=await res.json();assert.deepEqual(out.data,{status:'account_exists'});assert.equal(out.user,undefined);
 for(const extra of [{password:'must-not-forward'},{code_challenge:'must-not-forward'},{role:'owner'}])assert.equal((await handleAccountSignupCheck(req({...input,...extra}),env,fetcher)).status,400);
 assert.equal((await handleAccountSignupCheck(req(input,'https://foreign.invalid'),env,fetcher)).status,403);assert.equal(calls,1);
 const failed=await handleAccountSignupCheck(req(),env,async()=>{throw Error('outage');});assert.equal(failed.status,503);assert.equal((await failed.json()).error.code,'TEMPORARY_FAILURE');
 const available=await handleAccountSignupCheck(req(),env,async()=>Response.json({ok:true,data:{status:'available'},trace_id:id()}));assert.equal((await available.json()).data.status,'available');
});
