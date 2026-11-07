import test from 'node:test';
import assert from 'node:assert/strict';
import {cliFailure,managementRequest} from '../scripts/ci/deploy-development.mjs';

test('CLI diagnostics classify provider and local failures without retaining output',()=>{
 for(const [stderr,category,http_status] of [
  ['HTTP 403 Forbidden: token='+'synthetic-private-value','authorization',403],
  ['status code: 413 request too large','request_size',413],
  ['failed to bundle module: source contains private data','bundle',null],
  ['unknown flag: --unsupported','configuration',null],
  ['request failed: ECONNRESET','network',null],
  ['unrecognized provider response','unknown',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'CliConfigValueError',message:'private config value'}}),'configuration',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'DbPasswordFlagsError',message:'private database URL'}}),'configuration',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'HostedMutationConsentRequiredError',message:'private project'}}),'confirmation',null],
  [JSON.stringify({_tag:'Failure',error:{_tag:'HostedMutationDeclinedError',message:'context canceled'}}),'confirmation',null],
 ]){
  const result=cliFailure({status:1,stderr,stdout:'private SQL and credential output'});
  assert.deepEqual(result,{category,exit_code:1,http_status,signal:null,spawn_error:null});
  assert(!JSON.stringify(result).includes('synthetic-private-value'));
  assert(!JSON.stringify(result).includes('private SQL'));
 }
});

test('CLI diagnostics allow only fixed process metadata and bounded exit codes',()=>{
 assert.deepEqual(cliFailure({status:null,signal:'SIGTERM',error:{code:'ETIMEDOUT'}}),
  {category:'network',exit_code:null,http_status:null,signal:'SIGTERM',spawn_error:'ETIMEDOUT'});
 assert.deepEqual(cliFailure({status:null,error:{code:'ENOENT'}}),
  {category:'local_process',exit_code:null,http_status:null,signal:null,spawn_error:'ENOENT'});
 assert.deepEqual(cliFailure({status:999,signal:'private-data',error:{code:'private-data',message:'private-data'},stderr:{secret:'private-data'}}),
  {category:'unknown',exit_code:null,http_status:null,signal:null,spawn_error:null});
});


test('Management API failure distinguishes exact request and provider evidence without retaining payloads',async()=>{
 const sensitive='synthetic-private-value';
 for(const [method,message,reason] of [
  ['GET','You do not have the necessary privileges to access this endpoint','insufficient_permissions'],
  ['POST','insufficient_scope','insufficient_permissions'],
  ['GET','invalid access token','invalid_token'],
  ['POST','<html>Cloudflare cf-chl-challenge</html>','edge_firewall'],
  ['POST','request body too large','request_size'],
  ['GET','IP restriction policy','access_policy'],
  ['GET','Unknown provider failure','unclassified'],
 ]){
  let calls=0;
  await assert.rejects(managementRequest('/secrets',{method,body:method==='POST'?[{name:'FTK_CALENDAR_SIGNING_KEY',value:sensitive}]:undefined},async(url,options)=>{
   calls++;assert.equal(url,'https://api.supabase.com/v1/projects/gwyprhenabtpkbojephw/secrets');assert.equal(options.method,method);
   return new Response(JSON.stringify({message,private_value:sensitive}),{status:403,headers:{'sb-request-id':sensitive}});
  }),error=>{assert.deepEqual(error.management_failure,{method,resource:'/secrets',http_status:403,provider_reason:reason});assert(!JSON.stringify(error).includes(sensitive));assert(!error.message.includes(sensitive));return true;});
  assert.equal(calls,1,'Authorization failures must not be retried or bypassed');
 }
});

test('Management API diagnostics bound provider output and preserve normal successful responses',async()=>{
 let cancelled=false;
 const body=new ReadableStream({pull(controller){controller.enqueue(new TextEncoder().encode('private '.repeat(2048)));},cancel(){cancelled=true;}});
 await assert.rejects(managementRequest('/secrets',{},async()=>new Response(body,{status:403})),error=>error.management_failure.provider_reason==='unclassified');
 assert(cancelled);
 assert.deepEqual(await managementRequest('/secrets',{},async()=>Response.json([{name:'existing'}])),[{name:'existing'}]);
 assert.equal(await managementRequest('/secrets',{},async()=>new Response(null,{status:204})),null);
});
