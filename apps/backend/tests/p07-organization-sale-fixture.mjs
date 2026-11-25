import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as archive from '../scripts/organization-db-archive.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';
import {must} from './api-client.mjs';
import {beginBoundR2PilotErasure} from './r2-erasure-pilot-fixture.mjs';
import {preparationFixture} from './starter-preparation-fixture.mjs';

export async function verifyOrganizationPaidSaleRetention({worker,attestor,workerRole,attestorRole,claim}){
 const f=await preparationFixture({schedule:true});
 const {db,org,center,discipline,owner,api,day}=f;
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 try{
  await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
  const person=(await api('person_create_v1',{display_name:'Synthetic O04 paid student',contacts:[]})).primary_id;
  await api('student_activate_v1',{person_id:person});
  const product=(await api('product_publish_v1',{terms:{
   name:'Synthetic O04 paid package',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'1000',currency:'TRY',
   freeze:{enabled:false,extends_validity:false},refund:{method:'none'},
   scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]
  }})).primary_id;
  const salePreview=await api('sale_preview_v1',{person_id:person,product_version_id:product,start_date:day(0),end_date:day(30)});
  const token=preview=>({id:preview.id,token:preview.token});
  const sale=(await api('sale_apply_v1',{preview:token(salePreview)})).primary_id;
  const [{id:debt}]=await rows('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale]);
  const occurredAt=new Date().toISOString(),paymentReference='Synthetic payment reference',paymentNote='Synthetic incidental payment note';
  const collection=(await api('collection_record_v1',{person_id:person,debt_ids:[debt],amount_minor:'1000',
   currency:'TRY',occurred_at:occurredAt,payment:{method:'cash',reference:paymentReference},note:paymentNote})).primary_id;
  const terminationReason='Synthetic paid sale ended without obligation';
  const termination=await api('sale_terminate_preview_v1',{sale_id:sale,reason:terminationReason});
  await api('sale_terminate_apply_v1',{preview:token(termination)});
  const finance=()=>rows(`select s.state as sale_state,s.net_minor,d.state as debt_state,d.amount_minor as debt_amount,
   private.debt_remaining(s.org_id,d.id) as remaining,c.kind,c.amount_minor as cash_amount,
   a.amount_minor as allocation_amount,e.state as entitlement_state,private.credit_available(s.org_id,s.id) as available
   from core.sales s join core.debts d on d.org_id=s.org_id and d.sale_id=s.id
   join core.debt_allocations a on a.org_id=d.org_id and a.debt_id=d.id
   join core.cash_movements c on c.org_id=a.org_id and c.id=a.cash_movement_id
   join core.entitlement_accounts e on e.org_id=s.org_id and e.sale_id=s.id where s.org_id=$1 and s.id=$2`,[org,sale]);
  const before=await finance();
  assert.deepEqual(before,[{sale_state:'terminated',net_minor:'1000',debt_state:'settled',debt_amount:'1000',
   remaining:'0',kind:'collection',cash_amount:'1000',allocation_amount:'1000',entitlement_state:'closed',available:'0'}]);
  const [{operation_id:operationId,allocation_id:allocationId,audit_id:auditId,notice_id:noticeId,job_id:collectionJobId}]
   =await rows(`select c.operation_id,a.id as allocation_id,e.id as audit_id,n.id as notice_id,q.id as job_id
    from core.cash_movements c join core.debt_allocations a on a.org_id=c.org_id and a.cash_movement_id=c.id
    join core.audit_events e on e.org_id=c.org_id and e.operation_id=c.operation_id
    join core.outbox_jobs q on q.org_id=c.org_id and q.dedupe_key=c.operation_id::text
    join core.notifications n on n.org_id=q.org_id and n.id=q.notification_id where c.org_id=$1 and c.id=$2`,[org,collection]);
  assert.deepEqual(await rows(`select request#>>'{payment,reference}' as reference,request->>'note' as note
   from private.p06_contexts where receipt_id=$1`,[operationId]),[{reference:paymentReference,note:paymentNote}]);

  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,all_data:true,reason:'Synthetic paid archive boundary'});
  const {job_id:jobId}=await must(owner,'organization_delete_apply_v1',{
   org_id:org,all_data:true,preview:token(preview),reauth:owner.jwt
  },key());
  const [{request_id:requestId}]=await rows('select request_id from private.p07_privacy_jobs where id=$1 and org_id=$2',[jobId,org]);
  const sourceProjectRef='ftknativereceipttest';
  const target={db,requestId,orgId:org,sourceProjectRef};
  await db.query('begin');
  try{
   await db.query("update core.debts set state='open' where id=$1",[debt]);
   assert.deepEqual(await archive.readOrganizationSaleArchiveScope(target),{state:'blocked',reason:'dependent_sale_work'});
   await assert.rejects(archive.archiveOrganizationSales({...target,
    store:{put:()=>assert.fail('Ineligible financial evidence must not be archived')}
   }),/ORGANIZATION_SALE_ARCHIVE_SOURCE_BLOCKED/);
  }finally{await db.query('rollback');}
  await db.query('begin');
  try{
   await db.query(`insert into core.debt_adjustments(id,org_id,center_id,debt_id,amount_minor,direction,reason,operation_id)
    values($1,$2,$3,$4,1,'decrease','Synthetic adjusted debt',$5)`,[key(),org,center,debt,operationId]);
   assert.deepEqual(await archive.readOrganizationSaleArchiveScope(target),{state:'blocked',reason:'dependent_sale_work'});
  }finally{await db.query('rollback');}
  assert.deepEqual(await finance(),before);
  await assert.rejects(db.query('delete from core.cash_movements where id=$1',[collection]),/INTEGRITY_VIOLATION/);
  await assert.rejects(db.query('delete from core.debt_allocations where id=$1',[allocationId]),/INTEGRITY_VIOLATION/);
  assert.deepEqual(await rows('select completed_at from private.organization_sale_erasures where request_id=$1',[requestId]),[]);

  await beginBoundR2PilotErasure({db,requestId,orgId:org});
  await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[workerRole,org]);
  const request=await claim(org,jobId);
  const scope=await archive.readOrganizationSaleArchiveScope(target);
  assert.equal(scope.state,'ready',scope.reason);
  const approval={decisionId:key(),scopeSha256:scope.scopeSha256,retainUntil:new Date(Date.now()+86400000).toISOString()};
  const archiveDirectory=await fs.mkdtemp(path.join(os.tmpdir(),'ftk-paid-sale-archive-'));
  try{
   const filename=name=>path.join(archiveDirectory,sha256(name));
   const get=async name=>({bytes:await fs.readFile(filename(name))});
   const store={get,async put(name,bytes,condition){
    assert.deepEqual(condition,{ifNoneMatch:'*'});
    await fs.writeFile(filename(name),bytes,{flag:'wx',mode:0o600});
   }};
   const reader={get};
   await assert.rejects(archive.archiveOrganizationSales({...target,store,reader,
    approval:{...approval,scopeSha256:'0'.repeat(64)}}),/ORGANIZATION_SALE_ARCHIVE_APPROVAL_MISMATCH/);
   const archived=await archive.archiveOrganizationSales({...target,store,reader,approval});
   const {bytes}=await reader.get(archived.objectKey);
   assert.equal(sha256(bytes),archived.archiveSha256);
   for(const secret of [paymentNote,paymentReference,terminationReason,'Synthetic O04 paid student','Synthetic O04 paid package'])
    assert.equal(bytes.includes(Buffer.from(secret)),false);
   const {settled_collections:settlements}=JSON.parse(bytes).scope;
   assert.equal(settlements.length,1);
   const {debt_created_at,due_at,allocated_at,occurred_at,recorded_at,...evidence}=settlements[0];
   assert.notEqual(f.person,person);
   assert.deepEqual(evidence,{sale_id:sale,debt_id:debt,allocation_id:allocationId,collection_id:collection,
    operation_id:operationId,audit_id:auditId,center_id:center,person_id:person,
    action:'collection_record_v1',outcome:'succeeded',cashier_person_id:f.person,
    debt_minor:'1000',collected_minor:'1000',allocated_minor:'1000',currency:'TRY',state:'settled'});
   assert.equal(new Date(occurred_at).toISOString(),occurredAt);
   for(const stamp of [debt_created_at,due_at,allocated_at,recorded_at])assert(Number.isFinite(Date.parse(stamp)));
   await db.query(`insert into private.organization_sale_erasures(request_id,org_id,source_fingerprint,source_project_ref,
    archive_scope_sha256,archive_sha256,approval_id,retain_until,worker_role,attestor_role)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[requestId,org,scope.sourceFingerprint,sourceProjectRef,
    scope.scopeSha256,archived.archiveSha256,approval.decisionId,approval.retainUntil,workerRole,attestorRole]);
   await assert.rejects(attestor.query("select private.organization_sale_erasure_stage($1,'confirm',$2)",
    [request,archived.archiveSha256]),/FORBIDDEN/);
   const erase=overrides=>archive.eraseArchivedOrganizationSales({worker,attestor,request,reader,sourceProjectRef,...overrides});
   const hold=key();
   try{
    assert.deepEqual(await erase({reader:{async get(name){
     const object=await reader.get(name);
     await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
      values($1,$2,'cash_movements',$3,'Synthetic collection hold','synthetic',clock_timestamp()-interval '1 day')`,[hold,org,collection]);
     return object;
    }}}),{state:'held'});
    assert.deepEqual(await finance(),before);
   }finally{await db.query('delete from core.retention_holds where id=$1',[hold]);}
   const completed={state:'completed',archive_sha256:archived.archiveSha256};
   assert.deepEqual(await erase(),completed);
   assert.deepEqual(await erase(),completed);
   const erasedIds=[sale,debt,allocationId,collection,operationId,auditId,noticeId,collectionJobId];
   const [{erased_subject_ids:proof}]=await rows('select erased_subject_ids from private.organization_sale_erasures where request_id=$1',[requestId]);
   assert(erasedIds.every(id=>proof.includes(id)));
   assert.deepEqual(await rows(`select id from core.sales where id=$1
    union all select id from core.debts where id=$2
    union all select id from core.debt_allocations where id=$3
    union all select id from core.cash_movements where id=$4
    union all select id from core.operation_receipts where id=$5
    union all select receipt_id from private.p06_contexts where receipt_id=$5
    union all select id from core.audit_events where id=$6
    union all select id from core.notifications where id=$7
    union all select id from core.outbox_jobs where id=$8`,erasedIds),[]);
   assert.equal(sha256((await reader.get(archived.objectKey)).bytes),archived.archiveSha256);
  }finally{await fs.rm(archiveDirectory,{recursive:true,force:true});}
 }finally{await db.end();}
}

export async function verifyOrganizationSaleErasure({db,worker,attestor,request,requestId,org,sale,product,studentPerson,
 terminationReason,terminationPreviewId,store,reader,sourceProjectRef}){
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const observe=async()=>{
  const [count]=await rows(`select
   (select count(*)::int from core.sales where id=$1) sales,
   (select count(*)::int from core.entitlement_accounts where sale_id=$1) entitlement_accounts,
   (select count(*)::int from core.entitlement_movements where sale_id=$1) entitlement_movements,
   (select count(*)::int from private.purchase_documents where org_id=$2 and product_version_id=$3) purchases,
   (select count(*)::int from core.product_versions where id=$3) products,
   (select count(*)::int from core.people where id=$4 and org_id=$2) people`,[sale,org,product,studentPerson]);
  return count;
 };
 const rowsBefore=await observe();
 assert.deepEqual(rowsBefore,{sales:1,entitlement_accounts:1,entitlement_movements:2,purchases:1,products:1,people:1});
 const target={db,requestId,orgId:org,store,reader,sourceProjectRef};
 const operation={worker,attestor,request,reader,sourceProjectRef};
 await db.query('begin');
 try{
  await db.query("update core.sales set state='active' where id=$1",[sale]);
  assert.deepEqual(await archive.readOrganizationSaleArchiveScope(target),{state:'blocked',reason:'open_sale_work'});
 }finally{await db.query('rollback');}
 const scope=await archive.readOrganizationSaleArchiveScope(target);
 assert.equal(scope.state,'ready',scope.reason);
 await db.query('begin');
 try{
  await db.query("update core.previews set state='invalidated' where id=$1",[terminationPreviewId]);
  const invalidated=await archive.readOrganizationSaleArchiveScope(target);
  assert.equal(invalidated.state,'ready',invalidated.reason);
  assert.notEqual(invalidated.scopeSha256,scope.scopeSha256);
 }finally{await db.query('rollback');}
 const approval={decisionId:key(),scopeSha256:scope.scopeSha256,retainUntil:new Date(Date.now()+86400000).toISOString()};
 const archived=await archive.archiveOrganizationSales({...target,approval});
 const bytes=(await reader.get(archived.objectKey)).bytes;
 assert.equal(sha256(bytes),archived.archiveSha256);
 assert(!bytes.includes(Buffer.from(terminationReason)));
 const evidence=JSON.parse(bytes).scope;
 assert.equal(evidence.sales[0].sale_id,sale);
 assert.equal(evidence.sales[0].state,'terminated');
 assert.equal(evidence.sales[0].net_minor,'0');
 assert.equal(evidence.sales[0].person_id,studentPerson);
 assert.deepEqual(evidence.movements.map(movement=>movement.kind).sort(),['adjust_subtract','grant']);
 const [workerRole]=await worker.query('select session_user').then(response=>response.rows);
 const [attestorRole]=await attestor.query('select session_user').then(response=>response.rows);
 await db.query(`insert into private.organization_sale_erasures
  (request_id,org_id,source_fingerprint,source_project_ref,archive_scope_sha256,archive_sha256,
   approval_id,retain_until,worker_role,attestor_role)
  values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
 [requestId,org,scope.sourceFingerprint,sourceProjectRef,scope.scopeSha256,archived.archiveSha256,
  approval.decisionId,approval.retainUntil,workerRole.session_user,attestorRole.session_user]);
 const erase=(overrides={})=>archive.eraseArchivedOrganizationSales({...operation,...overrides});
 await assert.rejects(erase({reader:{get:async()=>null}}),/ORGANIZATION_SALE_ARCHIVE_PROOF_REQUIRED/);
 await assert.rejects(worker.query("select private.organization_sale_erasure_stage($1,'confirm',$2)",[request,archived.archiveSha256]),/FORBIDDEN/);
 await db.query("update core.sales set paid_days=paid_days+1 where id=$1",[sale]);
 try{await assert.rejects(erase(),/ORGANIZATION_SALE_ARCHIVE_SOURCE_CHANGED/);}
 finally{await db.query("update core.sales set paid_days=paid_days-1 where id=$1",[sale]);}
 const [movement]=await rows('select id from core.entitlement_movements where sale_id=$1 order by id limit 1',[sale]);
 await assert.rejects(db.query('delete from core.entitlement_movements where id=$1',[movement.id]),/INTEGRITY_VIOLATION/);
 const hold=key();
 try{
  const held=await erase({reader:{get:async name=>{
   const object=await reader.get(name);
   await db.query(`insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at)
    values($1,$2,'entitlement_movements',$3,'Synthetic held sale movement','synthetic',clock_timestamp()-interval '1 day')`,[hold,org,movement.id]);
   return object;
  }}});
  assert.deepEqual(held,{state:'held'});
  assert.deepEqual(await observe(),rowsBefore);
 }finally{await db.query('delete from core.retention_holds where id=$1',[hold]);}
 const completed=await erase();
 assert.deepEqual(completed,{state:'completed',archive_sha256:archived.archiveSha256});
 assert.deepEqual(await erase(),completed);
 assert.deepEqual(await observe(),{sales:0,entitlement_accounts:0,entitlement_movements:0,purchases:0,products:0,people:1});
 const [{erased_subject_ids:erased}]=await rows('select erased_subject_ids from private.organization_sale_erasures where request_id=$1',[requestId]);
 assert([sale,product,movement.id].every(id=>erased.includes(id)));
 assert.equal(sha256((await reader.get(archived.objectKey)).bytes),archived.archiveSha256);
 return {sale_source_purge:true,sale_archive_sha256:archived.archiveSha256,sale_erased_subjects:erased.length};
}
