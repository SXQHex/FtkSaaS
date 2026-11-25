import {writeR2ImmutableEvidence} from './r2-s3-object-store.mjs';
import {canonical,sha256} from './restore-guard.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha=/^[a-f0-9]{64}$/;
const project=/^[a-z]{20}$/;
const isId=value=>typeof value==='string'&&uuid.test(value);

// The archive scope is separate from a deletion authorization. Any subsequent
// purge must verify the scope again under the source row and retention fences.
export async function readPublishedInvoiceArchiveScope({db,requestId,orgId,invoiceId}){
 if(![requestId,orgId,invoiceId].every(isId))throw Error('INVALID_INVOICE_ARCHIVE_TARGET');
 const {rows}=await db.query(`
  select i.invoice_number,to_char(i.issued_on,'YYYY-MM-DD') as issued_on,i.mime,i.bytes,
   i.checksum,i.published_at, s.id as object_id,s.version as object_version,
   private.organization_invoice_source_fingerprint(i) as source_fingerprint,
   exists(select 1 from core.retention_holds h
    where h.org_id=o.id and h.subject_id in (p.id,o.id,i.id,s.id)) as held
  from core.privacy_requests p
  join core.organizations o on o.id=p.org_id and o.state='deletion_pending'
  join private.platform_invoices i on i.org_id=o.id and i.id=$3 and i.published_at is not null
  join storage.objects s on s.bucket_id='ftksaas-invoices' and s.name=(i.org_id||'/'||i.id)
  where p.id=$1 and p.org_id=$2 and p.kind='organization_delete' and p.scope->'all_data'='true'::jsonb
   and p.state in ('requested','running','partial')
 `,[requestId,orgId,invoiceId]);
 if(rows.length!==1)throw Error('INVOICE_ARCHIVE_SOURCE_REQUIRED');
 const [row]=rows;
 if(row.held!==false)throw Error('INVOICE_ARCHIVE_HELD');
 if(!isId(row.object_id)||typeof row.object_version!=='string'||!row.object_version||!sha.test(row.source_fingerprint)
  ||typeof row.checksum!=='string'||!sha.test(row.checksum)||!Number.isSafeInteger(row.bytes)
  ||row.bytes<1||row.bytes>2097152||!(row.published_at instanceof Date)||!Number.isFinite(row.published_at.getTime()))
  throw Error('INVALID_INVOICE_ARCHIVE_SOURCE');
 const {held,published_at:publishedAt,source_fingerprint:sourceFingerprint,...invoice}=row;
 const scope={request_id:requestId,org_id:orgId,invoice_id:invoiceId,...invoice,
  published_at:publishedAt.toISOString(),source_fingerprint:sourceFingerprint};
 return {scope,scopeSha256:sha256(canonical(scope)),sourceFingerprint,objectKey:orgId+'/'+invoiceId};
}

async function readArchivePlan({db,requestId,orgId,invoiceId,sourceProjectRef,approval}){
 if(typeof sourceProjectRef!=='string'||!project.test(sourceProjectRef)||!isId(approval?.decisionId)
  ||typeof approval.scopeSha256!=='string'||!sha.test(approval.scopeSha256)
  ||typeof approval.retainUntil!=='string'||!Number.isFinite(Date.parse(approval.retainUntil))
  ||new Date(approval.retainUntil).toISOString()!==approval.retainUntil||Date.parse(approval.retainUntil)<=Date.now())
  throw Error('INVALID_INVOICE_ARCHIVE_APPROVAL');
 const approved={decision_id:approval.decisionId,scope_sha256:approval.scopeSha256,retain_until:approval.retainUntil};
 const target={db,requestId,orgId,invoiceId};
 const {scope,scopeSha256,objectKey}=await readPublishedInvoiceArchiveScope(target);
 if(scopeSha256!==approved.scope_sha256)throw Error('INVOICE_ARCHIVE_APPROVAL_MISMATCH');
 const prefix=invoiceArchivePrefix(sourceProjectRef,requestId,invoiceId);
 const blobKey=prefix+'original',receiptKey=prefix+'receipt.json';
 const manifest=Buffer.from(canonical({format:2,source_project_ref:sourceProjectRef,approval:approved,scope,blob_key:blobKey}));
 const receipt={receipt_key:receiptKey,receipt_sha256:sha256(manifest),scope_sha256:scopeSha256,blob_sha256:scope.checksum};
 return {target,scope,objectKey,blobKey,manifest,receipt};
}

async function confirmUnchanged({target,receipt}){
 const {scopeSha256}=await readPublishedInvoiceArchiveScope(target);
 if(scopeSha256!==receipt.scope_sha256)throw Error('INVOICE_ARCHIVE_APPROVAL_MISMATCH');
}

export async function archivePublishedInvoice({store,reader,readSource,...options}){
 const plan=await readArchivePlan(options),{scope,objectKey,blobKey,manifest,receipt}=plan;
 const bytes=await readSource({objectKey});
 if(!Buffer.isBuffer(bytes)||bytes.length!==scope.bytes||sha256(bytes)!==scope.checksum)throw Error('INVOICE_ARCHIVE_SOURCE_BYTES_MISMATCH');
 await confirmUnchanged(plan);
 await writeR2ImmutableEvidence({store,key:blobKey,bytes,expectedSha256:scope.checksum});
 const stored=await reader.get(blobKey);
 if(!Buffer.isBuffer(stored?.bytes)||!stored.bytes.equals(bytes))throw Error('INVOICE_ARCHIVE_INDEPENDENT_READ_FAILED');
 await confirmUnchanged(plan);
 await writeR2ImmutableEvidence({store,key:receipt.receipt_key,bytes:manifest,expectedSha256:receipt.receipt_sha256});
 return verifyArchivePlan(plan,reader);
}

async function verifyArchivePlan(plan,reader){
 const {blobKey,manifest,receipt,scope}=plan;
 const [stored,blob]=await Promise.all([reader.get(receipt.receipt_key),reader.get(blobKey)]);
 if(!Buffer.isBuffer(stored?.bytes)||!stored.bytes.equals(manifest)
  ||!Buffer.isBuffer(blob?.bytes)||blob.bytes.length!==scope.bytes||sha256(blob.bytes)!==scope.checksum)
  throw Error('INVOICE_ARCHIVE_PROOF_REQUIRED');
 await confirmUnchanged(plan);
 return receipt;
}

export async function verifyPublishedInvoiceArchiveReceipt({reader,...options}){
 return verifyArchivePlan(await readArchivePlan(options),reader);
}

function invoiceArchivePrefix(sourceProjectRef,requestId,invoiceId){
 return 'archive/'+sourceProjectRef+'/'+requestId+'/platform-invoices/'+invoiceId+'/';
}

export async function verifyBoundInvoiceArchive({reader,prepared,sourceProjectRef,invoiceId}){
 const {request_id:requestId,org_id:orgId,object_id:objectId,object_version:objectVersion,approval_id:approvalId}=prepared;
 if(![requestId,orgId,invoiceId,objectId,approvalId].every(isId)||!project.test(sourceProjectRef)
  ||prepared.source_project_ref!==sourceProjectRef||prepared.object_key!==orgId+'/'+invoiceId
  ||!sha.test(prepared.source_fingerprint)||!sha.test(prepared.archive_receipt_sha256)||!sha.test(prepared.archive_scope_sha256)
  ||!Number.isFinite(Date.parse(prepared.retain_until))||Date.parse(prepared.retain_until)<=Date.now()){
  throw Error('INVALID_INVOICE_ARCHIVE_BINDING');
 }
 const prefix=invoiceArchivePrefix(sourceProjectRef,requestId,invoiceId);
 const blobKey=prefix+'original';
 const evidence=await reader.get(prefix+'receipt.json');
 if(!Buffer.isBuffer(evidence?.bytes)||sha256(evidence.bytes)!==prepared.archive_receipt_sha256){
  throw Error('INVOICE_ARCHIVE_PROOF_REQUIRED');
 }
 let manifest;
 try{manifest=JSON.parse(evidence.bytes);}
 catch{throw Error('INVOICE_ARCHIVE_PROOF_REQUIRED');}
 const scope=manifest?.scope,approval=manifest?.approval;
 if(manifest?.format!==2||manifest.source_project_ref!==sourceProjectRef||manifest.blob_key!==blobKey
  ||approval?.decision_id!==approvalId||Date.parse(approval.retain_until)!==Date.parse(prepared.retain_until)
  ||approval.scope_sha256!==prepared.archive_scope_sha256||!scope||sha256(canonical(scope))!==approval.scope_sha256
  ||scope.request_id!==requestId||scope.org_id!==orgId||scope.invoice_id!==invoiceId||scope.object_id!==objectId
  ||scope.object_version!==objectVersion||scope.source_fingerprint!==prepared.source_fingerprint
  ||scope.checksum!==prepared.checksum||scope.bytes!==prepared.bytes||scope.mime!==prepared.mime){
  throw Error('INVOICE_ARCHIVE_PROOF_REQUIRED');
 }
 const blob=await reader.get(blobKey);
 if(!Buffer.isBuffer(blob?.bytes)||blob.bytes.length!==prepared.bytes||sha256(blob.bytes)!==prepared.checksum){
  throw Error('INVOICE_ARCHIVE_PROOF_REQUIRED');
 }
 return prepared.archive_receipt_sha256;
}
