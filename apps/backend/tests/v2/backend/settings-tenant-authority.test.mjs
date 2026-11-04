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


test('Tenant settings authority, privacy and notification delivery',async t=>{
 const fixture=await settingsFixture(t);
 const {platform,plan,owner,other,account,db,read,write,fail}=fixture;
 let trigger;
 try{
 const {org,center,person}=await settingsTenant(fixture);
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
 }finally{if(trigger){await db.query(`drop trigger if exists ${trigger} on private.frontend_settings_history`);await db.query(`drop function if exists private.${trigger}()`);}await db.end();}
});

test('Typed settings catalog round-trip in every scope',async t=>{
 const fixture=await settingsFixture(t);
 const {platform,plan,owner,other,account,db,read,write,fail}=fixture;
 let trigger;
 try{
 const {org,center,person}=await settingsTenant(fixture);
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

// No timeout increase or assertion removal; each group owns independent Auth/organization fixtures.

// Independent color lifecycle fixture keeps the established per-test timeout unchanged.
