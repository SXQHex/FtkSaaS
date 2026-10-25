import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {authUser,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Native account sessions: own scope, optimistic labels, revocation, fresh proof and security history',async t=>{
 const guard=resources(t),owner=await authUser('session-owner'),other=await authUser('session-other');
 const account=await must(owner,'account_get_v1');await must(other,'account_get_v1');
 const {env}=context(),db=await guard.connect(env.DB_URL);let trigger;
 const previousConfig=(await db.query('select * from private.p07_lifecycle_config')).rows;
 const login=async user=>{
  const r=await fetch(env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:user.email,password:user.password}),signal:AbortSignal.timeout(60000)});assert(r.ok,'native sign-in');const value=await r.json();
  return {...user,jwt:value.access_token,refresh:value.refresh_token,session_id:JSON.parse(Buffer.from(value.access_token.split('.')[1],'base64url')).session_id};
 };
 const list=u=>must(u,'account_sessions_list_v1');
 const fail=async(code,u,op,b={},k)=>{const r=await call(u,op,b,k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const denied=async user=>{const r=await call(user,'account_get_v1');assert.equal(r.result.ok,false);assert(['SESSION_REVOKED','AUTH_REQUIRED'].includes(r.result.error.code));};
 const refreshDenied=async user=>{const r=await fetch(env.API_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:user.refresh}),signal:AbortSignal.timeout(60000)});assert.equal(r.ok,false,'native refresh must not revive revoked session');};
 let secondary=await login(owner);
 try{
  await db.query('insert into private.p07_lifecycle_config values(true,300) on conflict(singleton) do update set reauth_max_age_seconds=excluded.reauth_max_age_seconds');
  await t.test('session listing is self-only; labels use live own session and optimistic versioned receipts',async()=>{
   const page=await list(owner);assert(page.items.some(s=>s.session_id===owner.session_id&&s.current));assert(page.items.some(s=>s.session_id===secondary.session_id&&!s.current));assert(!page.items.some(s=>s.session_id===other.session_id));
   for(const row of page.items){assert(!('ip' in row));assert(!('refresh_token' in row));assert(!('access_token' in row));}
   await fail('VALIDATION_FAILED',owner,'account_sessions_list_v1',{account_id:account.id});
   const body={session_id:secondary.session_id,expected_version:0,label:'Development laptop'},k=key(),result=await must(owner,'account_session_label_v1',body,k);assert.equal(result.version,1);assert((await must(owner,'account_session_label_v1',body,k)).replayed);
   assert.equal((await list(owner)).items.find(s=>s.session_id===secondary.session_id).label,body.label);
   await fail('VERSION_CONFLICT',owner,'account_session_label_v1',{...body,label:'Stale'},key());
   await fail('IDEMPOTENCY_PAYLOAD_MISMATCH',owner,'account_session_label_v1',{...body,label:'Different'},k);
   await fail('NOT_FOUND',other,'account_session_label_v1',body,key());
   await fail('VALIDATION_FAILED',owner,'account_session_label_v1',{session_id:secondary.session_id,expected_version:1,label:'  '},key());
   await must(owner,'account_session_label_v1',{session_id:secondary.session_id,expected_version:1,label:null},key());const current=(await list(owner)).items.find(s=>s.session_id===secondary.session_id);assert.equal(current.label,null);assert.equal(current.version,2);
   assert.equal((await must(other,'account_security_history_get_v1')).items.length,0);
  });
  await t.test('late security-event failure rolls back native session deletion, label cascade and receipt together',async()=>{
   trigger='session_history_'+key().replaceAll('-','');
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.account_id='${account.id}'::uuid then raise exception using errcode='23514',message='synthetic event failure';end if;return new;end$$`);
   await db.query(`create trigger ${trigger} before insert on private.account_security_events for each row execute function private.${trigger}()`);
   const k=key();await fail('INTEGRITY_VIOLATION',owner,'account_sessions_revoke_v1',{mode:'selected',session_id:secondary.session_id},k);
   assert((await list(owner)).items.some(s=>s.session_id===secondary.session_id));await must(secondary,'account_get_v1');
   assert.equal((await db.query('select count(*)::int n from core.operation_receipts where actor_account_id=$1 and operation=$2 and key_hash=$3',[account.id,'account_sessions_revoke_v1',createHash('sha256').update(k).digest('hex')])).rows[0].n,0);
   await db.query(`drop trigger ${trigger} on private.account_security_events`);await db.query(`drop function private.${trigger}()`);trigger=null;
   await fail('NOT_FOUND',owner,'account_sessions_revoke_v1',{mode:'selected',session_id:other.session_id},key());
   const body={mode:'selected',session_id:secondary.session_id},rk=key(),done=await must(owner,'account_sessions_revoke_v1',body,rk);assert.equal(done.affected_count,1);assert.equal(done.current_revoked,false);assert((await must(owner,'account_sessions_revoke_v1',body,rk)).replayed);
   await denied(secondary);await refreshDenied(secondary);await must(owner,'account_get_v1');await must(other,'account_get_v1');
  });
  await t.test('others requires native same-user fresh current proof and retains only that current session',async()=>{
   secondary=await login(owner);await fail('AUTH_REQUIRED',owner,'account_sessions_revoke_v1',{mode:'others',reauth:other.jwt},key());
   await fail('AUTH_REQUIRED',owner,'account_sessions_revoke_v1',{mode:'others',reauth:secondary.jwt},key());
   const created=(await db.query('select created_at from auth.sessions where id=$1',[owner.session_id])).rows[0].created_at;
   await db.query("update auth.sessions set created_at=now()-interval '10 minutes' where id=$1",[owner.session_id]);
   try{await fail('AUTH_REQUIRED',owner,'account_sessions_revoke_v1',{mode:'others',reauth:owner.jwt},key());}finally{await db.query('update auth.sessions set created_at=$2 where id=$1',[owner.session_id,created]);}
   const previous={...owner};Object.assign(owner,await login(owner));const k=key(),body={mode:'others',reauth:owner.jwt};const result=await must(owner,'account_sessions_revoke_v1',body,k);assert(result.affected_count>=2);assert.equal(result.current_revoked,false);assert((await must(owner,'account_sessions_revoke_v1',body,k)).replayed);
   const page=await list(owner);assert.equal(page.items.length,1);assert.equal(page.items[0].session_id,owner.session_id);await denied(previous);await denied(secondary);await refreshDenied(secondary);await must(other,'account_get_v1');
   const later=await login(owner);assert((await must(owner,'account_sessions_revoke_v1',{mode:'others',reauth:later.jwt},k)).replayed);await must(later,'account_get_v1');assert((await list(owner)).items.some(s=>s.session_id===later.session_id),'receipt replay must not revoke later sessions');await must(owner,'account_sessions_revoke_v1',{mode:'selected',session_id:later.session_id},key());
  });
  await t.test('own current sign-out cannot be revived, and bounded security history survives a fresh login',async()=>{
   const retired={...owner},result=await must(owner,'account_sessions_revoke_v1',{mode:'current'},key());assert.equal(result.current_revoked,true);assert.equal(result.affected_count,1);await denied(retired);await refreshDenied(retired);
   Object.assign(owner,await login(owner));const events=await must(owner,'account_security_history_get_v1');assert(events.items.some(e=>e.action==='session_revoked'&&e.session_id===retired.session_id));assert(events.items.some(e=>e.action==='other_sessions_revoked'));
   await fail('VALIDATION_FAILED',owner,'account_sessions_list_v1',{cursor:'00'});
   const ids=Array.from({length:55},key);
   await db.query(`insert into core.operation_receipts(id,actor_account_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) select id,$2::uuid,$2::uuid::text,'account_session_label_v1',id::text,'fixture','in_progress',now()+interval '1 day' from unnest($1::uuid[]) id`,[ids,account.id]);
   await db.query(`insert into private.account_security_events(id,account_id,operation_id,at,action,affected_count) select id,$2::uuid,id,now()-interval '1 day','other_sessions_revoked',0 from unnest($1::uuid[]) id`,[ids,account.id]);
   const a=await must(owner,'account_security_history_get_v1');assert.equal(a.items.length,50);assert(a.next_cursor);const b=await must(owner,'account_security_history_get_v1',{cursor:a.next_cursor});assert(b.items.length>0);assert.equal(b.next_cursor,null);assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,a.items.length+b.items.length);
   await fail('VALIDATION_FAILED',other,'account_security_history_get_v1',{cursor:a.next_cursor});await fail('VALIDATION_FAILED',owner,'account_sessions_list_v1',{cursor:a.next_cursor});
   // Supplemental provider-row pagination fixtures issue no JWT and impersonate nobody.
   const sessions=Array.from({length:51},randomUUID);await db.query("insert into auth.sessions(id,user_id,created_at,updated_at) select id,$2::uuid,now()-interval '1 day',now()-interval '1 day' from unnest($1::uuid[]) id",[sessions,owner.id]);
   try{const p=await list(owner);assert.equal(p.items.length,50);assert(p.next_cursor);const q=await must(owner,'account_sessions_list_v1',{cursor:p.next_cursor});assert.equal(q.items.length,2);assert.equal(q.next_cursor,null);assert.equal(new Set([...p.items,...q.items].map(x=>x.session_id)).size,52);await fail('VALIDATION_FAILED',other,'account_sessions_list_v1',{cursor:p.next_cursor});}finally{await db.query('delete from auth.sessions where id=any($1::uuid[])',[sessions]);}
  });
 }finally{
  if(trigger){await db.query(`drop trigger if exists ${trigger} on private.account_security_events`);await db.query(`drop function if exists private.${trigger}()`);}
  if(previousConfig.length)await db.query('update private.p07_lifecycle_config set reauth_max_age_seconds=$1 where singleton',[previousConfig[0].reauth_max_age_seconds]);else await db.query('delete from private.p07_lifecycle_config');
  await db.end();
 }
});
