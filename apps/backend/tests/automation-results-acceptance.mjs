import test from 'node:test';import assert from 'node:assert/strict';
import {must} from './api-client.mjs';
import {segmentFixture,lifecycleFixture} from './crm-lifecycle-fixture.mjs';import {newUuidV7 as id} from '../scripts/uuid.mjs';

test('P16 native automation failure, bounded retry, lease fencing, live disable and single domain result',async t=>{
 let cleanup;t.after(async()=>{if(cleanup)await cleanup();});
 const {db,org,api,denied,managed,nativeWorker,configScope,createAutomation}=await segmentFixture(t);
 const automation=await createAutomation('P16 failed then recovered');const {claim,invoke}=await nativeWorker();
 const definition=async()=>{const row=(await managed('automation_save_v1',{scope:configScope,automation_id:automation})).items[0];return {row,body:{automation_id:automation,expected_version:row.versions[0].version,scope:configScope,definition:row.current.values.definition}};};
 const selected=async()=>{let chosen;for(const job of await claim()){const c=(await db.query('select automation_id from private.p05_jobs where job_id=$1',[job.request.job_id])).rows[0];if(c.automation_id===automation)chosen=job;else assert.equal((await invoke(job)).ok,true);}return chosen;};
 const name='p16_fail_'+id().replaceAll('-','');
 await db.query(`create function private.${name}() returns trigger language plpgsql set search_path='' as $$begin if new.org_id='${org}'::uuid then raise exception using errcode='23514',message='synthetic provider diagnostic must not escape';end if;return new;end$$`);
 await db.query(`create trigger ${name} before insert on core.crm_activities for each row execute function private.${name}()`);
 cleanup=async()=>{await db.query(`drop trigger if exists ${name} on core.crm_activities`);await db.query(`drop function if exists private.${name}()`);};
 let oldLease,jobId;
 for(let attempt=1;attempt<=3;attempt++){
  const job=await selected();assert(job);oldLease??=job;jobId=job.request.job_id;assert.equal(jobId,oldLease.request.job_id);
  const result=await invoke(job);assert.equal(result.ok,false);assert.equal(result.error.code,'INTEGRITY_VIOLATION');assert.equal(result.error.retryable,attempt<3);
  const row=(await definition()).row.current.values.recent_jobs.find(j=>j.id===jobId);assert.equal(row.attempts,attempt);assert.equal(row.state,attempt<3?'retry_wait':'failed');assert.equal(row.safe_error_code,'INTEGRITY_VIOLATION');assert.equal(row.result_reference,null);assert.equal(row.retry_available,attempt===3);assert(!JSON.stringify(row).includes('synthetic provider diagnostic'));
  assert.equal((await db.query('select count(*)::int n from core.automation_runs where org_id=$1 and automation_id=$2',[org,automation])).rows[0].n,0);
  if(attempt<3)await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[jobId]);
 }
 await db.query(`drop trigger ${name} on core.crm_activities`);await db.query(`drop function private.${name}()`);
 let {row,body}=await definition();const failed=row.current.values.recent_jobs.find(j=>j.id===jobId);const retry={...body,retry_job:{id:jobId,version:failed.version}};
 await denied('automation_save_v1',{...retry,retry_job:{id:jobId,version:failed.version-1}},'VERSION_CONFLICT');
 const operationKey=id(),saved=await api('automation_save_v1',retry,operationKey);assert.equal(saved.primary_id,automation);assert.equal((await api('automation_save_v1',retry,operationKey)).replayed,true);
 await assert.rejects(invoke(oldLease),/FORBIDDEN/);
 const recovered=await selected();assert(recovered);assert.equal(recovered.request.job_id,jobId);const result=await invoke(recovered);assert.equal(result.ok,true);assert.deepEqual(await invoke(recovered),result);
 assert.equal((await db.query('select count(*)::int n from private.p05_automation_activities where automation_id=$1',[automation])).rows[0].n,1);
 ({row,body}=await definition());const done=row.current.values.recent_jobs.find(j=>j.id===jobId);assert.equal(done.state,'succeeded');assert.equal(done.retry_available,false);assert.equal(done.safe_error_code,null);assert.equal(done.result_reference.type,'crm_activities');
 await denied('automation_save_v1',{...body,retry_job:{id:jobId,version:done.version}},'INVALID_STATE_TRANSITION');
 await api('automation_save_v1',{...body,definition:{...body.definition,enabled:false}});const disabled=(await definition()).row;assert.equal(disabled.current.values.definition.enabled,false);assert.equal((await selected()),undefined);
});

for(const kind of ['pending_request','unclosed_attendance'])test('S10 '+kind+' work alert uses explicit recipients, live source and no blind catch-up',async t=>{
 const {db,org,center,owner,ownerPerson,api,denied,managed,nativeWorker,person}=await lifecycleFixture(t);
 const stranger=await person('No work-alert authority'),configScope={kind:'center',center_id:center};
 const definition={name:'Explicit work alert',trigger:{kind,offset_days:0,recipient_person_ids:[ownerPerson]},segment_id:null,action:{kind:'send_reminder',channel:'in_app',template_key:'work.'+kind},execution_center_ids:[center],enabled:true};
 await denied('automation_save_v1',{scope:configScope,definition:{...definition,trigger:{...definition.trigger,recipient_person_ids:[stranger]}}},'FORBIDDEN');
 const automation=(await api('automation_save_v1',{scope:configScope,definition})).primary_id;
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Work alert discipline',state:'active'},id())).primary_id;
 await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const makeTarget=async()=>{const target=id();
 if(kind==='pending_request')await db.query("insert into core.lesson_requests(id,org_id,center_id,person_id,discipline_id,format,requested_start,duration_minutes,state) values($1,$2,$3,$4,$5,'private',now()+interval '2 days',60,'pending')",[target,org,center,stranger,discipline]);
 else await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state,actual_started_at) values($1,$2,$3,$4,'group',now()-interval '1 minute',now()+interval '59 minutes',1,1,'planned','open',clock_timestamp())",[target,org,center,discipline]);
 return target;};
 const target=await makeTarget();
 const worker=await nativeWorker();
 const selected=async()=>{let found;for(const job of await worker.claim()){const row=(await db.query('select automation_id from private.p05_jobs where job_id=$1',[job.request.job_id])).rows[0];if(row.automation_id===automation)found=job;else assert.equal((await worker.invoke(job)).ok,true);}return found;};
 const job=await selected();assert(job);const result=await worker.invoke(job);assert.equal(result.ok,true);assert.deepEqual(await worker.invoke(job),result);
 const alerts=(await db.query("select recipient_person_id,subject_id,payload from core.notifications where org_id=$1 and payload->>'template_key'=$2",[org,definition.action.template_key])).rows;
 assert.equal(alerts.length,1);assert.equal(alerts[0].recipient_person_id,ownerPerson);assert.equal(alerts[0].subject_id,target);
 assert.equal(alerts[0].payload.subject.type,kind==='pending_request'?'lesson_requests':'sessions');assert.equal(await selected(),undefined);
 // Disable and re-enable are normal versioned commands; existing subjects must not be replayed.
 let row=(await managed('automation_save_v1',{scope:configScope,automation_id:automation})).items[0];
 await api('automation_save_v1',{scope:configScope,automation_id:automation,expected_version:row.versions[0].version,definition:{...definition,enabled:false}});
 const whileDisabled=await makeTarget();assert.equal(await selected(),undefined);
 row=(await managed('automation_save_v1',{scope:configScope,automation_id:automation})).items[0];
 await api('automation_save_v1',{scope:configScope,automation_id:automation,expected_version:row.versions[0].version,definition});
 assert.equal(await selected(),undefined);
 const fresh=await makeTarget(),freshJob=await selected();assert(freshJob);assert.equal((await worker.invoke(freshJob)).ok,true);
 const subjects=(await db.query("select subject_id from core.notifications where org_id=$1 and payload->>'template_key'=$2",[org,definition.action.template_key])).rows.map(x=>x.subject_id);
 assert(subjects.includes(target));assert(subjects.includes(fresh));assert(!subjects.includes(whileDisabled));assert.equal(subjects.length,2);assert.equal(await selected(),undefined);
 if(kind==='pending_request')assert.equal((await db.query('select state from core.lesson_requests where id=$1',[target])).rows[0].state,'pending');
 else assert.equal((await db.query('select attendance_state from core.sessions where id=$1',[target])).rows[0].attendance_state,'open');
});
