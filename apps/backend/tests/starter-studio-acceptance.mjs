import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {createHash} from 'node:crypto';
import {deliverDevInvitation} from '../scripts/deliver-dev-invitations.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {preparationFixture} from './starter-preparation-fixture.mjs';

test('Starter studio setup: one room, timed sales and immutable published names',{timeout:300000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('studio-owner'),student=await authUser('studio-student');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 let org,center,discipline,room,person,studentPerson;
 const scope=b=>({org_id:org,center_id:center,...b});
 const mut=(op,b={},k=key(),actor=owner)=>must(actor,op,scope(b),k);
 const reject=async(op,b,code,k=key())=>{const r=await call(owner,op,scope(b),k);assert.equal(r.result.ok,false,op);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const token=p=>({id:p.id,token:p.token});
 const day=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const at=h=>day(1)+'T'+String(h).padStart(2,'0')+':00:00Z';
 const terms=(name,extra={})=>({name,kind:'timed',booking_mode:'flexible',price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}],...extra});
 const publish=(name,extra={},product_id)=>mut('product_publish_v1',{...(product_id?{product_id}:{}),terms:terms(name,extra)});
 const sell=async version=>{const p=await mut('sale_preview_v1',{person_id:studentPerson,product_version_id:version,start_date:day(-30),end_date:day(30)});const s=await mut('sale_apply_v1',{preview:token(p)});const debts=await rows('select id from core.debts where org_id=$1 and sale_id=$2',[org,s.primary_id]);assert.equal(debts.length,1);await mut('collection_record_v1',{person_id:studentPerson,debt_ids:debts.map(x=>x.id),amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});return s.primary_id;};
 const session=(hour,capacity=5,extra={})=>mut('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:at(hour),ends_at:at(hour+1)},resources:[{kind:'room',id:room}],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:capacity},...extra});
 const book=(sid,sale,k=key(),actor=student)=>mut('reservation_create_v1',{session_id:sid,person_id:studentPerson,mode:'flexible',source_sale_id:sale},k,actor);
 let creditVersion,creditProduct,creditSale,timedSale,unlimitedSale,groupSession,smallSession,quotaReservations=[],unlimitedReservations=[];
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1');
  const creationKey=key(),creationBody={verified_account_id:account.id,name:'Synthetic Starter studio',initial_plan_id:plan};
  org=(await must(platform,'organization_create_v1',creationBody,creationKey)).primary_id;
  center=(await mut('center_create_v1',{name:'Only center',timezone:'UTC'})).primary_id;
  person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await mut('center_manager_assign_v1',{person_id:person});
  const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC ACCEPTANCE ONLY',occurred_at:new Date().toISOString()});
  await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
  discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;
  await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  await mut('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  room=(await mut('room_save_v1',{name:'Only logical room',capacity:50})).primary_id;
  for(const resource of [{kind:'room',id:room},{kind:'person',id:person}])await mut('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
  const policy=(key,value)=>mut('policy_publish_v1',{center_id:null,key,value,effective_at:new Date().toISOString(),mandatory:false});
  await t.test('new Starter inherits the approved zero credit default; unconfigured policies and center overrides stay closed',async()=>{
   assert.equal((await must(platform,'organization_create_v1',creationBody,creationKey)).primary_id,org);
   assert.equal((await rows('select count(*)::int n from core.policy_versions where org_id=$1',[org]))[0].n,4);
   const read=await mut('policies_get_v1',{keys:['negative_default']});
   assert.equal(read.length,1);assert.equal(read[0].key,'negative_default');assert.deepEqual(read[0].value,{kind:'integer',value:0});assert.equal(read[0].scope.kind,'organization');
   const window=await mut('policies_get_v1',{keys:['reservation_window']});assert.equal(window.length,1);assert.deepEqual(window[0].value,{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});assert.equal(window[0].scope.kind,'organization');assert.equal(window[0].version,1);
   const debt=await mut('policies_get_v1',{keys:['debt_booking','debt_participation']});assert.equal(debt.length,2);assert(debt.every(p=>p.value.kind==='boolean'&&p.value.value===true&&p.scope.kind==='organization'));
   const denied=await call(owner,'policy_publish_v1',scope({key:'negative_default',value:{kind:'integer',value:3},effective_at:new Date().toISOString(),mandatory:false}),key());
   assert.equal(denied.result.ok,false);assert.equal(denied.result.error.code,'PLAN_FEATURE_UNAVAILABLE');
   const again=await mut('policies_get_v1',{keys:['negative_default']});assert.deepEqual(again,read);
  });
  await policy('negative_upper',{kind:'integer',value:0});
  await policy('participation_block_credit',{kind:'blocked_credit',effect:'release'});
  await policy('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  await policy('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
  studentPerson=(await mut('person_create_v1',{display_name:'Synthetic studio member',contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:studentPerson});
  const studentAccount=await must(student,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,studentAccount.id,studentPerson]);
  await t.test('recurring class has capacity 40; same logical room rejects overlap and supports capacity 5 later',async()=>{
   const c=(await mut('class_save_v1',{name:'Recurring Yoga',discipline_id:discipline,external_open:true})).primary_id;
   const p=await mut('program_preview_v1',{class_id:c,schedule:{room_id:room,weekdays:[1,2,3,4,5,6,7],local_start:'09:00:00',duration_minutes:60,starts_on:day(1),ends_on:day(3),assignments:[{person_id:person,duty:'instructor'}],capacity:{total:40}}});
   assert.deepEqual(p.blockers,[]);assert.equal(p.sessions.length,2);
   const op=key();await mut('program_apply_v1',{preview:token(p)},op);assert.equal((await mut('program_apply_v1',{preview:token(p)},op)).replayed,true);
   const s=await rows('select id,nominal from core.sessions where org_id=$1 and class_id=$2 order by starts_at',[org,c]);assert.equal(s.length,2);assert(s.every(x=>Number(x.nominal)===40));groupSession=s[0].id;
   await reject('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:day(1)+'T09:30:00Z',ends_at:day(1)+'T10:30:00Z'},resources:[{kind:'room',id:room}],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:5}},'RESOURCE_CONFLICT');
   smallSession=(await session(11,5,{format:'private'})).primary_id;
   assert.equal(Number((await rows('select nominal from core.sessions where id=$1',[smallSession]))[0].nominal),5);
   assert.equal(Number((await rows('select capacity from core.rooms where id=$1',[room]))[0].capacity),50);
   await reject('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:at(19),ends_at:at(20)},resources:[{kind:'room',id:room}],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:51}},'CAPACITY_FULL');
  });
  await t.test('Starter public intent becomes an invited self-booking student without CRM, management role or automatic sale',async()=>{
   const publicSession=(await session(20)).primary_id;
   const newcomer=await authUser('studio-public-student'),pub=(await mut('publication_set_v1',{session_id:publicSession,published:true,public_details:{title:'Synthetic Yoga',venue_public_label:'Synthetic public venue',fee_minor:'1000',currency:'TRY',public_conditions:'Application only; no seat reserved'}})).primary_id;
   const {env}=context(),anon={jwt:env.ANON_KEY};
   const calendar=await must(anon,'public_calendar_get_v1',{slug:org,interval:{starts_at:at(19),ends_at:at(22)},page:{}});
   assert.equal(calendar.items.length,1);assert.equal(calendar.items[0].publication_id,pub);
   assert(!JSON.stringify(calendar).includes(newcomer.email));
   const request={client_api_version:1,request_id:key(),publication_id:pub,contact:newcomer.email,bot_proof:'synthetic-provider-proof',client_request_key:key()};
   const missing=await call(anon,'public_application_submit_v1',request);assert.equal(missing.result.ok,false);assert.equal(missing.result.error.code,'SERVICE_UNAVAILABLE');
   // Native local DB only: emulate the Edge-owned verified context. This is not
   // a real widget/siteverify acceptance; ingress/provider contracts are separate tests.
   const rpc=async(aux={})=>{await db.query("select set_config('request.jwt.claim.role','service_role',false)");return (await rows('select api_v1.public_application_submit_v1($1,null,null,$2,$3) result',[request,Array.from({length:64},key),{ip_hash:createHash('sha256').update('synthetic-public-ip').digest('hex'),target_hash:createHash('sha256').update(newcomer.email).digest('hex'),phase:'submit',bot_verified:true,...aux}]))[0].result;};
   assert.equal((await rpc({bot_verified:false})).error.code,'BOT_VERIFICATION_FAILED');
   assert.equal((await rpc()).ok,true);assert.deepEqual((await rpc()).data,{accepted:true});
   assert.equal((await rows('select count(*)::int n from core.public_applications where org_id=$1',[org]))[0].n,1);
   assert.equal((await rows('select count(*)::int n from core.people where org_id=$1 and display_name=$2',[org,newcomer.email]))[0].n,0);
   const application=(await rows('select id from core.public_applications where org_id=$1',[org]))[0].id;
   await mut('public_application_review_v1',{application_id:application,action:'create_candidate'});
   const target=(await rows('select person_id from core.public_applications where id=$1',[application]))[0].person_id;
   for(const table of ['leads','sales','reservations'])assert.equal((await rows('select count(*)::int n from core.'+table+' where org_id=$1 and person_id=$2',[org,target]))[0].n,0);
   await mut('student_activate_v1',{person_id:target});
   await must(newcomer,'account_get_v1');const invite=await mut('account_access_send_v1',{person_id:target});await deliverDevInvitation(invite.job_id);
   const messages=await(await fetch(env.MAILPIT_URL+'/api/v1/messages')).json(),message=messages.messages.find(m=>m.To.some(a=>a.Address===newcomer.email));assert(message);
   const detail=await(await fetch(env.MAILPIT_URL+'/api/v1/message/'+message.ID)).json(),token=detail.Text.match(/Token: ([a-f0-9]{64})/)[1];
   const wrong=await call(student,'account_access_accept_v1',{token},key());assert.equal(wrong.result.ok,false);assert.equal(wrong.result.error.code,'INVITATION_UNAVAILABLE');
   await must(newcomer,'account_access_accept_v1',{token},key());
   assert.equal((await rows('select count(*)::int n from core.role_assignments where org_id=$1 and person_id=$2',[org,target]))[0].n,0);
   const v=(await publish('Yoga · public onboarding',{kind:'credits',credits:1})).primary_id;
   const preview=await mut('sale_preview_v1',{person_id:target,product_version_id:v,start_date:day(-1),end_date:day(30)}),sale=(await mut('sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
   const blocked=await call(newcomer,'reservation_create_v1',scope({session_id:publicSession,person_id:target,mode:'flexible',source_sale_id:sale}),key());assert.equal(blocked.result.ok,false);assert.equal(blocked.result.error.code,'FORBIDDEN');
   const debts=await rows('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale]);await mut('collection_record_v1',{person_id:target,debt_ids:debts.map(x=>x.id),amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});
   const booking=await mut('reservation_create_v1',{session_id:publicSession,person_id:target,mode:'flexible',source_sale_id:sale},key(),newcomer);assert(booking.primary_id);
   const forbidden=await call(newcomer,'policies_get_v1',scope({keys:[]}));assert.equal(forbidden.result.ok,false);assert.equal(forbidden.result.error.code,'FORBIDDEN');
   await reject('lead_save_v1',{person_id:target,source:'public_application',interest:'Synthetic'},'PLAN_FEATURE_UNAVAILABLE');
   await mut('publication_set_v1',{session_id:publicSession,published:false,expected_version:1});assert.equal((await rpc()).error.code,'SERVICE_UNAVAILABLE');
  });
  await t.test('credits, quota timed and unlimited timed products all sell in a real Starter subscription',async()=>{
   creditVersion=(await publish('Yoga · 4 lessons',{kind:'credits',credits:4})).primary_id;
   creditProduct=(await rows('select product_id from core.product_versions where id=$1',[creditVersion]))[0].product_id;
   creditSale=await sell(creditVersion);const limited=(await publish('Yoga · 2 per week',{quota:{period:'week',limit:2}})).primary_id;timedSale=await sell(limited);
   const unlimited=(await publish('Yoga · unlimited')).primary_id;unlimitedSale=await sell(unlimited);
   const catalog=await mut('products_list_v1',{include_timed_products:true,page:{limit:20}});assert.equal(catalog.items.length,4);assert.equal(catalog.items.filter(x=>x.terms.kind==='timed').length,2);
   assert.equal((await rows('select count(*)::int n from core.sales where org_id=$1',[org]))[0].n,4);
  });
 }finally{await db.end();}
});

test('G01 same offline Starter learner keeps number, consent, paid sale and corrected attendance in reports',{timeout:300000},async t=>{
 const f=await preparationFixture({schedule:true}),{db,org,center,owner,api,discipline,day}=f;
 t.after(()=>db.end());
 const token=p=>({id:p.id,token:p.token});
 const person=(await api('person_create_v1',{display_name:'Synthetic G01 offline learner',contacts:[]})).primary_id;
 const lead=(await api('lead_save_v1',{person_id:person,source:'phone',interest:'Synthetic Yoga'})).primary_id;
 await api('crm_activity_save_v1',{lead_id:lead,kind:'contact',note:'Synthetic call note'});
 await api('crm_activity_save_v1',{lead_id:lead,kind:'followup',due_at:day(2)+'T08:00:00Z',note:'Synthetic callback'});
 assert.equal((await api('person_get_v1',{person_id:person})).subscriber_number,null);
 await api('student_activate_v1',{person_id:person});
 const number=(await api('person_get_v1',{person_id:person})).subscriber_number;
 assert.equal(number,'1001');
 assert.equal((await db.query('select count(*)::int n from core.account_links where org_id=$1 and person_id=$2',[org,person])).rows[0].n,0);
 const student=await authUser('g01-self'),account=await must(student,'account_get_v1');
 // Explicit native link fixture comes after offline activation and number allocation.
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,person]);
 const version=(await api('product_publish_v1',{terms:{name:'Yoga · G01 two lessons',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
 const content={name:'Synthetic G01 consent',language:'tr',template_id:'synthetic-g01',template_version:'1',text:'Synthetic acceptance fixture terms.\n'};
 const document=(await api('document_version_publish_v1',{digital_content:content,version_label:'g01-v1',scope:{kind:'center',center_id:center},requirements:[{gate:'sale',scope:{center_ids:[center]},renewed_acceptance:true}]})).primary_id;
 const saleBody={person_id:person,product_version_id:version,start_date:day(0),end_date:day(30)},blocked=await api('sale_preview_v1',saleBody);
 assert(blocked.blockers.some(x=>x.code==='DOCUMENT_REQUIRED'));
 const context={gate:'sale',subject:{type:'product_versions',id:version},purchase_preview_id:blocked.id};
 const requirement=(await api('document_requirements_get_v1',{context},student)).find(x=>x.version_id===document);
 assert(requirement&&!requirement.accepted);
 const shown=(await api('document_requirements_get_v1',{context,content_file_id:requirement.file.id},student)).find(x=>x.version_id===document);
 assert.deepEqual(shown.digital_content,content);
 const consent=await api('document_accept_v1',{document_version_id:document,context,rendered_document_id:shown.rendered_document.id},student);
 const quote=await api('sale_preview_v1',{...saleBody,document_purchase_id:blocked.id});
 assert.deepEqual(quote.blockers,[]);
 const sale=(await api('sale_apply_v1',{preview:token(quote)})).primary_id;
 for(const [operation,body] of [
  ['freeze_preview_v1',{sale_id:sale,dates:{start_date:day(1),end_date:day(2)},reason:'Synthetic Starter F17 gate'}],
  ['sale_change_preview_v1',{sale_id:sale,new_product_version_id:version,keep_reservation_ids:[],cancel_reservation_ids:[],start_date:day(0),end_date:day(30),reason:'Synthetic Starter F17 gate'}]
 ]){
  const refused=await call(owner,operation,f.scoped(body));
  assert.equal(refused.result.error?.code,'PLAN_FEATURE_UNAVAILABLE',JSON.stringify({ok:refused.result.ok,error:refused.result.error}));
  assert.equal(refused.result.data,undefined);
 }
 const changeBody={sale_id:sale,new_product_version_id:version,keep_reservation_ids:[],cancel_reservation_ids:[],start_date:day(0),end_date:day(30),reason:'Synthetic G01 preview before plan loss'};
 let priorPreview;
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[f.plan]);
 try{priorPreview=await api('sale_change_preview_v1',changeBody);}
 finally{await db.query("update core.saas_plan_versions set name='starter' where id=$1",[f.plan]);}
 for(const [operation,body] of [
  ['sale_change_apply_v1',{preview:token(priorPreview)}],
  ['management_state_get_v1',{operation:'sale_change_preview_v1',selector:{operation:'sale_change_preview_v1',key:{sale_id:sale}},page:{}}]
 ]){
  const refused=await call(owner,operation,f.scoped(body),key());
  assert.equal(refused.result.error?.code,'PLAN_FEATURE_UNAVAILABLE',JSON.stringify({ok:refused.result.ok,error:refused.result.error}));
  assert.equal(refused.result.data,undefined);
 }
 assert.equal((await db.query('select count(*)::int n from core.sales where org_id=$1',[org])).rows[0].n,1);
 const debt=(await db.query('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale])).rows[0].id;
 const collectionKey=key(),collectionBody={person_id:person,debt_ids:[debt],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString(),payment:{method:'cash'}};
 await api('collection_record_v1',collectionBody,owner,collectionKey);
 assert.equal((await api('collection_record_v1',collectionBody,owner,collectionKey)).replayed,true);
 await api('policy_publish_v1',{center_id:null,key:'student_cancel_group',value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}},effective_at:new Date().toISOString(),mandatory:false});
 await api('class_save_v1',{class_id:f.classId,expected_version:1,name:'Synthetic G01 open Yoga',discipline_id:discipline,external_open:true});
 const program=await f.preview('09');assert.deepEqual(program.blockers,[]);
 await api('program_apply_v1',{preview:token(program)});
 const session=(await db.query('select id from core.sessions where org_id=$1 and class_id=$2',[org,f.classId])).rows[0].id;
 const reservation=(await api('reservation_create_v1',{session_id:session,person_id:person,source_sale_id:sale,mode:'flexible'},student)).primary_id;
 let attendance=await api('attendance_get_v1',{session_id:session});
 assert.equal(attendance.entries.find(x=>x.reservation_id===reservation).subscriber_number,number);
 await api('attendance_start_v1',{session_id:session,expected_version:attendance.session_version,actual_started_at:new Date().toISOString(),reason:'Synthetic G01 observed early start'});
 attendance=await api('attendance_get_v1',{session_id:session});
 await api('attendance_mark_v1',{reservation_id:reservation,expected_version:attendance.entries.find(x=>x.reservation_id===reservation).version,result:'attended'});
 attendance=await api('attendance_get_v1',{session_id:session});
 const closeKey=key(),closeBody={session_id:session,expected_version:attendance.session_version};
 await api('attendance_close_v1',closeBody,owner,closeKey);
 assert.equal((await api('attendance_close_v1',closeBody,owner,closeKey)).replayed,true);
 const allocation=()=>db.query('select state from core.entitlement_allocations where org_id=$1 and reservation_id=$2',[org,reservation]);
 assert.equal((await allocation()).rows[0].state,'consumed');
 const correction=await api('attendance_correct_preview_v1',{session_id:session,corrections:[{reservation_id:reservation,result:'no_show'}],reason:'Synthetic G01 corrected attendance'});
 assert.deepEqual(correction.blockers,[]);
 await api('attendance_correct_apply_v1',{preview:token(correction)});
 assert.equal((await allocation()).rows[0].state,'released');
 const filters={interval:{starts_at:day(-1)+'T00:00:00Z',ends_at:day(4)+'T00:00:00Z'},center_ids:[center],person_ids:[person]};
 const report=await api('report_get_v1',{report:'collections_debts',filters,page:{limit:200}});
 assert(report.rows.items.some(x=>x.group_key==='collections'&&x.person_id===person&&x.subscriber_number===number&&x.amount_minor==='1000'));
 assert.equal(report.totals.find(x=>x.group_key==='outstanding_debt').amount_minor,'0');
 const attendanceReport=await api('report_get_v1',{report:'lesson_attendance',filters,page:{limit:200}});
 assert(attendanceReport.rows.items.some(x=>x.person_id===person&&x.subscriber_number===number&&x.group_key==='attendance:no_show'&&x.count===1));
 assert.equal((await api('person_get_v1',{person_id:person})).subscriber_number,number);
 const evidence=(await api('document_requirements_get_v1',{context,content_file_id:requirement.file.id},student)).find(x=>x.version_id===document).digital_acceptance;
 assert.equal(evidence.id,consent.primary_id);assert.equal(evidence.person_id,person);
 assert.equal((await db.query('select source_sale_id from core.reservations where id=$1',[reservation])).rows[0].source_sale_id,sale);
 for(const table of ['earnings','instructor_agreements'])assert.equal((await db.query('select count(*)::int n from core.'+table+' where org_id=$1',[org])).rows[0].n,0);
});

// Attendance owns an independent Starter fixture; setup/catalog assertions above
// keep their original native root and deadline instead of sharing one long budget.
test('Starter attendance: credit and timed memberships survive discipline rename',{timeout:300000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('studio-attendance-owner'),student=await authUser('studio-attendance-student');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 let org,center,discipline,room,person,studentPerson;
 const scope=b=>({org_id:org,center_id:center,...b});
 const mut=(op,b={},k=key(),actor=owner)=>must(actor,op,scope(b),k);
 const token=p=>({id:p.id,token:p.token});
 const day=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const at=h=>day(1)+'T'+String(h).padStart(2,'0')+':00:00Z';
 const terms=(name,extra={})=>({name,kind:'timed',booking_mode:'flexible',price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}],...extra});
 const publish=(name,extra={})=>mut('product_publish_v1',{terms:terms(name,extra)});
 const sell=async version=>{const p=await mut('sale_preview_v1',{person_id:studentPerson,product_version_id:version,start_date:day(-30),end_date:day(30)});const s=await mut('sale_apply_v1',{preview:token(p)});const debts=await rows('select id from core.debts where org_id=$1 and sale_id=$2',[org,s.primary_id]);assert.equal(debts.length,1);await mut('collection_record_v1',{person_id:studentPerson,debt_ids:debts.map(x=>x.id),amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});return s.primary_id;};
 const session=hour=>mut('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:at(hour),ends_at:at(hour+1)},resources:[{kind:'room',id:room}],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:5}});
 const book=(sid,sale)=>mut('reservation_create_v1',{session_id:sid,person_id:studentPerson,mode:'flexible',source_sale_id:sale},key(),student);
 let groupSession,oldCreditReservation,quotaReservations=[],unlimitedReservations=[];
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic Starter attendance',initial_plan_id:plan},key())).primary_id;
  center=(await mut('center_create_v1',{name:'Attendance center',timezone:'UTC'})).primary_id;
  person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await mut('center_manager_assign_v1',{person_id:person});
  const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC ACCEPTANCE ONLY',occurred_at:new Date().toISOString()});
  await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
  discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;
  await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  await mut('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  room=(await mut('room_save_v1',{name:'Attendance room',capacity:50})).primary_id;
  for(const resource of [{kind:'room',id:room},{kind:'person',id:person}])await mut('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
  const policy=(key,value)=>mut('policy_publish_v1',{center_id:null,key,value,effective_at:new Date().toISOString(),mandatory:false});
  await policy('negative_upper',{kind:'integer',value:0});
  await policy('participation_block_credit',{kind:'blocked_credit',effect:'release'});
  await policy('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  await policy('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
  studentPerson=(await mut('person_create_v1',{display_name:'Synthetic attendance member',contacts:[]})).primary_id;
  await mut('student_activate_v1',{person_id:studentPerson});
  const studentAccount=await must(student,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,studentAccount.id,studentPerson]);
  const creditVersion=(await publish('Yoga · 4 lessons',{kind:'credits',credits:4})).primary_id;
  const timedVersion=(await publish('Yoga · 2 per week',{quota:{period:'week',limit:2}})).primary_id;
  const unlimitedVersion=(await publish('Yoga · unlimited')).primary_id;
  const creditSale=await sell(creditVersion),timedSale=await sell(timedVersion),unlimitedSale=await sell(unlimitedVersion);
  groupSession=(await session(9)).primary_id;oldCreditReservation=(await book(groupSession,creditSale)).primary_id;
  const quotaSession=(await session(12)).primary_id;quotaReservations=[{sid:quotaSession,rid:(await book(quotaSession,timedSale)).primary_id}];
  const unlimitedSession=(await session(15)).primary_id;unlimitedReservations=[{sid:unlimitedSession,rid:(await book(unlimitedSession,unlimitedSale)).primary_id}];
  const creditProduct=(await rows('select product_id from core.product_versions where id=$1',[creditVersion]))[0].product_id;
  await mut('product_publish_v1',{product_id:creditProduct,terms:terms('Yoga · renamed 4 lessons',{kind:'credits',credits:4})});
  await must(owner,'discipline_save_v1',{org_id:org,discipline_id:discipline,expected_version:1,name:'Flow',state:'active'},key());
  await mut('product_publish_v1',{product_id:creditProduct,terms:terms('Flow · 4 lessons',{kind:'credits',credits:4})});
  await t.test('credit and both timed memberships close attendance atomically without an agreement or earning after rename',async()=>{
   const entries=[{sid:groupSession,rid:oldCreditReservation},quotaReservations[0],unlimitedReservations[0]];
   let n=0;
   for(const e of entries){const starts=new Date(Date.now()-86400000*(++n));starts.setUTCHours(6,0,0,0);await db.query('update core.sessions set starts_at=$1,ends_at=$2 where id=$3',[starts,new Date(+starts+3600000),e.sid]);await db.query("update core.resource_bookings set starts_at=$1,ends_at=$2 where session_id=$3 and state='active'",[starts,new Date(+starts+3600000),e.sid]);
    let v=await mut('attendance_get_v1',{session_id:e.sid});await mut('attendance_mark_v1',{reservation_id:e.rid,expected_version:v.entries.find(x=>x.reservation_id===e.rid).version,result:'attended'});
    assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[e.rid]))[0].state,'reserved');
    v=await mut('attendance_get_v1',{session_id:e.sid});const k=key(),b={session_id:e.sid,expected_version:v.session_version};await mut('attendance_close_v1',b,k);assert.equal((await mut('attendance_close_v1',b,k)).replayed,true);
    assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[e.rid]))[0].state,'consumed');
   }
   for(const table of ['instructor_agreements','earnings'])assert.equal((await rows('select count(*)::int n from core.'+table+' where org_id=$1',[org]))[0].n,0);
  });
 }finally{await db.end();}
});

// Booking/version/rollback checks use their own paid-rights fixture and budget.
test('Starter bookings: quota, immutable names and publication rollback',{timeout:300000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('studio-booking-owner'),student=await authUser('studio-booking-student');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 let org,center,discipline,room,person,studentPerson;
 const scope=b=>({org_id:org,center_id:center,...b});
 const mut=(op,b={},k=key(),actor=owner)=>must(actor,op,scope(b),k);
 const reject=async(op,b,code,k=key())=>{const r=await call(owner,op,scope(b),k);assert.equal(r.result.ok,false,op);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const token=p=>({id:p.id,token:p.token});
 const day=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const at=h=>day(1)+'T'+String(h).padStart(2,'0')+':00:00Z';
 const terms=(name,extra={})=>({name,kind:'timed',booking_mode:'flexible',price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}],...extra});
 const publish=(name,extra={},product_id)=>mut('product_publish_v1',{...(product_id?{product_id}:{}),terms:terms(name,extra)});
 const sell=async version=>{const p=await mut('sale_preview_v1',{person_id:studentPerson,product_version_id:version,start_date:day(-30),end_date:day(30)});const s=await mut('sale_apply_v1',{preview:token(p)});const debts=await rows('select id from core.debts where org_id=$1 and sale_id=$2',[org,s.primary_id]);assert.equal(debts.length,1);await mut('collection_record_v1',{person_id:studentPerson,debt_ids:debts.map(x=>x.id),amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});return s.primary_id;};
 const session=hour=>mut('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:at(hour),ends_at:at(hour+1)},resources:[{kind:'room',id:room}],assignments:[{person_id:person,duty:'instructor'}],capacity:{total:5}});
 const book=(sid,sale)=>mut('reservation_create_v1',{session_id:sid,person_id:studentPerson,mode:'flexible',source_sale_id:sale},key(),student);
 let groupSession,creditVersion,creditProduct,creditSale,timedSale,unlimitedSale,quotaReservations=[],unlimitedReservations=[];
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic Starter bookings',initial_plan_id:plan},key())).primary_id;
  center=(await mut('center_create_v1',{name:'Attendance center',timezone:'UTC'})).primary_id;
  person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await mut('center_manager_assign_v1',{person_id:person});
  const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC ACCEPTANCE ONLY',occurred_at:new Date().toISOString()});
  await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
  discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;
  await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  await mut('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  room=(await mut('room_save_v1',{name:'Attendance room',capacity:50})).primary_id;
  for(const resource of [{kind:'room',id:room},{kind:'person',id:person}])await mut('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
  const policy=(key,value)=>mut('policy_publish_v1',{center_id:null,key,value,effective_at:new Date().toISOString(),mandatory:false});
  await policy('negative_upper',{kind:'integer',value:0});
  await policy('participation_block_credit',{kind:'blocked_credit',effect:'release'});
  await policy('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  await policy('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
  studentPerson=(await mut('person_create_v1',{display_name:'Synthetic attendance member',contacts:[]})).primary_id;
  await mut('student_activate_v1',{person_id:studentPerson});
  const studentAccount=await must(student,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,studentAccount.id,studentPerson]);
  creditVersion=(await publish('Yoga · 4 lessons',{kind:'credits',credits:4})).primary_id;
  creditProduct=(await rows('select product_id from core.product_versions where id=$1',[creditVersion]))[0].product_id;
  const timedVersion=(await publish('Yoga · 2 per week',{quota:{period:'week',limit:2}})).primary_id;
  const unlimitedVersion=(await publish('Yoga · unlimited')).primary_id;
  creditSale=await sell(creditVersion);timedSale=await sell(timedVersion);unlimitedSale=await sell(unlimitedVersion);
  groupSession=(await session(9)).primary_id;
  let oldCreditReservation;
  await t.test('self reservation uses paid credit and timed quota; unlimited membership is not a one-credit package',async()=>{
   oldCreditReservation=(await book(groupSession,creditSale)).primary_id;
   const q1=(await session(12)).primary_id,q2=(await session(13)).primary_id,q3=(await session(14)).primary_id;
   quotaReservations=[{sid:q1,rid:(await book(q1,timedSale)).primary_id},{sid:q2,rid:(await book(q2,timedSale)).primary_id}];
   const denied=await call(student,'reservation_create_v1',scope({session_id:q3,person_id:studentPerson,mode:'flexible',source_sale_id:timedSale}),key());assert.equal(denied.result.ok,false);assert.equal(denied.result.error.code,'CREDIT_LIMIT_EXCEEDED');
   for(const h of [15,16,17]){const sid=(await session(h)).primary_id;unlimitedReservations.push({sid,rid:(await book(sid,unlimitedSale)).primary_id});}
   const rights=await mut('entitlements_get_v1',{person_id:studentPerson,include_timed_rights:true});assert(rights.some(x=>x.sale_id===timedSale));assert(rights.some(x=>x.sale_id===unlimitedSale));
  });
  await t.test('republishing and discipline rename preserve old sale/version while requiring the new prefix',async()=>{
   const before=(await rows('select row_to_json(s) snapshot from core.sales s where id=$1',[creditSale]))[0].snapshot;
   const next=(await publish('Yoga · renamed 4 lessons',{kind:'credits',credits:4},creditProduct)).primary_id;
   assert.notEqual(next,creditVersion);
   assert.equal((await rows('select private.catalog_terms($1,$2,$3) value',[org,creditProduct,creditVersion]))[0].value.name,'Yoga · 4 lessons');
   await must(owner,'discipline_save_v1',{org_id:org,discipline_id:discipline,expected_version:1,name:'Flow',state:'active'},key());
   await reject('product_publish_v1',{product_id:creditProduct,terms:terms('Yoga · stale prefix',{kind:'credits',credits:4})},'VALIDATION_FAILED');
   const current=(await publish('Flow · 4 lessons',{kind:'credits',credits:4},creditProduct)).primary_id;
   const catalog=await mut('products_list_v1',{include_timed_products:true,page:{limit:20}});assert.equal(catalog.items.find(x=>x.id===creditProduct).terms.name,'Flow · 4 lessons');
   const historic=(await rows('select private.catalog_terms($1,$2,$3) value',[org,creditProduct,next]))[0].value;assert.equal(historic.name,'Yoga · renamed 4 lessons');
   assert.equal((await rows('select published_name from core.product_versions where id=$1',[current]))[0].published_name,'Flow · 4 lessons');
   await reject('sale_preview_v1',{person_id:studentPerson,product_version_id:creditVersion,start_date:day(0),end_date:day(30)},'PLAN_FEATURE_UNAVAILABLE');
   assert.deepEqual((await rows('select row_to_json(s) snapshot from core.sales s where id=$1',[creditSale]))[0].snapshot,before);
   await assert.rejects(db.query("update core.product_versions set published_name='Rewritten history' where id=$1",[creditVersion]),/INVALID_STATE_TRANSITION/);
   await book((await session(18)).primary_id,creditSale);
  });
  await t.test('late publication failure rolls back version and current label; same key safely retries',async()=>{
   const trigger='studio_'+key().replaceAll('-',''),op=key(),before=await rows('select id,published_name from core.product_versions where product_id=$1 order by id',[creditProduct]);
   const name=(await rows('select name from core.products where id=$1',[creditProduct]))[0].name;
   await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
   await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='product_publish_v1') execute function private."+trigger+'()');
   const b={product_id:creditProduct,terms:terms('Flow · after retry',{kind:'credits',credits:4})};
   try{await reject('product_publish_v1',b,'INTEGRITY_VIOLATION',op);assert.deepEqual(await rows('select id,published_name from core.product_versions where product_id=$1 order by id',[creditProduct]),before);assert.equal((await rows('select name from core.products where id=$1',[creditProduct]))[0].name,name);}
   finally{await db.query('drop trigger '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');}
   const published=await mut('product_publish_v1',b,op);assert.equal((await mut('product_publish_v1',b,op)).replayed,true);assert.equal((await rows('select published_name from core.product_versions where id=$1',[published.primary_id]))[0].published_name,b.terms.name);
  });
 }finally{await db.end();}
});
