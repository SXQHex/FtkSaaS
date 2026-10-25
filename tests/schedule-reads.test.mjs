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
 await db.query("insert into core.resource_bookings(id,org_id,center_id,session_id,resource_kind,resource_id,starts_at,ends_at,state) values($1,$2,$3,$4,'room',$5,'2026-11-01T20:30:00Z','2026-11-01T21:30:00Z','active')",[key(),org,c1,s1,room]);
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
 const ids=x=>x.items.map(v=>v.id);
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
 await t.test('assigned instructor and assistant see only authorized program and required roster',async()=>{
  for(const a of [instructor,assistant]){
   assert.deepEqual(ids(await cal(a.u)),[s1]);
   assert.deepEqual(ids(await list(a.u)).sort(),[r1,r2].sort());
   await fail(a.u,'session_get_v1',{session_id:s2},'NOT_FOUND');
   assert((await get(a.u,s1)).assignments.every(v=>!('agreement_id' in v)));
  }
 });
 await t.test('active class duty is scoped and requires a current login role',async()=>{
  const id=key();await db.query("insert into core.class_assignments(id,org_id,center_id,class_id,person_id,duty,state) values($1,$2,$3,$4,$5,'instructor','active')",[id,org,c1,cls,instructor.p]);
  await db.query("update core.session_assignments set state='inactive' where org_id=$1 and person_id=$2",[org,instructor.p]);
  assert.equal((await get(instructor.u,s1)).id,s1);
  assert.deepEqual(ids(await cal(instructor.u,{resource:{kind:'person',id:instructor.p}})),[s1]);
  await db.query("update core.class_assignments set state='inactive' where id=$1",[id]);
  await fail(instructor.u,'session_get_v1',{session_id:s1},'NOT_FOUND');
  await db.query("update core.session_assignments set state='active' where org_id=$1 and person_id=$2",[org,instructor.p]);
 });
 await t.test('center managers and explicitly granted staff cannot expand into another center',async()=>{
  assert.deepEqual(ids(await list(cm.u)).sort(),[r1,r2,r3,cancelled].sort());
  await fail(cm.u,'calendar_get_v1',{center_id:c2,interval,page:{}},'FORBIDDEN');
  await fail(cm.u,'session_get_v1',{session_id:s3,center_id:c1},'NOT_FOUND');
  for(const op of ['calendar_get_v1','reservation_list_v1'])await fail(staff.u,op,{interval,page:{}},'FORBIDDEN');
  await mut('permission_set_v1',{center_id:c1,person_id:staff.p,expected_version:1,permission:'reservation.write',enabled:true});
  assert.deepEqual(ids(await list(staff.u)).sort(),[r1,r2,r3,cancelled].sort());
  await fail(staff.u,'session_get_v1',{session_id:s3},'FORBIDDEN');
  await fail(staff.u,'calendar_get_v1',{center_id:c2,interval,page:{}},'FORBIDDEN');
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
  const raced=await Promise.all([
   mut('role_revoke_v1',{center_id:c1,assignment_id:instructor.grant.primary_id,expected_version:1,reason:'Schedule revoke'}),
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
 });
 await t.test('current plan, billing, center state and provider session remain mandatory',async()=>{
  await db.query("update core.centers set state='inactive' where id=$1",[c2]);
  assert(!ids(await cal(owner)).includes(s3));
  await db.query("update core.centers set state='active' where id=$1",[c2]);
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F08') where id=$1",[plan]);
  try{await fail(owner,'session_get_v1',{session_id:s1},'PLAN_FEATURE_UNAVAILABLE');await fail(owner,'calendar_get_v1',{interval,page:{}},'PLAN_FEATURE_UNAVAILABLE');}
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
  const {env}=context();
  for(const op of ['calendar_get_v1','session_get_v1','reservation_list_v1']){
   const r=await fetch(env.API_URL+'/rest/v1/rpc/'+op,{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:{},p_actor_auth_id:owner.id,p_session_id:owner.session_id,p_ids:[]})});assert(!r.ok);
  }
 });
 }finally{await db.end();}
});
