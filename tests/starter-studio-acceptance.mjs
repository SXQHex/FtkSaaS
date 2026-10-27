import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {createHash} from 'node:crypto';
import {deliverDevInvitation} from '../scripts/deliver-dev-invitations.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

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
   assert.equal((await rows('select count(*)::int n from core.policy_versions where org_id=$1',[org]))[0].n,3);
   const read=await mut('policies_get_v1',{keys:['negative_default','reservation_window']});
   assert.equal(read.length,1);assert.equal(read[0].key,'negative_default');assert.deepEqual(read[0].value,{kind:'integer',value:0});assert.equal(read[0].scope.kind,'organization');
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
