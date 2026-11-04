import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call} from '../../api-client.mjs';
import {connect} from '../../../scripts/db.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';
async function attendanceFixture(t){
 const {platform}=await fixturePlatform(),owner=await authUser('starter-owner'),outsider=await authUser('starter-outsider');
 const db=await connect();t.after(()=>db.end());const rows=async(q,a=[])=>(await db.query(q,a)).rows;
 const contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
 const plan=key(),features=Object.entries(contract['x-contract'].feature_delivery).filter(([,f])=>f.plans.starter).map(([k])=>k);
 await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) values($1,'starter',now(),1000,'TRY','monthly',$2,$3)",[plan,{entries:[{key:'active_students',value:500},{key:'centers',value:1},{key:'instructors',value:50}]},features]);
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Starter acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Starter',timezone:'Europe/Istanbul'},key())).primary_id;
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));return r;};
 const person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 await mut('center_manager_assign_v1',{person_id:person});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic starter',occurred_at:new Date().toISOString()});
 await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Starter lesson',state:'active'},key())).primary_id;
 await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 async function linked(label,role){
  const p=(await mut('person_create_v1',{display_name:label,contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:p});
  const u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  const grant=role?await mut('role_assign_v1',{person_id:p,role,scope:{center_id:center}}):null;
  return {p,u,a,grant};
 }
 const student=await linked('starter-student'),instructor=await linked('starter-instructor','instructor');
 await mut('availability_save_v1',{resource:{kind:'person',id:instructor.p},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
 const room=(await mut('room_save_v1',{name:'Starter single room',capacity:50})).primary_id;
 await mut('availability_save_v1',{resource:{kind:'room',id:room},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
 let sessionIndex=0,pastSessionIndex=0;
 const syncFixtureBookings=async sid=>{
  // Keep every open reservation's resource evidence intact; each elapsed fixture gets its own day.
  await db.query("update core.resource_bookings b set starts_at=s.starts_at,ends_at=s.ends_at from core.sessions s where b.org_id=$1 and s.org_id=b.org_id and s.id=b.session_id and s.id=$2 and b.state='active'",[org,sid]);
 };
 const fixturePastSession=async sid=>{const start=new Date();start.setUTCHours(9,0,0,0);if(+start>=Date.now())start.setUTCDate(start.getUTCDate()-1);start.setUTCDate(start.getUTCDate()-pastSessionIndex++);await db.query('update core.sessions set starts_at=$1,ends_at=$2 where id=$3',[start,new Date(+start+3600000),sid]);await syncFixtureBookings(sid);};
 const effective_at=new Date(Date.now()-10000).toISOString();
 const publish=(k,value)=>mut('policy_publish_v1',{center_id:null,key:k,value,effective_at:new Date().toISOString(),mandatory:false});
 // This suite exercises explicit unpaid/negative-credit policy choices. Verify
 // the new-org defaults first, then configure this fixture through the real API.
 const defaults=await mut('policies_get_v1',{keys:['debt_booking','debt_participation']});assert.equal(defaults.length,2);assert(defaults.every(p=>p.value.value===true));
 await publish('debt_booking',{kind:'boolean',value:false});
 await publish('debt_participation',{kind:'boolean',value:false});
 await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});
 await publish('negative_default',{kind:'integer',value:2});await publish('negative_upper',{kind:'integer',value:2});
 await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
 await publish('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
 await publish('negative_valuation',{kind:'valuation',discipline_id:discipline,format:'group',amount_minor:'100',currency:'TRY'});
 const makeSession=async(extra={})=>{const start=new Date(Date.now()+86400000);const n=sessionIndex++;start.setUTCDate(start.getUTCDate()+Math.floor(n/6));start.setUTCHours(6+(n%6)*2,0,0,0);return mut('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:start.toISOString(),ends_at:new Date(+start+3600000).toISOString()},resources:[{kind:'room',id:room}],assignments:[{person_id:instructor.p,duty:'instructor'}],capacity:{total:8},...extra});};
 const book=(sid,p=student.p,k=key())=>mut('reservation_create_v1',{session_id:sid,person_id:p,mode:'flexible'},k);
 const get=sid=>must(owner,'attendance_get_v1',scope({session_id:sid}));
 const token=p=>({id:p.id,token:p.token});
 const preview=change=>must(owner,'reservation_impact_preview_v1',scope({change,reason:'Explicit impact approval'}));
 return {platform,owner,outsider,db,rows,contract,plan,features,account,org,center,scope,mut,fail,person,pay,discipline,linked,student,instructor,room,syncFixtureBookings,fixturePastSession,effective_at,publish,makeSession,book,get,token,preview};
}



test('Starter package ledger, paid daily journey and closure atomicity',async t=>{
 const {platform,owner,outsider,db,rows,contract,plan,features,account,org,center,scope,mut,fail,person,pay,discipline,linked,student,instructor,room,syncFixtureBookings,fixturePastSession,effective_at,publish,makeSession,book,get,token,preview}=await attendanceFixture(t);
 let sid,rid,impact;
 await t.test('package-backed closure and correction use the same entitlement ledger',async()=>{
  const p=await linked('package-student');
  const product=(await mut('product_publish_v1',{terms:{name:'Starter lesson · rights',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
  const pv=await must(owner,'sale_preview_v1',scope({person_id:p.p,product_version_id:product,start_date:'2026-01-01',end_date:'2027-01-01'}));
  const sale=(await mut('sale_apply_v1',{preview:token(pv)})).primary_id;
  const ses=(await makeSession()).primary_id,rv=(await mut('reservation_create_v1',{session_id:ses,person_id:p.p,source_sale_id:sale,mode:'flexible'})).primary_id;
  await fixturePastSession(ses);
  let v=await get(ses);await mut('attendance_mark_v1',{reservation_id:rv,expected_version:v.entries[0].version,result:'attended'});
  assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[rv]))[0].state,'reserved');
  v=await get(ses);await mut('attendance_close_v1',{session_id:ses,expected_version:v.session_version});
  assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[rv]))[0].state,'consumed');
  const correction=await must(owner,'attendance_correct_preview_v1',scope({session_id:ses,corrections:[{reservation_id:rv,result:'no_show'}],reason:'Package result correction'}));
  await mut('attendance_correct_apply_v1',{preview:token(correction)});
  assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[rv]))[0].state,'released');
 });
 await t.test('paid daily journey preserves money and rights through self-service races, closure and correction',async()=>{
  const learners=[await linked('daily-one'),await linked('daily-two')];
  const date=offset=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
  const cls=(await mut('class_save_v1',{name:'Daily Starter class',discipline_id:discipline,external_open:true})).primary_id;
  const weekdays=[2,3,4].map(offset=>{const d=new Date(date(offset)+'T00:00:00Z');return d.getUTCDay()||7;});
  const program=await must(owner,'program_preview_v1',scope({class_id:cls,schedule:{room_id:room,weekdays,local_start:'22:00:00',duration_minutes:60,starts_on:date(2),ends_on:date(5),assignments:[{person_id:instructor.p,duty:'instructor'}],capacity:{total:1}}}));
  assert.deepEqual(program.blockers,[]);assert.equal(program.sessions.length,3);
  const programKey=key(),programBody={preview:token(program)};
  await mut('program_apply_v1',programBody,programKey);assert.equal((await mut('program_apply_v1',programBody,programKey)).replayed,true);
  const sessions=program.sessions.map(s=>s.session_id);
  const product=(await mut('product_publish_v1',{terms:{name:'Starter lesson · daily paid right',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
  const finance=async p=>{const view=await must(p.u,'finance_get_v1',scope({person_id:p.p,currency:'TRY',page:{}}));return {...view,movements:{items:view.movements.items,next_cursor:view.movements.next_cursor}};};
  const rights=async p=>(await must(p.u,'entitlements_get_v1',scope({person_id:p.p}))).find(e=>e.sale_id===p.sale);
  for(const p of learners){
   // Zero is this person's explicit limit, independent of the suite's two-credit default.
   const reason='Daily fixture uses purchased rights only',change={kind:'negative_limit',person_id:p.p,discipline_id:discipline,allowed_negative_credits:0};
   const impact=await must(owner,'reservation_impact_preview_v1',scope({change,reason}));
   assert.deepEqual(impact.affected,[]);
   const limits=await must(owner,'negative_limits_get_v1',scope({person_id:p.p,discipline_id:discipline}));
   await mut('negative_limit_set_v1',{person_id:p.p,discipline_id:discipline,allowed_negative_credits:0,reason,expected_version:limits.version,impact_approval:token(impact.preview),accepted_reservation_ids:[]});
   assert.equal((await must(owner,'negative_limits_get_v1',scope({person_id:p.p,discipline_id:discipline}))).effective_limit,0);
   const pv=await must(owner,'sale_preview_v1',scope({person_id:p.p,product_version_id:product,start_date:date(-90),end_date:date(14)}));
   p.sale=(await mut('sale_apply_v1',{preview:token(pv)})).primary_id;
   const debt=await finance(p);assert.equal(debt.debts.reduce((n,d)=>n+BigInt(d.remaining_minor),0n),1000n);
   const body={person_id:p.p,amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString(),debt_ids:debt.debts.map(d=>d.id),payment:{method:'bank_transfer',reference:'SYNTHETIC DAILY COLLECTION'}},k=key();
   p.collection=(await mut('collection_record_v1',body,k)).primary_id;assert.equal((await mut('collection_record_v1',body,k)).replayed,true);
   p.paid=await finance(p);assert(p.paid.debts.every(d=>d.remaining_minor==='0'));assert.equal(p.paid.movements.items.filter(m=>m.id===p.collection).length,1);
   assert.deepEqual(p.paid.movements.items.find(m=>m.id===p.collection).payment,body.payment);
   assert.equal((await rights(p)).available,1);
  }
  const request=(p,session_id)=>({session_id,person_id:p.p,source_sale_id:p.sale,mode:'flexible'});
  const compete=await Promise.all(learners.map(p=>call(p.u,'reservation_create_v1',scope(request(p,sessions[0])),key())));
  assert.equal(compete.filter(r=>r.result.ok).length,1);assert.equal(compete.find(r=>!r.result.ok).result.error.code,'CAPACITY_FULL');
  const winner=learners[compete.findIndex(r=>r.result.ok)],loser=learners.find(p=>p!==winner),reservation=compete.find(r=>r.result.ok).result.data;
  const lastRight=await Promise.all(sessions.slice(1).map(s=>call(loser.u,'reservation_create_v1',scope(request(loser,s)),key())));
  assert.equal(lastRight.filter(r=>r.result.ok).length,1);assert.equal(lastRight.find(r=>!r.result.ok).result.error.code,'CREDIT_LIMIT_EXCEEDED');
  const otherReservation=lastRight.find(r=>r.result.ok).result.data,emptySession=sessions.slice(1)[lastRight.findIndex(r=>!r.result.ok)];
  for(const p of learners){const e=await rights(p);assert.equal(e.available,0);assert.equal(e.reserved,1);assert.equal(e.consumed,0);assert.equal(e.deficit,0);}
  await fail('reservation_create_v1',request(winner,emptySession),'CREDIT_LIMIT_EXCEEDED',winner.u);
  await fixturePastSession(sessions[0]);
  let v=await get(sessions[0]);await mut('attendance_mark_v1',{reservation_id:reservation.primary_id,expected_version:v.entries[0].version,result:'attended'},key(),instructor.u);
  assert.equal((await rights(winner)).reserved,1);assert.equal((await rights(winner)).consumed,0);
  v=await get(sessions[0]);const closeKey=key(),closeBody={session_id:sessions[0],expected_version:v.session_version};
  await mut('attendance_close_v1',closeBody,closeKey);assert.equal((await mut('attendance_close_v1',closeBody,closeKey)).replayed,true);
  let e=await rights(winner);assert.equal(e.reserved,0);assert.equal(e.consumed,1);assert.equal(e.available,0);
  const correction=await must(owner,'attendance_correct_preview_v1',scope({session_id:sessions[0],corrections:[{reservation_id:reservation.primary_id,result:'no_show'}],reason:'Daily attendance correction'}));
  const correctionKey=key(),correctionBody={preview:token(correction)};
  await mut('attendance_correct_apply_v1',correctionBody,correctionKey);assert.equal((await mut('attendance_correct_apply_v1',correctionBody,correctionKey)).replayed,true);
  e=await rights(winner);assert.equal(e.available,1);assert.equal(e.reserved,0);assert.equal(e.consumed,0);
  const cancelKey=key(),cancelBody={reservation_id:otherReservation.primary_id,expected_version:otherReservation.version,reason:'Student daily cancellation'};
  await mut('reservation_cancel_v1',cancelBody,cancelKey,loser.u);assert.equal((await mut('reservation_cancel_v1',cancelBody,cancelKey,loser.u)).replayed,true);
  assert.equal((await rights(loser)).available,1);assert.equal((await rights(loser)).reserved,0);
  for(const p of learners){assert.deepEqual(await finance(p),p.paid);assert.equal((await rights(p)).deficit,0);}
  assert.equal((await rows('select count(*)::int n from core.credit_deficits where org_id=$1 and person_id=any($2::uuid[])',[org,learners.map(p=>p.p)]))[0].n,0);
  assert.equal((await rows('select count(*)::int n from core.earnings where org_id=$1',[org]))[0].n,0);
 });
 await t.test('late closure failure rolls back rights, reservation, session, history and receipt',async()=>{
  const p=await linked('rollback-student'),p2=await linked('rollback-student-two'),ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id;await book(ses,p2.p);
  await fixturePastSession(ses);
  let v=await get(ses);for(const entry of v.entries)await mut('attendance_mark_v1',{reservation_id:entry.reservation_id,expected_version:entry.version,result:'attended'});v=await get(ses);
  await db.query('update core.attendance_entries set consumes_on_close=null,policy_snapshot=null where reservation_id=$1',[rv]);
  const snapshot=async()=>{const out={};for(const table of ['reservations','sessions','credit_deficits','attendance_entries','attendance_closures','operation_receipts','audit_events','outbox_jobs'])out[table]=await rows('select to_jsonb(q) v from core.'+table+' q where org_id=$1 order by id',[org]);out.history=await rows('select to_jsonb(q) v from private.lesson_deficit_movements q where org_id=$1 order by id',[org]);return out;};
  const before=await snapshot(),fn='lesson_fault_'+key().replaceAll('-','');
  await db.query('create function private.'+fn+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+fn+" before insert on core.audit_events for each row when(new.org_id='"+org+"'::uuid and new.action='attendance_close_v1') execute function private."+fn+'()');
  try{await fail('attendance_close_v1',{session_id:ses,expected_version:v.session_version},'INTEGRITY_VIOLATION');assert.deepEqual(await snapshot(),before);}
  finally{await db.query('drop trigger '+fn+' on core.audit_events');await db.query('drop function private.'+fn+'()');}
  const results=await Promise.all([1,2].map(()=>call(owner,'attendance_close_v1',scope({session_id:ses,expected_version:v.session_version}),key())));
  assert.equal(results.filter(x=>x.result.ok).length,1);assert.equal(results.find(x=>!x.result.ok).result.error.code,'ATTENDANCE_CLOSED');
 });
 await t.test('Pro/Business closure requires explicit occurrence before any rights or financial write',async()=>{
  const p=await linked('paid-boundary-student'),ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id;
  await fixturePastSession(ses);
  let v=await get(ses);await mut('attendance_mark_v1',{reservation_id:rv,expected_version:v.entries[0].version,result:'attended'});v=await get(ses);
  const sub=(await rows('select id from core.saas_subscriptions where org_id=$1',[org]))[0].id,paid=key();
  await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,'pro',now(),price_minor,currency,period,limits,features||array['F20'] from core.saas_plan_versions where id=$2",[paid,plan]);
  await db.query('update core.saas_subscriptions set plan_version_id=$1 where id=$2',[paid,sub]);
  try{await fail('attendance_close_v1',{session_id:ses,expected_version:v.session_version},'VALIDATION_FAILED');assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rv]))[0].state,'reserved');assert.equal((await get(ses)).closure_state,'open');}
  finally{await db.query('update core.saas_subscriptions set plan_version_id=$1 where id=$2',[plan,sub]);}
 });

});

