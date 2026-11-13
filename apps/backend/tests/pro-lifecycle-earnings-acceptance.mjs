import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {tick} from '../scripts/p01-worker.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

const token=p=>({id:p.id,token:p.token});
const date=days=>{
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
 return new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
};
const interval=days=>({starts_at:date(days)+'T10:00:00Z',ends_at:date(days)+'T11:00:00Z'});

async function fixture(planName){
 const db=await connect();
 try{
  const {platform,plan}=await fixturePlatform(),owner=await authUser('lifecycle-'+planName),account=await must(owner,'account_get_v1');
  await db.query('update core.saas_plan_versions set name=$1 where id=$2',[planName,plan]);
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic lifecycle '+planName,initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Lifecycle center',timezone:'Europe/Istanbul'},key())).primary_id;
  const scope=b=>({org_id:org,center_id:center,...b}),api=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:person});
  const payment=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic lifecycle',occurred_at:new Date().toISOString()});
  await api('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},key(),platform);
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Lifecycle discipline',state:'active'},key())).primary_id;
  await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  const publish=(name,value)=>api('policy_publish_v1',{center_id:null,key:name,value,effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
  for(const format of ['group','private'])await publish('student_cancel_'+format,{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
  await publish('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  await publish('request_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  if(['pro','business'].includes(planName))await publish('waitlist_offer_minutes',{kind:'integer',value:30});
  await publish('negative_default',{kind:'integer',value:0});await publish('negative_upper',{kind:'integer',value:0});
  const linked=async(label,role)=>{
   const p=(await api('person_create_v1',{display_name:'Synthetic '+label,contacts:[]})).primary_id;
   await api('student_activate_v1',{person_id:p});
   const user=await authUser(label),a=await must(user,'account_get_v1');
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
   if(role)await api('role_assign_v1',{person_id:p,role,scope:{center_id:center}});
   return {person:p,user};
  };
  const product=(credits,price='0')=>api('product_publish_v1',{terms:{name:'Synthetic lifecycle credits',kind:'credits',booking_mode:'flexible',credits,price_minor:price,currency:'TRY',freeze:{enabled:true,extends_validity:true,max_days:10},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}});
  const sell=async(student,version)=>{
   const preview=await api('sale_preview_v1',{person_id:student,product_version_id:version,start_date:date(0),end_date:date(30)});
   assert.deepEqual(preview.blockers,[]);return (await api('sale_apply_v1',{preview:token(preview)})).primary_id;
  };
  const session=(days,extra={})=>api('session_create_v1',{discipline_id:discipline,format:'group',interval:interval(days),resources:[],assignments:[],capacity:{total:1},...extra});
  const fail=async(op,body,code,u=owner,k=key())=>{
   const response=await call(u,op,scope(body),k);assert.equal(response.result.ok,false,JSON.stringify(response.result));assert.equal(response.result.error.code,code,JSON.stringify(response.result));
  };
  return {db,org,center,person,discipline,owner,scope,api,linked,product,sell,session,fail};
 }catch(error){await db.end();throw error;}
}

for(const planName of ['pro','business']){
 test('P03 '+planName+' package transitions revalidate held offers and preserve confirmed rights',async()=>{
  const f=await fixture(planName),{db,org,api,linked,product,sell,session,fail,scope}=f;
  let worker;
  const role='p03_'+key().replaceAll('-','');
  try{
   const student=await linked('package-'+planName),version=(await product(10)).primary_id,sale=await sell(student.person,version);
   const target=interval(2),alternative=interval(3);
   const requested=await api('lesson_request_create_v1',{person_id:student.person,discipline_id:f.discipline,requested_start:target.starts_at,duration_minutes:60},key(),student.user);
   await api('lesson_request_offer_alternative_v1',{lesson_request_id:requested.primary_id,expected_version:requested.version,alternatives:[{interval:alternative}]});
   const readRequest=async()=>{
    const operation='lesson_request_withdraw_v1';return (await api('management_state_get_v1',{operation,selector:{operation,key:{lesson_request_id:requested.primary_id}}},key(),student.user)).items[0].request_detail;
   };
   let intent=await readRequest();
   await api('lesson_request_accept_alternative_v1',{lesson_request_id:intent.id,expected_version:intent.version,alternative_id:intent.alternatives[0].id},key(),student.user);
   intent=await readRequest();assert.equal(intent.state,'alternative_offered');
   assert.equal((await db.query('select count(*)::int n from core.reservations where org_id=$1',[org])).rows[0].n,0);
   const approvedSession=(await session(3,{format:'private',interval:alternative})).primary_id;
   await api('lesson_request_approve_v1',{lesson_request_id:intent.id,expected_version:intent.version,session_id:approvedSession});
   const confirmed=(await readRequest()).reservation_id;assert(confirmed);
   const allocation=async()=>(await db.query('select to_jsonb(a) value from core.entitlement_allocations a where org_id=$1 and reservation_id=$2 order by id',[org,confirmed])).rows;
   const beforeFreeze=await allocation();assert.equal(beforeFreeze.length,1);
   const group=(await session(5)).primary_id;
   const operation='waitlist_join_v1',join=()=>api(operation,{session_id:group,person_id:student.person},key(),student.user);
   const offers=async()=>(await api('management_state_get_v1',{operation,selector:{operation,key:{session_id:group,person_id:student.person}}},key(),student.user)).items.map(x=>x.waitlist_detail);
   await join();
   const password=randomBytes(24).toString('hex');
   await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_p01_worker to "${role}"`);
   await db.query('insert into private.p01_worker_scopes(db_role,org_id) values($1,$2)',[role,org]);
   const url=new URL(context().env.DB_URL);url.username=role;url.password=password;
   worker=new pg.Client({connectionString:url.toString()});await worker.connect();
   const drain=async()=>{for(let i=0;i<6;i++){const result=await tick(worker,org);assert(result.every(x=>x.ok),JSON.stringify(result));if(!result.length)break;}};
   await drain();const offer=(await offers()).find(x=>x.state==='offered').offers.find(x=>x.state==='active');assert(offer);
   const accept={offer_id:offer.id,expected_version:offer.version},acceptKey=key();
   const freeze=await api('freeze_preview_v1',{sale_id:sale,dates:{start_date:date(4),end_date:date(7)},reason:'Synthetic explicit freeze'});
   assert.deepEqual(freeze.blockers,[]);const frozen=await api('freeze_apply_v1',{preview:token(freeze)});
   assert.deepEqual(await allocation(),beforeFreeze);
   await fail('seat_offer_accept_v1',accept,'CREDIT_LIMIT_EXCEEDED',student.user,acceptKey);
   const held=(await offers()).find(x=>x.state==='offered').offers.find(x=>x.id===offer.id);
   assert.equal(held.state,'active');assert.equal(held.expires_at,offer.expires_at);
   const ended=await api('freeze_end_preview_v1',{freeze_id:frozen.primary_id,end_date:date(5),reason:'Synthetic explicit early end'});
   await api('freeze_end_apply_v1',{preview:token(ended)});assert.deepEqual(await allocation(),beforeFreeze);
   const nextVersion=(await product(3)).primary_id;
   const change=await api('sale_change_preview_v1',{sale_id:sale,new_product_version_id:nextVersion,keep_reservation_ids:[confirmed],cancel_reservation_ids:[],start_date:date(0),end_date:date(30),reason:'Synthetic package change',offset_minor:'0'});
   assert.deepEqual(change.blockers,[]);const changed=(await api('sale_change_apply_v1',{preview:token(change)})).primary_id;
   const old=(await db.query('select state from core.sales where org_id=$1 and id=$2',[org,sale])).rows[0];assert.equal(old.state,'terminated');
   assert.equal((await db.query('select source_sale_id from core.reservations where id=$1',[confirmed])).rows[0].source_sale_id,changed);
   const accepted=await api('seat_offer_accept_v1',accept,acceptKey,student.user);
   assert.equal((await api('seat_offer_accept_v1',accept,acceptKey,student.user)).replayed,true);
   const reserved=accepted.related.find(x=>x.type==='reservations').id;
   assert.equal((await db.query('select source_sale_id from core.reservations where id=$1',[reserved])).rows[0].source_sale_id,changed);
   const terminate=await api('sale_terminate_preview_v1',{sale_id:changed,reason:'Synthetic explicit termination'});
   await api('sale_terminate_apply_v1',{preview:token(terminate)});
   const preserved=(await db.query('select id,state,source_sale_id from core.reservations where id=any($1::uuid[]) order by id',[[confirmed,reserved]])).rows;
   assert.equal(preserved.length,2);assert(preserved.every(x=>x.state==='active'&&x.source_sale_id===changed));
   const renewal=await api('sale_renew_preview_v1',{previous_sale_id:changed,product_version_id:nextVersion,start_date:date(0),end_date:date(30)});
   assert.deepEqual(renewal.blockers,[]);const renewed=(await api('sale_renew_apply_v1',{preview:token(renewal)})).primary_id;
   const rights=await api('entitlements_get_v1',{person_id:student.person});const current=rights.find(x=>x.sale_id===renewed);
   assert.equal(current.available,3);assert.equal(current.reserved,0);
   assert.deepEqual((await db.query('select id,state,source_sale_id from core.reservations where id=any($1::uuid[]) order by id',[[confirmed,reserved]])).rows,preserved);
   const rejectSession=(await session(6)).primary_id;
   await api('waitlist_join_v1',{session_id:rejectSession,person_id:student.person},key(),student.user);await drain();
   const forSession=async()=>{
    const rows=(await api('management_state_get_v1',{operation,selector:{operation,key:{session_id:rejectSession,person_id:student.person}}},key(),student.user)).items;
    return rows.map(x=>x.waitlist_detail);
   };
   const rejected=(await forSession()).find(x=>x.state==='offered').offers.find(x=>x.state==='active');
   await api('seat_offer_reject_v1',{offer_id:rejected.id,expected_version:rejected.version},key(),student.user);
   await api('waitlist_join_v1',{session_id:rejectSession,person_id:student.person},key(),student.user);await drain();
   const expiring=(await forSession()).find(x=>x.state==='offered').offers.find(x=>x.state==='active');
   await db.query("update core.seat_offers set expires_at=clock_timestamp()-interval '1 second' where id=$1",[expiring.id]);
   const [refused]=await Promise.all([call(student.user,'seat_offer_accept_v1',scope({offer_id:expiring.id,expected_version:expiring.version}),key()),tick(worker,org)]);
   assert.equal(refused.result.ok,false);await drain();
   assert.equal((await db.query('select state from core.seat_offers where id=$1',[expiring.id])).rows[0].state,'expired');
   assert.equal((await db.query('select count(*)::int n from core.reservations where session_id=$1',[rejectSession])).rows[0].n,0);
  }finally{
   if(worker)await worker.end();
   await db.query('delete from private.p01_worker_scopes where db_role=$1',[role]);await db.query(`drop role if exists "${role}"`);await db.end();
  }
 });

 test('P04 '+planName+' real lesson earnings reconcile concurrent payment and immutable correction',async()=>{
  const f=await fixture(planName),{db,org,api,linked,product,sell,session,fail}=f;
  try{
   const student=await linked('paid-learner-'+planName),teacher=await linked('paid-teacher-'+planName,'instructor');
   await api('availability_save_v1',{resource:{kind:'person',id:teacher.person},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
   const terms={model:'explicit_mixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'},{kind:'per_person',amount_minor:'50'}],room_fee:{kind:'free',order:'before_instructor_share'}};
   const agreement={person_id:teacher.person,discipline_id:f.discipline,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms,reason:'Synthetic explicit paid lesson'};
   const original=await api('instructor_agreement_publish_v1',agreement);
   const version=(await product(4,'1000')).primary_id,sale=await sell(student.person,version);
   const debt=(await db.query('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale])).rows[0].id;
   await api('collection_record_v1',{person_id:student.person,debt_ids:[debt],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString(),payment:{method:'cash'}});
   const collected=(await api('finance_get_v1',{person_id:student.person,currency:'TRY',page:{}})).debts.find(x=>x.id===debt);
   assert.equal(collected.remaining_minor,'0');
   const studentCash=async()=>(await db.query('select to_jsonb(c) value from core.cash_movements c where org_id=$1 and person_id=$2 order by id',[org,student.person])).rows;
   const cashBefore=await studentCash();assert.equal(cashBefore.length,1);
   const lesson=(await session(2,{assignments:[{person_id:teacher.person,duty:'instructor'}]})).primary_id;
   const reservation=(await api('reservation_create_v1',{session_id:lesson,person_id:student.person,source_sale_id:sale,mode:'flexible'},key(),student.user)).primary_id;
   const attendance=()=>api('attendance_get_v1',{session_id:lesson});
   let view=await attendance();
   await api('attendance_start_v1',{session_id:lesson,expected_version:view.session_version,actual_started_at:new Date().toISOString(),reason:'Synthetic observed early start'});
   const successor=await api('instructor_agreement_publish_v1',{...agreement,valid:{...agreement.valid,starts_at:new Date(Date.now()-5000).toISOString()},supersedes_id:original.primary_id,expected_version:original.version,terms:{...terms,components:[{kind:'session_fixed',amount_minor:'999'}]}});
   view=await attendance();const entry=view.entries.find(x=>x.reservation_id===reservation);
   await api('attendance_mark_v1',{reservation_id:reservation,expected_version:entry.version,result:'attended'});
   view=await attendance();const closureKey=key(),close={session_id:lesson,expected_version:view.session_version,performed:true,performed_instructor_ids:[teacher.person]};
   await api('attendance_close_v1',close,closureKey);assert.equal((await api('attendance_close_v1',close,closureKey)).replayed,true);
   const intervalRead={starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'};
   const earnings=async(u=f.owner)=>(await api('earnings_list_v1',{person_id:teacher.person,interval:intervalRead,page:{}},key(),u)).items;
   const initial=(await earnings()).find(x=>x.session_id===lesson);assert(initial);assert.equal(initial.amount_minor,'150');
   const actual=(await db.query('select agreement_id from core.earnings where id=$1',[initial.id])).rows[0];assert.equal(actual.agreement_id,original.primary_id);
   const future=(await session(3,{assignments:[{person_id:teacher.person,duty:'instructor'}]})).primary_id;
   assert.equal((await db.query("select agreement_id from core.session_assignments where session_id=$1 and state='active'",[future])).rows[0].agreement_id,successor.primary_id);
   const pay={person_id:teacher.person,earning_ids:[initial.id],amount_minor:'100',currency:'TRY',occurred_at:new Date().toISOString()};
   const race=await Promise.all([key(),key()].map(k=>call(f.owner,'instructor_payment_record_v1',f.scope(pay),k)));
   assert.equal(race.filter(x=>x.result.ok).length,1);assert.equal(race.find(x=>!x.result.ok).result.error.code,'VALIDATION_FAILED');
   let read=(await earnings()).find(x=>x.id===initial.id);assert.equal(read.paid_minor,'100');assert.equal(read.remaining_minor,'50');
   const paymentKey=key(),rest={...pay,amount_minor:'50',occurred_at:new Date().toISOString()};
   const payment=await api('instructor_payment_record_v1',rest,paymentKey);assert.equal((await api('instructor_payment_record_v1',rest,paymentKey)).replayed,true);
   read=(await earnings()).find(x=>x.id===initial.id);assert.equal(read.paid_minor,'150');assert.equal(read.remaining_minor,'0');
   const correction=await api('attendance_correct_preview_v1',{session_id:lesson,corrections:[{reservation_id:reservation,result:'no_show'}],reason:'Synthetic observed attendance correction'});
   assert.deepEqual(correction.blockers,[]);await api('attendance_correct_apply_v1',{preview:token(correction)});
   const corrected=await earnings(),difference=corrected.find(x=>x.previous_id===initial.id);
   assert(difference);assert.equal(difference.direction,'subtract');assert.equal(difference.amount_minor,'50');
   assert.equal(corrected.find(x=>x.id===initial.id).overpaid_minor,'50');
   assert.equal((await db.query('select agreement_id from core.earnings where id=$1',[difference.id])).rows[0].agreement_id,original.primary_id);
   const fix={payment_id:payment.primary_id,expected_version:payment.version,correction:{amount_minor:'50',currency:'TRY',occurred_at:new Date().toISOString(),direction:'decrease'},reason:'Synthetic explicit payment correction'};
   const fixed=await api('instructor_payment_correct_v1',fix);assert.equal(fixed.version,payment.version+1);
   await fail('instructor_payment_correct_v1',fix,'VERSION_CONFLICT');
   read=(await earnings(teacher.user)).find(x=>x.id===initial.id);assert.equal(read.paid_minor,'100');assert.equal(read.remaining_minor,'0');assert.equal(read.overpaid_minor,'0');
   assert.equal((await db.query('select amount_minor::text amount from core.instructor_payments where id=$1',[payment.primary_id])).rows[0].amount,'50');
   assert.equal((await db.query('select count(*)::int n from core.cash_movements where org_id=$1 and person_id=$2',[org,teacher.person])).rows[0].n,0);
   assert.deepEqual(await studentCash(),cashBefore);
   await fail('earnings_list_v1',{person_id:teacher.person,interval:intervalRead,page:{}},'FORBIDDEN',student.user);
   const cm=(await db.query("select version from core.role_assignments where org_id=$1 and person_id=$2 and role='center_manager' and state='active'",[org,f.person])).rows[0];
   await api('center_manager_revoke_v1',{person_id:f.person,expected_version:Number(cm.version),reason:'Synthetic live payment revocation'});
   await fail('instructor_payment_record_v1',rest,'FORBIDDEN',f.owner,paymentKey);
  }finally{await db.end();}
 });
}

// G02 bridges existing accepted mechanisms using one Pro organization and the
// same application -> person/No -> sale/reservation -> earning/report identities.
test('G02 Pro imported application becomes the same documented paid learner in lesson, finance, earnings, notifications and CSV',{timeout:300000},async()=>{
 const {createHash}=await import('node:crypto'),{tick:p06tick}=await import('../scripts/p06-worker.mjs');
 const f=await fixture('pro'),{db,org,center,api,owner}=f;let worker;
 const role='g02_p06_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 try{
  await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_p06_worker to "${role}"`);
  await db.query('insert into private.p06_worker_scopes values($1,$2)',[role,org]);await db.query('insert into private.p06_configuration values($1,2097152,100,2097152)',[org]);
  const url=new URL(context().env.DB_URL);url.username=role;url.password=password;worker=new pg.Client({connectionString:url.href});await worker.connect();
  const drain=async()=>{for(let i=0;i<8;i++){const results=await p06tick(worker,org);assert(results.every(x=>x.ok),JSON.stringify(results));if(!results.length)return;}throw Error('G02 worker did not settle');};
  const csv='source_key,display_name,phone,consents\r\ng02-person,Synthetic G02 candidate,+905550000091,[]\r\n',checksum=createHash('sha256').update(csv).digest('hex');
  const file=await api('import_upload_prepare_v1',{filename:'synthetic-g02.csv',mime:'text/csv',bytes:Buffer.byteLength(csv),checksum});
  const upload=await fetch(new URL(file.upload_url,context().env.API_URL),{method:'PUT',headers:{apikey:context().env.ANON_KEY,'content-type':'text/csv'},body:csv});assert(upload.ok);
  await api('file_upload_complete_v1',{file_id:file.file_id,checksum});
  const mapping={kind:'crm_applications',columns:['source_key','display_name','phone','consents'].map(target=>({source_column:target,target}))};
  const job=await api('import_preview_v1',{file_id:file.file_id,mapping,source_namespace:'synthetic-g02-'+key()});await drain();
  const ready=await api('job_status_get_v1',{job_id:job.job_id}),preview=await api('preview_get_v1',{preview_id:ready.result_reference.id});
  await api('import_apply_v1',{preview:token(preview),selected_row_numbers:[1]});await drain();
  const imported=await api('import_rows_list_v1',{job_id:job.job_id,page:{limit:100}});assert.equal(imported.items[0].state,'applied');
  const application=imported.items[0].created_references.find(x=>x.type==='public_applications').id;
  await api('public_application_review_v1',{application_id:application,action:'create_candidate',expected_version:1});
  const inbox=await api('management_state_get_v1',{operation:'public_application_review_v1',selector:{operation:'public_application_review_v1',key:{application_id:application}},page:{}});
  const candidate=inbox.items[0].current.values;assert.equal(candidate.source.file_checksum,checksum);assert.deepEqual(candidate.intake.consents,[]);
  const person=candidate.person_id;assert(person);assert.equal((await api('person_get_v1',{person_id:person})).subscriber_number,null);
  const leads=await api('leads_list_v1',{page:{limit:100}}),lead=leads.items.find(x=>x.person_id===person);assert(lead);
  const convertKey=key();await api('lead_convert_v1',{lead_id:lead.id},convertKey);assert.equal((await api('lead_convert_v1',{lead_id:lead.id},convertKey)).replayed,true);
  const numbered=await api('person_get_v1',{person_id:person}),number=numbered.subscriber_number;assert(BigInt(number)>=1001n);
  const student=await authUser('g02-converted-learner'),account=await must(student,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,person]);
  const version=(await f.product(4,'1000')).primary_id;
  const content={name:'Synthetic G02 service terms',language:'tr',template_id:'synthetic-g02',template_version:'1',text:'Synthetic G02 acceptance terms.\n'};
  const document=(await api('document_version_publish_v1',{digital_content:content,version_label:'synthetic-g02-v1',scope:{kind:'center',center_id:center},requirements:[{gate:'sale',scope:{center_ids:[center]},renewed_acceptance:true}]})).primary_id;
  const saleBody={person_id:person,product_version_id:version,start_date:date(0),end_date:date(30)};
  const blocked=await api('sale_preview_v1',saleBody);assert(blocked.blockers.some(x=>x.code==='DOCUMENT_REQUIRED'));
  const ctx={gate:'sale',subject:{type:'product_versions',id:version},purchase_preview_id:blocked.id};
  const requirements=await api('document_requirements_get_v1',{context:ctx},key(),student),requirement=requirements.find(x=>x.version_id===document);assert(requirement&&!requirement.accepted);
  const shown=(await api('document_requirements_get_v1',{context:ctx,content_file_id:requirement.file.id},key(),student)).find(x=>x.version_id===document);assert.deepEqual(shown.digital_content,content);
  const consent=await api('document_accept_v1',{document_version_id:document,context:ctx,rendered_document_id:shown.rendered_document.id},key(),student);
  const evidence=(await api('document_requirements_get_v1',{context:ctx,content_file_id:requirement.file.id},key(),student)).find(x=>x.version_id===document).digital_acceptance;assert.equal(evidence.id,consent.primary_id);assert.equal(evidence.person_id,person);
  const finalPreview=await api('sale_preview_v1',{...saleBody,document_purchase_id:blocked.id});const sale=(await api('sale_apply_v1',{preview:{id:finalPreview.id,token:finalPreview.token}})).primary_id,debt=(await db.query('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale])).rows[0].id;
  const collectionKey=key(),collectionBody={person_id:person,debt_ids:[debt],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString(),payment:{method:'cash'}};
  await api('collection_record_v1',collectionBody,collectionKey);assert.equal((await api('collection_record_v1',collectionBody,collectionKey)).replayed,true);
  const finance=await api('finance_get_v1',{person_id:person,currency:'TRY',page:{}});assert.equal(finance.subscriber_number,number);assert.equal(finance.debts.find(x=>x.id===debt).remaining_minor,'0');
  const teacher=await f.linked('g02-instructor','instructor');
  await api('availability_save_v1',{resource:{kind:'person',id:teacher.person},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
  const agreement=(await api('instructor_agreement_publish_v1',{person_id:teacher.person,discipline_id:f.discipline,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms:{model:'explicit_mixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'},{kind:'per_person',amount_minor:'50'}],room_fee:{kind:'free',order:'before_instructor_share'}},reason:'Synthetic G02 lesson terms'})).primary_id;
  const lesson=(await f.session(2,{assignments:[{person_id:teacher.person,duty:'instructor'}]})).primary_id;
  const reservation=(await api('reservation_create_v1',{session_id:lesson,person_id:person,source_sale_id:sale,mode:'flexible'},key(),student)).primary_id;
  let attendance=await api('attendance_get_v1',{session_id:lesson});await api('attendance_start_v1',{session_id:lesson,expected_version:attendance.session_version,actual_started_at:new Date().toISOString(),reason:'Synthetic G02 observed early start'});
  attendance=await api('attendance_get_v1',{session_id:lesson});await api('attendance_mark_v1',{reservation_id:reservation,expected_version:attendance.entries.find(x=>x.reservation_id===reservation).version,result:'attended'});
  attendance=await api('attendance_get_v1',{session_id:lesson});await api('attendance_close_v1',{session_id:lesson,expected_version:attendance.session_version,performed:true,performed_instructor_ids:[teacher.person]});
  const span={starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},earnings=async()=>(await api('earnings_list_v1',{person_id:teacher.person,interval:span,page:{}})).items;
  const earning=(await earnings()).find(x=>x.session_id===lesson);assert.equal(earning.amount_minor,'150');assert.equal((await db.query('select agreement_id from core.earnings where id=$1',[earning.id])).rows[0].agreement_id,agreement);
  const payment=await api('instructor_payment_record_v1',{person_id:teacher.person,earning_ids:[earning.id],amount_minor:'150',currency:'TRY',occurred_at:new Date().toISOString()});
  const correction=await api('attendance_correct_preview_v1',{session_id:lesson,corrections:[{reservation_id:reservation,result:'no_show'}],reason:'Synthetic G02 correction'});assert.deepEqual(correction.blockers,[]);await api('attendance_correct_apply_v1',{preview:token(correction)});
  await api('instructor_payment_correct_v1',{payment_id:payment.primary_id,expected_version:payment.version,correction:{amount_minor:'50',currency:'TRY',occurred_at:new Date().toISOString(),direction:'decrease'},reason:'Synthetic G02 payment correction'});
  const net=(await earnings()).find(x=>x.id===earning.id);assert.equal(net.paid_minor,'100');assert.equal(net.overpaid_minor,'0');
  const filters={interval:{starts_at:date(-1)+'T00:00:00Z',ends_at:date(4)+'T00:00:00Z'},center_ids:[center]};
  const report=await api('report_get_v1',{report:'collections_debts',filters,page:{limit:200}});assert(report.rows.items.some(x=>x.group_key==='collections'&&x.person_id===person&&x.subscriber_number===number&&x.amount_minor==='1000'));assert(report.rows.items.some(x=>x.group_key==='outstanding_debt'&&x.person_id===person&&x.amount_minor==='0'));
  const payReport=await api('report_get_v1',{report:'earnings',filters,page:{limit:200}});assert(payReport.rows.items.some(x=>x.person_id===teacher.person&&x.group_key==='earning_accrual'&&x.amount_minor==='100'));
  const attendanceReport=await api('report_get_v1',{report:'lesson_attendance',filters,page:{limit:200}});assert(attendanceReport.rows.items.some(x=>x.person_id===person&&x.group_key==='attendance:no_show'&&x.count===1));
  const notices=await api('notifications_list_v1',{page:{limit:200,sort:'created_at_asc'},unread_only:false},key(),student);assert(notices.items.some(x=>x.kind==='reservation_create_v1'&&x.payload.subject.id===reservation));
  const exported=await api('report_export_start_v1',{report:'collections_debts',filters,format:'csv'});await drain();const descriptor=await api('report_file_get_v1',{job_id:exported.job_id});
  const download=await fetch(context().env.API_URL+descriptor.download_path,{method:'POST',headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},body:JSON.stringify(f.scope({client_api_version:1,request_id:key(),operation_key:key(),job_id:exported.job_id}))});assert(download.ok);const output=await download.text();assert(output.includes('subscriber_number'));assert(output.split('\r\n').some(row=>row.includes(person)&&row.includes('"'+number+'"')&&row.includes('"1000"')));
  assert.equal((await api('person_get_v1',{person_id:person})).subscriber_number,number);assert.equal((await db.query('select source_sale_id from core.reservations where id=$1',[reservation])).rows[0].source_sale_id,sale);
 }finally{if(worker)await worker.end();await db.query('delete from private.p06_worker_scopes where db_role=$1',[role]);await db.query(`drop role if exists "${role}"`);await db.end();}
});
