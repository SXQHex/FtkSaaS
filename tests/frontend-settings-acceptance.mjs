import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Frontend settings scoped persistence, live authority, reset and delivery preferences',async t=>{
 const guard=resources(t),{platform,plan}=await fixturePlatform();
 const owner=await authUser('settings-owner'),other=await authUser('settings-other');
 const account=await must(owner,'account_get_v1');await must(other,'account_get_v1');
 const db=await guard.connect(context().env.DB_URL);
 const read=(u,q)=>must(u,'settings_get_v1',q);
 const write=(u,q,patch,version,k=key())=>must(u,'settings_update_v1',{...q,patch,expected_version:version},k);
 const fail=async(code,u,op,b,k)=>{const x=await call(u,op,b,k);assert.equal(x.result.ok,false,JSON.stringify(x.result));assert.equal(x.result.error.code,code,JSON.stringify(x.result));};
 let trigger;
 try{
  await t.test('user data is global and self-only; strict keys and live versions protect retries',async()=>{
   const v=await read(owner,{scope:'user'});assert.equal(v.values.theme,'system');assert.equal(v.values.language,'auto');assert.equal(v.version,0);assert.equal(v.values.font_scale,null);assert.equal(v.values.startup_context,null);
   const k=key(),patch={theme:'dark',honorific:'Teacher'};const saved=await write(owner,{scope:'user'},patch,v.version,k);
   assert.equal(saved.version,1);assert.equal((await write(owner,{scope:'user'},patch,v.version,k)).replayed,true);
   assert.equal((await read(other,{scope:'user'})).values.theme,'system');
   await fail('VERSION_CONFLICT',owner,'settings_update_v1',{scope:'user',patch,expected_version:0},key());
   await fail('IDEMPOTENCY_PAYLOAD_MISMATCH',owner,'settings_update_v1',{scope:'user',patch:{theme:'light'},expected_version:0},k);
   for(const patch of [{actor_role:'owner'},{negative_limit:-9},{in_app_reminders:false},{timezone_name:'Invalid/Zone'},{font_scale:0.74},{font_scale:2.01},{font_scale:'large'},{startup_context:{}},{startup_context:{org_id:key(),center_id:null,discipline_id:null,actor:'owner'}}])await fail('VALIDATION_FAILED',owner,'settings_update_v1',{scope:'user',patch,expected_version:1},key());
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
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Settings acceptance',initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Settings center',timezone:'UTC'},key())).primary_id;
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
  const payment=(await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()},key())).primary_id;
  await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment,accepted:true},key());
  await t.test('font scale and fixed startup context remain self-only, live and independent of permissions and privacy',async()=>{
   const q={scope:'user'},discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Startup discipline',state:'active'},key())).primary_id;
   await must(owner,'center_discipline_set_v1',{org_id:org,center_id:center,discipline_id:discipline,state:'active'},key());
   const fixed={org_id:org,center_id:center,discipline_id:discipline};let v=await read(owner,q),k=key();
   const patch={font_scale:1.25,remember_context:false,startup_context:fixed};await write(owner,q,patch,v.version,k);
   assert((await write(owner,q,patch,v.version,k)).replayed);let current=await read(owner,q);assert.deepEqual(current.values.startup_context,fixed);assert.equal(current.values.font_scale,1.25);
   await fail('NOT_FOUND',other,'settings_update_v1',{...q,expected_version:0,patch:{startup_context:fixed}},key());
   for(const invalid of [{org_id:key(),center_id:null,discipline_id:null},{org_id:org,center_id:key(),discipline_id:null},{org_id:org,center_id:null,discipline_id:discipline},{org_id:org,center_id:center,discipline_id:key()}])await fail('NOT_FOUND',owner,'settings_update_v1',{...q,expected_version:current.version,patch:{startup_context:invalid}},key());
   const preview=await must(owner,'settings_reset_preview_v1',{...q,fields:['font_scale']});assert.equal(preview.after.font_scale,null);assert.deepEqual(preview.after.startup_context,fixed);
   await must(owner,'settings_reset_apply_v1',{...q,expected_version:preview.version,preview:{id:preview.id,token:preview.token}},key());current=await read(owner,q);assert.equal(current.values.font_scale,null);assert.equal(current.values.ad_measurement,false);assert.deepEqual(current.values.startup_context,fixed);assert.equal(current.values.remember_context,false);
   // No mutation of any domain roles/plan follows from choosing a startup context.
   const memberUser=await authUser('settings-startup-member'),otherAccount=await must(memberUser,'account_get_v1');const member=(await must(owner,'person_create_v1',{org_id:org,center_id:center,display_name:'Startup member',contacts:[]},key())).primary_id;
   await must(owner,'student_activate_v1',{org_id:org,center_id:center,person_id:member},key());
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,otherAccount.id,member]);
   const own=await read(memberUser,q),memberKey=key(),memberPatch={startup_context:fixed};await write(memberUser,q,memberPatch,own.version,memberKey);assert.deepEqual((await read(memberUser,q)).values.startup_context,fixed);
   await fail('FORBIDDEN',memberUser,'settings_get_v1',{scope:'center',org_id:org,center_id:center});
   await db.query("update core.center_relationships set state='inactive' where org_id=$1 and center_id=$2 and person_id=$3",[org,center,member]);
   try{assert.equal((await read(memberUser,q)).values.startup_context,null);await fail('NOT_FOUND',memberUser,'settings_update_v1',{...q,expected_version:own.version,patch:memberPatch},memberKey);}
   finally{await db.query("update core.center_relationships set state='active' where org_id=$1 and center_id=$2 and person_id=$3",[org,center,member]);}
   await db.query("update core.organizations set state='closed' where id=$1",[org]);try{assert.equal((await read(owner,q)).values.startup_context,null);}finally{await db.query("update core.organizations set state='active' where id=$1",[org]);}
   const reset=await must(owner,'settings_reset_preview_v1',{...q,fields:['startup_context']});await must(owner,'settings_reset_apply_v1',{...q,expected_version:reset.version,preview:{id:reset.id,token:reset.token}},key());assert.equal((await read(owner,q)).values.startup_context,null);
  });
  await t.test('Owner-only field authority is rechecked before update and reset receipt replay',async()=>{
   const successor=await authUser('settings-successor'),successorAccount=await must(successor,'account_get_v1');
   await must(owner,'org_manager_assign_v1',{org_id:org,person_id:person},key());
   const q={scope:'organization',org_id:org},v=await read(owner,q),updateKey=key();
   const updateBody={...q,expected_version:v.version,patch:{billing_name:'Original billing'}};
   await must(owner,'settings_update_v1',updateBody,updateKey);
   const p=await must(owner,'settings_reset_preview_v1',{...q,fields:['billing_name']}),resetKey=key();
   const resetBody={...q,expected_version:p.version,preview:{id:p.id,token:p.token}};
   await must(owner,'settings_reset_apply_v1',resetBody,resetKey);
   // A legitimate reset retry still works after preview expiry/application.
   await db.query("update private.frontend_settings_previews set expires_at=now()-interval '1 minute' where id=$1",[p.id]);
   assert.equal((await must(owner,'settings_reset_apply_v1',resetBody,resetKey)).replayed,true);
   await must(platform,'platform_owner_set_v1',{org_id:org,verified_account_id:successorAccount.id,reason:'Synthetic ownership transfer'},key());
   try{
    await fail('FORBIDDEN',owner,'settings_update_v1',updateBody,updateKey);
    await fail('FORBIDDEN',owner,'settings_reset_apply_v1',resetBody,resetKey);
    await fail('FORBIDDEN',owner,'settings_reset_preview_v1',{...q,fields:['billing_name']});
    const current=await read(owner,q);await write(owner,q,{description:'Still an organization manager'},current.version);
   }finally{await must(platform,'platform_owner_set_v1',{org_id:org,verified_account_id:account.id,reason:'Restore synthetic owner'},key());}
  });
  await t.test('member, center, organization and platform scopes are separate; role revocation also denies replay',async()=>{
   for(const [scope,patch] of [['member',{profile_visible:true}],['organization',{description:'Organization description'}],['center',{description:'Center description'}]]){
    const q={scope,org_id:org,...scope==='center'?{center_id:center}:{}};const v=await read(owner,q);if(scope==='member')assert.equal(v.values.in_app_reminders,true);await write(owner,q,patch,v.version);assert.equal((await read(owner,q)).values[Object.keys(patch)[0]],Object.values(patch)[0]);
   }
   await fail('NOT_FOUND',other,'settings_get_v1',{scope:'member',org_id:org});
   await fail('FORBIDDEN',owner,'settings_get_v1',{scope:'platform'});
   const c=await must(platform,'settings_catalog_get_v1',{scope:'platform'});assert(c.fields.some(f=>f.key==='application_name'));assert.deepEqual(c.brand_packages,[]);
   const k=key(),b={scope:'platform',expected_version:0,patch:{support_url:'https://ftksaas.invalid/support'}};
   await must(platform,'settings_update_v1',b,k);await db.query('delete from private.platform_operators where auth_user_id=$1',[platform.id]);
   await fail('FORBIDDEN',platform,'settings_update_v1',b,k);
  });
  await t.test('closed subscription cannot block own preference withdrawal or authorize organization operations',async()=>{
   await db.query("update core.organizations set state='closed' where id=$1",[org]);
   try{
    const q={scope:'member',org_id:org},v=await read(owner,q);await write(owner,q,{in_app_marketing:false},v.version);
    await fail('SERVICE_UNAVAILABLE',owner,'settings_get_v1',{scope:'organization',org_id:org});
   }finally{await db.query("update core.organizations set state='active' where id=$1",[org]);}
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
  await t.test('legacy and new notification preferences share delivery behavior and stale detection',async()=>{
   const q={scope:'member',org_id:org};let v=await read(owner,q);
   await write(owner,q,{in_app_reminders:false},v.version);assert.equal((await db.query("select private.p05_optional_allowed($1,$2,'reminder') a",[org,person])).rows[0].a,false);
   await must(owner,'notification_preferences_set_v1',{org_id:org,center_id:null,purpose:'reminder',channel:'in_app',enabled:true,expected_version:1},key());
   const current=await read(owner,q);assert.equal(current.values.in_app_reminders,true);assert(current.version>v.version);
   await fail('VERSION_CONFLICT',owner,'settings_update_v1',{...q,patch:{in_app_reminders:false},expected_version:v.version},key());
   await write(owner,q,{in_app_reminders:false},current.version);assert.equal((await db.query("select private.p05_optional_allowed($1,$2,'reminder') a",[org,person])).rows[0].a,false);
   await fail('VALIDATION_FAILED',owner,'settings_update_v1',{...q,patch:{transactional:false},expected_version:(await read(owner,q)).version},key());
   await fail('NOT_FOUND',owner,'settings_update_v1',{...q,patch:{interest_center_ids:[key()]},expected_version:(await read(owner,q)).version},key());
  });
  await t.test('all declared fields in five scopes round-trip through real typed APIs; unsupported branding cannot fake success',async()=>{
   const fields=JSON.parse(fs.readFileSync('config/frontend-settings.json','utf8')).fields;
   const operator=await authUser('settings-field-operator');await must(operator,'account_get_v1');
   await db.query('insert into private.platform_operators(auth_user_id) values($1)',[operator.id]);
   try{
    for(const scope of ['user','member','center','organization','platform']){
     const actor=scope==='platform'?operator:owner,q={scope,...['member','center','organization'].includes(scope)?{org_id:org}:{},...scope==='center'?{center_id:center}:{}};
     const catalog=await must(actor,'settings_catalog_get_v1',q),expected=fields.filter(f=>f.scope===scope);
     assert.deepEqual(catalog.fields.map(f=>f.key).sort(),expected.map(f=>f.key).sort());
     const patch=Object.fromEntries(expected.filter(f=>f.schema.type!=='null').map(f=>[f.key,f.default]));
     if(scope==='user'){patch.theme='dark';patch.language='en';patch.timezone_mode='manual';patch.timezone_name='Europe/Istanbul';}
     if(scope==='member'){patch.profile_visible=true;patch.interest_center_ids=[center];}
     if(scope==='center'||scope==='organization')patch.description='Synthetic field acceptance';
     let before=await read(actor,q);const operationKey=key();await write(actor,q,patch,before.version,operationKey);
     assert((await write(actor,q,patch,before.version,operationKey)).replayed);
     const after=await read(actor,q);for(const [name,value] of Object.entries(patch))assert.deepEqual(after.values[name],value,scope+'.'+name);
     for(const field of expected.filter(f=>f.schema.type==='null'))await fail('SERVICE_UNAVAILABLE',actor,'settings_update_v1',{...q,expected_version:after.version,patch:{[field.key]:null}},key());
    }
   }finally{await db.query('delete from private.platform_operators where auth_user_id=$1',[operator.id]);}
  });
 }finally{if(trigger){await db.query(`drop trigger if exists ${trigger} on private.frontend_settings_history`);await db.query(`drop function if exists private.${trigger}()`);}await db.end();}
});
