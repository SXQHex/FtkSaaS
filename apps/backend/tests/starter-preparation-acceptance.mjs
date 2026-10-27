import test from 'node:test';import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('ST-03 Starter preparation defaults copy, authority, reset and program consumer',{timeout:240000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('st03-preparation-owner'),student=await authUser('st03-preparation-student');
 const db=await connect(),rows=async(sql,args=[])=>(await db.query(sql,args)).rows;let org,center,room,discipline,person,studentPerson;
 const scoped=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=key())=>must(u,op,scoped(b),k);
 const q=scope=>({scope,org_id:org,...(scope==='center'?{center_id:center}:{})});
 const read=scope=>must(owner,'settings_get_v1',q(scope));
 const change=async(scope,patch)=>{const v=await read(scope);return must(owner,'settings_update_v1',{...q(scope),expected_version:v.version,patch},key());};
 const denied=async(u,op,b,code)=>{const r=await call(u,op,b,key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 let classId;
 const preview=hour=>api('program_preview_v1',{class_id:classId,schedule:{room_id:room,weekdays:[1,2,3,4,5,6,7],local_start:hour+':00:00',starts_on:day(1),ends_on:day(2),assignments:[{person_id:person,duty:'instructor'}],capacity:{total:10}}});
 const duration=p=>{assert.equal(p.sessions.length,1);return (Date.parse(p.sessions[0].interval.ends_at)-Date.parse(p.sessions[0].interval.starts_at))/60000;};
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic ST03 defaults',initial_plan_id:plan},key())).primary_id;
  const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC ST03',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
  await must(owner,'settings_update_v1',{scope:'organization',org_id:org.toUpperCase(),expected_version:0,patch:{program_duration_minutes:45}},key());
  assert.equal((await read('organization')).values.program_duration_minutes,45);
  center=(await api('center_create_v1',{name:'Copied preparation',timezone:'UTC'})).primary_id;
  person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:person});
  discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  room=(await api('room_save_v1',{name:'Only room',capacity:10})).primary_id;await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  for(const resource of [{kind:'room',id:room},{kind:'person',id:person}])await api('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
  classId=(await api('class_save_v1',{name:'Preparation Yoga',discipline_id:discipline,external_open:false})).primary_id;
  await t.test('new center copies approved org proposal; subsequent template edits do not move it',async()=>{
   const v=await read('center');assert.equal(v.values.program_duration_minutes,45);assert.equal(v.program_duration_source.kind,'organization_copy');assert.equal(v.program_duration_source.organization_version,(await read('organization')).version);
   await change('organization',{program_duration_minutes:90});assert.equal((await read('center')).values.program_duration_minutes,45);
   const catalog=await must(owner,'settings_catalog_get_v1',q('center'));assert.equal(catalog.catalog_version,3);assert.equal(catalog.defaults.program_duration_minutes,60);assert.equal(catalog.fields.find(x=>x.key==='program_duration_minutes').consumer,'schedule_build_program');
  });
  await t.test('an explicit local selection equal to the copy records local provenance',async()=>{
   await change('center',{program_duration_minutes:45});assert.equal((await read('center')).program_duration_source.kind,'center_local');
  });
  await t.test('mixed UUID spelling shares one version and concurrency lock',async()=>{
   const version=(await read('center')).version;
   const attempts=await Promise.all([false,true].map(upper=>call(owner,'settings_update_v1',{scope:'center',org_id:upper?org.toUpperCase():org,center_id:upper?center.toUpperCase():center,expected_version:version,patch:{program_duration_minutes:upper?55:65}},key())));
   assert.equal(attempts.filter(x=>x.result.ok).length,1);assert.equal(attempts.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');await change('center',{program_duration_minutes:45});
  });
  await t.test('preview freezes copied duration; later local edits do not rewrite approved proposal or program',async()=>{
   const p=await preview('09');assert.equal(duration(p),45);await change('center',{program_duration_minutes:75});
   await api('program_apply_v1',{preview:{id:p.id,token:p.token}});
   assert.equal(Number((await rows('select duration_minutes from core.program_versions where org_id=$1',[org]))[0].duration_minutes),45);
   assert.equal((await read('center')).program_duration_source.kind,'center_local');assert.equal(duration(await preview('11')),75);
  });
  await t.test('selected reset restores system proposal, not current org template, and consumes it in a new preview',async()=>{
   const p=await must(owner,'settings_reset_preview_v1',{...q('center'),fields:['program_duration_minutes']});assert.equal(p.after.program_duration_minutes,60);
   await must(owner,'settings_reset_apply_v1',{...q('center'),expected_version:p.version,preview:{id:p.id,token:p.token}},key());
   assert.equal((await read('center')).program_duration_source.kind,'system_default');assert.equal(duration(await preview('13')),60);assert.equal(Number((await rows('select duration_minutes from core.program_versions where org_id=$1',[org]))[0].duration_minutes),45);
  });
  await t.test('peer fields require opt-in and live confirmed co-attendance; end, cancellation and unlink close visibility',async()=>{
   const member=await must(student,'account_get_v1');studentPerson=(await api('person_create_v1',{display_name:'Synthetic ST03 member',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:studentPerson});
   const link=key();await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[link,org,member.id,studentPerson]);
   const session=(await rows('select id from core.sessions where org_id=$1',[org]))[0].id,policy=(await rows('select id from core.policy_versions where org_id=$1 limit 1',[org]))[0].id;
   const reservations=[];for(const target of [person,studentPerson]){const id=key();reservations.push(id);await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[id,org,center,session,target,policy]);}
   const shared=async()=> (await api('session_get_v1',{session_id:session},student)).shared_participants;
   assert.deepEqual(await shared(),[]);
   await change('member',{profile_visible:true,email_visible:true,phone_visible:true});
   let peers=await shared();assert.equal(peers.length,1);assert.equal(peers[0].person_id,person);assert.equal(peers[0].display_name,(await must(owner,'account_get_v1')).display_name);assert.equal(peers[0].email,owner.email);assert(!('phone' in peers[0]));assert(!('given_name' in peers[0]));assert(!('family_name' in peers[0]));
   const profile=await must(owner,'account_get_v1');await must(owner,'account_profile_update_v1',{expected_version:profile.version,display_name:profile.display_name,unverified_phone:'+15550001234',given_name:'Synthetic private legal',family_name:'Private legal family'},key());
   assert(!('phone' in (await shared())[0]));assert(!('given_name' in (await shared())[0]));
   const phone='+1555'+String(Date.now()).slice(-7),{env}=context();
   const proof=await fetch(env.API_URL+'/auth/v1/admin/users/'+owner.id,{method:'PUT',headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({phone,phone_confirm:true})});assert(proof.ok,'Synthetic native verified phone fixture: '+proof.status);
   assert.equal((await shared())[0].phone,phone);
   await change('member',{phone_visible:false});assert(!('phone' in (await shared())[0]));
   await change('member',{phone_visible:true});assert.equal((await shared())[0].phone,phone);
   await change('member',{profile_visible:false});peers=await shared();assert(!('display_name' in peers[0]));assert.equal(peers[0].email,owner.email);
   await must(owner,'settings_update_v1',{scope:'member',org_id:org.toUpperCase(),expected_version:(await read('member')).version,patch:{email_visible:false,phone_visible:false}},key());
   assert.equal((await read('member')).values.email_visible,false);assert.deepEqual(await shared(),[]);
   await change('member',{profile_visible:true});
   await db.query("update core.reservations set state='cancelled' where id=$1",[reservations[0]]);assert.deepEqual(await shared(),[]);
   await db.query("update core.reservations set state='active' where id=$1",[reservations[0]]);
   const times=(await rows('select starts_at,ends_at from core.sessions where id=$1',[session]))[0];await db.query("update core.sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1",[session]);assert.deepEqual(await shared(),[]);
   await db.query('update core.sessions set starts_at=$2,ends_at=$3 where id=$1',[session,times.starts_at,times.ends_at]);
   await db.query("update core.reservations set state='cancelled' where id=$1",[reservations[1]]);assert.deepEqual(await shared(),[]);
   await db.query("update core.reservations set state='active' where id=$1",[reservations[1]]);
   await db.query("update core.account_links set state='revoked' where id=$1",[link]);await denied(student,'session_get_v1',scoped({session_id:session}),'NOT_FOUND');
   await db.query("update core.account_links set state='active' where id=$1",[link]);
  });
  await t.test('typed limits and live CM ownership prevent arbitrary setting writes and replay after revocation',async()=>{
   await denied(student,'settings_get_v1',q('center'),'FORBIDDEN');
   for(const value of [0,1.5,2147483648,'60',null])await denied(owner,'settings_update_v1',{...q('center'),expected_version:(await read('center')).version,patch:{program_duration_minutes:value}},'VALIDATION_FAILED');
   const k=key(),b={...q('center'),expected_version:(await read('center')).version,patch:{program_duration_minutes:30}};await must(owner,'settings_update_v1',b,k);
   const version=(await rows("select version from core.role_assignments where org_id=$1 and person_id=$2 and role='center_manager' and state='active'",[org,person]))[0].version;await api('center_manager_revoke_v1',{person_id:person,expected_version:Number(version),reason:'Synthetic ST03 live authority test'});
   const replay=await call(owner,'settings_update_v1',b,k);assert.equal(replay.result.error.code,'FORBIDDEN');
  });
 }finally{await db.end();}
});
