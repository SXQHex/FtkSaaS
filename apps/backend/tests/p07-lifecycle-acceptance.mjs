// Existing registry shard. Native Auth -> Edge -> RPC plus real dedicated LOGIN sessions.
import {eraseNativeAccount} from '../scripts/native-account-erasure.mjs';
import test,{resources,step} from './p07-diagnostics.mjs';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {newUuidV7 as key} from '../scripts/uuid.mjs';import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
test('P07 billing and privacy use live Auth, atomic receipts and scoped native workers',async t=>{
 const guard=resources(t);
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p07-bc-owner'),member=await authUser('p07-c-member');
 const account=await must(owner,'account_get_v1'),memberAccount=await must(member,'account_get_v1'),db=await guard.connect(context().env.DB_URL);
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P07 B/C native acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'P07 B/C',timezone:'UTC'},key())).primary_id;
 const roles=[],clients=[],hostedRoles=[];let trigger,triggerTable='core.audit_events';
 const native=async(group,global=false)=>{
  const role='p07_'+key().replaceAll('-',''),password=randomBytes(24).toString('hex');roles.push(role);
  await db.query(`create role ${role} login password '${password}'`);await db.query(`grant ${group} to ${role}`);
  if(group==='ftk_p07_worker')await db.query('insert into private.p07_worker_scopes values($1,$2)',[role,org]);else{await db.query('insert into private.p07_privacy_worker_scopes values($1,$2)',[role,org]);if(global)await db.query('insert into private.p07_privacy_worker_scopes values($1,null)',[role]);}
  const url=new URL(context().env.DB_URL);url.username=role;url.password=password;const c=await guard.connect(url.href);clients.push(c);assert.equal((await c.query('select session_user role')).rows[0].role,role);return c;
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
  let globalJob,memberPerson;
  await t.test('native reauth rejects other users; account deletion revokes sessions and permits only fresh own progress',async()=>{
   const ownerPerson=(await q('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
   await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:ownerPerson},key());
   memberPerson=(await must(owner,'person_create_v1',{org_id:org,center_id:center,display_name:'Retained business identity',contacts:[{kind:'email',value:member.email}]},key())).primary_id;
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',clock_timestamp())",[key(),org,memberAccount.id,memberPerson]);
   const p=await must(member,'account_delete_preview_v1'),body={preview:{id:p.id,token:p.token},reauth:owner.jwt};const wrong=await call(member,'account_delete_apply_v1',body,key());assert.equal(wrong.result.error.code,'AUTH_REQUIRED');
   const k=key();globalJob=(await must(member,'account_delete_apply_v1',{...body,reauth:member.jwt},k)).job_id;
   assert.equal((await q('select count(*)::int n from auth.sessions where user_id=$1',[member.id]))[0].n,0);
   const old=await call(member,'account_get_v1');assert.equal(old.result.ok,false);assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(old.result.error.code));
   const {env}=context();const login=await fetch(env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:member.email,password:member.password}),signal:AbortSignal.timeout(60000)});assert.equal(login.ok,true);member.jwt=(await login.json()).access_token;
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
   const login=async lane=>{const role='ftk_ops_'+lane,password=randomBytes(24).toString('hex');hostedRoles.push(role);await db.query(`alter role ${role} password '${password}'`);const u=new URL(context().env.DB_URL);u.username=role;u.password=password;const c=await guard.connect(u.href);clients.push(c);return c;};
   await db.query("insert into private.p07_worker_scopes values('ftk_ops_p07',$1)",[org]);await db.query("insert into private.p07_privacy_worker_scopes values('ftk_ops_p07_privacy',null),('ftk_ops_p07_privacy',$1)",[org]);await db.query("update private.ops_worker_health set enabled=true where lane in ('p07','p07_privacy')");
   const billing=await login('p07'),privacy=await login('p07_privacy');await assert.rejects(billing.query("call private.ops_run('p07_privacy')"),/FORBIDDEN/);await assert.rejects(privacy.query('select * from private.ops_worker_health'),/permission denied/);
   await billing.query("call private.ops_run('p07')");assert.equal((await q("select last_status from private.ops_worker_health where lane='p07'"))[0].last_status,'idle');
   await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1 or org_id=$2",[globalJob,org]);
   await privacy.query("call private.ops_run('p07_privacy')");const first=(await q("select last_org,last_status from private.ops_worker_health where lane='p07_privacy'"))[0];assert.deepEqual(first,{last_org:null,last_status:'succeeded'});
   await privacy.query("call private.ops_run('p07_privacy')");const second=(await q("select last_org,last_status,claimed,failed from private.ops_worker_health where lane='p07_privacy'"))[0];assert.equal(second.last_org,org);assert.equal(second.last_status,'succeeded');assert.equal(Number(second.claimed),2);assert.equal(Number(second.failed),0);
   await privacy.query("call private.ops_run('p07_privacy')");assert.equal((await q("select last_org from private.ops_worker_health where lane='p07_privacy'"))[0].last_org,null);
   await db.query("update private.ops_worker_health set enabled=false where lane='p07_privacy'");const ticks=(await q("select ticks from private.ops_worker_health where lane='p07_privacy'"))[0].ticks;await privacy.query("call private.ops_run('p07_privacy')");assert.equal((await q("select ticks from private.ops_worker_health where lane='p07_privacy'"))[0].ticks,ticks);
  });
  await t.test('bound account profile erasure honors non-expiring holds, rolls back late failures and preserves tenant evidence',async()=>{
   const retired=await q("select to_regclass('private.account_google_link_intents') google,to_regclass('private.account_totp_removal_intents') totp");assert.deepEqual(retired,[{google:null,totp:null}]);
   const c=await native('ftk_p07_privacy_worker',true),role=(await c.query('select session_user role')).rows[0].role;
   const request=(await q('select request_id from private.p07_privacy_jobs where id=$1',[globalJob]))[0].request_id;
   const target=memberAccount.id,skey='user:'+target,first=key(),second=key(),foreign=key(),receipt=key(),hold=key();
   await db.query('insert into private.p07_profiles values($1,$2) on conflict(account_id) do update set display_name=excluded.display_name',[target,'Synthetic erasable profile']);
   await db.query('insert into private.account_identity_names(account_id,given_name,unverified_phone) values($1,$2,$3) on conflict(account_id) do update set given_name=excluded.given_name,unverified_phone=excluded.unverified_phone',[target,'Synthetic','+905551234567']);
   await db.query("insert into private.frontend_settings(scope_key,scope,values) values($1,'user','{\"language\":\"tr\"}') on conflict(scope_key) do update set values=excluded.values",[skey]);
   await db.query("insert into core.operation_receipts(id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values($1,$2,'account_profile_update_v1',$3,$4,'succeeded',clock_timestamp()+interval '30 days')",[receipt,target,'a'.repeat(64),'b'.repeat(64)]);
   for(const [id,scope,body] of [[first,skey,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==','base64')],[second,skey,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==','base64')],[foreign,'user:'+account.id,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==','base64')]]){
    await db.query("insert into private.settings_media_assets(id,scope_key,mime,body,checksum) values($1,$2,'image/png',$3::bytea,encode(extensions.digest($3::bytea,'sha256'),'hex'))",[id,scope,body]);
   }
   await db.query('insert into private.settings_media_current values($1,$2)',[skey,second]);
   await db.query('insert into private.settings_media_history values($1,$2,$3,$4)',[receipt,skey,first,second]);
   const preserved=await q('select id,scope_key,checksum from private.settings_media_assets where id=$1',[foreign]);
   const tenantBefore=await q('select id,state from core.people where org_id=$1 order by id',[org]);
   const targetBefore=await q('select * from core.people where org_id=$1 and id=$2',[org,memberPerson]);assert.equal(targetBefore.length,1);
   const contactsBefore=await q('select * from core.person_contacts where org_id=$1 and person_id=$2 order by id',[org,memberPerson]);assert(contactsBefore.length>0);
   const evidenceBefore=await q('select * from core.audit_events where org_id=$1 and subject_id=$2 order by id',[org,memberPerson]);assert(evidenceBefore.length>0);
   const retry=async()=>{await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[globalJob]);const [entry]=await claim(c,true,null);assert.equal(entry.request.job_id,globalJob);return entry;};
   await db.query('insert into private.account_profile_erasure_scopes values($1,$2)',[role,account.id]);
   const executeOk=async entry=>{const result=await execute(c,entry,true);assert.equal(result.ok,true,result.error?.code);return result;};
   let entry=await retry();await executeOk(entry);
   assert.equal((await must(member,'job_status_get_v1',{org_id:null,job_id:globalJob})).privacy.profile_erasure.state,'unbound');
   assert.equal((await q('select count(*)::int n from private.settings_media_assets where scope_key=$1',[skey]))[0].n,2);
   await db.query('insert into private.account_profile_erasure_scopes values($1,$2)',[role,target]);
   await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,null,'accounts',$2,'Synthetic explicit hold','synthetic-test',clock_timestamp()-interval '1 day')",[hold,target]);
   entry=await retry();await executeOk(entry);
   assert.equal((await must(member,'job_status_get_v1',{org_id:null,job_id:globalJob})).privacy.profile_erasure.state,'held');
   assert.equal((await q('select count(*)::int n from private.settings_media_assets where scope_key=$1',[skey]))[0].n,2);
   await db.query('delete from core.retention_holds where id=$1',[hold]);
   await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,'settings_media_assets',$3,'Synthetic specific avatar hold','synthetic-test',clock_timestamp()-interval '1 day')",[hold,org,first]);
   entry=await retry();await executeOk(entry);
   assert.equal((await must(member,'job_status_get_v1',{org_id:null,job_id:globalJob})).privacy.profile_erasure.state,'held');
   assert.equal((await q('select count(*)::int n from private.settings_media_assets where scope_key=$1',[skey]))[0].n,2);
   await db.query('delete from core.retention_holds where id=$1',[hold]);
   await assert.rejects(c.query('select private.account_profile_erasure($1)',[request]),/permission denied/);
   await c.query("select set_config('ftk.profile_erasure_request',$1,false)",[request]);
   await assert.rejects(c.query('delete from private.settings_media_assets where scope_key=$1',[skey]),/permission denied/);
   entry=await retry();const lockTimeout=(await db.query('show lock_timeout')).rows[0].lock_timeout;
   await c.query('begin');
   try{
    assert.equal((await execute(c,{...entry,request:{...entry.request,lease_token:'wrong'}},true)).error.code,'FORBIDDEN');
    await executeOk(entry);
    await db.query("set lock_timeout='100ms'");
    await assert.rejects(db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,null,'accounts',$2,'Synthetic concurrent hold','synthetic-test',clock_timestamp())",[hold,target]),error=>error.code==='55P03');
   }finally{await c.query('rollback');await db.query("select set_config('lock_timeout',$1,false)",[lockTimeout]);}
   assert.equal((await q('select count(*)::int n from private.settings_media_assets where scope_key=$1',[skey]))[0].n,2);
   trigger='profile_erase_'+key().replaceAll('-','');triggerTable='private.account_profile_erasures';
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.request_id='${request}'::uuid and new.completed_at is not null then raise exception using errcode='23514',message='synthetic late purge';end if;return new;end$$`);
   await db.query(`create trigger ${trigger} before update on ${triggerTable} for each row execute function private.${trigger}()`);
   assert.equal((await execute(c,entry,true)).error.code,'INTEGRITY_VIOLATION');
   assert.equal((await q('select count(*)::int n from private.settings_media_assets where scope_key=$1',[skey]))[0].n,2);
   assert.equal((await q('select count(*)::int n from private.account_profile_erasures where request_id=$1',[request]))[0].n,0);
   await db.query(`drop trigger ${trigger} on ${triggerTable}`);await db.query(`drop function private.${trigger}()`);trigger=null;
   await executeOk(entry);
   const done=(await must(member,'job_status_get_v1',{org_id:null,job_id:globalJob})).privacy;
   assert.equal(done.profile_erasure.state,'completed');assert.equal(done.profile_erasure.removed_bytes,140);assert(done.profile_erasure.removed_rows>=6);
   assert.equal(done.request_state,'partial');assert.equal(done.completed_at,null);assert.deepEqual(new Set(done.pending_scopes),new Set(['database','auth','storage','exports','backups']));
   for(const table of ['p07_profiles','account_identity_names'])assert.equal((await q('select count(*)::int n from private.'+table+' where account_id=$1',[target]))[0].n,0);
   assert.equal((await q('select count(*)::int n from private.settings_media_assets where scope_key=$1',[skey]))[0].n,0);
   assert.deepEqual(await q('select id,scope_key,checksum from private.settings_media_assets where id=$1',[foreign]),preserved);
   assert.deepEqual(await q('select id,state from core.people where org_id=$1 order by id',[org]),tenantBefore);
   assert.deepEqual(await q('select * from core.people where org_id=$1 and id=$2',[org,memberPerson]),targetBefore);
   assert.deepEqual(await q('select * from core.person_contacts where org_id=$1 and person_id=$2 order by id',[org,memberPerson]),contactsBefore);
   assert.deepEqual(await q('select * from core.audit_events where org_id=$1 and subject_id=$2 order by id',[org,memberPerson]),evidenceBefore);
   assert.equal((await q('select count(*)::int n from auth.users where id=$1',[member.id]))[0].n,1);
   const proof=await q('select * from private.account_profile_erasures where request_id=$1',[request]);
   await db.query('delete from private.account_profile_erasure_scopes where db_role=$1 and account_id=$2',[role,target]);
   await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,null,'accounts',$2,'Synthetic post-completion hold','synthetic-test',clock_timestamp())",[hold,target]);
   entry=await retry();await executeOk(entry);assert.deepEqual(await q('select * from private.account_profile_erasures where request_id=$1',[request]),proof);
   assert.equal((await must(member,'job_status_get_v1',{org_id:null,job_id:globalJob})).privacy.profile_erasure.state,'completed');
   await db.query('delete from core.retention_holds where id=$1',[hold]);
   await assert.rejects(db.query('delete from private.settings_media_assets where id=$1',[foreign]),/INTEGRITY_VIOLATION/);
  });
  await t.test('native principal deletion fences late holds and expired leases and rolls back provider failures',async()=>{
   const c=await native('ftk_p07_privacy_worker',true),role=(await c.query('select session_user role')).rows[0].role;
   const request=(await q('select request_id from private.p07_privacy_jobs where id=$1',[globalJob]))[0].request_id,hold=key();
   await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[globalJob]);
   const [entry]=await claim(c,true,null);assert.equal(entry.request.job_id,globalJob);
   const prepare=async()=>(await c.query('select private.p07_auth_erasure_prepare($1) result',[entry.request])).rows[0].result;
   assert.equal((await prepare()).state,'unbound');
   await db.query('insert into private.account_auth_erasure_scopes(db_role,account_id,provider_origin) values($1,$2,$3)',[role,memberAccount.id,new URL(context().env.API_URL).origin]);
   const flow=key(),foreignFlow=key(),ownAudit=key(),actorAudit=key(),subjectAudit=key(),foreignAudit=key(),stable=key();
   for(const [id,user] of [[flow,member.id],[foreignFlow,owner.id]])await db.query("insert into auth.flow_state(id,user_id,auth_code,provider_type,authentication_method,provider_access_token,created_at,updated_at) values($1,$2,$3,'email','email',$4,clock_timestamp(),clock_timestamp())",[id,user,'synthetic-'+id,'synthetic-provider-token']);
   await db.query("insert into auth.refresh_tokens(token,user_id,session_id,revoked,created_at,updated_at) values($1,$2,null,true,clock_timestamp(),clock_timestamp())",['synthetic-retired-'+key(),member.id]);
   const auditRows=[
    [ownAudit,{actor_id:member.id,actor_username:member.email,actor_name:'Synthetic deleted name',action:'login',traits:{user_id:member.id,user_email:member.email,user_phone:'synthetic-phone',factor_id:stable}},'192.0.2.1'],
    [actorAudit,{actor_id:member.id,actor_username:member.email,action:'user_modified',traits:{user_id:owner.id,user_email:owner.email,identity_id:stable},other_evidence:{preserve:true}},'192.0.2.2'],
    [subjectAudit,{actor_id:owner.id,actor_username:owner.email,action:'user_modified',traits:{user_id:member.id,user_email:member.email,user_phone:'synthetic-phone',identity_id:stable},other_evidence:{preserve:true}},'192.0.2.3'],
    [foreignAudit,{actor_id:owner.id,actor_username:owner.email,action:'login',traits:{factor_id:stable}},'192.0.2.4']
   ];
   for(const [id,payload,ip] of auditRows)await db.query('insert into auth.audit_log_entries(id,payload,ip_address,created_at) values($1,$2,$3,clock_timestamp())',[id,payload,ip]);
   const residueState=async()=>({flows:await q('select id from auth.flow_state where id=any($1::uuid[]) order by id',[[flow,foreignFlow]]),audit:await q("select id,encode(extensions.digest(to_jsonb(e)::text,'sha256'),'hex') hash from auth.audit_log_entries e where id=any($1::uuid[]) order by id",[auditRows.map(x=>x[0])]),proofs:await q('select count(*)::int n from private.account_auth_residue_erasures where request_id=$1',[request])});
   const residueBefore=await residueState();
   await assert.rejects(c.query('select private.account_auth_residue_erasure($1,$2,false)',[request,role]),/permission denied/);
   assert.equal((await prepare()).state,'ready');
   const {env}=context(),endpoint=env.API_URL+'/auth/v1/admin/users/'+member.id;
   const headers={apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-type':'application/json'};
   const remove=async()=>{
    const response=await fetch(endpoint,{method:'DELETE',headers,body:JSON.stringify({should_soft_delete:false}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)assert.deepEqual(await residueState(),residueBefore,'Auth residues, audit fields and receipt must also roll back');
    return response;
   };
   const nativeCounts=async()=>(await q('select (select count(*)::int from auth.users where id=$1) users,(select count(*)::int from auth.identities where user_id=$1) identities,(select count(*)::int from auth.sessions where user_id=$1) sessions,(select count(*)::int from auth.refresh_tokens where user_id=$1::text) refresh_tokens',[member.id]))[0];
   const nativeBefore=await nativeCounts();assert(nativeBefore.sessions>0);assert(nativeBefore.refresh_tokens>0,'Real native login must exercise users -> sessions -> refresh_tokens cascades');
   const rejected=async()=>{const r=await remove();assert.equal(r.ok,false,'Native provider must reject fenced deletion');await r.body?.cancel();assert.equal((await q('select count(*)::int n from auth.users where id=$1',[member.id]))[0].n,1);assert.deepEqual(await nativeCounts(),nativeBefore,'Rejected native deletion must roll back all Auth cascades');};
   await db.query("insert into core.retention_holds(id,subject_table,subject_id,reason,authority_reference,review_at) values($1,'accounts',$2,'Synthetic late Auth hold','synthetic-test',clock_timestamp()-interval '1 day')",[hold,memberAccount.id]);
   assert.equal((await prepare()).state,'held');await rejected();
   await db.query('delete from core.retention_holds where id=$1',[hold]);
   for(const [table,id] of [['flow_state',flow],['audit_log_entries',subjectAudit]]){
    await db.query("insert into core.retention_holds(id,org_id,subject_table,subject_id,reason,authority_reference,review_at) values($1,$2,$3,$4,'Synthetic exact Auth hold','synthetic-test',clock_timestamp()-interval '1 day')",[hold,org,table,id]);
    assert.equal((await prepare()).state,'held');await rejected();
    await db.query('delete from core.retention_holds where id=$1',[hold]);
   }
   await db.query("update private.account_auth_erasure_permits set expires_at=clock_timestamp()-interval '1 second' where request_id=$1",[request]);await rejected();
   assert.equal((await prepare()).state,'ready');
   trigger='auth_erase_'+key().replaceAll('-','');triggerTable='private.account_auth_erasures';
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.request_id='${request}'::uuid then raise exception using errcode='23514',message='synthetic late Auth proof';end if;return new;end$$`);
   await db.query(`create trigger ${trigger} before insert on ${triggerTable} for each row execute function private.${trigger}()`);
   await rejected();assert.equal((await q('select count(*)::int n from private.account_auth_erasures where request_id=$1',[request]))[0].n,0);
   await db.query(`drop trigger ${trigger} on ${triggerTable}`);await db.query(`drop function private.${trigger}()`);trigger=null;
   const result=await eraseNativeAccount({db:c,request:entry.request,apiUrl:env.API_URL,serviceKey:env.SERVICE_ROLE_KEY});assert.equal(result.state,'completed');
   for(const table of ['users','identities','sessions','mfa_factors'])assert.equal((await q('select count(*)::int n from auth.'+table+' where '+(table==='users'?'id':'user_id')+'=$1',[member.id]))[0].n,0);
   assert.equal((await q('select count(*)::int n from auth.refresh_tokens where user_id=$1',[member.id]))[0].n,0);
   assert.equal((await q('select count(*)::int n from auth.users where id=$1',[owner.id]))[0].n,1);
   const login=await fetch(env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:member.email,password:member.password}),signal:AbortSignal.timeout(15000)});assert.equal(login.ok,false);await login.body?.cancel();
   assert.equal((await call(member,'account_get_v1')).result.ok,false);

   assert.deepEqual(await q('select id from auth.flow_state where id=any($1::uuid[])',[[flow,foreignFlow]]),[{id:foreignFlow}]);
   const audit=async id=>(await q('select payload::jsonb payload,ip_address from auth.audit_log_entries where id=$1',[id]))[0];
   const own=await audit(ownAudit);assert.equal(own.payload.actor_username,undefined);assert.equal(own.payload.actor_name,undefined);assert.deepEqual(own.payload.traits,{user_id:member.id,factor_id:stable});assert.equal(own.ip_address,'');
   const actor=await audit(actorAudit);assert.equal(actor.payload.actor_username,undefined);assert.deepEqual(actor.payload.traits,auditRows[1][1].traits);assert.deepEqual(actor.payload.other_evidence,{preserve:true});
   const subject=await audit(subjectAudit);assert.equal(subject.payload.actor_username,owner.email);assert.deepEqual(subject.payload.traits,{user_id:member.id,identity_id:stable});assert.equal(subject.ip_address,'192.0.2.3');
   assert.deepEqual(await audit(foreignAudit),{payload:auditRows[3][1],ip_address:'192.0.2.4'});
   const residueProof=(await q('select flow_rows,refresh_rows,audit_rows from private.account_auth_residue_erasures where request_id=$1',[request]))[0];assert.equal(Number(residueProof.flow_rows),1);assert.equal(Number(residueProof.refresh_rows),1);assert(Number(residueProof.audit_rows)>=3);
   await assert.rejects(db.query('delete from private.account_auth_residue_erasures where request_id=$1',[request]),/INTEGRITY_VIOLATION/);
   const proof=await q('select * from private.account_auth_erasures where request_id=$1',[request]);assert.equal(proof.length,1);
   assert.deepEqual(await eraseNativeAccount({db:c,request:entry.request,apiUrl:env.API_URL,serviceKey:env.SERVICE_ROLE_KEY}),{state:'completed'});
   await assert.rejects(db.query('delete from private.account_auth_erasures where request_id=$1',[request]),/INTEGRITY_VIOLATION/);
   assert.equal((await execute(c,entry,true)).ok,true);
   const manifest=(await q('select scopes from private.p07_privacy_manifests where request_id=$1',[request]))[0].scopes;
   assert.equal(manifest.auth.principal_erasure.state,'completed');assert.equal(manifest.auth.state,'pending');
   assert.equal(manifest.auth.residue_erasure.state,'completed');
   assert.equal((await q('select state from core.privacy_requests where id=$1',[request]))[0].state,'partial');
   // Trigger depth is not worker identity. A second global worker without the
   // exact Auth target binding must not borrow the original permit's role.
   const unbound=await native('ftk_p07_privacy_worker',true),late=key();
   await db.query('insert into auth.audit_log_entries(id,payload,ip_address,created_at) values($1,$2,$3,clock_timestamp())',[late,{actor_id:member.id,actor_username:member.email,action:'login'},'192.0.2.9']);
   await db.query("update private.p07_privacy_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[globalJob]);
   const [unboundEntry]=await claim(unbound,true,null);assert.equal(unboundEntry.request.job_id,globalJob);
   await unbound.query('create temp table p07_residue_attempt(payload jsonb)');
   await unbound.query(`create function pg_temp.p07_residue_attempt() returns trigger language plpgsql as $$begin perform private.p07_privacy_execute(new.payload,array[${bank().map(id=>"'"+id+"'").join(',')}]::uuid[]);return new;end$$`);
   await unbound.query('create trigger p07_residue_attempt before insert on p07_residue_attempt for each row execute function pg_temp.p07_residue_attempt()');
   await unbound.query('insert into p07_residue_attempt values($1)',[unboundEntry.request]);
   assert.equal((await audit(late)).payload.actor_username,member.email);
   const deniedManifest=(await q('select scopes from private.p07_privacy_manifests where request_id=$1',[request]))[0].scopes;
   assert.equal(deniedManifest.auth.residue_erasure.state,'unbound');
   await unbound.query('drop table p07_residue_attempt');await unbound.query('drop function pg_temp.p07_residue_attempt()');
  });
 }finally{
  if(trigger){await db.query(`drop trigger if exists ${trigger} on ${triggerTable}`);await db.query(`drop function if exists private.${trigger}()`);}
  for(const c of clients)if(!c._ending)await c.end();
  for(const role of hostedRoles){await db.query('delete from private.p07_worker_scopes where db_role=$1',[role]);await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);await db.query(`alter role ${role} password null`);}
  await db.query("update private.ops_worker_health set enabled=false where lane in ('p07','p07_privacy')");
  // These roles only receive group membership. DROP ROLE rejects unexpected owned objects/direct grants.
  for(const role of roles){await db.query('delete from private.account_auth_erasure_permits where db_role=$1',[role]);await db.query('delete from private.account_auth_erasure_scopes where db_role=$1',[role]);await db.query('delete from private.account_profile_erasure_scopes where db_role=$1',[role]);await db.query('delete from private.p07_worker_scopes where db_role=$1',[role]);await db.query('delete from private.p07_privacy_worker_scopes where db_role=$1',[role]);await step('cleanup.drop-role',()=>db.query(`drop role ${role}`));}
  await db.end();
 }
});
