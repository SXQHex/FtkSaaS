import test,{resources} from '../../p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call,context} from '../../api-client.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';

const settingsCatalogVersion=JSON.parse(fs.readFileSync('config/frontend-settings.json','utf8')).version;
async function settingsFixture(t){
 const guard=resources(t),{platform,plan}=await fixturePlatform();
 const owner=await authUser('settings-owner'),other=await authUser('settings-other');
 const account=await must(owner,'account_get_v1');await must(other,'account_get_v1');
 const db=await guard.connect(context().env.DB_URL);
 const read=(u,q)=>must(u,'settings_get_v1',q);
 const write=(u,q,patch,version,k=key())=>must(u,'settings_update_v1',{...q,patch,expected_version:version},k);
 const fail=async(code,u,op,b,k)=>{const x=await call(u,op,b,k);assert.equal(x.result.ok,false,JSON.stringify(x.result));assert.equal(x.result.error.code,code,JSON.stringify(x.result));};
 return {platform,plan,owner,other,account,db,read,write,fail};
}

async function settingsTenant({platform,plan,owner,account,db}){
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Settings acceptance',initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Settings center',timezone:'UTC'},key())).primary_id;
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
  const payment=(await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()},key())).primary_id;
  await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment,accepted:true},key());
 return {org,center,person};
}

test('User settings concurrency, reset and history',async t=>{
 const fixture=await settingsFixture(t);
 const {platform,plan,owner,other,account,db,read,write,fail}=fixture;
 let trigger;
 try{
 const {org,center,person}=await settingsTenant(fixture);
  await t.test('user data is global and self-only; strict keys and live versions protect retries',async()=>{
   const v=await read(owner,{scope:'user'});assert.equal(v.values.theme,'system');assert.equal(v.values.language,'auto');assert.equal(v.version,0);assert.equal(v.values.font_scale,null);assert.equal(v.values.startup_context,null);
   const k=key(),patch={theme:'dark',honorific:'Teacher'};const saved=await write(owner,{scope:'user'},patch,v.version,k);
   assert.equal(saved.version,1);assert.equal((await write(owner,{scope:'user'},patch,v.version,k)).replayed,true);
   assert.equal((await read(other,{scope:'user'})).values.theme,'system');
   await fail('VERSION_CONFLICT',owner,'settings_update_v1',{scope:'user',patch,expected_version:0},key());
   await fail('IDEMPOTENCY_PAYLOAD_MISMATCH',owner,'settings_update_v1',{scope:'user',patch:{theme:'light'},expected_version:0},k);
   for(const patch of [{actor_role:'owner'},{negative_limit:-9},{in_app_reminders:false},{timezone_name:'Invalid/Zone'}])await fail('VALIDATION_FAILED',owner,'settings_update_v1',{scope:'user',patch,expected_version:1},key());
   await fail('VALIDATION_FAILED',owner,'settings_get_v1',{scope:'user',account_id:(await must(other,'account_get_v1')).id});
  });
  await t.test('concurrent writers have one version winner; history failure rolls back the receipt and values',async()=>{
   const v=await read(owner,{scope:'user'});
   const results=await Promise.all(['light','system'].map(theme=>call(owner,'settings_update_v1',{scope:'user',patch:{theme},expected_version:v.version},key())));
   assert.equal(results.filter(r=>r.result.ok).length,1);assert.equal(results.find(r=>!r.result.ok).result.error.code,'VERSION_CONFLICT');
   const before=await read(owner,{scope:'user'}),history=await must(owner,'settings_history_get_v1',{scope:'user'});
   trigger='settings_failure_'+key().replaceAll('-','');
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.actor_account_id='${account.id}'::uuid then raise exception using errcode='23514',message='synthetic history failure';end if;return new;end$$`);
   await db.query(`create trigger ${trigger} before insert on private.frontend_settings_history for each row execute function private.${trigger}()`);
   const k=key();await fail('INTEGRITY_VIOLATION',owner,'settings_update_v1',{scope:'user',expected_version:before.version,patch:{honorific:'Rollback'}},k);
   const after=await read(owner,{scope:'user'});assert.equal(after.version,before.version);assert.deepEqual(after.values,before.values);
   assert.deepEqual((await must(owner,'settings_history_get_v1',{scope:'user'})).items,history.items);
   const receipt=await db.query("select count(*)::int n from core.operation_receipts where actor_account_id=$1 and operation='settings_update_v1' and key_hash=encode(extensions.digest($2,'sha256'),'hex')",[account.id,k]);assert.equal(receipt.rows[0].n,0);
   await db.query(`drop trigger ${trigger} on private.frontend_settings_history`);await db.query(`drop function private.${trigger}()`);trigger=null;
  });
  await t.test('reset is actor-bound, version-bound, explicit and never reopens disabled privacy choices',async()=>{
   let v=await read(owner,{scope:'user'});await write(owner,{scope:'user'},{theme:'dark',ad_measurement:false},v.version);
   let p=await must(owner,'settings_reset_preview_v1',{scope:'user',fields:['theme','ad_measurement']});assert.equal(p.after.theme,'system');assert.equal(p.after.ad_measurement,false);
   await fail('PREVIEW_STALE',other,'settings_reset_apply_v1',{scope:'user',expected_version:0,preview:{id:p.id,token:p.token}},key());
   v=await read(owner,{scope:'user'});await write(owner,{scope:'user'},{honorific:'Changed after preview'},v.version);
   v=await read(owner,{scope:'user'});await fail('PREVIEW_STALE',owner,'settings_reset_apply_v1',{scope:'user',expected_version:v.version,preview:{id:p.id,token:p.token}},key());
   p=await must(owner,'settings_reset_preview_v1',{scope:'user',fields:['theme','ad_measurement']});
   await must(owner,'settings_reset_apply_v1',{scope:'user',expected_version:p.version,preview:{id:p.id,token:p.token}},key());
   const after=await read(owner,{scope:'user'});assert.equal(after.values.theme,'system');assert.equal(after.values.ad_measurement,false);assert.equal(after.values.honorific,'Changed after preview');
   await fail('VALIDATION_FAILED',owner,'settings_reset_preview_v1',{scope:'user',fields:['debt','theme']});
  });
  await t.test('history pagination is stable, complete and bound to the current actor and scope',async()=>{
   const ids=Array.from({length:55},key);
   await db.query(`insert into core.operation_receipts(id,actor_account_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at)
    select id,$2::uuid,$2::uuid::text,'settings_update_v1',id::text,'fixture','in_progress',now()+interval '1 day' from unnest($1::uuid[]) id`,[ids,account.id]);
   await db.query(`insert into private.frontend_settings_history(id,scope_key,actor_account_id,at,before_values,after_values,reason,operation_id)
    select id,'user:'||$2::uuid::text,$2::uuid,now()-interval '1 day','{}','{}','synthetic pagination',id from unnest($1::uuid[]) id`,[ids,account.id]);
   const a=await must(owner,'settings_history_get_v1',{scope:'user'});assert.equal(a.items.length,50);assert(a.next_cursor);
   const b=await must(owner,'settings_history_get_v1',{scope:'user',cursor:a.next_cursor});assert(b.items.length>0);assert.equal(b.next_cursor,null);
   assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,a.items.length+b.items.length);
   await fail('VALIDATION_FAILED',other,'settings_history_get_v1',{scope:'user',cursor:a.next_cursor});
   await fail('VALIDATION_FAILED',owner,'settings_history_get_v1',{scope:'member',org_id:org,cursor:a.next_cursor});
  });
 }finally{if(trigger){await db.query(`drop trigger if exists ${trigger} on private.frontend_settings_history`);await db.query(`drop function if exists private.${trigger}()`);}await db.end();}
});



// No timeout increase or assertion removal; each group owns independent Auth/organization fixtures.

// Independent color lifecycle fixture keeps the established per-test timeout unchanged.
