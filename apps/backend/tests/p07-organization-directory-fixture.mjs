import assert from 'node:assert/strict';
import {archiveOrganizationDirectory,eraseArchivedOrganizationDirectory,readOrganizationDirectoryArchiveScope}
 from '../scripts/organization-db-archive.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

export async function verifyOrganizationDirectoryErasure({db,worker,attestor,request,requestId,org,
 terminationReason,reader,store,sourceProjectRef,roster}){
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const target={db,requestId,orgId:org,store,reader,sourceProjectRef};
 const operation={worker,attestor,request,reader,sourceProjectRef};
 const [{id:roomId}]=await rows('select id from core.rooms where org_id=$1 order by id limit 1',[org]);
 const [{id:auditId}]=await rows("select id from core.audit_events where org_id=$1 and action='role_assign_v1'",[org]);
 const [{id:noticeJob}]=await rows(`select q.id from core.outbox_jobs q join core.audit_events e on e.org_id=q.org_id and e.operation_id::text=q.dedupe_key
  where e.id=$1`,[auditId]);
 const [{id:settingsHistory}]=await rows("select id from private.frontend_settings_history where scope_key='organization:'||$1 order by id limit 1",[org]);
 const [{last_number:watermark}]=await rows('select last_number from private.subscriber_counters where org_id=$1',[org]);
 const count=async()=>(await rows(`select
  (select count(*)::int from core.centers where org_id=$1) as centers,
  (select count(*)::int from core.account_links where org_id=$1) as links,
  (select count(*)::int from private.subscriber_numbers where org_id=$1 and person_id<>$2) as numbered_members,
  (select count(*)::int from private.frontend_settings where scope_key='organization:'||$1 or scope_key like 'center:'||$1||':%') as settings`,[org,roster.importedPerson]))[0];
 const before=await count();
 assert.deepEqual(before,{centers:1,links:2,numbered_members:1,settings:2});
 await db.query('begin');
 try{
  await db.query("update core.outbox_jobs set state='running',lease_until=clock_timestamp()+interval '1 minute' where id=$1",[noticeJob]);
  assert.deepEqual(await readOrganizationDirectoryArchiveScope(target),{state:'blocked',reason:'unproved_directory_queue'});
 }finally{await db.query('rollback');}
 await db.query('begin');
 try{
  const debtId=key();
  await db.query(`insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state)
   select $1,org_id,center_id,$2,100,'TRY',clock_timestamp(),'open' from core.import_jobs where id=$3`,
  [debtId,roster.importedPerson,roster.jobId]);
  await db.query(`update private.p06_sources set created_references=created_references||jsonb_build_array(
   jsonb_build_object('type','debts','id',$3::uuid)) where org_id=$1 and person_id=$2`,[org,roster.importedPerson,debtId]);
  await db.query('update core.import_rows set created_references=array_append(created_references,$2) where id=$1',
   [roster.rowIds[0],debtId]);
  assert.deepEqual(await readOrganizationDirectoryArchiveScope(target),{state:'blocked',reason:'unproved_import_history'});
  assert.deepEqual(await rows('select id from core.debts where id=$1',[debtId]),[{id:debtId}]);
 }finally{await db.query('rollback');}
 const source=await readOrganizationDirectoryArchiveScope(target);
 assert.equal(source.state,'ready',source.reason);
 const approval={decisionId:key(),scopeSha256:source.scopeSha256,retainUntil:new Date(Date.now()+86400000).toISOString()};
 const archived=await archiveOrganizationDirectory({...target,approval});
 const bytes=(await reader.get(archived.objectKey)).bytes;
 assert.equal(sha256(bytes),archived.archiveSha256);
 assert(!bytes.includes(Buffer.from(terminationReason)));
 assert(!bytes.includes(Buffer.from(roster.filename)));
 assert(!bytes.includes(Buffer.from('legacy-student-key')));
 const {events}=JSON.parse(bytes).scope;
 assert(events.some(event=>event.audit_id===auditId&&event.subject_table==='role_assignments'));
 for(const event of events){
  assert.deepEqual(Object.keys(event).sort(),['action','audit_id','occurred_at','operation_id','subject_id','subject_table']);
 }
 const roles=await Promise.all([worker.query('select session_user'),attestor.query('select session_user')]);
 await db.query(`insert into private.organization_directory_erasures
  (request_id,org_id,source_fingerprint,source_project_ref,archive_scope_sha256,archive_sha256,
   approval_id,retain_until,worker_role,attestor_role)
  values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
 [requestId,org,source.sourceFingerprint,sourceProjectRef,source.scopeSha256,archived.archiveSha256,
  approval.decisionId,approval.retainUntil,...roles.map(role=>role.rows[0].session_user)]);
 const erase=(overrides={})=>eraseArchivedOrganizationDirectory({...operation,...overrides});
 await assert.rejects(worker.query("select private.organization_directory_erasure_stage($1,'confirm',$2)",[request,archived.archiveSha256]),/FORBIDDEN/);
 await assert.rejects(attestor.query("select private.organization_directory_erasure_stage($1,'confirm',$2)",[request,archived.archiveSha256]),/FORBIDDEN/);
 await assert.rejects(erase({reader:{get:async()=>null}}),/ORGANIZATION_DIRECTORY_ARCHIVE_PROOF_REQUIRED/);
 await assert.rejects(db.query('delete from core.audit_events where id=$1',[auditId]),/INTEGRITY_VIOLATION/);
 await assert.rejects(db.query('delete from private.frontend_settings_history where id=$1',[settingsHistory]),/INTEGRITY_VIOLATION/);
 await db.query("update private.frontend_settings set version=version+1 where scope_key='organization:'||$1",[org]);
 try{await assert.rejects(erase(),/ORGANIZATION_DIRECTORY_ARCHIVE_SOURCE_CHANGED/);}
 finally{await db.query("update private.frontend_settings set version=version-1 where scope_key='organization:'||$1",[org]);}
 const hold=key();
 try{
  await attestor.query('begin isolation level repeatable read');
  try{
   await attestor.query('select pg_catalog.pg_current_snapshot()');
   await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
    values($1,$2,'rooms',$3,'Synthetic hold after read snapshot','synthetic',clock_timestamp())`,[hold,org,roomId]);
   await assert.rejects(attestor.query("select private.organization_directory_erasure_stage($1,'confirm',$2)",[request,archived.archiveSha256]),
    /FORBIDDEN/);
   assert.deepEqual(await count(),before);
  }finally{
   await attestor.query('rollback');
   await db.query('delete from core.retention_holds where id=$1',[hold]);
  }
  const result=await erase({reader:{get:async name=>{
   const object=await reader.get(name);
   await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
    values($1,$2,'rooms',$3,'Synthetic directory hold','synthetic',clock_timestamp()-interval '1 day')`,[hold,org,roomId]);
   return object;
  }}});
  assert.deepEqual(result,{state:'held'});
  assert.deepEqual(await count(),before);
 }finally{await db.query('delete from core.retention_holds where id=$1',[hold]);}
 const completed=await erase();
 assert.deepEqual(completed,{state:'completed',archive_sha256:archived.archiveSha256});
 assert.deepEqual(await erase(),completed);
 assert.deepEqual(await count(),{centers:0,links:1,numbered_members:0,settings:0});
 assert.deepEqual(await rows('select id from core.import_jobs where id=$1',[roster.jobId]),[]);
 assert.deepEqual(await rows('select id from core.import_rows where job_id=$1',[roster.jobId]),[]);
 assert.deepEqual(await rows('select job_id from private.p06_jobs where job_id=$1',[roster.jobId]),[]);
 assert.deepEqual(await rows('select operation_id from private.p06_sources where org_id=$1',[org]),[]);
 assert.deepEqual(await rows('select file_id from private.p06_files where file_id=$1',[roster.fileId]),[]);
 assert.deepEqual(await rows('select center_id,owner_person_id,checksum from core.files where id=$1',[roster.fileId]),
  [{center_id:null,owner_person_id:null,checksum:roster.checksum}]);
 assert.deepEqual(await rows('select last_number from private.subscriber_counters where org_id=$1',[org]),[{last_number:watermark}]);
 assert.equal(sha256((await reader.get(archived.objectKey)).bytes),archived.archiveSha256);
 return {directory_archive_sha256:archived.archiveSha256};
}
