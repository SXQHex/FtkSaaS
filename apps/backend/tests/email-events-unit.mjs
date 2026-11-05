import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['supabase/functions/backend-v1/email-events.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {emailEvents,verifyEmailSignature}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const now=Date.now(),at=String(Math.floor(now/1000)),secret='whsec_'+randomBytes(32).toString('base64');
const provider='4aa2bdd6-3382-4383-b8b8-a3c6be30d508';
const body=JSON.stringify({type:'email.delivered',created_at:new Date(now).toISOString(),data:{email_id:provider,to:['private@example.invalid'],subject:'private subject'}});
const env=n=>({FTK_RESEND_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'})[n];
function request({raw=body,time=at,id='msg_synthetic',signature,method='POST'}={}){
 signature??='v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(id+'.'+time+'.'+raw).digest('base64');
 return new Request('https://test.supabase.co/functions/v1/backend-v1/email_provider_events',{method,headers:{'content-type':'application/json','svix-id':id,'svix-timestamp':time,'svix-signature':signature},...(method==='POST'?{body:raw}:{})});
}
test('Svix official independent signature vector and rotation signatures verify unchanged raw bytes',async t=>{
 const headers=new Headers({'svix-id':'msg_loFOjxBNrRLzqYUf','svix-timestamp':'1731705121','svix-signature':'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0='});
 const clock=t.mock.method(Date,'now',()=>1731705121000);
 assert.equal(await verifyEmailSignature('{"event_type":"ping","data":{"success":true}}',headers,'whsec_plJ3nmyCDGBKInavdOK15jsl',1731705121000),true);
 clock.mock.restore();
 const r=request();r.headers.set('svix-signature','v2,ignored v1,'+Buffer.alloc(32).toString('base64')+' '+r.headers.get('svix-signature'));
 assert.equal(await verifyEmailSignature(body,r.headers,secret,now),true);
 assert.equal(await verifyEmailSignature(body+' ',r.headers,secret,now),false);
});
test('invalid, old, future or missing signatures never reach DB; missing config fails closed',async()=>{
 let calls=0;const send=async()=>{calls++;throw Error('private');};
 for(const patch of [{signature:'v1,invalid'},{time:String(Number(at)-301)},{time:String(Number(at)+301)},{id:''}])assert.equal((await emailEvents(request(patch),env,send,now)).status,403);
 assert.equal((await emailEvents(request(),()=>undefined,send,now)).status,503);
 assert.equal((await emailEvents(request({method:'GET'}),env,send,now)).status,405);assert.equal(calls,0);
});
test('only normalized signed metadata reaches service RPC, and acknowledgement waits for persistence',async()=>{
 let calls=0;
 const response=await emailEvents(request(),env,async(url,options)=>{
  calls++;assert.match(url,/rpc\/outbox_deliver_v1$/);const data=JSON.parse(options.body);assert.equal(data.p_actor_auth_id,null);assert.equal(data.p_aux.email_event,true);
  assert.equal(data.p_request.provider_reference,provider);assert.equal(data.p_request.kind,'delivered');assert.match(data.p_request.payload_hash,/^[a-f0-9]{64}$/);
  assert(!options.body.includes('private'));assert(!options.body.includes('example.invalid'));return Response.json({accepted:true});
 },now);
 assert.equal(response.status,200);assert.equal(calls,1);assert.deepEqual(await response.json(),{});
 for(const result of [Response.json({error:'private diagnostic'},{status:500}),Response.json({accepted:false})]){
  const failed=await emailEvents(request(),env,async()=>result,now);assert.equal(failed.status,503);assert(!JSON.stringify(await failed.json()).includes('private'));
 }
});
test('unsupported events are acknowledged without storage; invalid signed payloads and oversized streams are rejected',async()=>{
 let calls=0;const send=async()=>{calls++;throw Error();};
 assert.equal((await emailEvents(request({raw:JSON.stringify({type:'email.opened'})}),env,send,now)).status,200);
 for(const raw of ['null','{',JSON.stringify({type:'email.delivered',data:{email_id:provider}}),JSON.stringify({type:'email.delivered',created_at:new Date(now).toISOString(),data:{email_id:'bad'}})])assert.equal((await emailEvents(request({raw}),env,send,now)).status,400);
 assert.equal((await emailEvents(request({raw:'x'.repeat(65537)}),env,send,now)).status,413);assert.equal(calls,0);
});
test('slow body deadline cancels the stream and never reaches storage',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let cancelled=0,calls=0;
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled++;}});
 const r=new Request('https://test.supabase.co/functions/v1/backend-v1/email_provider_events',{method:'POST',body:stream,duplex:'half'});
 const pending=emailEvents(r,env,async()=>{calls++;throw Error();},now);t.mock.timers.tick(3000);
 assert.equal((await pending).status,400);assert.equal(cancelled,1);assert.equal(calls,0);
});
