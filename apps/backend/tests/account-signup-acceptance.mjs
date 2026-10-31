import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {authUser,must,call,context} from './api-client.mjs';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {signPublicRequest} from '../scripts/p04-public-ingress.mjs';
const compiled=await build({entryPoints:['supabase/functions/backend-v1/account-signup.ts'],bundle:true,platform:'browser',format:'esm',write:false});
const {accountSignupCheck}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
test('XREQ-001: email-only check covers primary, linked Google, unconfirmed and new addresses without Auth side effects',async t=>{
 const guard=resources(t),{env}=context(),db=await guard.connect(env.DB_URL);
 const cfg={FTK_PUBLIC_INGRESS_SECRET:'synthetic-local-signup-ingress-secret-32',FTK_PUBLIC_HASH_SECRET:'synthetic-local-signup-hash-secret-32'};
 const path='/functions/v1/backend-v1/account_signup_check_v1',email=()=>`signup-${id()}@ftksaas.invalid`;
 const rpc=async(request,aux)=>{
  const res=await fetch(env.API_URL+'/rest/v1/rpc/account_signup_check_v1',{method:'POST',headers:{authorization:'Bearer '+env.SERVICE_ROLE_KEY,apikey:env.SERVICE_ROLE_KEY,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:request,p_actor_auth_id:null,p_session_id:null,p_ids:[id()],p_aux:aux}),signal:AbortSignal.timeout(15000)});
  assert.equal(res.status,200);return res.json();
 };
 const check=address=>{const request={client_api_version:1,request_id:id(),email:address},body=JSON.stringify(request);return accountSignupCheck(new Request(env.API_URL+path,{method:'POST',body,headers:signPublicRequest(body,'192.0.2.89',cfg.FTK_PUBLIC_INGRESS_SECRET,path)}),body,request,k=>cfg[k],rpc);};
 const messages=async address=>{const res=await fetch(env.MAILPIT_URL+'/api/v1/messages?limit=1000');assert(res.ok);return (await res.json()).messages.filter(m=>m.To.some(x=>x.Address.toLowerCase()===address.toLowerCase())).map(x=>x.ID).sort();};
 const state=async address=>(await db.query('select id,email,email_confirmed_at,confirmation_sent_at from auth.users where lower(email)=$1 order by id',[address.toLowerCase()])).rows;
 const unchanged=async(address,status='account_exists')=>{const before=await state(address),mail=await messages(address);assert.deepEqual(await check(' '+address.toUpperCase()+' '),{data:{status}});assert.deepEqual(await state(address),before);assert.deepEqual(await messages(address),mail);};
 const signup=async address=>{const res=await fetch(env.API_URL+'/auth/v1/signup',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:address,password:'Synthetic-local-signup-password!42'})});assert.equal(res.status,200);return res.json();};
 await t.test('lookup RPC remains private and unsigned public calls are rejected',async()=>{
  for(const key of [env.ANON_KEY,(await authUser('signup-rpc-denied')).jwt]){const res=await fetch(env.API_URL+'/rest/v1/rpc/account_signup_check_v1',{method:'POST',headers:{authorization:'Bearer '+key,apikey:env.ANON_KEY,'Content-Profile':'api_v1','content-type':'application/json'},body:JSON.stringify({p_request:{email:email()},p_actor_auth_id:null,p_session_id:null,p_ids:[id()],p_aux:{}})});assert([401,403,404].includes(res.status));}
  const denied=await call({jwt:env.ANON_KEY},'account_signup_check_v1',{email:email()});assert.equal(denied.result.error.code,'TEMPORARY_FAILURE');
  const extra=await call({jwt:env.ANON_KEY},'account_signup_check_v1',{email:email(),password:'must-not-be-accepted'});assert.equal(extra.result.error.code,'VALIDATION_FAILED');
 });
 await t.test('primary and unconfirmed accounts are reported without another email',async()=>{
  await unchanged((await authUser('signup-primary')).email);
  const pending=email();await signup(pending);assert.equal((await state(pending))[0].email_confirmed_at,null);assert.equal((await messages(pending)).length,1);await unchanged(pending);
 });
 await t.test('linked Google address differs from primary and needs no app linking intent',async()=>{
  const owner=await authUser('signup-google-owner');await must(owner,'account_get_v1');const google=email(),subject=id(),identity=id();
  // Provider-row fixture verifies lookup and removed fence; it is not real Google OAuth.
  await db.query("insert into auth.identities(id,user_id,provider,provider_id,identity_data,created_at,updated_at,last_sign_in_at) values($1,$2,'google',$3,$4,now(),now(),now())",[identity,owner.id,subject,{sub:subject,email:google,email_verified:true}]);
  try{await unchanged(google);assert.equal((await state(google)).length,0);}finally{await db.query('delete from auth.identities where id=$1',[identity]);}
 });
 await t.test('new email stays available across repeated checks, then signup is native',async()=>{
  const address=email();await unchanged(address,'available');await unchanged(address,'available');assert.equal((await state(address)).length,0);
  await signup(address);assert.equal((await state(address)).length,1);assert.equal((await messages(address)).length,1);await unchanged(address);
 });
 await t.test('user metadata cannot reserve an address and the public IP limit is retained',async()=>{
  const owner=await authUser('signup-metadata'),address=email();await db.query('update auth.users set raw_user_meta_data=raw_user_meta_data||$2::jsonb where id=$1',[owner.id,{email:address}]);await unchanged(address,'available');
  const ip='3'.repeat(64);await db.query('insert into private.account_signup_rates values($1,floor(extract(epoch from clock_timestamp())/300)::bigint,30)',[ip]);assert.deepEqual(await rpc({client_api_version:1,request_id:id(),email:address},{ip_hash:ip}),{error:'RATE_LIMITED'});
 });
 await t.test('obsolete signup/recovery state and provider-blocking triggers are removed',async()=>{
  for(const name of ['account_signup_claims','account_google_link_intents','account_totp_removal_intents','p07_recovery_rates','p07_recovery_config'])assert.equal((await db.query('select to_regclass($1) relation',['private.'+name])).rows[0].relation,null);
  for(const name of ['account_signup_request_v1','account_password_reset_request_v1','account_password_change_v1','account_google_link_prepare_v1','account_totp_remove_v1'])assert.equal((await db.query('select to_regprocedure($1) routine',['api_v1.'+name+'(jsonb,uuid,uuid,uuid[],jsonb)'])).rows[0].routine,null);
  assert.equal((await db.query("select count(*)::int n from pg_trigger where tgname in ('account_google_link_fence','account_identity_unlink_guard','ftk_account_totp_removal_fence')")).rows[0].n,0);
 });
});
