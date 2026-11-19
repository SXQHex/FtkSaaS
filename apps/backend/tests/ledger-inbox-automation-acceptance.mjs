import test from 'node:test';import assert from 'node:assert/strict';
import {preparationFixture} from './starter-preparation-fixture.mjs';import {authUser,must,call} from './api-client.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {segmentFixture} from './crm-lifecycle-fixture.mjs';
test('W1-BE-19 native all-period self earning rows retain legacy balances, aliases and cursor scope',async t=>{
 const f=await preparationFixture(),{db,api,org,center,owner}=f;t.after(()=>db.end());await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
 const teacher=await authUser('all-period-teacher'),account=await must(teacher,'account_get_v1'),person=(await api('person_create_v1',{display_name:'Synthetic all-period instructor',contacts:[]})).primary_id;
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,person]);await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
 const alias=(await api('person_create_v1',{display_name:'Synthetic earning alias',contacts:[]})).primary_id;await db.query("update core.people set state='merged',merged_into_id=$1 where org_id=$2 and id=$3",[person,org,alias]);
 const operation=(await db.query('select id from core.operation_receipts where org_id=$1 order by created_at,id limit 1',[org])).rows[0].id,root=key(),usd=key(),adjust=key();
 const row=async(id,target,amount,currency,at,direction='add',previous=null)=>db.query('insert into core.earnings(id,org_id,center_id,person_id,amount_minor,currency,basis,operation_id,direction,previous_id,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,org,center,target,amount,currency,{source:'event_fee',currency,quantity:1,excluded_blocked:0},operation,direction,previous,at]);
 await row(root,person,100,'TRY','2001-01-01T00:00:00Z');await row(usd,alias,200,'USD','2020-01-01T00:00:00Z');await row(adjust,person,20,'TRY','2025-01-01T00:00:00Z','subtract',root);
 await api('instructor_payment_record_v1',{person_id:person,earning_ids:[root],amount_minor:'50',currency:'TRY',occurred_at:new Date().toISOString(),payment:{method:'cash'}});
 const body={person_id:person,view:'earnings',page:{limit:1}},read=b=>api('instructor_account_get_v1',b,teacher),first=await read(body);assert.equal(first.items[0].id,root);assert.equal(first.items[0].paid_minor,'50');assert.equal(first.items[0].remaining_minor,'30');assert(first.next_cursor);
 assert.deepEqual(first.totals.map(x=>[x.currency,x.earned_minor,x.paid_minor,x.remaining_minor]),[['TRY','80','50','30'],['USD','200','0','200']]);
 const second=await read({...body,page:{limit:1,cursor:first.next_cursor}});assert.equal(second.items[0].id,usd);const third=await read({...body,page:{limit:1,cursor:second.next_cursor}});assert.equal(third.items[0].id,adjust);assert.equal(third.next_cursor,null);assert.equal(third.items[0].direction,'subtract');assert.equal(third.items[0].previous_id,root);
 const interval={starts_at:'2019-01-01T00:00:00Z',ends_at:'2021-01-01T00:00:00Z'},bounded=await read({...body,interval,page:{}}),legacy=await api('earnings_list_v1',{person_id:person,interval,page:{}},teacher);assert.deepEqual(bounded.items,legacy.items);assert.deepEqual(bounded.items.map(x=>x.id),[usd]);
 for(const changed of [{view:'payments'},{interval}])assert.equal((await call(teacher,'instructor_account_get_v1',{org_id:org,center_id:center,...body,...changed,page:{cursor:first.next_cursor}})).result.ok,false);
 assert.equal((await call(teacher,'earnings_list_v1',{org_id:org,center_id:center,person_id:person,page:{}})).result.error.code,'VALIDATION_FAILED');assert.equal((await call(owner,'instructor_account_get_v1',{org_id:org,center_id:center,...body})).result.error.code,'FORBIDDEN');
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Foreign instructor center',timezone:'UTC'},key())).primary_id;assert.equal((await call(teacher,'instructor_account_get_v1',{org_id:org,center_id:other,...body})).result.ok,false);
 await db.query("update core.role_assignments set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and role='instructor'",[org,person]);await db.query("update core.center_relationships set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and kind='instructor'",[org,person]);assert.equal((await call(teacher,'instructor_account_get_v1',{org_id:org,center_id:center,...body})).result.error.code,'FORBIDDEN');
});
test('W1-BE-29 native segment audience, cross-scope usages and queue discovery preserve worker boundaries',async t=>{
 const f=await segmentFixture(t),{db,org,center,owner,ownerPerson,api,person,configScope,managed}=f;await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Synthetic discovery other center',timezone:'UTC'},key())).primary_id;await api('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
 const inactive=await person('Synthetic inactive student'),closed=await person('Synthetic closed candidate'),hidden=await person('Synthetic inactive person');
 for(const id of [inactive,hidden])await api('student_activate_v1',{person_id:id});
 await db.query("update core.center_relationships set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and kind='student'",[org,inactive]);
 await api('lead_save_v1',{person_id:closed,source:'phone',interest:'eligible'});await db.query("update core.leads set state='closed' where org_id=$1 and person_id=$2",[org,closed]);await api('student_activate_v1',{center_id:other,person_id:closed});await db.query("update core.people set state='merged',merged_into_id=$3 where org_id=$1 and id=$2",[org,hidden,f.target]);
 const broad=(await api('segment_save_v1',{name:'All linked active people',scope:configScope,definition:{all:[{field:'remaining_credits',operator:'gte',value:0}]}})).primary_id;
 const discover=(operation,k,page={})=>api('management_state_get_v1',{center_id:k.scope.kind==='organization'?null:center,operation,selector:{operation,key:k},page});const mk={scope:configScope,segment_id:broad,discovery:'matches',execution_center_id:center};
 const counts=async()=>(await db.query('select (select count(*) from core.operation_receipts where org_id=$1)::int receipts,(select count(*) from core.outbox_jobs where org_id=$1)::int jobs',[org])).rows[0];const before=await counts();
 let page=await discover('segment_save_v1',mk,{limit:1});assert.deepEqual(page.segment_summary,{audience_count:4,matched_count:4,using_automations:0});const first=page,people=[];
 do{people.push(...page.items.map(x=>x.segment_match.person_id));page=page.next_cursor?await discover('segment_save_v1',mk,{limit:1,cursor:page.next_cursor}):null;}while(page);
 assert.deepEqual(people.toSorted(),[f.target,f.excluded,inactive,closed].toSorted());assert.deepEqual(await counts(),before);
 await f.denied('management_state_get_v1',{operation:'segment_save_v1',selector:{operation:'segment_save_v1',key:{...mk,segment_id:f.segment}},page:{cursor:first.next_cursor}},'VALIDATION_FAILED');
 const organizationScope={kind:'organization'},shared=(await api('segment_save_v1',{center_id:null,name:'Shared segment',scope:organizationScope,definition:f.definition})).primary_id;
 const references=[];for(const c of [center,other])references.push((await api('automation_save_v1',{center_id:c,scope:{kind:'center',center_id:c},definition:{name:'Disabled shared usage',trigger:{kind:'student_inactive',offset_days:1},segment_id:shared,action:{kind:'create_followup',channel:'in_app',template_key:'synthetic.shared'},execution_center_ids:[c],enabled:false}})).primary_id);
 const usageKey={scope:organizationScope,segment_id:shared,discovery:'automations'};let usages=await discover('segment_save_v1',usageKey);assert.deepEqual(usages.items.map(x=>x.automation_reference.id).toSorted(),references.toSorted());
 assert.equal((await discover('segment_save_v1',{...usageKey,discovery:'matches',execution_center_id:center})).segment_summary.using_automations,2);
 await db.query("update core.role_assignments set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and role='center_manager' and scope_center_id=$3",[org,ownerPerson,other]);usages=await discover('segment_save_v1',usageKey);assert.deepEqual(usages.items.map(x=>x.automation_reference.id),[references[0]]);
 const a=await f.createAutomation('Discovery real worker A'),b=await f.createAutomation('Discovery real worker B'),worker=await f.nativeWorker(),claimed=await worker.claim();const owned=[];
 for(const job of claimed){const row=(await db.query('select automation_id from private.p05_jobs where job_id=$1',[job.request.job_id])).rows[0];if([a,b].includes(row.automation_id))owned.push(job);else assert.equal((await worker.invoke(job)).ok,true);}assert.equal(owned.length,2);
 const job=owned[0],jobId=job.request.job_id;await db.query("update core.outbox_jobs set state='failed',attempts=3,lease_until=null,version=version+1 where id=$1",[jobId]);await db.query("update private.p05_jobs set safe_error_code='INTEGRITY_VIOLATION' where job_id=$1",[jobId]);
 const jk={scope:configScope,discovery:'jobs',state:'failed'},failed=await discover('automation_save_v1',jk,{limit:1});assert.equal(failed.items.length,1);assert.equal(failed.items[0].automation_job.id,jobId);assert.equal(failed.items[0].automation_job.retry_available,true);assert.equal(failed.items[0].automation_job.initiator_kind,'automation');assert.equal(failed.items[0].automation_job.configuration_creator_person_id,ownerPerson);assert.equal(failed.automation_queue_summary.total,2);assert.equal(failed.automation_queue_summary.failed,1);assert.equal(failed.automation_queue_summary.running,1);assert.equal(failed.automation_queue_summary.email_delivery,'not_supported');
 const all=await discover('automation_save_v1',{...jk,state:'all'},{limit:1});assert(all.next_cursor);await f.denied('management_state_get_v1',{operation:'automation_save_v1',selector:{operation:'automation_save_v1',key:jk},page:{cursor:all.next_cursor}},'VALIDATION_FAILED');
 const automation=failed.items[0].automation_job.automation_id,current=(await managed('automation_save_v1',{scope:configScope,automation_id:automation})).items[0];await api('automation_save_v1',{scope:configScope,automation_id:automation,expected_version:current.versions[0].version,definition:current.current.values.definition,retry_job:{id:jobId,version:failed.items[0].automation_job.version}});
 for(const remaining of owned.filter(x=>x!==job))assert.equal((await worker.invoke(remaining)).ok,true);const retry=(await worker.claim()).find(x=>x.request.job_id===jobId);assert(retry);assert.equal((await worker.invoke(retry)).ok,true);
 const done=await discover('automation_save_v1',{...jk,state:'all'});assert.equal(done.automation_queue_summary.succeeded,2);assert.equal(done.automation_queue_summary.followups_created,2);assert.equal(done.automation_queue_summary.notifications_created,0);assert(done.items.every(x=>x.automation_job.retry_available===false&&x.automation_job.result_reference.type==='crm_activities'));
 await db.query("update core.role_assignments set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and role='center_manager'",[org,ownerPerson]);await f.denied('management_state_get_v1',{operation:'segment_save_v1',selector:{operation:'segment_save_v1',key:mk},page:{}},'FORBIDDEN');
});
test('W1-BE-28 native inbox search, source state and atomic reversible read state preserve recipient authority',async t=>{
 const f=await preparationFixture({schedule:true,studentUser:true,studentMembership:true}),{db,api,org,center,student,studentPerson,owner,discipline}=f;t.after(()=>db.end());await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
 const sid=key(),at=Date.now()+2*86400000;await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,2,2,'planned','open')",[sid,org,center,discipline,new Date(at),new Date(at+1800000)]);
 const wait=await api('waitlist_join_v1',{person_id:studentPerson,session_id:sid},student),offer=key();await db.query("insert into core.seat_offers(id,org_id,center_id,entry_id,session_id,person_id,expires_at,state) values($1,$2,$3,$4,$5,$6,now()+interval '10 minutes','active')",[offer,org,center,wait.primary_id,sid,studentPerson]);await db.query("update core.waitlist_entries set state='offered',version=version+1 where id=$1",[wait.primary_id]);
 const notice=async(recipient,subject,kind='seat_offer',read=false)=>{const id=key();await db.query("insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload,read_at) values($1,$2,$3,$4,$5,$6,case when $7 then now() else null end)",[id,org,recipient,kind,subject,{template_key:kind,subject:{type:kind==='seat_offer'?'seat_offers':'notifications',id:subject}},read]);return id;};
 const n1=await notice(studentPerson,offer),n2=await notice(studentPerson,offer,'seat_offer',true),missing=await notice(studentPerson,key()),foreign=await notice(f.person,offer);
 const body={page:{limit:1},unread_only:false,include_work:true,include_summary:true,work_state:'pending'},read=extra=>api('notifications_list_v1',{...body,...extra},student),first=await read({});assert.equal(first.items.length,1);assert(first.next_cursor);assert.equal(first.summary.pending,2);assert.equal(first.items[0].id,n1);assert.equal(first.items[0].version,1);assert.equal(first.items[0].work.center_id,center);assert.deepEqual(first.items[0].work.selector,{operation:'seat_offer_accept_v1',key:{offer_id:offer}});
 const next=await read({page:{limit:1,cursor:first.next_cursor}});assert.equal(next.items[0].id,n2);assert.equal(next.next_cursor,null);assert.deepEqual(next.summary,first.summary);assert(!JSON.stringify(first).includes(f.account.id));
 const title=first.items[0].payload.title;assert(title);const search=await read({query:title,page:{}});assert.deepEqual(search.items.map(x=>x.id),[n1,n2]);assert.equal(search.summary.pending,2);
 const unavailable=await read({work_state:'unavailable',page:{}});assert(unavailable.items.some(x=>x.id===missing));assert(unavailable.items.every(x=>x.work.center_id===null&&x.work.selector===null));
 const legacy=await api('notifications_list_v1',{page:{},unread_only:false},student);assert.equal(legacy.summary,undefined);assert.equal(legacy.items.find(x=>x.id===n1).version,undefined);assert(!legacy.items.some(x=>x.id===foreign));
 const deny=async(op,b,u=student,k)=>{const r=await call(u,op,{org_id:org,center_id:center,...b},k??(op==='notifications_read_set_v1'?key():undefined));assert.equal(r.result.ok,false,JSON.stringify(r.result));return r.result.error.code;};
 await deny('notifications_list_v1',{...body,query:'different',page:{cursor:first.next_cursor}});await deny('notifications_list_v1',{...body,work_state:'completed',page:{cursor:first.next_cursor}});
 const selection=await api('management_state_get_v1',{operation:'notifications_read_set_v1',selector:{operation:'notifications_read_set_v1',key:{notification_ids:[n1,n2]}},page:{limit:100}},student);assert.equal(selection.items.length,2);assert(selection.items.every(x=>x.versions[0].version===1));
 const batch={read:true,notifications:[{id:n1,expected_version:1},{id:n2,expected_version:1}]},k=key();const before=(await db.query('select count(*) n from core.notifications where org_id=$1',[org])).rows[0].n;const ack=await api('notifications_read_set_v1',batch,student,k);assert.equal(ack.related.length,2);assert.equal((await api('notifications_read_set_v1',batch,student,k)).replayed,true);assert.equal((await db.query('select count(*) n from core.notifications where org_id=$1',[org])).rows[0].n,before);assert.equal((await db.query('select count(*)::int n from core.audit_events where org_id=$1 and operation_id=$2',[org,ack.operation_id])).rows[0].n,1);
 let rows=(await read({page:{}})).items;assert(rows.filter(x=>[n1,n2].includes(x.id)).every(x=>x.read_at!==null&&x.version===2));assert.equal((await read({})).summary.pending,2);
 assert.equal(await deny('notifications_read_set_v1',{read:false,notifications:[{id:n1,expected_version:2},{id:n2,expected_version:1}]}),'VERSION_CONFLICT');assert.equal((await db.query('select version::int version from core.notifications where id=$1',[n1])).rows[0].version,2);
 assert.equal(await deny('notifications_read_set_v1',{read:false,notifications:[{id:n1,expected_version:2},{id:foreign,expected_version:1}]}),'NOT_FOUND');assert.equal((await db.query('select version::int version from core.notifications where id=$1',[n1])).rows[0].version,2);
 await api('notifications_read_set_v1',{read:false,notifications:[{id:n1,expected_version:2},{id:n2,expected_version:2}]},student);rows=(await read({page:{}})).items;assert(rows.filter(x=>[n1,n2].includes(x.id)).every(x=>x.read_at===null&&x.version===3));
 await t.test('W1-BE-57 archive and recover visibility without changing source or read state',async()=>{
  const set=(visibility,id,expected_version)=>({visibility,notifications:[{id,expected_version}]});
  const archive=set('archived',n1,3),archiveKey=key();
  await api('notifications_read_set_v1',archive,student,archiveKey);
  assert.equal((await api('notifications_read_set_v1',archive,student,archiveKey)).replayed,true);
  assert(!(await api('notifications_list_v1',{page:{},unread_only:false},student)).items.some(row=>row.id===n1));
  let archived=await read({visibility:'archived',page:{}});
  assert.equal(archived.summary.pending,1);assert.equal(archived.items[0].version,4);
  assert.equal(archived.items[0].read_at,null);assert.equal(archived.items[0].work.state,'pending');
  await api('notifications_read_set_v1',set('deleted',n1,4),student);
  const deleted=await read({visibility:'deleted',page:{}});
  assert.equal(deleted.items[0].visibility,'deleted');
  assert.equal(await deny('notifications_read_set_v1',set('inbox',foreign,1)),'NOT_FOUND');
  await api('notifications_read_set_v1',set('inbox',n1,5),student);
  archived=await read({visibility:'archived',page:{}});
  assert.equal(archived.items.length,0);
  const restored=(await read({page:{}})).items.find(row=>row.id===n1);
  assert.equal(restored.read_at,null);assert.equal(restored.work.state,'pending');
 });
 const replacement=(await api('person_create_v1',{display_name:'Synthetic replacement recipient',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:replacement});const account=(await must(student,'account_get_v1')).id;await db.query('update core.account_links set person_id=$1 where org_id=$2 and account_id=$3',[replacement,org,account]);try{assert.equal(await deny('notifications_read_set_v1',batch,student,k),'NOT_FOUND');}finally{await db.query('update core.account_links set person_id=$1 where org_id=$2 and account_id=$3',[studentPerson,org,account]);}
 await api('seat_offer_reject_v1',{offer_id:offer,expected_version:1},student);assert.equal((await read({})).summary.pending,0);const completed=await read({work_state:'completed',page:{}});assert(completed.items.some(x=>x.id===n1));assert.equal(completed.items.find(x=>x.id===n1).read_at,null);
 const outsider=await authUser('inbox-outsider');await deny('notifications_list_v1',body,outsider);await deny('notifications_read_set_v1',{read:true,notifications:[{id:n1,expected_version:3}]},outsider);
});
test('W1-BE-28 resolve-only staff alerts retain native request navigation and live authority',async t=>{
 const {lifecycleFixture}=await import('./crm-lifecycle-fixture.mjs');const f=await lifecycleFixture(t),{db,org,center,api,person,owner}=f;
 const staff=await authUser('inbox-request-resolver'),staffAccount=await must(staff,'account_get_v1'),staffPerson=await person('Synthetic resolve-only staff'),target=await person('Synthetic request student');
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,staffAccount.id,staffPerson]);await api('role_assign_v1',{person_id:staffPerson,role:'staff',scope:{center_id:center}});
 const grant=async enabled=>api('permission_set_v1',{person_id:staffPerson,permission:'request.resolve',enabled,expected_version:Number((await db.query('select version from core.people where id=$1',[staffPerson])).rows[0].version)});await grant(true);await api('student_activate_v1',{person_id:target});
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Synthetic inbox request discipline',state:'active'},key())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const automation=(await api('automation_save_v1',{scope:{kind:'center',center_id:center},definition:{name:'Resolve-only request alert',trigger:{kind:'pending_request',offset_days:0,recipient_person_ids:[staffPerson]},segment_id:null,action:{kind:'send_reminder',channel:'in_app',template_key:'work.pending_request'},execution_center_ids:[center],enabled:true}})).primary_id;
 const request=key();await db.query("insert into core.lesson_requests(id,org_id,center_id,person_id,discipline_id,format,requested_start,duration_minutes,state) values($1,$2,$3,$4,$5,'private',now()+interval '2 days',60,'pending')",[request,org,center,target,discipline]);
 const worker=await f.nativeWorker();let alertJob;for(const job of await worker.claim()){assert.equal((await worker.invoke(job)).ok,true);if((await db.query('select automation_id from private.p05_jobs where job_id=$1',[job.request.job_id])).rows[0].automation_id===automation)alertJob=job;}assert(alertJob);
 const read=()=>api('notifications_list_v1',{page:{},unread_only:false,include_work:true,include_summary:true},key(),staff),first=await read(),notice=first.items.find(x=>x.payload.subject.id===request);assert(notice);assert.equal(notice.work.state,'pending');assert.equal(first.summary.pending,1);assert.deepEqual(notice.work.selector,{operation:'lesson_request_create_v1',key:{lesson_request_id:request}});
 const selected=await api('management_state_get_v1',{operation:notice.work.selector.operation,selector:notice.work.selector,page:{}},key(),staff);assert.equal(selected.items[0].entity.id,request);await f.denied('lesson_request_withdraw_v1',{lesson_request_id:request,expected_version:1},'FORBIDDEN',key(),staff);
 await grant(false);const unavailable=(await read()).items.find(x=>x.id===notice.id);assert.equal(unavailable.work.state,'unavailable');assert.equal(unavailable.work.selector,null);assert.equal((await read()).summary.pending,0);
 const write=async enabled=>api('permission_set_v1',{person_id:staffPerson,permission:'request.write',enabled,expected_version:Number((await db.query('select version from core.people where id=$1',[staffPerson])).rows[0].version)});await write(true);const writeNotice=(await read()).items.find(x=>x.id===notice.id);assert.equal(writeNotice.work.state,'pending');assert.equal(writeNotice.work.selector.operation,'lesson_request_create_v1');await api('management_state_get_v1',{operation:writeNotice.work.selector.operation,selector:writeNotice.work.selector,page:{}},key(),staff);await write(false);await grant(true);
 await api('lesson_request_reject_v1',{lesson_request_id:request,expected_version:1,reason:'Synthetic authorized resolution'},key(),staff);const completed=(await read()).items.find(x=>x.id===notice.id);assert.equal(completed.work.state,'completed');assert.equal(completed.read_at,null);
 await api('student_activate_v1',{person_id:staffPerson});const own=key(),ownNotice=key();await db.query("insert into core.lesson_requests(id,org_id,center_id,person_id,discipline_id,format,requested_start,duration_minutes,state) values($1,$2,$3,$4,$5,'private',now()+interval '2 days',60,'pending')",[own,org,center,staffPerson,discipline]);await db.query("insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload) values($1,$2,$3,'reminder',$4,$5)",[ownNotice,org,staffPerson,own,{template_key:'work.pending_request',subject:{type:'lesson_requests',id:own}}]);const self=(await read()).items.find(x=>x.id===ownNotice);assert.equal(self.work.state,'pending');assert.equal(self.work.selector.operation,'lesson_request_create_v1');await api('lesson_request_withdraw_v1',{lesson_request_id:own,expected_version:1},key(),staff);assert.equal((await read()).items.find(x=>x.id===ownNotice).work.state,'completed');await grant(false);const hidden=(await read()).items.find(x=>x.id===notice.id);assert.equal(hidden.work.state,'unavailable');const outsideOwn=await api('management_state_get_v1',{operation:notice.work.selector.operation,selector:notice.work.selector,page:{}},key(),staff);assert.equal(outsideOwn.items.length,0);
});

test('W1-BE-47 mark-all uses the whole live organization inbox and replays the original snapshot',async t=>{
 const f=await preparationFixture({schedule:true,studentUser:true,studentMembership:true});
 const {db,api,org,student,studentPerson}=f;
 t.after(()=>db.end());

 const own=Array.from({length:105},key),alreadyRead=key(),foreign=key();
 const insert=(ids,recipient,read=false)=>db.query(
  "insert into core.notifications(id,org_id,recipient_person_id,kind,subject_id,payload,read_at) select i,$2,$3,'reminder',i,'{}',case when $4 then now() end from unnest($1::uuid[]) i",
  [ids,org,recipient,read]
 );
 await insert(own,studentPerson);
 await insert([alreadyRead],studentPerson,true);
 await insert([foreign],f.person);
 const state=async ids=>(await db.query(
  'select id,read_at,version::int from core.notifications where org_id=$1 and id=any($2::uuid[])',[org,ids]
 )).rows;
 const body={center_id:null,read:true,all_unread:true},operationKey=key();
 const ack=await api('notifications_read_set_v1',body,student,operationKey);
 assert.equal(ack.primary_id,studentPerson);
 assert.equal(ack.replayed,false);
 assert.deepEqual(ack.related,[]);
 const touched=await state(own);
 assert.equal(touched.length,105);
 assert(touched.every(row=>row.read_at&&row.version===2));
 assert.deepEqual((await state([alreadyRead,foreign])).map(row=>[row.id,row.read_at!==null,row.version]).sort(),
  [[alreadyRead,true,1],[foreign,false,1]].sort());

 const later=key();
 await insert([later],studentPerson);
 const replay=await api('notifications_read_set_v1',body,student,operationKey);
 assert.deepEqual(replay,{...ack,replayed:true});
 assert.deepEqual(await state([later]),[{id:later,read_at:null,version:1}]);
 assert.equal((await db.query('select count(*)::int as count from core.audit_events where org_id=$1 and operation_id=$2',[org,ack.operation_id])).rows[0].count,1);
 const outsider=await authUser('mark-all-outsider');
 assert.equal((await call(outsider,'notifications_read_set_v1',{org_id:org,...body},key())).result.ok,false);

 await api('notifications_read_set_v1',body,student);
 assert.equal((await state([later]))[0].version,2);
 const empty=await api('notifications_read_set_v1',body,student);
 assert.equal(empty.replayed,false);
 assert.equal((await state([later]))[0].version,2);

 const recovery={operation:'notifications_read_set_v1',key:operationKey};
 const saved=await must(student,'operation_status_get_v1',{org_id:org,...recovery});
 assert.deepEqual(saved.result_reference,{type:'people',id:studentPerson});
 const account=(await must(student,'account_get_v1')).id;
 const replacement=(await api('person_create_v1',{display_name:'Synthetic changed inbox recipient',contacts:[]})).primary_id;
 await db.query('update core.account_links set person_id=$1 where org_id=$2 and account_id=$3',[replacement,org,account]);
 for(const [operation,request,k] of [['notifications_read_set_v1',body,operationKey],['operation_status_get_v1',recovery,undefined]]){
  const denied=await call(student,operation,{org_id:org,...request},k);
  assert.equal(denied.result.error?.code,'NOT_FOUND');
 }
});
