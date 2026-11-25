import assert from 'node:assert/strict';
import * as archive from '../scripts/organization-db-archive.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';

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
