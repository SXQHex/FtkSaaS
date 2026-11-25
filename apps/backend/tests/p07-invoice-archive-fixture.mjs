import assert from 'node:assert/strict';
import {archivePublishedInvoice,readPublishedInvoiceArchiveScope,verifyPublishedInvoiceArchiveReceipt} from '../scripts/organization-retention-archive.mjs';
import {eraseArchivedPublishedInvoice} from '../scripts/organization-invoice-erasure.mjs';
import {sha256} from '../scripts/restore-guard.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {context,must} from './api-client.mjs';

// Exercise the published-invoice origin through native Edge and Storage.
export async function seedPublishedInvoice(platform,orgId){
 const {API_URL,ANON_KEY}=context().env;
 const bytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
 const meta={org_id:orgId,invoice_number:'P07 archive fixture',issued_on:'2026-11-25',mime:'application/pdf',
  bytes:bytes.length,checksum:sha256(bytes)};
 const {invoice_id:invoiceId,upload_url:uploadUrl}=await must(platform,'platform_invoice_upload_prepare_v1',meta,key());
 const uploaded=await fetch(new URL(uploadUrl,API_URL),{method:'PUT',headers:{apikey:ANON_KEY,'content-type':meta.mime},body:bytes,signal:AbortSignal.timeout(10000)});
 assert.equal(uploaded.ok,true);
 await uploaded.body?.cancel();
 await must(platform,'platform_invoice_publish_v1',{org_id:orgId,invoice_id:invoiceId},key());
 return {invoiceId,bytes};
}

function localArchive(){
 const objects=new Map();
 return {
  async put(key,bytes,condition){
   assert.deepEqual(condition,{ifNoneMatch:'*'});
   if(objects.has(key))throw Error('R2_ERASURE_PRECONDITION_FAILED');
   objects.set(key,Buffer.from(bytes));
  },
  async get(key){if(objects.has(key))return {bytes:Buffer.from(objects.get(key))};}
 };
}

export async function verifyPublishedInvoiceArchive({db,requestId,orgId,invoice,r2Pilot}){
 const {API_URL,SERVICE_ROLE_KEY}=context().env;
 const {invoiceId,bytes}=invoice,options={db,requestId,orgId,invoiceId};
 const sourceProjectRef=r2Pilot?.sourceProjectRef??'ftknativereceipttest';
 const store=r2Pilot?.archiveWriter??localArchive(),reader=r2Pilot?.archiveReader??store;
 const readSource=async({objectKey})=>{
  const response=await fetch(API_URL+'/storage/v1/object/authenticated/ftksaas-invoices/'+objectKey,{
   headers:{apikey:SERVICE_ROLE_KEY,authorization:'Bearer '+SERVICE_ROLE_KEY},signal:AbortSignal.timeout(10000)});
  assert.equal(response.ok,true);
  return Buffer.from(await response.arrayBuffer());
 };
 const {scopeSha256}=await readPublishedInvoiceArchiveScope(options);
 const approval={decisionId:key(),scopeSha256,retainUntil:new Date(Date.now()+86400000).toISOString()};
 const args={...options,sourceProjectRef,approval,store,reader,readSource};
 await assert.rejects(verifyPublishedInvoiceArchiveReceipt(args),/INVOICE_ARCHIVE_PROOF_REQUIRED/);
 await assert.rejects(archivePublishedInvoice({...args,approval:{...approval,scopeSha256:'0'.repeat(64)},
  readSource:()=>assert.fail('storage read before approval')}),/INVOICE_ARCHIVE_APPROVAL_MISMATCH/);
 const tampered=Buffer.from(bytes);tampered[tampered.length-1]^=1;
 await assert.rejects(archivePublishedInvoice({...args,readSource:async()=>tampered}),/INVOICE_ARCHIVE_SOURCE_BYTES_MISMATCH/);
 const holdId=key();
 await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,'private.platform_invoices',$3,'Synthetic archive hold','synthetic-invoice',clock_timestamp()-interval '1 day')",[holdId,orgId,invoiceId]);
 try{await assert.rejects(archivePublishedInvoice({...args,readSource:()=>assert.fail('held bytes read')}),/INVOICE_ARCHIVE_HELD/);}
 finally{await db.query('delete from core.retention_holds where id=$1',[holdId]);}
 const receipt=await archivePublishedInvoice(args);
 assert.equal(receipt.scope_sha256,scopeSha256);
 assert.equal(receipt.blob_sha256,sha256(bytes));
 assert.deepEqual(await verifyPublishedInvoiceArchiveReceipt(args),receipt);
 await assert.rejects(verifyPublishedInvoiceArchiveReceipt({...args,reader:{
  get:async key=>key.endsWith('/original')?{bytes:tampered}:reader.get(key)
 }}),/INVOICE_ARCHIVE_PROOF_REQUIRED/);
 assert.deepEqual(await archivePublishedInvoice(args),receipt);
 assert.deepEqual(await readSource({objectKey:orgId+'/'+invoiceId}),bytes);
 return {args,receipt,summary:{archive_receipt_sha256:receipt.receipt_sha256,archive_blob_sha256:receipt.blob_sha256,
  archive_target:r2Pilot?'r2':'local-test-store'}};
}

export async function verifyArchivedInvoiceRemoval({db,worker,attestor,request,archived,claim,apiUrl,serviceKey}){
 const {args,receipt}=archived;
 const {requestId,orgId,invoiceId,sourceProjectRef,approval,reader}=args;
 const objectKey=orgId+'/'+invoiceId;
 const {scope,sourceFingerprint}=await readPublishedInvoiceArchiveScope(args);
 const roles=await Promise.all([worker.query('select session_user'),attestor.query('select session_user')]);
 const roleNames=roles.map(result=>result.rows[0].session_user);
 const operation={request,invoiceId,worker,attestor,reader,sourceProjectRef,apiUrl,serviceKey};
 const erase=overrides=>eraseArchivedPublishedInvoice({...operation,...overrides});
 const observe=async()=>db.query(
  "select exists(select 1 from private.platform_invoices where id=$1) as invoice, exists(select 1 from storage.objects where id=$2) as object",
  [invoiceId,scope.object_id]).then(result=>result.rows[0]);
 assert.deepEqual(await erase({}),{state:'unbound'});
 assert.deepEqual(await observe(),{invoice:true,object:true});
 await db.query(`insert into private.organization_invoice_erasures
  (invoice_id,request_id,org_id,object_id,object_version,source_fingerprint,source_project_ref,archive_receipt_sha256,
   archive_scope_sha256,approval_id,retain_until,worker_role,attestor_role,provider_origin)
  values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
 [invoiceId,requestId,orgId,scope.object_id,scope.object_version,sourceFingerprint,sourceProjectRef,receipt.receipt_sha256,
  receipt.scope_sha256,approval.decisionId,approval.retainUntil,...roleNames,new URL(apiUrl).origin]);
 await assert.rejects(erase({reader:{get:async()=>null}}),/INVOICE_ARCHIVE_PROOF_REQUIRED/);
 for(const phase of ['authorize','confirm']){
  await assert.rejects(worker.query("select private.organization_invoice_erasure_stage($1,$2,$3,$4)",
   [request,invoiceId,phase,receipt.receipt_sha256]),/FORBIDDEN/);
 }
 await db.query("update private.platform_invoices set invoice_number='Synthetic changed invoice' where id=$1",[invoiceId]);
 try{await assert.rejects(erase({}),/INTEGRITY_VIOLATION/);}
 finally{await db.query('update private.platform_invoices set invoice_number=$2 where id=$1',[invoiceId,scope.invoice_number]);}

 assert.deepEqual(await observe(),{invoice:true,object:true});

 const insertHold=id=>db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
  values($1,$2,'storage.objects',$3,'Synthetic late invoice hold','synthetic-invoice',clock_timestamp()-interval '1 day')`,
 [id,orgId,scope.object_id]);
 const removeHold=id=>db.query('delete from core.retention_holds where id=$1',[id]);
 const hold=key();
 await insertHold(hold);
 try{assert.deepEqual(await erase({}),{state:'held'});}
 finally{await removeHold(hold);}
 const late=key();
 try{
  await assert.rejects(erase({fetcher:async(url,options)=>{
   if(options.method==='DELETE')await insertHold(late);
   return fetch(url,options);
  }}),/STORAGE_DELETE_UNCONFIRMED/);
  assert.deepEqual(await observe(),{invoice:true,object:true});
 }finally{await removeHold(late);}
 // A transport failure before provider delete leaves both live parts intact.
 await assert.rejects(erase({fetcher:(url,options)=>{
  if(options.method==='DELETE')throw Error('synthetic transport error before deletion');
  return fetch(url,options);
 }}),/STORAGE_DELETE_UNCONFIRMED/);
 assert.deepEqual(await observe(),{invoice:true,object:true});
 const next=await claim();
 const completed=await erase({request:next});
 assert.equal(completed.state,'completed');
 assert.equal(completed.archive_receipt_sha256,receipt.receipt_sha256);
 assert.deepEqual(await observe(),{invoice:false,object:false});
 const native=await fetch(apiUrl+'/storage/v1/object/authenticated/ftksaas-invoices/'+objectKey,{
  headers:{apikey:serviceKey,authorization:'Bearer '+serviceKey},signal:AbortSignal.timeout(10000)});
 assert([400,404].includes(native.status));
 await native.body?.cancel();
 assert.deepEqual(await erase({request:next}),completed);
 assert.equal(sha256((await reader.get(receipt.receipt_key)).bytes),receipt.receipt_sha256);
 assert.equal(sha256((await reader.get(receipt.receipt_key.replace(/receipt\.json$/,'original'))).bytes),receipt.blob_sha256);
 return {request:next,archive_receipt_sha256:receipt.receipt_sha256};
}
