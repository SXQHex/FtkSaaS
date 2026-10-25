import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('P01-B request intent, alternatives and atomic guarded approval through Auth -> Edge -> RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('request-owner'),foreign=await authUser('request-foreign');
 const account=await must(owner,'account_get_v1'),org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P01 requests',initial_plan_id:plan},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 try{
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Requests',timezone:'Europe/Istanbul'},key())).primary_id;
 const center2=(await must(owner,'center_create_v1',{org_id:org,name:'Not managed',timezone:'UTC'},key())).primary_id;
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));return r;};
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 await mut('center_manager_assign_v1',{person_id:ownerPerson});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic requests',occurred_at:new Date().toISOString()});
 await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Private',state:'active'},key())).primary_id;
 await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 async function linked(label){
  const p=(await mut('person_create_v1',{display_name:label,contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:p});
  const u=await authUser(label),a=await must(u,'account_get_v1');await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);return {p,u,a};
 }
 const student=await linked('request-student'),other=await linked('request-other');
 const pub=(k,value)=>mut('policy_publish_v1',{center_id:null,key:k,value,effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
 await pub('student_cancel_private',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
 await pub('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
 await pub('negative_default',{kind:'integer',value:0});await pub('negative_upper',{kind:'integer',value:0});
 const product=(await mut('product_publish_v1',{terms:{name:'Request credits',kind:'credits',booking_mode:'flexible',credits:20,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
 const preview=await must(owner,'sale_preview_v1',scope({person_id:student.p,product_version_id:product,start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+30*86400000).toISOString().slice(0,10)}));
 await mut('sale_apply_v1',{preview:{id:preview.id,token:preview.token}});
 let slot=0;const next=()=>new Date(Date.now()+2*86400000+slot++*7200000).toISOString();
 const request=(start=next(),u=student.u,p=student.p,k=key())=>mut('lesson_request_create_v1',{person_id:p,discipline_id:discipline,requested_start:start,duration_minutes:60},u,k);
 const view=async(id,u=student.u,operation='lesson_request_withdraw_v1')=>(await must(u,'management_state_get_v1',scope({operation,selector:{operation,key:{lesson_request_id:id}}}))).items[0]?.request_detail;
 const session=async(start)=>{const id=key();await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'private',$5,$6,1,1,'planned','open')",[id,org,center,discipline,start,new Date(Date.parse(start)+3600000)]);return id;};
 const domainCounts=async()=>(await rows("select jsonb_build_object('requests',(select count(*) from core.lesson_requests where org_id=$1),'sessions',(select count(*) from core.sessions where org_id=$1),'resources',(select count(*) from core.resource_bookings where org_id=$1),'reservations',(select count(*) from core.reservations where org_id=$1),'allocations',(select count(*) from core.entitlement_allocations where org_id=$1),'receipts',(select count(*) from core.operation_receipts where org_id=$1),'audit',(select count(*) from core.audit_events where org_id=$1),'jobs',(select count(*) from core.outbox_jobs where org_id=$1)) n",[org]))[0].n;
 await t.test('request window is separate, required, scope-effective and exception requires explicit CM reason',async()=>{
  const body=start=>({person_id:student.p,discipline_id:discipline,requested_start:start,duration_minutes:60});
  const future=()=>new Date(Date.now()+120*60000).toISOString();const before=await domainCounts();
  await fail('lesson_request_create_v1',body(future()),'POLICY_NOT_CONFIGURED',student.u);assert.deepEqual(await domainCounts(),before);
  const window=(opens,closes=0,exception=false)=>({kind:'window',opens_minutes_before:opens,closes_minutes_before:closes,manager_exception:exception});
  await pub('request_window',window(60));await fail('lesson_request_create_v1',body(future()),'FORBIDDEN',student.u);
  await fail('lesson_request_create_v1',{...body(future()),window_exception:true,reason:'synthetic exception'},'FORBIDDEN');
  await pub('request_window',window(10080,180));await fail('lesson_request_create_v1',body(future()),'FORBIDDEN',student.u);
  await pub('request_window',window(60,0,true));
  await fail('lesson_request_create_v1',body(future()),'FORBIDDEN');
  await fail('lesson_request_create_v1',{...body(future()),window_exception:true,reason:'synthetic exception'},'FORBIDDEN',student.u);
  const r=await request(new Date(Date.now()+30*60000).toISOString()),altAt=future(),alternatives=[{interval:{starts_at:altAt,ends_at:new Date(Date.parse(altAt)+3600000).toISOString()}}];
  await fail('lesson_request_offer_alternative_v1',{lesson_request_id:r.primary_id,expected_version:1,alternatives},'FORBIDDEN');
  const offered=await mut('lesson_request_offer_alternative_v1',{lesson_request_id:r.primary_id,expected_version:1,alternatives,window_exception:true,reason:'synthetic CM window approval'});
  assert.equal((await rows('select reason from core.audit_events where org_id=$1 and operation_id=$2',[org,offered.operation_id]))[0].reason,'synthetic CM window approval');
  const alt=(await view(r.primary_id)).alternatives[0];
  await fail('lesson_request_accept_alternative_v1',{lesson_request_id:r.primary_id,alternative_id:alt.id,expected_version:2},'FORBIDDEN',student.u);
  await pub('request_window',window(180));await mut('lesson_request_accept_alternative_v1',{lesson_request_id:r.primary_id,alternative_id:alt.id,expected_version:2},student.u);
  await mut('lesson_request_withdraw_v1',{lesson_request_id:r.primary_id,expected_version:3},student.u);
  await mut('policy_publish_v1',{key:'request_window',value:window(20000),effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
  await mut('policy_publish_v1',{center_id:null,key:'request_window',value:window(60),effective_at:new Date(Date.now()-1000).toISOString(),mandatory:true});
  await fail('lesson_request_create_v1',body(future()),'FORBIDDEN',student.u);
  await fail('policy_publish_v1',{key:'request_window',value:window(20000),effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false},'FORBIDDEN');
  await pub('request_window',window(10080));
 });
 await t.test('different keys cannot duplicate an open intent; no seat, resource or right is held',async()=>{
  const start=next(),r=await request(start),after=await domainCounts();
  await fail('lesson_request_create_v1',{person_id:student.p,discipline_id:discipline,requested_start:start,duration_minutes:60},'OPEN_OPERATIONS_EXIST',student.u);
  assert.equal(after.reservations,0);assert.equal(after.allocations,0);assert.equal(after.resources,0);
  const row=await view(r.primary_id);assert.equal(row.id,r.primary_id);assert.equal(row.state,'pending');assert.equal(row.version,1);
  await fail('lesson_request_withdraw_v1',{lesson_request_id:r.primary_id,expected_version:1},'FORBIDDEN',other.u);
  await fail('lesson_request_withdraw_v1',{lesson_request_id:r.primary_id,expected_version:1},'NOT_FOUND',foreign);
  await fail('lesson_request_withdraw_v1',{center_id:center2,lesson_request_id:r.primary_id,expected_version:1},'NOT_FOUND',student.u);
  await fail('lesson_request_withdraw_v1',{lesson_request_id:r.primary_id,expected_version:9},'VERSION_CONFLICT',student.u);
  await mut('lesson_request_withdraw_v1',{lesson_request_id:r.primary_id,expected_version:1},student.u);
 });
 await t.test('alternative selection remains intent; only center approval creates the linked reservation',async()=>{
  const r=await request(),at=next(),end=new Date(Date.parse(at)+3600000).toISOString();
  await mut('lesson_request_offer_alternative_v1',{lesson_request_id:r.primary_id,expected_version:1,alternatives:[{interval:{starts_at:at,ends_at:end}}]});
  let row=await view(r.primary_id);const alt=row.alternatives[0];assert(alt.id);assert.equal(row.version,2);
  await mut('lesson_request_accept_alternative_v1',{lesson_request_id:r.primary_id,alternative_id:alt.id,expected_version:2},student.u);
  row=await view(r.primary_id);assert.equal(row.state,'alternative_offered');assert.equal(row.alternatives[0].state,'accepted');assert(row.alternatives[0].selected_at);assert.equal(row.version,3);
  assert.equal((await domainCounts()).reservations,0);
  const sid=await session(at);await fail('lesson_request_approve_v1',{lesson_request_id:r.primary_id,expected_version:3,session_id:sid},'FORBIDDEN',student.u);
  const result=await mut('lesson_request_approve_v1',{lesson_request_id:r.primary_id,expected_version:3,session_id:sid});
  assert.equal(result.primary_id,r.primary_id);assert(result.related.some(v=>v.type==='reservations'));
  row=await view(r.primary_id);assert.equal(row.state,'approved');assert(row.reservation_id);
  const actual=(await must(owner,'reservation_list_v1',scope({person_id:student.p,page:{}}))).items;assert(actual.some(v=>v.id===row.reservation_id));
  assert.equal((await rows('select count(*)::int n from core.entitlement_allocations where org_id=$1 and reservation_id=$2',[org,row.reservation_id]))[0].n,1);
 });
 await t.test('late invalid alternative rolls back earlier inserted alternatives, version, receipt and audit',async()=>{
  const r=await request(),at=next(),before=await domainCounts();const k=key();
  await fail('lesson_request_offer_alternative_v1',{lesson_request_id:r.primary_id,expected_version:1,alternatives:[{interval:{starts_at:at,ends_at:new Date(Date.parse(at)+3600000).toISOString()}},{interval:{starts_at:at,ends_at:at}}]},'VALIDATION_FAILED',owner,k);
  assert.deepEqual(await domainCounts(),before);const row=await view(r.primary_id);assert.equal(row.version,1);assert.equal(row.alternatives.length,0);
  await mut('lesson_request_reject_v1',{lesson_request_id:r.primary_id,expected_version:1,reason:'synthetic rejected'});assert.equal((await view(r.primary_id)).state,'rejected');
 });
 await t.test('offer and withdrawal race uses the read parent version and has one winner',async()=>{
  const r=await request(),at=next(),answers=await Promise.all([
   call(owner,'lesson_request_offer_alternative_v1',scope({lesson_request_id:r.primary_id,expected_version:1,alternatives:[{interval:{starts_at:at,ends_at:new Date(Date.parse(at)+3600000).toISOString()}}]}),key()),
   call(student.u,'lesson_request_withdraw_v1',scope({lesson_request_id:r.primary_id,expected_version:1}),key())]);
  assert.equal(answers.filter(a=>a.result.ok).length,1);assert.equal(answers.find(a=>!a.result.ok).result.error.code,'VERSION_CONFLICT');assert.equal((await view(r.primary_id)).version,2);
 });
 await t.test('late required-document rejection rolls back optional session, reservation, rights and nested receipts',async()=>{
  const r=await request(),row=await view(r.primary_id),f=key(),doc=key(),v=key();
  await db.query("insert into core.files(id,org_id,object_key,mime,size_bytes,purpose,state) values($1,$2,$3,'application/pdf',1,'document','ready')",[f,org,'synthetic/'+f]);
  await db.query("insert into core.documents(id,org_id,name,state) values($1,$2,'Synthetic requirement','active')",[doc,org]);
  await db.query("insert into core.document_versions(id,org_id,document_id,file_id,version_label,content_hash,effective_at) values($1,$2,$3,$4,'1','synthetic',now()-interval '1 minute')",[v,org,doc,f]);
  await db.query("insert into core.document_requirements(id,org_id,document_version_id,scope,operation,renewed_acceptance) values($1,$2,$3,$4,'reservation',true)",[key(),org,v,{center_ids:[center]}]);
  const body={lesson_request_id:r.primary_id,expected_version:1,session:{discipline_id:discipline,format:'private',interval:{starts_at:row.requested_start,ends_at:new Date(Date.parse(row.requested_start)+3600000).toISOString()},resources:[],assignments:[],capacity:{total:1}}},k=key(),before=await domainCounts();
  await fail('lesson_request_approve_v1',body,'DOCUMENT_REQUIRED',owner,k);assert.deepEqual(await domainCounts(),before);assert.equal((await view(r.primary_id)).state,'pending');
  await db.query("insert into core.document_acceptances(id,org_id,person_id,account_id,document_version_id,accepted_at,operation_id,context) values($1,$2,$3,$4,$5,now(),$6,$7)",[key(),org,student.p,student.a.id,v,r.operation_id,{gate:'reservation',subject:{type:'lesson_requests',id:r.primary_id}}]);
  const result=await mut('lesson_request_approve_v1',body,owner,k);assert(result.related.some(v=>v.type==='sessions'));assert.equal((await view(r.primary_id)).state,'approved');
 });
 await t.test('read cursor is scope-bound; same-key replay still requires live CM authority',async()=>{
  const operation='lesson_request_create_v1',requestBody=scope({operation,selector:{operation,key:{}},page:{limit:1}});
  const page=await must(owner,'management_state_get_v1',requestBody);assert(page.next_cursor);assert(page.items[0].request_detail.id);
  const invalid=await call(owner,'management_state_get_v1',{...requestBody,page:{limit:1,cursor:page.next_cursor},selector:{operation,key:{person_id:other.p}}});assert.equal(invalid.result.error.code,'VALIDATION_FAILED');
  const r=await request(),b={lesson_request_id:r.primary_id,expected_version:1,reason:'synthetic'},k=key();await mut('lesson_request_reject_v1',b,owner,k);
  await db.query("update core.role_assignments set state='inactive' where org_id=$1 and scope_center_id=$2 and person_id=$3 and role='center_manager'",[org,center,ownerPerson]);
  await fail('lesson_request_reject_v1',b,'FORBIDDEN',owner,k);
 });
 }finally{await db.end();}
});
