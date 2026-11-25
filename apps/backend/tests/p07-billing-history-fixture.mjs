import assert from 'node:assert/strict';
import {archiveBillingHistory,readBillingHistoryScope,eraseArchivedBillingHistory} from '../scripts/organization-db-archive.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

export async function verifyBillingHistoryErasure({db,worker,attestor,request,parsedInvoiceArchive}){
 const {requestId,orgId,sourceProjectRef,store,reader}=parsedInvoiceArchive.args;
 const types=['platform_invoice_publish_v1','platform_invoice_upload_prepare_v1','saas_payment_submit_v1','saas_payment_verify_v1'];
 const target={db,requestId,orgId,sourceProjectRef,store,reader};
 const query=async(sql,values=[])=> (await db.query(sql,values)).rows;
 const [outside]=await query("select count(*)::int as count from core.audit_events where org_id<>$1",[orgId]);
 const [control]=await query("select id from core.audit_events where org_id<>$1 order by id limit 1",[orgId]);
 await assert.rejects(db.query('delete from core.audit_events where id=$1',[control.id]),/INTEGRITY_VIOLATION/);
 const [before]=await query(`select
  (select count(*)::int from core.audit_events where org_id=$1 and action=any($2)) as audit,
  (select count(*)::int from core.operation_receipts where org_id=$1 and operation=any($2)) as operations,
  (select count(*)::int from core.notifications where org_id=$1 and kind=any($2)) as notifications,
  (select count(*)::int from core.outbox_jobs q join core.notifications n on n.org_id=q.org_id and n.id=q.notification_id
   where q.org_id=$1 and n.kind=any($2)) as jobs`,[orgId,types]);
 assert.deepEqual(before,{audit:4,operations:4,notifications:4,jobs:4});
 const source=await readBillingHistoryScope(target);
 assert.equal(source.state,'ready');
 const approval={scopeSha256:source.scopeSha256,decisionId:key(),retainUntil:new Date(Date.now()+86400000).toISOString()};
 const archive=await archiveBillingHistory({...target,approval});
 const operation={worker,attestor,request,reader,sourceProjectRef};
 const erase=overrides=>eraseArchivedBillingHistory({...operation,...overrides});
 assert.deepEqual(await erase({}),{state:'unbound'});
 const bytes=(await reader.get(archive.objectKey)).bytes;
 assert.equal(sha256(bytes),archive.archiveSha256);
 const events=JSON.parse(bytes).scope.events;
 assert.equal(events.length,4);
 for(const event of events){
  assert.deepEqual(Object.keys(event).sort(),['action','audit_id','occurred_at','operation_id','source_record_id','subject_id','subject_table']);
 }
 const roles=await Promise.all([worker.query('select session_user'),attestor.query('select session_user')]);
 await db.query(`insert into private.organization_billing_history_erasures
  (request_id,org_id,source_fingerprint,source_project_ref,archive_scope_sha256,archive_sha256,approval_id,retain_until,worker_role,attestor_role)
  values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
 [requestId,orgId,source.sourceFingerprint,sourceProjectRef,source.scopeSha256,archive.archiveSha256,
  approval.decisionId,approval.retainUntil,...roles.map(result=>result.rows[0].session_user)]);
 await assert.rejects(erase({reader:{get:async()=>({bytes:Buffer.from('{}')})}}),/BILLING_HISTORY_ARCHIVE_PROOF_REQUIRED/);
 await assert.rejects(worker.query("select private.organization_billing_history_stage($1,'confirm',$2)",[request,archive.archiveSha256]),/FORBIDDEN/);
 const hold=key();
 try{
  const held=await erase({reader:{get:async objectKey=>{
   const evidence=await reader.get(objectKey);
   await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
    values($1,$2,'audit_events',$3,'Synthetic history hold','synthetic',clock_timestamp()-interval '1 day')`,[hold,orgId,events[0].audit_id]);
   return evidence;
  }}});
  assert.deepEqual(held,{state:'held'});
 }finally{await db.query('delete from core.retention_holds where id=$1',[hold]);}
 const proof=await erase({});
 assert.equal(proof.state,'completed');
 assert.equal(proof.archive_sha256,archive.archiveSha256);
 assert.deepEqual(await erase({}),proof);
 const [persisted]=await query('select erased_subject_ids from private.organization_billing_history_erasures where request_id=$1',[requestId]);
 assert.equal(persisted.erased_subject_ids.length,16);
 const [after]=await query(`select
  (select count(*)::int from core.audit_events where id=any($1)) as audit,
  (select count(*)::int from core.operation_receipts where id=any($1)) as operations,
  (select count(*)::int from core.notifications where id=any($1)) as notifications,
  (select count(*)::int from core.outbox_jobs where id=any($1)) as jobs,
  (select count(*)::int from private.settlement_authority_versions where org_id=$2) as authority_versions,
  (select count(*)::int from core.audit_events where org_id<>$2) as other_audit,
  (select count(*)::int from core.audit_events where org_id=$2 and action in ('organization_create_v1','organization_delete_apply_v1')) as lifecycle_audit`,
  [persisted.erased_subject_ids,orgId]);
 assert.deepEqual(after,{audit:0,operations:0,notifications:0,jobs:0,authority_versions:0,other_audit:outside.count,lifecycle_audit:2});
 assert.equal(sha256((await reader.get(archive.objectKey)).bytes),archive.archiveSha256);
 return {request,archiveSha256:archive.archiveSha256,erasedIds:persisted.erased_subject_ids};
}
