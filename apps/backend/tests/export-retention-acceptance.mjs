import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createHash,randomBytes} from 'node:crypto';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {must,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Export expiry and account purge preserve holds, provenance, leases and tenant sources',{timeout:180000},async t=>{
 const f=await preparationFixture({studentUser:true,studentMembership:true});
 const {db,org,center,owner,student,studentPerson,person}=f;
 const account=await must(student,'account_get_v1'),other=await must(owner,'account_get_v1');
 const role='export_purge_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');let worker,blocker,expirer,trigger,raceTrigger;
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const bank=()=>Array.from({length:512},key);
 const request=key(),job=key(),hold=key(),body=Buffer.from('name,amount\r\nSynthetic,25000\r\n');
 const checksum=createHash('sha256').update(body).digest('hex');
 const exportFile=async(a=account.id,p=studentPerson)=>{
  const id=key(),jid=key();
  await db.query("insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,checksum,purpose,state,expires_at) values($1,$2,$3,$4,$5,'text/csv',$6,$7,'export','ready',clock_timestamp()+interval '7 days')",[id,org,center,p,'p06-db-export/'+org+'/'+id,body.length,checksum]);
  await db.query("insert into core.report_jobs(id,org_id,requester_account_id,report_kind,filters,state,file_id,expires_at) values($1,$2,$3,'collections_debts','{}','succeeded',$4,clock_timestamp()+interval '7 days')",[jid,org,a,id]);
  await db.query("insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts) values($1::uuid,$2,'p06.report',$1::uuid::text,'succeeded',1)",[jid,org]);
  await db.query("insert into private.p06_jobs(job_id,org_id,account_id,person_id,center_id,operation,request,phase) values($1,$2,$3,$4,$5,'report_build_v1','{}','report')",[jid,org,a,p,center]);
  await db.query('insert into private.p06_export_files values($1,$2,$3)',[id,jid,body]);
  return {id,job:jid};
 };
 const count=async(table,where,args)=>Number((await q('select count(*) n from '+table+' where '+where,args))[0].n);
 const exists=id=>count('private.p06_export_files','file_id=$1',[id]);
 const expire=async file=>{await db.query("update core.files set expires_at=clock_timestamp()-interval '1 second' where id=$1",[file.id]);await db.query("update core.report_jobs set expires_at=clock_timestamp()-interval '1 second' where id=$1",[file.job]);};
 const setHold=async(table,id,scope=org)=>db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,$3,$4,'Synthetic export hold','native acceptance',clock_timestamp()-interval '1 day')",[hold,scope,table,id]);
 const releaseHold=()=>db.query('delete from core.retention_holds where id=$1',[hold]);
 const claim=()=>worker.query('select private.p06_jobs_claim($1,$2,1)',[org,bank()]);
 let command;
 const renew=async()=>{
  const lease=randomBytes(32).toString('hex');command={client_api_version:1,request_id:key(),org_id:null,job_id:job,operation_key:key(),lease_token:lease};
  await db.query("update private.p07_privacy_jobs set state='running',operation_key=$2,lease_hash=encode(extensions.digest($3,'sha256'),'hex'),lease_until=clock_timestamp()+interval '60 seconds',payload_hash=null,result=null where id=$1",[job,command.operation_key,lease]);
 };
 const execute=async()=>{const result=await worker.query('select private.p07_privacy_execute($1,$2) result',[command,bank()]);return result.rows[0].result;};
 const stage=async()=>(await q("select scopes#>'{exports,database_exports}' progress from private.p07_privacy_manifests where request_id=$1",[request]))[0]?.progress;
 const ok=async()=>{const r=await execute();assert.equal(r.ok,true,r.error?.code);return r;};
 const waitLock=async(pid,event)=>{
  const end=Date.now()+5000;
  while(Date.now()<end){const row=(await q('select wait_event_type,wait_event from pg_stat_activity where pid=$1',[pid]))[0];if(row?.wait_event_type==='Lock'&&row.wait_event===event)return;await new Promise(resolve=>setTimeout(resolve,10));}
  throw Error('Expected native lock was not reached');
 };
 try{
  await db.query(`create role ${role} login password '${password}' in role ftk_p06_worker,ftk_p07_privacy_worker`);
  await db.query('insert into private.p06_worker_scopes values($1,$2)',[role,org]);await db.query('insert into private.p07_privacy_worker_scopes values($1,null)',[role]);
  const url=new URL(context().env.DB_URL);url.username=role;url.password=password;worker=new pg.Client({connectionString:url.href,statement_timeout:15000,lock_timeout:5000});await worker.connect();
  assert.equal((await worker.query('select session_user u')).rows[0].u,role);
  await assert.rejects(worker.query('select * from private.p06_export_files'),/permission denied/);
  await assert.rejects(worker.query('select private.account_export_erasure($1)',[request]),/permission denied/);
  await assert.rejects(worker.query('select private.p06_jobs_claim($1,$2,1)',[key(),bank()]),/FORBIDDEN/);
  const first=await exportFile(),second=await exportFile(),foreign=await exportFile(other.id,person);
  const source=key();await db.query("insert into core.files(id,org_id,center_id,owner_person_id,object_key,mime,size_bytes,checksum,purpose,state) values($1,$2,$3,$4,$5,'text/csv',$6,$7,'import','ready')",[source,org,center,studentPerson,org+'/'+source,body.length,checksum]);
  await db.query('insert into private.p06_files values($1,$2,$3)',[source,account.id,'synthetic-source.csv']);
  const tenantBefore=await q('select * from core.people where org_id=$1 order by id',[org]);
  const holdOrg=(await must(f.platform,'organization_create_v1',{verified_account_id:other.id,name:'Synthetic hold scope',initial_plan_id:f.plan},key())).primary_id;
  await expire(first);
  await t.test('expiry honors every hold family even after review_at, then writes byte proof once',async()=>{
   for(const [table,id,scope] of [['accounts',account.id,null],['core.files',first.id,org],['report_jobs',first.job,org],['private.p06_jobs',first.job,org],['organizations',org,org],['accounts',account.id,holdOrg]]){
    await setHold(table,id,scope);try{await claim();assert.equal(await exists(first.id),1);}finally{await releaseHold();}
   }
   await claim();assert.equal(await exists(first.id),0);assert.equal(await exists(second.id),1);assert.equal(await exists(foreign.id),1);
   const proof=await q('select reason,removed_bytes,checksum,request_id from private.p06_export_purges where file_id=$1',[first.id]);
   assert.deepEqual(proof,[{reason:'expired',removed_bytes:String(body.length),checksum,request_id:null}]);
   await claim();assert.equal(await count('private.p06_export_purges','file_id=$1',[first.id]),1);
   await assert.rejects(db.query('delete from private.p06_export_purges where file_id=$1',[first.id]),/INTEGRITY_VIOLATION/);
  });
  await db.query("update core.accounts set state='deletion_pending' where id=$1",[account.id]);
  await db.query("update core.account_links set state='revoked' where account_id=$1",[account.id]);
  await db.query("insert into core.privacy_requests(id,org_id,kind,requester_account_id,scope,state,requested_at) values($1,null,'account_delete',$2,$3,'requested',clock_timestamp())",[request,account.id,{kind:'account',account_id:account.id}]);
  await db.query("insert into private.p07_privacy_jobs(id,request_id,org_id,state) values($1,$2,null,'pending')",[job,request]);
  await t.test('exact account binding and global hold gate the independent export substage',async()=>{
   await db.query('insert into private.account_export_erasure_scopes values($1,$2)',[role,other.id]);
   await renew();await ok();assert.equal((await stage()).state,'unbound');assert.equal(await exists(second.id),1);
   await db.query('insert into private.account_export_erasure_scopes values($1,$2)',[role,account.id]);
   await setHold('accounts',account.id,null);await renew();await ok();assert.equal((await stage()).state,'held');assert.equal(await exists(second.id),1);await releaseHold();
  });
  await t.test('mismatched requester and another account sharing the file fail closed',async()=>{
   await db.query('update core.report_jobs set requester_account_id=$2 where id=$1',[second.job,other.id]);
   await renew();assert.equal((await execute()).error.code,'INTEGRITY_VIOLATION');assert.equal(await exists(second.id),1);
   await db.query('update core.report_jobs set requester_account_id=$2 where id=$1',[second.job,account.id]);
   await db.query('update private.p06_jobs set account_id=$2 where job_id=$1',[second.job,other.id]);
   await renew();assert.equal((await execute()).error.code,'INTEGRITY_VIOLATION');assert.equal(await exists(second.id),1);
   await db.query('update private.p06_jobs set account_id=$2 where job_id=$1',[second.job,account.id]);
   const missing=(await q('select row_to_json(c) data from private.p06_jobs c where job_id=$1',[second.job]))[0].data;
   await db.query('delete from private.p06_jobs where job_id=$1',[second.job]);
   await renew();assert.equal((await execute()).error.code,'INTEGRITY_VIOLATION');assert.equal(await exists(second.id),1);
   await db.query('insert into private.p06_jobs select * from json_populate_record(null::private.p06_jobs,$1)',[missing]);
   await db.query('update private.p06_export_files set body=$2 where file_id=$1',[second.id,Buffer.from('Changed bytes')]);
   await renew();assert.equal((await execute()).error.code,'INTEGRITY_VIOLATION');assert.equal(await exists(second.id),1);
   await db.query('update private.p06_export_files set body=$2 where file_id=$1',[second.id,body]);
   const alias=key();await db.query("insert into core.report_jobs(id,org_id,requester_account_id,report_kind,filters,state,file_id) values($1,$2,$3,'collections_debts','{}','succeeded',$4)",[alias,org,other.id,second.id]);
   await renew();assert.equal((await execute()).error.code,'INTEGRITY_VIOLATION');assert.equal(await exists(second.id),1);await db.query('delete from core.report_jobs where id=$1',[alias]);
  });
  await t.test('a lease expiring during organization lock wait cannot delete or write completion',async()=>{
   blocker=new pg.Client({connectionString:context().env.DB_URL});await blocker.connect();await blocker.query('begin');await blocker.query('select 1 from core.organizations where id=$1 for update',[org]);
   await renew();await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()+interval '300 milliseconds' where id=$1",[job]);
   const pending=execute();await blocker.query('select pg_sleep(0.6)');await blocker.query('rollback');
   assert.equal((await pending).error.code,'OPERATION_IN_PROGRESS');assert.equal(await exists(second.id),1);assert.equal(await count('private.account_export_erasures','request_id=$1',[request]),0);
   await blocker.end();blocker=null;
  });
  await t.test('expiry and privacy serialize without an account-FK lock inversion',async()=>{
   const race=await exportFile();await expire(race);await setHold('files',second.id);
   const barrier=BigInt('0x'+key().replaceAll('-','').slice(-15)).toString();
   blocker=new pg.Client({connectionString:context().env.DB_URL});await blocker.connect();await blocker.query('select pg_advisory_lock($1::bigint)',[barrier]);
   const url=new URL(context().env.DB_URL);url.username=role;url.password=password;expirer=new pg.Client({connectionString:url.href,statement_timeout:10000});await expirer.connect();
   const expiryPid=(await expirer.query('select pg_backend_pid() pid')).rows[0].pid,privacyPid=(await worker.query('select pg_backend_pid() pid')).rows[0].pid;
   raceTrigger='export_race_'+key().replaceAll('-','');await db.query(`create function private.${raceTrigger}() returns trigger language plpgsql as $$begin if NEW.file_id='${race.id}'::uuid then perform pg_advisory_xact_lock(${barrier}::bigint);end if;return NEW;end$$`);await db.query(`create trigger ${raceTrigger} before insert on private.p06_export_purges for each row execute function private.${raceTrigger}()`);
   const expiring=expirer.query('select private.p06_jobs_claim($1,$2,1)',[org,bank()]);await waitLock(expiryPid,'advisory');
   await renew();const erasing=execute();await waitLock(privacyPid,'transactionid');await blocker.query('select pg_advisory_unlock($1::bigint)',[barrier]);
   const results=await Promise.allSettled([expiring,erasing]);assert(results.every(x=>x.status==='fulfilled'),'Concurrent expiry/privacy must not deadlock');assert.equal(results[1].value.ok,true,results[1].value.error?.code);
   assert.equal(await exists(race.id),0);assert.equal(await exists(second.id),1);assert.equal((await stage()).state,'held');
   await db.query(`drop trigger ${raceTrigger} on private.p06_export_purges`);await db.query(`drop function private.${raceTrigger}()`);raceTrigger=null;
   await expirer.end();expirer=null;await blocker.end();blocker=null;await releaseHold();
  });
  await t.test('late proof failure rolls every byte and per-file proof back; retry is exact and durable',async()=>{
   trigger='export_fail_'+key().replaceAll('-','');await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin raise exception 'INTEGRITY_VIOLATION';end$$`);await db.query(`create trigger ${trigger} before insert on private.account_export_erasures for each row execute function private.${trigger}()`);
   await renew();assert.equal((await execute()).error.code,'INTEGRITY_VIOLATION');assert.equal(await exists(second.id),1);assert.equal(await count('private.p06_export_purges','request_id=$1',[request]),0);
   await db.query(`create or replace function private.${trigger}() returns trigger language plpgsql as $$begin perform pg_sleep(0.6);return NEW;end$$`);
   await renew();await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()+interval '300 milliseconds' where id=$1",[job]);
   assert.equal((await execute()).error.code,'OPERATION_IN_PROGRESS');assert.equal(await exists(second.id),1);assert.equal(await count('private.account_export_erasures','request_id=$1',[request]),0);
   await db.query(`drop trigger ${trigger} on private.account_export_erasures`);await db.query(`drop function private.${trigger}()`);trigger=null;
   await renew();const result=await ok();assert.deepEqual(await execute(),result);
   const progress=await stage();assert.equal(progress.state,'completed');assert.equal(progress.removed_rows,1);assert.equal(progress.removed_bytes,body.length);assert(Number.isFinite(Date.parse(progress.completed_at)));
   await assert.rejects(db.query('delete from private.account_export_erasures where request_id=$1',[request]),/INTEGRITY_VIOLATION/);
   assert.equal(await exists(second.id),0);assert.equal(await exists(foreign.id),1);assert.equal(await count('core.files','id=$1',[source]),1);
   assert.deepEqual(await q('select * from core.people where org_id=$1 order by id',[org]),tenantBefore);
   const state=(await q('select state,completed_at from core.privacy_requests where id=$1',[request]))[0];assert.equal(state.state,'partial');assert.equal(state.completed_at,null);
   const manifest=(await q('select scopes from private.p07_privacy_manifests where request_id=$1',[request]))[0].scopes;for(const name of ['database','auth','storage','exports','backups'])assert.equal(manifest[name].state,'pending');
   await db.query('delete from private.account_export_erasure_scopes where db_role=$1',[role]);await setHold('accounts',account.id,null);await renew();await ok();assert.deepEqual(await stage(),progress);await releaseHold();
  });
  await t.test('automatic expiry is bounded and resumes without duplicate purge evidence',async()=>{
   const batch=[];
   for(let i=0;i<101;i++){const file=await exportFile(other.id,person);await expire(file);batch.push(file.id);}
   await claim();assert.equal(await count('private.p06_export_files','file_id=any($1)',[batch]),1);
   await claim();assert.equal(await count('private.p06_export_files','file_id=any($1)',[batch]),0);
   assert.equal(await count('private.p06_export_purges','file_id=any($1)',[batch]),101);
  });
 }finally{
  if(blocker){await blocker.query('rollback');await blocker.end();}
  if(expirer)await expirer.end();
  if(raceTrigger){await db.query(`drop trigger ${raceTrigger} on private.p06_export_purges`);await db.query(`drop function private.${raceTrigger}()`);}
  if(trigger){await db.query(`drop trigger ${trigger} on private.account_export_erasures`);await db.query(`drop function private.${trigger}()`);}
  if(worker)await worker.end();
  // Global privacy claim is shared across acceptance roots. Do not leave a
  // retry_wait fixture eligible for another suite five minutes later.
  await db.query('delete from private.p07_privacy_jobs where id=$1',[job]);
  await db.query('delete from core.retention_holds where id=$1',[hold]);
  await db.query('delete from private.account_export_erasure_scopes where db_role=$1',[role]);await db.query('delete from private.p06_worker_scopes where db_role=$1',[role]);await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);
  await db.query(`drop role if exists ${role}`);await db.end();
 }
});
