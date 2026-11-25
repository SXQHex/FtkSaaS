import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {connect} from '../scripts/db.mjs';
import {readOrganizationErasureReceipt} from '../scripts/organization-erasure-receipt.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {authUser,context,fixturePlatform,must} from './api-client.mjs';
import {eraseManagedDraftDocument,seedManagedDraftDocument} from './managed-file-erasure-fixture.mjs';
import {readOrganizationRestoreProjection,readPaidErasureProjection,
 verifyCompleteOrganizationErasureRestore,verifyPaidErasureRestore} from './native-organization-erasure-restore-fixture.mjs';
import {beginBoundR2PilotErasure,enrollSyntheticErasure,r2ErasurePilot} from './r2-erasure-pilot-fixture.mjs';
import {verifySettledBillingErasure} from './p07-billing-archive-fixture.mjs';
import {verifyBillingHistoryErasure} from './p07-billing-history-fixture.mjs';
import {verifySignedDocumentErasure} from './p07-signed-document-erasure-fixture.mjs';
import {seedPublishedInvoice,verifyArchivedInvoiceRemoval,verifyPublishedInvoiceArchive} from './p07-invoice-archive-fixture.mjs';

export async function verifyOrganizationErasure(t){
 const r2Pilot=r2ErasurePilot();
 const signingContext={current:null};
 const {DB_URL,API_URL,SERVICE_ROLE_KEY}=context().env;
 const {platform,plan}=await fixturePlatform(),owner=await authUser('erasure-owner'),control=await authUser('erasure-control');
 const account=await must(owner,'account_get_v1'),controlAccount=await must(control,'account_get_v1');
 const db=await connect();
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const bank=()=>Array.from({length:512},key);
 const roles=[],sessions=[];
 const login=async group=>{
  const role='org_erase_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
  await db.query(`create role ${role} login password '${password}' in role ${group}`);
  roles.push(role);
  const url=new URL(DB_URL);url.username=role;url.password=password;
  const client=new pg.Client({connectionString:url.href,statement_timeout:15000});
  sessions.push(client);await client.connect();
  return {role,client};
 };
 try{
  await db.query('insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do update set reauth_max_age_seconds=excluded.reauth_max_age_seconds');
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic owned organization',initial_plan_id:plan},key())).primary_id;
  const otherOrg=(await must(platform,'organization_create_v1',{verified_account_id:controlAccount.id,name:'Synthetic control organization',initial_plan_id:plan},key())).primary_id;
  const [{owner_person_id:ownerPerson}]=await rows('select owner_person_id from core.organizations where id=$1',[org]);
  const [{owner_person_id:controlId}]=await rows('select owner_person_id from core.organizations where id=$1',[otherOrg]);
  const personId=key();
  await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Synthetic disposable person','active')",[personId,org]);
  const draft=await seedManagedDraftDocument({db,org,center:null,person:ownerPerson,account:account.id,apiUrl:API_URL,serviceKey:SERVICE_ROLE_KEY});
  const ids={orgId:org,personId,controlId,objectId:draft.objectId,fileId:draft.fileId};
  const before=await readOrganizationRestoreProjection(db,ids,true);
  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,all_data:true,reason:org});
  const {job_id:jobId}=await must(owner,'organization_delete_apply_v1',{org_id:org,all_data:true,preview:{id:preview.id,token:preview.token},reauth:owner.jwt},key());
  const [{request_id:requestId}]=await rows('select request_id from private.p07_privacy_jobs where id=$1',[jobId]);
  await assert.rejects(readOrganizationErasureReceipt({db,requestId,orgId:org}),/ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE/);
  const {role,client:worker}=await login('ftk_p07_privacy_worker');
  const {client:attestor}=await login('ftk_p07_storage_attestor');
  await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[role,org]);
  await db.query('insert into private.organization_projected_contact_erasure_scopes values($1,$2)',[role,org]);
  await db.query('insert into private.organization_managed_file_erasure_scopes(db_role,request_id) values($1,$2)',[role,requestId]);
  await db.query('insert into private.organization_live_database_erasure_scopes(db_role,request_id,org_id) values($1,$2,$3)',[role,requestId,org]);
  const claimJobs=async orgId=>(await worker.query('select private.p07_privacy_claim($1,$2,1) as jobs',[orgId,bank()])).rows[0].jobs;
  const claim=async(orgId=org,expectedJob=jobId)=>{
   const jobs=await claimJobs(orgId);
   assert.equal(jobs[0]?.request.job_id,expectedJob);
   return jobs[0].request;
  };
  const runStage=async request=>(await worker.query('select private.p07_privacy_execute($1,$2) as result',[request,bank()])).rows[0].result;
  const execute=async request=>{
   const result=await runStage(request);
   assert.equal(result.ok,true,result.error?.code);
  };
  const stage=async()=>{
   const [{scopes}]=await rows('select scopes from private.p07_privacy_manifests where request_id=$1',[requestId]);
   return {db:scopes.database.live_database,files:scopes.exports.managed_file_erasure};
  };
  const retry=async()=>{
   await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
   return claim();
  };
  const assertUnclaimed=async()=>{
   assert.deepEqual(await claimJobs(org),[]);
   assert.deepEqual(await rows('select state,attempts,lease_until from private.p07_privacy_jobs where id=$1',[jobId]),
    [{state:'pending',attempts:0,lease_until:null}]);
  };
  await assertUnclaimed();
  await enrollSyntheticErasure({db,requestId,orgId:org,pilot:r2Pilot});
  await assertUnclaimed();
  const earlyDelete=await fetch(new URL('/storage/v1/object/ftksaas-documents/'+draft.objectKey,API_URL),{
   method:'DELETE',headers:{authorization:'Bearer '+SERVICE_ROLE_KEY,apikey:SERVICE_ROLE_KEY}
  });
  assert.equal(earlyDelete.ok,false);
  await earlyDelete.body?.cancel();
  const earlyRead=await fetch(draft.signedUrl);
  assert.equal(earlyRead.ok,true);
  await earlyRead.body?.cancel();
  const unconfirmed={client_api_version:1,request_id:key(),org_id:org,job_id:jobId,
   operation_key:key(),lease_token:randomBytes(32).toString('hex')};
  // Simulate a running lease issued by the previously deployed source.
  await db.query(`update private.p07_privacy_jobs set state='running',operation_key=$2,
   lease_hash=encode(extensions.digest($3,'sha256'),'hex'),lease_until=clock_timestamp()+interval '60 seconds'
   where id=$1`,[jobId,unconfirmed.operation_key,unconfirmed.lease_token]);
  const assertFenced=async()=>{
   const result=await runStage(unconfirmed);
   assert.equal(result.ok,false);
   assert.equal(result.error.code,'OPERATION_IN_PROGRESS');
   await assert.rejects(worker.query('select private.p07_storage_erasure_prepare($1,$2)',[unconfirmed,draft.fileId]),
    /OPERATION_IN_PROGRESS/);
   await assert.rejects(attestor.query('select private.p07_storage_erasure_confirm($1,$2)',[unconfirmed,draft.fileId]),
    /OPERATION_IN_PROGRESS/);
   assert.deepEqual(await rows('select request_id from private.p07_privacy_manifests where request_id=$1',[requestId]),[]);
   assert.deepEqual(await rows('select id from storage.objects where id=$1',[draft.objectId]),[{id:draft.objectId}]);
  };
  await assert.rejects(worker.query('update private.organization_r2_erasure_bindings set pending_started_at=clock_timestamp() where request_id=$1',
   [requestId]),/permission denied/);
  await assertFenced();
  await db.query("update private.p07_privacy_jobs set attempts=3,lease_until=clock_timestamp()-interval '1 second' where id=$1",[jobId]);
  assert.deepEqual(await claimJobs(org),[]);
  assert.deepEqual(await rows('select state,attempts from private.p07_privacy_jobs where id=$1',[jobId]),
   [{state:'running',attempts:3}]);
  await db.query("update private.p07_privacy_jobs set state='pending',attempts=0,lease_until=null where id=$1",[jobId]);
  await beginBoundR2PilotErasure({db,requestId,orgId:org,pilot:r2Pilot,databaseUrl:DB_URL});
  await assert.rejects(db.query('update private.organization_r2_erasure_bindings set pending_started_at=clock_timestamp() where request_id=$1',
   [requestId]),/INTEGRITY_VIOLATION/);
  await execute(await claim());
  assert.equal((await stage()).files.state,'blocked_residual');
  await assert.rejects(readOrganizationErasureReceipt({db,requestId,orgId:org}),/ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE/);
  let request=await retry();
  await eraseManagedDraftDocument({db,worker,attestor,request,requestId,apiUrl:API_URL,serviceKey:SERVICE_ROLE_KEY,draft});
  await execute(request);
  assert.equal((await stage()).files.state,'completed');
  request=await retry();await execute(request);
  assert.equal((await stage()).db.state,'completed',JSON.stringify((await stage()).db));
  assert.equal((await must(owner,'account_get_v1')).id,account.id);
  assert.equal((await must(control,'account_get_v1')).id,controlAccount.id);
  assert.equal((await must(owner,'job_status_get_v1',{org_id:org,job_id:jobId})).privacy.request_state,'partial');
  const restore=await verifyCompleteOrganizationErasureRestore({db,dbUrl:DB_URL,requestId,ids,before,r2Pilot,signingContext});
  assert.equal(restore.erased_subjects,4);
  t.diagnostic(JSON.stringify(restore));

  let restoreControlId;
  await t.test('a live paid subscription blocks the combined receipt without discarding the evidence',async()=>{
   await db.query('insert into private.p07_billing_config values(true,900) on conflict(singleton) do update set quote_ttl_seconds=excluded.quote_ttl_seconds');
   const payment=await must(control,'saas_payment_submit_v1',{org_id:otherOrg,amount_minor:'1000',currency:'TRY',reference:'Synthetic retained payment',occurred_at:new Date().toISOString()},key());
   await must(platform,'saas_payment_verify_v1',{org_id:otherOrg,payment_id:payment.primary_id,accepted:true},key());
   const invoice=await seedPublishedInvoice(platform,otherOrg);
   const witness=await authUser('paid-erasure-witness');
   const witnessAccount=await must(witness,'account_get_v1');
   const witnessOrg=(await must(platform,'organization_create_v1',
    {verified_account_id:witnessAccount.id,name:'Synthetic paid restore control',initial_plan_id:plan},key())).primary_id;
   const [{owner_person_id:witnessId}]=await rows('select owner_person_id from core.organizations where id=$1',[witnessOrg]);
   restoreControlId=witnessId;
   const paidIds={orgId:otherOrg,invoiceId:invoice.invoiceId,controlId:witnessId};
   const paidBefore=await readPaidErasureProjection(db,paidIds);

   const otherPreview=await must(control,'organization_delete_preview_v1',{org_id:otherOrg,all_data:true,reason:otherOrg});
   const {job_id:otherJob}=await must(control,'organization_delete_apply_v1',{org_id:otherOrg,all_data:true,preview:{id:otherPreview.id,token:otherPreview.token},reauth:control.jwt},key());
   const [{request_id:otherRequest}]=await rows('select request_id from private.p07_privacy_jobs where id=$1',[otherJob]);
   await beginBoundR2PilotErasure({db,requestId:otherRequest,orgId:otherOrg,pilot:r2Pilot});
   const archived=await verifyPublishedInvoiceArchive({db,requestId:otherRequest,orgId:otherOrg,invoice,r2Pilot});
   t.diagnostic(JSON.stringify(archived.summary));
   await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[role,otherOrg]);
   await db.query('insert into private.organization_projected_contact_erasure_scopes values($1,$2)',[role,otherOrg]);
   await db.query('insert into private.organization_managed_file_erasure_scopes(db_role,request_id) values($1,$2)',[role,otherRequest]);
   await db.query('insert into private.organization_live_database_erasure_scopes(db_role,request_id,org_id) values($1,$2,$3)',[role,otherRequest,otherOrg]);
   const retained=await rows('select id,state,starts_at,period_end from core.saas_subscriptions where org_id=$1',[otherOrg]);
   assert(retained.some(row=>row.starts_at instanceof Date));
   await execute(await claim(otherOrg,otherJob));
   const [{scopes}]=await rows('select scopes from private.p07_privacy_manifests where request_id=$1',[otherRequest]);
   assert.equal(scopes.database.live_database.state,'blocked');
   assert(scopes.database.live_database.blocked_relations.includes('core.saas_subscriptions'));
   assert(scopes.database.live_database.blocked_relations.includes('private.platform_invoices'));
   assert.equal(scopes.exports.managed_file_erasure.inventory.unarchived_invoices,1);
   assert.deepEqual(await rows('select id,state,starts_at,period_end from core.saas_subscriptions where org_id=$1',[otherOrg]),retained);
   await assert.rejects(readOrganizationErasureReceipt({db,requestId:otherRequest,orgId:otherOrg}),/ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE/);
   const retryPaid=async()=>{
    await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[otherJob]);
    return claim(otherOrg,otherJob);
   };
   const removed=await verifyArchivedInvoiceRemoval({db,worker,attestor,request:await retryPaid(),archived,
    claim:retryPaid,apiUrl:API_URL,serviceKey:SERVICE_ROLE_KEY});
   await execute(removed.request);
   const [{scopes:after}]=await rows('select scopes from private.p07_privacy_manifests where request_id=$1',[otherRequest]);
   assert(after.database.live_database.blocked_relations.includes('core.saas_subscriptions'));
   assert(!after.database.live_database.blocked_relations.includes('private.platform_invoices'));
   assert(!after.database.live_database.blocked_relations.includes('private.organization_managed_storage_census'));
   assert.equal(after.exports.managed_file_erasure.inventory.unarchived_invoices,0);
   assert.equal(after.exports.managed_file_erasure.inventory.unproved_storage_observations,0);
   assert.equal(after.exports.managed_file_erasure.inventory.archived_invoice_purges,1);
   if(r2Pilot){
    await assert.rejects(r2Pilot.reader.withRestoreEvidence('0'.repeat(64),()=>assert.fail('pending erasure allowed restore')),
     /R2_ERASURE_PENDING/);
    t.diagnostic(JSON.stringify({invoice_source_purge:true,archive_receipt_sha256:removed.archive_receipt_sha256,restore_fenced_by_paid_request:true}));
   }

   await assert.rejects(readOrganizationErasureReceipt({db,requestId:otherRequest,orgId:otherOrg}),/ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE/);

   const finance=await verifySettledBillingErasure({db,worker,attestor,request:await retryPaid(),parsedInvoiceArchive:archived});
   await execute(finance.request);
   const [{scopes:withFinance}]=await rows('select scopes from private.p07_privacy_manifests where request_id=$1',[otherRequest]);
   assert.equal(withFinance.database.live_database.state,'blocked');
   for(const paidSource of ['core.saas_subscriptions','core.saas_payment_verifications','private.p07_payment_allocations',
    'private.p07_payment_origins','private.p07_subscription_scope','private.organization_billing_erasures']){
    assert(!withFinance.database.live_database.blocked_relations.includes(paidSource),paidSource);
   }
   await assert.rejects(readOrganizationErasureReceipt({db,requestId:otherRequest,orgId:otherOrg}),/ORGANIZATION_ERASURE_RECEIPT_INCOMPLETE/);
   const checkpoint=r2Pilot?'r2':'local';
   if(r2Pilot)await assert.rejects(r2Pilot.reader.withRestoreEvidence('0'.repeat(64),()=>assert.fail('partial finance erasure allowed restore')),
    /R2_ERASURE_PENDING/);
   t.diagnostic(JSON.stringify({billing_source_purge:true,billing_archive_sha256:finance.archiveSha256,checkpoint}));
   const history=await verifyBillingHistoryErasure({db,worker,attestor,request:await retryPaid(),parsedInvoiceArchive:archived});
   await execute(history.request);
   const [{scopes:combined}]=await rows('select scopes from private.p07_privacy_manifests where request_id=$1',[otherRequest]);
   assert.equal(combined.database.live_database.state,'completed',JSON.stringify(combined.database.live_database));
   assert.equal(combined.exports.managed_file_erasure.state,'completed');
   const combinedReceipt=await readOrganizationErasureReceipt({db,requestId:otherRequest,orgId:otherOrg});
   assert.equal(combinedReceipt.database.billing_archive_sha256,finance.archiveSha256);
   assert.equal(combinedReceipt.database.billing_history_archive_sha256,history.archiveSha256);
   for(const id of history.erasedIds)assert(combinedReceipt.entry.subject_ids.includes(id));
   t.diagnostic(JSON.stringify({billing_history_source_purge:true,history_archive_sha256:history.archiveSha256,
    combined_proof_sha256:combinedReceipt.entry.proof_sha256,checkpoint}));
   const paidRestore=await verifyPaidErasureRestore({db,dbUrl:DB_URL,requestId:otherRequest,ids:paidIds,before:paidBefore,
    r2Pilot,signingContext,receipt:combinedReceipt});
   t.diagnostic(JSON.stringify(paidRestore));
   assert.equal((await must(witness,'account_get_v1')).id,witnessAccount.id);
  });
  await t.test('the mixed organization proves file and database erasure before signing the same restore receipt',async()=>{
   assert(restoreControlId);
   const mixed=await verifySignedDocumentErasure({worker,attestor,workerRole:role,claim,execute,r2Pilot,
    signingContext,controlId:restoreControlId,dbUrl:DB_URL});
   t.diagnostic(JSON.stringify(mixed));
  });
 }finally{
  for(const session of sessions)await session.end();
  for(const role of roles){
   await db.query('delete from private.organization_live_database_erasure_scopes where db_role=$1',[role]);
   await db.query('delete from private.organization_managed_file_erasure_scopes where db_role=$1',[role]);
   await db.query('delete from private.p07_storage_erasure_scopes where db_role=$1 or attestor_role=$1',[role]);
   await db.query('delete from private.organization_projected_contact_erasure_scopes where db_role=$1',[role]);
   await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);
   await db.query(`drop role ${role}`);
  }
  await db.end();
 }
}
