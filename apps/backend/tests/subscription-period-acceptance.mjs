import test,{resources,step} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('S16 period changes preserve paid time and activate exactly once with verified funds',async t=>{
 const guard=resources(t),{platform,plan}=await fixturePlatform(),owner=await authUser('period-owner'),outsider=await authUser('period-outsider');
 const db=await guard.connect(context().env.DB_URL),rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
 const account=await must(owner,'account_get_v1'),org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic period acceptance',initial_plan_id:plan},key())).primary_id;
 const api=(op,b={},u=owner,k=key())=>must(u,op,{org_id:org,...b},k);
 const denied=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,{org_id:org,...b},k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);assert.equal(r.result.data,undefined);};
 const pay=async amount=>{const p=await api('saas_payment_submit_v1',{amount_minor:String(amount),currency:'TRY',reference:'SYNTHETIC PERIOD',occurred_at:new Date().toISOString()});return api('saas_payment_verify_v1',{payment_id:p.primary_id,accepted:true},platform);};
 await pay(1000);
 const year=key(),year2=key();
 for(const [id,amount] of [[year,12000],[year2,15000]])await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,name,now(),$2,currency,'yearly',limits,features from core.saas_plan_versions where id=$3",[id,amount,plan]);
 const read=()=>api('subscription_get_v1');
 const body=async target=>{
  const s=await read(),option=s.billing.period_change_options.find(p=>p.id===target);assert(option);
  const page=await api('management_state_get_v1',{operation:'subscription_period_change_request_v1',selector:{operation:'subscription_period_change_request_v1',key:{target_plan_id:target}}});
  assert.equal(page.items.length,1);assert.equal(page.items[0].versions[0].version,s.subscription_version);
  const values=page.items[0].current.values;assert.deepEqual(values,{target_plan_id:target,expected_version:s.subscription_version,amount_minor:option.amount_minor,currency:option.currency,effective_at:s.period_end});return values;
 };
 const workerRole='s16_'+key().replaceAll('-',''),workerPassword=randomBytes(24).toString('hex');
 await db.query(`create role ${workerRole} login password '${workerPassword}'`);await db.query(`grant ftk_p07_worker to ${workerRole}`);
 await db.query('insert into private.p07_worker_scopes values($1,$2)',[workerRole,org]);
 const workerUrl=new URL(context().env.DB_URL);workerUrl.username=workerRole;workerUrl.password=workerPassword;
 const worker=await guard.connect(workerUrl.href),bank=()=>Array.from({length:512},key);
 const claim=async()=>(await worker.query('select private.p07_jobs_claim($1,$2,1) jobs',[org,bank()])).rows[0].jobs;
 const execute=async entry=>(await worker.query('select private.p07_worker_execute($1,$2,$3) result',[entry.operation,entry.request,bank()])).rows[0].result;
 const due=async()=>{const at=new Date(Date.now()-1000);await db.query("update core.saas_subscriptions set starts_at=$1::timestamptz-interval '1 month',period_end=$1,grace_until=$1::timestamptz+interval '7 days' where org_id=$2",[at,org]);await db.query("update private.p07_subscription_scope set period_start=$1::timestamptz-interval '1 month' where subscription_id=(select id from core.saas_subscriptions where org_id=$2)",[at,org]);await db.query("update core.saas_change_requests set effective_at=$1 where org_id=$2 and state='scheduled'",[at,org]);return at;};
 let pending,original;
 try{
  await step('fresh owner discovers terms; schedule/replay/stale replacement retain the paid period',async()=>{
   original=await read();assert.equal(original.billing.current.period,'monthly');assert.equal(original.billing.pending_period_change,null);
   const b=await body(year),k=key();pending=await api('subscription_period_change_request_v1',b,owner,k);
   assert.equal((await api('subscription_period_change_request_v1',b,owner,k)).replayed,true);
   const scheduled=await read();assert.equal(scheduled.plan,original.plan);assert.equal(scheduled.period_end,original.period_end);assert.equal(scheduled.billing.current.id,plan);assert.equal(scheduled.billing.pending_period_change.id,pending.primary_id);assert.equal(scheduled.billing.pending_period_change.target.amount_minor,'12000');assert.equal(scheduled.subscription_version,original.subscription_version+1);
   await denied('subscription_period_change_request_v1',b,'VERSION_CONFLICT');
   await denied('subscription_period_change_request_v1',await body(year2),'NOT_FOUND',outsider);
   const otherAccount=await must(outsider,'account_get_v1'),otherPerson=key();
   await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Synthetic non-owner','active')",[otherPerson,org]);
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,otherAccount.id,otherPerson]);
   await denied('subscription_period_change_request_v1',await body(year2),'FORBIDDEN',outsider);
   await denied('subscription_period_change_request_v1',{...await body(year2),amount_minor:'1'},'VERSION_CONFLICT');
   await denied('subscription_period_change_request_v1',{...await body(year2),effective_at:new Date().toISOString()},'VERSION_CONFLICT');
   const replacement=await api('subscription_period_change_request_v1',await body(year2));assert.notEqual(replacement.primary_id,pending.primary_id);
   assert.equal((await rows('select state from core.saas_change_requests where id=$1',[pending.primary_id]))[0].state,'cancelled');
   assert.equal((await rows("select count(*)::int n from core.saas_change_requests where org_id=$1 and state='scheduled'",[org]))[0].n,1);
   const current=await read();await denied('subscription_change_cancel_v1',{change_id:replacement.primary_id,expected_version:2},'VERSION_CONFLICT');
   await api('subscription_change_cancel_v1',{change_id:replacement.primary_id,expected_version:current.billing.pending_period_change.version});
   const cancelled=await read();assert.equal(cancelled.billing.pending_period_change,null);assert.equal(cancelled.period_end,original.period_end);assert.equal(cancelled.subscription_version,current.subscription_version+1);
   const raceA=await body(year),raceB=await body(year2),raced=await Promise.all([call(owner,'subscription_period_change_request_v1',{org_id:org,...raceA},key()),call(owner,'subscription_period_change_request_v1',{org_id:org,...raceB},key())]);
   assert.equal(raced.filter(x=>x.result.ok).length,1);assert.equal(raced.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
   const winner=(await read()).billing.pending_period_change;await api('subscription_change_cancel_v1',{change_id:winner.id,expected_version:winner.version});

  });

  await step('a concurrent catalog edit waits for the accepted plan lock and cannot change its price',async()=>{
   const b=await body(year),other=await guard.connect(context().env.DB_URL),pid=(await other.query('select pg_backend_pid() pid')).rows[0].pid;
   await db.query('begin');
   try{
    const result=(await db.query("select private.p07_subscription_command('subscription_period_change_request_v1',$1,$2,$3,$4,$5) result",[b,org,account.id,key(),bank()])).rows[0].result;
    const edit=assert.rejects(other.query('update core.saas_plan_versions set price_minor=price_minor+1 where id=$1',[year]),/INVALID_STATE_TRANSITION/);
    const deadline=Date.now()+2000;let waiting=false;
    while(Date.now()<deadline){waiting=(await rows("select wait_event_type='Lock' blocked from pg_stat_activity where pid=$1",[pid]))[0].blocked;if(waiting)break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(waiting,true,'catalog update must wait for the period request plan lock');
    await db.query('commit');await edit;
    const pending=(await read()).billing.pending_period_change;assert.equal(pending.id,result.primary_id);assert.equal(pending.target.amount_minor,'12000');
    await api('subscription_change_cancel_v1',{change_id:pending.id,expected_version:pending.version});
   }finally{await db.query('rollback');await other.end();}
  });
  await step('renewal cancellation is explicit and accepted plan versions cannot silently change',async()=>{
   const v=(await read()).subscription_version;await api('subscription_renewal_set_v1',{expected_version:v,renew:false});
   await denied('subscription_period_change_request_v1',await body(year),'INVALID_STATE_TRANSITION');
   await api('subscription_renewal_set_v1',{expected_version:(await read()).subscription_version,renew:true});
   pending=await api('subscription_period_change_request_v1',await body(year));
   await assert.rejects(db.query('update core.saas_plan_versions set price_minor=price_minor+1 where id=$1',[year]),/INVALID_STATE_TRANSITION/);
   await assert.rejects(db.query("update core.saas_plan_versions set period='monthly' where id=$1",[year]),/INVALID_STATE_TRANSITION/);
   await denied('subscription_renewal_set_v1',{expected_version:(await read()).subscription_version,renew:false},'OPEN_OPERATIONS_EXIST');
   await denied('subscription_downgrade_request_v1',{target_plan_id:plan},'OPEN_OPERATIONS_EXIST');
  });
  await step('insufficient funds retain the request and normal grace; payment and worker race allocate once',async()=>{
   const boundary=await due(),[job]=await claim();assert(job);
   const allocationsBefore=Number((await rows('select count(*)::int n from private.p07_payment_allocations where subscription_id=(select id from core.saas_subscriptions where org_id=$1)',[org]))[0].n);
   const result=await execute(job);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(await execute(job),result);
   const grace=await read();assert.equal(grace.state,'grace');assert.equal(grace.billing.current.id,plan);assert.equal(grace.billing.pending_period_change.id,pending.primary_id);assert.equal(+new Date(grace.period_end),+boundary);
   await api('organization_get_v1');
   assert.equal(Number((await rows('select count(*)::int n from private.p07_payment_allocations where subscription_id=(select id from core.saas_subscriptions where org_id=$1)',[org]))[0].n),allocationsBefore);
   await pay(6000);assert.equal((await read()).billing.current.id,plan);
   const payment=await api('saas_payment_submit_v1',{amount_minor:'6000',currency:'TRY',reference:'SYNTHETIC PERIOD FINAL',occurred_at:new Date().toISOString()}),[racingJob]=await claim();assert(racingJob);
   const verifyKey=key(),verifyBody={payment_id:payment.primary_id,accepted:true};
   const [,worked]=await Promise.all([api('saas_payment_verify_v1',verifyBody,platform,verifyKey),execute(racingJob)]);assert.equal(worked.ok,true,JSON.stringify(worked));
   assert.equal((await api('saas_payment_verify_v1',verifyBody,platform,verifyKey)).replayed,true);assert.deepEqual(await execute(racingJob),worked);
   const applied=await read();assert.equal(applied.state,'active');assert.equal(applied.billing.current.id,year);assert.equal(applied.billing.current.period,'yearly');assert.equal(applied.billing.pending_period_change,null);assert.equal(+new Date(applied.period_start),+boundary);
   const expected=new Date(boundary);expected.setUTCFullYear(expected.getUTCFullYear()+1);assert.equal(+new Date(applied.period_end),+expected);
   assert.equal((await rows('select state from core.saas_change_requests where id=$1',[pending.primary_id]))[0].state,'applied');
   assert.equal((await rows('select private.p07_funds($1,$2) n',[org,'TRY']))[0].n,'0');
   assert.equal((await rows('select sum(amount_minor)::text n from private.p07_payment_allocations where subscription_id=(select id from core.saas_subscriptions where org_id=$1)',[org]))[0].n,'13000');
  });
  await step('yearly to monthly preserves prepaid time and the old worker cannot reapply the change',async()=>{
   const before=await read();pending=await api('subscription_period_change_request_v1',await body(plan));
   await pay(1000);const prepaid=await read();assert.equal(prepaid.period_end,before.period_end);assert.equal(prepaid.billing.current.id,year);
   const boundary=await due(),[job]=await claim();assert(job);const result=await execute(job);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(await execute(job),result);
   const applied=await read(),expected=new Date(boundary);expected.setUTCMonth(expected.getUTCMonth()+1);assert.equal(applied.billing.current.id,plan);assert.equal(+new Date(applied.period_end),+expected);assert.equal(applied.billing.pending_period_change,null);
  });
  await step('the same period-only owner flow also applies to Pro and Business',async()=>{
   for(const name of ['pro','business']){
    const month=key(),annual=key();for(const [id,period,amount] of [[month,'monthly',1000],[annual,'yearly',2000]])await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,$2,now(),$3,currency,$4,limits,features from core.saas_plan_versions where id=$5",[id,name,amount,period,plan]);
    await db.query("update core.saas_subscriptions set plan_version_id=$1,state='active',starts_at=now(),period_end=now()+interval '1 month',version=version+1 where org_id=$2",[month,org]);
    await db.query('update private.p07_subscription_scope set period_start=now() where subscription_id=(select id from core.saas_subscriptions where org_id=$1)',[org]);
    const accepted=await body(annual);const raw=await call(owner,'subscription_period_change_request_v1',{org_id:org,...accepted},key());assert.equal(raw.result.ok,true,JSON.stringify({accepted,result:raw.result}));pending=raw.result.data;await due();await pay(2000);
    const applied=await read();assert.equal(applied.plan,name);assert.equal(applied.billing.current.id,annual);assert.equal(applied.billing.pending_period_change,null);
   }
  });
 }finally{await worker.end();await db.query('delete from private.p07_worker_scopes where db_role=$1',[workerRole]);await db.query(`drop role ${workerRole}`);await db.end();}
});
