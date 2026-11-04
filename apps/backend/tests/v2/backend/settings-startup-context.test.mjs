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




// No timeout increase or assertion removal; each group owns independent Auth/organization fixtures.
test('User appearance and startup context through independent native account fixtures',async t=>{
 const guard=resources(t),{platform,plan}=await fixturePlatform();
 const owner=await authUser('startup-settings-owner'),other=await authUser('startup-settings-other');
 const account=await must(owner,'account_get_v1');await must(other,'account_get_v1');
 const db=await guard.connect(context().env.DB_URL);
 const read=(u,q)=>must(u,'settings_get_v1',q);
 const write=(u,q,patch,version,k=key())=>must(u,'settings_update_v1',{...q,patch,expected_version:version},k);
 const fail=async(code,u,op,b,k)=>{const x=await call(u,op,b,k);assert.equal(x.result.ok,false,JSON.stringify(x.result));assert.equal(x.result.error.code,code,JSON.stringify(x.result));};
 try{
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Startup settings acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Startup settings center',timezone:'UTC'},key())).primary_id;
 const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
 const payment=(await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()},key())).primary_id;
 await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment,accepted:true},key());
  await t.test('font scale and fixed startup context remain self-only, live and independent of permissions and privacy',async()=>{
   const q={scope:'user'},discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Startup discipline',state:'active'},key())).primary_id;
   await must(owner,'center_discipline_set_v1',{org_id:org,center_id:center,discipline_id:discipline,state:'active'},key());
   const fixed={org_id:org,center_id:center,discipline_id:discipline};let v=await read(owner,q),k=key();
   for(const invalidPatch of [{font_scale:0.74},{font_scale:2.01},{font_scale:'large'},{startup_context:{}},{startup_context:{org_id:key(),center_id:null,discipline_id:null,actor:'owner'}}])await fail('VALIDATION_FAILED',owner,'settings_update_v1',{...q,expected_version:v.version,patch:invalidPatch},key());
   const patch={font_scale:1.25,remember_context:false,startup_context:fixed,ad_measurement:false};await write(owner,q,patch,v.version,k);
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
 }finally{await db.end();}
});

// Independent color lifecycle fixture keeps the established per-test timeout unchanged.
