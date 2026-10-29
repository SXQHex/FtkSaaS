// Existing registry shard: real LOGIN roles, native CALL and durable recovery.
import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomBytes} from 'node:crypto';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
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
   await worker.query("call private.ops_run('p06')");
   assert.deepEqual((await q('select state,attempts from core.outbox_jobs where id=$1',[id]))[0],{state:'retry_wait',attempts:1});
   assert.equal((await q('select count(*)::int n from private.p06_export_files where job_id=$1',[id]))[0].n,0);
   const health=(await q("select last_status,last_error_code from private.ops_worker_health where lane='p06'"))[0];assert.equal(health.last_status,'job_error');assert.equal(health.last_error_code,'INTEGRITY_VIOLATION');
   await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);trigger=null;
   await worker.end();worker=null;await db.query("update core.outbox_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[id]);worker=await login('p06');
   await worker.query("call private.ops_run('p06')");
   assert.deepEqual((await q('select state,attempts from core.outbox_jobs where id=$1',[id]))[0],{state:'succeeded',attempts:2});
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
   await must(owner,'report_file_get_v1',{org_id:org,center_id:center,job_id:live});
   const {env}=context();const response=await fetch(env.API_URL+'/functions/v1/backend-v1/report_file_get_v1?download=csv',{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+owner.jwt,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),org_id:org,center_id:center,job_id:live}),signal:AbortSignal.timeout(60000)});
   assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/csv/);
   const downloaded=Buffer.from(await response.arrayBuffer()),stored=(await q('select body from private.p06_export_files where job_id=$1',[live]))[0].body;
   assert(downloaded.length>0);assert(downloaded.equals(stored));
   const {result}=await call(owner,'report_file_get_v1',{org_id:org,center_id:center,job_id:expired});
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
