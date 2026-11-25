import assert from 'node:assert/strict';
import {must} from './api-client.mjs';
import {importFixture} from './crm-import-fixture.mjs';
import {beginBoundR2PilotErasure} from './r2-erasure-pilot-fixture.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

export async function verifyCrmImportCopyHolds(t,{workerRole,claim,execute,controlOrg}){
 const f=await importFixture(t);
 const {db,org,owner,api}=f;
 const rows=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const hold=key();
 let requestId;
 try{
  const p=await f.preview([
   {source_key:'held-source',phone:'+905550000084'},
   {source_key:'ordinary-source',phone:'+905550000085'}
  ]);
  await f.apply(p,[1,2]);
  const [finished]=await f.work();
  assert.equal(finished.ok,true,finished.error?.code);
  const applications=()=>rows(`select a.id,a.person_id,a.version,a.intake from core.public_applications a
   join core.import_rows r on r.org_id=a.org_id and r.id=a.import_row_id where r.job_id=$1 order by r.row_number`,[p.job]);
  const [app]=await applications();
  await api('public_application_review_v1',{application_id:app.id,expected_version:Number(app.version),action:'create_candidate'});
  const beforeApps=await applications();
  const personId=beforeApps[0].person_id;
  assert(personId);
  const conflicting=await f.preview([
   {source_key:'held-source',phone:'+905550000087'},
   {source_key:'different-source',phone:'+905550000088'}
  ],p.namespace);
  await f.apply(conflicting,[2]);
  const [differentResult]=await f.work();
  assert.equal(differentResult.ok,true,differentResult.error?.code);
  assert.deepEqual(await rows('select state,error_code from core.import_rows where job_id=$1 order by row_number',[conflicting.job]),[
   {state:'invalid',error_code:'IDEMPOTENCY_PAYLOAD_MISMATCH'},{state:'applied',error_code:null}
  ]);
  const replay=await f.preview([{source_key:'held-source',phone:'+905550000084'}],p.namespace);
  await f.apply(replay,[1]);
  const [replayedResult]=await f.work();
  assert.equal(replayedResult.ok,true,replayedResult.error?.code);
  assert.deepEqual(await rows('select state,created_references from core.import_rows where job_id=$1',[replay.job]),
   [{state:'applied',created_references:[app.id]}]);
  const [{id:contactId}]=await rows("select id from core.person_contacts where org_id=$1 and person_id=$2 and kind='phone'",[org,personId]);
  const [{id:leadId}]=await rows('select id from core.leads where org_id=$1 and person_id=$2',[org,personId]);
  const copies=(job=p.job)=>rows('select id,payload,version from core.import_rows where job_id=$1 order by row_number',[job]);
  const before=await copies();
  const beforeReplay=await copies(replay.job);
  const beforeConflicting=await copies(conflicting.job);
  assert.equal(before.length,2);
  assert(before.every(row=>Object.keys(row.payload).length>0));
  const tracking=(job=p.job)=>rows(`select c.receipt_id from private.p06_contexts c join core.operation_receipts r on r.id=c.receipt_id
   where r.org_id=$1 and r.business_reference=$2 and c.operation in ('import_preview_v1','import_apply_v1') order by c.receipt_id`,
  [org,job]);
  const tracked=await tracking();
  assert.equal(tracked.length,2);
  const trackedReplay=await tracking(replay.job);
  assert.equal(trackedReplay.length,2);
  const trackedConflicting=await tracking(conflicting.job);
  assert.equal(trackedConflicting.length,2);
  const retain=(kind,subject,tenant=org)=>db.query(`insert into core.retention_holds
   (id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
    values($1,$2,$3,$4,'Synthetic downstream CRM hold','isolated acceptance',clock_timestamp()-interval '1 day')`,
  [hold,tenant,'core.'+kind,subject]);
  const release=()=>db.query('delete from core.retention_holds where id=$1',[hold]);
  const previewCopy=(id=p.preview.id)=>rows('select preview_id from private.p06_previews where preview_id=$1',[id]);
  const previewPayload=(id=p.preview.id)=>rows('select preview_id from private.preview_payloads where preview_id=$1',[id]);
  await db.query("update private.p06_previews set expires_at=clock_timestamp()-interval '1 second' where preview_id=any($1::uuid[])",
   [[p.preview.id,replay.preview.id,conflicting.preview.id]]);
  await db.query("update core.operation_receipts set result_expires_at=clock_timestamp()-interval '1 second' where id=any($1::uuid[])",
   [[...tracked,...trackedReplay,...trackedConflicting].map(row=>row.receipt_id)]);
  await retain('people',personId);
  await f.work();
  assert.deepEqual(await previewCopy(),[{preview_id:p.preview.id}]);
  assert.deepEqual(await tracking(),tracked);
  assert.deepEqual(await previewCopy(replay.preview.id),[{preview_id:replay.preview.id}]);
  assert.deepEqual(await tracking(replay.job),trackedReplay);
  assert.deepEqual(await previewCopy(conflicting.preview.id),[]);
  assert.deepEqual(await tracking(conflicting.job),[]);
  await release();
  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,all_data:true,reason:'Synthetic CRM import erasure'});
  const {job_id:jobId}=await must(owner,'organization_delete_apply_v1',{org_id:org,all_data:true,
   preview:{id:preview.id,token:preview.token},reauth:owner.jwt},key());
  [{request_id:requestId}]=await rows('select request_id from private.p07_privacy_jobs where id=$1',[jobId]);
  await beginBoundR2PilotErasure({db,requestId,orgId:org});
  await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[workerRole,org]);
  await db.query('insert into private.organization_import_copy_erasure_scopes(db_role,request_id) values($1,$2)',[workerRole,requestId]);
  const claimNext=async()=>{
   await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
   return claim(org,jobId);
  };
  const run=async request=>{
   await execute(request??await claimNext());
   return (await rows("select scopes#>'{exports,import_processing_copies}' result from private.p07_privacy_manifests where request_id=$1",[requestId]))[0].result;
  };
  const scrubbed=row=>({...row,payload:{},version:String(Number(row.version)+1)});
  for(const [kind,subject] of [['public_applications',app.id],['people',personId],['person_contacts',contactId],['leads',leadId]]){
   await retain(kind,subject);
   const result=await run();
   assert.equal(result.state,'held');
   assert.equal(result.removed_rows,3);
   assert.equal(result.removed_preview_payloads,1);
   assert.deepEqual(await copies(),[before[0],scrubbed(before[1])]);
   assert.deepEqual(await copies(replay.job),beforeReplay);
   assert.deepEqual(await copies(conflicting.job),beforeConflicting.map(scrubbed));
   assert.deepEqual(await previewCopy(),[{preview_id:p.preview.id}]);
   assert.deepEqual(await tracking(),tracked);
   assert.deepEqual(await previewPayload(),[{preview_id:p.preview.id}]);
   assert.deepEqual(await previewPayload(replay.preview.id),[{preview_id:replay.preview.id}]);
   assert.deepEqual(await previewPayload(conflicting.preview.id),[]);
   await release();
  }
  const contended=await claimNext();
  await db.query('begin');
  try{
   await db.query('lock table core.public_applications in row exclusive mode');
   const deferred=await run(contended);
   assert.equal(deferred.state,'retry_wait');
   assert.equal(deferred.removed_rows,3);
   assert.deepEqual(await copies(replay.job),beforeReplay);
  }finally{await db.query('rollback');}
  await retain('people',personId,controlOrg);
  const result=await run();
  assert.equal(result.state,'completed');
  assert.equal(result.removed_rows,5);
  assert.equal(result.removed_preview_payloads,3);
  assert.deepEqual(await copies(),before.map(scrubbed));
  assert.deepEqual(await copies(replay.job),beforeReplay.map(scrubbed));
  assert.deepEqual(await previewCopy(),[]);
  assert.deepEqual(await tracking(),[]);
  assert.deepEqual(await previewPayload(),[]);
  assert.deepEqual(await previewPayload(replay.preview.id),[]);
  assert.deepEqual(await applications(),beforeApps);
  assert.equal((await rows("select count(*)::int n from storage.objects where bucket_id='ftksaas-imports' and name=$1",[org+'/'+p.file]))[0].n,1);
 }finally{
  await db.query('delete from core.retention_holds where id=$1',[hold]);
  if(requestId)await db.query('delete from private.organization_import_copy_erasure_scopes where db_role=$1 and request_id=$2',[workerRole,requestId]);
  await db.query('delete from private.p06_worker_scopes where db_role=$1',[f.role]);
 }
}
