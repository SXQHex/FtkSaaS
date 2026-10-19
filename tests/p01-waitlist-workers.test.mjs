import test from 'node:test';import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {tick} from '../scripts/p01-worker.mjs';import pg from 'pg';import {randomBytes} from 'node:crypto';import {execFile,spawn} from 'node:child_process';import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
const execute=promisify(execFile);
test('P01-C waitlist -> scoped worker -> held offer -> guarded reservation and cleanup',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('wait-owner'),foreign=await authUser('wait-foreign');
 const account=await must(owner,'account_get_v1'),org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P01 waitlist',initial_plan_id:plan},key())).primary_id;
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;let worker;
 const role='p01_w_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');
 try{
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Queue',timezone:'Europe/Istanbul'},key())).primary_id;
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 const scope=b=>({org_id:org,center_id:center,...b}),mut=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
 await mut('center_manager_assign_v1',{person_id:ownerPerson});
 const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic waitlist',occurred_at:new Date().toISOString()});await mut('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Queue',state:'active'},key())).primary_id;await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const pub=(k,value)=>mut('policy_publish_v1',{center_id:null,key:k,value,effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
 const policy=(await pub('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}})).primary_id;
 await pub('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});await pub('request_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});await pub('negative_default',{kind:'integer',value:0});await pub('negative_upper',{kind:'integer',value:0});
 async function person(label){const p=(await mut('person_create_v1',{display_name:label,contacts:[]})).primary_id;await mut('student_activate_v1',{person_id:p});const u=await authUser(label),a=await must(u,'account_get_v1');await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);return {p,u};}
 const first=await person('wait-first'),second=await person('wait-second'),third=await person('wait-third');
 let slot=0;async function session({full=false,at=new Date(Date.now()+2*86400000+slot++*7200000)}={}){const id=key();await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,1,1,'planned','open')",[id,org,center,discipline,at,new Date(+at+3600000)]);if(full)await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[key(),org,center,id,third.p,policy]);return id;}
 const join=(sid,p=first)=>mut('waitlist_join_v1',{session_id:sid,person_id:p.p},p.u);
 const view=async(sid,p=first)=>(await must(p.u,'management_state_get_v1',scope({operation:'waitlist_join_v1',selector:{operation:'waitlist_join_v1',key:{session_id:sid,person_id:p.p}}}))).items.map(v=>v.waitlist_detail);
 const holds=async(sid)=>(await rows("select count(*)::int n from core.seat_offers where org_id=$1 and session_id=$2 and state='active' and expires_at>clock_timestamp()",[org,sid]))[0].n;
 const ids=()=>Array.from({length:4096},key);
 await db.query(`create role "${role}" login password '${password}'`);await db.query(`grant ftk_p01_worker to "${role}"`);await db.query('insert into private.p01_worker_scopes(db_role,org_id) values($1,$2)',[role,org]);
 const workerUrl=new URL(context().env.DB_URL);workerUrl.username=role;workerUrl.password=password;
 worker=new pg.Client({connectionString:workerUrl.toString()});await worker.connect();
 const drain=async(n=6)=>{for(let i=0;i<n;i++){const results=await tick(worker,org);assert(results.every(r=>r.ok),JSON.stringify(results));if(!results.length)break;}};
 const invoke=async(op,r)=>(await worker.query('select private.p01_worker_execute($1,$2,$3) result',[op,r,ids()])).rows[0].result;
 const deniedResult=promise=>assert.rejects(promise,/FORBIDDEN/);
 await t.test('join is intent, scoped and duplicate-safe; worker identity is not a human grant',async()=>{
  const sid=await session(),w=await join(sid);await join(sid,second);assert.equal(await holds(sid),0);
  const duplicate=await call(first.u,'waitlist_join_v1',scope({session_id:sid,person_id:first.p}),key());assert.equal(duplicate.result.error.code,'OPEN_OPERATIONS_EXIST');
  const denied=await call(second.u,'waitlist_leave_v1',scope({entry_id:w.primary_id,expected_version:1}),key());assert.equal(denied.result.error.code,'FORBIDDEN');
  const hidden=await call(foreign,'waitlist_join_v1',scope({session_id:sid,person_id:first.p}),key());assert.equal(hidden.result.error.code,'NOT_FOUND');
  const human=await call(owner,'seat_offer_issue_v1',{org_id:org,job_id:key(),lease_token:'synthetic-worker-lease'},key());assert.equal(human.result.error.code,'FORBIDDEN');
  await assert.rejects(worker.query('select * from core.people'),/permission denied/);
  const minimal=(await worker.query("select has_schema_privilege(current_user,'auth','usage') auth_usage,has_schema_privilege(current_user,'core','usage') core_usage,has_function_privilege(current_user,'private.execute_operation(text,jsonb,uuid,uuid,uuid[],jsonb)','execute') human_dispatch")).rows[0];
  assert.deepEqual(minimal,{auth_usage:false,core_usage:false,human_dispatch:false});
  await assert.rejects(worker.query('select api_v1.seat_offer_issue_v1($1,null,null,$2,null)',[{org_id:org},ids()]),/permission denied/);
  await assert.rejects(worker.query('select api_v1.p01_jobs_claim($1,$2,1)',[key(),ids()]),/FORBIDDEN/);
  const cli=await execute(process.execPath,['scripts/p01-worker.mjs'],{env:{...process.env,P01_WORKER_DATABASE_URL:workerUrl.toString(),P01_WORKER_ORG_ID:org}});assert.match(cli.stdout,/"succeeded":1/);
  const entries=await view(sid);assert.equal(entries[0].id,w.primary_id);assert.equal(entries[0].state,'offered');assert.equal(await holds(sid),1);assert.equal((await view(sid,second))[0].state,'waiting');
  const offer=entries[0].offers[0];assert(Date.parse(offer.expires_at)<=Date.now()+30*60000+1000);
  const blocked=await call(owner,'reservation_create_v1',scope({session_id:sid,person_id:second.p,mode:'flexible'}),key());assert.equal(blocked.result.error.code,'CAPACITY_FULL');
  const b={offer_id:offer.id,expected_version:offer.version},k=key();const noRight=await call(first.u,'seat_offer_accept_v1',scope(b),k);assert.equal(noRight.result.ok,false);assert(['ENTITLEMENT_UNAVAILABLE','CREDIT_LIMIT_EXCEEDED','PARTICIPATION_BLOCKED'].includes(noRight.result.error.code),JSON.stringify(noRight.result));
  let unchanged=(await view(sid))[0].offers[0];assert.equal(unchanged.state,'active');assert.equal(unchanged.expires_at,offer.expires_at);assert.equal(await holds(sid),1);
  const pv=(await mut('product_publish_v1',{terms:{name:'Queue rights',kind:'credits',booking_mode:'flexible',credits:10,price_minor:'0',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
  const preview=await must(owner,'sale_preview_v1',scope({person_id:first.p,product_version_id:pv,start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+30*86400000).toISOString().slice(0,10)}));await mut('sale_apply_v1',{preview:{id:preview.id,token:preview.token}});
  const accepted=await mut('seat_offer_accept_v1',b,first.u,k);assert(accepted.related.some(v=>v.type==='reservations'));assert.equal((await view(sid))[0].state,'converted');assert.equal(await holds(sid),0);
  assert.equal((await rows("select count(*)::int n from core.reservations where org_id=$1 and session_id=$2 and state='active'",[org,sid]))[0].n,1);
 });
 await t.test('reject, expiry and rejoin preserve FIFO without auto-reservation',async()=>{
  const sid=await session();await join(sid);await join(sid,second);await drain();let o=(await view(sid))[0].offers[0];
  await mut('seat_offer_reject_v1',{offer_id:o.id,expected_version:o.version},first.u);await drain();assert.equal((await view(sid,second))[0].state,'offered');
  await join(sid);o=(await view(sid,second))[0].offers[0];await db.query("update core.seat_offers set expires_at=clock_timestamp()-interval '1 second' where id=$1",[o.id]);
  await drain();assert.equal((await view(sid,second))[0].state,'closed');assert.equal((await view(sid)).find(v=>v.state==='offered').person_id,first.p);assert.equal(await holds(sid),1);
  assert.equal((await rows('select count(*)::int n from core.reservations where org_id=$1 and session_id=$2',[org,sid]))[0].n,0);
 });
 await t.test('lease fencing, immutable operation, replay and live scope revocation',async()=>{
  const sid=await session();await join(sid);const jobs=(await worker.query('select api_v1.p01_jobs_claim($1,$2,1) jobs',[org,ids()])).rows[0].jobs;assert.equal(jobs.length,1);const {operation,request}=jobs[0];
  await deniedResult(invoke(operation,{...request,lease_token:'wrong-synthetic-lease'}));
  await deniedResult(invoke('request_expire_v1',request));
  const result=await invoke(operation,request);assert(result.ok,JSON.stringify(result));assert.deepEqual(await invoke(operation,request),result);
  await db.query('delete from private.p01_worker_scopes where db_role=$1 and org_id=$2',[role,org]);await deniedResult(invoke(operation,request));await db.query('insert into private.p01_worker_scopes(db_role,org_id) values($1,$2)',[role,org]);
 });
 await t.test('cancelled sessions close offers and waiting-only entries; expiry/accept has one terminal result',async()=>{
  const sid=await session();await join(sid);await join(sid,second);await drain();await db.query("update core.sessions set state='cancelled',version=version+1 where id=$1",[sid]);await drain();assert((await view(sid)).every(w=>w.state==='closed'));assert((await view(sid,second)).every(w=>w.state==='closed'));assert.equal(await holds(sid),0);
  const sid2=await session();await join(sid2);await db.query("update core.sessions set state='cancelled' where id=$1",[sid2]);await drain();assert.equal((await view(sid2))[0].state,'closed');
  const sid3=await session();await join(sid3);await drain();const offer=(await view(sid3))[0].offers[0];await db.query("update core.seat_offers set expires_at=clock_timestamp()-interval '1 second' where id=$1",[offer.id]);
  const answers=await Promise.all([call(first.u,'seat_offer_accept_v1',scope({offer_id:offer.id,expected_version:offer.version}),key()),tick(worker,org)]);assert.equal(answers[0].result.ok,false);await drain();assert.equal((await view(sid3))[0].offers[0].state,'expired');
 });
 await t.test('accepted offer survives the late expiry ordering without duplicate booking',async()=>{
  const sid=await session();await join(sid);await drain();const offer=(await view(sid))[0].offers[0];
  const accepted=await mut('seat_offer_accept_v1',{offer_id:offer.id,expected_version:offer.version},first.u);assert(accepted.related.some(v=>v.type==='reservations'));
  const job=key();await db.query("insert into core.outbox_jobs(id,org_id,kind,dedupe_key,state,attempts,next_attempt_at) values($1,$2,'p01.seat_offer_expire_v1',$3,'pending',0,clock_timestamp())",[job,org,'synthetic-late-expiry:'+job]);
  await db.query("insert into private.p01_jobs(job_id,org_id,operation,target_id) values($1,$2,'seat_offer_expire_v1',$3)",[job,org,offer.id]);
  await db.query("update core.seat_offers set expires_at=clock_timestamp()-interval '1 second' where id=$1",[offer.id]);await drain();
  assert.equal((await view(sid))[0].offers[0].state,'accepted');assert.equal((await rows("select count(*)::int n from core.reservations where org_id=$1 and session_id=$2 and state='active'",[org,sid]))[0].n,1);
 });
 await t.test('expired running lease is reclaimed and fences the crashed worker',async()=>{
  const sid=await session();await join(sid);
  const old=(await worker.query('select api_v1.p01_jobs_claim($1,$2,1) jobs',[org,ids()])).rows[0].jobs[0];assert(old);
  await db.query("update core.outbox_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[old.request.job_id]);
  const fresh=(await worker.query('select api_v1.p01_jobs_claim($1,$2,1) jobs',[org,ids()])).rows[0].jobs[0];assert.equal(fresh.request.job_id,old.request.job_id);assert.notEqual(fresh.request.lease_token,old.request.lease_token);
  await deniedResult(invoke(old.operation,old.request));const result=await invoke(fresh.operation,fresh.request);assert(result.ok,JSON.stringify(result));assert.equal(await holds(sid),1);
  assert.equal(Number((await rows('select attempts from core.outbox_jobs where id=$1',[old.request.job_id]))[0].attempts),2);
 });
 await t.test('live center state and plan exclusion prevent discovery, execution and replay; cleanup remains available',async()=>{
  const sid=await session();await join(sid);const claim=(await worker.query('select api_v1.p01_jobs_claim($1,$2,1) jobs',[org,ids()])).rows[0].jobs[0];assert(claim);
  const pending=await session();await join(pending);
  const otherCenter=(await must(owner,'center_create_v1',{org_id:org,name:'Earlier visible center',timezone:'UTC'},key())).primary_id;
  await db.query("update core.centers set created_at='2020-01-01' where id=$1",[otherCenter]);
  try{
   await db.query("update core.centers set state='inactive' where id=$1",[center]);
   await assert.rejects(invoke(claim.operation,claim.request),/NOT_FOUND/);await worker.query('select api_v1.p01_jobs_claim($1,$2,1)',[org,ids()]);assert.equal(await holds(sid),0);
   assert.equal((await rows('select count(*)::int n from private.p01_jobs where org_id=$1 and target_id=$2',[org,pending]))[0].n,0);
   await db.query("update core.centers set state='active' where id=$1",[center]);await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
   await assert.rejects(invoke(claim.operation,claim.request),/NOT_FOUND/);await worker.query('select api_v1.p01_jobs_claim($1,$2,1)',[org,ids()]);assert.equal(await holds(sid),0);
   assert.equal((await rows('select count(*)::int n from private.p01_jobs where org_id=$1 and target_id=$2',[org,pending]))[0].n,0);
   await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);const result=await invoke(claim.operation,claim.request);assert(result.ok,JSON.stringify(result));
   await db.query("update core.centers set state='inactive' where id=$1",[center]);await assert.rejects(invoke(claim.operation,claim.request),/NOT_FOUND/);
   await db.query("update core.seat_offers set expires_at=clock_timestamp()-interval '1 second' where session_id=$1 and state='active'",[sid]);await drain();assert.equal(await holds(sid),0);
  }finally{await db.query("update core.centers set state='active' where id=$1",[center]);await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);}
  await drain();assert.equal(await holds(pending),1);
 });
 await t.test('request expiry uses stored/intrinsic deadline, never turns elapsed time into attendance',async()=>{
  const request=(await mut('lesson_request_create_v1',{person_id:first.p,discipline_id:discipline,requested_start:new Date(Date.now()+86400000).toISOString(),duration_minutes:60},first.u)).primary_id;
  await db.query("update core.lesson_requests set expires_at=clock_timestamp()-interval '1 second' where id=$1",[request]);await drain();assert.equal((await rows('select state from core.lesson_requests where id=$1',[request]))[0].state,'expired');
 });
 await t.test('late worker failure rolls domain back and records only three bounded retries',async()=>{
  const sid=await session();await join(sid);let jobs=(await worker.query('select api_v1.p01_jobs_claim($1,$2,1) jobs',[org,ids()])).rows[0].jobs;assert.equal(jobs.length,1);let claim=jobs[0];
  const fault='p01_fault_'+key().replaceAll('-','');
  await db.query(`create function private."${fault}"() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.kind='seat_offer' then raise exception using errcode='P0001',message='TEMPORARY_FAILURE';end if;return new;end$$`);
  await db.query(`create trigger "${fault}" before insert on core.notifications for each row execute function private."${fault}"()`);
  try{
   for(let attempt=1;attempt<=3;attempt++){
    const result=await invoke(claim.operation,claim.request);assert.equal(result.ok,false);assert.equal(result.error.code,'TEMPORARY_FAILURE');assert.equal(await holds(sid),0);assert.equal((await view(sid))[0].state,'waiting');
    const state=(await rows('select state,attempts from core.outbox_jobs where id=$1',[claim.request.job_id]))[0];assert.equal(Number(state.attempts),attempt);assert.equal(state.state,attempt===3?'failed':'retry_wait');
    if(attempt<3){await db.query("update core.outbox_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[claim.request.job_id]);const old=claim;const reclaimed=(await worker.query('select api_v1.p01_jobs_claim($1,$2,1) jobs',[org,ids()])).rows[0].jobs;claim=reclaimed[0];assert.equal(claim.request.job_id,old.request.job_id);await deniedResult(invoke(old.operation,old.request));}
   }
   assert.equal((await rows("select count(*)::int n from core.operation_receipts where org_id=$1 and business_reference in (select id from core.seat_offers where session_id=$2)",[org,sid]))[0].n,0);
  }finally{await db.query(`drop trigger "${fault}" on core.notifications`);await db.query(`drop function private."${fault}"()`);}
 });
 await t.test('bounded discovery progresses past fifty full sessions and waits for configured opening',async()=>{
  for(let i=0;i<51;i++){const sid=await session({full:true,at:new Date(Date.now()+86400000+i*1000)});await db.query("insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values($1,$2,$3,$4,$5,clock_timestamp(),'waiting')",[key(),org,center,sid,first.p]);}
  const free=await session();await join(free);await drain();assert.equal(await holds(free),1);
  const later=await session({at:new Date(Date.now()+15*86400000)}),entry=key();await db.query("insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values($1,$2,$3,$4,$5,clock_timestamp(),'waiting')",[entry,org,center,later,first.p]);await drain();assert.equal(await holds(later),0);
  await db.query("update core.sessions set starts_at=clock_timestamp()+interval '3 days',ends_at=clock_timestamp()+interval '3 days 1 hour',version=version+1 where id=$1",[later]);await drain();assert.equal(await holds(later),1);
 });
 await t.test('scheduled loop discovers newly queued work after startup and shuts down cleanly',async()=>{
  const a=await session();await join(a);
  const child=spawn(process.execPath,['scripts/p01-worker.mjs','--loop'],{env:{...process.env,P01_WORKER_DATABASE_URL:workerUrl.toString(),P01_WORKER_ORG_ID:org,P01_WORKER_INTERVAL_MS:'1000'},stdio:['ignore','pipe','pipe']});
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();let stderr='';child.stderr.on('data',x=>stderr+=x);
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error('Worker exited '+code+'/'+signal+' '+stderr)));});
  const next=()=>Promise.race([lines.next(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Worker loop output timeout')),15000);timer.unref();})]);
  try{
   const firstTick=await next();assert.equal(firstTick.done,false);assert.equal(JSON.parse(firstTick.value).succeeded,1);assert.equal(await holds(a),1);
   const b=await session();await join(b);let offered=false;
   for(let i=0;i<10;i++){const line=await next();assert.equal(line.done,false);const result=JSON.parse(line.value);if(result.succeeded){offered=true;break;}}
   assert(offered,'Loop must discover work added after it started');assert.equal(await holds(b),1);
  }finally{child.kill('SIGTERM');await done;}
 });
 }finally{if(worker)await worker.end();await db.query('delete from private.p01_worker_scopes where db_role=$1',[role]);await db.query(`drop role if exists "${role}"`);await db.end();}
});
