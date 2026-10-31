import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {authUser,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){const n=alphabet.indexOf(c);assert(n>=0);bits+=n.toString(2).padStart(5,'0');}
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=h.at(-1)&15;
 return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}

test('Native TOTP enrollment, proof, stale-token rejection, mandatory security history and removal',async t=>{
 const guard=resources(t),user=await authUser('native-totp'),other=await authUser('native-totp-other');await must(user,'account_get_v1');await must(other,'account_get_v1');const {env}=context();
 const db=await guard.connect(env.DB_URL);const previousConfig=(await db.query('select * from private.p07_lifecycle_config')).rows;let factor;let strong=user;
 const native=async(path,method,body,u=user)=>{const response=await fetch(env.API_URL+'/auth/v1'+path,{method,headers:{apikey:env.ANON_KEY,authorization:'Bearer '+u.jwt,'content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const text=await response.text();return {response,data:text?JSON.parse(text):null};};
 const fail=async(code,u,op,body={},k)=>{const r=await call(u,op,body,k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 try{
  await t.test('enrollment is unverified until a real TOTP challenge succeeds',async()=>{
   const enrolled=await native('/factors','POST',{factor_type:'totp',friendly_name:'Development authenticator',issuer:'FtkSaaS'});assert.equal(enrolled.response.ok,true,'Native TOTP must be configured');factor=enrolled.data.id;assert(enrolled.data.totp.secret);
   await must(user,'account_get_v1');assert(!(await must(user,'account_security_history_get_v1')).items.some(x=>x.action==='totp_enabled'));
   const wrong=await native('/factors/'+factor+'/challenge','POST',{});assert(wrong.response.ok);const actual=totp(enrolled.data.totp.secret),bad=String((Number(actual[0])+1)%10)+actual.slice(1);
   const rejected=await native('/factors/'+factor+'/verify','POST',{challenge_id:wrong.data.id,code:bad});assert.equal(rejected.response.ok,false);
   const challenge=await native('/factors/'+factor+'/challenge','POST',{});assert(challenge.response.ok);const verified=await native('/factors/'+factor+'/verify','POST',{challenge_id:challenge.data.id,code:totp(enrolled.data.totp.secret)});assert(verified.response.ok,'correct TOTP verification');
   const claims=JSON.parse(Buffer.from(verified.data.access_token.split('.')[1],'base64url'));assert.equal(claims.aal,'aal2');strong={...user,jwt:verified.data.access_token,session_id:claims.session_id};
   const history=await must(strong,'account_security_history_get_v1');assert.equal(history.items.filter(e=>e.action==='totp_enabled').length,1);assert(!JSON.stringify(history).includes(enrolled.data.totp.secret));
  });
  await t.test('a previously issued aal1 token is not upgraded by the session database row',async()=>{
   await fail('AUTH_REQUIRED',user,'account_get_v1');await fail('AUTH_REQUIRED',user,'settings_get_v1',{scope:'user'});await fail('AUTH_REQUIRED',user,'account_sessions_list_v1');
   await must(strong,'account_get_v1');await must(strong,'settings_get_v1',{scope:'user'});
   for(const operation of ['account_get_v1','management_state_get_v1']){
   const rpc=await fetch(env.API_URL+'/rest/v1/rpc/'+operation,{method:'POST',headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:{client_api_version:1,request_id:key(),...(operation==='management_state_get_v1'?{operation:'account_delete_preview_v1',selector:{operation:'account_delete_preview_v1',key:{}}}:{})},p_actor_auth_id:user.id,p_session_id:strong.session_id,p_ids:Array.from({length:32},key),p_aux:{verified_aal:'aal1'}}),signal:AbortSignal.timeout(60000)});assert(rpc.ok);const rejected=await rpc.json();assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'AUTH_REQUIRED');
   }
   await fail('AUTH_REQUIRED',strong,'account_sessions_revoke_v1',{mode:'others',reauth:user.jwt},key());
   await db.query('insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do update set reauth_max_age_seconds=excluded.reauth_max_age_seconds');const retained=await must(strong,'account_sessions_revoke_v1',{mode:'others',reauth:strong.jwt},key());assert.equal(retained.current_revoked,false);await must(strong,'account_get_v1');
   await must(other,'account_get_v1');
   const noDirect=await fetch(env.API_URL+'/rest/v1/rpc/account_sessions_revoke_v1',{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+user.jwt,'content-type':'application/json','Content-Profile':'api_v1'},body:JSON.stringify({p_request:{client_api_version:1,request_id:key(),operation_key:key(),mode:'current'},p_actor_auth_id:user.id,p_session_id:user.session_id,p_ids:Array.from({length:32},key),p_aux:{verified_aal:'aal2'}}),signal:AbortSignal.timeout(60000)});assert.equal(noDirect.ok,false);
  });
  await t.test('only a native strong owner can remove the factor; removal produces no secret-bearing history',async()=>{
   const weakOwner=await native('/factors/'+factor,'DELETE',undefined,user);assert.equal(weakOwner.response.ok,false,'own stale aal1 token cannot remove a verified factor');
   const denied=await native('/factors/'+factor,'DELETE',undefined,other);assert.equal(denied.response.ok,false);
   const directStrong=await native('/factors/'+factor,'DELETE',undefined,strong);assert.equal(directStrong.response.ok,true,'native AAL2 removal needs no application approval');factor=null;
   await must(strong,'account_get_v1');const history=await must(strong,'account_security_history_get_v1');assert.equal(history.items.filter(e=>e.action==='totp_disabled').length,1);assert(history.items.every(e=>!('secret' in e)&&!('code' in e)));
   assert.equal((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and status::text='verified'",[user.id])).rows[0].n,0);
  });
 }finally{if(factor){try{await native('/factors/'+factor,'DELETE',undefined,strong);}catch{}}if(previousConfig.length)await db.query('update private.p07_lifecycle_config set reauth_max_age_seconds=$1 where singleton',[previousConfig[0].reauth_max_age_seconds]);else await db.query('delete from private.p07_lifecycle_config');await db.end();}
});
