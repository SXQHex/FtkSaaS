import test from 'node:test';
import assert from 'node:assert/strict';
import {browserCors} from '../transports/browser-cors.mjs';
const env={FTK_BROWSER_ORIGINS:'https://spa.ftksaas.invalid,http://localhost:5173'};
const request=(origin,method='POST',headers={})=>new Request('https://edge.invalid/functions/v1/backend-v1/account_get_v1',{method,headers:{...(origin===undefined?{}:{origin}),...headers}});
test('explicit browser origin policy fails closed and preserves server calls',()=>{
 for(const origin of ['https://evil.invalid','https://spa.ftksaas.invalid.evil.invalid','null','http://spa.ftksaas.invalid'])assert.equal(browserCors(request(origin),env).response.status,403);
 assert.equal(browserCors(request('https://spa.ftksaas.invalid'),{}).response.status,403);
 assert.equal(browserCors(request(undefined),env).response,undefined);
 assert.equal(browserCors(request('https://spa.ftksaas.invalid'),env).headers['access-control-allow-origin'],'https://spa.ftksaas.invalid');
 for(const setting of ['*','https://spa.ftksaas.invalid/','https://spa.ftksaas.invalid/path','https://spa.ftksaas.invalid,https://bad.invalid/path'])assert.equal(browserCors(request('https://spa.ftksaas.invalid'),{FTK_BROWSER_ORIGINS:setting}).response.status,403);
});
test('OPTIONS permits SDK headers and denies browser ingress signatures and wrong methods',()=>{
 const preflight=headers=>browserCors(request('https://spa.ftksaas.invalid','OPTIONS',headers),env).response;
 const res=preflight({'access-control-request-method':'POST','access-control-request-headers':'authorization, apikey, content-type, x-client-info'});
 assert.equal(res.status,204);assert.equal(res.headers.get('access-control-allow-origin'),'https://spa.ftksaas.invalid');assert.equal(res.headers.get('vary'),'Origin');assert.equal(res.headers.get('access-control-allow-credentials'),null);
 for(const header of ['x-ftk-client-ip','x-ftk-ingress-signature','x-forwarded-for','x-vercel-forwarded-for'])assert.equal(preflight({'access-control-request-method':'POST','access-control-request-headers':header}).status,403);
 assert.equal(preflight({'access-control-request-method':'DELETE'}).status,403);
 assert.equal(browserCors(request(undefined,'OPTIONS'),env).response.status,403);
});

test('deployed Edge entry rejects foreign origin before Auth/RPC and wraps allowed error responses',async()=>{
 const {build}=await import('esbuild');
 const compiled=await build({entryPoints:['supabase/functions/backend-v1/handler.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const originalDeno=globalThis.Deno,originalFetch=globalThis.fetch;let handler;
 try{
  globalThis.Deno={serve:f=>{handler=f;},env:{get:name=>env[name]}};
  globalThis.fetch=async()=>{throw Error('Origin rejection and missing Auth must not reach upstream');};
  await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64')+'#browser-cors');
  for(const origin of ['https://evil.invalid','https://spa.ftksaas.invalid']){
   const options=await handler(request(origin,'OPTIONS',{'access-control-request-method':'POST','access-control-request-headers':'authorization,apikey,content-type,x-client-info'}));
   assert.equal(options.status,origin.includes('evil')?403:204);assert.equal(options.headers.get('access-control-allow-origin'),origin.includes('evil')?null:origin);
   const req=new Request(request(origin),{body:JSON.stringify({client_api_version:1,request_id:'019b0010-1111-7000-8000-000000000001'})});
   const res=await handler(req);assert.equal(res.status,origin.includes('evil')?403:401);assert.equal(res.headers.get('access-control-allow-origin'),origin.includes('evil')?null:origin);
  }
 }finally{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno;}
});

test('Edge rejects malformed Auth users, JWT claims and RPC output without exposing internal data',async()=>{
 const {build}=await import('esbuild');
 const compiled=await build({entryPoints:['supabase/functions/backend-v1/handler.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const originalDeno=globalThis.Deno,originalFetch=globalThis.fetch;
 const id='019b0010-1111-7000-8000-000000000001',session='019b0010-1111-7000-8000-000000000002';
 const token=claims=>'header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
 const call=async(claims,user,rpcReply,authStatus=200)=>{
  let fetchCalls=0,rpcCalls=0,handler;
  globalThis.Deno={serve:fn=>{handler=fn;},env:{get:name=>({
   FTK_BROWSER_ORIGINS:'https://spa.ftksaas.invalid',
   SUPABASE_URL:'https://example.supabase.invalid',
   SUPABASE_SERVICE_ROLE_KEY:'synthetic-only'
  })[name]}};
  globalThis.fetch=async(url)=>{
   fetchCalls++;
   if(url.endsWith('/auth/v1/user'))return Response.json(user,{status:authStatus});
   if(url.endsWith('/rest/v1/rpc/account_get_v1')){rpcCalls++;return Response.json(rpcReply);}
   if(url.endsWith('/rest/v1/rpc/outbox_deliver_v1'))return Response.json({accepted:true});
   throw Error('UNEXPECTED_NETWORK');
  };
  await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64')+'#bt01-'+crypto.randomUUID());
  const req=new Request('https://edge.invalid/functions/v1/backend-v1/account_get_v1',{method:'POST',headers:{
   origin:'https://spa.ftksaas.invalid',authorization:'Bearer '+token(claims)
  },body:JSON.stringify({client_api_version:1,request_id:id})});
  const res=await handler(req);
  return {response:res,body:await res.json(),fetchCalls,rpcCalls};
 };
 try{
  for(const user of [null,[],{id,factors:[{status:5}]},{id,factors:'verified'}]){
   const result=await call({sub:id,session_id:session,aal:'aal1'},user,{ok:true,data:{id}});
   assert.equal(result.response.status,401);assert.equal(result.body.error.code,'AUTH_REQUIRED');assert.equal(result.rpcCalls,0);
  }
  for(const claim of [{sub:id,session_id:5,aal:'aal1'},{sub:id,session_id:session,aal:7},{sub:'another-actor',session_id:session,aal:'aal2'}]){
   const result=await call(claim,{id},null);
   assert.equal(result.response.status,401);assert.equal(result.body.error.code,'SESSION_REVOKED');assert.equal(result.rpcCalls,0);
  }
  const unavailable=await call({sub:id,session_id:session,aal:'aal1'},{message:'private-provider-detail'},null,504);
  assert.equal(unavailable.response.status,503);assert.equal(unavailable.body.error.code,'TEMPORARY_FAILURE');
  assert.equal(unavailable.body.error.retryable,true);assert.equal(unavailable.rpcCalls,0);
  assert(!JSON.stringify(unavailable.body).includes('private-provider-detail'));
  const denied=await call({sub:id,session_id:session,aal:'aal1'},{message:'invalid session'},null,403);
  assert.equal(denied.response.status,401);assert.equal(denied.body.error.code,'AUTH_REQUIRED');assert.equal(denied.rpcCalls,0);
  const invalid=await call({sub:id,session_id:session,aal:'aal1'},{id},{ok:true,data:{private_marker:'never-expose'},trace_id:id});
  assert.equal(invalid.response.status,500);assert.equal(invalid.body.error.code,'INTEGRITY_VIOLATION');assert.equal(invalid.rpcCalls,1);
  assert(!JSON.stringify(invalid.body).includes('private_marker'));
 }finally{globalThis.fetch=originalFetch;globalThis.Deno=originalDeno;}
});

test('Edge file completion validates pending Storage context with no persisted checksum and forwards observed byte hash',async()=>{
 const {build}=await import('esbuild');
 const {createHash}=await import('node:crypto');
 const compiled=await build({entryPoints:['supabase/functions/backend-v1/handler.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 const originalDeno=globalThis.Deno,originalFetch=globalThis.fetch;
 const id='019b0010-1111-7000-8000-000000000001',person='019b0010-1111-7000-8000-000000000002',file='019b0010-1111-7000-8000-000000000003';
 const bytes=new TextEncoder().encode('synthetic private document bytes');
 const sha=createHash('sha256').update(bytes).digest('hex');
 const token='header.'+Buffer.from(JSON.stringify({sub:person,session_id:id,aal:'aal1'})).toString('base64url')+'.signature';
 const env={FTK_BROWSER_ORIGINS:'https://spa.ftksaas.invalid',SUPABASE_URL:'https://example.supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only'};
 let handler;
 const phases=[],storage=[];
 let state='pending_upload';
 try{
  globalThis.Deno={serve:callback=>{handler=callback;},env:{get:name=>env[name]}};
  globalThis.fetch=async(url,options)=>{
   if(url.endsWith('/auth/v1/user'))return Response.json({id:person});
   if(url.endsWith('/rest/v1/rpc/file_upload_complete_v1')){
    const {p_aux}=JSON.parse(options.body);phases.push(p_aux);
    if(p_aux.phase==='storage_context')return Response.json({_internal_storage:{
     object_key:id+'/'+file,bytes:bytes.length,mime:'text/plain',checksum:null,state
    }});
    return Response.json({ok:false,error:{code:'VALIDATION_FAILED',retryable:false,trace_id:id}});
   }
   if(url.endsWith('/storage/v1/object/authenticated/ftksaas-documents/'+id+'/'+file)){
    storage.push(url);return new Response(bytes,{headers:{'content-type':'text/plain'}});
   }
   throw Error('UNEXPECTED_UPSTREAM');
  };
  await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64')+'#pending-storage-context');
  const request=new Request('https://edge.invalid/functions/v1/backend-v1/file_upload_complete_v1',{
   method:'POST',headers:{origin:'https://spa.ftksaas.invalid',authorization:'Bearer '+token},
   body:JSON.stringify({client_api_version:1,request_id:id,operation_key:id,org_id:id,file_id:file,checksum:sha})
  });
  const response=await handler(request);
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.error.code,'VALIDATION_FAILED');
  assert.equal(storage.length,1);
  assert.equal(phases.length,2);
  assert.equal(phases[1].storage_verified,true);
  assert.equal(phases[1].checksum,sha);
  assert.equal(phases[1].object_key,id+'/'+file);
  // A ready row without a persisted checksum must never bypass byte verification.
  state='ready';
  const invalid=await handler(new Request(request.url,{method:'POST',headers:request.headers,
   body:JSON.stringify({client_api_version:1,request_id:id,operation_key:id,org_id:id,file_id:file,checksum:sha})}));
  const rejected=await invalid.json();
  assert.equal(invalid.status,500,JSON.stringify(rejected));
  assert.equal(rejected.error.code,'INTEGRITY_VIOLATION');
  assert.equal(phases.length,3,'invalid ready state must not reach the mutation RPC');
  assert.equal(storage.length,1);
 }finally{globalThis.Deno=originalDeno;globalThis.fetch=originalFetch;}
});
