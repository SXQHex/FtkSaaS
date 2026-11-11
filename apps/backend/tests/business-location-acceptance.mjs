import test,{resources} from './p07-diagnostics.mjs';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('S10 business location and website use explicit public fields and live scoped settings',async t=>{
 const guard=resources(t),{platform,plan}=await fixturePlatform(),owner=await authUser('business-location'),other=await authUser('business-location-other');
 const account=await must(owner,'account_get_v1');await must(other,'account_get_v1');
 const db=await guard.connect(context().env.DB_URL);
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Location acceptance',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Location center',timezone:'UTC'},key())).primary_id;
 const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await must(owner,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:person},key());
 const paid=(await must(owner,'saas_payment_submit_v1',{org_id:org,center_id:center,amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()},key())).primary_id;
 await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:paid,accepted:true},key());
 const oq={scope:'organization',org_id:org},cq={scope:'center',org_id:org,center_id:center};
 const read=q=>must(owner,'settings_get_v1',q);
 const write=async(q,patch,k=key())=>must(owner,'settings_update_v1',{...q,expected_version:(await read(q)).version,patch},k);
 const request={slug:org,center_id:center,interval:{starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+86400000).toISOString()},page:{}};
 const publicRead=()=>must({jwt:context().env.ANON_KEY},'public_calendar_get_v1',request);
 await t.test('private values are versioned and not published until both profile gates and explicit fields open',async()=>{
  const patch={map_url:'https://maps.example.invalid/location',directions:'İkinci kat; sağdaki giriş.',website_url:'https://studio.example.invalid/'};
  const version=(await read(cq)).version,k=key(),body={...cq,expected_version:version,patch};
  await must(owner,'settings_update_v1',body,k);assert.equal((await must(owner,'settings_update_v1',body,k)).replayed,true);
  for(const [name,value] of Object.entries(patch))assert.equal((await read(cq)).values[name],value);
  assert.equal((await publicRead()).center_profile,null);
  await write(oq,{public_profile_enabled:true,public_fields:['name']});await write(cq,{public_profile_enabled:true,public_fields:['name']});
  const hidden=(await publicRead()).center_profile;assert.equal('location' in hidden,false);assert.equal('website_url' in hidden,false);
  await write(cq,{public_fields:['name','location','website']});const shown=(await publicRead()).center_profile;
  assert.deepEqual(shown.location,{map_url:patch.map_url,directions:patch.directions});assert.equal(shown.website_url,patch.website_url);
  await write(oq,{public_profile_enabled:false});assert.equal((await publicRead()).center_profile,null);
 });
 await t.test('unsafe link schemes and credentials are rejected; reset and other-account access retain existing boundaries',async()=>{
  for(const value of ['https://example.org:65536/','https://example.org:99999/','https://256.256.256.256/','https://[::1]/','https://example.org\\path','javascript:alert(1)','http://studio.example.invalid','https://name:secret@example.invalid/','https://example.invalid/\nwrong']){
   const x=await call(owner,'settings_update_v1',{...cq,expected_version:(await read(cq)).version,patch:{map_url:value}},key());assert.equal(x.result.ok,false);assert.equal(x.result.error.code,'VALIDATION_FAILED');
  }
  const x=await call(other,'settings_get_v1',cq);assert.equal(x.result.ok,false);assert.equal(x.result.error.code,'NOT_FOUND');
  const preview=await must(owner,'settings_reset_preview_v1',{...cq,fields:['map_url','website_url','directions']});
  await must(owner,'settings_reset_apply_v1',{...cq,expected_version:preview.version,preview:{id:preview.id,token:preview.token}},key());
  const after=await read(cq);assert.equal(after.values.map_url,null);assert.equal(after.values.website_url,null);assert.equal(after.values.directions,'');
  assert.equal(after.values.public_profile_enabled,true);
 });
});
