import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('Starter attendance and protected reservation through Auth -> Edge -> RPC',async t=>{
 const {platform}=await fixturePlatform(),owner=await authUser('starter-owner'),outsider=await authUser('starter-outsider');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 try{
 const contract=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));
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
 let sid,rid,impact;
 await t.test('Starter creates class/program with instructor and no pay agreement',async()=>{
  const cls=(await mut('class_save_v1',{name:'Starter class',discipline_id:discipline,external_open:false})).primary_id;
  const p=await must(owner,'program_preview_v1',scope({class_id:cls,schedule:{room_id:room,weekdays:[1],local_start:'12:00:00',duration_minutes:60,starts_on:'2027-01-04',ends_on:'2027-01-12',assignments:[{person_id:instructor.p,duty:'instructor'}],capacity:{total:8}}}));
  assert.deepEqual(p.blockers,[]);assert(!p.sessions[0].assignments[0].agreement_id);
  await mut('program_apply_v1',{preview:token(p)});
  sid=(await makeSession()).primary_id;rid=(await book(sid)).primary_id;
  assert.equal((await rows('select count(*)::int n from core.instructor_agreements where org_id=$1',[org]))[0].n,0);
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
 await t.test('assigned instructor reads redacted draft; student, outsider and wrong center cannot mutate',async()=>{
  const assigned=(await makeSession({assignments:[{person_id:instructor.p,duty:'instructor'}]})).primary_id;
  const own=(await book(assigned,(await linked('assigned-student')).p)).primary_id;
  // Keep the full elapsed lesson inside configured Istanbul availability at any runner time.
  await fixturePastSession(assigned);
  let v=await get(assigned);await mut('attendance_mark_v1',{reservation_id:own,expected_version:v.entries[0].version,result:'attended'},key(),instructor.u);
  v=await must(instructor.u,'attendance_get_v1',scope({session_id:assigned}));assert.equal(v.entries[0].eligibility_snapshot,null);
  await publish('debt_participation',{kind:'boolean',value:true});
  await db.query("insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) select $1,$2,$3,person_id,100,'TRY',now(),'open' from core.reservations where id=$4",[key(),org,center,own]);
  const draft=await get(assigned);await mut('attendance_block_v1',{reservation_id:own,expected_version:draft.entries[0].version,reason:'debt_policy'});
  const redacted=await must(instructor.u,'attendance_get_v1',scope({session_id:assigned}));
  assert.equal(redacted.entries[0].result,'blocked');assert(!('blocked_reason' in redacted.entries[0]));assert.equal(redacted.entries[0].eligibility_snapshot,null);
  assert.equal((await get(assigned)).entries[0].blocked_reason,'debt_policy');
  await publish('debt_participation',{kind:'boolean',value:false});
  await fail('attendance_get_v1',{session_id:assigned},'FORBIDDEN',student.u);
  await fail('attendance_get_v1',{session_id:assigned},'NOT_FOUND',outsider);
  await fail('attendance_get_v1',{session_id:assigned,center_id:key()},'NOT_FOUND');
  const cls=(await mut('class_save_v1',{name:'Legacy role authority',discipline_id:discipline,external_open:false})).primary_id;
  await mut('class_assignment_set_v1',{class_id:cls,person_id:instructor.p,duty:'instructor'});
  const legacy=(await makeSession({class_id:cls,interval:{starts_at:'2027-02-01T12:00:00Z',ends_at:'2027-02-01T13:00:00Z'}})).primary_id;
  await db.query("update core.sessions set assignment_mode='legacy' where id=$1",[legacy]);
  await db.query("update core.session_assignments set state='inactive' where session_id=$1",[legacy]);
  assert.equal((await must(instructor.u,'attendance_get_v1',scope({session_id:legacy}))).session_id,legacy);
  await db.query("update core.sessions set assignment_mode='explicit' where id=$1",[legacy]);
  await fail('attendance_get_v1',{session_id:legacy},'FORBIDDEN',instructor.u);
  await mut('role_revoke_v1',{assignment_id:instructor.grant.primary_id,expected_version:instructor.grant.version,reason:'Live role revoke'});
  await fail('attendance_get_v1',{session_id:assigned},'FORBIDDEN',instructor.u);
  await fail('attendance_close_v1',{session_id:assigned,expected_version:v.session_version},'FORBIDDEN',instructor.u);
  instructor.grant=await mut('role_assign_v1',{person_id:instructor.p,role:'instructor',scope:{center_id:center}});
 });
 await t.test('live center authority revocation rejects an old-session receipt replay',async()=>{
  const p=await preview({kind:'negative_limit',person_id:student.p,discipline_id:discipline,allowed_negative_credits:3}),k=key();
  await mut('reservation_impact_apply_v1',{preview:token(p.preview),accepted_reservation_ids:[]},k);
  await mut('center_manager_revoke_v1',{person_id:person,expected_version:1,reason:'No operational role from owner'});
  await fail('reservation_impact_apply_v1',{preview:token(p.preview),accepted_reservation_ids:[]},'FORBIDDEN',owner,k);
  await mut('center_manager_assign_v1',{person_id:person});
 });
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

 await t.test('policy reduction requires manager impact approval and preserves confirmed rights',async()=>{
  const p=await linked('policy-student'),ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id;
  const change={kind:'policy',key:'negative_upper',value:{kind:'integer',value:0},effective_at:new Date().toISOString(),mandatory:false};
  await fail('policy_publish_v1',{center_id:null,...change,kind:undefined},'PREVIEW_STALE');
  const pv=await must(owner,'reservation_impact_preview_v1',scope({center_id:null,change,reason:'Policy reduction approval'}));
  assert(pv.affected.some(x=>x.reservation_id===rv));
  const b={center_id:null,key:change.key,value:change.value,effective_at:change.effective_at,mandatory:false,impact_approval:token(pv.preview),accepted_reservation_ids:pv.affected.map(x=>x.reservation_id)};
  await mut('policy_publish_v1',b);
  await fixturePastSession(ses);
  const v=await get(ses);assert(v.entries[0].protected);await mut('attendance_mark_v1',{reservation_id:rv,expected_version:v.entries[0].version,result:'attended'});
  // No-op publication cannot create a new exemption for an independently blocked reservation.
  const noop=await must(owner,'reservation_impact_preview_v1',scope({center_id:null,change:{...change,effective_at:new Date().toISOString()},reason:'No change'}));
  assert.deepEqual(noop.affected,[]);await mut('reservation_impact_apply_v1',{center_id:null,preview:token(noop.preview),accepted_reservation_ids:[]});
  await publish('negative_upper',{kind:'integer',value:10});
 });
 await t.test('reasoned block is a draft; close releases according to configured blocked policy',async()=>{
  await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});
  // Independent debt fixture. No historical start balance is inferred.
  const p=await linked('blocked-student'),ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id;
  const debtChange={kind:'policy',key:'debt_participation',value:{kind:'boolean',value:true},effective_at:new Date().toISOString(),mandatory:false};
  const approval=await must(owner,'reservation_impact_preview_v1',scope({center_id:null,change:debtChange,reason:'Explicit debt participation impact'}));
  await mut('reservation_impact_apply_v1',{center_id:null,preview:token(approval.preview),accepted_reservation_ids:approval.affected.map(x=>x.reservation_id)});

  await db.query("insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values($1,$2,$3,$4,100,'TRY',now(),'open')",[key(),org,center,p.p]);
  // Re-publishing true is not a cause of the debt and must not waive it.
  await publish('debt_participation',{kind:'boolean',value:true});
  let v=await get(ses);await fail('attendance_mark_v1',{reservation_id:rv,expected_version:v.entries[0].version,result:'attended'},'FORBIDDEN');
  await mut('attendance_block_v1',{reservation_id:rv,expected_version:v.entries[0].version,reason:'debt_policy'});
  assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rv]))[0].state,'reserved');
  await fixturePastSession(ses);
  v=await get(ses);await mut('attendance_close_v1',{session_id:ses,expected_version:v.session_version});
  assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[rv]))[0].state,'released');
 });

 await t.test('future-effective policy honors actual booking evidence across the UTC activation boundary',async()=>{
  await publish('negative_upper',{kind:'integer',value:10});
  try{
  const p=await linked('future-policy-student');
  // Schedule through the API without racing its own HTTP setup. Advance only
  // this fixture's activation after the real booking; never invent its evidence.
  const [{scheduled}]=await rows("select clock_timestamp()+interval '1 day' as scheduled");
  const change={kind:'policy',key:'negative_upper',value:{kind:'integer',value:0},effective_at:scheduled.toISOString(),mandatory:false};
  const pv=await must(owner,'reservation_impact_preview_v1',scope({center_id:null,change,reason:'Future UTC boundary'}));
  const policy=await mut('reservation_impact_apply_v1',{center_id:null,preview:token(pv.preview),accepted_reservation_ids:pv.affected.map(x=>x.reservation_id)});
  const ses=(await makeSession()).primary_id,rv=(await book(ses,p.p)).primary_id;
  const [before]=await rows("select r.booking_obligation, p.created_at<=(r.booking_obligation->>'captured_at')::timestamptz and (r.booking_obligation->>'captured_at')::timestamptz<p.effective_at and p.effective_at>clock_timestamp() and r.booking_obligation#>>'{policies,negative_upper}' is distinct from p.id::text as ordered from core.reservations r join core.policy_versions p on p.org_id=r.org_id where r.org_id=$1 and r.id=$2 and p.id=$3",[org,rv,policy.primary_id]);
  assert.equal(before.ordered,true);assert(before.booking_obligation);
  const activated=await rows("update core.policy_versions set effective_at=clock_timestamp() where org_id=$1 and id=$2 returning id",[org,policy.primary_id]);
  assert.equal(activated.length,1);assert.equal(activated[0].id,policy.primary_id);
  const [after]=await rows("select r.booking_obligation, p.created_at<=(r.booking_obligation->>'captured_at')::timestamptz and (r.booking_obligation->>'captured_at')::timestamptz<p.effective_at and p.effective_at<=clock_timestamp() as ordered, (select count(*)::int from private.reservation_protections x where x.org_id=r.org_id and x.reservation_id=r.id) as explicit_protections from core.reservations r join core.policy_versions p on p.org_id=r.org_id where r.org_id=$1 and r.id=$2 and p.id=$3",[org,rv,policy.primary_id]);
  assert.equal(after.ordered,true);assert.deepEqual(after.booking_obligation,before.booking_obligation);assert.equal(after.explicit_protections,0);
  const limits=await must(owner,'negative_limits_get_v1',scope({person_id:p.p,discipline_id:discipline}));assert.equal(limits.effective_limit,0);
  const v=await get(ses);assert(v.entries[0].protected);
  await mut('attendance_mark_v1',{reservation_id:rv,expected_version:v.entries[0].version,result:'attended'});
  await fail('reservation_create_v1',{session_id:(await makeSession()).primary_id,person_id:p.p,mode:'flexible'},'CREDIT_LIMIT_EXCEEDED');
  }finally{await publish('negative_upper',{kind:'integer',value:10});}
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

 await t.test('a second adverse restriction still requires exact approval of already protected reservations',async()=>{
  await publish('negative_upper',{kind:'integer',value:10});
  try{
  const p=await linked('successive-limits');
  const own=await preview({kind:'negative_limit',person_id:p.p,discipline_id:discipline,allowed_negative_credits:5});
  await mut('reservation_impact_apply_v1',{preview:token(own.preview),accepted_reservation_ids:[]});
  const rs=[];for(let i=0;i<3;i++)rs.push((await book((await makeSession()).primary_id,p.p)).primary_id);
  const change={kind:'policy',key:'negative_upper',value:{kind:'integer',value:2},effective_at:new Date().toISOString(),mandatory:false};
  const pv=await must(owner,'reservation_impact_preview_v1',scope({center_id:null,change,reason:'First restriction'}));
  assert(rs.every(id=>pv.affected.some(x=>x.reservation_id===id)));await mut('reservation_impact_apply_v1',{center_id:null,preview:token(pv.preview),accepted_reservation_ids:pv.affected.map(x=>x.reservation_id)});
  const next={...change,value:{kind:'integer',value:1},effective_at:new Date().toISOString()};
  await fail('policy_publish_v1',{center_id:null,key:next.key,value:next.value,effective_at:next.effective_at,mandatory:false},'PREVIEW_STALE');
  const pv2=await must(owner,'reservation_impact_preview_v1',scope({center_id:null,change:next,reason:'Second restriction'}));
  assert(rs.every(id=>pv2.affected.some(x=>x.reservation_id===id)));await mut('reservation_impact_apply_v1',{center_id:null,preview:token(pv2.preview),accepted_reservation_ids:pv2.affected.map(x=>x.reservation_id)});
  }finally{await publish('negative_upper',{kind:'integer',value:10});}
 });

 await t.test('blocked credit effect is frozen at actual sale; later policy cannot reprice it',async()=>{
  await publish('negative_upper',{kind:'integer',value:10});
  await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});
  const p=await linked('sale-blocked-policy');
  const product=(await mut('product_publish_v1',{terms:{name:'Starter lesson · blocked credits',kind:'credits',booking_mode:'flexible',credits:2,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
  const pv=await must(owner,'sale_preview_v1',scope({person_id:p.p,product_version_id:product,start_date:'2026-01-01',end_date:'2027-01-01'}));
  const sale=(await mut('sale_apply_v1',{preview:token(pv)})).primary_id;
  assert.deepEqual((await rows('select participation_block_policy_snapshot v from core.sales where id=$1',[sale]))[0].v,{kind:'blocked_credit',effect:'release'});
  const ses=(await makeSession()).primary_id,rv=(await mut('reservation_create_v1',{session_id:ses,person_id:p.p,source_sale_id:sale,mode:'flexible'})).primary_id;
  await publish('participation_block_credit',{kind:'blocked_credit',effect:'consume'});
  let v=await get(ses);await mut('attendance_block_v1',{reservation_id:rv,expected_version:v.entries[0].version,reason:'debt_policy'});
  await fixturePastSession(ses);
  v=await get(ses);await mut('attendance_close_v1',{session_id:ses,expected_version:v.session_version});
  assert.equal((await rows('select state from core.entitlement_allocations where reservation_id=$1',[rv]))[0].state,'released');
 });
 }finally{await db.end();}
});
