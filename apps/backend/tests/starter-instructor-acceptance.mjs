// Included by room-role-registry: real Starter native Auth -> Edge -> RPC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Starter instructor discovery, revoke and replacement preserve one live slot and open work',{timeout:600000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('instructor-owner'),stranger=await authUser('instructor-stranger');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1');
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic instructor management',initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Starter',timezone:'UTC'},key())).primary_id;
  const scope=b=>({org_id:org,center_id:center,...b});
  const mut=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
  const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
  const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await mut('center_manager_assign_v1',{person_id:ownerPerson});
  const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic instructor',occurred_at:new Date().toISOString()});
  await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
  const selector={operation:'role_assign_v1',key:{role:'instructor',scope:{center_id:center}}};
  const request={operation:'role_assign_v1',selector,page:{}};
  const read=(u=owner,b={})=>must(u,'management_state_get_v1',scope({...request,...b}));
  const assign=(p,u=owner,k=key())=>mut('role_assign_v1',{person_id:p,role:'instructor',scope:{center_id:center}},u,k);
  const revoke=(item,u=owner,k=key())=>mut('role_revoke_v1',{assignment_id:item.entity.id,expected_version:item.versions[0].version,reason:'Explicit synthetic replacement'},u,k);
  async function linked(label){
   const p=(await mut('person_create_v1',{display_name:label,contacts:[]})).primary_id,u=await authUser(label),a=await must(u,'account_get_v1');
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
   return {p,u};
  }
  assert.deepEqual((await read()).items,[]);
  const cm=await linked('instructor-cm'),a=await linked('instructor-a'),b=await linked('instructor-b'),c=await linked('instructor-c');
  await mut('center_manager_assign_v1',{person_id:cm.p});
  const foreignAccount=await must(stranger,'account_get_v1');
  const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:foreignAccount.id,name:'Synthetic foreign instructor org',initial_plan_id:plan},key())).primary_id;
  const foreignCenter=(await must(stranger,'center_create_v1',{org_id:foreignOrg,name:'Foreign center',timezone:'UTC'},key())).primary_id;
  let reader=cm.u,first,active,winner;
  await t.test('fresh login discovers the actual assignment and version without account identity leakage',async()=>{
   const k=key(),grant=await assign(a.p,cm.u,k);assert.equal((await assign(a.p,cm.u,k)).replayed,true);
   const {env}=context();const response=await fetch(env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:cm.u.email,password:cm.u.password}),signal:AbortSignal.timeout(60000)});
   assert.equal(response.ok,true);reader={...cm.u,jwt:(await response.json()).access_token};
   const page=await read(reader);assert.equal(page.items.length,1);first=page.items[0];
   assert.equal(first.entity.id,grant.primary_id);assert.equal(first.entity.type,'role_assignments');assert.equal(first.versions[0].version,grant.version);assert.deepEqual(first.versions[0].entity,first.entity);
   assert.deepEqual(first.current.values,{person_id:a.p,role:'instructor',scope:{center_id:center}});assert.equal(first.state,'active');
   const entityRead=await read(reader,{entity:first.entity});assert.deepEqual(entityRead.items[0].current,first.current);
   assert.deepEqual((await read(reader,{selector:{...selector,key:{...selector.key,person_id:b.p}}})).items,[]);
   assert.deepEqual((await read(reader,{entity:{type:'role_assignments',id:key()}})).items,[]);
   await fail('management_state_get_v1',{...request,entity:{type:'people',id:a.p}},'NOT_FOUND',reader);
   await fail('role_revoke_v1',{assignment_id:first.entity.id,expected_version:grant.version+1,reason:'Stale'},'VERSION_CONFLICT',reader);
  });
  await t.test('F05 stays closed, scope is explicit, and a second person cannot occupy the slot',async()=>{
   await fail('roles_list_v1',{page:{}},'PLAN_FEATURE_UNAVAILABLE',reader);
   for(const role of ['staff','assistant']){
    await fail('management_state_get_v1',{...request,selector:{...selector,key:{...selector.key,role}}},'PLAN_FEATURE_UNAVAILABLE',reader);
    await fail('role_assign_v1',{person_id:a.p,role,scope:{center_id:center}},'PLAN_FEATURE_UNAVAILABLE',reader);
   }
   await fail('management_state_get_v1',{...request,selector:{...selector,key:{...selector.key,scope:{center_id:key()}}}},'VALIDATION_FAILED',reader);
   await fail('management_state_get_v1',{...request,center_id:null},'VALIDATION_FAILED',reader);
   await fail('management_state_get_v1',request,'FORBIDDEN',a.u);
   await fail('management_state_get_v1',request,'NOT_FOUND',stranger);
   await fail('management_state_get_v1',{...request,org_id:foreignOrg,center_id:foreignCenter,selector:{...selector,key:{...selector.key,scope:{center_id:foreignCenter}}}},'NOT_FOUND',reader);
   await fail('management_state_get_v1',{...request,center_id:foreignCenter},'NOT_FOUND',reader);
   await fail('role_assign_v1',{person_id:b.p,role:'instructor',scope:{center_id:center}},'PLAN_LIMIT_REACHED',reader);
  });
  await t.test('canonical instructor revoke releases the slot; inactive grants remain discoverable',async()=>{
   assert.equal((await mut('person_get_v1',{person_id:a.p},reader)).relationships.find(x=>x.kind==='instructor').state,'active');
   await fail('role_assign_v1',{person_id:b.p,role:'instructor',scope:{center_id:center}},'PLAN_LIMIT_REACHED',reader);
   const k=key(),done=await revoke(first,reader,k);assert.equal(done.version,2);assert.equal((await revoke(first,reader,k)).replayed,true);
   assert.equal((await read(reader)).items[0].state,'inactive');
   await fail('role_revoke_v1',{assignment_id:first.entity.id,expected_version:1,reason:'Stale'},'VERSION_CONFLICT',reader);
   assert.equal((await mut('person_get_v1',{person_id:a.p},reader)).relationships.find(x=>x.kind==='instructor').state,'inactive');
   const again=await assign(a.p,reader);active=(await read(reader)).items.find(x=>x.entity.id===again.primary_id);
   assert.equal(active.state,'active');assert.equal(active.versions[0].version,1);
   await revoke(active,reader);assert((await read(reader)).items.every(x=>x.state==='inactive'));
  });
  await t.test('a vacant slot still requires a verified link; competing replacements yield one winner',async()=>{
   const unlinked=(await mut('person_create_v1',{display_name:'Unlinked instructor',contacts:[]})).primary_id;
   await fail('role_assign_v1',{person_id:unlinked,role:'instructor',scope:{center_id:center}},'ACCOUNT_LINK_REQUIRED',reader);
   const attempts=await Promise.all([b,c].map(x=>call(reader,'role_assign_v1',scope({person_id:x.p,role:'instructor',scope:{center_id:center}}),key())));
   assert.equal(attempts.filter(x=>x.result.ok).length,1);assert.equal(attempts.find(x=>!x.result.ok).result.error.code,'PLAN_LIMIT_REACHED');
   const page=await read(reader);assert.equal(page.items.filter(x=>x.state==='active').length,1);active=page.items.find(x=>x.state==='active');winner=active.current.values.person_id===b.p?b:c;
   assert(page.items.some(x=>x.entity.id===first.entity.id&&x.state==='inactive'));
   assert.equal((await rows("select count(distinct person_id)::int n from core.role_assignments where org_id=$1 and role='instructor' and state='active'",[org]))[0].n,1);
  });
  await t.test('keyset pages retain inactive history, bind selector/account/entity and perform no business writes',async()=>{
   await db.query("update core.role_assignments set created_at='2026-01-01T00:00:00Z' where org_id=$1 and role='instructor'",[org]);
   const counts=async()=>JSON.stringify(await rows('select (select count(*) from core.audit_events where org_id=$1) a,(select count(*) from core.operation_receipts where org_id=$1) r,(select count(*) from core.outbox_jobs where org_id=$1) o',[org]));
   const before=await counts(),ids=[];let cursor;
   do{const page=await read(reader,{page:{limit:1,...(cursor?{cursor}:{})}});assert.equal(page.items.length,1);ids.push(page.items[0].entity.id);cursor=page.next_cursor;}while(cursor);
   assert.deepEqual(ids,(await read(reader)).items.map(x=>x.entity.id));assert.equal(new Set(ids).size,3);assert.equal(await counts(),before);
   const firstPage=await read(reader,{page:{limit:1}});const page={cursor:firstPage.next_cursor};
   await fail('management_state_get_v1',{...request,page},'VALIDATION_FAILED',owner);
   await fail('management_state_get_v1',{...request,page,selector:{...selector,key:{...selector.key,person_id:a.p}}},'VALIDATION_FAILED',reader);
   await fail('management_state_get_v1',{...request,page,entity:active.entity},'VALIDATION_FAILED',reader);
   await fail('management_state_get_v1',{...request,page:{cursor:'bad'}},'VALIDATION_FAILED',reader);
   await fail('management_state_get_v1',{...request,page:{sort:'display_name_asc'}},'VALIDATION_FAILED',reader);
  });
  await t.test('live CM revocation denies discovery and command replay from the old session',async()=>{
   const commandKey=key(),old=active;await revoke(old,reader,commandKey);
   const again=await assign(winner.p,reader);active=(await read(reader)).items.find(x=>x.entity.id===again.primary_id);
   await mut('center_manager_revoke_v1',{person_id:cm.p,expected_version:1,reason:'Synthetic authority loss'});
   await fail('management_state_get_v1',request,'FORBIDDEN',reader);
   await fail('role_revoke_v1',{assignment_id:old.entity.id,expected_version:old.versions[0].version,reason:'Explicit synthetic replacement'},'FORBIDDEN',reader,commandKey);
   await fail('role_revoke_v1',{assignment_id:active.entity.id,expected_version:1,reason:'Denied'},'FORBIDDEN',reader);
  });
  await t.test('confirmed impact detaches future duties, keeps sessions and reservations visible, then requires manual assignment',async()=>{
   const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic instructor discipline',state:'active'},key())).primary_id;
   await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
   const room=(await mut('room_save_v1',{name:'Synthetic room',capacity:8})).primary_id;
   for(const resource of [{kind:'person',id:winner.p},{kind:'room',id:room}])await mut('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
   const cls=(await mut('class_save_v1',{name:'Synthetic class',discipline_id:discipline,external_open:true})).primary_id;
   await mut('class_assignment_set_v1',{class_id:cls,person_id:winner.p,duty:'instructor',state:'active'});
   const start=new Date(Date.now()+86400000);start.setUTCHours(10,0,0,0);
   const make=async days=>(await mut('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:new Date(+start+days*86400000).toISOString(),ends_at:new Date(+start+days*86400000+3600000).toISOString()},resources:[{kind:'room',id:room}],assignments:[{person_id:winner.p,duty:'instructor'}],capacity:{total:8}})).primary_id;
   const session=await make(0),legacy=await make(1),begun=await make(2),closed=await make(3),toClose=await make(4);
   // Exercise the retained legacy class fallback without changing frozen migration history.
   await db.query("update core.sessions set class_id=$2,assignment_mode='legacy' where id=$1",[legacy,cls]);
   await db.query('delete from core.session_assignments where org_id=$1 and session_id=$2',[org,legacy]);
   assert.equal((await rows("select jsonb_array_length(private.schedule_snapshot($1,$2)->'assignments') n",[org,legacy]))[0].n,1);
   await db.query("update core.sessions set actual_started_at=now() where id=$1",[begun]);
   await db.query("update core.sessions set state='occurred',attendance_state='closed' where id=$1",[closed]);
   const history=async()=>JSON.stringify({sessions:await rows('select * from core.sessions where id=any($1::uuid[]) order by id',[[begun,closed]]),duties:await rows('select * from core.session_assignments where session_id=any($1::uuid[]) order by id',[[begun,closed]]),classes:await rows('select * from core.class_assignments where class_id=$1 order by id',[cls])});
   const oldHistory=await history(),student=await linked('instructor-protected-student');await mut('student_activate_v1',{person_id:student.p});
   const expectedPolicies=new Map();
   const publish=async(k,value)=>{
    await mut('policy_publish_v1',{center_id:null,key:k,value,effective_at:new Date().toISOString(),mandatory:true});
    expectedPolicies.set(k,value);
   };
   await publish('debt_booking',{kind:'boolean',value:false});await publish('negative_upper',{kind:'integer',value:2});
   await publish('negative_valuation',{kind:'valuation',discipline_id:discipline,format:'group',amount_minor:'100',currency:'TRY'});
   await publish('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
   await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
   await publish('debt_participation',{kind:'boolean',value:false});
   await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});
   await publish('negative_default',{kind:'integer',value:2});
   const effectivePolicies=await mut('policies_get_v1',{keys:[...expectedPolicies.keys()]});
   assert.equal(effectivePolicies.length,expectedPolicies.size);
   for(const policy of effectivePolicies)assert.deepEqual(policy.value,expectedPolicies.get(policy.key),policy.key);
   const effectiveLimits=await mut('negative_limits_get_v1',{person_id:student.p,discipline_id:discipline});
   assert.equal(effectiveLimits.default_limit,2);assert.equal(effectiveLimits.upper_limit,2);assert.equal(effectiveLimits.effective_limit,2);
   const reservation=await mut('reservation_create_v1',{session_id:session,person_id:student.p,mode:'flexible'});
   await mut('student_activate_v1',{person_id:a.p});
   const cancellable=await mut('reservation_create_v1',{session_id:session,person_id:a.p,mode:'flexible'});
   const closingReservation=await mut('reservation_create_v1',{session_id:toClose,person_id:a.p,mode:'flexible'});
   const preserved=async()=>JSON.stringify({reservation:await rows('select * from core.reservations where id=$1',[reservation.primary_id]),rights:await rows('select * from core.entitlement_allocations where reservation_id=$1 order by id',[reservation.primary_id]),rooms:await rows("select * from core.resource_bookings where session_id=any($1::uuid[]) and resource_kind='room' order by id",[[session,legacy]])});
   const original=await preserved(),command={assignment_id:active.entity.id,expected_version:active.versions[0].version,reason:'Confirmed removal'};
   const preview=()=>mut('role_revoke_preview_v1',{assignment_id:command.assignment_id,expected_version:command.expected_version});
   const firstPreview=await preview();assert.deepEqual(new Set(firstPreview.sessions.map(x=>x.session_id)),new Set([session,legacy,toClose]));assert(firstPreview.sessions.every(x=>x.will_require_instructor));
   await fail('role_revoke_v1',command,'PREVIEW_STALE');assert.equal(await preserved(),original);assert.equal(await history(),oldHistory);
   await mut('session_capacity_set_v1',{session_id:session,expected_version:1,capacity:{total:7},reason:'Synthetic stale-preview capacity change'});
   await fail('role_revoke_v1',{...command,impact_approval:{id:firstPreview.id,token:firstPreview.token}},'PREVIEW_STALE');
   const approved=await preview(),token={id:approved.id,token:approved.token};
   await fail('role_revoke_v1',{...command,impact_approval:{...token,token:'0'.repeat(64)}},'PREVIEW_STALE');
   await fail('role_revoke_preview_v1',{assignment_id:command.assignment_id,expected_version:command.expected_version},'NOT_FOUND',stranger);
   const k=key(),trigger='instructor_'+key().replaceAll('-','');
   const atomic=async()=>JSON.stringify({snapshot:await rows('select private.instructor_revoke_snapshot($1,$2,$3,clock_timestamp()) s',[org,center,command.assignment_id]),preview:await rows('select state,version from core.previews where id=$1',[approved.id]),preserved:await preserved()});
   const beforeFailure=await atomic();
   await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
   try{
    await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='role_revoke_v1') execute function private."+trigger+'()');
    await fail('role_revoke_v1',{...command,impact_approval:token},'INTEGRITY_VIOLATION',owner,k);assert.equal(await atomic(),beforeFailure);
   }finally{await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');}
   const result=await mut('role_revoke_v1',{...command,impact_approval:token},owner,k);assert.equal(result.version,2);
   assert.equal((await mut('role_revoke_v1',{...command,impact_approval:token},owner,k)).replayed,true);
   assert.equal(await preserved(),original);assert.equal(await history(),oldHistory);
   const view=await mut('session_get_v1',{session_id:session});assert.equal(view.id,session);assert.equal(view.state,'planned');assert.equal(view.management_attention,'instructor_required');assert.deepEqual(view.assignments,[]);
   assert.equal((await mut('session_get_v1',{session_id:legacy})).management_attention,'instructor_required');
   // Missing instructor does not stop the normal manager-controlled lifecycle.
   const closeAt=new Date();closeAt.setUTCDate(closeAt.getUTCDate()-1);closeAt.setUTCHours(12,0,0,0);
   await db.query('update core.sessions set starts_at=$2,ends_at=$3 where id=$1',[toClose,closeAt,new Date(+closeAt+1800000)]);
   await db.query('update core.resource_bookings set starts_at=$2,ends_at=$3 where session_id=$1',[toClose,closeAt,new Date(+closeAt+1800000)]);
   const attendance=await mut('attendance_get_v1',{session_id:toClose});
   const entry=attendance.entries.find(x=>x.reservation_id===closingReservation.primary_id);
   await mut('attendance_mark_v1',{reservation_id:closingReservation.primary_id,expected_version:entry.version,result:'attended'});
   const marked=await mut('attendance_get_v1',{session_id:toClose});
   await mut('attendance_close_v1',{session_id:toClose,expected_version:marked.session_version});
   assert.equal((await rows('select state from core.reservations where id=$1',[closingReservation.primary_id]))[0].state,'completed');
   assert.equal((await rows('select state from core.credit_deficits where reservation_id=$1',[closingReservation.primary_id]))[0].state,'consumed');
   assert.equal((await mut('session_get_v1',{session_id:toClose})).state,'occurred');
   assert.equal((await mut('session_get_v1',{session_id:toClose})).management_attention,undefined);
   const interval={starts_at:new Date(+start-3600000).toISOString(),ends_at:new Date(+start+5*86400000).toISOString()};
   const pending=await mut('calendar_get_v1',{interval,page:{},needs_instructor:true});assert.deepEqual(new Set(pending.items.map(x=>x.id)),new Set([session,legacy]));assert(pending.items.every(x=>x.management_attention==='instructor_required'));
   const workRequest={operation:'session_assignment_set_v1',selector:{operation:'session_assignment_set_v1',key:{}},page:{limit:1,sort:'starts_at_asc'}};
   const jobs=await mut('management_state_get_v1',workRequest);assert.equal(jobs.items[0].entity.id,session);assert.equal(jobs.items[0].versions[0].version,view.version);assert.equal(jobs.items[0].session_detail.management_attention,'instructor_required');assert(jobs.next_cursor);
   const nextJobs=await mut('management_state_get_v1',{...workRequest,page:{...workRequest.page,cursor:jobs.next_cursor}});assert.equal(nextJobs.items[0].entity.id,legacy);assert.equal(nextJobs.next_cursor,null);
   await fail('management_state_get_v1',workRequest,'FORBIDDEN',student.u);
   await fail('management_state_get_v1',{...workRequest,selector:{...workRequest.selector,key:{session_id:legacy}},page:{cursor:jobs.next_cursor}},'VALIDATION_FAILED');

   const studentView=await mut('session_get_v1',{session_id:session},student.u);assert.equal(studentView.id,session);assert.equal(studentView.management_attention,undefined);
   await fail('calendar_get_v1',{interval,page:{},needs_instructor:true},'FORBIDDEN',student.u);
   await mut('reservation_cancel_v1',{reservation_id:cancellable.primary_id,expected_version:cancellable.version,reason:'Explicit cancellation while instructor missing'},a.u);
   assert.equal((await rows('select state from core.reservations where id=$1',[cancellable.primary_id]))[0].state,'cancelled');
   const booked=await mut('reservation_create_v1',{session_id:legacy,person_id:a.p,mode:'flexible'},a.u);
   assert.equal((await rows('select state from core.reservations where id=$1',[booked.primary_id]))[0].state,'active');
   await fail('reservation_create_v1',{session_id:legacy,person_id:b.p,mode:'flexible'},'FORBIDDEN',a.u);
   const editable=await mut('session_get_v1',{session_id:legacy});
   await mut('session_capacity_set_v1',{session_id:legacy,expected_version:editable.version,capacity:{total:6},reason:'Normal capacity edit without instructor'});
   const change=await mut('session_change_preview_v1',{session_id:legacy,scope:'single',patch:{interval:{starts_at:new Date(+start+86400000+1800000).toISOString(),ends_at:new Date(+start+86400000+5400000).toISOString()}},reason:'Normal time edit without instructor'});
   assert.deepEqual(change.blockers,[]);
   await mut('session_change_apply_v1',{preview:{id:change.id,token:change.token}});
   const changed=await mut('session_get_v1',{session_id:legacy});assert.deepEqual(changed.assignments,[]);assert.equal(changed.management_attention,'instructor_required');
   assert.equal((await rows('select state from core.reservations where id=$1',[booked.primary_id]))[0].state,'active');

   const next=winner.p===b.p?c:b;await assign(next.p);assert.deepEqual((await mut('session_get_v1',{session_id:session})).assignments,[]);
   await mut('availability_save_v1',{resource:{kind:'person',id:next.p},rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
   await fail('session_assignment_set_v1',{session_id:session,person_id:next.p,duty:'instructor',expected_version:view.version-1},'VERSION_CONFLICT');
   await mut('session_assignment_set_v1',{session_id:session,person_id:next.p,duty:'instructor',expected_version:view.version});
   const fixed=await mut('session_get_v1',{session_id:session});assert.equal(fixed.management_attention,undefined);assert.equal(fixed.assignments[0].person_id,next.p);
   assert.deepEqual((await mut('calendar_get_v1',{interval,page:{},needs_instructor:true})).items.map(x=>x.id),[legacy]);
   assert.equal((await rows('select state from core.reservations where id=$1',[reservation.primary_id]))[0].state,'active');
   assert.equal(await history(),oldHistory);
   const overdue=new Date();overdue.setUTCDate(overdue.getUTCDate()-1);overdue.setUTCHours(10,0,0,0);
   await db.query('update core.sessions set starts_at=$2,ends_at=$3 where id=$1',[legacy,overdue,new Date(+overdue+3600000)]);
   await db.query('update core.resource_bookings set starts_at=$2,ends_at=$3 where session_id=$1',[legacy,overdue,new Date(+overdue+3600000)]);
   assert.deepEqual((await mut('management_state_get_v1',workRequest)).items.map(x=>x.entity.id),[legacy]);
   const cancellation=await mut('session_cancel_preview_v1',{session_id:legacy,reason:'Explicit manager cancellation of unassigned session'});
   assert.deepEqual(cancellation.blockers,[]);
   await mut('session_cancel_apply_v1',{preview:{id:cancellation.id,token:cancellation.token}});
   assert.deepEqual((await mut('calendar_get_v1',{interval,page:{},needs_instructor:true})).items,[]);
   assert.deepEqual((await mut('management_state_get_v1',workRequest)).items,[]);
  });
  await t.test('offline canonical membership is discoverable and removable without granting login; verified assignment adopts it',async()=>{
   const occupied=(await read()).items.find(x=>x.state==='active');
   if(occupied){
    const p=await mut('role_revoke_preview_v1',{assignment_id:occupied.entity.id,expected_version:occupied.versions[0].version});
    await mut('role_revoke_v1',{assignment_id:occupied.entity.id,expected_version:occupied.versions[0].version,reason:'Prepare offline membership acceptance',impact_approval:{id:p.id,token:p.token}});
   }
   const replacement=await assign(b.p);await revoke((await read()).items.find(x=>x.entity.id===replacement.primary_id));
   const offline=key();
   await db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','active',null)",[offline,org,center,b.p]);
   assert.equal((await rows("select private.has_role($1,$2,'instructor',$3) allowed",[org,b.p,center]))[0].allowed,false);
   const item=(await read()).items.find(x=>x.entity.id===offline);assert.equal(item.state,'active');
   const adopted=await assign(b.p);assert.equal(adopted.primary_id,offline);assert.equal(adopted.version,2);
   assert.equal((await rows("select private.has_role($1,$2,'instructor',$3) allowed",[org,b.p,center]))[0].allowed,true);
   await revoke((await read()).items.find(x=>x.entity.id===offline));
   const unlinked=(await mut('person_create_v1',{display_name:'Offline legacy instructor',contacts:[]})).primary_id,offlineId=key();
   await db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','active',null)",[offlineId,org,center,unlinked]);
   await fail('role_assign_v1',{person_id:unlinked,role:'instructor',scope:{center_id:center}},'ACCOUNT_LINK_REQUIRED');
   await revoke((await read()).items.find(x=>x.entity.id===offlineId));
   assert((await read()).items.every(x=>x.state==='inactive'));
  });
 }finally{await db.end();}
});
