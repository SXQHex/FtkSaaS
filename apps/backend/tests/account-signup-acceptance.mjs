import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createHmac} from 'node:crypto';
import {authUser,must,call,context} from './api-client.mjs';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {signPublicRequest} from '../scripts/p04-public-ingress.mjs';
const compiled=await build({entryPoints:['supabase/functions/backend-v1/account-signup.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {accountSignup}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));

test('XREQ-001: real Auth and SMTP sink enforce primary, Google, unconfirmed and new signup outcomes',async t=>{
 const guard=resources(t),{env}=context(),db=await guard.connect(env.DB_URL);
 const cfg={FTK_PUBLIC_INGRESS_SECRET:'synthetic-local-signup-ingress-secret-32',FTK_PUBLIC_HASH_SECRET:'synthetic-local-signup-hash-secret-32'},getEnv=k=>cfg[k];
 const path='/functions/v1/backend-v1/account_signup_request_v1',password='Synthetic-local-signup-password!42';
 const email=()=>`signup-${id()}@ftksaas.invalid`;
 const fingerprint=address=>createHmac('sha256',cfg.FTK_PUBLIC_HASH_SECRET).update('target:'+address.trim().toLowerCase()).digest('hex');
 const rpc=async(r,aux)=>{
  assert.equal(r.password,undefined);assert.equal(r.code_challenge,undefined);assert.equal(r.captcha_token,undefined);
  const res=await fetch(env.API_URL+'/rest/v1/rpc/account_signup_request_v1',{method:'POST',headers:{authorization:'Bearer '+env.SERVICE_ROLE_KEY,apikey:env.SERVICE_ROLE_KEY,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:r,p_actor_auth_id:null,p_session_id:null,p_ids:[id(),id()],p_aux:aux}),signal:AbortSignal.timeout(15000)});
  assert.equal(res.status,200,'service-only signup gate must succeed');return res.json();
 };
 const signup=(address,extra={},fetcher=fetch)=>{
  const request={client_api_version:1,request_id:id(),email:address,password,...extra},body=JSON.stringify(request);
  const req=new Request(env.API_URL+path,{method:'POST',body,headers:signPublicRequest(body,'192.0.2.89',cfg.FTK_PUBLIC_INGRESS_SECRET,path)});
  return accountSignup(req,body,request,env.API_URL,env.ANON_KEY,getEnv,rpc,fetcher);
 };
 const native=async(address,extra={})=>{
  const r=await fetch(env.API_URL+'/auth/v1/signup',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:address,password,...extra}),signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();
 };
 const messages=async address=>{
  const res=await fetch(env.MAILPIT_URL+'/api/v1/messages?limit=1000',{signal:AbortSignal.timeout(10000)});assert(res.ok);return (await res.json()).messages.filter(m=>m.To.some(x=>x.Address.toLowerCase()===address.toLowerCase()));
 };
 const state=async address=>(await db.query("select id,email,email_confirmed_at,confirmation_sent_at from auth.users where lower(email)=$1 order by id",[address.toLowerCase()])).rows;
 const unchanged=async address=>{
  const before=await state(address),mail=(await messages(address)).map(m=>m.ID).sort();
  assert.deepEqual(await signup(' '+address.toUpperCase()+' '),{data:{status:'account_exists'}});
  assert.deepEqual(await state(address),before);assert.deepEqual((await messages(address)).map(m=>m.ID).sort(),mail);
 };
 await t.test('anonymous direct RPC and unsigned Edge calls cannot enumerate addresses',async()=>{
  for(const key of [env.ANON_KEY,(await authUser('signup-rpc-denied')).jwt]){
   const res=await fetch(env.API_URL+'/rest/v1/rpc/account_signup_request_v1',{method:'POST',headers:{authorization:'Bearer '+key,apikey:env.ANON_KEY,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:{email:email()},p_actor_auth_id:null,p_session_id:null,p_ids:[id(),id()],p_aux:{}})});assert([401,403,404].includes(res.status));
  }
  const result=await call({jwt:env.ANON_KEY},'account_signup_request_v1',{email:email(),password});assert.equal(result.result.error.code,'TEMPORARY_FAILURE');
 });
 await t.test('existing primary and unconfirmed emails do not create or send again',async()=>{
  const primary=await authUser('signup-primary');await unchanged(primary.email);
  const pending=email();await native(pending);assert.equal((await state(pending))[0].email_confirmed_at,null);assert.equal((await messages(pending)).length,1);await unchanged(pending);
 });
 await t.test('a linked Google email different from primary yields only account_exists',async()=>{
  const user=await authUser('signup-google-owner'),account=await must(user,'account_get_v1'),google=email(),subject=id(),identity=id();
  const old=(await db.query('select * from private.p07_lifecycle_config where singleton')).rows[0];
  try{
   if(!old)await db.query('insert into private.p07_lifecycle_config(singleton,reauth_max_age_seconds) values(true,900)');
   await db.query("insert into private.account_google_link_intents values($1,$2,now()+interval '1 minute',false,$3)",[account.id,user.session_id,subject]);
   // Synthetic identity fixture validates authoritative matching, not real OAuth.
   await db.query("insert into auth.identities(id,user_id,provider,provider_id,identity_data,created_at,updated_at,last_sign_in_at) values($1,$2,'google',$3,$4,now(),now(),now())",[identity,user.id,subject,{sub:subject,email:google,email_verified:true}]);
   await unchanged(google);assert.equal((await state(google)).length,0);assert.equal((await state(user.email)).length,1);
  }finally{
   await db.query('delete from auth.identities where id=$1',[identity]);await db.query('delete from private.account_google_link_intents where account_id=$1',[account.id]);
   if(!old)await db.query('delete from private.p07_lifecycle_config where singleton');
  }
 });
 await t.test('a completely new email sends one real verification and remains native-verifiable',async()=>{
  const address=email();assert.deepEqual(await signup(address),{data:{status:'confirmation_required'}});
  const users=await state(address);assert.equal(users.length,1);assert.equal(users[0].email_confirmed_at,null);
  const mail=await messages(address);assert.equal(mail.length,1);
  const detail=await(await fetch(env.MAILPIT_URL+'/api/v1/message/'+mail[0].ID)).json(),token=detail.Text.match(/[?&]token=([a-f0-9]+)/)?.[1]??detail.HTML.match(/[?&]token=([a-f0-9]+)/)?.[1];assert(token);
  const verified=await fetch(env.API_URL+'/auth/v1/verify',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({type:'signup',token_hash:token})});assert.equal(verified.status,200);assert((await state(address))[0].email_confirmed_at);await unchanged(address);
 });
 await t.test('concurrent proxy calls send once; weak-password rejection allows a corrected retry',async()=>{
  const address=email(),results=await Promise.all(Array.from({length:4},()=>signup(address)));
  assert.equal(results.filter(x=>x.data?.status==='confirmation_required').length,1);assert(results.every(x=>['account_exists','confirmation_required'].includes(x.data?.status)||x.error==='RESULT_NOT_CONFIRMED'));
  assert.equal((await state(address)).length,1);assert.equal((await messages(address)).length,1);
  const weak=email();assert.deepEqual(await signup(weak,{password:'x'}),{error:'WEAK_PASSWORD'});assert.equal((await state(weak)).length,0);assert.equal((await messages(weak)).length,0);assert.deepEqual(await signup(weak),{data:{status:'confirmation_required'}});
 });
 await t.test('unknown dispatch never expires, even before a delayed native commit',async()=>{
  const address=email();let delayed;
  const lostResponse=async(url,options)=>{if(url.includes('/settings'))return fetch(url,options);delayed=()=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});throw Error('injected lost connection');};
  assert.deepEqual(await signup(address,{},lostResponse),{error:'RESULT_NOT_CONFIRMED'});assert.equal((await state(address)).length,0);
  await db.query("update private.account_signup_claims set dispatched_at=now()-interval '1 year' where target_hash=$1",[fingerprint(address)]);
  assert.deepEqual(await signup(address),{error:'RESULT_NOT_CONFIRMED'});assert.equal((await messages(address)).length,0);
  const completed=await delayed();assert.equal(completed.status,200);await completed.json();await unchanged(address);assert.equal((await messages(address)).length,1);
  // A crash after RPC commit but before fetch has the same durable unknown state.
  const crash=email();await rpc({client_api_version:1,request_id:id(),email:crash},{phase:'dispatch',ip_hash:'1'.repeat(64),target_hash:fingerprint(crash)});
  assert.deepEqual(await signup(crash),{error:'RESULT_NOT_CONFIRMED'});assert.equal((await messages(crash)).length,0);
 });
 await t.test('metadata spoof does not block signup; native paths remain explicitly outside the proxy fence',async()=>{
  const user=await authUser('signup-metadata'),address=email();
  await db.query('update auth.users set raw_user_meta_data=raw_user_meta_data||$2::jsonb where id=$1',[user.id,{email:address}]);
  assert.deepEqual(await signup(address),{data:{status:'confirmation_required'}});
  const outside=email();await rpc({client_api_version:1,request_id:id(),email:outside},{phase:'dispatch',ip_hash:'2'.repeat(64),target_hash:fingerprint(outside)});
  await native(outside);await unchanged(outside);assert.equal((await messages(outside)).length,1);
 });
 await t.test('rate-limited existence lookups do not call native signup',async()=>{
  const address=email(),ip='3'.repeat(64),target=fingerprint(address);
  await db.query('insert into private.account_signup_rates values($1,floor(extract(epoch from clock_timestamp())/300)::bigint,30)',[ip]);
  assert.deepEqual(await rpc({client_api_version:1,request_id:id(),email:address},{phase:'dispatch',ip_hash:ip,target_hash:target}),{error:'RATE_LIMITED'});assert.equal((await state(address)).length,0);assert.equal((await messages(address)).length,0);
 });
});
