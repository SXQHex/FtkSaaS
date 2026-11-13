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
