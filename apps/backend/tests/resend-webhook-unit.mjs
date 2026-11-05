import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import fs from 'node:fs';

test('standalone Resend entry accepts signed requests without JWT and persists before acknowledging',async()=>{
 const compiled=await build({entryPoints:['supabase/functions/resend-webhook/handler.ts'],bundle:true,platform:'browser',format:'esm',write:false});
 for(const [variant,source] of [['handler',compiled.outputFiles[0].text],['generated',fs.readFileSync('supabase/functions/resend-webhook/index.ts','utf8')]])for(const mode of ['modern','legacy']){
 const secret='whsec_'+randomBytes(32).toString('base64'),time=String(Math.floor(Date.now()/1000)),id='msg_standalone';
 const body=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'4aa2bdd6-3382-4383-b8b8-a3c6be30d508',to:['private@example.invalid']}});
 const signature='v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(id+'.'+time+'.'+body).digest('base64');
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_synthetic'}),SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',FTK_RESEND_WEBHOOK_SECRET:secret};
 if(mode==='legacy'){delete env.SUPABASE_PUBLISHABLE_KEYS;env.SUPABASE_ANON_KEY='synthetic-anon';}
 const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;let calls=0,persist=true;
 try{
  globalThis.Deno={env:{get:name=>env[name]}};
  globalThis.fetch=async(url,options)=>{
   calls++;assert.match(url,/\/rest\/v1\/rpc\/outbox_deliver_v1$/);
   const request=JSON.parse(options.body);assert.equal(request.p_request.event_id,id);assert.equal(request.p_request.kind,'delivered');
   assert(!options.body.includes('private@example.invalid'));
   return Response.json({accepted:persist});
  };
  const {default:entry}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+variant+'-'+mode);
  const request=(sig=signature)=>new Request('https://test.supabase.co/functions/v1/resend-webhook',{method:'POST',headers:{'svix-id':id,'svix-timestamp':time,'svix-signature':sig},body});
  const accepted=await entry.fetch(request());assert.equal(accepted.status,200);assert.equal(calls,1);
  assert.equal(accepted.headers.get('access-control-allow-origin'),null);
  assert.equal((await entry.fetch(request('v1,invalid'))).status,403);assert.equal(calls,1);
  persist=false;assert.equal((await entry.fetch(request())).status,503);assert.equal(calls,2);
  assert.equal((await entry.fetch(new Request('https://test.supabase.co/functions/v1/resend-webhook'))).status,405);
  delete env.FTK_RESEND_WEBHOOK_SECRET;assert.equal((await entry.fetch(request())).status,503);assert.equal(calls,2);
 }finally{globalThis.fetch=previousFetch;if(previousDeno===undefined)delete globalThis.Deno;else globalThis.Deno=previousDeno;}
 }
});
