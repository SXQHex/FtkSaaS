import assert from 'node:assert/strict';
import {seedOrganizationMedia,verifyOrganizationMediaErasure} from './p07-organization-media-fixture.mjs';
import {verifyOrganizationSaleErasure} from './p07-organization-sale-fixture.mjs';
import {verifyOrganizationDirectoryErasure} from './p07-organization-directory-fixture.mjs';
import {readMixedErasureProjection,verifyOrganizationProjectionRestore} from './native-organization-erasure-restore-fixture.mjs';
import {verifySettledBillingErasure} from './p07-billing-archive-fixture.mjs';
import {verifyBillingHistoryErasure} from './p07-billing-history-fixture.mjs';
import {seedPublishedInvoice,verifyArchivedInvoiceRemoval,verifyPublishedInvoiceArchive} from './p07-invoice-archive-fixture.mjs';
import {readSignedDocumentArchiveScope,archiveSignedDocuments,eraseArchivedSignedDocuments} from '../scripts/organization-db-archive.mjs';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {readOrganizationErasureReceipt} from '../scripts/organization-erasure-receipt.mjs';
import {beginBoundR2PilotErasure} from './r2-erasure-pilot-fixture.mjs';
import {context as testContext,must} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

function localArchive(){
 const objects=new Map();
 return {
  async put(name,bytes,condition){
   assert.deepEqual(condition,{ifNoneMatch:'*'});
   if(objects.has(name))throw Error('R2_ERASURE_PRECONDITION_FAILED');
   objects.set(name,Buffer.from(bytes));
  },
  async get(name){return objects.has(name)?{bytes:Buffer.from(objects.get(name))}:null;}
 };
}

export async function verifySignedDocumentErasure({worker,attestor,workerRole,claim,execute,r2Pilot,
 signingContext,controlId,dbUrl}){
 const f=await preparationFixture({schedule:true,studentUser:true,studentMembership:true});
 const {db,org,center,owner,student,studentPerson,api,platform}=f;
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 try{
  await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
  const product=(await api('product_publish_v1',{terms:{name:'Synthetic signed document plan',kind:'credits',booking_mode:'flexible',
   credits:2,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},
   scopes:[{scope_kind:'center_all_disciplines',center_id:center,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
  const salePreview=await api('sale_preview_v1',{person_id:studentPerson,product_version_id:product,start_date:f.day(0),end_date:f.day(30)});
  const sale=(await api('sale_apply_v1',{preview:{id:salePreview.id,token:salePreview.token}})).primary_id;
  const sourceText='Sentetik sözleşme.\nİkinci satır, olduğu gibi.';
  const published=await api('document_version_publish_v1',{scope:{kind:'center',center_id:center},
   version_label:'signed-pilot-1',digital_content:{name:'Synthetic signed agreement',language:'tr',template_id:'signed-pilot',
    template_version:'1',text:sourceText},
   requirements:[{gate:'sale',scope:{center_ids:[center]},renewed_acceptance:true}]});
  const documentId=published.related.find(x=>x.type==='documents').id;
  const versionId=published.primary_id;
  const [{file_id:fileId}]=await rows('select file_id from core.document_versions where org_id=$1 and id=$2',[org,versionId]);
  const context={gate:'sale',subject:{type:'sales',id:sale}};
  const shown=(await api('document_requirements_get_v1',{context,content_file_id:fileId},student)).find(x=>x.version_id===versionId);
  assert.equal(shown.rendered_document.content.text,sourceText);
  const accepted=await api('document_accept_v1',{context,rendered_document_id:shown.rendered_document.id},student);
  const acceptanceId=accepted.primary_id;
  const [{auth_session_id:sessionId}]=await rows('select auth_session_id from core.document_acceptances where id=$1',[acceptanceId]);
  assert(sessionId);
  const unacceptedText='Synthetic later version with no acceptance';
  const replacement=await api('document_version_publish_v1',{document_id:documentId,scope:{kind:'center',center_id:center},
   version_label:'signed-pilot-2',digital_content:{name:'Synthetic signed agreement',language:'tr',template_id:'signed-pilot',
    template_version:'2',text:unacceptedText},
   requirements:[{gate:'sale',scope:{center_ids:[center]},renewed_acceptance:true}]});
  const pendingVersionId=replacement.primary_id;
  const [{file_id:pendingFileId}]=await rows('select file_id from core.document_versions where org_id=$1 and id=$2',[org,pendingVersionId]);
  const pendingShown=(await api('document_requirements_get_v1',{context,content_file_id:pendingFileId},student)).find(x=>x.version_id===pendingVersionId);
  assert.equal(pendingShown.rendered_document.content.text,unacceptedText);

  const {API_URL:apiUrl,ANON_KEY:anonKey,SERVICE_ROLE_KEY:serviceKey}=testContext().env;
  const storageHeaders={apikey:serviceKey,authorization:'Bearer '+serviceKey};
  const readObject=objectKey=>fetch(apiUrl+'/storage/v1/object/authenticated/ftksaas-documents/'+objectKey,
   {headers:storageHeaders,signal:AbortSignal.timeout(8000)});
  await db.query("insert into private.p05_upload_configuration values($1,65536,array['text/plain'])",[org]);
  const publishFile=async(label,text)=>{
   const bytes=Buffer.from(text),checksum=sha256(bytes);
   const upload=await api('document_upload_prepare_v1',{name:label,mime:'text/plain',bytes:bytes.length});
   const response=await fetch(new URL(upload.upload_url,apiUrl),{method:'PUT',
    headers:{apikey:anonKey,'content-type':'text/plain'},body:bytes,signal:AbortSignal.timeout(15000)});
   assert.equal(response.status,200);
   await api('file_upload_complete_v1',{file_id:upload.file_id,checksum});
   const version=await api('document_version_publish_v1',{file_id:upload.file_id,document_id:documentId,
    scope:{kind:'center',center_id:center},version_label:label,
    requirements:[{gate:'sale',scope:{center_ids:[center]},renewed_acceptance:true}]});
   const objectKey=org+'/'+upload.file_id;
   const [{id:objectId}]=await rows("select id from storage.objects where bucket_id='ftksaas-documents' and name=$1",[objectKey]);
   return {versionId:version.primary_id,fileId:upload.file_id,objectId,objectKey,bytes,checksum};
  };
  const file=await publishFile('signed-native-file','Sentetik kabul edilmiş dosya içeriği.');
  const fileShown=(await api('document_requirements_get_v1',{context,content_file_id:file.fileId},student)).find(x=>x.version_id===file.versionId);
  assert.deepEqual(Buffer.from(fileShown.content.data,'base64'),file.bytes);
  const fileAcceptanceId=(await api('document_accept_v1',{context,document_version_id:file.versionId},student)).primary_id;
  const unacceptedFile=await publishFile('unaccepted-native-file','Sentetik kabul edilmemiş dosya içeriği.');
  const terminationReason='Sentetik satış kapatma serbest notu';
  const termination=await api('sale_terminate_preview_v1',{sale_id:sale,reason:terminationReason});
  await api('sale_terminate_apply_v1',{preview:{id:termination.id,token:termination.token}});
  const invoice=await seedPublishedInvoice(platform,org);
  const readSource=async({objectKey})=>{
   const response=await readObject(objectKey);
   assert.equal(response.status,200);
   return Buffer.from(await response.arrayBuffer());
  };

  const media=await seedOrganizationMedia(f);
  const [{org_id:controlOrg}]=await rows('select org_id from core.people where id=$1',[controlId]);
  const sharedPerson=key(),sharedLink=key();
  await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Synthetic shared login', 'active')",
   [sharedPerson,controlOrg]);
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',clock_timestamp())",
   [sharedLink,controlOrg,f.account.id,sharedPerson]);
  const sharedMembership=async()=>(await must(owner,'organizations_list_v1',{page:{}})).items.find(row=>row.id===controlOrg)?.self_context?.person_id;
  assert.equal(await sharedMembership(),sharedPerson);
  const restoreIds={orgId:org,ownerPerson:f.person,studentPerson,controlId:sharedPerson,controlLink:sharedLink};
  const before=await readMixedErasureProjection(db,restoreIds);
  const previousEvidence=await r2Pilot?.reader.withRestoreEvidence('0'.repeat(64),({trust,ledgerBytes})=>({trust,ledgerBytes}));
  const studentAccount=await must(student,'account_get_v1');
  const abandoned=await must(owner,'organization_delete_preview_v1',
   {org_id:org,all_data:true,reason:'Sentetik vazgeçilen imha önizlemesi'});
  const erasureReason='Sentetik organizasyon imhası gerekçesi';
  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,all_data:true,reason:erasureReason});
  const {job_id:jobId}=await must(owner,'organization_delete_apply_v1',{org_id:org,all_data:true,
   preview:{id:preview.id,token:preview.token},reauth:owner.jwt},key());
  const [{request_id:requestId}]=await rows('select request_id from private.p07_privacy_jobs where id=$1',[jobId]);
  assert.deepEqual(await rows("select reason from core.audit_events where org_id=$1 and subject_id=$2 and action='organization_delete_apply_v1'",
   [org,requestId]),[{reason:erasureReason}]);
  assert.deepEqual(await rows("select payload->>'reason' as reason from private.p07_lifecycle_previews where id=$1 and used",
   [preview.id]),[{reason:erasureReason}]);
  const intakeContexts=`select c.request->>'reason' as reason from private.p06_contexts c
   join core.operation_receipts r on r.id=c.receipt_id and r.org_id=c.org_id
   where r.business_reference=$1 and r.org_id=$2 and r.operation='organization_delete_apply_v1'`;
  assert.deepEqual(await rows(intakeContexts,[requestId,org]),[{reason:erasureReason}]);
  await beginBoundR2PilotErasure({db,requestId,orgId:org,pilot:r2Pilot});
  const mediaHold=key();
  await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
   values($1,$2,'private.settings_media_assets',$3,'Synthetic hold during earlier erasure stages','synthetic',clock_timestamp())`,
  [mediaHold,org,media.oldId]);
  await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[workerRole,org]);
  await db.query('insert into private.organization_projected_contact_erasure_scopes values($1,$2)',[workerRole,org]);
  await db.query('insert into private.organization_live_database_erasure_scopes(db_role,request_id,org_id) values($1,$2,$3)',[workerRole,requestId,org]);
  await db.query('insert into private.organization_managed_file_erasure_scopes(db_role,request_id) values($1,$2)',[workerRole,requestId]);
  const reclaim=async()=>{
   await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
   return claim(org,jobId);
  };
  const releaseAndClaim=async current=>{
   await execute(current);
   return reclaim();
  };
  let request=await claim(org,jobId);
  const store=r2Pilot?.archiveWriter??localArchive(),reader=r2Pilot?.archiveReader??store;
  const sourceProjectRef=r2Pilot?.sourceProjectRef??'ftknativereceipttest';
  const scopeTarget={db,requestId,orgId:org,sourceProjectRef,store,reader,readSource};
  const operation={worker,attestor,reader,sourceProjectRef,apiUrl,serviceKey};
  const erase=overrides=>eraseArchivedSignedDocuments({...operation,request,...overrides});
  await db.query('begin');
  try{
   await db.query('insert into private.document_presentations values($1,$2,$3,$4,$5)',
    [org,studentPerson,pendingVersionId,{...context,synthetic_mismatched_presentation:true},shown.rendered_document.id]);
   assert.deepEqual(await readSignedDocumentArchiveScope(scopeTarget),{state:'blocked',reason:'unverified_document_content'});
  }finally{await db.query('rollback');}
  const source=await readSignedDocumentArchiveScope(scopeTarget);
  assert.equal(source.state,'ready',JSON.stringify({state:source.state,reason:source.reason}));
  const approval={scopeSha256:source.scopeSha256,decisionId:key(),retainUntil:new Date(Date.now()+86400000).toISOString()};
  await assert.rejects(archiveSignedDocuments({...scopeTarget,approval,readSource:async()=>Buffer.from('mismatched source')}),
   /SIGNED_DOCUMENT_ARCHIVE_SOURCE_BYTES_MISMATCH/);
  const archived=await archiveSignedDocuments({...scopeTarget,approval});
  assert.deepEqual(await erase({}),{state:'unbound'});
  const evidence=(await reader.get(archived.objectKey)).bytes;
  assert.equal(sha256(evidence),archived.archiveSha256);
  const record=JSON.parse(evidence);
  assert(!evidence.includes(Buffer.from(sessionId)));
  assert(!evidence.includes(Buffer.from(unacceptedText)));
  assert.equal(record.scope.versions.length,2);
  assert.equal(record.scope.versions.find(version=>version.version_id===versionId).source_content.text,sourceText);
  const inline=record.scope.acceptances.find(acceptance=>acceptance.acceptance_id===acceptanceId);
  assert.equal(inline.shown_content.text,sourceText);
  assert.equal(inline.shown_sha256,sha256(Buffer.from(sourceText)));
  assert.deepEqual(inline.subject,context.subject);
  const fileAcceptance=record.scope.acceptances.find(acceptance=>acceptance.acceptance_id===fileAcceptanceId);
  assert.equal(fileAcceptance.shown_sha256,file.checksum);
  assert.deepEqual(fileAcceptance.subject,context.subject);
  const retainedVersion=record.scope.versions.find(version=>version.version_id===file.versionId);
  assert.equal(retainedVersion.source_sha256,file.checksum);
  const blobKey=archived.objectKey.replace(/\.json$/,'/')+file.versionId+'/original';
  assert.deepEqual((await reader.get(blobKey)).bytes,file.bytes);
  assert.equal(await reader.get(archived.objectKey.replace(/\.json$/,'/')+unacceptedFile.versionId+'/original'),null);
  const roles=await Promise.all([worker.query('select session_user'),attestor.query('select session_user')]);
  await db.query(`insert into private.organization_signed_document_erasures
   (request_id,org_id,source_project_ref,source_fingerprint,archive_scope_sha256,archive_sha256,approval_id,retain_until,worker_role,attestor_role,provider_origin)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [requestId,org,sourceProjectRef,source.sourceFingerprint,source.scopeSha256,archived.archiveSha256,
   approval.decisionId,approval.retainUntil,...roles.map(result=>result.rows[0].session_user),apiUrl]);
  await assert.rejects(worker.query("select private.organization_signed_document_stage($1,'confirm',$2)",[request,archived.archiveSha256]),/FORBIDDEN/);
  await assert.rejects(attestor.query("select private.organization_signed_document_stage($1,'confirm',$2)",[request,archived.archiveSha256]),
   /RESULT_NOT_CONFIRMED/);
  await assert.rejects(db.query('delete from core.document_acceptances where id=$1',[acceptanceId]),/INTEGRITY_VIOLATION/);
  await assert.rejects(erase({reader:{get:async()=>({bytes:Buffer.from('{}')})}}),/SIGNED_DOCUMENT_ARCHIVE_PROOF_REQUIRED/);
  await assert.rejects(erase({reader:{get:objectKey=>objectKey===blobKey?null:reader.get(objectKey)}}),/SIGNED_DOCUMENT_ARCHIVE_PROOF_REQUIRED/);
  assert.deepEqual(await readSource(file),file.bytes);
  const hold=key();
  try{
   const held=await erase({reader:{get:async objectKey=>{
    const value=await reader.get(objectKey);
    await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
     values($1,$2,'document_acceptances',$3,'Synthetic document hold','synthetic',clock_timestamp()-interval '1 day')
     on conflict(id) do nothing`,[hold,org,acceptanceId]);
    return value;
   }}});
   assert.deepEqual(held,{state:'held'});
   assert.equal((await rows('select id from core.document_acceptances where id=$1',[acceptanceId])).length,1);
  }finally{await db.query('delete from core.retention_holds where id=$1',[hold]);}

  const lateHold=key();
  try{
   await assert.rejects(erase({fetcher:async(url,options)=>{
    if(options?.method==='DELETE')await db.query(`insert into core.retention_holds
     (id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
     values($1,$2,'document_acceptances',$3,'Synthetic late document hold','synthetic',clock_timestamp())`,[lateHold,org,fileAcceptanceId]);
    return fetch(url,options);
   }}),/STORAGE_DELETE_UNCONFIRMED/);
   assert.deepEqual(await readSource(file),file.bytes);
   assert.deepEqual(await readSource(unacceptedFile),unacceptedFile.bytes);
  }finally{await db.query('delete from core.retention_holds where id=$1',[lateHold]);}

  let deleted=false;
  await assert.rejects(erase({fetcher:async(url,options)=>{
   if(deleted&&options?.method==='GET')throw Error('Synthetic interruption before native Storage readback');
   const response=await fetch(url,options);
   if(options?.method==='DELETE'&&response.ok)deleted=true;
   return response;
  }}),/STORAGE_ABSENCE_UNCONFIRMED/);
  assert(deleted);
  const [{acknowledged}]=await rows(`select count(*)::int as acknowledged from private.organization_signed_document_objects
   where request_id=$1 and provider_deleted_at is not null`,[requestId]);
  assert.equal(acknowledged,1);
  assert.equal((await rows('select id from core.document_acceptances where id=$1',[fileAcceptanceId])).length,1);
  await assert.rejects(readOrganizationErasureReceipt({db,requestId,orgId:org}),/ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE/);
  request=await reclaim();
  const completed=await erase({});
  assert.deepEqual(completed,{state:'completed',archive_sha256:archived.archiveSha256});
  assert.deepEqual(await erase({}),completed);
  for(const source of [file,unacceptedFile]){
   const gone=await readObject(source.objectKey);
   assert([400,404].includes(gone.status));
   assert.deepEqual(await rows('select id from storage.objects where id=$1',[source.objectId]),[]);
  }
  const [{erased_subject_ids:erasedIds}]=await rows(`select erased_subject_ids
   from private.organization_signed_document_erasures where request_id=$1 and completed_at is not null`,[requestId]);
  assert([file.objectId,unacceptedFile.objectId,fileAcceptanceId].every(id=>erasedIds.includes(id)));
  const [live]=await rows(`select
    (select count(*)::int from core.documents where id=$1) as documents,
    (select count(*)::int from core.document_versions where id=any($2::uuid[])) as versions,
    (select count(*)::int from core.document_requirements where document_version_id=any($2::uuid[])) as requirements,
    (select count(*)::int from core.document_acceptances where id=any($3::uuid[])) as acceptances,
    (select count(*)::int from private.digital_document_acceptances where acceptance_id=any($3::uuid[])) as signed_snapshots,
    (select count(*)::int from private.rendered_documents where document_version_id=any($2::uuid[])) as renders,
    (select count(*)::int from private.document_presentations where document_version_id=any($2::uuid[])) as presentations,
    (select count(*)::int from private.content_templates where source_version=any(array(select id::text from unnest($2::uuid[]) id))) as templates,
    (select count(*)::int from core.files where id=any($4::uuid[])) as files,
    (select count(*)::int from private.digital_document_contents where file_id=any($4::uuid[])) as inline_contents,
    (select count(*)::int from core.people where id=$5) as people,
    (select count(*)::int from core.sales where id=$6) as sales`,[documentId,
     [versionId,pendingVersionId,file.versionId,unacceptedFile.versionId],[acceptanceId,fileAcceptanceId],
     [fileId,pendingFileId,file.fileId,unacceptedFile.fileId],studentPerson,sale]);
  assert.deepEqual(live,{documents:0,versions:0,requirements:0,acceptances:0,signed_snapshots:0,renders:0,
   presentations:0,templates:0,files:0,inline_contents:0,people:1,sales:1});
  assert.equal(sha256((await reader.get(archived.objectKey)).bytes),archived.archiveSha256);
  request=await releaseAndClaim(request);
  assert.deepEqual(await rows('select preview_id from private.preview_payloads where preview_id=$1',[termination.id]),[]);
  assert.equal((await rows('select preview_id from private.p06_previews where preview_id=$1',[termination.id])).length,1);
  const saleProof=await verifyOrganizationSaleErasure({db,worker,attestor,request,requestId,org,sale,product,
   studentPerson,terminationReason,terminationPreviewId:termination.id,store,reader,sourceProjectRef});
  assert.deepEqual(await rows('select preview_id from private.p06_previews where preview_id=$1',[termination.id]),[]);
  const invoiceArchive=await verifyPublishedInvoiceArchive({db,requestId,orgId:org,invoice,r2Pilot});
  const invoiceProof=await verifyArchivedInvoiceRemoval({db,worker,attestor,request:await releaseAndClaim(request),archived:invoiceArchive,
   claim:reclaim,apiUrl,serviceKey});
  const finance=await verifySettledBillingErasure({db,worker,attestor,request:await releaseAndClaim(invoiceProof.request),parsedInvoiceArchive:invoiceArchive});
  const history=await verifyBillingHistoryErasure({db,worker,attestor,request:await releaseAndClaim(finance.request),parsedInvoiceArchive:invoiceArchive});
  request=history.request;
  const abandonedHold=key();
  await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
   values($1,$2,'private.p07_lifecycle_previews',$3,'Synthetic intake hold','synthetic',clock_timestamp())`,[abandonedHold,org,abandoned.id]);
  await db.query('delete from core.retention_holds where id=$1',[mediaHold]);
  const mediaProof=await verifyOrganizationMediaErasure({db,org,owner,jobId,requestId,request,claim,execute,media});
  const liveDatabase=`select scopes#>'{database,live_database}' as database
   from private.p07_privacy_manifests where request_id=$1`;
  assert.deepEqual(await rows(liveDatabase,[requestId]),[{database:{state:'held'}}]);
  assert.deepEqual(await rows('select id from private.p07_lifecycle_previews where id=$1 and not used',[abandoned.id]),[{id:abandoned.id}]);
  await db.query('delete from core.retention_holds where id=$1',[abandonedHold]);
  const [{fileStage}]=await rows(`select scopes#>'{exports,managed_file_erasure}' as "fileStage"
   from private.p07_privacy_manifests where request_id=$1`,[requestId]);
  assert.equal(fileStage.state,'completed');
  const {inventory}=fileStage;
  assert.equal(inventory.published_document_storage_purges,2);
  assert.equal(inventory.live_objects,0);
  assert.equal(inventory.unproved_storage_observations,0);
  assert.equal(inventory.live_previews,0);
  assert.deepEqual(await rows('select contact_id from private.account_contact_projections where org_id=$1',[org]),[]);
  await assert.rejects(readOrganizationErasureReceipt({db,requestId,orgId:org}),/ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE/);
  if(r2Pilot)await assert.rejects(r2Pilot.reader.withRestoreEvidence('0'.repeat(64),()=>assert.fail('unclosed scope allowed restore')),
   /R2_ERASURE_PENDING/);
  request=await reclaim();
  const directory=await verifyOrganizationDirectoryErasure({db,worker,attestor,request,requestId,org,terminationReason,reader,store,sourceProjectRef});
  await execute(request);
  const [{database}]=await rows(liveDatabase,[requestId]);
  assert.equal(database.state,'completed',JSON.stringify(database));
  assert.deepEqual(await rows("select reason from core.audit_events where org_id=$1 and subject_id=$2 and action='organization_delete_apply_v1'",
   [org,requestId]),[{reason:null}]);
  assert.deepEqual(await rows("select payload ? 'reason' as contains_reason from private.p07_lifecycle_previews where id=$1 and used",
   [preview.id]),[{contains_reason:false}]);
  assert.deepEqual(await rows('select id from private.p07_lifecycle_previews where id=$1',[abandoned.id]),[]);
  assert.deepEqual(await rows(intakeContexts,[requestId,org]),[]);
  await db.query('begin');
  try{
   await db.query('select id from core.privacy_requests where id=$1 for update',[requestId]);
   await assert.rejects(readOrganizationErasureReceipt({db,requestId,orgId:org}),/ORGANIZATION_ERASURE_COMMITTED_READ_REQUIRED/);
  }finally{await db.query('rollback');}
  const receipt=await readOrganizationErasureReceipt({db,requestId,orgId:org});
  assert.equal(receipt.database.directory_archive_sha256,directory.directory_archive_sha256);
  assert.equal(receipt.database.sale_archive_sha256,saleProof.sale_archive_sha256);
  assert(receipt.entry.subject_ids.includes(studentPerson));
  assert.equal((await must(owner,'account_get_v1')).id,media.accountId);
  assert.equal(await sharedMembership(),sharedPerson);
  assert.equal((await must(student,'account_get_v1')).id,studentAccount.id);
  const after=await readMixedErasureProjection(db,restoreIds);
  const restore=await verifyOrganizationProjectionRestore({db,dbUrl,requestId,orgId:org,before,after,r2Pilot,
   signingContext,receipt,expectedRemoteEntries:3,checkPending:true,previousEvidence});
  return {signed_document_source_purge:true,document_archive_sha256:archived.archiveSha256,document_storage_purges:2,
   accepted_file_sha256:file.checksum,invoice_archive_sha256:invoiceProof.archive_receipt_sha256,
   billing_archive_sha256:finance.archiveSha256,billing_history_archive_sha256:history.archiveSha256,
   ...saleProof,...mediaProof,...directory,mixed_restore_verified:true,shared_login_membership_preserved:true,
   erased_subjects:receipt.entry.subject_ids.length,...restore};
 }finally{await db.end();}
}
