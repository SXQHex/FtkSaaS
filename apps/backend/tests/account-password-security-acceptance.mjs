import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {randomBytes} from 'node:crypto';
import {authUser,must,call,context} from './api-client.mjs';
import {newUuidV7 as id} from '../scripts/uuid.mjs';
import {startPasswordAuth} from './native-password-auth.mjs';
import {passwordSecurityConfig as policy} from '../scripts/auth-password-security.mjs';

test('XREQ-002: native current password, reauthentication, security mail and recovery proofs',async t=>{
 const guard=resources(t),{s,env}=context(),db=await guard.connect(env.DB_URL);
 const {origin,siteURL}=await startPasswordAuth(t,s);
 const password=()=>randomBytes(30).toString('base64url');
 const native=async(route,method,body,jwt)=>{
  const r=await fetch(origin+route,{method,headers:{'content-type':'application/json',...(jwt?{authorization:'Bearer '+jwt}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  return {status:r.status,data:await r.json()};
 };
 const login=async(user,p=user.password)=>{
  const r=await native('/token?grant_type=password','POST',{email:user.email,password:p});assert.equal(r.status,200);
  return {jwt:r.data.access_token,refresh:r.data.refresh_token,session_id:JSON.parse(Buffer.from(r.data.access_token.split('.')[1],'base64url')).session_id};
 };
 const messages=async address=>{
  const r=await fetch(env.MAILPIT_URL+'/api/v1/messages?limit=1000',{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);
  return (await r.json()).messages.filter(m=>m.To.some(x=>x.Address===address));
 };
 const mail=async(address,before,subject)=>{
  for(let i=0;i<30;i++){
   const found=(await messages(address)).find(m=>!before.has(m.ID)&&(!subject||m.Subject===subject));
   if(found){const r=await fetch(env.MAILPIT_URL+'/api/v1/message/'+found.ID,{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);return r.json();}
   await delay(100);
  }assert.fail('Expected native SMTP message was not delivered to the sink');
 };
 const messageIds=async address=>new Set((await messages(address)).map(m=>m.ID));
 const change=(user,next,old,nonce)=>native('/user','PUT',{password:next,...(old===undefined?{}:{current_password:old}),...(nonce===undefined?{}:{nonce})},user.jwt);
 const reauthenticate=async user=>{
  const before=await messageIds(user.email);assert.equal((await native('/reauthenticate','GET',undefined,user.jwt)).status,200);
  const message=await mail(user.email,before);assert.deepEqual(message.To.map(x=>x.Address),[user.email]);
  const codes=[...message.Text.matchAll(/\b\d{6}\b/g)].map(x=>x[0]);assert.equal(codes.length,1,'Native reauthentication email must contain one six-digit nonce');return codes[0];
 };
 const verify=token=>native('/verify','POST',{type:'recovery',token_hash:token});
 const recover=async user=>{
  const before=await messageIds(user.email);assert.equal((await native('/recover','POST',{email:user.email})).status,200);
  const message=await mail(user.email,before),token=message.Text.match(/[?&]token=([a-f0-9]+)/)?.[1]??message.HTML.match(/[?&]token=([a-f0-9]+)/)?.[1];
  assert(token,'Native recovery email must contain the verification proof');return token;
 };
 const denied=async session=>{
  const refresh=await native('/token?grant_type=refresh_token','POST',{refresh_token:session.refresh});assert.equal(refresh.status,400);
  assert.equal((await native('/user','GET',undefined,session.jwt)).status,403);
  const edge=await call(session,'account_get_v1');assert.equal(edge.status,401);assert.equal(edge.result.error.code,'AUTH_REQUIRED');
 };
 await t.test('missing and wrong current passwords fail even in a fresh session without changing credentials or sending mail',async()=>{
  const user=await authUser('password-rejected'),before=await messageIds(user.email),next=password();
  for(const current of [undefined,'',password()]){const rejected=await change(user,next,current);assert.equal(rejected.status,400);assert.equal(rejected.data.error_code,current?'current_password_invalid':'current_password_required');}
  assert.deepEqual(await messageIds(user.email),before);await login(user);
  assert.equal((await native('/token?grant_type=password','POST',{email:user.email,password:next})).status,400);
 });
 await t.test('a session younger than 24 hours changes without nonce, notifies only the registered address and revokes other sessions',async()=>{
  const user=await authUser('password-success'),secondary=await login(user),next=password(),spoof='spoof-'+id()+'@ftksaas.invalid';
  await db.query("update auth.sessions set created_at=now()-interval '23 hours' where id=$1",[user.session_id]);
  await must(user,'account_get_v1');
  assert.equal((await native('/user','PUT',{data:{email:spoof,redirect_to:'https://untrusted.invalid'}},user.jwt)).status,200);
  const before=await messageIds(user.email);assert.equal((await change(user,next,user.password)).status,200);
  const notification=await mail(user.email,before,policy.mailer_subjects_password_changed_notification);
  assert.deepEqual(notification.To.map(x=>x.Address),[user.email]);assert.equal((await messages(spoof)).length,0);
  const links=[...notification.HTML.matchAll(/href="([^"]+)"/g)].map(x=>x[1]);assert.deepEqual(links,[siteURL+'/forgot-password']);
  assert(notification.HTML.includes('Bu işlemi ben yapmadım'));assert(notification.HTML.includes('bir saat'));
  for(const secret of [user.id,user.email,user.password,next,user.jwt])assert(!notification.HTML.includes(secret));
  assert.equal(new URL(links[0]).search,'');assert.equal(new URL(links[0]).hash,'');
  assert.equal((await native('/token?grant_type=password','POST',{email:user.email,password:user.password})).status,400);
  await login(user,next);await denied(secondary);await must(user,'account_get_v1');
 });
 await t.test('an older session needs a native nonce even after token refresh; invalid, expired and replayed nonces fail',async()=>{
  const user=await authUser('password-reauth'),session=await login(user),secondary=await login(user),next=password();
  Object.assign(user,session);await must(user,'account_get_v1');
  await db.query("update auth.sessions set created_at=now()-interval '25 hours' where id=$1",[user.session_id]);
  const before=await messageIds(user.email),missing=await change(user,next,user.password);
  assert.equal(missing.status,400);assert.equal(missing.data.error_code,'reauthentication_needed');assert.deepEqual(await messageIds(user.email),before);
  const refreshed=await native('/token?grant_type=refresh_token','POST',{refresh_token:session.refresh});assert.equal(refreshed.status,200);user.jwt=refreshed.data.access_token;
  assert.equal(JSON.parse(Buffer.from(user.jwt.split('.')[1],'base64url')).session_id,session.session_id);
  assert.equal((await change(user,next,user.password)).data.error_code,'reauthentication_needed');
  const nonce=await reauthenticate(user),wrong=String((Number(nonce[0])+1)%10)+nonce.slice(1);
  const invalid=await change(user,next,user.password,wrong);assert.equal(invalid.status,422);assert.equal(invalid.data.error_code,'reauthentication_not_valid');
  await db.query("update auth.users set reauthentication_sent_at=now()-interval '2 hours' where id=$1",[user.id]);
  const expired=await change(user,next,user.password,nonce);assert.equal(expired.status,422);assert.equal(expired.data.error_code,'reauthentication_not_valid');
  await login(user);assert.equal((await native('/token?grant_type=password','POST',{email:user.email,password:next})).status,400);
  assert.equal((await messages(user.email)).filter(m=>m.Subject===policy.mailer_subjects_password_changed_notification).length,0);
  const freshNonce=await reauthenticate(user),beforeChange=await messageIds(user.email);
  assert.equal((await change(user,next,user.password,freshNonce)).status,200);await mail(user.email,beforeChange,policy.mailer_subjects_password_changed_notification);
  const replay=await change(user,password(),next,freshNonce);assert.equal(replay.status,422);assert.equal(replay.data.error_code,'reauthentication_not_valid');
  await denied(secondary);await must(user,'account_get_v1');await login(user,next);
 });
 await t.test('a valid nonce does not replace the current password in an older session',async()=>{
  for(const current of [undefined,password()]){
   const user=await authUser('password-reauth-current'),next=password();
   await db.query("update auth.sessions set created_at=now()-interval '25 hours' where id=$1",[user.session_id]);
   const nonce=await reauthenticate(user),rejected=await change(user,next,current,nonce);
   assert.equal(rejected.status,400);assert.equal(rejected.data.error_code,current?'current_password_invalid':'current_password_required');
   assert.equal((await messages(user.email)).filter(m=>m.Subject===policy.mailer_subjects_password_changed_notification).length,0);
   await login(user);assert.equal((await native('/token?grant_type=password','POST',{email:user.email,password:next})).status,400);
  }
 });
 await t.test('recovery proof is single-use; verified recovery changes password without the forgotten password and revokes prior sessions',async()=>{
  const user=await authUser('password-recovery'),oldSession=await login(user),next=password();await must(user,'account_get_v1');
  const proof=await recover(user),verified=await verify(proof);assert.equal(verified.status,200);assert(verified.data.access_token);
  assert.equal((await verify(proof)).status,403);
  const recovery={jwt:verified.data.access_token},before=await messageIds(user.email);
  assert.equal((await change(recovery,next)).status,200);
  await mail(user.email,before,policy.mailer_subjects_password_changed_notification);
  await denied(oldSession);assert.equal((await native('/user','GET',undefined,user.jwt)).status,403);await must(recovery,'account_get_v1');
  assert.equal((await native('/token?grant_type=password','POST',{email:user.email,password:user.password})).status,400);await login(user,next);
 });
 await t.test('invalid, expired and superseded recovery proofs cannot create a session or mutate the password',async()=>{
  const user=await authUser('password-expiry'),proof=await recover(user);
  const sessions=async()=>(await db.query('select id from auth.sessions where user_id=$1 order by id',[user.id])).rows;
  const before=await sessions();assert.equal((await verify('0'.repeat(64))).status,403);
  await db.query("update auth.users set recovery_sent_at=now()-interval '2 hours' where id=$1",[user.id]);
  assert.equal((await verify(proof)).status,403);assert.deepEqual(await sessions(),before);
  const replacement=await recover(user);assert.equal((await verify(proof)).status,403);
  // Supersede a still-valid, unused proof, independently of the expiry case.
  await delay(1100);const newest=await recover(user);assert.notEqual(newest,replacement);
  assert.equal((await verify(replacement)).status,403);assert.equal((await verify(newest)).status,200);
  assert.equal((await verify(newest)).status,403);await login(user);
 });
 await t.test('first password remains possible when no prior password exists',async()=>{
  // Isolated synthetic state, not real OAuth acceptance. generate_link(magiclink)
  // for a new address creates a signup with a random password, not a passwordless user.
  const user=await authUser('password-first'),next=password();
  const claims=JSON.parse(Buffer.from(user.jwt.split('.')[1],'base64url'));
  assert(claims.amr.some(entry=>entry.method==='password'));assert(!claims.amr.some(entry=>entry.method==='recovery'));
  const session=await db.query("select created_at>now()-interval '24 hours' as fresh from auth.sessions where id=$1 and user_id=$2",[user.session_id,user.id]);
  assert.equal(session.rowCount,1);assert.equal(session.rows[0].fresh,true);
  const prepared=await db.query('update auth.users set encrypted_password=null where id=$1 returning encrypted_password is null as passwordless',[user.id]);
  assert.equal(prepared.rowCount,1);assert.equal(prepared.rows[0].passwordless,true);
  assert.equal((await native('/token?grant_type=password','POST',{email:user.email,password:user.password})).status,400);
  // Keep the normal existing session: recovery must not supply this exception.
  assert.equal((await change(user,next)).status,200);const fresh=await login(user,next);
  const rejected=await change(fresh,password());assert.equal(rejected.status,400);assert.equal(rejected.data.error_code,'current_password_required');
  await login(user,next);
 });
});
