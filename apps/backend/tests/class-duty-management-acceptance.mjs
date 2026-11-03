import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

for(const planName of ['starter','pro','business'])test('Class duty management '+planName+' exposes native assignment identity and version',async()=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('class-duty-'+planName),account=await must(owner,'account_get_v1');
 const db=await connect();
 try{
  await db.query('update core.saas_plan_versions set name=$1 where id=$2',[planName,plan]);
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic class duty '+planName,initial_plan_id:plan},key())).primary_id;
  const api=(op,b={},k=key(),user=owner)=>must(user,op,{org_id:org,center_id:center,...b},k);
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Duty center',timezone:'Europe/Istanbul'},key())).primary_id;
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:person});
  const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic duty acceptance',occurred_at:new Date().toISOString()});
  await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},key(),platform);
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Duty discipline',state:'active'},key())).primary_id;
  await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  const classId=(await api('class_save_v1',{name:'Duty class',discipline_id:discipline,external_open:false})).primary_id;
  const selector={operation:'class_assignment_set_v1',key:{class_id:classId,person_id:person,duty:'instructor'}};
  const request={operation:'class_assignment_set_v1',selector,page:{limit:1,sort:'created_at_asc'}};
  const read=(extra={},user=owner)=>api('management_state_get_v1',{...request,...extra},key(),user);
  const before=async()=>({
   classes:(await db.query('select * from core.classes where org_id=$1 order by id',[org])).rows,
   assignments:(await db.query('select * from core.class_assignments where org_id=$1 order by id',[org])).rows,
   receipts:(await db.query('select id from core.operation_receipts where org_id=$1 order by id',[org])).rows,
   audit:(await db.query('select id from core.audit_events where org_id=$1 order by id',[org])).rows,
   outbox:(await db.query('select id from core.outbox_jobs where org_id=$1 order by id',[org])).rows
  });
  const snapshot=await before(),empty=await read();assert.equal(empty.next_cursor,null);assert.equal(empty.items.length,1);
  const absent=empty.items[0];assert.equal(absent.exists,false);assert.equal(absent.entity,null);assert.equal(absent.state,null);assert.deepEqual(absent.versions,[]);
  assert.deepEqual(absent.current,{operation:'class_assignment_set_v1',values:selector.key});assert.deepEqual(await before(),snapshot);
  const uppercase=(await read({selector:{...selector,key:{...selector.key,class_id:classId.toUpperCase(),person_id:person.toUpperCase()}}})).items[0];
  assert.deepEqual(uppercase.current.values,selector.key);
  const created=await api('class_assignment_set_v1',{...selector.key}),active=(await read()).items[0];
  assert.equal(active.entity.type,'class_assignments');assert.equal(active.entity.id,created.primary_id);assert.equal(active.state,'active');assert.equal(active.exists,true);
  assert.deepEqual(active.versions,[{entity:{type:'class_assignments',id:created.primary_id},version:created.version}]);
  assert.deepEqual(active.current.values,{...selector.key,state:'active'});
  assert.deepEqual((await read({entity:{...active.entity,id:active.entity.id.toUpperCase()}})).items[0].entity,active.entity);
  const removed=await api('class_assignment_set_v1',{...selector.key,expected_version:active.versions[0].version,state:'inactive'});
  const inactive=(await read({entity:active.entity})).items[0];assert.equal(inactive.state,'inactive');assert.equal(inactive.versions[0].version,removed.version);
  const stale=await call(owner,'class_assignment_set_v1',{org_id:org,center_id:center,...selector.key,expected_version:created.version,state:'active'},key());
  assert.equal(stale.result.ok,false);assert.equal(stale.result.error.code,'VERSION_CONFLICT');
  const restored=await api('class_assignment_set_v1',{...selector.key,expected_version:removed.version,state:'active'});
  assert.equal((await read()).items[0].versions[0].version,restored.version);
  // Actual inherited duties follow the same versioned command; a passive
  // per-session override remains authoritative when the class default returns.
  const room=(await api('room_save_v1',{name:'Duty room',capacity:4})).primary_id;
  const allDay={weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'};
  for(const resource of [{kind:'room',id:room},{kind:'person',id:person}])await api('availability_save_v1',{resource,rule:allDay});
  const terms={model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}};
  if(planName!=='starter')await api('instructor_agreement_publish_v1',{person_id:person,discipline_id:discipline,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms,reason:'Synthetic native duty agreement'});
  if(planName==='starter'){
   const noInstructor=await api('program_preview_v1',{class_id:classId,schedule:{room_id:room,starts_on:'2027-01-07',ends_on:'2027-01-08',weekdays:[4],local_start:'09:00:00',duration_minutes:60,capacity:{total:3},assignments:[],inherit_class_assignments:false}});
   assert(noInstructor.blockers.some(x=>x.code==='PLAN_FEATURE_UNAVAILABLE'));
  }
  const proposed=await api('program_preview_v1',{class_id:classId,schedule:{room_id:room,starts_on:'2027-01-04',ends_on:'2027-01-06',weekdays:[1,2],local_start:'09:00:00',duration_minutes:60,capacity:{total:3},assignments:[],inherit_class_assignments:true}});
  assert.deepEqual(proposed.blockers,[]);assert.equal(proposed.sessions.length,2);
  await api('program_apply_v1',{preview:{id:proposed.id,token:proposed.token}});
  const [overridden,inherited]=proposed.sessions.map(x=>x.session_id);
  const defaultOff=await api('class_assignment_set_v1',{...selector.key,expected_version:restored.version,state:'inactive'});
  assert.equal((await db.query("select count(*)::int n from core.session_assignments where org_id=$1 and session_id=any($2::uuid[]) and state='active'",[org,[overridden,inherited]])).rows[0].n,0);
  if(planName==='starter'){
   const proposedEmpty=(await db.query('select private.schedule_snapshot($1,$2) d',[org,inherited])).rows[0].d;
   await assert.rejects(db.query('select private.starter_schedule_guard($1,$2::jsonb)',[org,{...proposedEmpty,center_id:key()}]),/PLAN_FEATURE_UNAVAILABLE/);
   await assert.rejects(db.query('select private.starter_schedule_guard($1,$2::jsonb)',[org,{...proposedEmpty,assignments:[{person_id:person,duty:'instructor'},{person_id:person,duty:'instructor'}]}]),/PLAN_FEATURE_UNAVAILABLE/);
  }
  const defaultOn=await api('class_assignment_set_v1',{...selector.key,expected_version:defaultOff.version,state:'active'});
  const first=(await db.query('select version from core.sessions where id=$1',[overridden])).rows[0];
  const override={session_id:overridden,person_id:person,duty:'instructor',state:'inactive',expected_version:Number(first.version)};
  await api('session_assignment_set_v1',override);
  const off=await api('class_assignment_set_v1',{...selector.key,expected_version:defaultOn.version,state:'inactive'});
  assert.equal((await db.query("select count(*)::int n from core.session_assignments where org_id=$1 and session_id=$2 and state='active'",[org,inherited])).rows[0].n,0);
  const on=await api('class_assignment_set_v1',{...selector.key,expected_version:off.version,state:'active'});
  const duties=(await db.query('select session_id,state,origin_class_assignment_id from core.session_assignments where org_id=$1 and session_id=any($2::uuid[]) order by session_id',[org,[overridden,inherited]])).rows;
  assert.equal(duties.find(x=>x.session_id===overridden).state,'inactive');assert.equal(duties.find(x=>x.session_id===overridden).origin_class_assignment_id,null);
  assert.equal(duties.find(x=>x.session_id===inherited).state,'active');assert.equal(duties.find(x=>x.session_id===inherited).origin_class_assignment_id,created.primary_id);
  assert((await db.query('select state from core.sessions where id=any($1::uuid[])',[[overridden,inherited]])).rows.every(x=>x.state==='planned'));
  assert.equal((await read()).items[0].versions[0].version,on.version);
  const bad=async(body,code,user=owner)=>{const r=await call(user,'management_state_get_v1',{org_id:org,center_id:center,...request,...body});assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
  await bad({page:{limit:1,sort:'created_at_asc',cursor:'invalid-cursor'}},'VALIDATION_FAILED');
  await bad({entity:{type:'classes',id:classId}},'NOT_FOUND');
  await bad({selector:{...selector,key:{...selector.key,class_id:key()}}},'NOT_FOUND');
  await bad({selector:{...selector,key:{...selector.key,person_id:key()}}},'NOT_FOUND');
  const withoutFeature=key();
  await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,name,now(),price_minor,currency,period,limits,array_remove(features,'F14') from core.saas_plan_versions where id=$2",[withoutFeature,plan]);
  await db.query('update core.saas_subscriptions set plan_version_id=$1 where org_id=$2',[withoutFeature,org]);
  try{await bad({},'PLAN_FEATURE_UNAVAILABLE');}finally{await db.query('update core.saas_subscriptions set plan_version_id=$1 where org_id=$2',[plan,org]);}
  const student=await authUser('class-duty-member-'+planName),member=await must(student,'account_get_v1');
  const memberPerson=(await api('person_create_v1',{display_name:'Synthetic duty member',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:memberPerson});
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,member.id,memberPerson]);
  await bad({},'FORBIDDEN',student);
  if(planName!=='starter'){
   const secondDiscipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Independent discipline',state:'active'},key())).primary_id;
   await api('center_discipline_set_v1',{discipline_id:secondDiscipline,state:'active'});
   const secondClass=(await api('class_save_v1',{name:'Independent class',discipline_id:secondDiscipline,external_open:false})).primary_id;
   const instructor=await authUser('second-duty-instructor-'+planName),instructorAccount=await must(instructor,'account_get_v1');
   const secondPerson=(await api('person_create_v1',{display_name:'Synthetic second instructor',contacts:[]})).primary_id;
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,instructorAccount.id,secondPerson]);
   await api('role_assign_v1',{person_id:secondPerson,role:'instructor',scope:{center_id:center}});
   await api('availability_save_v1',{resource:{kind:'person',id:secondPerson},rule:allDay});
   await api('instructor_agreement_publish_v1',{person_id:secondPerson,discipline_id:secondDiscipline,format:'group',valid:{starts_at:'2020-01-01T00:00:00Z',ends_at:'2030-01-01T00:00:00Z'},terms,reason:'Synthetic second native agreement'});
   const secondRoom=(await api('room_save_v1',{name:'Independent second room',capacity:4})).primary_id;
   await api('availability_save_v1',{resource:{kind:'room',id:secondRoom},rule:allDay});
   const concurrent=await api('program_preview_v1',{class_id:secondClass,schedule:{room_id:secondRoom,starts_on:'2027-01-05',ends_on:'2027-01-06',weekdays:[2],local_start:'09:00:00',duration_minutes:60,capacity:{total:3},assignments:[{person_id:secondPerson,duty:'instructor'}],inherit_class_assignments:false}});
   assert.deepEqual(concurrent.blockers,[]);await api('program_apply_v1',{preview:{id:concurrent.id,token:concurrent.token}});
   const occupiedRoom=await api('program_preview_v1',{class_id:secondClass,schedule:{room_id:room,starts_on:'2027-01-05',ends_on:'2027-01-06',weekdays:[2],local_start:'09:00:00',duration_minutes:60,capacity:{total:3},assignments:[{person_id:secondPerson,duty:'instructor'}],inherit_class_assignments:false}});
   assert(occupiedRoom.blockers.some(x=>x.code==='RESOURCE_CONFLICT'));
   const freeRoom=(await api('room_save_v1',{name:'Free third room',capacity:4})).primary_id;
   await api('availability_save_v1',{resource:{kind:'room',id:freeRoom},rule:allDay});
   const conflict=await api('program_preview_v1',{class_id:classId,schedule:{room_id:freeRoom,starts_on:'2027-01-05',ends_on:'2027-01-06',weekdays:[2],local_start:'09:00:00',duration_minutes:60,capacity:{total:3},assignments:[],inherit_class_assignments:true}});
   assert(conflict.blockers.some(x=>x.code==='RESOURCE_CONFLICT'));
   const count=(await db.query('select count(*)::int n from core.sessions where org_id=$1',[org])).rows[0].n;
   const refused=await call(owner,'program_apply_v1',{org_id:org,center_id:center,preview:{id:conflict.id,token:conflict.token}},key());
   assert.equal(refused.result.ok,false);assert.equal(refused.result.error.code,'RESOURCE_CONFLICT');
   assert.equal((await db.query('select count(*)::int n from core.sessions where org_id=$1',[org])).rows[0].n,count);
   const staffRole=await api('role_assign_v1',{person_id:memberPerson,role:'staff',scope:{center_id:center}});
   const personVersion=async()=>Number((await db.query('select version from core.people where org_id=$1 and id=$2',[org,memberPerson])).rows[0].version);
   const create={org_id:org,center_id:center,display_name:'Explicit staff permission only',contacts:[]};
   const beforeGrant=await call(student,'person_create_v1',create,key());assert.equal(beforeGrant.result.error.code,'FORBIDDEN');
   await api('permission_set_v1',{person_id:memberPerson,permission:'person.manage',enabled:true,expected_version:await personVersion()});
   const staffKey=key();await must(student,'person_create_v1',create,staffKey);
   await bad({},'FORBIDDEN',student);
   const discount=await call(student,'debt_adjust_v1',{org_id:org,center_id:center,debt_id:key(),amount_minor:'1',direction:'decrease',reason:'Synthetic forbidden staff discount'},key());
   assert.equal(discount.result.ok,false);assert.equal(discount.result.error.code,'FORBIDDEN');
   await api('permission_set_v1',{person_id:memberPerson,permission:'person.manage',enabled:false,expected_version:await personVersion()});
   const replay=await call(student,'person_create_v1',create,staffKey);assert.equal(replay.result.ok,false);assert.equal(replay.result.error.code,'FORBIDDEN');
   await api('role_revoke_v1',{assignment_id:staffRole.primary_id,expected_version:staffRole.version,reason:'Synthetic staff revocation'});
  }
  if(planName==='business'){
   const otherCenter=(await must(owner,'center_create_v1',{org_id:org,name:'Other scoped center',timezone:'Europe/Istanbul'},key())).primary_id;
   await bad({center_id:otherCenter},'FORBIDDEN');
   await api('center_manager_assign_v1',{center_id:otherCenter,person_id:person});
   await api('center_discipline_set_v1',{center_id:otherCenter,discipline_id:discipline,state:'active'});
   await api('role_assign_v1',{center_id:otherCenter,person_id:person,role:'instructor',scope:{center_id:otherCenter}});
   const otherClass=(await api('class_save_v1',{center_id:otherCenter,name:'Other scoped class',discipline_id:discipline,external_open:false})).primary_id;
   const otherSelector={...selector,key:{...selector.key,class_id:otherClass}};
   await bad({selector:otherSelector},'NOT_FOUND');
   assert.equal((await read({center_id:otherCenter,selector:otherSelector})).items[0].exists,false);
   const otherCm=(await db.query("select version from core.role_assignments where org_id=$1 and scope_center_id=$2 and person_id=$3 and role='center_manager' and state='active'",[org,otherCenter,person])).rows[0];
   await api('center_manager_revoke_v1',{center_id:otherCenter,person_id:person,expected_version:Number(otherCm.version),reason:'Synthetic scoped revocation'});
   await bad({center_id:otherCenter,selector:otherSelector},'FORBIDDEN');assert.equal((await read()).items[0].exists,true);
  }
  // Existing foreign tenant/class must be concealed, not merely an unknown UUID.
  const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:member.id,name:'Synthetic foreign class duty',initial_plan_id:plan},key())).primary_id;
  const foreignCenter=(await must(student,'center_create_v1',{org_id:foreignOrg,name:'Foreign duty center',timezone:'Europe/Istanbul'},key())).primary_id;
  const foreignPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[foreignOrg])).rows[0].owner_person_id;
  const foreignApi=(op,b={},user=student)=>must(user,op,{org_id:foreignOrg,center_id:foreignCenter,...b},key());
  await foreignApi('center_manager_assign_v1',{person_id:foreignPerson});
  const foreignPay=await foreignApi('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic foreign duty',occurred_at:new Date().toISOString()});
  await foreignApi('saas_payment_verify_v1',{payment_id:foreignPay.primary_id,accepted:true},platform);
  const foreignDiscipline=(await must(student,'discipline_save_v1',{org_id:foreignOrg,name:'Foreign discipline',state:'active'},key())).primary_id;
  await foreignApi('center_discipline_set_v1',{discipline_id:foreignDiscipline,state:'active'});
  const foreignClass=(await foreignApi('class_save_v1',{name:'Foreign class',discipline_id:foreignDiscipline,external_open:false})).primary_id;
  await bad({selector:{...selector,key:{...selector.key,class_id:foreignClass}}},'NOT_FOUND');
  await bad({org_id:foreignOrg,center_id:foreignCenter,selector:{...selector,key:{...selector.key,class_id:foreignClass,person_id:foreignPerson}}},'NOT_FOUND');
  const cm=(await db.query("select version from core.role_assignments where org_id=$1 and person_id=$2 and role='center_manager' and state='active'",[org,person])).rows[0];
  await api('center_manager_revoke_v1',{person_id:person,expected_version:Number(cm.version),reason:'Synthetic live reader revocation'});await bad({},'FORBIDDEN');
 }finally{await db.end();}
});
