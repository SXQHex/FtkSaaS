import {writeR2ImmutableEvidence} from './r2-s3-object-store.mjs';
import {canonical,sha256} from './restore-guard.mjs';
import {erasePreparedDocumentObject} from './p07-storage-erasure.mjs';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha=/^[a-f0-9]{64}$/;
const project=/^[a-z]{20}$/;
const isId=value=>typeof value==='string'&&uuid.test(value);
const billing={
 directory:'billing',prefix:'BILLING',
 source:'select private.organization_billing_archive_source($1,$2) as result',
 transition:'select private.organization_billing_erasure_stage($1,$2,$3) as result',
 validScope:scope=>Array.isArray(scope.payments)&&scope.payments.length>0
  &&Array.isArray(scope.subscriptions)&&scope.subscriptions.length>0&&Array.isArray(scope.allocations)
};
const history={
 directory:'billing-history',prefix:'BILLING_HISTORY',
 source:'select private.organization_billing_history_source($1,$2) as result',
 transition:'select private.organization_billing_history_stage($1,$2,$3) as result',
 validScope:scope=>Array.isArray(scope.events)&&scope.events.length>0
};

const signedDocuments={
 directory:'signed-documents',prefix:'SIGNED_DOCUMENT',
 source:'select private.organization_signed_document_archive_source($1,$2) as result',
 transition:'select private.organization_signed_document_stage($1,$2,$3) as result',
 validScope:scope=>Array.isArray(scope.versions)&&scope.versions.length>0
  &&Array.isArray(scope.acceptances)&&scope.acceptances.length>0
  &&scope.versions.every(version=>isId(version.version_id)&&sha.test(version.source_sha256)
   &&(version.storage===undefined||
    (isId(version.storage?.file_id)&&isId(version.storage.object_id)
     &&typeof version.storage.object_version==='string'&&version.storage.object_version.length>0
     &&['text/plain','application/pdf'].includes(version.storage.mime)
     &&Number.isSafeInteger(version.storage.bytes)&&version.storage.bytes>0&&version.storage.bytes<=2097152)))
};

const organizationSales={
 directory:'organization-sales',prefix:'ORGANIZATION_SALE',
 source:'select private.organization_sale_archive_source($1,$2) as result',
 transition:'select private.organization_sale_erasure_stage($1,$2,$3) as result',
 validScope:scope=>Array.isArray(scope.sales)&&scope.sales.length>0
  &&Array.isArray(scope.movements)&&Array.isArray(scope.purchase_links)
};

const organizationDirectory={
 directory:'organization-directory',prefix:'ORGANIZATION_DIRECTORY',
 source:'select private.organization_directory_archive_source($1,$2) as result',
 transition:'select private.organization_directory_erasure_stage($1,$2,$3) as result',
 validScope:scope=>Array.isArray(scope.events)&&scope.row_counts&&typeof scope.row_counts==='object'
  &&!Array.isArray(scope.row_counts)
};

export const readBillingArchiveScope=target=>readArchiveScope(billing,target);
export const archiveSettledBilling=options=>archiveSource(billing,options);
export const eraseArchivedBilling=options=>eraseArchivedSource(billing,options);
export const readBillingHistoryScope=target=>readArchiveScope(history,target);
export const archiveBillingHistory=options=>archiveSource(history,options);
export const eraseArchivedBillingHistory=options=>eraseArchivedSource(history,options);
export const readSignedDocumentArchiveScope=target=>readArchiveScope(signedDocuments,target);
export const archiveSignedDocuments=options=>archiveSource(signedDocuments,options);
export const eraseArchivedSignedDocuments=options=>eraseArchivedSource(signedDocuments,options);
export const readOrganizationSaleArchiveScope=target=>readArchiveScope(organizationSales,target);
export const archiveOrganizationSales=options=>archiveSource(organizationSales,options);
export const eraseArchivedOrganizationSales=options=>eraseArchivedSource(organizationSales,options);
export const readOrganizationDirectoryArchiveScope=target=>readArchiveScope(organizationDirectory,target);
export const archiveOrganizationDirectory=options=>archiveSource(organizationDirectory,options);
export const eraseArchivedOrganizationDirectory=options=>eraseArchivedSource(organizationDirectory,options);

function parseScope(kind,result){
 if(result?.state==='held'||result?.state==='blocked')return result;
 const scope=result?.scope,fingerprint=result?.source_fingerprint;
 if(result?.state!=='ready'||!isId(scope?.request_id)||!isId(scope?.org_id)||!sha.test(fingerprint)||!kind.validScope(scope)){
  throw Error('INVALID_'+kind.prefix+'_ARCHIVE_SOURCE');
 }
 return {
  state:'ready',scope,sourceFingerprint:fingerprint,
  scopeSha256:sha256(canonical({scope,source_fingerprint:fingerprint}))
 };
}

async function readArchiveScope(kind,{db,requestId,orgId}){
 if(!isId(requestId)||!isId(orgId))throw Error('INVALID_'+kind.prefix+'_ARCHIVE_TARGET');
 const {rows}=await db.query(kind.source,[requestId,orgId]);
 return parseScope(kind,rows[0]?.result);
}

function planArchive(kind,source,sourceProjectRef,approval){
 if(source.state==='held')throw Error(kind.prefix+'_ARCHIVE_HELD');
 if(source.state!=='ready')throw Error(kind.prefix+'_ARCHIVE_SOURCE_BLOCKED');
 if(!project.test(sourceProjectRef)||!isId(approval?.decisionId)||!sha.test(approval.scopeSha256)
  ||typeof approval.retainUntil!=='string'||!Number.isFinite(Date.parse(approval.retainUntil))
  ||Date.parse(approval.retainUntil)<=Date.now()||new Date(approval.retainUntil).toISOString()!==approval.retainUntil){
  throw Error('INVALID_'+kind.prefix+'_ARCHIVE_APPROVAL');
 }
 if(source.scopeSha256!==approval.scopeSha256)throw Error(kind.prefix+'_ARCHIVE_APPROVAL_MISMATCH');
 const objectKey='archive/'+sourceProjectRef+'/'+source.scope.request_id+'/'+kind.directory+'/'+approval.decisionId+'.json';
 const bytes=Buffer.from(canonical({
  format:1,source_project_ref:sourceProjectRef,source_fingerprint:source.sourceFingerprint,scope:source.scope,
  approval:{decision_id:approval.decisionId,scope_sha256:approval.scopeSha256,retain_until:approval.retainUntil}
 }));
 const files=kind===signedDocuments?source.scope.versions.flatMap(version=>version.storage?[{
  key:objectKey.slice(0,-5)+'/'+version.version_id+'/original',
  objectKey:source.scope.org_id+'/'+version.storage.file_id,
  bytes:version.storage.bytes,checksum:version.source_sha256
 }]:[]):[];
 return {bytes,objectKey,archiveSha256:sha256(bytes),files};
}

async function verifyArchive(kind,plan,reader){
 const found=await reader.get(plan.objectKey);
 if(!Buffer.isBuffer(found?.bytes)||!found.bytes.equals(plan.bytes))throw Error(kind.prefix+'_ARCHIVE_PROOF_REQUIRED');
 for(const file of plan.files){
  const blob=await reader.get(file.key);
  if(!Buffer.isBuffer(blob?.bytes)||blob.bytes.length!==file.bytes||sha256(blob.bytes)!==file.checksum){
   throw Error(kind.prefix+'_ARCHIVE_PROOF_REQUIRED');
  }
 }
}

async function archiveSource(kind,{store,reader,sourceProjectRef,approval,readSource,...target}){
 const source=await readArchiveScope(kind,target);
 const plan=planArchive(kind,source,sourceProjectRef,approval);
 for(const file of plan.files){
  if(typeof readSource!=='function')throw Error(kind.prefix+'_ARCHIVE_SOURCE_REQUIRED');
  const bytes=await readSource({objectKey:file.objectKey});
  if(!Buffer.isBuffer(bytes)||bytes.length!==file.bytes||sha256(bytes)!==file.checksum){
   throw Error(kind.prefix+'_ARCHIVE_SOURCE_BYTES_MISMATCH');
  }
  if((await readArchiveScope(kind,target)).scopeSha256!==source.scopeSha256)throw Error(kind.prefix+'_ARCHIVE_SOURCE_CHANGED');
  await writeR2ImmutableEvidence({store,key:file.key,bytes,expectedSha256:file.checksum});
 }
 await writeR2ImmutableEvidence({store,key:plan.objectKey,bytes:plan.bytes,expectedSha256:plan.archiveSha256});
 await verifyArchive(kind,plan,reader);
 if((await readArchiveScope(kind,target)).scopeSha256!==source.scopeSha256)throw Error(kind.prefix+'_ARCHIVE_SOURCE_CHANGED');
 return {objectKey:plan.objectKey,archiveSha256:plan.archiveSha256};
}

async function eraseArchivedSource(kind,{worker,attestor,request,reader,sourceProjectRef,apiUrl,serviceKey,fetcher}){
 if(typeof worker?.query!=='function'||typeof attestor?.query!=='function'||worker===attestor||typeof reader?.get!=='function'){
  throw Error(kind.prefix+'_ERASURE_ATTESTOR_REQUIRED');
 }
 const transition=async(client,phase,digest=null)=>(await client.query(kind.transition,[request,phase,digest])).rows[0]?.result;
 const prepared=await transition(worker,'prepare');
 if(['unbound','held','blocked','completed'].includes(prepared?.state))return prepared;
 if(prepared?.state!=='ready'||prepared.source_project_ref!==sourceProjectRef){
  throw Error(kind.prefix+'_ERASURE_PREPARATION_REQUIRED');
 }
 const retainUntil=new Date(prepared.retain_until);
 if(!Number.isFinite(retainUntil.getTime()))throw Error('INVALID_'+kind.prefix+'_ARCHIVE_APPROVAL');
 const plan=planArchive(kind,parseScope(kind,prepared),sourceProjectRef,{
  decisionId:prepared.approval_id,scopeSha256:prepared.archive_scope_sha256,retainUntil:retainUntil.toISOString()
 });
 if(plan.archiveSha256!==prepared.archive_sha256)throw Error(kind.prefix+'_ARCHIVE_APPROVAL_MISMATCH');
 await verifyArchive(kind,plan,reader);
 if(kind===signedDocuments){
  const authorized=await transition(attestor,'authorize',plan.archiveSha256);
  if(['held','blocked','retry_wait','completed'].includes(authorized?.state))return authorized;
  if(authorized?.state!=='authorized'||!Array.isArray(authorized.objects))throw Error('SIGNED_DOCUMENT_STORAGE_AUTHORIZATION_REQUIRED');
  if(authorized.objects.some(object=>object.state==='unconfirmed'))throw Error('SIGNED_DOCUMENT_STORAGE_DELETE_UNCONFIRMED');
  for(const object of authorized.objects){
   await erasePreparedDocumentObject({apiUrl,serviceKey,prepared:object,fetcher,acknowledge:()=>attestor.query(
    'select private.organization_signed_document_storage_ack($1,$2,$3)',[request,object.file_id,plan.archiveSha256]
   )});
  }
 }
 const proof=await transition(attestor,'confirm',plan.archiveSha256);
 if(['held','blocked','retry_wait'].includes(proof?.state))return proof;
 if(proof?.state!=='completed'||proof.archive_sha256!==plan.archiveSha256)throw Error(kind.prefix+'_ERASURE_PROOF_REQUIRED');
 return proof;
}
