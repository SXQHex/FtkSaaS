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

// Independent color lifecycle fixture keeps the established per-test timeout unchanged.
test('Organization brand color lifecycle acceptance',async t=>{
 const guard=resources(t),{platform,plan}=await fixturePlatform();
 const owner=await authUser('brand-colors-owner'),account=await must(owner,'account_get_v1');
 const db=await guard.connect(context().env.DB_URL);
 const read=(u,q)=>must(u,'settings_get_v1',q);
 const write=(u,q,patch,version,k=key())=>must(u,'settings_update_v1',{...q,patch,expected_version:version},k);
 const fail=async(code,u,op,b,k)=>{const x=await call(u,op,b,k);assert.equal(x.result.ok,false,JSON.stringify(x.result));assert.equal(x.result.error.code,code,JSON.stringify(x.result));};
 try{
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Brand colors acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Brand colors center',timezone:'UTC'},key())).primary_id;
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
  const payment=(await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()},key())).primary_id;
  await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:payment,accepted:true},key());
   const q={scope:'organization',org_id:org},fields=['primary_color','secondary_color','accent_color'];
   const initial=await read(owner,q);for(const f of fields)assert.equal(initial.values[f],null);
   assert.equal(initial.values.theme_package_id,null);assert.equal(initial.values.font_package_id,null);
   const patch={primary_color:'#12aBcF',secondary_color:'#000000',accent_color:'#FFFFFF'};
   const saved=await write(owner,q,patch,initial.version);assert.equal(saved.version,initial.version+1);
   // Continue the same color lifecycle as an explicitly assigned OM after ownership transfer.
   await must(owner,'org_manager_assign_v1',{org_id:org,person_id:person},key());
   const successor=await authUser('brand-colors-successor'),successorAccount=await must(successor,'account_get_v1');
   await must(platform,'platform_owner_set_v1',{org_id:org,verified_account_id:successorAccount.id,reason:'Synthetic brand color OM acceptance'},key());
   const current=await read(owner,q);for(const f of fields)assert.equal(current.values[f],patch[f]);
   await fail('VERSION_CONFLICT',owner,'settings_update_v1',{...q,patch:{primary_color:null},expected_version:initial.version},key());
   for(const value of ['red','#fff','#12345678',' #123456','#12345G','',123])await fail('VALIDATION_FAILED',owner,'settings_update_v1',{...q,patch:{primary_color:value},expected_version:current.version},key());
   await fail('VALIDATION_FAILED',owner,'settings_update_v1',{scope:'center',org_id:org,center_id:center,patch:{primary_color:'#123456'},expected_version:0},key());
   const history=await must(owner,'settings_history_get_v1',q);assert(history.items.some(h=>h.after.primary_color==='#12aBcF'));
   const cleared=await write(owner,q,{primary_color:null},current.version);assert.equal((await read(owner,q)).values.primary_color,null);
   const preview=await must(owner,'settings_reset_preview_v1',{...q,fields:['secondary_color','accent_color']});
   await must(owner,'settings_reset_apply_v1',{...q,expected_version:preview.version,preview:{id:preview.id,token:preview.token}},key());
   const reset=await read(owner,q);for(const f of fields)assert.equal(reset.values[f],null);
   const catalog=await must(owner,'settings_catalog_get_v1',q);assert.equal(catalog.catalog_version,settingsCatalogVersion);for(const f of fields)assert(catalog.fields.some(x=>x.key===f&&x.writable));
   assert(catalog.fields.some(x=>x.key==='font_package_id'&&!x.writable));assert(catalog.fields.some(x=>x.key==='theme_package_id'&&!x.writable));

 }finally{await db.end();}
});
