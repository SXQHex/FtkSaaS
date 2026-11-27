import './assigned-session-room-labels-acceptance.mjs';
import './calendar-preferences-acceptance.mjs';
import './personal-calendar-acceptance.mjs';
import './member-profile-lifecycle-acceptance.mjs';
import './session-roster-discovery-acceptance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Schedule reads through real Auth -> Edge -> RPC',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('schedule-owner'),stranger=await authUser('schedule-stranger');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Schedule reads',initial_plan_id:plan},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 const scope=b=>({org_id:org,...b}),mut=(op,b={},u=owner)=>must(u,op,scope(b),key());
 const fail=async(u,op,b,code)=>{const r=await call(u,op,scope(b));assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const c1=(await mut('center_create_v1',{name:'Istanbul',timezone:'Europe/Istanbul'})).primary_id;
 const c2=(await mut('center_create_v1',{name:'Berlin',timezone:'Europe/Berlin'})).primary_id;
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 try{
 for(const c of [c1,c2])await mut('center_manager_assign_v1',{center_id:c,person_id:ownerPerson});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic schedule',occurred_at:new Date().toISOString()});
 await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
 const discipline=(await mut('discipline_save_v1',{name:'Salsa',state:'active'})).primary_id;
 for(const c of [c1,c2])await mut('center_discipline_set_v1',{center_id:c,discipline_id:discipline,state:'active'});
 async function linked(label,role,c=c1){
  const p=(await mut('person_create_v1',{center_id:c,display_name:label,contacts:[]})).primary_id;
  const u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  let grant;
  if(role==='student')await mut('student_activate_v1',{center_id:c,person_id:p});
  else if(role==='center_manager')grant=await mut('center_manager_assign_v1',{center_id:c,person_id:p});
  else grant=await mut('role_assign_v1',{center_id:c,person_id:p,role,scope:{center_id:c}});
  return {u,p,grant,a};
 }
 const student=await linked('schedule-self','student'),otherStudent=await linked('schedule-other','student');
 const instructor=await linked('schedule-instructor','instructor'),assistant=await linked('schedule-assistant','assistant');
 const cm=await linked('schedule-cm','center_manager'),staff=await linked('schedule-staff','staff');
 const cls=(await mut('class_save_v1',{center_id:c1,name:'Class one',discipline_id:discipline,external_open:false})).primary_id;
 const room=(await mut('room_save_v1',{center_id:c1,name:'Read room',capacity:10})).primary_id;
 async function session(c,starts,ends,cl=null,assigned=[]){
  const id=key();await db.query("insert into core.sessions(id,org_id,center_id,class_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,$5,'group',$6,$7,10,10,'planned','open')",[id,org,c,cl,discipline,starts,ends]);
  for(const a of assigned)await db.query("insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,state) values($1,$2,$3,$4,$5,$6,'active')",[key(),org,c,id,a.p,a===assistant?'assistant':'instructor']);
  return id;
 }
 const s1=await session(c1,'2026-11-01T20:30:00Z','2026-11-01T21:30:00Z',cls,[instructor,assistant]);
 const s2=await session(c1,'2026-11-01T21:00:00Z','2026-11-01T22:00:00Z');
 const s3=await session(c2,'2026-11-01T21:00:00Z','2026-11-01T22:00:00Z');
 const fold1=await session(c2,'2026-10-25T02:30:00+02:00','2026-10-25T02:50:00+02:00');
 const fold2=await session(c2,'2026-10-25T02:30:00+01:00','2026-10-25T02:50:00+01:00');
 const atEnd=await session(c1,'2026-11-02T21:00:00Z','2026-11-02T22:00:00Z');
 const bookRoom=(sid,start,end)=>db.query("insert into core.resource_bookings(id,org_id,center_id,session_id,resource_kind,resource_id,starts_at,ends_at,state) values($1,$2,$3,$4,'room',$5,$6,$7,'active')",[key(),org,c1,sid,room,start,end]);
 await bookRoom(s1,'2026-11-01T20:30:00Z','2026-11-01T21:30:00Z');
 const policy=key();await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[policy,org,c1,{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'consume',no_show:'consume'}}]);
 const reservations=[];
 async function reservation(s,p,c=c1,state='active'){
  const id=key();await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id,created_at) values($1,$2,$3,$4,$5,'flexible',$6,$7,'2026-10-01T00:00:00Z')",[id,org,c,s,p,state,policy]);reservations.push(id);return id;
 }
 const r1=await reservation(s1,student.p),r2=await reservation(s1,otherStudent.p);
 const r3=await reservation(s2,otherStudent.p),r4=await reservation(s3,otherStudent.p,c2);
 const cancelled=await reservation(s2,student.p,c1,'cancelled');
 const interval={starts_at:'2026-11-01T00:00:00+03:00',ends_at:'2026-11-03T00:00:00+03:00'};
 const cal=(u,b={})=>must(u,'calendar_get_v1',scope({interval,page:{},...b}));
 const list=(u,b={})=>must(u,'reservation_list_v1',scope({page:{},...b}));
 const get=(u,s,b={})=>must(u,'session_get_v1',scope({session_id:s,...b}));
 const attendance=(u,s,b={})=>must(u,'attendance_get_v1',scope({center_id:c1,session_id:s,...b}));
 const ids=x=>x.items.map(v=>v.id);
 await t.test('exact session center is opt-in and preserves the live read scope',async()=>{
  const options={include_center_id:true};
  for(const [actor,id,center] of [[owner,s1,c1],[owner,s3,c2],[student.u,s1,c1],[instructor.u,s1,c1]]){
   const legacy=await get(actor,id);
   assert(!('center_id' in legacy));
   assert.deepEqual(await get(actor,id,options),{...legacy,center_id:center});
  }
  const scoped=await get(owner,s3,{...options,center_id:c2});
  assert.equal(scoped.center_id,c2);
  assert(!('center_id' in await get(owner,s3,{include_center_id:false})));
  await fail(owner,'session_get_v1',{...options,session_id:s3,center_id:c1},'NOT_FOUND');
  await fail(student.u,'session_get_v1',{...options,session_id:s3},'FORBIDDEN');
  await fail(instructor.u,'session_get_v1',{...options,session_id:s2},'NOT_FOUND');
 });
 await t.test('member time partitions filter the full authorized set before paging and retain their cutoff',async()=>{
  const p=key(),at=Date.now(),createdSessions=[],createdReservations=[],previousCount=reservations.length;
  await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Time filter learner','active')",[p,org]);
  await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now())",[key(),org,c1,p]);
  try{
   for(const [start,end] of [[-7200000,-3600000],[-1800000,1800000],[3600000,7200000],[10800000,14400000]]){
    const s=await session(c1,new Date(at+start).toISOString(),new Date(at+end).toISOString());createdSessions.push(s);createdReservations.push(await reservation(s,p));
   }
   const base={center_id:c1,person_id:p,page:{limit:1,sort:'starts_at_asc'}},seen=[];
   const first=await list(cm.u,{...base,time_filter:'upcoming'});seen.push(...ids(first));assert(first.next_cursor);
   const second=await list(cm.u,{...base,time_filter:'upcoming',page:{...base.page,cursor:first.next_cursor}});seen.push(...ids(second));assert.equal(second.as_of,first.as_of);
   assert.deepEqual(seen,createdReservations.slice(2));assert.equal(second.next_cursor,null);
   assert.deepEqual(ids(await list(cm.u,{...base,time_filter:'past',page:{limit:200,sort:'starts_at_asc'}})),createdReservations.slice(0,2));
   assert.deepEqual(ids(await list(cm.u,{...base,time_filter:'all',page:{limit:200,sort:'starts_at_asc'}})),createdReservations);
   assert.deepEqual(ids(await list(cm.u,{...base,page:{limit:200,sort:'starts_at_asc'}})),createdReservations);
   for(const change of [{time_filter:'past'},{time_filter:'all'},{person_id:student.p}])await fail(cm.u,'reservation_list_v1',{...base,time_filter:'upcoming',...change,page:{...base.page,cursor:first.next_cursor}},'VALIDATION_FAILED');
   await fail(owner,'reservation_list_v1',{...base,time_filter:'upcoming',page:{...base.page,cursor:first.next_cursor}},'VALIDATION_FAILED');
   assert.deepEqual(ids(await list(student.u,{...base,time_filter:'all'})),[]);
   const overlap={starts_at:new Date(at).toISOString(),ends_at:new Date(at+900000).toISOString()};
   assert.deepEqual(ids(await list(cm.u,{...base,interval:overlap,time_filter:'past'})),[createdReservations[1]]);
   assert.deepEqual(ids(await list(cm.u,{...base,interval:overlap,time_filter:'upcoming'})),[]);
  }finally{
   await db.query('delete from core.reservations where id=any($1)',[createdReservations]);await db.query('delete from core.sessions where id=any($1)',[createdSessions]);reservations.splice(previousCount);
  }
 });
 await t.test('session directory and source summaries cross native Auth Edge RPC without granting roster rights',async()=>{
  const entry=key();
  await db.query("insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values($1,$2,$3,$4,$5,now(),'waiting')",[entry,org,c1,s1,otherStudent.p]);
  try{
   const request={center_id:c1,operation:'waitlist_join_v1',selector:{operation:'waitlist_join_v1',key:{directory:'session',session_id:s1,view:'entries',status:'waiting'}},page:{limit:1}};
   const page=await must(cm.u,'management_state_get_v1',scope(request));assert.equal(page.items[0].entity.id,entry);assert.equal(page.items[0].waitlist_detail.person_id,otherStudent.p);assert.equal(typeof page.items[0].waitlist_display_name,'string');
   await fail(student.u,'management_state_get_v1',request,'FORBIDDEN');
   const summary=await list(cm.u,{center_id:c1,session_id:s1,include_source_summary:true});assert(summary.items.length>0);assert(summary.items.every(x=>x.source_summary.status==='unassigned'));
   const restricted=await list(instructor.u,{center_id:c1,session_id:s1,include_source_summary:true});assert(restricted.items.length>0);assert(restricted.items.every(x=>x.source_summary.status==='restricted'&&!('source_sale_id' in x.source_summary)));
   assert((await list(cm.u,{center_id:c1,session_id:s1})).items.every(x=>!('source_summary' in x)));
  }finally{await db.query('delete from core.waitlist_entries where id=$1',[entry]);}
 });
 await t.test('assigned instructor reads real room labels without room management authority',async()=>{
  const labels=[{room_id:room,name:'Read room'}];
  assert.deepEqual((await get(instructor.u,s1,{center_id:c1,include_room_labels:true})).room_labels,labels);
  assert.deepEqual((await get(assistant.u,s1,{center_id:c1,include_room_labels:true})).room_labels,labels);
  assert(!('room_labels' in await get(owner,s1,{center_id:c1,include_room_labels:true})));
  assert(!('room_labels' in await get(instructor.u,s1,{center_id:c1})));
  assert(!('room_labels' in await get(student.u,s1,{center_id:c1,include_room_labels:true})));
  const page=await cal(instructor.u,{center_id:c1,resource:{kind:'person',id:instructor.p},include_room_labels:true});assert.equal(page.items.length,1);assert.deepEqual(page.items[0].room_labels,labels);
  await fail(instructor.u,'management_state_get_v1',{center_id:c1,operation:'room_save_v1',selector:{operation:'room_save_v1',key:{room_id:room}}},'FORBIDDEN');
 });
 await t.test('student sees own active and historical records, never another roster',async()=>{
  assert.deepEqual(ids(await list(student.u)).sort(),[r1,cancelled].sort());
  assert.deepEqual(ids(await list(student.u,{person_id:otherStudent.p})),[]);
  assert.deepEqual(ids(await list(student.u,{session_id:s1})),[r1]);
  assert.deepEqual(ids(await cal(student.u)).sort(),[s1,s2].sort());
  assert.equal((await get(student.u,s1)).discipline_id,discipline);
  await fail(student.u,'session_get_v1',{session_id:s3},'FORBIDDEN');
  await fail(student.u,'reservation_list_v1',{session_id:s3,page:{}},'FORBIDDEN');
  assert((await get(student.u,s1)).assignments.every(a=>!('agreement_id' in a)));
 });
 await t.test('opt-in calendar and self reservation projections preserve native visibility and originating cursors',async()=>{
  const options={center_id:c1,page:{limit:1},include_session_summary:true};
  const first=await cal(owner,options),detail=await get(owner,s1,{center_id:c1});
  assert(first.next_cursor);
  assert.equal(first.items[0].id,s1);
  const {state,attendance_state,version,format,class_id}=detail;
  assert.deepEqual(first.items[0].session_summary,{state,attendance_state,version,format,class_id,
   assignments:detail.assignments.map(({person_id,duty})=>({person_id,duty}))});
  assert.equal((await cal(owner,{...options,include_session_summary:false})).items[0].session_summary,undefined);
  const page={limit:1,cursor:first.next_cursor};
  assert.deepEqual(ids(await cal(owner,{...options,page})),[s2]);
  await fail(owner,'calendar_get_v1',{interval,...options,include_session_summary:false,page},'VALIDATION_FAILED');
  await fail(cm.u,'calendar_get_v1',{interval,...options,center_id:c2},'FORBIDDEN');
  assert.deepEqual(ids(await cal(instructor.u,{...options,resource:{kind:'person',id:instructor.p}})),[s1]);
  const r=await list(student.u,{center_id:c1,include_self_summary:true});
  const mine=r.items.find(x=>x.id===r1);
  assert.equal(mine.self_summary.title,first.items[0].title);
  assert.equal(mine.self_summary.session_state,state);
  assert.equal(mine.self_summary.session_version,version);
  assert.equal(mine.self_summary.format,format);
  assert.equal(mine.self_summary.discipline_id,detail.discipline_id);
  assert.equal(mine.self_summary.attendance_result,null);
  assert.equal(mine.self_summary.cancellation.source,'reservation_policy');
  assert.equal(mine.self_summary.cancellation.policy_version_id,policy);
  assert(!('room_labels' in mine.self_summary));
  assert(!('instructor_labels' in mine.self_summary));
  assert((await list(cm.u,{center_id:c1,include_self_summary:true})).items.every(x=>x.self_summary===undefined));
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F08') where id=$1",[plan]);
  try{
   await fail(student.u,'session_get_v1',{center_id:c1,session_id:s1},'PLAN_FEATURE_UNAVAILABLE');
   const limited=(await list(student.u,{center_id:c1,include_self_summary:true})).items.find(x=>x.id===r1).self_summary;
   assert.equal(limited.title,mine.self_summary.title);
   for(const field of ['session_version','session_state','format','discipline_id'])assert(!(field in limited));
  }finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F08') where id=$1",[plan]);}
 });
 await t.test('own reservation labels match the currently visible member lesson',async()=>{
  const tomorrow=Date.now()+86400000;
  const starts_at=new Date(tomorrow).toISOString(),ends_at=new Date(tomorrow+3600000).toISOString();
  const sid=await session(c1,starts_at,ends_at,null,[instructor]);
  let rid;
  try{
   await bookRoom(sid,starts_at,ends_at);
   rid=await reservation(sid,student.p);
   const discovery=await cal(student.u,{center_id:c1,member_discovery:true,interval:{starts_at,ends_at}});
   const lesson=discovery.items.find(row=>row.id===sid)?.member_lesson;
   assert(lesson,'the assigned reader must see the same upcoming lesson');
   const result=await list(student.u,{center_id:c1,reservation_id:rid,include_self_summary:true});
   const summary=result.items[0].self_summary;
   assert.deepEqual(summary.room_labels,['Read room']);
   assert.deepEqual(summary.instructor_labels,['schedule-instructor']);
   assert.deepEqual(summary.room_labels,lesson.room_labels);
   assert.deepEqual(summary.instructor_labels,lesson.instructor_labels);
   assert.equal(summary.session_version,lesson.version);
   assert.deepEqual(ids(await list(otherStudent.u,{center_id:c1,reservation_id:rid,include_self_summary:true})),[]);
  }finally{
   if(rid){await db.query('delete from core.reservations where id=$1',[rid]);reservations.splice(reservations.indexOf(rid),1);}
   await db.query('delete from core.resource_bookings where session_id=$1',[sid]);
   await db.query('delete from core.session_assignments where session_id=$1',[sid]);
   await db.query('delete from core.sessions where id=$1',[sid]);
  }
 });
 await t.test('calendar management labels match exact active room and permitted instructor reads',async()=>{
  const roomRead=await must(cm.u,'management_state_get_v1',scope({center_id:c1,operation:'room_save_v1',selector:{operation:'room_save_v1',key:{room_id:room,include_details:true}}}));
  const personRead=await must(cm.u,'person_get_v1',scope({center_id:c1,person_id:instructor.p}));
  const options={center_id:c1,include_session_summary:true,include_management_labels:true};
  const summary=async actor=>(await cal(actor,options)).items.find(row=>row.id===s1).session_summary;
  assert.equal(roomRead.items[0].state,'active');
  const visible=await summary(cm.u);
  assert.deepEqual(visible.room_labels,[{room_id:room,name:roomRead.items[0].current.values.name}]);
  assert.deepEqual(visible.instructor_labels,[{person_id:instructor.p,name:personRead.display_name}]);
  const regular=(await cal(cm.u,{...options,include_management_labels:false})).items.find(row=>row.id===s1).session_summary;
  assert(!('room_labels' in regular));
  assert(!('instructor_labels' in regular));
  await fail(cm.u,'calendar_get_v1',{interval,page:{},...options,include_session_summary:false},'VALIDATION_FAILED');
  const restricted=await summary(student.u);
  assert(!restricted.room_labels?.some(label=>label.room_id===room));
  assert(!restricted.instructor_labels?.some(label=>label.person_id===instructor.p));
  await db.query("update core.rooms set state='inactive' where org_id=$1 and id=$2",[org,room]);
  try{assert(!(await summary(cm.u)).room_labels?.some(label=>label.room_id===room));}
  finally{await db.query("update core.rooms set state='active' where org_id=$1 and id=$2",[org,room]);}
 });
 await t.test('exact session titles and attendance names preserve the existing read boundaries',async()=>{
  const options={center_id:c1,include_title:true,include_person_display_names:true};
  const exact=await get(assistant.u,s1,options);
  const assistantName=(await must(assistant.u,'person_get_v1',scope({center_id:c1,person_id:assistant.p}))).display_name;
  assert(exact.person_labels.some(label=>label.person_id===assistant.p&&label.name===assistantName));
  assert(exact.person_labels.every(label=>[instructor.p,assistant.p].includes(label.person_id)));
  assert.deepEqual((await get(student.u,s1,options)).person_labels,[]);
  assert.equal((await get(instructor.u,s1,options)).title,'Class one');
  assert.equal((await get(student.u,s2,options)).title,'Salsa');
  assert.equal((await get(instructor.u,s1,{center_id:c1})).title,undefined);
  await fail(instructor.u,'session_get_v1',{...options,session_id:s2},'NOT_FOUND');
  const before=await attendance(instructor.u,s1);
  const named=await attendance(instructor.u,s1,{include_person_display_names:true});
  assert.deepEqual(named.entries.map(({person_display_name,...entry})=>entry),before.entries);
  assert(before.entries.every(entry=>!('person_display_name' in entry)));
  assert.equal(named.session_version,(await get(instructor.u,s1,options)).version);
  for(const entry of named.entries){
   const personView=await must(instructor.u,'person_get_v1',scope({center_id:c1,person_id:entry.person_id}));
   assert.equal(entry.person_display_name,personView.display_name);
  }
  assert.equal(named.entries.length,2);
  await fail(student.u,'attendance_get_v1',{center_id:c1,session_id:s1,include_person_display_names:true},'FORBIDDEN');
 });
 await t.test('assigned instructor and assistant see only authorized program and required roster',async()=>{
  for(const a of [instructor,assistant]){
   assert.deepEqual(ids(await cal(a.u)),[s1]);
   assert.deepEqual(ids(await list(a.u)).sort(),[r1,r2].sort());
   await fail(a.u,'session_get_v1',{session_id:s2},'NOT_FOUND');
   assert((await get(a.u,s1)).assignments.every(v=>!('agreement_id' in v)));
  }
 });
 await t.test('active class duty is scoped and requires a current login role',async()=>{
  const id=key();
  await db.query("insert into core.class_assignments(id,org_id,center_id,class_id,person_id,duty,state) values($1,$2,$3,$4,$5,'instructor','active')",[id,org,c1,cls,instructor.p]);
  const selection={resource:{kind:'person',id:instructor.p}};
  const summary=async actor=>(await cal(actor,{...selection,include_session_summary:true})).items.find(row=>row.id===s1)?.session_summary;
  const changeAssignment=(state,origin)=>db.query('update core.session_assignments set state=$1,origin_class_assignment_id=$2 where org_id=$3 and session_id=$4 and person_id=$5',[state,origin,org,s1,instructor.p]);
  try{
   await changeAssignment('inactive',null);
   assert.equal((await get(instructor.u,s1)).id,s1);
   const detail=await get(instructor.u,s1);
   assert.deepEqual(ids(await cal(instructor.u,{resource:{kind:'person',id:instructor.p}})),[s1]);
   const inherited=await summary(instructor.u);
   assert.deepEqual(inherited.actor_class_duty,{duty:'instructor'});
   assert.equal(inherited.version,detail.version);
   assert.equal((await summary(cm.u)).actor_class_duty,undefined);
   await fail(instructor.u,'person_get_v1',{center_id:c1,person_id:student.p},'NOT_FOUND');
   const classAttendance=await attendance(instructor.u,s1,{include_person_display_names:true});
   assert.equal(classAttendance.entries.find(entry=>entry.reservation_id===r1)?.person_id,student.p);
   assert(classAttendance.entries.every(entry=>!('person_display_name' in entry)));
   await db.query("update core.sessions set assignment_mode='inherit' where org_id=$1 and id=$2",[org,s1]);
   assert.equal(await summary(instructor.u),undefined);
   await changeAssignment('active',id);
   assert.deepEqual((await summary(instructor.u)).actor_class_duty,{duty:'instructor'});
   await db.query("update core.class_assignments set state='inactive' where id=$1",[id]);
   assert.equal((await summary(instructor.u)).actor_class_duty,undefined);
   await changeAssignment('inactive',null);
   await fail(instructor.u,'session_get_v1',{session_id:s1},'NOT_FOUND');
   await fail(instructor.u,'session_get_v1',{session_id:s1,include_center_id:true},'NOT_FOUND');
  }finally{
   await changeAssignment('active',null);
   await db.query("update core.sessions set assignment_mode='legacy' where org_id=$1 and id=$2",[org,s1]);
   await db.query('delete from core.class_assignments where id=$1',[id]);
  }
 });
 await t.test('center managers and explicitly granted staff cannot expand into another center',async()=>{
  assert.deepEqual(ids(await list(cm.u)).sort(),[r1,r2,r3,cancelled].sort());
  await fail(cm.u,'calendar_get_v1',{center_id:c2,interval,page:{}},'FORBIDDEN');
  await fail(cm.u,'session_get_v1',{session_id:s3,center_id:c1},'NOT_FOUND');
  for(const op of ['calendar_get_v1','reservation_list_v1'])await fail(staff.u,op,{interval,page:{}},'FORBIDDEN');
  await mut('permission_set_v1',{center_id:c1,person_id:staff.p,expected_version:1,permission:'reservation.write',enabled:true});
  assert.deepEqual(ids(await list(staff.u)).sort(),[r1,r2,r3,cancelled].sort());
  const permissionRequest={center_id:c1,operation:'permission_set_v1',selector:{
   operation:'permission_set_v1',key:{person_id:staff.p,permission_summary:true}},page:{}};
  const readPermissions=async request=>(await must(owner,'management_state_get_v1',scope(request))).items[0];
  const summary=await readPermissions(permissionRequest);
  assert.deepEqual(summary.entity,{type:'people',id:staff.p});
  assert.equal(summary.versions[0].version,2);
  const overrides=summary.current.values.permission_overrides;
  assert.deepEqual(overrides.find(row=>row.permission==='reservation.write'),{
   permission:'reservation.write',override_exists:true,enabled:true,override_version:1,effective_staff_grant:true,
  });
  assert.deepEqual(overrides.find(row=>row.permission==='attendance.draft'),{
   permission:'attendance.draft',override_exists:false,enabled:null,override_version:null,effective_staff_grant:false,
  });
  const exact=await readPermissions({...permissionRequest,selector:{...permissionRequest.selector,key:{person_id:staff.p,permission:'reservation.write'}}});
  assert.equal(exact.current.values.enabled,true);
  assert.deepEqual(exact.versions,summary.versions);
  await fail(staff.u,'management_state_get_v1',permissionRequest,'FORBIDDEN');
  await fail(cm.u,'management_state_get_v1',{...permissionRequest,center_id:c2},'FORBIDDEN');
  await fail(staff.u,'session_get_v1',{session_id:s3},'FORBIDDEN');
  await fail(staff.u,'calendar_get_v1',{center_id:c2,interval,page:{}},'FORBIDDEN');
 });
 await t.test('team permission matrix pages eligible people with live scoped authority and write versions',async()=>{
  const writerTarget=await linked('matrix-writer-target','staff');
  const op='management_state_get_v1';
  const request={center_id:c1,operation:'permission_set_v1',selector:{
   operation:'permission_set_v1',key:{directory:'center'}},page:{limit:1}};
  const read=(actor=owner,input=request)=>must(actor,op,scope(input));
  const first=await read();
  assert.equal(first.items.length,1);assert(first.next_cursor);
  const people=[...first.items],seen=new Set([first.next_cursor]);
  let cursor=first.next_cursor;
  while(cursor){
   const page=await read(owner,{...request,page:{limit:1,cursor}});
   assert.equal(page.items.length,1);
   people.push(...page.items);
   cursor=page.next_cursor;
   if(cursor){assert(!seen.has(cursor));seen.add(cursor);}
  }
  assert.deepEqual(people.map(row=>row.entity.id).sort(),[ownerPerson,cm.p,instructor.p,staff.p,writerTarget.p].sort());
  const staffRow=people.find(row=>row.entity.id===staff.p);
  const matrixValues=staffRow.current.values;
  const summary=(await read(owner,{...request,selector:{...request.selector,key:{person_id:staff.p,permission_summary:true}}})).items[0];
  assert.deepEqual(staffRow.versions,summary.versions);
  assert.equal(matrixValues.person_id,staff.p);
  assert.equal(matrixValues.display_name,'schedule-staff');
  assert.deepEqual(matrixValues.team_roles,['staff']);
  assert.deepEqual(matrixValues.permission_overrides,
   summary.current.values.permission_overrides.map(cell=>({...cell,writable:true})));
  const permissionsFor=id=>people.find(row=>row.entity.id===id).current.values.permission_overrides;
  assert.deepEqual(permissionsFor(cm.p).map(cell=>cell.permission),['sale.discount']);
  assert(!permissionsFor(instructor.p).some(cell=>cell.permission==='reservation.capacity_override'));
  const writerVersion=people.find(row=>row.entity.id===writerTarget.p).versions[0].version;
  await mut('permission_set_v1',{center_id:c1,person_id:writerTarget.p,expected_version:writerVersion,
   permission:'request.write',enabled:false});
  const refreshed=(await read(owner,{...request,page:{}})).items.find(row=>row.entity.id===writerTarget.p);
  assert.equal(refreshed.versions[0].version,writerVersion+1);
  assert.deepEqual(refreshed.current.values.permission_overrides.find(cell=>cell.permission==='request.write'),{
   permission:'request.write',override_exists:true,enabled:false,override_version:1,effective_staff_grant:false,writable:true,
  });

  const continuation={...request,page:{limit:1,cursor:first.next_cursor}};
  assert.deepEqual((await read(owner,{...request,center_id:c2})).items.map(row=>row.entity.id),[ownerPerson]);
  await fail(owner,op,{...continuation,center_id:c2},'VALIDATION_FAILED');
  await fail(cm.u,op,continuation,'VALIDATION_FAILED');
  await fail(cm.u,op,{...request,center_id:c2},'FORBIDDEN');
  await fail(staff.u,op,request,'FORBIDDEN');
  await fail(stranger,op,request,'NOT_FOUND');
  await fail(owner,op,{...request,org_id:key()},'NOT_FOUND');
  await fail(owner,op,{...request,selector:{...request.selector,key:{directory:'center',person_id:staff.p}}},'VALIDATION_FAILED');
  await fail(owner,op,{...request,entity:{type:'people',id:staff.p}},'VALIDATION_FAILED');

  const cmPage=await read(cm.u);
  assert(cmPage.next_cursor);
  await db.query("update core.role_assignments set state='inactive' where id=$1",[cm.grant.primary_id]);
  try{
   await fail(cm.u,op,{...request,page:{limit:1,cursor:cmPage.next_cursor}},'FORBIDDEN');
  }finally{
   await db.query("update core.role_assignments set state='active' where id=$1",[cm.grant.primary_id]);
  }
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F05') where id=$1",[plan]);
  try{
   await fail(owner,op,request,'PLAN_FEATURE_UNAVAILABLE');
  }finally{
   await db.query("update core.saas_plan_versions set features=array_append(features,'F05') where id=$1",[plan]);
  }
 });
 await t.test('org owner reads all centers without a center-manager grant; unlinked tenant is hidden',async()=>{
  await mut('center_manager_revoke_v1',{center_id:c2,person_id:ownerPerson,expected_version:1,reason:'Read only owner'});
  assert.equal((await get(owner,s3)).id,s3);assert(ids(await cal(owner)).includes(s3));
  await fail(stranger,'calendar_get_v1',{interval,page:{}},'NOT_FOUND');
  await fail(owner,'session_get_v1',{session_id:key()},'NOT_FOUND');
  await fail(owner,'calendar_get_v1',{org_id:key(),interval,page:{}},'NOT_FOUND');
 });
 await t.test('real foreign tenant identifiers cannot select rows or widen a cursor scope',async()=>{
  const a=await must(stranger,'account_get_v1');
  const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:a.id,name:'Foreign schedule',initial_plan_id:plan},key())).primary_id;
  const foreignCenter=(await must(stranger,'center_create_v1',{org_id:foreignOrg,name:'Foreign center',timezone:'UTC'},key())).primary_id;
  for(const op of ['calendar_get_v1','session_get_v1','reservation_list_v1']){
   const b=op==='session_get_v1'?{session_id:s1}:{interval,page:{}};
   await fail(stranger,op,{...b,org_id:foreignOrg,center_id:c1},'NOT_FOUND');
   await fail(owner,op,{...b,center_id:foreignCenter},'NOT_FOUND');
   await fail(stranger,op,b,'NOT_FOUND');
  }
  const payment=await must(stranger,'saas_payment_submit_v1',{
   org_id:foreignOrg,amount_minor:'1000',currency:'TRY',reference:'synthetic foreign schedule',occurred_at:new Date().toISOString(),
  },key());
  await must(platform,'saas_payment_verify_v1',{org_id:foreignOrg,payment_id:payment.primary_id,accepted:true},key());
  await fail(stranger,'session_get_v1',{org_id:foreignOrg,session_id:s1,include_center_id:true},'NOT_FOUND');
 });
 await t.test('a session written through the current command is read with the same version and UTC times',async()=>{
  const it={starts_at:'2027-01-10T12:00:00+03:00',ends_at:'2027-01-10T13:00:00+03:00'};
  const made=await mut('session_create_v1',{center_id:c1,discipline_id:discipline,format:'group',interval:it,resources:[],assignments:[],capacity:{total:4}});
  const view=await get(owner,made.primary_id);assert.equal(view.version,made.version);assert.equal(Date.parse(view.starts_at),Date.parse(it.starts_at));
  assert.deepEqual(ids(await cal(owner,{interval:it})),[made.primary_id]);
 });
 await t.test('resource, person, session, interval and center filters intersect with access',async()=>{
  assert.deepEqual(ids(await cal(cm.u,{resource:{kind:'room',id:room}})),[s1]);
  assert.deepEqual(ids(await cal(instructor.u,{resource:{kind:'person',id:assistant.p}})),[s1]);
  assert.deepEqual(ids(await cal(student.u,{resource:{kind:'room',id:key()}})),[]);
  assert.deepEqual(ids(await list(cm.u,{person_id:otherStudent.p,session_id:s1,interval})),[r2]);
  assert.deepEqual(ids(await list(owner,{center_id:c2})),[r4]);
 });
 await t.test('combined room and person filters narrow the authorized calendar before cursor paging',async()=>{
  const created=[];
  const fixture=async (start,end,assigned,roomBooked)=>{
   const sid=await session(c1,start,end,null,assigned);
   created.push(sid);
   if(roomBooked)await bookRoom(sid,start,end);
   return sid;
  };
  try{
   const personOnly=await fixture('2026-11-01T17:00:00Z','2026-11-01T18:00:00Z',[instructor],false);
   const roomOnly=await fixture('2026-11-01T18:00:00Z','2026-11-01T19:00:00Z',[],true);
   const match=await fixture('2026-11-01T22:00:00Z','2026-11-01T23:00:00Z',[instructor],true);
   const resource={kind:'room',id:room},resource_person_id=instructor.p;
   assert.deepEqual(ids(await cal(cm.u,{resource:{kind:'person',id:resource_person_id}})),[personOnly,s1,match]);
   assert.deepEqual(ids(await cal(cm.u,{resource})),[roomOnly,s1,match]);
   const query={interval,center_id:c1,resource,resource_person_id,page:{limit:1}};
   const first=await cal(cm.u,query);
   assert.deepEqual(ids(first),[s1]);
   assert(first.next_cursor);
   const second=await cal(cm.u,{...query,page:{limit:1,cursor:first.next_cursor}});
   assert.deepEqual(ids(second),[match]);
   assert.equal(second.next_cursor,null);
   await fail(cm.u,'calendar_get_v1',{...query,resource_person_id:assistant.p,page:{limit:1,cursor:first.next_cursor}},'VALIDATION_FAILED');
   await fail(cm.u,'calendar_get_v1',{...query,resource:{kind:'person',id:resource_person_id}},'VALIDATION_FAILED');
   await fail(cm.u,'calendar_get_v1',{...query,resource:null},'VALIDATION_FAILED');
   assert.deepEqual(ids(await cal(student.u,{...query,page:{}})),[s1]);
  }finally{
   await db.query('delete from core.resource_bookings where session_id=any($1)',[created]);
   await db.query('delete from core.session_assignments where session_id=any($1)',[created]);
   await db.query('delete from core.sessions where id=any($1)',[created]);
  }
 });
 await t.test('half-open overlap preserves a session crossing center midnight and excludes touching edges',async()=>{
  const day={starts_at:'2026-11-02T00:00:00+03:00',ends_at:'2026-11-03T00:00:00+03:00'};
  assert.deepEqual(ids(await cal(cm.u,{center_id:c1,interval:day})).sort(),[s1,s2].sort());
  const equalUtc={starts_at:'2026-11-01T21:00:00Z',ends_at:'2026-11-02T21:00:00Z'};
  assert.deepEqual(ids(await cal(cm.u,{interval:equalUtc})),ids(await cal(cm.u,{interval:day})));
  const before={starts_at:'2026-11-01T19:00:00Z',ends_at:'2026-11-01T20:30:00Z'};
  assert.deepEqual(ids(await cal(cm.u,{interval:before})),[]);
  assert.deepEqual(ids(await list(cm.u,{interval:before})),[]);
 });
 await t.test('DST repeated local times remain two ordered UTC instants; missing offsets rejected',async()=>{
  const fold={starts_at:'2026-10-25T00:00:00Z',ends_at:'2026-10-25T03:00:00Z'};
  const a=await cal(owner,{center_id:c2,interval:fold});assert.deepEqual(ids(a),[fold1,fold2]);assert(Date.parse(a.items[0].starts_at)<Date.parse(a.items[1].starts_at));
  await fail(owner,'calendar_get_v1',{interval:{starts_at:'2026-10-25T02:00:00',ends_at:'2026-10-25T03:00:00'},page:{}},'VALIDATION_FAILED');
 });
 await t.test('keyset pages preserve tied order in every supported sort without duplication',async()=>{
  for(const sort of ['created_at_asc','created_at_desc','starts_at_asc']){
   const expected=ids(await list(owner,{page:{sort}})),seen=[];let cursor=null;
   do{const p=await list(owner,{page:{limit:1,sort,cursor}});assert(p.as_of);seen.push(...ids(p));cursor=p.next_cursor;}while(cursor);
   assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,reservations.length);
   if(sort==='created_at_asc')assert.deepEqual(seen,[...reservations].sort());
   if(sort==='created_at_desc')assert.deepEqual(seen,[...reservations].sort().reverse());
  }
  const expected=ids(await cal(owner)),seen=[];let cursor=null;
  do{const p=await cal(owner,{page:{limit:1,cursor}});seen.push(...ids(p));cursor=p.next_cursor;}while(cursor);
  assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,seen.length);
 });
 await t.test('cursor binds operation, actor, tenant, filters and sort; malformed cursor rejected',async()=>{
  const a=await list(owner,{page:{limit:1}});assert(a.next_cursor);
  for(const b of [{person_id:student.p},{center_id:c1},{interval},{page:{sort:'starts_at_asc'}}])
   await fail(owner,'reservation_list_v1',{...b,page:{...b.page,cursor:a.next_cursor}},'VALIDATION_FAILED');
  await fail(cm.u,'reservation_list_v1',{page:{cursor:a.next_cursor}},'VALIDATION_FAILED');
  await fail(owner,'calendar_get_v1',{interval,page:{cursor:a.next_cursor}},'VALIDATION_FAILED');
  for(const cursor of ['broken',Buffer.from('{}').toString('hex'),Buffer.from('null').toString('hex')])await fail(owner,'reservation_list_v1',{page:{cursor}},'VALIDATION_FAILED');
 });
 await t.test('unsupported sorts, limits, reversed intervals and injected actor fields rejected',async()=>{
  await fail(owner,'calendar_get_v1',{interval,page:{sort:'created_at_asc'}},'VALIDATION_FAILED');
  await fail(owner,'reservation_list_v1',{page:{sort:'display_name_asc'}},'VALIDATION_FAILED');
  for(const limit of [0,201])await fail(owner,'reservation_list_v1',{page:{limit}},'VALIDATION_FAILED');
  for(const bad of [{starts_at:interval.ends_at,ends_at:interval.starts_at},{starts_at:interval.starts_at,ends_at:interval.starts_at}])
   await fail(owner,'calendar_get_v1',{interval:bad,page:{}},'VALIDATION_FAILED');
  await fail(student.u,'session_get_v1',{session_id:s1,actor:ownerPerson},'VALIDATION_FAILED');
 });
 await t.test('calendar merges own events without participant data and respects event feature gate',async()=>{
  const starts_at='2026-11-01T12:00:00Z',ends_at='2026-11-01T13:00:00Z';
  const e=(await mut('event_save_v1',{center_id:c1,name:'Read event',interval:{starts_at,ends_at},timezone:'Europe/Istanbul',venue:{kind:'external',name:'Test',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{nominal:10,maximum:10},terms:{fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'consume',no_show:'consume'},refund:{method:'none'}},discipline_ids:[],assignments:[{person_id:instructor.p,duty:'instructor',fee_minor:'0',currency:'TRY'}]})).primary_id;
  const event=(await cal(instructor.u)).items.find(v=>v.id===e);assert.equal(event.type,'event');assert.deepEqual(event.discipline_ids,[]);assert(!('registrations' in event));assert(!('fee_minor' in event));
  assert(!ids(await cal(student.u)).includes(e));
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F29') where id=$1",[plan]);
  try{assert(!ids(await cal(owner)).includes(e));}finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F29') where id=$1",[plan]);}
 });
 await t.test('permission and role revocation apply to the same JWT and cursor on the next read',async()=>{
  const saved=await list(staff.u,{page:{limit:1}});assert(saved.next_cursor);
  await mut('permission_set_v1',{center_id:c1,person_id:staff.p,expected_version:2,permission:'reservation.write',enabled:false});
  await fail(staff.u,'reservation_list_v1',{page:{cursor:saved.next_cursor}},'FORBIDDEN');
  const savedI=await list(instructor.u,{page:{limit:1}});assert(savedI.next_cursor);
  const revokeImpact=await mut('role_revoke_preview_v1',{center_id:c1,assignment_id:instructor.grant.primary_id,expected_version:1});
  const raced=await Promise.all([
   mut('role_revoke_v1',{center_id:c1,assignment_id:instructor.grant.primary_id,expected_version:1,reason:'Schedule revoke',impact_approval:{id:revokeImpact.id,token:revokeImpact.token}}),
   call(instructor.u,'reservation_list_v1',scope({page:{cursor:savedI.next_cursor}}))
  ]);
  const read=raced[1].result;
  if(read.ok)assert(read.data.items.every(v=>[r1,r2].includes(v.id)));
  else assert.equal(read.error.code,'FORBIDDEN');
  await fail(instructor.u,'reservation_list_v1',{page:{cursor:savedI.next_cursor}},'FORBIDDEN');
  await fail(instructor.u,'session_get_v1',{session_id:s1},'FORBIDDEN');
  await fail(instructor.u,'calendar_get_v1',{interval,page:{}},'FORBIDDEN');
 });
 await t.test('assignment revoke removes roster access without waiting for token refresh',async()=>{
  await db.query("update core.session_assignments set state='inactive' where org_id=$1 and person_id=$2",[org,assistant.p]);
  assert.deepEqual(ids(await list(assistant.u)),[]);
  assert.deepEqual(ids(await cal(assistant.u)),[]);
  await fail(assistant.u,'session_get_v1',{session_id:s1},'NOT_FOUND');
 });
 await t.test('student deactivation preserves own history without granting another record',async()=>{
  await db.query("update core.center_relationships set state='inactive' where org_id=$1 and person_id=$2 and kind='student'",[org,student.p]);
  assert.deepEqual(ids(await list(student.u)).sort(),[r1,cancelled].sort());
  assert.deepEqual(ids(await list(student.u,{person_id:otherStudent.p})),[]);
 });
 await t.test('account link removal invalidates existing token and all read routes',async()=>{
  await db.query("update core.account_links set state='revoked' where org_id=$1 and person_id=$2",[org,student.p]);
  for(const op of ['calendar_get_v1','reservation_list_v1','session_get_v1'])await fail(student.u,op,{...(op==='session_get_v1'?{session_id:s1}:{page:{},...(op==='calendar_get_v1'?{interval}:{})})},'NOT_FOUND');
  await fail(student.u,'session_get_v1',{session_id:s1,include_center_id:true},'NOT_FOUND');
 });
 await t.test('current plan, billing, center state and provider session remain mandatory',async()=>{
  await db.query("update core.centers set state='inactive' where id=$1",[c2]);
  assert(!ids(await cal(owner)).includes(s3));
  await db.query("update core.centers set state='active' where id=$1",[c2]);
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F08') where id=$1",[plan]);
  try{
   await fail(owner,'session_get_v1',{session_id:s1},'PLAN_FEATURE_UNAVAILABLE');
   await fail(owner,'session_get_v1',{session_id:s1,include_center_id:true},'PLAN_FEATURE_UNAVAILABLE');
   await fail(owner,'calendar_get_v1',{interval,page:{}},'PLAN_FEATURE_UNAVAILABLE');
  }
  finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F08') where id=$1",[plan]);}
  await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
  try{assert(!ids(await cal(owner)).includes(s3));await fail(owner,'session_get_v1',{session_id:s3},'PLAN_FEATURE_UNAVAILABLE');}finally{await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);}
  await db.query("update core.saas_subscriptions set state='suspended' where org_id=$1",[org]);
  try{await fail(owner,'reservation_list_v1',{page:{}},'SERVICE_UNAVAILABLE');}finally{await db.query("update core.saas_subscriptions set state='active' where org_id=$1",[org]);}
  await db.query('delete from auth.sessions where id=$1',[cm.u.session_id]);
  const r=await call(cm.u,'reservation_list_v1',scope({page:{}}));assert.equal(r.result.ok,false);assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(r.result.error.code));
 });
 await t.test('reads create no financial, entitlement, receipt or audit side effects; direct RPC denied',async()=>{
  const snapshot=async()=>JSON.stringify(await rows("select (select count(*) from core.operation_receipts where org_id=$1) receipts,(select count(*) from core.audit_events where org_id=$1) audit,(select count(*) from core.entitlement_movements where org_id=$1) rights,(select count(*) from core.cash_movements where org_id=$1) cash,(select count(*) from core.outbox_jobs where org_id=$1) outbox",[org]));
  const before=await snapshot();await cal(owner);await list(owner);await get(owner,s1);assert.equal(await snapshot(),before);
  await get(owner,s1,{include_center_id:true});assert.equal(await snapshot(),before);
  const {env}=context();
  for(const op of ['calendar_get_v1','session_get_v1','reservation_list_v1']){
   const r=await fetch(env.API_URL+'/rest/v1/rpc/'+op,{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:{},p_actor_auth_id:owner.id,p_session_id:owner.session_id,p_ids:[]})});assert(!r.ok);
  }
 });
 }finally{await db.end();}
});
import './member-lesson-discovery-acceptance.mjs';
