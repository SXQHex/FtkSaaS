import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {authUser,must,call,context,fixturePlatform} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

function totp(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){const n=alphabet.indexOf(c);assert(n>=0);bits+=n.toString(2).padStart(5,'0');}
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=h.at(-1)&15;
 return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}

test('Native TOTP enrollment, proof, stale-token rejection, mandatory security history and removal',async t=>{
 const guard=resources(t),user=await authUser('native-totp'),other=await authUser('native-totp-other');await must(user,'account_get_v1');await must(other,'account_get_v1');const {env}=context();
 const db=await guard.connect(env.DB_URL);const previousConfig=(await db.query('select * from private.p07_lifecycle_config')).rows;let factor,backup,backupSecret,backupCounter;let strong=user;let securityScope;
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
  await t.test('mandatory native proof uses service-only MFA access without exposing Auth factor rows',async()=>{
   assert.equal((await db.query("select has_table_privilege('service_role','auth.mfa_factors','SELECT') allowed")).rows[0].allowed,false);
   for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'private.account_mfa_assert(uuid,uuid,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
   await db.query('begin');
   try{
    await db.query('set local role service_role');
    await db.query("select set_config('request.jwt.claim.role','service_role',true)");
    await db.query('select private.account_mfa_assert($1,$2,$3)',[user.id,strong.session_id,{verified_aal:'aal2',mfa_required:true}]);
    await db.query('savepoint missing_factor');
    await assert.rejects(db.query('select private.account_mfa_assert($1,$2,$3)',[other.id,other.session_id,{verified_aal:'aal2',mfa_required:true}]),e=>e.code==='P0001'&&e.message==='AUTH_REQUIRED');
    await db.query('rollback to savepoint missing_factor');
    await db.query('savepoint factor_rows');
    await assert.rejects(db.query('select 1 from auth.mfa_factors limit 1'),e=>e.code==='42501');
    await db.query('rollback to savepoint factor_rows');
   }finally{await db.query('rollback');}
  });
  await t.test('organization MFA and stricter reauthentication cover direct and recursive discovery paths',async()=>{
   await db.query('insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do nothing');
   const {platform,plan}=await fixturePlatform(),account=await must(strong,'account_get_v1');
   const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Native organization security',initial_plan_id:plan},key())).primary_id;
   const center=(await must(strong,'center_create_v1',{org_id:org,name:'Native security center',timezone:'UTC'},key())).primary_id;
   const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
   await must(strong,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
   const payment=(await must(strong,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()},key())).primary_id;
   await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment,accepted:true},key());
   await must(strong,'role_assign_v1',{org_id:org,center_id:center,person_id:person,role:'staff',scope:{center_id:center}},key());
   securityScope={org,center};
   const rooms={org_id:org,center_id:center,operation:'room_save_v1',selector:{operation:'room_save_v1',key:{}},page:{limit:10}};
   const q={scope:'organization',org_id:org},none={mfa_roles:[],sensitive_reauth_max_age_seconds:null};
   let current=await must(strong,'settings_get_v1',q);
   await must(strong,'settings_update_v1',{...q,expected_version:current.version,patch:{security_policy:{...none,mfa_roles:['owner']}}},key());
   await must(strong,'organization_get_v1',{org_id:org});
   const discovered=await must(strong,'management_state_get_v1',{org_id:org,center_id:center,operation:'permission_set_v1',selector:{operation:'permission_set_v1',key:{person_id:person,permission:'attendance.draft'}}});
   assert.equal(discovered.items[0].entity.id,person);
   await fail('AUTH_REQUIRED',user,'management_state_get_v1',rooms);
   current=await must(strong,'settings_get_v1',q);
   const baseline=(await db.query('select reauth_max_age_seconds from private.p07_lifecycle_config where singleton')).rows[0].reauth_max_age_seconds;
   await fail('VALIDATION_FAILED',strong,'settings_update_v1',{...q,expected_version:current.version,patch:{security_policy:{...none,sensitive_reauth_max_age_seconds:baseline+1}}},key());
   await must(strong,'settings_update_v1',{...q,expected_version:current.version,patch:{security_policy:{...none,mfa_roles:['owner'],sensitive_reauth_max_age_seconds:1}}},key());
   const created=(await db.query('select created_at from auth.sessions where id=$1',[strong.session_id])).rows[0].created_at;
   try{
    await db.query("update auth.sessions set created_at=clock_timestamp()-interval '1 minute' where id=$1",[strong.session_id]);
    await fail('AUTH_REQUIRED',strong,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
    await must(strong,'management_state_get_v1',rooms);
   }finally{await db.query('update auth.sessions set created_at=$2 where id=$1',[strong.session_id,created]);}
   await db.query("update private.frontend_settings set values=jsonb_set(values,'{security_policy}',$2::jsonb),version=version+1 where scope_key=$1",['organization:'+org,JSON.stringify(none)]);
   await must(strong,'settings_get_v1',q);
  });
  await t.test('a separately enrolled backup authenticator is verified before device loss',async()=>{
   const enrolled=await native('/factors','POST',{factor_type:'totp',friendly_name:'Independent backup authenticator',issuer:'FtkSaaS'},strong);
   assert(enrolled.response.ok);backup=enrolled.data.id;backupSecret=enrolled.data.totp.secret;backupCounter=Math.floor(Date.now()/30000);
   const challenge=await native('/factors/'+backup+'/challenge','POST',{},strong);assert(challenge.response.ok);
   const proof=await native('/factors/'+backup+'/verify','POST',{challenge_id:challenge.data.id,code:totp(backupSecret)},strong);assert(proof.response.ok);backupCounter=Math.floor(Date.now()/30000);
   strong={...strong,jwt:proof.data.access_token,session_id:JSON.parse(Buffer.from(proof.data.access_token.split('.')[1],'base64url')).session_id};
   assert.equal((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and status::text='verified'",[user.id])).rows[0].n,2);
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
   // MFA verification upgraded the original session. Native unenroll checks the
   // live session AAL, so its old JWT is not an independent weak-session fixture.
   const login=await native('/token?grant_type=password','POST',{email:user.email,password:user.password});assert.equal(login.response.status,200);
   const claims=JSON.parse(Buffer.from(login.data.access_token.split('.')[1],'base64url'));
   assert.equal(claims.sub,user.id);assert.equal(claims.aal,'aal1');assert.notEqual(claims.session_id,strong.session_id);
   const weakSession={...user,jwt:login.data.access_token,session_id:claims.session_id};
   const assurance=await db.query('select id,aal::text from auth.sessions where user_id=$1 and id=any($2::uuid[])',[user.id,[weakSession.session_id,strong.session_id]]);
   assert.deepEqual(Object.fromEntries(assurance.rows.map(row=>[row.id,row.aal])),{[weakSession.session_id]:'aal1',[strong.session_id]:'aal2'});
   const weakOwner=await native('/factors/'+factor,'DELETE',undefined,weakSession);assert.equal(weakOwner.response.status,422);assert.equal(weakOwner.data.error_code,'insufficient_aal');
   const denied=await native('/factors/'+factor,'DELETE',undefined,other);assert.equal(denied.response.ok,false);
   assert.deepEqual((await db.query('select status::text from auth.mfa_factors where id=$1 and user_id=$2',[factor,user.id])).rows,[{status:'verified'}]);
   const directStrong=await native('/factors/'+factor,'DELETE',undefined,strong);assert.equal(directStrong.response.ok,true,'native AAL2 removal needs no application approval');factor=null;
   await must(strong,'account_get_v1');const history=await must(strong,'account_security_history_get_v1');assert.equal(history.items.filter(e=>e.action==='totp_disabled').length,1);assert(history.items.every(e=>!('secret' in e)&&!('code' in e)));
   assert.equal((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and status::text='verified'",[user.id])).rows[0].n,1);
   // Loss/removal of the primary device does not let a fresh password session
   // bypass MFA. The separately verified backup supplies the actual proof.
   const fresh=await native('/token?grant_type=password','POST',{email:user.email,password:user.password});assert(fresh.response.ok);
   const weak={...user,jwt:fresh.data.access_token,session_id:JSON.parse(Buffer.from(fresh.data.access_token.split('.')[1],'base64url')).session_id};
   await fail('AUTH_REQUIRED',weak,'account_get_v1');
   if(Math.floor(Date.now()/30000)===backupCounter)await new Promise(resolve=>setTimeout(resolve,31000-Date.now()%30000));
   const challenge=await native('/factors/'+backup+'/challenge','POST',{},weak);assert(challenge.response.ok);
   const proof=await native('/factors/'+backup+'/verify','POST',{challenge_id:challenge.data.id,code:totp(backupSecret)},weak);assert(proof.response.ok);
   strong={...weak,jwt:proof.data.access_token};assert.equal(JSON.parse(Buffer.from(strong.jwt.split('.')[1],'base64url')).aal,'aal2');await must(strong,'account_get_v1');
   const removed=await native('/factors/'+backup,'DELETE',undefined,strong);assert(removed.response.ok);backup=null;backupSecret=null;
   assert.equal((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and status::text='verified'",[user.id])).rows[0].n,0);
   await must(strong,'account_get_v1');
   const {org,center}=securityScope;
   await db.query("update private.frontend_settings set values=jsonb_set(values,'{security_policy,mfa_roles}','[\"owner\"]'::jsonb) where scope_key=$1",['organization:'+org]);
   await fail('AUTH_REQUIRED',strong,'management_state_get_v1',{org_id:org,center_id:center,operation:'room_save_v1',selector:{operation:'room_save_v1',key:{}},page:{limit:10}});
   await fail('AUTH_REQUIRED',strong,'organization_get_v1',{org_id:org});
   await must(strong,'account_get_v1');
   await db.query("update private.frontend_settings set values=jsonb_set(values,'{security_policy,mfa_roles}','[]'::jsonb) where scope_key=$1",['organization:'+org]);
  });
 }finally{
  let cleanupFailed=false;
  for(const id of [backup,factor].filter(Boolean)){
   try{const removed=await native('/factors/'+id,'DELETE',undefined,strong);if(!removed.response.ok)cleanupFailed=true;}catch{cleanupFailed=true;}
  }
  try{if(previousConfig.length)await db.query('update private.p07_lifecycle_config set reauth_max_age_seconds=$1 where singleton',[previousConfig[0].reauth_max_age_seconds]);else await db.query('delete from private.p07_lifecycle_config');}
  finally{await db.end();}
  if(cleanupFailed)throw Error('Native MFA fixture cleanup requires inspection');
 }
});
