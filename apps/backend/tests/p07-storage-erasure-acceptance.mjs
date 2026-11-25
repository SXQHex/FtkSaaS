import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {authUser,context,must} from './api-client.mjs';
import {eraseExpiredImportObject} from '../scripts/p07-storage-erasure.mjs';
import {tick as buildReports} from '../scripts/p06-worker.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {verifyErasureReceiptRestore} from './native-erasure-restore-fixture.mjs';
import {beginBoundR2PilotErasure} from './r2-erasure-pilot-fixture.mjs';

export async function verifyNativeStorageErasure(){
 const {db,org,center,owner,account,platform,plan,person}=await preparationFixture();
 const {API_URL,ANON_KEY,SERVICE_ROLE_KEY,DB_URL}=context().env;
 const headers={apikey:SERVICE_ROLE_KEY,authorization:'Bearer '+SERVICE_ROLE_KEY};
 const bucket='ftksaas-imports';
 const base=API_URL+'/storage/v1/object/';
 const bytes=Buffer.from('source_key,display_name\r\nfixture,Synthetic import\r\n');
 const checksum=createHash('sha256').update(bytes).digest('hex');
 const role='storage_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 const attestorRole='attestor_'+key().replaceAll('-',''),attestorPassword=randomBytes(24).toString('hex');
 const reportRole='report_'+key().replaceAll('-',''),reportPassword=randomBytes(24).toString('hex');
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const bank=()=>Array.from({length:512},key);
 let worker,attestor,requestId;
 const cleanup=[];
 const preservedControls=new Set();
 const upload=async(tenant,location,ownerPerson,uploader=account.id)=>{
  const id=key(),path=tenant+'/'+id;
  await db.query("insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,checksum,purpose,state,expires_at) values($1,$2,$3,$4,$5,'text/csv',$6,$7,'import','pending_upload',clock_timestamp()+interval '2 hours')",[id,tenant,location,ownerPerson,path,bytes.length,checksum]);
  await db.query('insert into private.p06_files values($1,$2,$3)',[id,uploader,'synthetic.csv']);
  const signed=await fetch(base+'upload/sign/'+bucket+'/'+path,{
   method:'POST',headers:{...headers,'content-type':'application/json','x-upsert':'false'},body:'{"upsert":false}'
  });
  assert.equal(signed.ok,true,'Native upload signing failed');
  const {url}=await signed.json(),uploadUrl=API_URL+'/storage/v1'+url;
  const write=()=>fetch(uploadUrl,{method:'PUT',headers:{apikey:ANON_KEY,'content-type':'text/csv'},body:bytes});
  const response=await write();
  assert.equal(response.ok,true,'Native upload failed');
  await response.body?.cancel();
  cleanup.push(path);
  const download=await fetch(base+'sign/'+bucket+'/'+path,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{"expiresIn":600}'});
  assert.equal(download.ok,true);
  const {signedURL}=await download.json();
  const downloadUrl=API_URL+'/storage/v1'+signedURL;
  const object=(await q('select id from storage.objects where bucket_id=$1 and name=$2',[bucket,path]))[0];
  assert(object?.id);
  return {id,path,objectId:object.id,write,downloadUrl};
 };
 const read=({path})=>fetch(base+'authenticated/'+bucket+'/'+path,{headers});
 const byteHash=async response=>{assert.equal(response.ok,true);return createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');};
 const orgExportDownload=jobId=>fetch(API_URL+'/functions/v1/backend-v1/report_file_get_v1?download=csv',{
  method:'POST',headers:{apikey:ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},
  body:JSON.stringify({client_api_version:1,request_id:key(),org_id:org,center_id:center,operation_key:key(),job_id:jobId})
 });
 const runP06=async()=>{
  const url=new URL(DB_URL);url.username=reportRole;url.password=reportPassword;
  const builder=new pg.Client({connectionString:url.href,statement_timeout:10000});
  await builder.connect();
  try{
   const [result]=await buildReports(builder,org);
   assert.equal(result.ok,true,result.error?.code);
  }finally{await builder.end();}
 };
 const orgExport=async()=>{
  const filters={center_ids:[center],interval:{starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date().toISOString()}};
  const {job_id}=await must(owner,'report_export_start_v1',{org_id:org,center_id:center,report:'collections_debts',filters,format:'csv'},key());
  await db.query(`create role ${reportRole} login password '${reportPassword}' in role ftk_p06_worker`);
  await db.query('insert into private.p06_worker_scopes values($1,$2)',[reportRole,org]);
  await runP06();
  const snapshot=(await q('select file_id,expires_at from core.report_jobs where id=$1',[job_id]))[0];
  assert(snapshot.expires_at>Date.now(),'Organization delete must exercise unexpired export bytes');
  const hash=await byteHash(await orgExportDownload(job_id));
  return {job_id,file_id:snapshot.file_id,hash};
 };
 const pendingImport=async namespace=>{
  const file=await upload(org,center,person);
  const mapping={columns:['source_key','display_name'].map(target=>({source_column:target,target}))};
  const {job_id}=await must(owner,'import_preview_v1',{org_id:org,center_id:center,file_id:file.id,mapping,source_namespace:namespace},key());
  await runP06();
  const result=await must(owner,'job_status_get_v1',{org_id:org,center_id:center,job_id});
  assert.equal(result.result_reference.type,'previews');
  return {file,jobId:job_id,previewId:result.result_reference.id};
 };
 const copies=async({jobId,previewId})=>({
  preview:await q('select preview_id from private.p06_previews where preview_id=$1',[previewId]),
  payload:await q('select preview_id from private.preview_payloads where preview_id=$1',[previewId]),
  contexts:await q("select c.receipt_id from private.p06_contexts c join core.operation_receipts r on r.id=c.receipt_id where r.org_id=$1 and r.business_reference=$2 and c.operation in ('import_preview_v1','import_apply_v1') order by c.receipt_id",[org,jobId])
 });
 const rowPayload=async jobId=>(await q('select id,payload,state,source_key,created_references from core.import_rows where job_id=$1',[jobId]))[0];
 try{
  await db.query('insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do update set reauth_max_age_seconds=excluded.reauth_max_age_seconds');
  await db.query('insert into private.p06_configuration values($1,2097152,5000,16777216)',[org]);
  const target=await upload(org,center,person);
  const unknown=await upload(org,center,person);
  const ready=await upload(org,center,person);
  const linked=await upload(org,center,person);
  preservedControls.add(linked.path);
  for(const file of [ready,linked]){
   await must(owner,'file_upload_complete_v1',{org_id:org,center_id:center,file_id:file.id,checksum},key());
   assert.equal(await byteHash(await fetch(file.downloadUrl)),checksum);
  }
  const linkedJobId=key();
  await db.query("insert into core.import_jobs(id,org_id,center_id,requester_account_id,file_id,mapping,state,file_checksum,source_namespace) values($1,$2,$3,$4,$5,'{}','succeeded',$6,'synthetic retained source')",[linkedJobId,org,center,account.id,linked.id,checksum]);
  const report=await orgExport();
  const processed=await pendingImport('synthetic processed source');
  const pending=await pendingImport('synthetic pending source');
  preservedControls.add(pending.file.path);
  const apply=await must(owner,'preview_get_v1',{org_id:org,center_id:center,preview_id:processed.previewId});
  await must(owner,'import_apply_v1',{org_id:org,center_id:center,preview:{id:apply.id,token:apply.token}},key());
  await runP06();
  const processingBefore=await rowPayload(processed.jobId);
  const pendingBefore=await rowPayload(pending.jobId);
  const copiesBefore=await copies(processed),pendingCopies=await copies(pending);
  const source=()=>q('select payload_hash,created_references,operation_id from private.p06_sources where org_id=$1 and source_namespace=$2',[org,'synthetic processed source']);
  const sourceBefore=await source();
  assert.equal(processingBefore.state,'applied');
  assert.equal(pendingBefore.state,'valid');
  assert.equal(copiesBefore.preview.length,1);
  assert.equal(copiesBefore.payload.length,1);
  assert(copiesBefore.contexts.length>0);
  assert.equal(sourceBefore.length,1);
  const foreignOwner=await authUser('p07-storage-control'),foreignAccount=await must(foreignOwner,'account_get_v1');
  const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:foreignAccount.id,name:'Synthetic O05 control tenant',initial_plan_id:plan},key())).primary_id;
  const foreignCenter=(await must(foreignOwner,'center_create_v1',{org_id:foreignOrg,name:'O05 control center',timezone:'UTC'},key())).primary_id;
  const foreignPerson=(await q('select owner_person_id from core.organizations where id=$1',[foreignOrg]))[0].owner_person_id;
  const control=await upload(foreignOrg,foreignCenter,foreignPerson,foreignAccount.id);
  assert.equal(await byteHash(await fetch(target.downloadUrl)),checksum);
  assert.equal(await byteHash(await read(control)),checksum);
  await db.query("update core.files set expires_at=clock_timestamp()-interval '3 hours' where id=any($1::uuid[])",[[target.id,unknown.id,control.id]]);
  const contactPerson=(await must(owner,'person_create_v1',{
   org_id:org,center_id:center,display_name:'Synthetic O04 and O05 rehearsal',contacts:[]
  },key())).primary_id;
  const contactId=key();
  await db.query("insert into core.person_contacts(id,org_id,person_id,kind,value) values($1,$2,$3,'email',$4)",
   [contactId,org,contactPerson,'rehearsal-'+contactId+'@ftksaas.invalid']);
  const objectIds=[target.objectId,ready.objectId,processed.file.objectId];
  const before={
   contacts:await q('select id from core.person_contacts where id=$1',[contactId]),
   objects:await q('select id from storage.objects where id=any($1::uuid[])',[[...objectIds,control.objectId]]),
   exports:await q('select file_id from private.p06_export_files where file_id=$1',[report.file_id])
  };

  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,reason:'synthetic O05 restore acceptance',all_data:true});
  const {job_id}=await must(owner,'organization_delete_apply_v1',{org_id:org,all_data:true,preview:{id:preview.id,token:preview.token},reauth:owner.jwt},key());
  requestId=(await q('select request_id from private.p07_privacy_jobs where id=$1',[job_id]))[0].request_id;
  await beginBoundR2PilotErasure({db,requestId,orgId:org});
  await db.query(`create role ${role} login password '${password}' in role ftk_p07_privacy_worker`);
  await db.query(`create role ${attestorRole} login password '${attestorPassword}' in role ftk_p07_storage_attestor`);
  await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[role,org]);
  await db.query('insert into private.organization_contact_erasure_scopes values($1,$2)',[role,org]);
  const url=new URL(DB_URL);url.username=role;url.password=password;
  worker=new pg.Client({connectionString:url.href,statement_timeout:10000});await worker.connect();
  url.username=attestorRole;url.password=attestorPassword;
  attestor=new pg.Client({connectionString:url.href,statement_timeout:10000});await attestor.connect();
  const claim=async()=> (await worker.query('select private.p07_privacy_claim($1,$2,1) jobs',[org,bank()])).rows[0].jobs[0].request;
  let request=await claim();
  const invoke=(fileId,fetcher)=>eraseExpiredImportObject({db:worker,attestor,request,fileId,serviceKey:SERVICE_ROLE_KEY,apiUrl:API_URL,fetcher});
  const proof=()=>q('select file_id,object_id,removed_bytes,checksum from private.p07_storage_erasures where request_id=$1',[requestId]);
  assert.deepEqual(await invoke(target.id),{state:'unbound'});
  for(const file of [target,unknown,control,ready,linked,processed.file,pending.file]){
   await db.query('insert into private.p07_storage_erasure_scopes(db_role,request_id,file_id,provider_origin,attestor_role) values($1,$2,$3,$4,$5)',[role,requestId,file.id,new URL(API_URL).origin,attestorRole]);
  }
  const approvalSql=`insert into private.organization_import_source_erasure_approvals
   (request_id,org_id,file_id,import_job_id,approval_id,checksum) values($1,$2,$3,$4,$5,$6)`;
  const approvalValues=(file,importJobId)=>[requestId,org,file.id,importJobId,key(),checksum];
  await assert.rejects(worker.query(approvalSql,approvalValues(processed.file,processed.jobId)),/permission denied/);
  await assert.rejects(invoke(processed.file.id),/FORBIDDEN/);
  await db.query(approvalSql,approvalValues(processed.file,processed.jobId));
  await assert.rejects(invoke(processed.file.id),/FORBIDDEN/);
  await db.query(approvalSql,approvalValues(pending.file,pending.jobId));
  await db.query(approvalSql,approvalValues(linked,linkedJobId));
  await assert.rejects(invoke(control.id),/FORBIDDEN/);
  await assert.rejects(worker.query('select private.p07_storage_erasure_confirm($1,$2)',[request,target.id]),/permission denied/);
  await assert.rejects(attestor.query('select private.p07_storage_erasure_prepare($1,$2)',[request,target.id]),/permission denied/);
  await assert.rejects(attestor.query('select private.p07_storage_erasure_confirm($1,$2)',[request,target.id]),/RESULT_NOT_CONFIRMED/);
  const h=key();
  const hold=()=>db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,'storage.objects',$3,'Synthetic O05 hold','isolated acceptance',clock_timestamp()-interval '1 day')",[h,org,target.objectId]);
  const release=()=>db.query('delete from core.retention_holds where id=$1',[h]);
  await hold();
  try{assert.deepEqual(await invoke(target.id),{state:'held'});}finally{await release();}
  await assert.rejects(invoke(target.id,async(url,options)=>{
   if(options.method!=='DELETE')return fetch(url,options);
   await hold();
   try{return await fetch(url,options);}finally{await release();}
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.equal(await byteHash(await read(target)),checksum);
  assert.deepEqual(await proof(),[]);
  await assert.rejects(invoke(target.id,(url,options)=>{
   if(options.method==='DELETE')throw Error('Synthetic interruption before provider request');
   return fetch(url,options);
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.equal(await byteHash(await read(target)),checksum);
  await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[job_id]);
  const expired=request;
  request=await claim();
  await assert.rejects(worker.query('select private.p07_storage_erasure_prepare($1,$2)',[expired,target.id]),/FORBIDDEN/);
  assert.deepEqual(await invoke(target.id),{state:'completed'});
  assert.deepEqual(await invoke(target.id),{state:'completed'});
  for(const response of [await read(target),await fetch(target.downloadUrl),await target.write()]){
   assert.equal(response.ok,false);await response.body?.cancel();
  }
  const expected=[{file_id:target.id,object_id:target.objectId,removed_bytes:String(bytes.length),checksum}];
  assert.deepEqual(await proof(),expected);
  await assert.rejects(db.query('delete from private.p07_storage_erasures where file_id=$1',[target.id]),/INTEGRITY_VIOLATION/);
  await assert.rejects(invoke(unknown.id,async(url,options)=>{
   const result=await fetch(url,options);
   if(options.method!=='DELETE')return result;
   assert.equal(result.ok,true);await result.body?.cancel();
   throw Error('Synthetic loss of native acknowledgement');
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.deepEqual(await invoke(unknown.id),{state:'unconfirmed'});
  assert.deepEqual(await proof(),expected);
  assert.equal(await byteHash(await read(control)),checksum);
  await db.query('insert into private.organization_export_erasure_scopes(db_role,request_id) values($1,$2)',[role,requestId]);
  await db.query('insert into private.organization_import_copy_erasure_scopes(db_role,request_id) values($1,$2)',[role,requestId]);
  const exportHold=key();
  const processingHold=key();
  await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,'core.report_jobs',$3,'Synthetic retained CSV','isolated acceptance',clock_timestamp()-interval '1 day')",[exportHold,org,report.job_id]);
  await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,'core.import_rows',$3,'Synthetic import row hold','isolated acceptance',clock_timestamp()-interval '1 day')",[processingHold,org,processingBefore.id]);
  const stage=(await worker.query('select private.p07_privacy_execute($1,$2) result',[request,bank()])).rows[0].result;
  assert.equal(stage.ok,true,stage.error?.code);
  assert.deepEqual(await invoke(target.id),{state:'completed'});
  const manifest=(await q('select scopes from private.p07_privacy_manifests where request_id=$1',[requestId]))[0].scopes;
  assert.equal(manifest.database.organization_contacts.state,'completed');
  assert.equal((await q('select removed_rows from private.organization_contact_erasures where request_id=$1',[requestId]))[0].removed_rows,'1');
  assert.deepEqual(await q('select id from core.person_contacts where id=$1',[contactId]),[]);
  assert.equal(manifest.storage.state,'pending');
  assert.equal(manifest.storage.import_uploads.confirmed_objects,1);
  assert.equal(manifest.exports.organization_database_exports.state,'held');
  assert.equal(manifest.exports.import_processing_copies.state,'held');
  assert.deepEqual(await rowPayload(processed.jobId),processingBefore);
  assert.deepEqual(await copies(processed),copiesBefore);
  assert.equal((await q("select encode(extensions.digest(body,'sha256'),'hex') hash from private.p06_export_files where file_id=$1",[report.file_id]))[0].hash,report.hash);
  await db.query('delete from core.retention_holds where id=$1',[exportHold]);
  await db.query('delete from core.retention_holds where id=$1',[processingHold]);
  const badPayload={...processingBefore.payload,display_name:'Synthetic mismatched copy'};
  await db.query('update core.import_rows set payload=$2 where id=$1',[processingBefore.id,badPayload]);
  await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[job_id]);
  request=await claim();
  await assert.rejects(invoke(linked.id),/FORBIDDEN/);
  assert.equal(await byteHash(await read(linked)),checksum);
  await assert.rejects(invoke(pending.file.id),/FORBIDDEN/);
  assert.equal(await byteHash(await read(pending.file)),checksum);
  const fileHold=key();
  await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,'core.files',$3,'Synthetic retained source','isolated acceptance',clock_timestamp()-interval '1 day')",[fileHold,org,ready.id]);
  try{assert.deepEqual(await invoke(ready.id),{state:'held'});}finally{await db.query('delete from core.retention_holds where id=$1',[fileHold]);}
  assert.deepEqual(await invoke(ready.id),{state:'completed'});
  for(const response of [await read(ready),await fetch(ready.downloadUrl),await ready.write()]){
   assert.equal(response.ok,false);await response.body?.cancel();
  }
  assert.deepEqual((await proof()).filter(p=>p.file_id===ready.id),[{file_id:ready.id,object_id:ready.objectId,removed_bytes:String(bytes.length),checksum}]);
  const finished=(await worker.query('select private.p07_privacy_execute($1,$2) result',[request,bank()])).rows[0].result;
  assert.equal(finished.ok,true,finished.error?.code);
  assert.equal((await q("select scopes#>>'{exports,import_processing_copies,state}' state from private.p07_privacy_manifests where request_id=$1",[requestId]))[0].state,'blocked_provenance');
  assert.deepEqual((await rowPayload(processed.jobId)).payload,badPayload);
  assert.deepEqual(await copies(processed),copiesBefore);
  assert.deepEqual(await q('select operation_id from private.organization_import_copy_erasures where request_id=$1',[requestId]),[]);
  await db.query('update core.import_rows set payload=$2 where id=$1',[processingBefore.id,processingBefore.payload]);
  await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[job_id]);
  request=await claim();
  const processing=(await worker.query('select private.p07_privacy_execute($1,$2) result',[request,bank()])).rows[0].result;
  assert.equal(processing.ok,true,processing.error?.code);
  assert.equal((await q("select scopes#>>'{exports,import_processing_copies,state}' state from private.p07_privacy_manifests where request_id=$1",[requestId]))[0].state,'completed');
  assert.deepEqual(await rowPayload(processed.jobId),{...processingBefore,payload:{}});
  assert.deepEqual(await copies(processed),{preview:[],payload:[],contexts:[]});
  assert.deepEqual(await rowPayload(pending.jobId),pendingBefore);
  assert.deepEqual(await copies(pending),pendingCopies);
  assert.deepEqual(await source(),sourceBefore);
  assert.equal(await byteHash(await read(processed.file)),checksum);
  await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[job_id]);
  request=await claim();
  await db.query("update core.import_rows set state='failed',created_references='{}' where id=$1",[processingBefore.id]);
  try{await assert.rejects(invoke(processed.file.id),/FORBIDDEN/);}
  finally{
   await db.query('update core.import_rows set state=$2,created_references=$3 where id=$1',
    [processingBefore.id,processingBefore.state,processingBefore.created_references]);
  }
  const direct=await fetch(base+bucket+'/'+processed.file.path,{method:'DELETE',headers});
  assert.equal(direct.ok,false);
  await direct.body?.cancel();
  const [{result:sourcePreparation}]=(await worker.query('select private.p07_storage_erasure_prepare($1,$2) result',[request,processed.file.id])).rows;
  assert.equal(sourcePreparation.linked_import_attestation,true);
  const unverified=await fetch(base+bucket+'/'+processed.file.path,{method:'DELETE',headers});
  assert.equal(unverified.ok,false);
  await unverified.body?.cancel();
  const witness='select private.p07_linked_import_storage_witness($1,$2,$3,$4,$5)';
  await assert.rejects(worker.query(witness,[request,processed.file.id,'authorize',checksum,bytes.length]),/permission denied/);
  await assert.rejects(attestor.query(witness,[request,processed.file.id,'authorize','0'.repeat(64),bytes.length]),/FORBIDDEN/);
  assert.equal(await byteHash(await read(processed.file)),checksum);
  const sourceHold=key();
  const retainSource=()=>db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
   values($1,$2,'core.import_rows',$3,'Synthetic retained imported row','isolated acceptance',clock_timestamp()-interval '1 day')`,
  [sourceHold,org,processingBefore.id]);
  const releaseSource=()=>db.query('delete from core.retention_holds where id=$1',[sourceHold]);
  await retainSource();
  try{assert.deepEqual(await invoke(processed.file.id),{state:'held'});}finally{await releaseSource();}
  await assert.rejects(invoke(processed.file.id,async(url,options)=>{
   if(options.method!=='DELETE')return fetch(url,options);
   await retainSource();
   try{return await fetch(url,options);}finally{await releaseSource();}
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.equal(await byteHash(await read(processed.file)),checksum);
  assert.deepEqual((await proof()).filter(p=>p.file_id===processed.file.id),[]);
  let providerDeleted=false;
  let reclaimedRequest;
  await assert.rejects(invoke(processed.file.id,async(url,options)=>{
   if(providerDeleted&&options.method==='GET')throw Error('Synthetic interruption before Storage readback');
   const response=await fetch(url,options);
   if(options.method==='DELETE'&&response.ok){
    providerDeleted=true;
    await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[job_id]);
    reclaimedRequest=await claim();
   }
   return response;
  }),/STORAGE_ABSENCE_UNCONFIRMED/);
  assert.equal(providerDeleted,true);
  assert.notEqual(reclaimedRequest.operation_key,request.operation_key);
  assert.deepEqual((await proof()).filter(p=>p.file_id===processed.file.id),[]);
  assert.deepEqual(await q('select linked_import_acknowledged_at is not null as witnessed from private.p07_storage_erasure_intents where file_id=$1',
   [processed.file.id]),[{witnessed:true}]);
  await assert.rejects(attestor.query(witness,[reclaimedRequest,processed.file.id,'acknowledge',checksum,bytes.length]),/RESULT_NOT_CONFIRMED/);
  await worker.end();
  const workerUrl=new URL(DB_URL);workerUrl.username=role;workerUrl.password=password;
  worker=new pg.Client({connectionString:workerUrl.href,statement_timeout:10000});
  await worker.connect();
  request=reclaimedRequest;
  const bindOrigin=origin=>db.query(`update private.p07_storage_erasure_scopes set provider_origin=$1
   where db_role=$2 and request_id=$3 and file_id=$4`,[origin,role,requestId,processed.file.id]);
  await bindOrigin('https://'+'a'.repeat(20)+'.supabase.co');
  try{
   assert.deepEqual(await invoke(processed.file.id,()=>assert.fail('No provider request for an unbound origin')),{state:'unconfirmed'});
  }finally{await bindOrigin(new URL(API_URL).origin);}
  assert.deepEqual(await invoke(processed.file.id,(url,options)=>{
   assert.equal(options.method,'GET','A witnessed deletion resumes with absence readback');
   return fetch(url,options);
  }),{state:'completed'});
  assert.deepEqual(await invoke(processed.file.id),{state:'completed'});
  assert.deepEqual((await proof()).filter(p=>p.file_id===processed.file.id),
   [{file_id:processed.file.id,object_id:processed.file.objectId,removed_bytes:String(bytes.length),checksum}]);
  for(const response of [await read(processed.file),await fetch(processed.file.downloadUrl),await processed.file.write()]){
   assert.equal(response.ok,false);await response.body?.cancel();
  }
  assert.deepEqual(await source(),sourceBefore);
  assert.equal((await q('select state from core.previews where id=$1',[processed.previewId]))[0].state,'applied');
  const [copyProof]=await q('select removed_rows,removed_previews,removed_preview_payloads,removed_contexts from private.organization_import_copy_erasures where request_id=$1',[requestId]);
  assert.deepEqual(copyProof,{removed_rows:1,removed_previews:1,removed_preview_payloads:1,removed_contexts:copiesBefore.contexts.length});
  await assert.rejects(db.query('delete from private.organization_import_copy_erasures where request_id=$1',[requestId]),/INTEGRITY_VIOLATION/);
  assert.equal((await q("select scopes#>>'{exports,organization_database_exports,state}' state from private.p07_privacy_manifests where request_id=$1",[requestId]))[0].state,'completed');
  assert.deepEqual(await q('select reason,checksum from private.p06_export_purges where request_id=$1 and file_id=$2',[requestId,report.file_id]),[{reason:'organization_delete',checksum:report.hash}]);
  assert.deepEqual(await q('select file_id from private.p06_export_files where file_id=$1',[report.file_id]),[]);
  assert.equal((await q('select state from core.report_jobs where id=$1',[report.job_id]))[0].state,'succeeded');
  const denied=await orgExportDownload(report.job_id);
  assert.match(denied.headers.get('content-type')??'',/^application\/json/);
  const denial=await denied.json();
  assert.equal(denial.ok,false);
  assert.equal(denial.error.code,'SERVICE_UNAVAILABLE');
  await verifyErasureReceiptRestore({
   db,dbUrl:DB_URL,requestId,orgId:org,contactId,objectIds,controlId:control.objectId,exportId:report.file_id,before
  });
 }finally{
  if(worker)await worker.end();
  if(attestor)await attestor.end();
  if(requestId)await db.query('delete from private.p07_storage_erasure_scopes where db_role=$1',[role]);
  await db.query('delete from private.organization_export_erasure_scopes where db_role=$1',[role]);
  await db.query('delete from private.organization_import_copy_erasure_scopes where db_role=$1',[role]);
  await db.query('delete from private.p06_worker_scopes where db_role=$1',[reportRole]);
  await db.query('delete from private.organization_contact_erasure_scopes where db_role=$1',[role]);
  await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);
  await db.query(`drop role if exists ${role}`);
  await db.query(`drop role if exists ${attestorRole}`);
  await db.query(`drop role if exists ${reportRole}`);
  for(const path of cleanup){
   // These intentionally retained sources are discarded with the isolated test stack.
   if(preservedControls.has(path))continue;
   const response=await fetch(base+bucket+'/'+path,{method:'DELETE',headers});
   await response.body?.cancel();
  }
  await db.end();
 }
}
