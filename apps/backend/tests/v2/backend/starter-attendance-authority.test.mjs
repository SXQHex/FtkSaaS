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


test('Starter instructor redaction and live operational authority',async t=>{
 const {platform,owner,outsider,db,rows,contract,plan,features,account,org,center,scope,mut,fail,person,pay,discipline,linked,student,instructor,room,syncFixtureBookings,fixturePastSession,effective_at,publish,makeSession,book,get,token,preview}=await attendanceFixture(t);
 let sid,rid,impact;
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
  const revokeImpact=await mut('role_revoke_preview_v1',{assignment_id:instructor.grant.primary_id,expected_version:instructor.grant.version});
  await mut('role_revoke_v1',{impact_approval:{id:revokeImpact.id,token:revokeImpact.token},assignment_id:instructor.grant.primary_id,expected_version:instructor.grant.version,reason:'Live role revoke'});
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
});


