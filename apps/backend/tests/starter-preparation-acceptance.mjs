import test from 'node:test';import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
import fs from 'node:fs';import {createHash} from 'node:crypto';
test('ST-03 Starter preparation defaults copy, authority, reset and program consumer',{timeout:600000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('st03-preparation-owner'),student=await authUser('st03-preparation-student');
 const db=await connect(),rows=async(sql,args=[])=>(await db.query(sql,args)).rows;let org,center,room,discipline,person,studentPerson,roomRule,initialPreparationOrgVersion,packageTemplate;
 const scoped=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=key())=>must(u,op,scoped(b),k);
 const q=scope=>({scope,org_id:org,...(scope==='center'?{center_id:center}:{})});
 const read=scope=>must(owner,'settings_get_v1',q(scope));
 const change=async(scope,patch)=>{const v=await read(scope);return must(owner,'settings_update_v1',{...q(scope),expected_version:v.version,patch},key());};
 const denied=async(u,op,b,code)=>{const r=await call(u,op,b,key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 const availabilityTemplate={key:'weekday',name:'Explicit weekly preparation',rules:[{weekdays:[1,2,3,4,5,6,7],local_start:'08:00:00',local_end:'19:00:00',valid_from:'2020-01-01'}]};
 let classId;
 const preview=hour=>api('program_preview_v1',{class_id:classId,schedule:{room_id:room,weekdays:[1,2,3,4,5,6,7],local_start:hour+':00:00',starts_on:day(1),ends_on:day(2),assignments:[{person_id:person,duty:'instructor'}],capacity:{total:10}}});
 const duration=p=>{assert.equal(p.sessions.length,1);return (Date.parse(p.sessions[0].interval.ends_at)-Date.parse(p.sessions[0].interval.starts_at))/60000;};
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic ST03 defaults',initial_plan_id:plan},key())).primary_id;
  const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC ST03',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
  discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;
  packageTemplate={key:'credit',name:'Explicit credits preparation',discipline_id:discipline,terms:{name:'Yoga · prepared credits',kind:'credits',booking_mode:'flexible',credits:4,price_minor:'400',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},quota:null},start_date:day(1),end_date:day(61)};
  await must(owner,'settings_update_v1',{scope:'organization',org_id:org.toUpperCase(),expected_version:0,patch:{program_duration_minutes:45,availability_templates:[availabilityTemplate],package_templates:[packageTemplate]}},key());initialPreparationOrgVersion=(await read('organization')).version;
  assert.equal((await read('organization')).values.program_duration_minutes,45);
  center=(await api('center_create_v1',{name:'Copied preparation',timezone:'UTC'})).primary_id;
  person=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:person});
  await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  room=(await api('room_save_v1',{name:'Only room',capacity:10})).primary_id;await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
  for(const resource of [{kind:'room',id:room},{kind:'person',id:person}]){const saved=await api('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});if(resource.kind==='room')roomRule=saved.primary_id;}
  classId=(await api('class_save_v1',{name:'Preparation Yoga',discipline_id:discipline,external_open:false})).primary_id;
  await t.test('new center copies approved org proposal; subsequent template edits do not move it',async()=>{
   const v=await read('center');assert.equal(v.values.program_duration_minutes,45);assert.equal(v.program_duration_source.kind,'organization_copy');assert.equal(v.program_duration_source.organization_version,(await read('organization')).version);
   await change('organization',{program_duration_minutes:90});assert.equal((await read('center')).values.program_duration_minutes,45);
   const catalog=await must(owner,'settings_catalog_get_v1',q('center'));assert.equal(catalog.catalog_version,9);assert.equal(catalog.defaults.program_duration_minutes,60);assert.equal(catalog.fields.find(x=>x.key==='program_duration_minutes').consumer,'schedule_build_program');
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
   const profile=await must(owner,'account_get_v1'),managed=await must(owner,'management_state_get_v1',{operation:'account_profile_update_v1',selector:{operation:'account_profile_update_v1',key:{}}});
   await must(owner,'account_profile_update_v1',{expected_version:managed.items[0].versions[0].version,display_name:profile.display_name,unverified_phone:'+15550001234',given_name:'Synthetic private legal',family_name:'Private legal family'},key());
   const pendingProfile=(await shared())[0];assert(!('phone' in pendingProfile));assert(!('given_name' in pendingProfile));assert(!('family_name' in pendingProfile));
   const phone='+1555'+String(Date.now()).slice(-7),{env}=context();
   const proof=await fetch(env.API_URL+'/auth/v1/admin/users/'+owner.id,{method:'PUT',headers:{apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({phone,phone_confirm:true})});assert(proof.ok,'Synthetic native verified phone fixture: '+proof.status);
   const verified=(await proof.json()).phone;assert.equal(verified,phone.slice(1));const canonical=(await must(owner,'account_get_v1')).identity;assert.equal(canonical.phone,verified);assert(canonical.phone_verified_at);
   assert.equal((await shared())[0].phone,verified);
   await change('member',{phone_visible:false});assert(!('phone' in (await shared())[0]));
   await change('member',{phone_visible:true});assert.equal((await shared())[0].phone,verified);
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
  await t.test('Starter calendar interests consume own member preferences without opening history or wider access',async()=>{
   const request={org_id:org,center_id:center,interval:{starts_at:day(0)+'T00:00:00Z',ends_at:day(5)+'T00:00:00Z'},page:{limit:200}};
   const initial=await must(owner,'calendar_get_v1',request);assert(initial.items.length>0);
   await change('member',{interest_center_ids:[center.toUpperCase()],interest_discipline_ids:[discipline.toUpperCase()],history_recommendations:false});
   const filtered=await must(owner,'calendar_get_v1',{...request,interest_filter:true,page:{limit:200,sort:'recommendation_desc'}});assert.deepEqual(filtered.items.map(x=>x.id),initial.items.map(x=>x.id));assert(filtered.items.every(x=>x.center_id===center&&x.discipline_id===discipline));
  });
  await t.test('private photo/logo bytes, removal, replay, history and live photo sharing use real consumers',async()=>{
   const data=JSON.parse(fs.readFileSync('tests/fixtures/settings-images.json')).png,checksum=createHash('sha256').update(Buffer.from(data,'base64')).digest('hex'),image={mime:'image/png',data_base64:data,checksum};
   const profileBody=async photo=>{const managed=await must(owner,'management_state_get_v1',{operation:'account_profile_update_v1',selector:{operation:'account_profile_update_v1',key:{}}});return {expected_version:managed.items[0].versions[0].version,display_name:managed.items[0].current.values.display_name,photo};};
   const b=await profileBody(image),k=key();await must(owner,'account_profile_update_v1',b,k);assert.equal((await must(owner,'account_profile_update_v1',b,k)).replayed,true);
   const photo=(await must(owner,'account_get_v1')).photo;assert.equal(photo.checksum,checksum);assert.equal(photo.bytes,Buffer.from(data,'base64').length);
   assert.equal(Number((await rows('select count(*) n from private.settings_media_assets where scope_key=$1',['user:'+account.id]))[0].n),1);
   const own=await must(owner,'media_get_v1',{scope:'user',asset_id:photo.id});assert.equal(own.data_base64,data);assert.deepEqual(own.asset,photo);
   await denied(student,'media_get_v1',{scope:'user',asset_id:photo.id},'NOT_FOUND');
   const session=(await rows('select id from core.sessions where org_id=$1',[org]))[0].id,peer={scope:'lesson_participant',org_id:org,session_id:session,person_id:person,asset_id:photo.id};
   await change('member',{profile_visible:false,photo_visible:false,email_visible:false,phone_visible:false});await denied(student,'media_get_v1',peer,'NOT_FOUND');
   await change('member',{photo_visible:true});const shared=(await api('session_get_v1',{session_id:session},student)).shared_participants;assert.deepEqual(shared,[{person_id:person,photo}]);assert.equal((await must(student,'media_get_v1',peer)).data_base64,data);
   const response=await fetch(context().env.API_URL+'/functions/v1/backend-v1/media_get_v1',{method:'POST',headers:{apikey:context().env.ANON_KEY,authorization:'Bearer '+student.jwt,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key(),...peer})});assert(response.ok);assert.match(response.headers.get('cache-control'),/no-store/);await response.arrayBuffer();
   await change('member',{photo_visible:false});await denied(student,'media_get_v1',peer,'NOT_FOUND');
   await must(owner,'account_profile_update_v1',await profileBody(null),key());assert.equal((await must(owner,'account_get_v1')).photo,null);await denied(owner,'media_get_v1',{scope:'user',asset_id:photo.id},'NOT_FOUND');
   const orgView=await read('organization'),logoKey=key(),logoBody={...q('organization'),expected_version:orgView.version,patch:{},logo_image:image};
   await must(owner,'settings_update_v1',logoBody,logoKey);assert.equal((await must(owner,'settings_update_v1',logoBody,logoKey)).replayed,true);
   const logo=(await read('organization')).logo;assert.equal(logo.checksum,checksum);assert.equal((await must(student,'media_get_v1',{scope:'organization',org_id:org,asset_id:logo.id})).data_base64,data);
   assert.equal((await must(owner,'centers_list_v1',{org_id:org,page:{}})).items[0].organization_logo.id,logo.id);
   const history=await must(owner,'settings_history_get_v1',q('organization'));assert.equal(history.items[0].media_change.after_asset_id,logo.id);
   const saved=(await rows("select c.request from private.p06_contexts c join core.operation_receipts o on o.id=c.receipt_id where o.org_id=$1 and o.key_hash=encode(extensions.digest($2,'sha256'),'hex')",[org,logoKey]))[0];assert(saved);assert(!JSON.stringify(saved.request).includes(data));
   await denied(student,'settings_update_v1',{...q('organization'),expected_version:(await read('organization')).version,patch:{},logo_image:image},'FORBIDDEN');
   await denied(owner,'settings_update_v1',{...q('center'),expected_version:(await read('center')).version,patch:{},logo_image:image},'VALIDATION_FAILED');
   await must(owner,'settings_update_v1',{...q('organization'),expected_version:(await read('organization')).version,patch:{},logo_image:null},key());assert.equal((await read('organization')).logo,null);await denied(student,'media_get_v1',{scope:'organization',org_id:org,asset_id:logo.id},'NOT_FOUND');
  });
  await t.test('public field selection is default closed, live, scoped and independent of calendar publication',async()=>{
   const anon={jwt:context().env.ANON_KEY},request={slug:org,center_id:center,interval:{starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+7*86400000).toISOString()},page:{}};
   const session=(await rows(`select id from core.sessions where org_id=$1 and starts_at>now() and state='planned' order by starts_at limit 1`,[org]))[0].id;
   const publication=(await api('publication_set_v1',{session_id:session,published:true,public_details:{title:'Synthetic public lesson',venue_public_label:'Synthetic venue',fee_minor:'0',currency:'TRY',public_conditions:'Application only'}})).primary_id;
   await db.query("update core.saas_plan_versions set features=array_remove(features,'F25') where id=$1",[plan]);
   const publicRead=()=>must(anon,'public_calendar_get_v1',request);
   let v=await publicRead();assert.equal(v.organization_profile,null);assert.equal(v.center_profile,null);const originalItems=v.items;assert(originalItems.some(x=>x.publication_id===publication));
   const data=JSON.parse(fs.readFileSync('tests/fixtures/settings-images.json')).png,image={mime:'image/png',data_base64:data,checksum:createHash('sha256').update(Buffer.from(data,'base64')).digest('hex')};
   await must(owner,'settings_update_v1',{...q('organization'),expected_version:(await read('organization')).version,patch:{public_profile_enabled:true,public_fields:['name','logo'],description:'Unselected private description',billing_name:'Never public'},logo_image:image},key());
   v=await publicRead();assert.deepEqual(Object.keys(v.organization_profile).sort(),['logo','name']);assert.equal(v.organization_profile.logo.data_base64,data);assert.equal(v.center_profile,null);assert.deepEqual(v.items,originalItems);
   const hours=[{weekdays:[1,2],local_start:'22:00:00',local_end:'02:00:00',timezone:'Europe/Istanbul'}];
   await change('center',{public_profile_enabled:true,public_fields:['description','contact','hours','logo'],description:'Published center',contact_email:'business@ftksaas.invalid',public_hours:hours});
   v=await publicRead();assert.equal(v.center_profile.description,'Published center');assert.equal(v.center_profile.contact.email,'business@ftksaas.invalid');assert.deepEqual(v.center_profile.hours,hours);assert.equal(v.center_profile.logo.data_base64,data);assert(!JSON.stringify(v).includes('Never public'));
   await change('organization',{public_fields:['name']});v=await publicRead();assert(!('logo' in v.organization_profile));assert(!('logo' in v.center_profile));
   const foreign=await must(anon,'public_calendar_get_v1',{...request,center_id:key()});assert.equal(foreign.center_profile,null);
   await denied(student,'settings_update_v1',{...q('center'),expected_version:(await read('center')).version,patch:{public_profile_enabled:false}},'FORBIDDEN');
   await denied(owner,'settings_update_v1',{...q('center'),expected_version:(await read('center')).version,patch:{public_hours:[{...hours[0],timezone:'Unknown/Zone'}]}},'VALIDATION_FAILED');
   await change('organization',{public_profile_enabled:false});v=await publicRead();assert.equal(v.organization_profile,null);assert.equal(v.center_profile,null);assert.deepEqual(v.items,originalItems);
   const reset=await must(owner,'settings_reset_preview_v1',{...q('center'),fields:['public_fields']});await must(owner,'settings_reset_apply_v1',{...q('center'),expected_version:reset.version,preview:{id:reset.id,token:reset.token}},key());assert.deepEqual((await read('center')).values.public_fields,[]);
   await change('organization',{public_profile_enabled:true});v=await publicRead();assert.deepEqual(v.center_profile,{});
   await change('organization',{public_profile_enabled:false});
  });
  await t.test('manual collection methods persist real references without inventing a legacy payment method',async()=>{
   const body={person_id:person,amount_minor:'1',currency:'TRY',occurred_at:new Date().toISOString()},ids=[];
   for(const payment of [{method:'cash'},{method:'bank_transfer',reference:'SYNTHETIC BANK'},{method:'card_pos',reference:'SYNTHETIC POS'}]){
    const k=key(),b={...body,payment},result=await api('collection_record_v1',b,owner,k);ids.push(result.primary_id);assert.equal((await api('collection_record_v1',b,owner,k)).replayed,true);
    assert.deepEqual((await rows('select payment from core.cash_movements where id=$1',[result.primary_id]))[0].payment,payment);
   }
   const legacy=await api('collection_record_v1',body);assert.equal((await rows('select payment from core.cash_movements where id=$1',[legacy.primary_id]))[0].payment,null);
   const count=Number((await rows("select count(*) n from core.cash_movements where org_id=$1",[org]))[0].n);
   for(const payment of [{method:'bank_transfer'},{method:'card_pos',reference:' '},{method:'automatic_debit'},{method:'cash',reference:''}])await denied(owner,'collection_record_v1',scoped({...body,payment}),'VALIDATION_FAILED');
   assert.equal(Number((await rows('select count(*) n from core.cash_movements where org_id=$1',[org]))[0].n),count);
   for(const reference of ['\t','\n','\u00a0','\ufeff']){
    const payment=JSON.stringify({method:'bank_transfer',reference});assert.equal((await rows('select private.collection_payment_valid($1::jsonb) valid',[payment]))[0].valid,false);
    await assert.rejects(rows(`insert into core.cash_movements select (jsonb_populate_record(null::core.cash_movements,to_jsonb(c)||jsonb_build_object('id',$1::uuid,'payment',$2::jsonb))).* from core.cash_movements c where c.id=$3`,[key(),payment,ids[0]]),e=>e.code==='23514'&&e.constraint==='cash_collection_payment');
   }
   const finance=await api('finance_get_v1',{person_id:person,currency:'TRY',page:{limit:200}});for(const id of ids)assert.deepEqual(finance.movements.items.find(x=>x.id===id).payment,(await rows('select payment from core.cash_movements where id=$1',[id]))[0].payment);assert.equal(finance.movements.items.find(x=>x.id===legacy.primary_id).payment,null);
   await denied(student,'finance_get_v1',scoped({person_id:person,currency:'TRY',page:{}}),'FORBIDDEN');
  });
  await t.test('notification support is typed and unsupported channel requests never mutate in-app preferences',async()=>{
   const catalog=await must(owner,'settings_catalog_get_v1',q('member')),support=catalog.notification_delivery;assert.deepEqual(support.channels,{in_app:true,email:false,push:false});assert.equal(support.transactional_in_app_required,true);assert.equal(support.reminders.feature_licensed,false);assert.equal(support.reminders.timing_controls_available,false);assert.equal(support.reminders.new_member_default_enabled,true);assert.equal(support.new_member_marketing_default_enabled,false);assert.equal(support.digest.controls_available,false);assert.equal(support.quiet_hours.controls_available,false);assert.equal(support.in_app_delayed_by_quiet_hours,false);assert.equal(support.in_app_in_digest,false);assert.deepEqual(support.reminders.lesson_hours,[1,3,24]);assert.equal(support.reminders.default_lesson_hours,24);assert.equal(support.reminders.default_package_expiry_days,7);assert.equal(support.reminders.default_payment_due_days,3);
   const before=await rows('select id,channel,purpose,enabled,version from core.notification_preferences where org_id=$1 and person_id=$2 order by id',[org,person]),current=before.find(x=>x.channel==='in_app'&&x.purpose==='marketing'),k=key();
   const result=await call(owner,'notification_preferences_set_v1',scoped({channel:'email',purpose:'marketing',enabled:true,expected_version:Number(current?.version??1)}),k);assert.equal(result.result.ok,false);assert.equal(result.result.error.code,'SERVICE_UNAVAILABLE');assert.deepEqual(await rows('select id,channel,purpose,enabled,version from core.notification_preferences where org_id=$1 and person_id=$2 order by id',[org,person]),before);
   assert.equal(Number((await rows("select count(*) n from core.operation_receipts where org_id=$1 and key_hash=encode(extensions.digest($2,'sha256'),'hex')",[org,k]))[0].n),0);
   const legacyKey=key(),legacyReceipt=key(),legacyBody={client_api_version:1,...scoped({channel:'email',purpose:'marketing',enabled:true,expected_version:Number(current?.version??1)})};
   await db.query("insert into core.operation_receipts(id,org_id,actor_account_id,actor_fingerprint,operation,key_hash,payload_hash,state,result,result_expires_at) values($1,$2,$3::uuid,$3::uuid::text,'notification_preferences_set_v1',encode(extensions.digest($4,'sha256'),'hex'),encode(extensions.digest($5::jsonb::text,'sha256'),'hex'),'succeeded',$6::jsonb,now()+interval '30 days')",[legacyReceipt,org,account.id,legacyKey,legacyBody,{ok:true,data:{operation_id:legacyReceipt,primary_id:current?.id??key(),version:2,replayed:false,related:[]},trace_id:key()}]);
   const legacy=await call(owner,'notification_preferences_set_v1',legacyBody,legacyKey);assert.equal(legacy.result.ok,false);assert.equal(legacy.result.error.code,'SERVICE_UNAVAILABLE');assert.deepEqual(await rows('select id,channel,purpose,enabled,version from core.notification_preferences where org_id=$1 and person_id=$2 order by id',[org,person]),before);
   await denied(owner,'notification_preferences_set_v1',scoped({channel:'in_app',purpose:'transactional',enabled:false,expected_version:1}),'FORBIDDEN');
   await denied(owner,'settings_update_v1',{...q('member'),expected_version:(await read('member')).version,patch:{quiet_hours:{enabled:true}}},'VALIDATION_FAILED');
  });
  await t.test('availability proposals copy once, resolve to real domain input and reset without erasing active hours',async()=>{
   let c=await read('center');assert.deepEqual(c.values.availability_templates,[availabilityTemplate]);assert.equal(c.preparation_sources.availability_templates.kind,'organization_copy');assert.equal(c.preparation_sources.availability_templates.organization_version,initialPreparationOrgVersion);
   await change('organization',{availability_templates:[{...availabilityTemplate,rules:[{...availabilityTemplate.rules[0],local_end:'18:00:00'}]}]});assert.deepEqual((await read('center')).values.availability_templates,[availabilityTemplate]);
   const catalog=await must(owner,'settings_catalog_get_v1',q('center')),choice=catalog.preparation_templates.availability.find(x=>x.source.scope==='center');assert(choice);const resource={kind:'room',id:room},body={kind:'availability',source:choice.source,resource,rule_index:0};
   const prepared=await api('settings_preparation_resolve_v1',body);assert.deepEqual(prepared.request,{resource,rule:availabilityTemplate.rules[0]});
   await denied(student,'settings_preparation_resolve_v1',scoped(body),'FORBIDDEN');
   await change('center',{availability_templates:[availabilityTemplate]});assert.equal((await read('center')).preparation_sources.availability_templates.kind,'center_local');await denied(owner,'settings_preparation_resolve_v1',scoped(body),'VERSION_CONFLICT');
   const managed=await api('management_state_get_v1',{operation:'availability_save_v1',selector:{operation:'availability_save_v1',key:{resource,rule_id:roomRule}}});assert(managed.items[0].exists);await denied(student,'management_state_get_v1',scoped({operation:'availability_save_v1',selector:{operation:'availability_save_v1',key:{resource,rule_id:roomRule}}}),'FORBIDDEN');
   await api('availability_save_v1',{...prepared.request,rule_id:roomRule,expected_version:managed.items[0].versions[0].version});
   const after=await api('management_state_get_v1',{operation:'availability_save_v1',selector:{operation:'availability_save_v1',key:{resource,rule_id:roomRule}}});assert.equal(after.items[0].current.values.rule.local_end,'19:00:00');
   const blocked=await call(owner,'program_preview_v1',scoped({class_id:classId,schedule:{room_id:room,weekdays:[1,2,3,4,5,6,7],local_start:'20:00:00',starts_on:day(1),ends_on:day(2),assignments:[{person_id:person,duty:'instructor'}],capacity:{total:10}}}),key());assert.equal(blocked.result.ok,true);assert(blocked.result.data.blockers.some(x=>x.code==='RESOURCE_CONFLICT'));const sessionCount=Number((await rows('select count(*) n from core.sessions where org_id=$1',[org]))[0].n);await denied(owner,'program_apply_v1',scoped({preview:{id:blocked.result.data.id,token:blocked.result.data.token}}),'RESOURCE_CONFLICT');assert.equal(Number((await rows('select count(*) n from core.sessions where org_id=$1',[org]))[0].n),sessionCount);
   const orgBefore=await read('organization');for(const times of [['25:00:00','26:00:00'],['10:00:00','09:00:00']])await denied(owner,'settings_update_v1',{...q('organization'),expected_version:orgBefore.version,patch:{availability_templates:[{...availabilityTemplate,rules:[{...availabilityTemplate.rules[0],local_start:times[0],local_end:times[1]}]}]}},'VALIDATION_FAILED');const orgAfter=await read('organization');assert.equal(orgAfter.version,orgBefore.version);assert.deepEqual(orgAfter.values.availability_templates,orgBefore.values.availability_templates);
   const reset=await must(owner,'settings_reset_preview_v1',{...q('center'),fields:['availability_templates']});await must(owner,'settings_reset_apply_v1',{...q('center'),expected_version:reset.version,preview:{id:reset.id,token:reset.token}},key());c=await read('center');assert.deepEqual(c.values.availability_templates,[]);assert.equal(c.preparation_sources.availability_templates.kind,'system_default');assert.equal((await api('management_state_get_v1',{operation:'availability_save_v1',selector:{operation:'availability_save_v1',key:{resource,rule_id:roomRule}}})).items[0].current.values.rule.local_end,'19:00:00');
  });
  await t.test('package proposal publishes real version and sale dates; source edits/reset do not rewrite rights, money or validity',async()=>{
   let c=await read('center');assert.deepEqual(c.values.package_templates,[packageTemplate]);assert.equal(c.preparation_sources.package_templates.kind,'organization_copy');assert.equal(c.preparation_sources.package_templates.organization_version,initialPreparationOrgVersion);
   const catalog=await must(owner,'settings_catalog_get_v1',q('center')),choice=catalog.preparation_templates.packages.find(x=>x.source.scope==='center');assert(choice);const prepared=await api('settings_preparation_resolve_v1',{kind:'package',source:choice.source});assert.deepEqual(prepared.sale_dates,{start_date:packageTemplate.start_date,end_date:packageTemplate.end_date});assert.deepEqual(prepared.product_request.terms.scopes,[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]);
   const count=Number((await rows('select count(*) n from core.product_versions where org_id=$1',[org]))[0].n);await change('organization',{package_templates:[{...packageTemplate,terms:{...packageTemplate.terms,credits:8,price_minor:'900'}}]});assert.equal(Number((await rows('select count(*) n from core.product_versions where org_id=$1',[org]))[0].n),count);
   const version=(await api('product_publish_v1',prepared.product_request)).primary_id,published=(await api('products_list_v1',{page:{},include_timed_products:true})).items.find(x=>x.version_id===version);assert(published);assert.equal(published.terms.credits,4);assert.equal(published.terms.price_minor,'400');assert.equal(published.terms.refund.method,'credit_ratio');
   const quote=await api('sale_preview_v1',{person_id:studentPerson,product_version_id:version,...prepared.sale_dates}),sale=(await api('sale_apply_v1',{preview:{id:quote.id,token:quote.token}})).primary_id;
   const saved=(await rows('select product_version_id,start_date::text,end_date::text,net_minor::text from core.sales where id=$1',[sale]))[0];assert.deepEqual(saved,{product_version_id:version,start_date:packageTemplate.start_date,end_date:packageTemplate.end_date,net_minor:'400'});
   const reset=await must(owner,'settings_reset_preview_v1',{...q('center'),fields:['package_templates']});await must(owner,'settings_reset_apply_v1',{...q('center'),expected_version:reset.version,preview:{id:reset.id,token:reset.token}},key());c=await read('center');assert.deepEqual(c.values.package_templates,[]);assert.equal(c.preparation_sources.package_templates.kind,'system_default');assert.equal((await api('products_list_v1',{page:{},include_timed_products:true})).items.find(x=>x.version_id===version).terms.credits,4);assert.deepEqual((await rows('select product_version_id,start_date::text,end_date::text,net_minor::text from core.sales where id=$1',[sale]))[0],saved);
   await denied(owner,'settings_preparation_resolve_v1',scoped({kind:'package',source:choice.source}),'VERSION_CONFLICT');
   await denied(owner,'settings_update_v1',{...q('organization'),expected_version:(await read('organization')).version,patch:{package_templates:[{...packageTemplate,terms:{...packageTemplate.terms,refund:{}}}]}},'VALIDATION_FAILED');
  });
  await t.test('typed limits and live CM ownership prevent arbitrary setting writes and replay after revocation',async()=>{
   await denied(student,'settings_get_v1',q('center'),'FORBIDDEN');
   for(const value of [0,1.5,2147483648,'60',null])await denied(owner,'settings_update_v1',{...q('center'),expected_version:(await read('center')).version,patch:{program_duration_minutes:value}},'VALIDATION_FAILED');
   const k=key(),b={...q('center'),expected_version:(await read('center')).version,patch:{program_duration_minutes:30}};await must(owner,'settings_update_v1',b,k);
   const version=(await rows("select version from core.role_assignments where org_id=$1 and person_id=$2 and role='center_manager' and state='active'",[org,person]))[0].version;await api('center_manager_revoke_v1',{person_id:person,expected_version:Number(version),reason:'Synthetic ST03 live authority test'});
   const replay=await call(owner,'settings_update_v1',b,k);assert.equal(replay.result.error.code,'FORBIDDEN');
   await change('organization',{availability_templates:[availabilityTemplate]});const resolved=await call(owner,'settings_preparation_resolve_v1',scoped({kind:'availability',source:{scope:'organization',key:'weekday',version:0},resource:{kind:'room',id:room},rule_index:0}));assert.equal(resolved.result.ok,false);assert.equal(resolved.result.error.code,'FORBIDDEN');
  });
 }finally{await db.end();}
});
