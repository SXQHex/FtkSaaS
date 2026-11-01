import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createHmac} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {timedFetch} from './request-diagnostics.mjs';
const compiled=await build({entryPoints:['supabase/functions/backend-v1/invitation-delivery.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {invitationTick,invitationSigningKey}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
test('XREQ-003: native Auth invitation job scope, durable leases and provider handoff',async t=>{
 const {env}=context(),guard=resources(t),db=await guard.connect(env.DB_URL),{platform,plan}=await fixturePlatform();
 const owner=await authUser('invite-owner'),member=await authUser('invite-recipient'),foreign=await authUser('invite-foreign');
 const account=await must(owner,'account_get_v1');await must(member,'account_get_v1');await must(foreign,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Invitation acceptance',initial_plan_id:plan},id())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Invitation center',timezone:'Europe/Istanbul'},id())).primary_id;
 const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},id());
 const payment=await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic XREQ-003',occurred_at:new Date().toISOString()},id());
 await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment.primary_id,accepted:true},id());
 const target=(await must(owner,'person_create_v1',{org_id:org,center_id:center,display_name:'Invitation target',contacts:[{kind:'email',value:member.email}]},id())).primary_id;
 const secret=(await db.query("select vault.create_secret('synthetic-resend-invitation-key') id")).rows[0].id;
 await db.query('insert into private.invitation_sender_config(org_id,enabled,from_email,app_origin,resend_secret_id) values($1,true,$2,$3,$4)',[org,'sender@ftksaas.invalid','https://invitation.ftksaas.invalid',secret]);
 const send=()=>must(owner,'account_access_send_v1',{org_id:org,center_id:center,person_id:target},id());
 const status=job=>must(owner,'job_status_get_v1',{org_id:org,center_id:center,job_id:job});
 const worker=async(r,aux)=>{
  const res=await timedFetch('invitation.worker_rpc',env.API_URL+'/rest/v1/rpc/outbox_deliver_v1',{method:'POST',headers:{authorization:'Bearer '+env.SERVICE_ROLE_KEY,apikey:env.SERVICE_ROLE_KEY,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:r,p_actor_auth_id:null,p_session_id:null,p_ids:[],p_aux:aux})});
  assert.equal(res.status,200);return res.json();
 };
 const claim=async()=> (await worker({request_id:id()},{invitation_phase:'claim'}))._internal_invitation;
 let job,lease;
 try{
  await t.test('sender reads pending invitation while another account, tenant and center do not',async()=>{
   job=(await send()).job_id;const pending=await status(job);assert.equal(pending.state,'pending');assert.equal(pending.total_count,1);assert.equal(pending.progress_count,0);assert.equal(pending.result_reference,null);
   for(const [u,b] of [[foreign,{org_id:org,job_id:job}],[owner,{org_id:id(),job_id:job}],[owner,{org_id:org,center_id:id(),job_id:job}]]){
    const denied=await call(u,'job_status_get_v1',b);assert.equal(denied.result.ok,false);assert.equal(denied.result.error.code,'NOT_FOUND');
   }
   const privateRpc=await timedFetch('invitation.denied_rpc',env.API_URL+'/rest/v1/rpc/outbox_deliver_v1',{method:'POST',headers:{authorization:'Bearer '+owner.jwt,apikey:env.ANON_KEY,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:{request_id:id()},p_actor_auth_id:null,p_session_id:null,p_ids:[],p_aux:{invitation_phase:'claim'}})});await privateRpc.arrayBuffer();assert([401,403,404].includes(privateRpc.status));
  });
  await t.test('supersession cancels queued old job; same signed tick is consumed once',async()=>{
   const old=job;job=(await send()).job_id;assert.equal((await status(old)).state,'cancelled');
   const r={request_id:id()};lease=(await worker(r,{invitation_phase:'claim'}))._internal_invitation;assert.equal(lease.job_id,job);assert.equal((await worker(r,{invitation_phase:'claim'}))._internal_invitation,null);
   assert.equal(await claim(),null);assert.equal((await status(job)).state,'running');
   const denied=await worker({...lease,lease_token:'wrong'},{invitation_phase:'authorize'}).catch(()=>null);assert.equal(denied,null);
  });
  await t.test('expired lease is reclaimed and old completion cannot overwrite the new claim',async()=>{
   await db.query("update core.outbox_jobs set lease_until=now()-interval '1 second' where id=$1",[job]);const old=lease;lease=await claim();assert.equal(lease.job_id,job);assert.notEqual(lease.lease_token,old.lease_token);
   await assert.rejects(worker(old,{invitation_phase:'finish',provider_reference:id()}));
   const result=await worker(lease,{invitation_phase:'finish',retryable:true});assert.equal(result.state,'retry_wait');assert.equal((await status(job)).safe_error_code,'TEMPORARY_FAILURE');
  });
  await t.test('a provider configuration change cannot change an in-flight job credential or message',async()=>{
   const next=(await db.query("select vault.create_secret('synthetic-different-provider-key') id")).rows[0].id;
   await db.query("update private.invitation_sender_config set resend_secret_id=$2,from_email='changed@ftksaas.invalid',app_origin='https://changed.ftksaas.invalid' where org_id=$1",[org,next]);
   try{await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[job]);const c=await claim();assert.equal(c.api_key,'synthetic-resend-invitation-key');assert.equal(c.from_email,'sender@ftksaas.invalid');assert.equal(c.app_origin,'https://invitation.ftksaas.invalid');await worker(c,{invitation_phase:'finish',retryable:true});}
   finally{await db.query("update private.invitation_sender_config set resend_secret_id=$2,from_email='sender@ftksaas.invalid',app_origin='https://invitation.ftksaas.invalid' where org_id=$1",[org,secret]);await db.query('delete from vault.secrets where id=$1',[next]);}
  });
  await t.test('late ambiguous retry cannot resend outside provider idempotency retention',async()=>{
   job=(await send()).job_id;const c=await claim();await worker(c,{invitation_phase:'finish',retryable:true});
   await db.query("update private.invitation_delivery_state set first_attempt_at=now()-interval '24 hours' where job_id=$1",[job]);await db.query('update core.outbox_jobs set next_attempt_at=now() where id=$1',[job]);assert.equal(await claim(),null);assert.equal((await status(job)).state,'failed');
   assert.equal((await db.query('select attempts::int from core.outbox_jobs where id=$1',[job])).rows[0].attempts,1);
  });
  await t.test('missing provider configuration fails only its job and does not block the next one',async()=>{
   job=(await send()).job_id;await db.query('update private.invitation_sender_config set resend_secret_id=$2 where org_id=$1',[org,id()]);
   assert.equal(await claim(),null);assert.equal((await status(job)).state,'failed');assert.equal((await status(job)).safe_error_code,'SERVICE_UNAVAILABLE');
   await db.query('update private.invitation_sender_config set resend_secret_id=$2 where org_id=$1',[org,secret]);job=(await send()).job_id;const c=await claim();assert.equal(c.job_id,job);await worker(c,{invitation_phase:'finish',retryable:false});
  });
  await t.test('inactive center closes both tracking access and delivery',async()=>{
   job=(await send()).job_id;await db.query("update core.centers set state='inactive' where id=$1",[center]);
   try{const denied=await call(owner,'job_status_get_v1',{org_id:org,job_id:job});assert.equal(denied.result.error.code,'NOT_FOUND');assert.equal(await claim(),null);assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[job])).rows[0].state,'cancelled');}
   finally{await db.query("update core.centers set state='active' where id=$1",[center]);}
  });
  await t.test('sender role loss closes job access and prevents dispatch',async()=>{
   job=(await send()).job_id;const roles=(await db.query("update core.role_assignments set state='inactive' where org_id=$1 and person_id=$2 and scope_center_id=$3 and state='active' returning id",[org,person,center])).rows;
   assert(roles.length>0);
   try{const denied=await call(owner,'job_status_get_v1',{org_id:org,job_id:job});assert.equal(denied.result.error.code,'NOT_FOUND');assert.equal(await claim(),null);assert.equal((await db.query('select state from core.outbox_jobs where id=$1',[job])).rows[0].state,'cancelled');}
   finally{await db.query("update core.role_assignments set state='active' where id=any($1::uuid[])",[roles.map(r=>r.id)]);}
  });
  await t.test('provider acceptance remains recorded if invitation is revoked before completion',async()=>{
   job=(await send()).job_id;const c=await claim();assert.equal((await worker(c,{invitation_phase:'authorize'})).authorized,true);
   const invitation=(await db.query('select invitation_id from private.invitation_deliveries where job_id=$1',[job])).rows[0].invitation_id;
   await db.query("update core.invitations set state='revoked',version=version+1 where id=$1",[invitation]);
   const provider_reference=id();assert.equal((await worker(c,{invitation_phase:'finish',provider_reference})).state,'succeeded');assert.equal((await status(job)).state,'succeeded');
   assert.equal((await db.query('select state from core.invitations where id=$1',[invitation])).rows[0].state,'revoked');
   assert.equal((await worker(c,{invitation_phase:'finish',provider_reference})).state,'succeeded');
  });
  await t.test('delivery retains its declared F26 gate while original sender can still track the cancellation',async()=>{
   job=(await send()).job_id;const features=(await db.query('select features from core.saas_plan_versions where id=$1',[plan])).rows[0].features;
   await db.query("update core.saas_plan_versions set features=array_remove(features,'F26') where id=$1",[plan]);
   try{assert.equal(await claim(),null);assert.equal((await status(job)).state,'cancelled');assert.equal((await db.query('select attempts::int from core.outbox_jobs where id=$1',[job])).rows[0].attempts,0);}
   finally{await db.query('update core.saas_plan_versions set features=$2 where id=$1',[plan,features]);}
  });
  await t.test('provider acceptance persists; invitation token uses native account verification on acceptance',async()=>{
   job=(await send()).job_id;const sent=[],now=Date.now(),at=String(Math.floor(now/1000)),request_id=id();
   const signing=await invitationSigningKey(env.SERVICE_ROLE_KEY),signature=createHmac('sha256',signing).update(at+'.'+request_id).digest('hex');
   const fetcher=async(url,options)=>{
    if(url==='https://api.resend.com/emails'){sent.push(JSON.parse(options.body));return Response.json({id:id()});}
    return timedFetch('invitation.acceptance_rpc',url,options);
   };
   const request=new Request(env.API_URL+'/functions/v1/backend-v1/invitation_delivery_tick',{method:'POST',headers:{'x-ftk-worker-time':at,'x-ftk-worker-signature':signature},body:JSON.stringify({request_id})});
   const result=await invitationTick(request,n=>({SUPABASE_SERVICE_ROLE_KEY:env.SERVICE_ROLE_KEY,SUPABASE_URL:env.API_URL})[n],fetcher,now);assert.equal(result.status,200);assert.equal((await result.json()).accepted,true);
   assert.equal(sent.length,1);assert.deepEqual(sent[0].to,[member.email]);assert.equal((await status(job)).state,'succeeded');
   const link=sent[0].text.match(/https:\/\/invitation\.ftksaas\.invalid\/invite#[^\s]+/)[0],token=new URLSearchParams(new URL(link).hash.slice(1)).get('token');
   assert.equal((await db.query('select count(*)::int n from core.account_links where org_id=$1 and person_id=$2 and state=$3',[org,target,'active'])).rows[0].n,0);
   const denied=await call(foreign,'account_access_accept_v1',{token},id());assert.equal(denied.result.error.code,'INVITATION_UNAVAILABLE');
   await must(member,'account_access_accept_v1',{token},id());assert.equal((await db.query('select count(*)::int n from core.account_links where org_id=$1 and person_id=$2 and state=$3',[org,target,'active'])).rows[0].n,1);
   assert.equal((await status(job)).state,'succeeded');
  });
 }finally{
  await db.query('delete from private.invitation_sender_config where org_id=$1',[org]);await db.query('delete from vault.secrets where id=$1',[secret]);
 }
});
