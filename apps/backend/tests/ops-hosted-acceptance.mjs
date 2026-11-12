// Existing registry shard: real LOGIN roles, native CALL and durable recovery.
import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomBytes} from 'node:crypto';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
test('O01 p07 native scheduler applies one due Pro boundary without renewal or email and restores its fixture',async()=>{
 const db=await connect(),password=randomBytes(24).toString('hex');let worker,org,before,health,armed=false,roleTouched=false;
 const read=async()=> (await db.query('select to_jsonb(s) value from core.saas_subscriptions s where org_id=$1',[org])).rows[0].value;
 const money=async()=> (await db.query('select count(*)::int payments,coalesce(sum(amount_minor),0)::text amount,(select count(*)::int from private.p07_payment_allocations a where a.payment_id in (select id from core.saas_payment_verifications where org_id=$1)) allocations from core.saas_payment_verifications where org_id=$1',[org])).rows[0];
 try{
  const {platform,plan}=await fixturePlatform(),owner=await authUser('o01-p07-owner');
  const proPlan=key();
  await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $2,'pro',effective_at,price_minor,currency,period,limits,features from core.saas_plan_versions where id=$1",[plan,proPlan]);
  const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic O01 p07',initial_plan_id:proPlan},key())).primary_id;
  const payment=await must(owner,'saas_payment_submit_v1',{org_id:org,amount_minor:'1000',currency:'TRY',reference:'synthetic O01 p07 initial',occurred_at:new Date().toISOString()},key());
  await must(platform,'saas_payment_verify_v1',{org_id:org,payment_id:payment.primary_id,accepted:true},key());
  before=await read();assert.equal(before.state,'active');assert.equal((await must(owner,'subscription_get_v1',{org_id:org})).plan,'pro');const financial=await money();
  health=(await db.query("select enabled,claimed,succeeded,failed from private.ops_worker_health where lane='p07'")).rows[0];
  assert.equal((await db.query("select rolpassword is null empty from pg_authid where rolname='ftk_ops_p07'")).rows[0].empty,true);
  assert.equal((await db.query("select count(*)::int n from private.p07_worker_scopes where db_role='ftk_ops_p07'")).rows[0].n,0);
  await db.query(`alter role ftk_ops_p07 password '${password}'`);roleTouched=true;
  await db.query("insert into private.p07_worker_scopes values('ftk_ops_p07',$1)",[org]);
  await db.query("update private.ops_worker_health set enabled=true where lane='p07'");
  const changed=await db.query("update core.saas_subscriptions set starts_at=least(starts_at,clock_timestamp()-interval '1 day'),period_end=clock_timestamp()-interval '1 minute',cancel_at_period_end=true,version=version+1 where id=$1 and version=$2 returning id",[before.id,before.version]);
  assert.equal(changed.rowCount,1);armed=true;
  const url=new URL(context().env.DB_URL);assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname));url.username='ftk_ops_p07';url.password=password;
  worker=new pg.Client({connectionString:url.href});await worker.connect();
  assert.equal((await worker.query('select session_user role')).rows[0].role,'ftk_ops_p07');
  await worker.query("call private.ops_run('p07')");
  const ended=await read();assert.equal(ended.state,'ended');assert.equal(Number(ended.version),Number(before.version)+2);
  assert.equal((await must(owner,'subscription_get_v1',{org_id:org})).state,'ended');
  const jobs=(await db.query("select o.id,o.state,o.attempts::int from core.outbox_jobs o join private.p07_jobs j on j.job_id=o.id where j.org_id=$1 and j.operation='subscription_boundary_apply_v1'",[org])).rows;
  assert.equal(jobs.length,1);assert.equal(jobs[0].state,'succeeded');assert.equal(jobs[0].attempts,1);
  const after=(await db.query("select claimed,succeeded,failed from private.ops_worker_health where lane='p07'")).rows[0];
  assert.equal(Number(after.claimed)-Number(health.claimed),1);assert.equal(Number(after.succeeded)-Number(health.succeeded),1);assert.equal(after.failed,health.failed);
  await worker.query("call private.ops_run('p07')");assert.deepEqual(await read(),ended);assert.deepEqual(await money(),financial);
  assert.equal((await db.query("select count(*)::int n from core.outbox_jobs where org_id=$1 and kind='transactional_email'",[org])).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int n from core.audit_events where org_id=$1 and action='subscription_boundary_apply_v1'",[org])).rows[0].n,1);
 }finally{
  try{
   if(worker)await worker.end();
   if(armed){
    const restored=await db.query("update core.saas_subscriptions set starts_at=$3,period_end=$4,grace_until=$5,cancel_at_period_end=$6,state=$7,version=version+1 where id=$1 and version in ($2::bigint+1,$2::bigint+2) returning id",[before.id,before.version,before.starts_at,before.period_end,before.grace_until,before.cancel_at_period_end,before.state]);
    assert.equal(restored.rowCount,1);
    const restoredRow=await read();for(const field of ['starts_at','period_end','grace_until','cancel_at_period_end','state','plan_version_id'])assert.equal(restoredRow[field],before[field]);
   }
  }finally{
   try{
    if(org)await db.query("delete from private.p07_worker_scopes where db_role='ftk_ops_p07' and org_id=$1",[org]);
    if(health)await db.query("update private.ops_worker_health set enabled=$1 where lane='p07'",[health.enabled]);
   }finally{try{if(roleTouched)await db.query('alter role ftk_ops_p07 password null');}finally{await db.end();}}
  }
 }
});
test('OPS-W01 native scheduler identity, bounded heartbeat and committed lease recovery',async t=>{
 const db=await connect(),password=randomBytes(24).toString('hex');let worker,trigger;const clients=[];
 const login=async lane=>{const u=new URL(context().env.DB_URL);u.username='ftk_ops_'+lane;u.password=password;const c=new pg.Client({connectionString:u.href});await c.connect();clients.push(c);return c;};
 const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 try{
  for(const lane of ['p01','p05','p06'])await db.query(`alter role ftk_ops_${lane} password '${password}'`);
  await db.query('update private.ops_worker_health set enabled=true');
  await t.test('dedicated sessions heartbeat empty scopes; other lanes and tables remain denied',async()=>{
   for(const lane of ['p01','p05','p06']){const c=await login(lane);assert.equal((await c.query('select session_user role')).rows[0].role,'ftk_ops_'+lane);await c.query("set search_path=public");await c.query('call private.ops_run($1)',[lane]);assert.equal((await c.query('show search_path')).rows[0].search_path,'pg_catalog');const h=(await q('select * from private.ops_worker_health where lane=$1',[lane]))[0];assert.equal(h.last_status,'idle');assert.equal(Number(h.ticks),1);assert(h.last_finished_at);await assert.rejects(c.query('select * from core.people'),/permission denied/);await assert.rejects(c.query('select * from private.ops_worker_health'),/permission denied/);await assert.rejects(c.query('call private.ops_run($1)',[lane==='p01'?'p06':'p01']),/FORBIDDEN/);await c.end();}
   await assert.rejects(db.query("select private.ops_begin('p06')"),/FORBIDDEN/);
  });
  await t.test('server UUID bank has v7 time and variant bits, uniqueness and a hard cap',async()=>{
   const r=(await q("select count(*)::int n,count(distinct u)::int unique_n,bool_and(substr(u::text,15,1)='7' and substr(u::text,20,1) in ('8','9','a','b')) valid from unnest(private.ops_uuid_bank(4096)) u"))[0];assert.deepEqual(r,{n:4096,unique_n:4096,valid:true});await assert.rejects(db.query('select private.ops_uuid_bank(116575)'),/VALIDATION_FAILED/);
  });
  const {platform,plan}=await fixturePlatform(),owner=await authUser('ops-native'),account=await must(owner,'account_get_v1');
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'OPS native fixture',initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'OPS native fixture',timezone:'UTC'},key())).primary_id;
  const person=(await q('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
  const payment=await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic OPS',occurred_at:new Date().toISOString()},key());await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment.primary_id,accepted:true},key());
  await db.query('insert into private.p06_configuration values($1,2097152,5000,16777216)',[org]);await db.query("insert into private.p06_worker_scopes values('ftk_ops_p06',$1)",[org]);
  const filters={center_ids:[center],interval:{starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString()}};
  const job=(await must(owner,'report_export_start_v1',{org_id:org,center_id:center,report:'collections_debts',filters,format:'csv'},key())).job_id;
  worker=await login('p06');
  await t.test('canceled execution preserves its committed claim and rolls back business effects',async()=>{
   trigger='ops_delay_'+key().replaceAll('-','');await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='report_build_v1' then perform pg_sleep(4);end if;return new;end$$`);await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
   await worker.query("set statement_timeout='1500ms'");await assert.rejects(worker.query("call private.ops_run('p06')"),e=>e.code==='57014');await worker.end();worker=null;
   const state=(await q('select state,lease_until>clock_timestamp() live from core.outbox_jobs where id=$1',[job]))[0];assert.deepEqual(state,{state:'running',live:true});assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[job]))[0].n,0);
   await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);trigger=null;
  });
  await t.test('next real session reclaims the expired lease and produces one authorized result',async()=>{
   await db.query("update core.outbox_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[job]);worker=await login('p06');await worker.query("call private.ops_run('p06')");assert.equal((await q('select state from core.outbox_jobs where id=$1',[job]))[0].state,'succeeded');assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[job]))[0].n,1);const status=await must(owner,'job_status_get_v1',{org_id:org,center_id:center,job_id:job});assert.equal(status.state,'succeeded');await worker.query("call private.ops_run('p06')");assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[job]))[0].n,1);
  });
  const startReport=async()=> (await must(owner,'report_export_start_v1',{org_id:org,center_id:center,report:'collections_debts',filters,format:'csv'},key())).job_id;
  await t.test('bounded real report backlog drains once across native worker sessions',async()=>{
   const jobs=[];for(let i=0;i<3;i++)jobs.push(await startReport());
   await worker.end();worker=null;
   for(let i=0;i<jobs.length;i++){const c=await login('p06');await c.query("call private.ops_run('p06')");await c.end();}
   const rows=await q('select id,state,attempts from core.outbox_jobs where id=any($1::uuid[])',[jobs]);assert.equal(rows.length,3);
   for(const row of rows){assert.equal(row.state,'succeeded');assert.equal(Number(row.attempts),1);}
   const files=await q('select job_id,count(*)::int n from private.p06_export_files where job_id=any($1::uuid[]) group by job_id',[jobs]);assert.equal(files.length,3);for(const row of files)assert.equal(row.n,1);
   for(const id of jobs)assert.equal((await must(owner,'job_status_get_v1',{org_id:org,center_id:center,job_id:id})).state,'succeeded');
   worker=await login('p06');await worker.query("call private.ops_run('p06')");
   assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=any($1::uuid[])',[jobs]))[0].n,3);
  });
  await t.test('failed domain execution retries after reconnect without leaking a partial report',async()=>{
   const id=await startReport();trigger='ops_retry_'+key().replaceAll('-','');
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='report_build_v1' then raise exception using errcode='23514',message='synthetic retry fault';end if;return new;end$$`);
   await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
   try{
    await worker.query("call private.ops_run('p06')");
    assert.deepEqual((await q('select state,attempts::int as attempts from core.outbox_jobs where id=$1',[id]))[0],{state:'retry_wait',attempts:1});
    assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[id]))[0].n,0);
    const health=(await q("select last_status,last_error_code from private.ops_worker_health where lane='p06'"))[0];assert.equal(health.last_status,'job_error');assert.equal(health.last_error_code,'INTEGRITY_VIOLATION');
   }finally{
    await db.query(`drop trigger if exists ${trigger} on core.audit_events`);await db.query(`drop function if exists private.${trigger}()`);trigger=null;
   }
   await worker.end();worker=null;await db.query("update core.outbox_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[id]);worker=await login('p06');
   await worker.query("call private.ops_run('p06')");
   assert.deepEqual((await q('select state,attempts::int as attempts from core.outbox_jobs where id=$1',[id]))[0],{state:'succeeded',attempts:2});
   assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[id]))[0].n,1);
   await worker.query("call private.ops_run('p06')");assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[id]))[0].n,1);
  });
  await t.test('expired export payloads leave active storage while a live CSV remains byte-identical',async()=>{
   const expired=await startReport(),live=await startReport();
   await worker.query("call private.ops_run('p06')");await worker.query("call private.ops_run('p06')");
   const files=await q('select job_id,octet_length(body)::int bytes from private.p06_export_files where job_id=any($1::uuid[])',[[expired,live]]);
   assert.equal(files.length,2);for(const file of files)assert(file.bytes>0);
   await db.query("update core.files set expires_at=clock_timestamp()-interval '1 second' where id=(select file_id from core.report_jobs where id=$1)",[expired]);
   await worker.query("call private.ops_run('p06')");
   assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[expired]))[0].n,0);
   assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[live]))[0].n,1);
   await must(owner,'report_file_get_v1',{org_id:org,center_id:center,job_id:live},key());
   const {env}=context();const response=await fetch(env.API_URL+'/functions/v1/backend-v1/report_file_get_v1?download=csv',{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),operation_key:key(),org_id:org,center_id:center,job_id:live}),signal:AbortSignal.timeout(60000)});
   assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/csv/);
   const downloaded=Buffer.from(await response.arrayBuffer()),stored=(await q('select body from private.p06_export_files where job_id=$1',[live]))[0].body;
   assert(downloaded.length>0);assert(downloaded.equals(stored));
   const {result}=await call(owner,'report_file_get_v1',{org_id:org,center_id:center,job_id:expired},key());
   assert.equal(result.ok,false);assert.equal(result.error.code,'OPERATION_RESULT_EXPIRED');
   await worker.query("call private.ops_run('p06')");
   assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[expired]))[0].n,0);
  });
  await t.test('disable and tenant revocation stop new work without invented bindings',async()=>{
   const waiting=await startReport();
   await db.query("update private.ops_worker_health set enabled=false where lane='p06'");const before=(await q("select ticks from private.ops_worker_health where lane='p06'"))[0].ticks;await worker.query("call private.ops_run('p06')");assert.equal((await q("select ticks from private.ops_worker_health where lane='p06'"))[0].ticks,before);await db.query("delete from private.p06_worker_scopes where db_role='ftk_ops_p06' and org_id=$1",[org]);await db.query("update private.ops_worker_health set enabled=true where lane='p06'");await worker.query("call private.ops_run('p06')");assert.equal((await q("select last_status from private.ops_worker_health where lane='p06'"))[0].last_status,'idle');
   assert.equal((await q('select state from core.outbox_jobs where id=$1',[waiting]))[0].state,'pending');
   await worker.end();worker=null;
   await db.query("insert into private.p06_worker_scopes values('ftk_ops_p06',$1)",[org]);worker=await login('p06');await worker.query("call private.ops_run('p06')");
   assert.equal((await q('select state from core.outbox_jobs where id=$1',[waiting]))[0].state,'succeeded');
   assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[waiting]))[0].n,1);

  });
 }finally{
  if(trigger){await db.query(`drop trigger if exists ${trigger} on core.audit_events`);await db.query(`drop function if exists private.${trigger}()`);}
  for(const c of clients)if(!c._ending)await c.end();
  await db.query('update private.ops_worker_health set enabled=false');for(const lane of ['p01','p05','p06'])await db.query(`alter role ftk_ops_${lane} password null`);await db.end();
 }
});

import {evaluateMonitor} from '../scripts/ops-monitor.mjs';
import {runOperatorMonitor as runMonitor,monitorReviewToken} from '../scripts/ops-monitor-outbox.mjs';
import {readMonitorTelemetry,collectMonitorObservation,probeServices} from '../scripts/ops-monitor-collector.mjs';
const runOperatorMonitor=args=>runMonitor({...args,clock:()=>Date.parse(args.observation.checkedAt)});

const start=Date.parse('2026-11-12T12:00:00Z');
const lanes=['p01','p05','p06','p07','p07_privacy'];
const snapshot=(minutes=0)=>({checkedAt:new Date(start+minutes*60000).toISOString(),serviceAvailable:true,
 workers:lanes.map(lane=>({lane,enabled:true,lastFinishedAt:new Date(start+minutes*60000).toISOString(),lastStatus:'idle'})),
 jobs:{stuck:0,exhausted:0,integrity:0},backup:{state:'usable',usableAt:new Date(start).toISOString()}});
const keys=result=>result.events.map(event=>[event.kind,event.key]);

test('O02 healthy observation is silent and input objects are not mutated',()=>{
 const input=snapshot(),copy=structuredClone(input),result=evaluateMonitor(null,input);
 assert.deepEqual(result.events,[]);assert.deepEqual(input,copy);assert.deepEqual(result.state.active,[]);
});
test('O02 availability requires two observations at least five minutes apart',()=>{
 const first=snapshot();first.serviceAvailable=false;
 const one=evaluateMonitor(null,first);assert.deepEqual(one.events,[]);
 const early=snapshot(1);early.serviceAvailable=false;
 const two=evaluateMonitor(one.state,early);assert.deepEqual(two.events,[]);
 const due=snapshot(5);due.serviceAvailable=false;
 const alarm=evaluateMonitor(two.state,due);assert.deepEqual(keys(alarm),[['alarm','availability']]);
 const later=snapshot(10);later.serviceAvailable=false;
 const ongoing=evaluateMonitor(alarm.state,later);assert.deepEqual(ongoing.events,[]);
 const recovered=evaluateMonitor(ongoing.state,snapshot(15));assert.deepEqual(keys(recovered),[['recovery','availability']]);
});
test('O02 a healthy availability sample resets the consecutive failure streak',()=>{
 const bad=snapshot();bad.serviceAvailable=false;
 const first=evaluateMonitor(null,bad),good=evaluateMonitor(first.state,snapshot(5));
 const again=snapshot(10);again.serviceAvailable=false;
 assert.deepEqual(evaluateMonitor(good.state,again).events,[]);
});
test('O02 extra healthy observations cannot postpone two real failed probes',()=>{
 const healthy=evaluateMonitor(null,snapshot());
 const extra=evaluateMonitor(healthy.state,snapshot(1));
 const first=snapshot(5);first.serviceAvailable=false;
 const failed=evaluateMonitor(JSON.parse(JSON.stringify(extra.state)),first);
 assert.equal(failed.state.availabilityFailures,1);
 const second=snapshot(10);second.serviceAvailable=false;
 assert.deepEqual(keys(evaluateMonitor(JSON.parse(JSON.stringify(failed.state)),second)),[['alarm','availability']]);
});
test('O02 stale worker alarms after two minutes, with equality still healthy',()=>{
 const boundary=snapshot(2);boundary.workers[0].lastFinishedAt=new Date(start).toISOString();
 assert.deepEqual(evaluateMonitor(null,boundary).events,[]);
 const stale=snapshot(3);stale.workers[0].lastFinishedAt=new Date(start).toISOString();
 const result=evaluateMonitor(null,stale);assert.deepEqual(keys(result),[['alarm','worker:p01']]);
 assert.equal(result.events[0].reason,'stale');
 assert.deepEqual(keys(evaluateMonitor(result.state,snapshot(4))),[['recovery','worker:p01']]);
});
test('O02 disabling a failed worker produces suppression, never a recovery claim',()=>{
 const failed=snapshot();failed.workers[0].lastStatus='claim_error';
 const alarm=evaluateMonitor(null,failed);assert.deepEqual(keys(alarm),[['alarm','worker:p01']]);
 const disabled=snapshot(1);disabled.workers[0].enabled=false;disabled.workers[0].lastFinishedAt=null;
 const result=evaluateMonitor(alarm.state,disabled);assert.deepEqual(keys(result),[['disabled','worker:p01']]);
 assert.deepEqual(result.state.active,[]);assert.deepEqual(evaluateMonitor(result.state,disabled).events,[]);
});
test('O02 every native lane, including privacy, requires a real heartbeat when enabled',()=>{
 for(const lane of lanes){const input=snapshot();input.workers.find(w=>w.lane===lane).lastFinishedAt=null;
  assert.deepEqual(keys(evaluateMonitor(null,input)),[['alarm','worker:'+lane]]);
 }
});
test('O02 failed, missing and older-than-24h backups alarm immediately',()=>{
 for(const backup of [{state:'failed',usableAt:new Date(start).toISOString()},{state:'missing',usableAt:null},{state:'usable',usableAt:new Date(start-86400001).toISOString()}]){
  const input=snapshot();input.backup=backup;assert.deepEqual(keys(evaluateMonitor(null,input)),[['alarm','backup']]);
 }
 const boundary=snapshot();boundary.backup.usableAt=new Date(start-86400000).toISOString();assert.deepEqual(evaluateMonitor(null,boundary).events,[]);
});
test('O02 stuck leases, exhausted deliveries and integrity violations alarm and recover independently',()=>{
 const input=snapshot();input.jobs={stuck:1,exhausted:2,integrity:1};
 const alarm=evaluateMonitor(null,input);
 assert.deepEqual(keys(alarm),[['alarm','jobs:stuck'],['alarm','jobs:exhausted'],['alarm','jobs:integrity']]);
 assert.equal(alarm.events.find(e=>e.key==='jobs:integrity').severity,'critical');
 assert.deepEqual(evaluateMonitor(alarm.state,{...input,checkedAt:snapshot(1).checkedAt}).events,[]);
 assert.deepEqual(keys(evaluateMonitor(alarm.state,snapshot(2))),[['recovery','jobs:stuck'],['recovery','jobs:exhausted'],['recovery','jobs:integrity']]);
});
test('O02 observation payload fields, credentials and person data never enter persisted state or events',()=>{
 const input=snapshot();input.secret='private-sentinel';input.jobs.payload={email:'private-sentinel'};input.workers[0].lastError='private-sentinel';input.jobs.exhausted=1;
 const result=evaluateMonitor(null,input);assert(!JSON.stringify(result).includes('private-sentinel'));
 const repeated=evaluateMonitor(JSON.parse(JSON.stringify(result.state)),snapshot(5));assert.deepEqual(keys(repeated),[['recovery','jobs:exhausted']]);
});
test('O02 missing telemetry, duplicate lanes, invalid counts and clock reversal fail closed',()=>{
 const initial=evaluateMonitor(null,snapshot(5));
 for(const mutate of [s=>delete s.jobs,s=>s.workers.pop(),s=>s.workers.push(s.workers[0]),s=>s.jobs.stuck=-1,s=>s.jobs.exhausted='1',s=>s.workers[0].enabled='false',s=>s.backup.usableAt='invalid',s=>s.backup.usableAt=snapshot(10).checkedAt,s=>s.workers[0].lastStatus='untrusted-text',s=>s.checkedAt='invalid']){
  const input=snapshot(6);mutate(input);assert.throws(()=>evaluateMonitor(initial.state,input),/INVALID_MONITOR/);
 }
 assert.throws(()=>evaluateMonitor(initial.state,snapshot(4)),/MONITOR_CLOCK_REVERSED/);
 assert.throws(()=>evaluateMonitor({format:99},snapshot()),/INVALID_MONITOR/);
});
test('O02 inconsistent persisted incidents fail closed instead of announcing false recovery',()=>{
 const input=snapshot(1);input.serviceAvailable=false;
 const base=evaluateMonitor(null,snapshot()).state;
 const incident={key:'availability',reason:'unavailable',severity:'error',openedAt:snapshot().checkedAt};
 for(const state of [
  {...base,active:[incident]},
  {...base,availabilityFailures:2},
  {...base,checkedAt:null,lastProbeAt:null,active:[incident]},
  {...base,active:[{key:'worker:p01',reason:'old',severity:'error',openedAt:base.checkedAt}]},
  {...base,active:[{key:'jobs:integrity',reason:'integrity',severity:'error',openedAt:base.checkedAt}]},
  {...base,active:[{key:'backup',reason:'missing',severity:'error',openedAt:input.checkedAt}]}
 ])assert.throws(()=>evaluateMonitor(state,input),/INVALID_MONITOR/);
});
async function monitorFixture(t){
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ftk-ops-monitor-'));fs.chmodSync(directory,0o700);
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const mail={apiKey:'synthetic-key',from:'monitor@example.invalid',to:'operator@example.invalid'};
 const policy={maxAttempts:3,retryDelayMs:30000,idempotencyAgeMs:23*3600000};
 return {fs,directory,mail,policy,read:()=>JSON.parse(fs.readFileSync(path.join(directory,'state.json')))};
}
test('O02 outbox persists before send and frozen same-key retry survives process restart',async t=>{
 const f=await monitorFixture(t),bad=snapshot();bad.jobs.exhausted=1;const attempts=[];
 const send=async input=>{attempts.push(input);const durable=f.read();assert.equal(durable.outbox[0].status,'sending');assert.equal(durable.outbox[0].attempts,attempts.length);return attempts.length===1?{state:'unknown'}:{state:'accepted',provider_reference:'01900000-0000-7000-8000-000000000001'};};
 const first=await runOperatorMonitor({...f,observation:bad,send});assert.equal(first.pending,1);
 const next={...bad,checkedAt:snapshot(1).checkedAt};const second=await runOperatorMonitor({...f,observation:next,send});
 assert.equal(second.accepted,1);assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);
 await runOperatorMonitor({...f,observation:{...bad,checkedAt:snapshot(2).checkedAt},send});assert.equal(attempts.length,2);
 assert.equal(f.fs.statSync(f.directory+'/state.json').mode&0o777,0o600);assert(!JSON.stringify(f.read()).includes(f.mail.apiKey));
});
test('O02 outbox does not call provider after bounded attempts or unresolved lock',async t=>{
 const f=await monitorFixture(t),bad=snapshot();bad.jobs.stuck=1;let calls=0;
 const send=async()=>{calls++;return {state:'retryable'};};
 for(const minutes of [0,1,2,3])await runOperatorMonitor({...f,observation:{...snapshot(minutes),jobs:bad.jobs},send});
 assert.equal(calls,3);assert.equal(f.read().outbox[0].status,'exhausted');
 f.fs.writeFileSync(f.directory+'/monitor.lock','existing-owner',{mode:0o600});
 await assert.rejects(runOperatorMonitor({...f,observation:snapshot(4),send}),/MONITOR_LOCKED/);assert.equal(calls,3);
});
test('O02 crash during send retries only the same frozen event inside provider safety window',async t=>{
 const f=await monitorFixture(t),bad=snapshot();bad.jobs.integrity=1;
 await runOperatorMonitor({...f,observation:bad,send:async()=>({state:'retryable'})});
 const state=f.read();state.outbox[0].status='sending';f.fs.writeFileSync(f.directory+'/state.json',JSON.stringify(state));
 let calls=0;const late={...snapshot(24*60),jobs:bad.jobs};
 const result=await runOperatorMonitor({...f,observation:late,send:async()=>{calls++;return {state:'accepted',provider_reference:'01900000-0000-7000-8000-000000000001'};}});
 assert.equal(calls,0);assert.equal(result.expired,1);
});
test('O02 rejected provider response is terminal and unsafe private files fail closed',async t=>{
 const f=await monitorFixture(t),bad=snapshot();bad.jobs.stuck=1;let calls=0;
 const send=async()=>{calls++;return {state:'rejected'};};
 assert.equal((await runOperatorMonitor({...f,observation:bad,send})).rejected,1);
 await runOperatorMonitor({...f,observation:{...snapshot(1),jobs:bad.jobs},send});assert.equal(calls,1);
 f.fs.chmodSync(f.directory+'/state.json',0o644);
 await assert.rejects(runOperatorMonitor({...f,observation:snapshot(2),send}),/PRIVATE_MONITOR_STORAGE_REQUIRED/);assert.equal(calls,1);
});
test('O02 provider error text is not persisted and an unsent alarm holds its recovery in order',async t=>{
 const f=await monitorFixture(t),bad=snapshot();bad.jobs.stuck=1;
 await runOperatorMonitor({...f,observation:bad,send:async()=>{throw new Error('private-provider-sentinel');}});
 const sent=[];
 await runOperatorMonitor({...f,observation:snapshot(1),send:async input=>{sent.push(input.payload.subject);return {state:'retryable'};}});
 assert.equal(sent.length,1);assert.equal(f.read().outbox.length,2);assert(!JSON.stringify(f.read()).includes('private-provider-sentinel'));
});
test('O02 native monitor LOGIN sees only aggregate diagnostics and critical evidence survives an idle tick',async t=>{
 const db=await connect(),password=randomBytes(24).toString('hex'),ids=[key(),key()],providerEvent=key(),providerReference=key();let client,org,health,eventIds=[],roleTouched=false;
 try{
  assert.equal((await db.query("select rolpassword is null empty from pg_authid where rolname='ftk_ops_monitor'")).rows[0]?.empty,true);
  await db.query(`alter role ftk_ops_monitor password '${password}'`);roleTouched=true;
  const url=new URL(context().env.DB_URL);url.username='ftk_ops_monitor';url.password=password;client=new pg.Client({connectionString:url.href});await client.connect();
  assert.equal((await client.query('show default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
  const read=()=>readMonitorTelemetry(client);
  const baseline=await read();assert.equal(baseline.workers.length,5);assert.equal(baseline.incidents.exhausted.total,baseline.jobs.exhausted);assert.equal(baseline.incidents.integrity.total,baseline.jobs.integrity);
  for(const sql of ['select * from core.people','select * from auth.users','select * from private.ops_worker_health','select * from private.ops_integrity_events',"call private.ops_run('p01')"] )await assert.rejects(client.query(sql),/permission denied/);
  await assert.rejects(db.query('select ops_monitor.snapshot()'),/FORBIDDEN/);
  const {platform,plan}=await fixturePlatform(),owner=await authUser('o02-monitor-owner');const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic monitor',initial_plan_id:plan},key())).primary_id;
  health=(await db.query("select last_status,last_error_code,last_finished_at from private.ops_worker_health where lane='p01'")).rows[0];
  await db.query("insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,lease_until) values($1::uuid,$3,'p07.boundary',$1::uuid::text,'running',1,clock_timestamp()-interval '1 minute'),($2::uuid,$3,'p07.boundary',$2::uuid::text,'failed',3,null)",[...ids,org]);
  const beforeEvents=(await db.query("select id from private.ops_integrity_events where lane='p01'")).rows.map(row=>row.id);
  await db.query("update private.ops_worker_health set last_status='job_error',last_error_code='INTEGRITY_VIOLATION',last_finished_at=clock_timestamp() where lane='p01'");
  eventIds=(await db.query("select id from private.ops_integrity_events where lane='p01'")).rows.map(row=>row.id).filter(id=>!beforeEvents.includes(id));assert.equal(eventIds.length,1);assert.equal(eventIds[0][14],'7');
  await db.query("update private.ops_worker_health set last_status='idle',last_error_code=null,last_finished_at=clock_timestamp() where lane='p01'");
  const result=await read();assert.equal(result.jobs.stuck,baseline.jobs.stuck+1);assert.equal(result.jobs.exhausted,baseline.jobs.exhausted+1);assert.equal(result.jobs.integrity,baseline.jobs.integrity+1);
  const ownFailure=result.incidents.exhausted.keys.filter(id=>!baseline.incidents.exhausted.keys.includes(id));assert.equal(ownFailure.length,1);assert.match(ownFailure[0],/^[a-f0-9]{64}$/);
  await db.query('update core.outbox_jobs set version=version+1 where id=$1',[ids[1]]);
  const revised=await read();assert.equal(revised.jobs.exhausted,result.jobs.exhausted);assert(!revised.incidents.exhausted.keys.includes(ownFailure[0]));
  await db.query("insert into private.email_provider_events(event_id,provider_reference,kind,occurred_at,payload_hash) values($1,$2,'failed',clock_timestamp(),repeat('a',64))",[providerEvent,providerReference]);
  assert.equal((await read()).jobs.exhausted,baseline.jobs.exhausted+1);
  await db.query('update core.outbox_jobs set provider_reference=$1 where id=$2',[providerReference,ids[1]]);
  assert.equal((await read()).jobs.exhausted,baseline.jobs.exhausted+1);
  await db.query('update core.outbox_jobs set provider_reference=null where id=$1',[ids[1]]);
  await db.query('update core.outbox_jobs set provider_reference=$1 where id=$2',[providerReference,ids[0]]);
  assert.equal((await read()).jobs.exhausted,baseline.jobs.exhausted+2);
  assert(!JSON.stringify(result).includes(org));assert(!JSON.stringify(result).includes(account.id));assert(!JSON.stringify(result).includes(password));
  assert.equal((await client.query('select has_schema_privilege(current_user,\'private\',\'USAGE\') access')).rows[0].access,false);
  const disk=await monitorFixture(t);
  const collect=()=>collectMonitorObservation({readTelemetry:options=>readMonitorTelemetry(client,options),readBackup:async()=>({state:'missing',usableAt:null}),probe:()=>probeServices({targets:[{url:context().env.API_URL+'/auth/v1/health',statuses:[200]}],timeoutMs:1000}),readerTimeoutMs:1000});
  const observed=await collect(),send=async()=>({state:'accepted',provider_reference:key()});assert.equal(observed.serviceAvailable,true);
  const delivered=await runMonitor({...disk,observation:observed,send});assert(delivered.events.some(event=>event.key==='jobs:integrity'&&event.kind==='alarm'));
  const current=await collect();
  await runMonitor({...disk,observation:current,send,acknowledge:{expectedSnapshot:monitorReviewToken(observed),exhausted:observed.incidents.exhausted.keys.filter(id=>!baseline.incidents.exhausted.keys.includes(id)),integrity:observed.incidents.integrity.keys.filter(id=>!baseline.incidents.integrity.keys.includes(id))}});
  assert.equal(disk.read().acknowledgments.length,1);assert.deepEqual((await read()).jobs,observed.jobs);
 }finally{
  if(client)await client.end();
  try{
   if(health)await db.query("update private.ops_worker_health set last_status=$1,last_error_code=$2,last_finished_at=$3 where lane='p01'",[health.last_status,health.last_error_code,health.last_finished_at]);
   if(eventIds.length)await db.query('delete from private.ops_integrity_events where id=any($1::uuid[])',[eventIds]);
   await db.query('delete from private.email_provider_events where event_id=$1',[providerEvent]);
   if(org)await db.query('delete from core.outbox_jobs where id=any($1::uuid[]) and org_id=$2',[ids,org]);
  }finally{try{if(roleTouched)await db.query('alter role ftk_ops_monitor password null');}finally{await db.end();}}
 }
});
test('O02 unavailable DB preserves open worker/job incidents while independent probes advance availability',async()=>{
 const bad=snapshot();bad.jobs.exhausted=1;bad.workers[0].lastStatus='claim_error';const previous=evaluateMonitor(null,bad);
 const observe=minutes=>collectMonitorObservation({readTelemetry:async()=>{throw new Error('private-db-sentinel');},readBackup:async()=>snapshot().backup,probe:async()=>true,readerTimeoutMs:1000,clock:()=>start+minutes*60000});
 const first=evaluateMonitor(previous.state,await observe(5));assert.deepEqual(first.events,[]);
 const second=evaluateMonitor(first.state,await observe(10));assert.deepEqual(keys(second),[['alarm','availability']]);
 assert.equal(second.state.active.length,3);assert(!JSON.stringify(second).includes('private-db-sentinel'));
 const healthy=await collectMonitorObservation({readTelemetry:async()=>snapshot(15),readBackup:async()=>snapshot().backup,probe:async()=>true,readerTimeoutMs:1000,clock:()=>start+15*60000});
 const recovered=evaluateMonitor(second.state,healthy);assert.equal(recovered.events.filter(e=>e.kind==='recovery').length,3);
});
test('O02 collector probes use bounded HTTP with no redirects or secret-bearing URL',async t=>{
 const {createServer}=await import('node:http');const server=createServer((req,res)=>{res.writeHead(req.url==='/ok'?200:503);res.end('synthetic');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url='http://127.0.0.1:'+server.address().port;
 assert.equal(await probeServices({targets:[{url:url+'/ok',statuses:[200]}],timeoutMs:1000}),true);
 assert.equal(await probeServices({targets:[{url:url+'/fail',statuses:[200]}],timeoutMs:1000}),false);
 await assert.rejects(probeServices({targets:[{url:url+'/ok?key=synthetic',statuses:[200]}],timeoutMs:1000}),/INVALID_MONITOR_PROBE/);
 const unknown=await collectMonitorObservation({readTelemetry:()=>{throw new Error('private-db-sentinel');},readBackup:()=>{throw new Error('private-backup-sentinel');},probe:async()=>true,readerTimeoutMs:1000,clock:()=>start});
 assert.equal(unknown.backup.state,'unavailable');assert.equal(unknown.serviceAvailable,false);
 const alarm=evaluateMonitor(null,unknown);assert.deepEqual(keys(alarm),[['alarm','backup']]);assert(!JSON.stringify(alarm).includes('private-'));
});
test('O02 collector bounds hung readers and cancels them before advancing alarms',async()=>{
 const signals=[];const hung=({signal}={})=>{signals.push(signal);return new Promise(()=>{});};let timer;
 const result=await Promise.race([
  collectMonitorObservation({readTelemetry:hung,readBackup:hung,probe:async()=>false,readerTimeoutMs:10,clock:()=>start}),
  new Promise(resolve=>{timer=setTimeout(()=>resolve(null),500);})
 ]);clearTimeout(timer);
 assert(result);assert.equal(result.telemetryAvailable,false);assert.equal(result.backup.state,'unavailable');assert.equal(signals.length,2);assert(signals.every(signal=>signal?.aborted));
 assert.deepEqual(keys(evaluateMonitor(null,result)),[['alarm','backup']]);
});
test('O02 timed-out native reader closes its dedicated connection without returning raw errors',async()=>{
 let closed=0,rejectQuery;const client={query:()=>new Promise((_,reject)=>{rejectQuery=reject;}),end:async()=>{closed++;rejectQuery(new Error('private-connection-sentinel'));}};
 const result=await collectMonitorObservation({readTelemetry:options=>readMonitorTelemetry(client,options),readBackup:async()=>snapshot().backup,probe:async()=>true,readerTimeoutMs:10,clock:()=>start});
 assert.equal(result.telemetryAvailable,false);assert.equal(closed,1);assert(!JSON.stringify(result).includes('private-connection-sentinel'));
});
const withIncidents=(minutes,exhausted=[],integrity=[])=>({...snapshot(minutes),jobs:{stuck:0,exhausted:exhausted.length,integrity:integrity.length},incidents:{exhausted:{keys:exhausted,total:exhausted.length},integrity:{keys:integrity,total:integrity.length}}});
test('O02 explicit operator acknowledgment preserves evidence and differs from recovery',async t=>{
 const f=await monitorFixture(t),incident='a'.repeat(64),bad=withIncidents(0,[incident]);
 const send=async()=>({state:'accepted',provider_reference:'01900000-0000-7000-8000-000000000001'});
 await runOperatorMonitor({...f,observation:bad,send});
 const reviewed=withIncidents(1,[incident]);
 const result=await runOperatorMonitor({...f,observation:reviewed,send,acknowledge:{expectedSnapshot:monitorReviewToken(bad),exhausted:[incident],integrity:[]}});
 assert.deepEqual(keys(result),[['acknowledged','jobs:exhausted']]);assert.equal(f.read().acknowledgments.length,1);
 assert.equal(f.read().outbox[0].event.kind,'alarm');assert.equal(bad.jobs.exhausted,1);
 assert.deepEqual((await runOperatorMonitor({...f,observation:withIncidents(2,[incident]),send})).events,[]);
});
test('O02 a later critical event alerts after acknowledgment even when total counts are unchanged',async t=>{
 const f=await monitorFixture(t),old='a'.repeat(64),fresh='b'.repeat(64),send=async()=>({state:'rejected'});
 const original=withIncidents(0,[],[old]);await runOperatorMonitor({...f,observation:original,send});
 await runOperatorMonitor({...f,observation:withIncidents(1,[],[old]),send,acknowledge:{expectedSnapshot:monitorReviewToken(original),exhausted:[],integrity:[old]}});
 const result=await runOperatorMonitor({...f,observation:withIncidents(2,[],[fresh]),send});
 assert.deepEqual(keys(result),[['alarm','jobs:integrity']]);assert.equal(result.events[0].severity,'critical');
 assert.equal(f.read().acknowledgments.length,1);
});
test('O02 new faults alert while another incident remains open and stale acknowledgments fail closed',async t=>{
 const f=await monitorFixture(t),old='a'.repeat(64),fresh='b'.repeat(64),send=async()=>({state:'rejected'});
 const original=withIncidents(0,[],[old]);await runOperatorMonitor({...f,observation:original,send});
 const changed=withIncidents(1,[],[old,fresh]);
 await assert.rejects(runOperatorMonitor({...f,observation:changed,send,acknowledge:{expectedSnapshot:monitorReviewToken(original),exhausted:[],integrity:[old]}}),/MONITOR_REVIEW_STALE/);
 const result=await runOperatorMonitor({...f,observation:changed,send});assert.deepEqual(keys(result),[['alarm','jobs:integrity']]);
 assert.deepEqual((await runOperatorMonitor({...f,observation:withIncidents(2,[],[old,fresh]),send})).events,[]);
});
test('O02 acknowledgment requires exact known keys and cannot clear truncated or unavailable observations',async t=>{
 const f=await monitorFixture(t),old='a'.repeat(64),unknown='b'.repeat(64),send=async()=>({state:'rejected'});
 const original=withIncidents(0,[old]);await runOperatorMonitor({...f,observation:original,send});
 await assert.rejects(runOperatorMonitor({...f,observation:withIncidents(1,[old]),send,acknowledge:{expectedSnapshot:monitorReviewToken(original),exhausted:[unknown],integrity:[]}}),/UNKNOWN_MONITOR_INCIDENT/);
 const truncated=withIncidents(1,[old]);truncated.incidents.exhausted.total=2;truncated.jobs.exhausted=2;
 const result=await runOperatorMonitor({...f,observation:truncated,send,acknowledge:{expectedSnapshot:monitorReviewToken(truncated),exhausted:[old],integrity:[]}});
 assert(!result.events.some(event=>event.kind==='acknowledged'));assert(f.read().monitor.active.some(event=>event.key==='jobs:exhausted'));
 const unavailable={...snapshot(2),serviceAvailable:false,telemetryAvailable:false,workers:null,jobs:null};
 await assert.rejects(runOperatorMonitor({...f,observation:unavailable,send,acknowledge:{expectedSnapshot:monitorReviewToken(truncated),exhausted:[old],integrity:[]}}),/MONITOR_INCIDENT_EVIDENCE_REQUIRED/);
});
