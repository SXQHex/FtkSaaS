import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output=await build({entryPoints:['supabase/functions/backend-v1/email-provider.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {sendEmail}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const reference='019ab111-1234-7000-8000-000000000001';
const input={apiKey:'synthetic-private-key',idempotencyKey:'ftksaas-notification/'+reference,payload:{from:'sender@example.invalid',to:['recipient@example.invalid'],subject:'Synthetic transactional notice',text:'Synthetic body'}};

test('email provider acceptance retains frozen payload and key without claiming recipient delivery',async()=>{
 const calls=[];const send=async(url,options)=>{calls.push({url,headers:options.headers,body:options.body});assert(options.signal instanceof AbortSignal);return Response.json({id:reference});};
 const expected={state:'accepted',provider_reference:reference};
 assert.deepEqual(await sendEmail(input,send),expected);assert.deepEqual(await sendEmail(input,send),expected);
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].url,'https://api.resend.com/emails');assert.equal(calls[0].headers['Idempotency-Key'],input.idempotencyKey);assert.equal(calls[0].body,JSON.stringify(input.payload));
 assert(!JSON.stringify(expected).includes(input.apiKey));assert(!JSON.stringify(expected).includes('recipient@'));
});
test('email provider distinguishes rejection, retry and unknown outcome without retaining raw errors',async()=>{
 for(const [status,body,state] of [[422,{},'rejected'],[401,{},'rejected'],[429,{},'retryable'],[503,{},'retryable'],[409,{name:'concurrent_idempotent_requests'},'retryable'],[409,{name:'invalid_idempotency_key'},'rejected'],[200,{},'unknown'],[200,{id:'private-provider-text'},'unknown']]){
  assert.deepEqual(await sendEmail(input,async()=>Response.json({...body,message:'synthetic-private-response'}, {status})),{state});
 }
 assert.deepEqual(await sendEmail(input,async()=>{throw Error('synthetic-private-response');}),{state:'unknown'});
 assert.deepEqual(await sendEmail(input,async()=>new Response('synthetic-private-response',{status:200})),{state:'unknown'});
});
test('invalid provider credentials or idempotency keys cannot reach the network',async()=>{
 let calls=0;const send=async()=>{calls++;throw Error('network must not run');};
 for(const patch of [{apiKey:''},{apiKey:'bad\r\nheader'},{idempotencyKey:''},{idempotencyKey:'x'.repeat(257)},{idempotencyKey:'bad\nheader'}])assert.deepEqual(await sendEmail({...input,...patch},send),{state:'rejected'});
 assert.equal(calls,0);
});
