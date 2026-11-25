import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {context,must} from './api-client.mjs';
import {importFixture} from './crm-import-fixture.mjs';
import {beginBoundR2PilotErasure} from './r2-erasure-pilot-fixture.mjs';
import {eraseExpiredImportObject} from '../scripts/p07-storage-erasure.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

export async function verifyCrmImportSourceErasure(t,{worker,attestor,workerRole,attestorRole,claim,execute}){
 const f=await importFixture(t);
 const {db,org,owner,api}=f;
 const {API_URL:apiUrl,SERVICE_ROLE_KEY:serviceKey}=context().env;
 const origin=new URL(apiUrl).origin;
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const hold=key();
 try{
  const consent={purpose:'marketing',version:'synthetic-consent-v1',occurred_at:'2026-01-01T00:00:00Z',accepted:true};
  const unmapped={...f.mapping,columns:f.mapping.columns.filter(c=>c.target!=='consents')};
  const importSource=async(source,phone,consents,mapping)=>{
   const p=await f.preview([{source_key:source,phone,consents}],key(),mapping);
   await f.apply(p,[1]);
   const [result]=await f.work();
   assert.equal(result.ok,true,result.error?.code);
   const [file]=await rows(`select f.checksum,f.size_bytes,f.object_key,o.id as object_id from core.files f
    join storage.objects o on o.bucket_id='ftksaas-imports' and o.name=f.object_key where f.id=$1`,[p.file]);
   assert(file);
   return {...p,...file};
  };
  const ordinary=await importSource('ordinary-source','+905550000091');
  const consentSource=await importSource('consent-source','+905550000092',[consent]);
  const unaccounted=await importSource('unaccounted-source','+905550000093',true,unmapped);
  const applications=()=>rows(`select a.id,a.version,a.person_id,a.intake,r.job_id from core.public_applications a
   join core.import_rows r on r.org_id=a.org_id and r.id=a.import_row_id
   where a.org_id=$1 order by r.job_id`,[org]);
  const app=(await applications()).find(a=>a.job_id===ordinary.job);
  await api('public_application_review_v1',{application_id:app.id,expected_version:Number(app.version),action:'create_candidate'});
  const beforeApps=await applications();
  const reviewed=beforeApps.find(a=>a.job_id===ordinary.job);
  assert(reviewed.person_id);
  assert.equal(beforeApps.find(a=>a.job_id===consentSource.job).intake.consents[0].accepted,true);
  assert.deepEqual(beforeApps.find(a=>a.job_id===unaccounted.job).intake.consents,[]);
  const [{id:lead}]=await rows('select id from core.leads where org_id=$1 and person_id=$2',[org,reviewed.person_id]);
  const [{id:contact}]=await rows('select id from core.person_contacts where org_id=$1 and person_id=$2',[org,reviewed.person_id]);

  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,all_data:true,reason:'Synthetic CRM source erasure'});
  const {job_id:jobId}=await must(owner,'organization_delete_apply_v1',{org_id:org,all_data:true,
   preview:{id:preview.id,token:preview.token},reauth:owner.jwt},key());
  const [{request_id:requestId}]=await rows('select request_id from private.p07_privacy_jobs where id=$1',[jobId]);
  await beginBoundR2PilotErasure({db,requestId,orgId:org});
  await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[workerRole,org]);
  await db.query('insert into private.organization_import_copy_erasure_scopes(db_role,request_id) values($1,$2)',[workerRole,requestId]);
  await execute(await claim(org,jobId));
  await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
  const request=await claim(org,jobId);
  const erase=(file,fetcher)=>eraseExpiredImportObject({db:worker,attestor,request,fileId:file.file,apiUrl,serviceKey,fetcher});
  const read=file=>fetch(origin+'/storage/v1/object/authenticated/ftksaas-imports/'+file.object_key,{
   headers:{authorization:'Bearer '+serviceKey,apikey:serviceKey}
  });
  const readHash=async file=>{
   const result=await read(file);
   assert.equal(result.ok,true,result.status);
   return createHash('sha256').update(Buffer.from(await result.arrayBuffer())).digest('hex');
  };
  for(const file of [ordinary,consentSource,unaccounted]){
   await db.query(`insert into private.p07_storage_erasure_scopes(db_role,request_id,file_id,provider_origin,attestor_role)
    values($1,$2,$3,$4,$5)`,[workerRole,requestId,file.file,origin,attestorRole]);
   await assert.rejects(erase(file),/FORBIDDEN/);
   await db.query(`insert into private.organization_import_source_erasure_approvals
    (request_id,org_id,file_id,import_job_id,approval_id,checksum) values($1,$2,$3,$4,$5,$6)`,
   [requestId,org,file.file,file.job,key(),file.checksum]);
   assert.equal(await readHash(file),file.checksum);
  }
  const retain=(kind,subject)=>db.query(`insert into core.retention_holds
   (id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
   values($1,$2,$3,$4,'Synthetic CRM source hold','isolated acceptance',clock_timestamp()-interval '1 day')`,
  [hold,org,'core.'+kind,subject]);
  const release=()=>db.query('delete from core.retention_holds where id=$1',[hold]);
  for(const [kind,subject] of [['public_applications',app.id],['people',reviewed.person_id],['person_contacts',contact],['leads',lead]]){
   await retain(kind,subject);
   assert.deepEqual(await erase(ordinary),{state:'held'});
   await release();
  }
  for(const file of [consentSource,unaccounted]){
   assert.deepEqual(await erase(file,(url,options)=>{
    assert.equal(options.method,'GET');
    return fetch(url,options);
   }),{state:'held'});
   assert.equal(await readHash(file),file.checksum);
  }
  const {file:fileId,checksum,size_bytes:bytes}=ordinary;
  const [{result:prepared}]=(await worker.query('select private.p07_storage_erasure_prepare($1,$2) result',[request,fileId])).rows;
  assert.equal(prepared.state,'ready');
  await assert.rejects(attestor.query('select private.p07_crm_import_storage_authorize($1,$2,$3,$4,$5)',
   [request,fileId,checksum,bytes,JSON.stringify([{row_number:1,payload:{source_key:'ordinary-source',consents:[]}}])]),
  /RESULT_NOT_CONFIRMED/);
  await attestor.query('select private.p07_linked_import_storage_witness($1,$2,$3,$4,$5)',[request,fileId,'authorize',checksum,bytes]);
  const denied=await fetch(origin+'/storage/v1/object/ftksaas-imports/'+ordinary.object_key,{method:'DELETE',
   headers:{authorization:'Bearer '+serviceKey,apikey:serviceKey}});
  assert.equal(denied.ok,false);
  await denied.body?.cancel();
  await assert.rejects(erase(ordinary,async(url,options)=>{
   if(options.method!=='DELETE')return fetch(url,options);
   await retain('person_contacts',contact);
   try{return await fetch(url,options);}finally{await release();}
  }),/STORAGE_DELETE_UNCONFIRMED/);
  assert.equal(await readHash(ordinary),ordinary.checksum);
  const proof=()=>rows('select file_id,object_id,removed_bytes,checksum from private.p07_storage_erasures where request_id=$1',[requestId]);
  assert.deepEqual(await proof(),[]);
  assert.deepEqual(await erase(ordinary),{state:'completed'});
  assert.deepEqual(await erase(ordinary),{state:'completed'});
  assert.deepEqual(await proof(),[{file_id:ordinary.file,object_id:ordinary.object_id,
   removed_bytes:ordinary.size_bytes,checksum:ordinary.checksum}]);
  const absent=await read(ordinary);
  assert.equal(absent.ok,false);
  await absent.body?.cancel();
  assert.deepEqual(await rows('select id from storage.objects where id=$1',[ordinary.object_id]),[]);
  assert.deepEqual(await applications(),beforeApps);
 }finally{
  await db.query('delete from core.retention_holds where id=$1',[hold]);
  await db.query('delete from private.p06_worker_scopes where db_role=$1',[f.role]);
 }
}
