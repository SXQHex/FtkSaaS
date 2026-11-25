import assert from 'node:assert/strict';
import {archiveSettledBilling,readBillingArchiveScope,eraseArchivedBilling} from '../scripts/organization-db-archive.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

export async function verifySettledBillingErasure({db,worker,attestor,request,parsedInvoiceArchive}){
 const {requestId,orgId,sourceProjectRef,store,reader}=parsedInvoiceArchive.args;
 const inputs={db,requestId,orgId,sourceProjectRef,store,reader};
 const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const [[live], [access]] = await Promise.all([
  query(`select p.id as payment_id,s.id as subscription_id,p.reference,p.verified_by
   from core.saas_payment_verifications p join core.saas_subscriptions s using(org_id)
   where p.org_id=$1`,[orgId]),
  query('select count(*)::int as other_subscriptions from core.saas_subscriptions where org_id<>$1',[orgId])
 ]);
 const {payment_id:paymentId,subscription_id:subscriptionId,reference,verified_by:verifier}=live;
 const remaining=async()=>{
  const [record]=await query(`select
   (select count(*)::int from core.saas_payment_verifications where id=$1) as payments,
   (select count(*)::int from core.saas_subscriptions where id=$2) as subscriptions,
   (select count(*)::int from private.p07_payment_allocations where payment_id=$1 or subscription_id=$2) as allocations,
   (select count(*)::int from private.p07_payment_origins where payment_id=$1) as origins,
   (select count(*)::int from private.p07_subscription_scope where subscription_id=$2) as periods,
   (select count(*)::int from core.saas_subscriptions where org_id<>$3) as other_subscriptions`,[paymentId,subscriptionId,orgId]);
  return record;
 };
 const observed=await remaining();
 assert.deepEqual(observed,{payments:1,subscriptions:1,allocations:1,origins:1,periods:1,other_subscriptions:access.other_subscriptions});
 assert.deepEqual(await readBillingArchiveScope(inputs),{state:'blocked',reason:'active_subscription'});
 // Advance only this synthetic period past its native nonrenewal boundary.
 await db.query(`update core.saas_subscriptions set starts_at=starts_at-interval '2 months',
  period_end=period_end-interval '2 months',grace_until=grace_until-interval '2 months' where id=$1`,[subscriptionId]);
 await db.query("update private.p07_subscription_scope set period_start=period_start-interval '2 months' where subscription_id=$1",[subscriptionId]);

 await db.query('update core.saas_payment_verifications set amount_minor=amount_minor+1 where id=$1',[paymentId]);
 try{assert.deepEqual(await readBillingArchiveScope(inputs),{state:'blocked',reason:'unreconciled_payment'});}
 finally{await db.query('update core.saas_payment_verifications set amount_minor=amount_minor-1 where id=$1',[paymentId]);}
 const source=await readBillingArchiveScope(inputs);
 assert.equal(source.state,'ready');
 const approval={decisionId:key(),scopeSha256:source.scopeSha256,retainUntil:new Date(Date.now()+86400000).toISOString()};
 const args={...inputs,approval};
 const operation={worker,attestor,request,reader,sourceProjectRef};
 const erase=overrides=>eraseArchivedBilling({...operation,...overrides});
 assert.deepEqual(await erase({}),{state:'unbound'});
 await assert.rejects(archiveSettledBilling({...args,approval:{...approval,scopeSha256:'0'.repeat(64)}}),/BILLING_ARCHIVE_APPROVAL_MISMATCH/);
 const archive=await archiveSettledBilling(args);
 assert.deepEqual(await archiveSettledBilling(args),archive);
 const evidence=(await reader.get(archive.objectKey)).bytes;
 assert.equal(sha256(evidence),archive.archiveSha256);
 assert(!evidence.includes(Buffer.from(reference)));
 assert(!evidence.includes(Buffer.from(verifier)));
 const record=JSON.parse(evidence);
 assert.equal(record.scope.payments[0].amount_minor,'1000');
 assert.equal(record.scope.allocations[0].payment_id,paymentId);
 assert.equal(record.scope.allocations[0].subscription_id,subscriptionId);
 assert.equal(record.scope.subscriptions[0].subscription_id,subscriptionId);

 const roles=await Promise.all([worker.query('select session_user'),attestor.query('select session_user')]);
 await db.query(`insert into private.organization_billing_erasures
  (request_id,org_id,source_fingerprint,source_project_ref,archive_scope_sha256,archive_sha256,
   approval_id,retain_until,worker_role,attestor_role)
  values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
 [requestId,orgId,source.sourceFingerprint,sourceProjectRef,source.scopeSha256,archive.archiveSha256,
  approval.decisionId,approval.retainUntil,...roles.map(result=>result.rows[0].session_user)]);
 assert.deepEqual(await remaining(),observed);
 await assert.rejects(worker.query("select private.organization_billing_erasure_stage($1,'confirm',$2)",[request,archive.archiveSha256]),/FORBIDDEN/);
 await assert.rejects(erase({reader:{get:async()=>null}}),/BILLING_ARCHIVE_PROOF_REQUIRED/);
 await assert.rejects(erase({reader:{get:async()=>{throw Error('interrupted archive read');}}}),/interrupted archive read/);
 await db.query("update core.saas_payment_verifications set reference='Synthetic source changed' where id=$1",[paymentId]);
 try{await assert.rejects(erase({}),/BILLING_ARCHIVE_SOURCE_CHANGED/);}
 finally{await db.query('update core.saas_payment_verifications set reference=$2 where id=$1',[paymentId,reference]);}
 assert.deepEqual(await remaining(),observed);

 const hold=key();
 try{
  const held=await erase({reader:{get:async key=>{
   const bytes=await reader.get(key);
   await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
    values($1,$2,'saas_payment_verifications',$3,'Synthetic finance hold','synthetic',clock_timestamp()-interval '1 day')`,[hold,orgId,paymentId]);
   return bytes;
  }}});
  assert.deepEqual(held,{state:'held'});
  assert.deepEqual(await remaining(),observed);
 }finally{await db.query('delete from core.retention_holds where id=$1',[hold]);}
 const completed=await erase({});
 assert.equal(completed.state,'completed');
 assert.equal(completed.archive_sha256,archive.archiveSha256);
 assert.deepEqual(await remaining(),{payments:0,subscriptions:0,allocations:0,origins:0,periods:0,
  other_subscriptions:access.other_subscriptions});
 assert.deepEqual(await erase({}),completed);
 assert.equal(sha256((await reader.get(archive.objectKey)).bytes),archive.archiveSha256);
 return {request,archiveSha256:archive.archiveSha256};
}
