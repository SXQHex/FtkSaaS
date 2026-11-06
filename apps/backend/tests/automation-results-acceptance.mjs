import test from 'node:test';import assert from 'node:assert/strict';
import {segmentFixture} from './crm-lifecycle-fixture.mjs';import {newUuidV7 as id} from '../scripts/uuid.mjs';

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
