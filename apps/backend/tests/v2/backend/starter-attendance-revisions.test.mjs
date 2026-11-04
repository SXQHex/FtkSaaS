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

test('Starter protected reservation, attendance revisions and rollback',async t=>{
 const {platform,owner,outsider,db,rows,contract,plan,features,account,org,center,scope,mut,fail,person,pay,discipline,linked,student,instructor,room,syncFixtureBookings,fixturePastSession,effective_at,publish,makeSession,book,get,token,preview}=await attendanceFixture(t);
 let sid,rid,impact;
 await t.test('Starter creates class/program with instructor and no pay agreement',async()=>{
  const cls=(await mut('class_save_v1',{name:'Starter class',discipline_id:discipline,external_open:false})).primary_id;
  const p=await must(owner,'program_preview_v1',scope({class_id:cls,schedule:{room_id:room,weekdays:[1],local_start:'12:00:00',duration_minutes:60,starts_on:'2027-01-04',ends_on:'2027-01-12',assignments:[{person_id:instructor.p,duty:'instructor'}],capacity:{total:8}}}));
  assert.deepEqual(p.blockers,[]);assert(!p.sessions[0].assignments[0].agreement_id);
  await mut('program_apply_v1',{preview:token(p)});
  sid=(await makeSession()).primary_id;rid=(await book(sid)).primary_id;
  assert.equal((await rows('select count(*)::int n from core.instructor_agreements where org_id=$1',[org]))[0].n,0);
 });
 await t.test('subscriber identity is consistent in authorized reservation, attendance, finance and limit reads',async()=>{
  const personView=await must(owner,'person_get_v1',scope({person_id:student.p}));
  const number=personView.subscriber_number;assert.match(number,/^[1-9][0-9]+$/);
  const before=await rows('select last_number::text n from private.subscriber_counters where org_id=$1',[org]);
  const roster=await must(student.u,'reservation_list_v1',scope({person_id:student.p,session_id:sid,page:{}}));
  assert.equal(roster.items.find(x=>x.id===rid).subscriber_number,number);
  assert.equal((await get(sid)).entries.find(x=>x.reservation_id===rid).subscriber_number,number);
  const finance=await must(student.u,'finance_get_v1',scope({person_id:student.p,currency:'TRY',page:{}}));
  assert.equal(finance.subscriber_number,number);assert.equal(finance.person_id,student.p);
  const limits=await must(owner,'negative_limits_get_v1',scope({person_id:student.p,discipline_id:discipline}));
  assert.equal(limits.subscriber_number,number);
  const managerFinance=await must(owner,'finance_get_v1',scope({person_id:person,currency:'TRY',page:{}}));
  assert.equal(managerFinance.subscriber_number,null);
  assert.deepEqual(await rows('select last_number::text n from private.subscriber_counters where org_id=$1',[org]),before);
  await fail('finance_get_v1',{person_id:student.p,currency:'TRY',page:{}},'NOT_FOUND',outsider);
 });
 await t.test('Starter keeps paid and self-service plan boundaries conditional',async()=>{
  await mut('class_save_v1',{name:'Starter self-service class',discipline_id:discipline,external_open:true});
  await fail('role_assign_v1',{person_id:instructor.p,role:'staff',scope:{center_id:center}},'PLAN_FEATURE_UNAVAILABLE');
  const self=await mut('reservation_create_v1',{session_id:(await makeSession()).primary_id,person_id:student.p,mode:'flexible'},key(),student.u);
  await mut('reservation_cancel_v1',{reservation_id:self.primary_id,expected_version:self.version,reason:'End self-service acceptance fixture'},key(),student.u);
  await fail('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:new Date(Date.now()+60000).toISOString(),ends_at:new Date(Date.now()+3660000).toISOString()},resources:[],assignments:[{person_id:instructor.p,duty:'instructor',agreement_id:key()}],capacity:{total:8}},'PLAN_FEATURE_UNAVAILABLE');
  const terms={name:'Plan boundary',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]};
  await fail('product_publish_v1',{terms:{...terms,freeze:{enabled:true,extends_validity:false}}},'PLAN_FEATURE_UNAVAILABLE');
  const {credits,...timed}=terms;await fail('product_publish_v1',{terms:{...timed,kind:'timed'}},'PLAN_FEATURE_UNAVAILABLE');
 });
 await t.test('foreign tenant identifiers cannot select attendance or a personal limit',async()=>{
  const a=await must(outsider,'account_get_v1');
  const foreign=(await must(platform,'organization_create_v1',{verified_account_id:a.id,name:'Foreign Starter',initial_plan_id:plan},key())).primary_id;
  const c=(await must(outsider,'center_create_v1',{org_id:foreign,name:'Foreign',timezone:'Europe/Berlin'},key())).primary_id;
  const ownerId=(await rows('select owner_person_id from core.organizations where id=$1',[foreign]))[0].owner_person_id;
  await must(outsider,'center_manager_assign_v1',{org_id:foreign,center_id:c,person_id:ownerId},key());
  const pay=await must(outsider,'saas_payment_submit_v1',{org_id:foreign,center_id:c,amount_minor:'1000',currency:'TRY',reference:'synthetic foreign',occurred_at:new Date().toISOString()},key());
  await must(platform,'saas_payment_verify_v1',{org_id:foreign,center_id:c,payment_id:pay.primary_id,accepted:true},key());
  await fail('attendance_get_v1',{org_id:foreign,center_id:c,session_id:sid},'NOT_FOUND',outsider);
  await fail('negative_limits_get_v1',{org_id:foreign,center_id:c,person_id:student.p,discipline_id:discipline},'NOT_FOUND',outsider);
 });
 await t.test('impact preview is read-only and exact acknowledgment is mandatory',async()=>{
  const change={kind:'negative_limit',person_id:student.p,discipline_id:discipline,allowed_negative_credits:0};
  impact=await preview(change);assert.deepEqual(impact.affected.map(x=>x.reservation_id),[rid]);
  const l=await must(owner,'negative_limits_get_v1',scope({person_id:student.p,discipline_id:discipline}));assert.equal(l.effective_limit,2);
  await fail('reservation_impact_apply_v1',{preview:token(impact.preview),accepted_reservation_ids:[]},'VALIDATION_FAILED');
  await fail('negative_limit_set_v1',{person_id:student.p,discipline_id:discipline,allowed_negative_credits:0,reason:'Explicit impact approval',expected_version:l.version+1,impact_approval:token(impact.preview),accepted_reservation_ids:[rid]},'VERSION_CONFLICT');
  await mut('negative_limit_set_v1',{person_id:student.p,discipline_id:discipline,allowed_negative_credits:0,reason:'Explicit impact approval',expected_version:l.version,impact_approval:token(impact.preview),accepted_reservation_ids:[rid]});
  const v=await get(sid);assert(v.entries[0].protected);assert.equal(v.entries[0].result,'unmarked');
  const d=(await rows('select state from core.credit_deficits where reservation_id=$1',[rid]))[0];assert.equal(d.state,'reserved');
  const another=(await makeSession()).primary_id;await fail('reservation_create_v1',{session_id:another,person_id:student.p,mode:'flexible'},'CREDIT_LIMIT_EXCEEDED');
  await fail('attendance_block_v1',{reservation_id:rid,expected_version:v.entries[0].version,reason:'credit_limit_exceeded'},'FORBIDDEN');
 });
 await t.test('draft does not consume; closure and reasoned correction consume/release atomically',async()=>{
  // Fixture supplies a planned lesson whose actual start has passed. No historical balance is synthesized.
  await fixturePastSession(sid);
  let v=await get(sid);
  await mut('attendance_mark_v1',{reservation_id:rid,expected_version:v.entries[0].version,result:'attended'});
  assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rid]))[0].state,'reserved');
  v=await get(sid);const k=key(),closed=await mut('attendance_close_v1',{session_id:sid,expected_version:v.session_version},k);
  assert((await mut('attendance_close_v1',{session_id:sid,expected_version:v.session_version},k)).replayed);
  assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rid]))[0].state,'consumed');
  assert.equal((await rows('select count(*)::int n from core.earnings where org_id=$1',[org]))[0].n,0);
  for(const table of ['audit_events','outbox_jobs'])assert.equal((await rows('select count(*)::int n from core.'+table+' where '+(table==='outbox_jobs'?'dedupe_key':'operation_id')+'=$1',[closed.operation_id]))[0].n,1);
  const p=await must(owner,'attendance_correct_preview_v1',scope({session_id:sid,corrections:[{reservation_id:rid,result:'no_show'}],reason:'Correct recorded result'}));
  await mut('attendance_correct_apply_v1',{preview:token(p)});
  assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rid]))[0].state,'released');
  assert.deepEqual((await rows('select revision,corrects_id,reason from core.attendance_closures where session_id=$1 order by revision',[sid])).map(x=>Number(x.revision)),[1,2]);
 });

 await t.test('same-key correction race produces one revision; stale correction cannot close twice',async()=>{
  const p=await must(owner,'attendance_correct_preview_v1',scope({session_id:sid,corrections:[{reservation_id:rid,result:'attended'}],reason:'Restore correct attended result'}));
  assert.equal(p.effects[0].action,'consume');assert.equal(p.effects[0].quantity,1);
  const stale=await must(owner,'attendance_correct_preview_v1',scope({session_id:sid,corrections:[{reservation_id:rid,result:'attended'}],reason:'Concurrent correction scope'}));
  const k=key(),rs=await Promise.all([mut('attendance_correct_apply_v1',{preview:token(p)},k),mut('attendance_correct_apply_v1',{preview:token(p)},k)]);
  assert.equal(rs.filter(x=>x.replayed).length,1);
  await fail('attendance_correct_apply_v1',{preview:token(p)},'PREVIEW_STALE');
  await fail('attendance_correct_apply_v1',{preview:token(stale)},'PREVIEW_STALE');
  assert.equal((await rows('select count(*)::int n from core.attendance_closures where session_id=$1',[sid]))[0].n,3);
 });
 await t.test('limit preview becomes stale on relevant version changes but ignores unrelated people',async()=>{
  let p=await preview({kind:'negative_limit',person_id:student.p,discipline_id:discipline,allowed_negative_credits:2});
  await linked('unrelated-person');await mut('reservation_impact_apply_v1',{preview:token(p.preview),accepted_reservation_ids:[]});
  p=await preview({kind:'negative_limit',person_id:student.p,discipline_id:discipline,allowed_negative_credits:1});
  const extra=(await makeSession()).primary_id;await book(extra);
  await fail('reservation_impact_apply_v1',{preview:token(p.preview),accepted_reservation_ids:[]},'PREVIEW_STALE');
 });
 await t.test('late correction outbox failure rolls back linked revision, rights, audit and receipt',async()=>{
  const pv=await must(owner,'attendance_correct_preview_v1',scope({session_id:sid,corrections:[{reservation_id:rid,result:'no_show'}],reason:'Late failure correction'}));
  const snapshot=async()=>{const out={};for(const table of ['reservations','sessions','credit_deficits','attendance_entries','attendance_closures','operation_receipts','audit_events','outbox_jobs'])out[table]=await rows('select to_jsonb(q) v from core.'+table+' q where org_id=$1 order by id',[org]);out.history=await rows('select to_jsonb(q) v from private.lesson_deficit_movements q where org_id=$1 order by id',[org]);return out;};
  const before=await snapshot(),fn='lesson_outbox_'+key().replaceAll('-','');
  await db.query('create function private.'+fn+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+fn+" before insert on core.outbox_jobs for each row when(new.org_id='"+org+"'::uuid) execute function private."+fn+'()');
  try{await fail('attendance_correct_apply_v1',{preview:token(pv)},'INTEGRITY_VIOLATION');assert.deepEqual(await snapshot(),before);}
  finally{await db.query('drop trigger '+fn+' on core.outbox_jobs');await db.query('drop function private.'+fn+'()');}
  await mut('attendance_correct_apply_v1',{preview:token(pv)});
 });

});



