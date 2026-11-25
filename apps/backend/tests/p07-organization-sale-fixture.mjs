import assert from 'node:assert/strict';
import * as archive from '../scripts/organization-db-archive.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {sha256} from '../scripts/restore-guard.mjs';
import {must} from './api-client.mjs';
import {preparationFixture} from './starter-preparation-fixture.mjs';

export async function verifyOrganizationPaidSaleRetention(){
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
  await api('collection_record_v1',{person_id:person,debt_ids:[debt],amount_minor:'1000',
   currency:'TRY',occurred_at:new Date().toISOString(),payment:{method:'cash'}});
  const termination=await api('sale_terminate_preview_v1',{sale_id:sale,reason:'Synthetic paid sale ended without obligation'});
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

  const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,all_data:true,reason:'Synthetic paid archive boundary'});
  const {job_id:jobId}=await must(owner,'organization_delete_apply_v1',{
   org_id:org,all_data:true,preview:token(preview),reauth:owner.jwt
  },key());
  const [{request_id:requestId}]=await rows('select request_id from private.p07_privacy_jobs where id=$1 and org_id=$2',[jobId,org]);
  const target={db,requestId,orgId:org};
  assert.deepEqual(await archive.readOrganizationSaleArchiveScope(target),{state:'blocked',reason:'dependent_sale_work'});
  await assert.rejects(archive.archiveOrganizationSales({...target,
   store:{put:()=>assert.fail('Unapproved financial evidence must not be archived')}
  }),/ORGANIZATION_SALE_ARCHIVE_SOURCE_BLOCKED/);
  assert.deepEqual(await finance(),before);
  assert.deepEqual(await rows('select completed_at from private.organization_sale_erasures where request_id=$1',[requestId]),[]);
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
