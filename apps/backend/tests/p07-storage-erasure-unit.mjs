import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {eraseExpiredImportObject} from '../scripts/p07-storage-erasure.mjs';

test('Storage erasure requires exact native DELETE acknowledgement and absence before recording proof',async()=>{
 const fileId='00000000-0000-4000-8000-000000000001';
 const orgId='00000000-0000-4000-8000-000000000002';
 const origin='http://127.0.0.1:54321';
 const bytes=Buffer.from('temporary CSV');
 const preparation={state:'ready',provider_origin:origin,object_key:orgId+'/'+fileId,bytes:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex')};
 const calls=[];
 const db={async query(sql){
  assert.match(sql,/p07_storage_erasure_prepare/);
  calls.push('prepare');
  return {rows:[{result:preparation}]};
 }};
 const attestor={async query(sql){
  assert.match(sql,/p07_storage_erasure_confirm/);
  calls.push('confirm');
  return {rows:[{result:{state:'completed'}}]};
 }};
 const invoke=async(remove,absence,options={})=>{
  calls.length=0;
  let reads=0;
  return eraseExpiredImportObject({
   db,attestor,request:{},fileId,apiUrl:origin,serviceKey:'unit-test',
   fetcher:async(url,{method,redirect})=>{
    assert.equal(redirect,'error');
    assert.equal(new URL(url).origin,origin);
    calls.push(method);
    if(method==='DELETE')return remove();
    if(++reads===1)return new Response(bytes,{headers:{'content-type':'text/csv'}});
    return absence();
   },...options
  });
 };
 const removed=()=>Response.json({message:'Successfully deleted'});
 const missing=()=>Response.json({statusCode:'404',error:'not_found',message:'Object not found'},{status:400});
 assert.deepEqual(await invoke(removed,missing),{state:'completed'});
 assert.deepEqual(calls,['prepare','GET','DELETE','GET','confirm']);
 await assert.rejects(invoke(()=>{throw Error('Interrupted');},missing),/STORAGE_DELETE_UNCONFIRMED/);
 assert.deepEqual(calls,['prepare','GET','DELETE']);
 await assert.rejects(invoke(()=>new Response('{"ok":true}'),missing),/STORAGE_DELETE_UNCONFIRMED/);
 assert.deepEqual(calls,['prepare','GET','DELETE']);
 await assert.rejects(invoke(removed,()=>Response.json({error:'NoSuchBucket'},{status:404})),/STORAGE_ABSENCE_UNCONFIRMED/);
 assert.deepEqual(calls,['prepare','GET','DELETE','GET']);
 await assert.rejects(invoke(removed,missing,{apiUrl:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co'}),/STORAGE_PROVIDER_BINDING_MISMATCH/);
 assert.deepEqual(calls,['prepare']);
 const document={...preparation,bucket_id:'ftksaas-documents',mime:'text/plain'};
 const documentDb={async query(){return {rows:[{result:document}]};}};
 const documentPaths=[];
 assert.deepEqual(await invoke(removed,missing,{
  db:documentDb,
  fetcher:async(url,{method})=>{
   documentPaths.push(new URL(url).pathname);
   if(method==='DELETE')return removed();
   if(documentPaths.length===1)return new Response(bytes,{headers:{'content-type':'text/plain'}});
   return missing();
  }
 }),{state:'completed'});
 assert.deepEqual(documentPaths,[
  '/storage/v1/object/authenticated/ftksaas-documents/'+document.object_key,
  '/storage/v1/object/ftksaas-documents/'+document.object_key,
  '/storage/v1/object/authenticated/ftksaas-documents/'+document.object_key
 ]);
 const protectedDb={async query(){return {rows:[{result:{...document,bucket_id:'ftksaas-invoices'}}]};}};
 await assert.rejects(invoke(removed,missing,{db:protectedDb}),/INVALID_STORAGE_PREPARATION/);
});
