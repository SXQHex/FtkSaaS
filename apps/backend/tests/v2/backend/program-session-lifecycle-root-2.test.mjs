import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from '../../api-client.mjs';
import {connect} from '../../../scripts/db.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';


test('Session capacity revision: total, categories, explicit override and physical ceiling',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('capacity-owner'),foreign=await authUser('capacity-foreign');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Capacity acceptance',initial_plan_id:plan},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 let center;
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const req=(op,b,u=owner,k=key())=>call(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await req(op,b,u,k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 let fault;
 try{
 center=(await must(owner,'center_create_v1',{org_id:org,name:'Capacity center',timezone:'Europe/Istanbul'},key())).primary_id;
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 await mut('center_manager_assign_v1',{person_id:ownerPerson});
 const payment=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic capacity',occurred_at:new Date().toISOString()});await mut('saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true},key(),platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Capacity discipline',state:'active'},key())).primary_id;await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const publish=(key,value)=>mut('policy_publish_v1',{center_id:null,key,value,effective_at:'2020-01-01T00:00:00Z',mandatory:false});
 await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'consume',no_show:'consume'}});
 await publish('reservation_window',{kind:'window',opens_minutes_before:100000,closes_minutes_before:0,manager_exception:false});
 await publish('negative_default',{kind:'integer',value:0});await publish('negative_upper',{kind:'integer',value:0});
 const room=(await mut('room_save_v1',{name:'Physical room',capacity:3})).primary_id;
 const allDay={weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'};
 await mut('availability_save_v1',{resource:{kind:'room',id:room},rule:allDay});
 const product=(await mut('product_publish_v1',{terms:{name:'Capacity rights',kind:'credits',booking_mode:'flexible',credits:10,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
 async function student(label,withRights=true){
  const p=(await mut('person_create_v1',{display_name:label,contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:p});
  const u=await authUser(label),a=await must(u,'account_get_v1');await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  if(withRights){const preview=await must(owner,'sale_preview_v1',scope({person_id:p,product_version_id:product,start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+30*86400000).toISOString().slice(0,10)}));await mut('sale_apply_v1',{preview:{id:preview.id,token:preview.token}});}
  return {p,u};
 }
 const people=[];for(let n=0;n<7;n++)people.push(await student('capacity-'+n));
 const noRight=await student('capacity-no-right',false);
 const at=new Date(Date.now()+5*86400000);at.setUTCHours(9,0,0,0);
 const input={discipline_id:discipline,format:'group',interval:{starts_at:at.toISOString(),ends_at:new Date(+at+3600000).toISOString()},resources:[{kind:'room',id:room}],assignments:[],capacity:{total:2,categories:{male:1,female:1}}};
 const sid=(await mut('session_create_v1',input)).primary_id;
 const body=(i,category='male')=>({session_id:sid,person_id:people[i].p,mode:'flexible',booking_category:category});
 const over=i=>({...body(i),reason:'Explicit supervised capacity exception'});
 await t.test('single total/category DTO and physical room validation',async()=>{
  const view=await must(owner,'session_get_v1',scope({session_id:sid}));assert.equal(view.capacity.total,2);assert.deepEqual(view.capacity.categories,input.capacity.categories);assert.equal(view.capacity.remaining,2);assert.equal(view.capacity.room_capacity,3);assert(!('nominal' in view));assert(!('maximum' in view));
  await fail('session_capacity_set_v1',{session_id:sid,expected_version:1,capacity:{total:4},reason:'Exceeds physical room'},'CAPACITY_FULL');
  await fail('session_capacity_set_v1',{session_id:sid,expected_version:1,capacity:{total:2,categories:{male:-1,female:1}},reason:'Invalid category'},'VALIDATION_FAILED');
  await fail('session_create_v1',{...input,capacity:{nominal:2,maximum:3}},'VALIDATION_FAILED');
 });
 await t.test('capacity-only preview/apply checks physical limits and category activation without rewriting resources',async()=>{
  const start=new Date(+at+86400000),plain=(await mut('session_create_v1',{...input,interval:{starts_at:start.toISOString(),ends_at:new Date(+start+3600000).toISOString()},capacity:{total:2}})).primary_id;
  const preview=capacity=>must(owner,'session_change_preview_v1',scope({session_id:plain,scope:'single',patch:{capacity},reason:'Capacity-only review regression'}));
  const apply=p=>mut('session_change_apply_v1',{preview:{id:p.id,token:p.token}});
  const before=await rows('select id,version,state from core.resource_bookings where session_id=$1 order by id',[plain]);
  const excessive=await preview({total:4});assert.equal(excessive.blockers[0].code,'CAPACITY_FULL');
  await fail('session_change_apply_v1',{preview:{id:excessive.id,token:excessive.token}},'CAPACITY_FULL');
  await mut('reservation_create_v1',{session_id:plain,person_id:people[0].p,mode:'flexible'});
  const segmented=await preview({total:2,categories:{male:1,female:1}});assert.equal(segmented.blockers[0].code,'VALIDATION_FAILED');
  await fail('session_change_apply_v1',{preview:{id:segmented.id,token:segmented.token}},'VALIDATION_FAILED');
  const valid=await preview({total:3});assert.deepEqual(valid.blockers,[]);await apply(valid);
  assert.equal((await must(owner,'session_get_v1',scope({session_id:plain}))).capacity.total,3);
  assert.deepEqual(await rows('select id,version,state from core.resource_bookings where session_id=$1 order by id',[plain]),before);
 });
 await t.test('category limit blocks normal booking; override is explicit and audited once',async()=>{
  await mut('reservation_create_v1',body(0),key(),people[0].u);
  await fail('reservation_create_v1',body(1),'CAPACITY_FULL');
  await fail('reservation_capacity_override_v1',over(1),'FORBIDDEN',people[1].u);
  await fail('reservation_capacity_override_v1',over(1),'NOT_FOUND',foreign);
  await fail('reservation_capacity_override_v1',{...over(1),reason:' '},'VALIDATION_FAILED');
  const k=key(),a=await mut('reservation_capacity_override_v1',over(1),k);assert.equal((await mut('reservation_capacity_override_v1',over(1),k)).replayed,true);
  const audit=(await rows('select actor_account_id,reason,diff from core.audit_events where operation_id=$1',[a.operation_id]))[0];assert.equal(audit.actor_account_id,account.id);assert.equal(audit.diff.category,'male');assert.equal(audit.diff.category_excess,1);assert(audit.reason);
  assert.equal((await rows('select count(*)::int n from core.audit_events where operation_id=$1',[a.operation_id]))[0].n,1);
  const cap=(await must(owner,'session_get_v1',scope({session_id:sid}))).capacity;assert.equal(cap.total,2);assert.deepEqual(cap.categories,input.capacity.categories);assert.equal(cap.held,2);assert.equal(cap.remaining,0);assert.equal(cap.category_remaining.male,0);assert.equal(cap.category_remaining.female,1);
  await fail('reservation_capacity_override_v1',{...over(1),reason:'Changed'},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
 });
 await t.test('total/full physical ceiling and concurrent last place remain atomic',async()=>{
  await fail('reservation_create_v1',body(2,'female'),'CAPACITY_FULL');
  const answers=await Promise.all([2,3].map(i=>req('reservation_capacity_override_v1',{...body(i,'female'),reason:'Last physical place'})));
  assert.equal(answers.filter(r=>r.result.ok).length,1,JSON.stringify(answers));assert.equal(answers.find(r=>!r.result.ok).result.error.code,'CAPACITY_FULL');
  assert.equal((await rows("select count(*)::int n from core.reservations where session_id=$1 and state='active'",[sid]))[0].n,3);
  await fail('reservation_capacity_override_v1',over(4),'CAPACITY_FULL');
  await fail('room_save_v1',{room_id:room,expected_version:1,name:'Too small',capacity:2},'CAPACITY_FULL');
 });
 await t.test('permanent capacity change is separate and rights failure/audit failure roll back',async()=>{
  await mut('room_save_v1',{room_id:room,expected_version:1,name:'Room extended',capacity:6});
  await mut('session_capacity_set_v1',{session_id:sid,expected_version:1,capacity:{total:3,categories:{male:2,female:1}},reason:'Permanent configuration'});
  const b={session_id:sid,person_id:noRight.p,mode:'flexible',booking_category:'male',reason:'Capacity does not grant rights'};
  const denied=await req('reservation_capacity_override_v1',b);assert.equal(denied.result.ok,false);assert(['ENTITLEMENT_UNAVAILABLE','CREDIT_LIMIT_EXCEEDED','PARTICIPATION_BLOCKED'].includes(denied.result.error.code),JSON.stringify(denied.result));
  const before=await rows('select id from core.reservations where org_id=$1 order by id',[org]),k=key();
  fault='cap_'+key().replaceAll('-','');await db.query('create function private.'+fault+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");await db.query('create trigger '+fault+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='reservation_capacity_override_v1') execute function private."+fault+'()');
  await fail('reservation_capacity_override_v1',over(4),'INTEGRITY_VIOLATION',owner,k);assert.deepEqual(await rows('select id from core.reservations where org_id=$1 order by id',[org]),before);
  await db.query('drop trigger '+fault+' on core.audit_events');await db.query('drop function private.'+fault+'()');fault=null;
  await mut('reservation_capacity_override_v1',over(4),k);
 });
 await t.test('assigned instructor and explicitly granted staff; revoked authority blocks receipt replay',async()=>{
  const teacher=noRight;
  const role=(await mut('role_assign_v1',{person_id:teacher.p,role:'instructor',scope:{center_id:center}})).primary_id;
  const k=key();await fail('reservation_capacity_override_v1',over(5),'FORBIDDEN',teacher.u,k);
  await mut('availability_save_v1',{resource:{kind:'person',id:teacher.p},rule:allDay});
  const agreement=key();await db.query("insert into core.instructor_agreements(id,org_id,center_id,person_id,discipline_id,format,valid_from,model,terms,state) values($1,$2,$3,$4,$5,'group','2020-01-01','session_fixed',$6,'active')",[agreement,org,center,teacher.p,discipline,{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}}]);
  const version=(await must(owner,'session_get_v1',scope({session_id:sid}))).version;
  await mut('session_assignment_set_v1',{session_id:sid,expected_version:version,person_id:teacher.p,duty:'instructor',agreement_id:agreement});
  await mut('reservation_capacity_override_v1',over(5),k,teacher.u);
  const assignedVersion=(await must(owner,'session_get_v1',scope({session_id:sid}))).version;
  await mut('session_assignment_set_v1',{session_id:sid,expected_version:assignedVersion,person_id:teacher.p,duty:'instructor',state:'inactive'});
  await fail('reservation_capacity_override_v1',over(5),'FORBIDDEN',teacher.u,k);
  await mut('session_assignment_set_v1',{session_id:sid,expected_version:assignedVersion+1,person_id:teacher.p,duty:'instructor',agreement_id:agreement});
  const revokeImpact=await mut('role_revoke_preview_v1',{assignment_id:role,expected_version:1});
  await mut('role_revoke_v1',{impact_approval:{id:revokeImpact.id,token:revokeImpact.token},assignment_id:role,expected_version:1,reason:'Live teacher authority revoked'});
  await fail('reservation_capacity_override_v1',over(5),'FORBIDDEN',teacher.u,k);
  const staff=people[6];await mut('role_assign_v1',{person_id:staff.p,role:'staff',scope:{center_id:center}});
  const sk=key();await fail('reservation_capacity_override_v1',over(6),'FORBIDDEN',staff.u,sk);
  let pv=(await rows('select version from core.people where id=$1',[staff.p]))[0].version;
  await mut('permission_set_v1',{person_id:staff.p,expected_version:Number(pv),permission:'reservation.capacity_override',enabled:true});
  await mut('reservation_capacity_override_v1',over(6),sk,staff.u);
  pv=(await rows('select version from core.people where id=$1',[staff.p]))[0].version;
  await mut('permission_set_v1',{person_id:staff.p,expected_version:Number(pv),permission:'reservation.capacity_override',enabled:false});
  await fail('reservation_capacity_override_v1',over(6),'FORBIDDEN',staff.u,sk);
 });
 await t.test('room values and version are readable through the scoped management selector',async()=>{
  const request=scope({operation:'room_save_v1',selector:{operation:'room_save_v1',key:{room_id:room}}});
  const page=await must(owner,'management_state_get_v1',request);assert.equal(page.items.length,1);assert.equal(page.items[0].current.values.capacity,6);assert.equal(page.items[0].versions[0].version,2);
  const denied=await call(people[0].u,'management_state_get_v1',request);assert.equal(denied.result.error.code,'FORBIDDEN');
 });
 }finally{if(fault){await db.query('drop trigger if exists '+fault+' on core.audit_events');await db.query('drop function if exists private.'+fault+'()');}await db.end();}
});
