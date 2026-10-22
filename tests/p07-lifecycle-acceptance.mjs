// Existing registry shard. Native Auth -> Edge -> RPC plus real dedicated LOGIN sessions.
import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';import {randomBytes} from 'node:crypto';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
test('P07 billing and privacy use live Auth, atomic receipts and scoped native workers',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p07-bc-owner'),member=await authUser('p07-c-member');
 const account=await must(owner,'account_get_v1'),memberAccount=await must(member,'account_get_v1'),db=await connect();
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P07 B/C native acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'P07 B/C',timezone:'UTC'},key())).primary_id;
 const roles=[],clients=[],hostedRoles=[];let trigger,triggerTable='core.audit_events';
 const native=async(group,global=false)=>{
  const role='p07_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');roles.push(role);
  await db.query(`create role ${role} login password '${password}'`);await db.query(`grant ${group} to ${role}`);
  if(group==='ftk_p07_worker')await db.query('insert into private.p07_worker_scopes values($1,$2)',[role,org]);else{await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[role,org]);if(global)await db.query('insert into private.p07_privacy_worker_scopes values($1,null)',[role]);}
  const url=new URL(context().env.DB_URL);url.username=role;url.password=password;const c=new pg.Client({connectionString:url.href});await c.connect();clients.push(c);assert.equal((await c.query('select session_user role')).rows[0].role,role);return c;
 };
 const bank=()=>Array.from({length:512},key);
 const claim=async(c,privacy=false,scope=org)=>(await c.query(`select private.${privacy?'p07_privacy_claim':'p07_jobs_claim'}($1,$2,1) jobs`,[scope,bank()])).rows[0].jobs;
 const execute=async(c,entry,privacy=false)=>(await c.query(privacy?'select private.p07_privacy_execute($1,$2) result':'select private.p07_worker_execute($1,$2,$3) result',privacy?[entry.request,bank()]:[entry.operation,entry.request,bank()])).rows[0].result;
 const version=async()=>Number((await q('select version from core.organizations where id=$1',[org]))[0].version);
 const renewVersion=async()=>Number((await q('select version from core.saas_subscriptions where org_id=$1',[org]))[0].version);
 try{
  await db.query('insert into private.p07_billing_config values(true,900) on conflict(singleton) do update set quote_ttl_seconds=excluded.quote_ttl_seconds');
  await db.query('insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do update set reauth_max_age_seconds=excluded.reauth_max_age_seconds');
  const pay=await must(owner,'saas_payment_submit_v1',{org_id:org,amount_minor:'1000',currency:'TRY',reference:'synthetic P07 initial',occurred_at:new Date().toISOString()},key());
  await must(platform,'saas_payment_verify_v1',{org_id:org,payment_id:pay.primary_id,accepted:true},key());
  const sub=(await q('select * from core.saas_subscriptions where org_id=$1',[org]))[0];
  await t.test('prepaid renewal preserves its anchor until a fenced worker applies the due boundary',async()=>{
   const prepay=await must(owner,'saas_payment_submit_v1',{org_id:org,amount_minor:'1000',currency:'TRY',reference:'synthetic prepayment',occurred_at:new Date().toISOString()},key());
   const verifyKey=key(),body={org_id:org,payment_id:prepay.primary_id,accepted:true};const concurrent=await Promise.all([must(platform,'saas_payment_verify_v1',body,verifyKey),must(platform,'saas_payment_verify_v1',body,verifyKey)]);assert(concurrent.some(x=>x.replayed));
   assert.equal(+(await q('select period_end from core.saas_subscriptions where id=$1',[sub.id]))[0].period_end,+sub.period_end);
   const c=await native('ftk_p07_worker');await assert.rejects(c.query('select * from core.accounts'),/permission denied/);await assert.rejects(c.query('select private.p07_jobs_claim($1,$2,1)',[key(),bank()]),/FORBIDDEN/);
   await db.query("update core.saas_subscriptions set period_end=clock_timestamp()-interval '1 second' where id=$1",[sub.id]);
   const [old]=await claim(c);assert(old);await db.query("update core.outbox_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[old.request.job_id]);const [fresh]=await claim(c);assert(fresh);assert.equal((await execute(c,old)).error.code,'FORBIDDEN');
   const result=await execute(c,fresh);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(await execute(c,fresh),result);
   assert.equal((await execute(c,{...fresh,request:{...fresh.request,center_id:center}})).error.code,'FORBIDDEN');
   assert.equal((await q('select state from core.saas_subscriptions where id=$1',[sub.id]))[0].state,'active');assert.equal((await q('select private.p07_funds($1,$2) amount',[org,'TRY']))[0].amount,'0');
  });
  await t.test('owner blockers, stale previews, late audit rollback and close/reopen preserve obligations',async()=>{
   const blocked=await must(owner,'account_delete_preview_v1');assert(blocked.blockers.some(x=>x.code==='OWNER_TRANSFER_REQUIRED'));
   const p=await must(owner,'organization_close_preview_v1',{org_id:org,reason:'synthetic closure'});assert.equal(p.lifecycle_impact.physical_erasure_complete,false);
   await db.query('update core.organizations set version=version+1 where id=$1',[org]);const stale=await call(owner,'organization_close_apply_v1',{org_id:org,expected_version:await version(),preview:{id:p.id,token:p.token}},key());assert.equal(stale.result.error.code,'PREVIEW_STALE');
   const p2=await must(owner,'organization_close_preview_v1',{org_id:org,reason:'synthetic closure'}),body={org_id:org,expected_version:await version(),preview:{id:p2.id,token:p2.token}};
   trigger='p07_close_'+key().replaceAll('-','');await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='organization_close_apply_v1' then raise exception using errcode='23514',message='synthetic late audit';end if;return new;end$$`);await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
   const k=key(),failed=await call(owner,'organization_close_apply_v1',body,k);assert.equal(failed.result.error.code,'INTEGRITY_VIOLATION');assert.equal((await q('select state from core.organizations where id=$1',[org]))[0].state,'active');assert.equal((await q('select used from private.p07_lifecycle_previews where id=$1',[p2.id]))[0].used,false);
   await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);trigger=null;
   await must(owner,'organization_close_apply_v1',body,k);assert.equal((await must(owner,'management_state_get_v1',{org_id:org,operation:'organization_reopen_v1',selector:{operation:'organization_reopen_v1',key:{}}})).items[0].state,'closed');
   const closed=await call(owner,'organization_get_v1',{org_id:org});assert.equal(closed.result.error.code,'SERVICE_UNAVAILABLE');await must(owner,'organization_reopen_v1',{org_id:org},key());
   assert.equal((await q('select cancel_at_period_end from core.saas_subscriptions where org_id=$1',[org]))[0].cancel_at_period_end,true);
   await must(owner,'subscription_renewal_set_v1',{org_id:org,expected_version:await renewVersion(),renew:true},key());
  });
  let globalJob;
  await t.test('native reauth rejects other users; account deletion revokes sessions and permits only fresh own progress',async()=>{
   const p=await must(member,'account_delete_preview_v1'),body={preview:{id:p.id,token:p.token},reauth:owner.jwt};const wrong=await call(member,'account_delete_apply_v1',body,key());assert.equal(wrong.result.error.code,'AUTH_REQUIRED');
   const k=key();globalJob=(await must(member,'account_delete_apply_v1',{...body,reauth:member.jwt},k)).job_id;
   assert.equal((await q('select count(*)::int n from auth.sessions where user_id=$1',[member.id]))[0].n,0);
   const old=await call(member,'account_get_v1');assert.equal(old.result.ok,false);assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(old.result.error.code));
   const {env}=context();const login=await fetch(env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:member.email,password:member.password})});assert.equal(login.ok,true);member.jwt=(await login.json()).access_token;
   const replay=await must(member,'account_delete_apply_v1',{preview:{id:p.id,token:p.token},reauth:member.jwt},k);assert.equal(replay.job_id,globalJob);
   const own=await must(member,'job_status_get_v1',{org_id:null,job_id:globalJob});assert.equal(own.privacy.request_state,'requested');assert.equal(own.privacy.completed_at,null);
   const foreign=await call(owner,'job_status_get_v1',{org_id:null,job_id:globalJob});assert.equal(foreign.result.error.code,'NOT_FOUND');assert.equal((await call(member,'account_get_v1')).result.error.code,'SESSION_REVOKED');
  });
  await t.test('global privacy uses exact native scope, lease reclaim, atomic partial receipts and no false erasure',async()=>{
   const c=await native('ftk_p07_privacy_worker',true);await assert.rejects(c.query('select * from core.privacy_requests'),/permission denied/);await assert.rejects(c.query('select private.p07_privacy_claim($1,$2,1)',[key(),bank()]),/FORBIDDEN/);
   const [old]=await claim(c,true,null);assert.equal(old.request.job_id,globalJob);await db.query("update private.p07_privacy_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[globalJob]);const [fresh]=await claim(c,true,null);assert.equal((await execute(c,old,true)).error.code,'FORBIDDEN');
   trigger='p07_privacy_'+key().replaceAll('-','');triggerTable='private.p07_lifecycle_events';
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.action='privacy_execute_v1' and new.detail->>'job_id'='${globalJob}' then raise exception using errcode='23514',message='synthetic privacy audit';end if;return new;end$$`);await db.query(`create trigger ${trigger} before insert on ${triggerTable} for each row execute function private.${trigger}()`);
   assert.equal((await execute(c,fresh,true)).error.code,'INTEGRITY_VIOLATION');assert.equal((await q('select state from private.p07_privacy_jobs where id=$1',[globalJob]))[0].state,'running');assert.equal((await q('select count(*)::int n from private.p07_privacy_manifests where request_id=(select request_id from private.p07_privacy_jobs where id=$1)',[globalJob]))[0].n,0);
   await db.query(`drop trigger ${trigger} on ${triggerTable}`);await db.query(`drop function private.${trigger}()`);trigger=null;
   const result=await execute(c,fresh,true);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.data.state,'retry_wait');assert.deepEqual(await execute(c,fresh,true),result);
   const status=await must(member,'job_status_get_v1',{org_id:null,job_id:globalJob});assert.equal(status.privacy.request_state,'partial');assert.equal(status.privacy.completed_at,null);assert.deepEqual(new Set(status.privacy.pending_scopes),new Set(['database','auth','storage','exports','backups']));
   assert.equal((await q('select count(*)::int n from core.operation_receipts where operation=$1 and org_id is null and business_reference=$2',['privacy_execute_v1',result.data.result_reference.id]))[0].n,1);
   const j=(await q('select attempts,stage_runs from private.p07_privacy_jobs where id=$1',[globalJob]))[0];assert.equal(Number(j.attempts),1);assert.equal(Number(j.stage_runs),1);
   // A successful pending stage does not exhaust the failure budget, even over many polls.
   for(let i=0;i<4;i++){await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[globalJob]);const [entry]=await claim(c,true,null);assert(entry);assert.equal((await execute(c,entry,true)).ok,true);}
   assert.equal((await q('select state from private.p07_privacy_jobs where id=$1',[globalJob]))[0].state,'retry_wait');
  });
  await t.test('organization deletion requires all-data preview and native proof; its progress preserves global accounts',async()=>{
   const preview=await must(owner,'organization_delete_preview_v1',{org_id:org,reason:'synthetic org deletion',all_data:true});
   const k=key(),body={org_id:org,all_data:true,preview:{id:preview.id,token:preview.token},reauth:owner.jwt};
   const deleted=await must(owner,'organization_delete_apply_v1',body,k);assert.equal((await must(owner,'organization_delete_apply_v1',body,k)).job_id,deleted.job_id);
   const altered=await call(owner,'organization_delete_apply_v1',{...body,preview:{id:preview.id,token:preview.token+'changed'}},k);assert.equal(altered.result.error.code,'IDEMPOTENCY_PAYLOAD_MISMATCH');

   const c=clients.at(-1);const [entry]=await claim(c,true,org);assert.equal(entry.request.job_id,deleted.job_id);assert.equal((await execute(c,entry,true)).ok,true);
   const status=await must(owner,'job_status_get_v1',{org_id:org,job_id:deleted.job_id});assert.equal(status.privacy.request_state,'partial');assert(!status.privacy.pending_scopes.includes('auth'));assert.equal(status.privacy.completed_at,null);
   assert.equal((await q('select state from core.accounts where id=$1',[account.id]))[0].state,'active');assert.equal((await call(owner,'organization_reopen_v1',{org_id:org},key())).result.ok,false);
  });
  await t.test('P07 hosted lanes use separate native identities, rotate global/tenant privacy fairly and stop when disabled',async()=>{
   const login=async lane=>{const role='ftk_ops_'+lane,password=randomBytes(24).toString('hex');hostedRoles.push(role);await db.query(`alter role ${role} password '${password}'`);const u=new URL(context().env.DB_URL);u.username=role;u.password=password;const c=new pg.Client({connectionString:u.href});await c.connect();clients.push(c);return c;};
   await db.query("insert into private.p07_worker_scopes values('ftk_ops_p07',$1)",[org]);await db.query("insert into private.p07_privacy_worker_scopes values('ftk_ops_p07_privacy',null),('ftk_ops_p07_privacy',$1)",[org]);await db.query("update private.ops_worker_health set enabled=true where lane in ('p07','p07_privacy')");
   const billing=await login('p07'),privacy=await login('p07_privacy');await assert.rejects(billing.query("call private.ops_run('p07_privacy')"),/FORBIDDEN/);await assert.rejects(privacy.query('select * from private.ops_worker_health'),/permission denied/);
   await billing.query("call private.ops_run('p07')");assert.equal((await q("select last_status from private.ops_worker_health where lane='p07'"))[0].last_status,'idle');
   await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1 or org_id=$2",[globalJob,org]);
   await privacy.query("call private.ops_run('p07_privacy')");const first=(await q("select last_org,last_status from private.ops_worker_health where lane='p07_privacy'"))[0];assert.deepEqual(first,{last_org:null,last_status:'succeeded'});
   await privacy.query("call private.ops_run('p07_privacy')");const second=(await q("select last_org,last_status,claimed,failed from private.ops_worker_health where lane='p07_privacy'"))[0];assert.equal(second.last_org,org);assert.equal(second.last_status,'succeeded');assert.equal(Number(second.claimed),2);assert.equal(Number(second.failed),0);
   await privacy.query("call private.ops_run('p07_privacy')");assert.equal((await q("select last_org from private.ops_worker_health where lane='p07_privacy'"))[0].last_org,null);
   await db.query("update private.ops_worker_health set enabled=false where lane='p07_privacy'");const ticks=(await q("select ticks from private.ops_worker_health where lane='p07_privacy'"))[0].ticks;await privacy.query("call private.ops_run('p07_privacy')");assert.equal((await q("select ticks from private.ops_worker_health where lane='p07_privacy'"))[0].ticks,ticks);
  });
 }finally{
  if(trigger){await db.query(`drop trigger if exists ${trigger} on ${triggerTable}`);await db.query(`drop function if exists private.${trigger}()`);}
  for(const c of clients)if(!c._ending)await c.end();
  for(const role of hostedRoles){await db.query('delete from private.p07_worker_scopes where db_role=$1',[role]);await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);await db.query(`alter role ${role} password null`);}
  await db.query("update private.ops_worker_health set enabled=false where lane in ('p07','p07_privacy')");
  for(const role of roles){await db.query('delete from private.p07_worker_scopes where db_role=$1',[role]);await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);await db.query(`drop owned by ${role}`);await db.query(`drop role ${role}`);}
  await db.end();
 }
});
