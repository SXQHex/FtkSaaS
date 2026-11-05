import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {newUuidV7 as id} from '../scripts/uuid.mjs';
const built=await build({entryPoints:['supabase/functions/backend-v1/transactional-email.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {deliverTransactionalEmail:deliver}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const item=()=>({job_id:id(),org_id:id(),lease_token:'synthetic-lease',api_key:'synthetic-provider',payload:{from:'sender@example.invalid',to:['recipient@example.invalid'],subject:'Synthetic notice',text:'Synthetic safe link'}});
test('transactional sender reauthorizes, preserves frozen payload/key and finishes accepted without leaking PII',async()=>{
 const c=item(),calls=[],sent=[],reference=id(),rpc=async(body,aux)=>{calls.push({body,aux});return {authorized:true};};
 const send=async(url,options)=>{sent.push(options);return Response.json({id:reference});};
 for(let i=0;i<2;i++)assert.deepEqual(await deliver(c,id(),rpc,send),{claimed:1,accepted:true});
 assert.equal(sent.length,2);assert.equal(sent[0].body,JSON.stringify(c.payload));assert.equal(sent[0].body,sent[1].body);assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);
 assert.equal(calls[0].aux.email_phase,'authorize');assert.equal(calls[1].aux.provider_reference,reference);assert(!JSON.stringify(await deliver(c,id(),rpc,send)).includes('example.invalid'));
});
test('preference or scope loss at authorization prevents network send and completes cancellation',async()=>{
 let sent=0;const calls=[];const result=await deliver(item(),id(),async(body,aux)=>{calls.push(aux);return {authorized:false};},async()=>{sent++;throw Error();});
 assert.equal(sent,0);assert.equal(result.accepted,false);assert.equal(calls[1].retryable,false);
});
test('permanent rejection never retries; timeout/unknown and transient failure remain bounded by DB owner',async()=>{
 for(const [send,retryable] of [[async()=>Response.json({},{status:422}),false],[async()=>Response.json({},{status:429}),true],[async()=>{throw Error('private diagnostic');},true]]){
  const calls=[];assert.equal((await deliver(item(),id(),async(body,aux)=>{calls.push(aux);return {authorized:true};},send)).accepted,false);assert.equal(calls[1].retryable,retryable);assert(!JSON.stringify(calls).includes('private diagnostic'));
 }
});
test('malformed claims fail before RPC and missing finish acknowledgement remains an error',async()=>{
 let calls=0;await assert.rejects(deliver({...item(),payload:{}},id(),async()=>{calls++;}));assert.equal(calls,0);
 await assert.rejects(deliver(item(),id(),async(body,aux)=>{if(aux.email_phase==='finish')throw Error('DB unavailable');return {authorized:true};},async()=>Response.json({id:id()})),/DB unavailable/);
});
