import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {authUser,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Global identity current projections, safe links, immutable scope and transactional failure',async t=>{
 const guard=resources(t),user=await authUser('identity-owner'),other=await authUser('identity-other');
 const account=await must(user,'account_get_v1');await must(other,'account_get_v1');
 const db=await guard.connect(context().env.DB_URL),orgs=[key(),key()],people=[key(),key()],links=[key(),key()];let trigger;
 const write=(body,k=key())=>must(user,'account_profile_update_v1',body,k);
 const version=async()=>Number((await db.query('select version from core.accounts where id=$1',[account.id])).rows[0].version);
 const contacts=async person=>(await db.query('select kind,value,verified_at from core.person_contacts where person_id=$1 order by kind,value',[person])).rows;
 try{
  // Native user/session above; SQL prepares only tenant fixture data, never an Auth identity or proof.
  await db.query('begin');await db.query('set constraints all deferred');
  for(let i=0;i<2;i++){
   await db.query("insert into core.organizations(id,org_id,name,owner_person_id,state) values($1,$1,'Identity acceptance',$2,'active')",[orgs[i],people[i]]);
   await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Legacy organization name','active')",[people[i],orgs[i]]);
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[links[i],orgs[i],account.id,people[i]]);
  }await db.query('commit');
  await t.test('initial native name is frozen in one profile source before any explicit profile write',async()=>{
   assert.equal(account.display_name,'identity-owner');
   assert.equal((await db.query('select display_name from private.p07_profiles where account_id=$1',[account.id])).rows[0].display_name,'identity-owner');
   assert((await db.query('select display_name from core.people where id=any($1::uuid[])',[people])).rows.every(p=>p.display_name===account.display_name));
   const original=(await db.query('select raw_user_meta_data from auth.users where id=$1',[user.id])).rows[0].raw_user_meta_data;
   try{
    await db.query('update auth.users set raw_user_meta_data=$2 where id=$1',[user.id,{...original,display_name:'Native metadata bypass'}]);
    assert.equal((await must(user,'account_get_v1')).display_name,account.display_name);
    assert((await db.query('select display_name from core.people where id=any($1::uuid[])',[people])).rows.every(p=>p.display_name===account.display_name));
   }finally{await db.query('update auth.users set raw_user_meta_data=$2 where id=$1',[user.id,original]);}
  });
  await t.test('own typed names propagate to active links; ID and native metadata stay unchanged',async()=>{
   const before=(await db.query('select raw_user_meta_data from auth.users where id=$1',[user.id])).rows[0];
   const body={expected_version:await version(),display_name:'Current display',given_name:'Current',family_name:'Identity'},k=key();
   await write(body,k);assert.equal((await write(body,k)).replayed,true);
   const view=await must(user,'account_get_v1');assert.equal(view.id,account.id);assert.equal(view.identity.given_name,'Current');assert.equal(view.identity.family_name,'Identity');assert.equal(view.identity.email,user.email);assert.equal(view.identity.phone,null);
   const rows=(await db.query('select display_name,given_name,family_name from core.people where id=any($1::uuid[]) order by id',[people])).rows;
   assert(rows.every(p=>p.display_name==='Current display'&&p.given_name==='Current'&&p.family_name==='Identity'));
   for(const person of people)assert((await contacts(person)).some(c=>c.value===user.email&&c.verified_at));
   assert.deepEqual((await db.query('select raw_user_meta_data from auth.users where id=$1',[user.id])).rows[0],before);
   assert.notEqual((await must(other,'account_get_v1')).identity.given_name,'Current');
  });
  await t.test('unverified phone is self-only, versioned and never promoted to native verification',async()=>{
   const phone='+905551234567';
   await write({expected_version:await version(),display_name:'Current display',unverified_phone:phone});
   const management=await must(user,'management_state_get_v1',{operation:'account_profile_update_v1',selector:{operation:'account_profile_update_v1',key:{}}});assert.equal(management.items[0].current.values.unverified_phone,phone);
   const view=await must(user,'account_get_v1');assert.equal(view.identity.unverified_phone,phone);assert.equal(view.identity.phone,null);assert.equal(view.identity.phone_verified_at,null);
   for(const p of people)assert((await contacts(p)).every(c=>c.kind!=='phone'));
   assert.notEqual((await must(other,'account_get_v1')).identity.unverified_phone,phone);
   await write({expected_version:await version(),display_name:'Current display'});assert.equal((await must(user,'account_get_v1')).identity.unverified_phone,phone);
   await write({expected_version:await version(),display_name:'Current display',unverified_phone:null});assert.equal((await must(user,'account_get_v1')).identity.unverified_phone,null);
  });
  await t.test('native email proofs expire, replace, resend, require both inboxes and propagate only on completion',async()=>{
   const {env}=context(),old=user.email,first='replace-'+key()+'@ftksaas.invalid',wanted='confirmed-'+key()+'@ftksaas.invalid';
   const native=async(path,method,body,jwt=user.jwt)=>{const response=await fetch(env.API_URL+'/auth/v1'+path,{method,headers:{apikey:env.ANON_KEY,...(jwt?{authorization:'Bearer '+jwt}:{}),'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await response.json();return {status:response.status,data};};
   const mailbox=async()=>{const r=await fetch(env.MAILPIT_URL+'/api/v1/messages',{signal:AbortSignal.timeout(10000)});assert(r.ok);return (await r.json()).messages;};
   const proofs=async(before,recipient)=>{
    for(let attempt=0;attempt<20;attempt++){
     const messages=(await mailbox()).filter(m=>!before.has(m.ID)&&m.To.some(a=>a.Address===recipient));
     if(messages.length){const detail=await(await fetch(env.MAILPIT_URL+'/api/v1/message/'+messages[0].ID,{signal:AbortSignal.timeout(10000)})).json();const token=detail.Text.match(/[?&]token=([a-f0-9]+)/)?.[1]??detail.HTML.match(/[?&]token=([a-f0-9]+)/)?.[1];assert(token,'native mail must contain the provider verification hash');return token;}
     await new Promise(r=>setTimeout(r,100));
    }assert.fail('native email change message missing');
   };
   const unchanged=async()=>{assert.equal((await must(user,'account_get_v1')).identity.email,old);for(const p of people)assert((await contacts(p)).some(c=>c.kind==='email'&&c.value===old&&c.verified_at));};
   const verify=token=>native('/verify','POST',{type:'email_change',token_hash:token},null);
   const collision=await native('/user','PUT',{email:other.email});assert.equal(collision.status,422);assert.equal(collision.data.error_code,'email_exists');
   let before=new Set((await mailbox()).map(m=>m.ID));assert.equal((await native('/user','PUT',{email:first})).status,200);const replaced=await proofs(before,first);await unchanged();
   await new Promise(r=>setTimeout(r,1100));before=new Set((await mailbox()).map(m=>m.ID));assert.equal((await native('/user','PUT',{email:wanted})).status,200);const expired=await proofs(before,wanted);assert((await verify(replaced)).status>=400,'replaced request proof must fail');await unchanged();
   await db.query("update auth.users set email_change_sent_at=now()-interval '2 hours' where id=$1",[user.id]);assert((await verify(expired)).status>=400,'expired provider proof must fail');await unchanged();
   before=new Set((await mailbox()).map(m=>m.ID));assert.equal((await native('/resend','POST',{type:'email_change',email:old},null)).status,200);const oldProof=await proofs(before,old),newProof=await proofs(before,wanted);
   assert((await verify(expired)).status>=400,'resend must invalidate the prior proof');
   assert.equal((await verify(oldProof)).status,200);await unchanged();
   const completed=await verify(newProof);assert.equal(completed.status,200);assert(completed.data.access_token);user.email=wanted;user.jwt=completed.data.access_token;user.session_id=JSON.parse(Buffer.from(user.jwt.split('.')[1],'base64url')).session_id;
   assert.equal((await must(user,'account_get_v1')).identity.email,wanted);for(const p of people){const values=await contacts(p);assert(values.some(c=>c.kind==='email'&&c.value===wanted&&c.verified_at));assert(values.every(c=>c.value!==old));}
   assert((await verify(newProof)).status>=400,'completed native proof cannot be reused');
   const history=await must(user,'account_security_history_get_v1');assert.equal(history.items.filter(e=>e.action==='email_changed').length,1);assert(!JSON.stringify(history).includes(newProof));assert(!(await must(other,'account_security_history_get_v1')).items.some(e=>e.action==='email_changed'));
  });
  await t.test('native unlink and SQL guard preserve the last usable login method and one audit event',async()=>{
   // A synthetic second identity exercises the DB/provider unlink path only.
   // It is not Google OAuth proof; the hosted real-provider acceptance is separate.
   const id=key(),sub=key();
   const insertIdentity=()=>db.query("insert into auth.identities(id,user_id,provider,provider_id,identity_data,created_at,updated_at,last_sign_in_at) values($1,$2,'google',$3,$4,now(),now(),now())",[id,user.id,sub,{sub,email:user.email,email_verified:true}]);
   await assert.rejects(insertIdentity(),e=>e.code==='P0001'&&e.message==='AUTH_REQUIRED');
   // Internal fixture intent is not a substitute for actual provider linking acceptance.
   await db.query("insert into private.account_google_link_intents values($1,$2,now()+interval '1 minute',false,$3)",[account.id,user.session_id,sub]);
   const config=(await db.query('select reauth_max_age_seconds from private.p07_lifecycle_config')).rows;
   if(!config.length)await db.query('insert into private.p07_lifecycle_config values(true,900)');
   try{await insertIdentity();}finally{if(!config.length)await db.query('delete from private.p07_lifecycle_config');}
   const {env}=context(),response=await fetch(env.API_URL+'/auth/v1/user/identities/'+id,{method:'DELETE',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+user.jwt},signal:AbortSignal.timeout(15000)});const removedBody=await response.json();assert.equal(response.ok,true,JSON.stringify({status:response.status,code:removedBody.error_code,message:removedBody.msg}));
   const email=(await db.query("select id from auth.identities where user_id=$1 and provider='email'",[user.id])).rows[0].id;
   const last=await fetch(env.API_URL+'/auth/v1/user/identities/'+email,{method:'DELETE',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+user.jwt},signal:AbortSignal.timeout(15000)});assert.equal(last.ok,false);await last.arrayBuffer();
   await assert.rejects(db.query('delete from auth.identities where id=$1',[email]),e=>e.code==='P0001'&&e.message==='FORBIDDEN');
   assert.equal((await must(user,'account_get_v1')).id,account.id);
   const h=await must(user,'account_security_history_get_v1');assert.equal(h.items.filter(e=>e.action==='identity_linked').length,1);assert.equal(h.items.filter(e=>e.action==='identity_unlinked').length,1);
  });
  await t.test('unverified native phone is never advertised or copied as verified',async()=>{
   await db.query("update auth.users set phone=$2,phone_confirmed_at=null where id=$1",[user.id,'905'+String(BigInt('0x'+key().replaceAll('-','').slice(-12))%1000000000n).padStart(9,'0')]);
   assert.equal((await must(user,'account_get_v1')).identity.phone,null);
   assert((await contacts(people[0])).every(c=>c.kind!=='phone'));
  });
  await t.test('local SMS test code verifies only after proof and does not represent real delivery',async()=>{
   const phone='12025550101',{env}=context();const saved=(await db.query('select phone,phone_confirmed_at from auth.users where id=$1',[user.id])).rows[0];
   const native=async(path,method,body)=>{const response=await fetch(env.API_URL+'/auth/v1'+path,{method,headers:{apikey:env.ANON_KEY,authorization:'Bearer '+user.jwt,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});return {status:response.status,data:await response.json()};};
   try{
    await write({expected_version:await version(),display_name:'Current display',unverified_phone:'+'+phone});
    const requested=await native('/user','PUT',{phone});assert.equal(requested.status,200);
    const pending=await must(user,'account_get_v1');assert.equal(pending.identity.phone,null);assert.equal(pending.identity.unverified_phone,'+'+phone);assert.equal(pending.identity.pending_phone,phone);
    for(const p of people)assert((await contacts(p)).every(c=>c.kind!=='phone'));
    const bad=await native('/verify','POST',{type:'phone_change',phone,token:'000000'});assert(bad.status>=400);
    const good=await native('/verify','POST',{type:'phone_change',phone,token:'654321'});assert.equal(good.status,200);assert(good.data.access_token);user.jwt=good.data.access_token;user.session_id=JSON.parse(Buffer.from(user.jwt.split('.')[1],'base64url')).session_id;
    const current=await must(user,'account_get_v1');assert.equal(current.id,account.id);assert.equal(current.identity.phone,phone);assert(current.identity.phone_verified_at);assert.equal(current.identity.unverified_phone,null);assert.equal(current.identity.email,user.email);
    for(const p of people)assert((await contacts(p)).some(c=>c.kind==='phone'&&c.value===phone&&c.verified_at));
    assert.equal((await must(other,'account_get_v1')).identity.phone,null);
   }finally{
    await db.query("update auth.users set phone=$2,phone_confirmed_at=$3,phone_change='',phone_change_token='' where id=$1",[user.id,saved.phone,saved.phone_confirmed_at]);
    await write({expected_version:await version(),display_name:'Current display',unverified_phone:null});
   }
  });
  await t.test('revoke freezes old records; org reopening catches up',async()=>{
   await db.query("update core.account_links set state='revoked' where id=$1",[links[1]]);
   await db.query("update core.organizations set state='closed' where id=$1",[orgs[0]]);
   await write({expected_version:await version(),display_name:'While closed',given_name:'Changed'});
   assert((await db.query('select display_name from core.people where id=any($1::uuid[])',[people])).rows.every(p=>p.display_name==='Current display'));
   await db.query("update core.organizations set state='active' where id=$1",[orgs[0]]);
   assert.equal((await db.query('select display_name from core.people where id=$1',[people[0]])).rows[0].display_name,'While closed');
   assert.equal((await db.query('select display_name from core.people where id=$1',[people[1]])).rows[0].display_name,'Current display');

  });
  await t.test('moving a safe link releases old current-authority mappings and binds the new person',async()=>{
   const target=key();await db.query("insert into core.people(id,org_id,display_name,state) values($1,$2,'Target','active')",[target,orgs[0]]);
   await db.query('update core.account_links set person_id=$1 where id=$2',[target,links[0]]);
   assert.equal((await db.query('select count(*)::int n from private.account_contact_projections where org_id=$1 and person_id=$2',[orgs[0],people[0]])).rows[0].n,0);
   assert((await contacts(target)).some(c=>c.value===user.email&&c.verified_at));
   assert((await contacts(people[0])).some(c=>c.value===user.email),'former current contacts remain frozen, not destroyed');
   await db.query("update core.people set state='merged',merged_into_id=$1 where id=$2",[target,people[0]]);
   const oldEmail=user.email,nextEmail='after-merge-'+key()+'@ftksaas.invalid';
   // Native proof lifecycle was exercised above; this SQL fixture isolates the
   // already-confirmed value change and alias projection transaction.
   await db.query('update auth.users set email=$2 where id=$1',[user.id,nextEmail]);
   const projection=(await db.query('select private.person_projection($1,$2,null,true,true) value',[orgs[0],target])).rows[0].value;
   assert(projection.contacts.some(c=>c.value===nextEmail));assert(projection.contacts.every(c=>c.value!==oldEmail),'retired canonical contact must not leak from aliases');
   assert((await contacts(people[0])).some(c=>c.value===oldEmail),'historical canonical contact must remain physically present');
   user.email=nextEmail;
  });
  await t.test('opposite pre-held links fail fast with a retryable transaction instead of deadlocking',async()=>{
   await db.query("update core.account_links set state='active',verified_at=now() where id=$1",[links[1]]);
   const first=await guard.connect(context().env.DB_URL),second=await guard.connect(context().env.DB_URL);let pending;
   try{
    for(const c of [first,second]){await c.query('begin');await c.query("set local lock_timeout='5s'");}
    await first.query('select id from core.account_links where id=$1 for update',[links[0]]);
    await second.query('select id from core.account_links where id=$1 for update',[links[1]]);
    const pid=(await first.query('select pg_backend_pid() pid')).rows[0].pid;
    pending=first.query('update core.account_links set version=version+1 where id=$1',[links[0]]).then(x=>({ok:x}),error=>({error}));
    let waiting=false;
    for(let i=0;i<100;i++){waiting=(await db.query("select exists(select 1 from pg_stat_activity where pid=$1 and wait_event_type='Lock') waiting",[pid])).rows[0].waiting;if(waiting)break;await new Promise(r=>setTimeout(r,10));}
    assert(waiting,'first transaction must hold the identity mutex while waiting for the second link');
    await assert.rejects(second.query('update core.account_links set version=version+1 where id=$1',[links[1]]),error=>error.code==='P0001'&&error.message==='TEMPORARY_FAILURE');
    await second.query('rollback');const result=await pending;assert(!result.error,result.error?.message);await first.query('commit');
    await second.query('update core.account_links set version=version+1 where id=$1',[links[1]]);
   }finally{for(const c of [first,second]){try{await c.query('rollback');}catch{}await c.end();}if(pending)await pending;}
  });
  await t.test('late projection failure rolls back names, account version, receipt and notices together',async()=>{
   const before=await must(user,'account_get_v1'),v=await version();trigger='identity_failure_'+key().replaceAll('-','');
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin raise exception using errcode='23514',message='synthetic identity projection failure';end$$`);
   await db.query(`create trigger ${trigger} before update on core.people for each row execute function private.${trigger}()`);
   const failed=await call(user,'account_profile_update_v1',{expected_version:v,display_name:'Must rollback',given_name:'Rollback'},key());
   assert.equal(failed.result.ok,false);assert.equal(failed.result.error.code,'INTEGRITY_VIOLATION');assert.deepEqual(await must(user,'account_get_v1'),before);assert.equal(await version(),v);
   await db.query(`drop trigger ${trigger} on core.people`);await db.query(`drop function private.${trigger}()`);trigger=null;
  });
 }finally{if(trigger){await db.query(`drop trigger if exists ${trigger} on core.people`);await db.query(`drop function if exists private.${trigger}()`);}await db.end();}
});
