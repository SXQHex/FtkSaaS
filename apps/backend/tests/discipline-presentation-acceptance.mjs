import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('S10 discipline presentation preserves identity and fences local and public metadata',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('discipline-owner'),manager=await authUser('discipline-manager'),outsider=await authUser('discipline-outsider');
 const account=await must(owner,'account_get_v1'),managerAccount=await must(manager,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Discipline presentation',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Presentation center',timezone:'UTC'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Other center',timezone:'UTC'},key())).primary_id;
 const db=await connect(),scope={org_id:org,center_id:center};
 const write=(user,op,b={},k=key())=>must(user,op,{...scope,...b},k);
 const fail=async(user,op,b,code)=>{const x=await call(user,op,{...scope,...b},key());assert.equal(x.result.ok,false);assert.equal(x.result.error.code,code);};
 const list=(extra={})=>must(owner,'disciplines_list_v1',{org_id:org,page:{},...extra});
 const save=(b,k=key())=>must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active',...b},k);
 let discipline,second;const localKey=key();
 try{
  const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await write(owner,'center_manager_assign_v1',{person_id:ownerPerson});
  const payment=await write(owner,'saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic discipline presentation',occurred_at:new Date().toISOString()});
  await write(platform,'saas_payment_verify_v1',{payment_id:payment.primary_id,accepted:true});
  const person=(await write(owner,'person_create_v1',{display_name:'Presentation manager',contacts:[]})).primary_id;
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,managerAccount.id,person]);
  await write(owner,'center_manager_assign_v1',{person_id:person});
  await t.test('legacy shape stays unchanged; explicit metadata is versioned and partial writes preserve it',async()=>{
   discipline=(await save({})).primary_id;
   assert.deepEqual(Object.keys((await list()).items[0]).sort(),['id','name','state','version']);
   const initial=(await list({include_presentation:true})).items[0].presentation;
   assert.deepEqual(initial.organization,{description:null,color:null,icon:null,display_order:0,public_visible:false,allow_center_description:false});assert.equal(initial.center,null);
   const b={discipline_id:discipline,expected_version:1,presentation:{description:'Organization description',color:'#123aBc',icon:'music',display_order:2,public_visible:true}},k=key();
   assert.equal((await save(b,k)).version,2);assert.equal((await save(b,k)).replayed,true);
   await save({discipline_id:discipline,expected_version:2,presentation:{icon:null}});
   const read=(await list({include_presentation:true})).items[0];assert.equal(read.version,3);assert.equal(read.presentation.organization.color,'#123aBc');assert.equal(read.presentation.organization.icon,null);
   await fail(owner,'discipline_save_v1',{center_id:undefined,name:'Stale',state:'active',discipline_id:discipline,expected_version:1,presentation:{color:null}},'VERSION_CONFLICT');
   assert.equal((await list({include_presentation:true})).items[0].presentation.organization.color,'#123aBc');
  });
  await t.test('local description requires organization permission and never grants organization or other-center writes',async()=>{
   await write(owner,'center_discipline_set_v1',{discipline_id:discipline,state:'active'});
   await fail(manager,'center_discipline_set_v1',{discipline_id:discipline,state:'active',expected_version:1,presentation:{description:'Blocked'}},'FORBIDDEN');
   const local=()=>list({center_id:center,include_presentation:true});assert.equal((await local()).items[0].presentation.center.version,1);
   await save({discipline_id:discipline,expected_version:3,presentation:{allow_center_description:true}});
   await write(manager,'center_discipline_set_v1',{discipline_id:discipline,state:'active',expected_version:1,presentation:{description:'Local description',public_visible:true}},localKey);
   const view=(await local()).items[0];assert.equal(view.presentation.center.version,2);assert.equal(view.presentation.center.presentation.description,'Local description');assert.equal(view.name,'Salsa');
   await fail(manager,'discipline_save_v1',{center_id:undefined,name:'Unauthorized rename',state:'active',discipline_id:discipline,expected_version:4,presentation:{public_visible:false}},'FORBIDDEN');
   await fail(manager,'center_discipline_set_v1',{center_id:other,discipline_id:discipline,state:'active',presentation:{public_visible:true}},'FORBIDDEN');
   await fail(manager,'disciplines_list_v1',{center_id:other,include_presentation:true,page:{}},'FORBIDDEN');
   await fail(outsider,'disciplines_list_v1',{include_presentation:true,page:{}},'NOT_FOUND');
  });
  await t.test('public projection requires explicit request, organization gate and both visibility choices',async()=>{
   const settings=async(scopeName,patch)=>{const q={org_id:org,scope:scopeName,...(scopeName==='center'?{center_id:center}:{})};const v=await must(owner,'settings_get_v1',q);await must(owner,'settings_update_v1',{...q,expected_version:v.version,patch},key());};
   const anon={jwt:context().env.ANON_KEY},r={slug:org,center_id:center,interval:{starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+86400000).toISOString()},page:{}};
   const publicRead=(extra={})=>must(anon,'public_calendar_get_v1',{...r,...extra});
   assert.equal((await publicRead({include_disciplines:true})).organization_profile,null);
   await settings('organization',{public_profile_enabled:true,public_fields:['name']});await settings('center',{public_profile_enabled:true,public_fields:['name']});
   assert.equal('disciplines' in (await publicRead()).organization_profile,false);
   let out=await publicRead({include_disciplines:true});assert.equal(out.organization_profile.disciplines[0].description,'Organization description');assert.equal(out.center_profile.disciplines[0].description,'Local description');
   assert.deepEqual(Object.keys(out.center_profile.disciplines[0]).sort(),['id','name','description','color','icon','display_order'].sort());
   await save({discipline_id:discipline,expected_version:4,presentation:{allow_center_description:false}});
   const replay=await call(manager,'center_discipline_set_v1',{...scope,discipline_id:discipline,state:'active',expected_version:1,presentation:{description:'Local description',public_visible:true}},localKey);
   assert.equal(replay.result.error?.code,'FORBIDDEN');
   out=await publicRead({include_disciplines:true});assert.equal(out.center_profile.disciplines[0].description,'Organization description');
   second=(await save({name:'Tango',presentation:{display_order:1,public_visible:true}})).primary_id;
   out=await publicRead({include_disciplines:true});assert.deepEqual(out.organization_profile.disciplines.map(x=>x.id),[second,discipline]);assert.deepEqual(out.center_profile.disciplines.map(x=>x.id),[discipline]);
   await write(manager,'center_discipline_set_v1',{discipline_id:discipline,state:'active',expected_version:2,presentation:{public_visible:false}});
   assert.deepEqual((await publicRead({include_disciplines:true})).center_profile.disciplines,[]);
   await save({discipline_id:discipline,expected_version:5,presentation:{public_visible:false}});
   assert.deepEqual((await publicRead({include_disciplines:true})).organization_profile.disciplines.map(x=>x.id),[second]);
   await settings('organization',{public_profile_enabled:false});out=await publicRead({include_disciplines:true});assert.equal(out.organization_profile,null);assert.equal(out.center_profile,null);
  });
  await t.test('late audit failure rolls back both presentation and the original versioned command',async()=>{
   const before=(await db.query('select name,version,presentation from core.disciplines where id=$1',[discipline])).rows[0];
   const trigger='discipline_fault_'+key().replaceAll('-','');
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='discipline_save_v1' then raise exception using errcode='23514',message='synthetic presentation audit failure';end if;return new;end$$`);
   await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
   try{
    await fail(owner,'discipline_save_v1',{center_id:undefined,discipline_id:discipline,name:'Must roll back',state:'active',expected_version:Number(before.version),presentation:{description:'Must roll back',color:null}},'INTEGRITY_VIOLATION');
    assert.deepEqual((await db.query('select name,version,presentation from core.disciplines where id=$1',[discipline])).rows[0],before);
   }finally{await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);}
  });
  await t.test('native constraints reject malformed metadata and presentation writes cannot create business records',async()=>{
   for(const value of [{icon:'<svg>'},{display_order:'bad'},{color:'red'},{public_visible:null}])await assert.rejects(db.query('update core.disciplines set presentation=presentation||$1::jsonb where id=$2',[value,discipline]));
   for(const table of ['sessions','reservations','sales','earnings'])assert.equal((await db.query('select count(*)::int n from core.'+table+' where org_id=$1',[org])).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from core.disciplines where org_id=$1',[org])).rows[0].n,2);
   assert.equal((await db.query('select count(*)::int n from core.center_disciplines where org_id=$1',[org])).rows[0].n,1);
  });
  await t.test('public transport bounds reject overflow without truncation; disabled profile remains closed',async()=>{
   const q={org_id:org,scope:'organization'},setting=await must(owner,'settings_get_v1',q);
   await must(owner,'settings_update_v1',{...q,expected_version:setting.version,patch:{public_profile_enabled:true}},key());
   const anon={jwt:context().env.ANON_KEY},r={slug:org,include_disciplines:true,interval:{starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+86400000).toISOString()},page:{}};
   const ids=Array.from({length:201},()=>key());
   try{
    await db.query("insert into core.disciplines(id,org_id,name,state,presentation) select id,$2,'Synthetic public bound','active',$3 from unnest($1::uuid[]) id",[ids,org,{description:null,color:null,icon:null,display_order:0,public_visible:true,allow_center_description:false}]);
    assert.equal((await call(anon,'public_calendar_get_v1',r)).result.error?.code,'SERVICE_UNAVAILABLE');
    const current=await must(owner,'settings_get_v1',q);await must(owner,'settings_update_v1',{...q,expected_version:current.version,patch:{public_profile_enabled:false}},key());
    assert.equal((await must(anon,'public_calendar_get_v1',r)).organization_profile,null);
   }finally{await db.query('delete from core.disciplines where id=any($1::uuid[])',[ids]);}
   const current=await must(owner,'settings_get_v1',q);await must(owner,'settings_update_v1',{...q,expected_version:current.version,patch:{public_profile_enabled:true}},key());
   try{
    await db.query("update core.disciplines set name=repeat('x',2097152) where id=$1",[second]);
    assert.equal((await call(anon,'public_calendar_get_v1',r)).result.error?.code,'SERVICE_UNAVAILABLE');
   }finally{await db.query("update core.disciplines set name='Tango' where id=$1",[second]);}
   await write(owner,'center_manager_revoke_v1',{person_id:person,expected_version:1,reason:'Synthetic presentation permission revocation'});
   await fail(manager,'disciplines_list_v1',{include_presentation:true,page:{}},'FORBIDDEN');
  });
 }finally{await db.end();}
});
