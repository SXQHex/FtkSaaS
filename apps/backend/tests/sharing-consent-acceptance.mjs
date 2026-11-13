import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {call,must,authUser} from './api-client.mjs';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Participant sharing binds each decision to an immutable notice generation',async t=>{
 const f=await preparationFixture({schedule:true,session:true,studentUser:true,studentMembership:true});t.after(()=>f.db.end());
 const {owner,student,org,center,studentPerson,db}=f;
 const oq={scope:'organization',org_id:org},mq={scope:'member',org_id:org},read=(actor,q)=>must(actor,'settings_get_v1',q);
 const fields=['profile_visible','photo_visible','email_visible','phone_visible'];
 let notices=fields.map(field=>({field,content:{name:'Synthetic '+field,language:'tr',template_id:'sharing_'+field,template_version:'v1',text:'Explicit synthetic '+field+' notice\r\nĞ; no production legal text.'}}));
 const update=async(actor,q,patch,extra={},operationKey=key())=>must(actor,'settings_update_v1',{...q,expected_version:(await read(actor,q)).version,patch,...extra},operationKey);
 const publish=()=>update(owner,oq,{sharing_notices:notices});
 const consent=async field=>{const n=(await read(student,mq)).sharing_notices.find(x=>x.field===field);assert(n);return {field,notice_hash:n.notice_hash,notice_revision:n.notice_revision};};
 const history=async()=> (await must(student,'settings_history_get_v1',mq)).items;
 const rejected=async(actor,body,code,k=key())=>{const r=await call(actor,'settings_update_v1',body,k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 let initialSource,grantKey,grantBody,grantedHistory;
 await t.test('missing notice, missing decision and stale notice fail without changing values or history',async()=>{
  const before=await read(student,mq),old=await history();assert.deepEqual(before.sharing_notices,[]);assert.deepEqual(before.sharing_approved_fields,[]);
  await rejected(student,{...mq,expected_version:before.version,patch:{profile_visible:true}},'POLICY_NOT_CONFIGURED');assert.deepEqual((await read(student,mq)).values,before.values);assert.deepEqual(await history(),old);
  await publish();const current=await read(student,mq);assert.equal(current.sharing_notices.length,4);
  for(const n of current.sharing_notices){const source=notices.find(x=>x.field===n.field);assert.deepEqual(n.content,source.content);assert.equal(n.notice_revision,1);assert.equal(n.notice_hash,createHash('sha256').update(source.content.text,'utf8').digest('hex'));}
  initialSource=await consent('profile_visible');
  const canonical=notices[0];const bypass=await call(owner,'content_catalog_save_v1',{org_id:org,scope_key:'organization:'+org,code:'notice.sharing.'+canonical.field,channel:'document',language:'tr',version:2,source_version:'1',action:'publish',content:{...canonical.content,text:'Changed canonical source without epoch'}},key());assert.equal(bypass.result.error.code,'VERSION_CONFLICT');
  await rejected(student,{...mq,expected_version:current.version,patch:{profile_visible:true}},'VALIDATION_FAILED');
  await rejected(student,{...mq,expected_version:current.version,patch:{profile_visible:true},sharing_consents:[{...initialSource,notice_hash:'0'.repeat(64)}]},'VERSION_CONFLICT');
  await rejected(student,{...mq,expected_version:current.version,patch:{profile_visible:true},sharing_consents:[initialSource,initialSource]},'VALIDATION_FAILED');
  assert.equal((await read(student,mq)).version,before.version);assert.deepEqual(await history(),old);
 });
 await t.test('four explicit decisions record exact content, audience, link, native actor and server time once',async()=>{
  const sources=await Promise.all(fields.map(consent)),before=await read(student,mq),started=Date.now();grantKey=key();
  grantBody={...mq,expected_version:before.version,patch:Object.fromEntries(fields.map(field=>[field,true])),sharing_consents:sources};
  await must(student,'settings_update_v1',grantBody,grantKey);const finished=Date.now();assert.equal((await must(student,'settings_update_v1',grantBody,grantKey)).replayed,true);
  const after=await read(student,mq);assert.deepEqual([...after.sharing_approved_fields].sort(),[...fields].sort());
  const records=await history();assert.equal(records.length,1);grantedHistory=records[0];assert.equal(records[0].sharing_consents.length,4);
  const nativeAccount=await must(student,'account_get_v1');assert.equal(records[0].actor_account_id,nativeAccount.id);
  for(const e of records[0].sharing_consents){const source=notices.find(x=>x.field===e.field);assert.equal(e.accepted,true);assert.equal(e.purpose,'participant_'+e.field.replace('_visible',''));assert.equal(e.org_id,org);assert.equal(e.person_id,studentPerson);assert.equal(e.audience,'confirmed_participants');assert.equal(e.channel,'in_app');assert.deepEqual(e.content,source.content);assert.equal(e.notice_hash,createHash('sha256').update(source.content.text).digest('hex'));assert.equal(e.notice_revision,1);assert(Date.parse(e.occurred_at)>=started&&Date.parse(e.occurred_at)<=finished);assert(e.account_link_id);assert(Number.isFinite(Date.parse(e.link_verified_at)));}
  const blocked=await db.query('select sharing_consents from private.frontend_settings_history where id=$1',[records[0].id]);assert.equal(blocked.rows[0].sharing_consents.length,records[0].sharing_consents.length);assert.deepEqual(blocked.rows[0].sharing_consents,records[0].sharing_consents.map(({content,...entry})=>entry));assert(blocked.rows[0].sharing_consents.every(e=>e.rendered_document_id&&!Object.hasOwn(e,'content')));for(const e of records[0].sharing_consents)assert(e.rendered_document_id);
  await assert.rejects(()=>db.query("update private.frontend_settings_history set sharing_consents='[]' where id=$1",[records[0].id]));
 });
 await t.test('unrelated changes retain approval; A to B to A and same-text metadata changes never resurrect it',async()=>{
  await update(owner,oq,{description:'Unrelated organization setting'});assert((await read(student,mq)).sharing_approved_fields.includes('profile_visible'));
  const original=structuredClone(notices[0]);notices[0]={...original,content:{...original.content,text:original.content.text+' B'}};await publish();assert(!(await read(student,mq)).sharing_approved_fields.includes('profile_visible'));assert((await read(student,mq)).sharing_approved_fields.includes('email_visible'));
  notices[0]=original;await publish();const returned=await consent('profile_visible');assert.equal(returned.notice_hash,initialSource.notice_hash);assert(returned.notice_revision>initialSource.notice_revision);assert(!(await read(student,mq)).sharing_approved_fields.includes('profile_visible'));
  await rejected(student,grantBody,'VERSION_CONFLICT',grantKey);
  const before=await read(student,mq);await update(student,mq,{profile_visible:true},{sharing_consents:[returned]});const after=await read(student,mq);assert.equal(after.values.profile_visible,before.values.profile_visible);assert(after.sharing_approved_fields.includes('profile_visible'));assert.equal((await history()).length,2);
  notices[0]={...original,content:{...original.content,template_version:'v2'}};await publish();const metadata=await consent('profile_visible');assert.equal(metadata.notice_hash,initialSource.notice_hash);assert(metadata.notice_revision>returned.notice_revision);assert(!(await read(student,mq)).sharing_approved_fields.includes('profile_visible'));assert.deepEqual((await history()).find(x=>x.id===grantedHistory.id),grantedHistory);
 });
 await t.test('withdrawal survives a missing notice and adds immutable evidence without reopening through history or reset',async()=>{
  notices=notices.filter(x=>x.field!=='profile_visible');await publish();const before=await read(student,mq);await update(student,mq,{profile_visible:false});
  const withdrawn=await read(student,mq);assert.equal(withdrawn.values.profile_visible,false);assert(!withdrawn.sharing_approved_fields.includes('profile_visible'));const last=(await history())[0].sharing_consents.find(x=>x.field==='profile_visible');assert.equal(last.accepted,false);assert(last.content);assert(last.notice_revision);
  const hbody={...mq,expected_version:withdrawn.version,patch:{},history_source:{id:grantedHistory.id,fields:['profile_visible']}};await must(student,'settings_update_v1',hbody,key());assert.equal((await read(student,mq)).values.profile_visible,false);
  const p=await must(student,'settings_reset_preview_v1',{...mq,fields:['profile_visible','email_visible']});await must(student,'settings_reset_apply_v1',{...mq,expected_version:p.version,preview:{id:p.id,token:p.token}},key());const reset=await read(student,mq);assert.equal(reset.values.profile_visible,false);assert.equal(reset.values.email_visible,false);assert(!reset.sharing_approved_fields.includes('email_visible'));assert(before.values.profile_visible);
 });
 await t.test('notice publication racing an opt-in never records the new generation without its explicit proof',async()=>{
  const old=await consent('photo_visible'),parent=await read(owner,oq),member=await read(student,mq);
  notices=notices.map(n=>n.field==='photo_visible'?{...n,content:{...n.content,text:n.content.text+' Concurrent revision'}}:n);
  const [publication,choice]=await Promise.all([
   call(owner,'settings_update_v1',{...oq,expected_version:parent.version,patch:{sharing_notices:notices}},key()),
   call(student,'settings_update_v1',{...mq,expected_version:member.version,patch:{photo_visible:true},sharing_consents:[old]},key())]);
  assert.equal(publication.result.ok,true);if(!choice.result.ok)assert.equal(choice.result.error.code,'VERSION_CONFLICT');
  const changed=await read(student,mq),fresh=changed.sharing_notices.find(n=>n.field==='photo_visible');assert(fresh.notice_revision>old.notice_revision);assert(!changed.sharing_approved_fields.includes('photo_visible'));
  const records=(await history()).flatMap(h=>h.sharing_consents??[]).filter(e=>e.field==='photo_visible'&&e.accepted);assert(records.every(e=>e.notice_revision!==fresh.notice_revision));
  await update(student,mq,{photo_visible:true},{sharing_consents:[{field:'photo_visible',notice_hash:fresh.notice_hash,notice_revision:fresh.notice_revision}]});assert((await read(student,mq)).sharing_approved_fields.includes('photo_visible'));
 });
});

test('Peer consent fences lesson, event and private media with the same live audience',async t=>{
 const f=await preparationFixture({schedule:true,session:true,studentUser:true,studentMembership:true});t.after(()=>f.db.end());
 const {owner,student,org,center,studentPerson,person,room,discipline,plan,db,rows,api}=f;
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const viewer=await authUser('sharing-viewer'),viewerAccount=await must(viewer,'account_get_v1');
 const viewerPerson=(await api('person_create_v1',{display_name:'Synthetic confirmed sharing viewer',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:viewerPerson});
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,viewerAccount.id,viewerPerson]);
 const fields=['profile_visible','photo_visible','email_visible','phone_visible'],notices=fields.map(field=>({field,content:{name:'Synthetic '+field,language:'en',template_id:field,template_version:'v1',text:'Synthetic explicit participant '+field+' disclosure.'}}));
 const oq={scope:'organization',org_id:org},cq={scope:'center',org_id:org,center_id:center},mq={scope:'member',org_id:org},read=(actor,q)=>must(actor,'settings_get_v1',q);
 const update=async(actor,q,patch,extra={},operationKey=key())=>must(actor,'settings_update_v1',{...q,expected_version:(await read(actor,q)).version,patch,...extra},operationKey);
 await update(owner,oq,{sharing_notices:notices,regional_defaults:{...(await read(owner,oq)).values.regional_defaults,document_language:'en'}});
 const sources=(await read(student,mq)).sharing_notices.map(n=>({field:n.field,notice_hash:n.notice_hash,notice_revision:n.notice_revision}));
 const originalGrantBody={...mq,expected_version:(await read(student,mq)).version,patch:Object.fromEntries(fields.map(field=>[field,true])),sharing_consents:sources},originalGrantKey=key();
 await must(student,'settings_update_v1',originalGrantBody,originalGrantKey);
 const data=JSON.parse(fs.readFileSync('tests/fixtures/settings-images.json')).png,image={mime:'image/png',data_base64:data,checksum:createHash('sha256').update(Buffer.from(data,'base64')).digest('hex')};
 const profile=await must(student,'management_state_get_v1',{operation:'account_profile_update_v1',selector:{operation:'account_profile_update_v1',key:{}}});
 await must(student,'account_profile_update_v1',{expected_version:profile.items[0].versions[0].version,display_name:profile.items[0].current.values.display_name,photo:image},key());
 const photo=(await must(student,'account_get_v1')).photo;assert(photo);
 const session=(await rows('select id from core.sessions where org_id=$1 order by starts_at limit 1',[org]))[0].id,policy=(await rows('select id from core.policy_versions where org_id=$1 limit 1',[org]))[0].id;
 const reservationIds=[];for(const target of [studentPerson,viewerPerson]){const id=key();reservationIds.push(id);await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[id,org,center,session,target,policy]);}
 const interval={starts_at:f.day(5)+'T12:00:00Z',ends_at:f.day(5)+'T13:00:00Z'},terms={fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'}};
 const event=(await api('event_save_v1',{name:'Synthetic peer consent event',interval,timezone:'UTC',venue:{kind:'internal',room_id:room,timezone:'UTC'},capacity:{nominal:10,maximum:10},terms,discipline_ids:[discipline],assignments:[{person_id:person,duty:'instructor',fee_minor:'0',currency:'TRY'}]})).primary_id;
 await api('event_publish_v1',{event_id:event,published:true});
 assert.deepEqual((await must(viewer,'event_get_v1',{org_id:org,center_id:center,event_id:event})).shared_participants,[]);
 const pending=await call(viewer,'media_get_v1',{scope:'event_participant',org_id:org,event_id:event,person_id:studentPerson,asset_id:photo.id});assert.equal(pending.result.ok,false);assert.equal(pending.result.error.code,'NOT_FOUND');
 const registrationIds=[];for(const target of [studentPerson,viewerPerson]){const p=await api('event_registration_preview_v1',{event_id:event,person_id:target});assert.deepEqual(p.blockers,[]);const r=await api('event_register_v1',{event_id:event,person_id:target,preview:{id:p.id,token:p.token}});registrationIds.push(r.primary_id);}
 const shared=async(kind,actor=viewer)=>(await must(actor,kind==='lesson'?'session_get_v1':'event_get_v1',{org_id:org,center_id:center,...(kind==='lesson'?{session_id:session}:{event_id:event})})).shared_participants;
 const media=(kind)=>({scope:kind==='lesson'?'lesson_participant':'event_participant',org_id:org,...(kind==='lesson'?{session_id:session}:{event_id:event}),person_id:studentPerson,asset_id:photo.id});
 const denied=async(kind)=>{const r=await call(viewer,'media_get_v1',media(kind));assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'NOT_FOUND');};
 await t.test('only confirmed peers receive opted-in fields and real private bytes; staff status alone gives no peer audience',async()=>{
  for(const kind of ['lesson','event']){const peers=await shared(kind);assert.equal(peers.length,1);assert.equal(peers[0].person_id,studentPerson);assert.deepEqual(peers[0].photo,photo);assert.equal(peers[0].email,student.email);assert.equal((await must(viewer,'media_get_v1',media(kind))).data_base64,data);assert.deepEqual(await shared(kind,owner),[]);const r=await call(owner,'media_get_v1',media(kind));assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'NOT_FOUND');}
 });
 await t.test('event private media cannot bypass the current F29 plan gate',async()=>{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  try{const r=await call(viewer,'media_get_v1',media('event'));assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'PLAN_FEATURE_UNAVAILABLE');assert.equal((await must(viewer,'media_get_v1',media('lesson'))).data_base64,data);}
  finally{await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);}
 });
 await t.test('private media rechecks event and lesson feature loss inside a paid plan',async()=>{
  const original=(await rows('select features from core.saas_plan_versions where id=$1',[plan]))[0].features;
  try{for(const [kind,feature] of [['event','F29'],['lesson','F08']]){await db.query('update core.saas_plan_versions set features=array_remove($2::text[],$3) where id=$1',[plan,original,feature]);const r=await call(viewer,'media_get_v1',media(kind));assert.equal(r.result.ok,false,kind+' media must retain the source feature gate');assert.equal(r.result.error.code,'PLAN_FEATURE_UNAVAILABLE');}}
  finally{await db.query('update core.saas_plan_versions set features=$2 where id=$1',[plan,original]);}
 });
 await t.test('center restrictions can only narrow after explicit organization permission and never alter the member decision',async()=>{
  assert.equal((await must(owner,'settings_catalog_get_v1',cq)).fields.find(f=>f.key==='sharing_restrictions').writable,false);const before=await read(student,mq);const r=await call(owner,'settings_update_v1',{...cq,expected_version:(await read(owner,cq)).version,patch:{sharing_restrictions:['photo_visible']}} ,key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'FORBIDDEN');
  await update(owner,oq,{allow_center_sharing_restrictions:true});assert.equal((await must(owner,'settings_catalog_get_v1',cq)).fields.find(f=>f.key==='sharing_restrictions').writable,true);await update(owner,cq,{sharing_restrictions:['photo_visible']});
  for(const kind of ['lesson','event']){const peers=await shared(kind);assert.equal(peers.length,1);assert.equal(peers[0].photo,undefined);assert.equal(peers[0].email,student.email);await denied(kind);}
  assert.deepEqual((await read(student,mq)).values,before.values);await update(owner,cq,{sharing_restrictions:[]});for(const kind of ['lesson','event'])assert.deepEqual((await shared(kind))[0].photo,photo);
 });
 await t.test('pending, withdrawn and canceled participation, event end, unlink and explicit withdrawal cut off media',async()=>{
  await db.query("update core.reservations set state='cancelled' where id=$1",[reservationIds[1]]);assert.deepEqual(await shared('lesson'),[]);await denied('lesson');await db.query("update core.reservations set state='active' where id=$1",[reservationIds[1]]);
  await db.query("update core.event_registrations set state='cancelled' where id=$1",[registrationIds[1]]);assert.deepEqual(await shared('event'),[]);await denied('event');await db.query("update core.event_registrations set state='active' where id=$1",[registrationIds[1]]);
  await db.query("update core.events set state='cancelled' where id=$1",[event]);assert.deepEqual(await shared('event'),[]);await denied('event');await db.query("update core.events set state='published',ends_at=now()-interval '1 second',starts_at=now()-interval '1 hour' where id=$1",[event]);assert.deepEqual(await shared('event'),[]);await denied('event');await db.query('update core.events set starts_at=$2,ends_at=$3 where id=$1',[event,interval.starts_at,interval.ends_at]);
  const link=(await rows("select id,version::int version from core.account_links where org_id=$1 and person_id=$2 and state='active'",[org,studentPerson]))[0];
  await api('account_link_remove_v1',{link_id:link.id,expected_version:link.version,reason:'Synthetic explicit sharing link removal'});for(const kind of ['lesson','event']){assert.deepEqual(await shared(kind),[]);await denied(kind);}
  const invitation=key(),token=key(),inviter=(await must(owner,'account_get_v1')).id;
  await db.query("insert into core.invitations(id,org_id,center_id,person_id,email,token_hash,inviter_account_id,expires_at,state) values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '1 hour','pending')",[invitation,org,center,studentPerson,student.email,createHash('sha256').update(token).digest('hex'),inviter]);
  await must(student,'account_access_accept_v1',{token},key());const newLink=(await rows("select id from core.account_links where org_id=$1 and person_id=$2 and state='active'",[org,studentPerson]))[0];assert.notEqual(newLink.id,link.id);
  assert.deepEqual((await read(student,mq)).sharing_approved_fields,[]);for(const kind of ['lesson','event']){assert.deepEqual(await shared(kind),[]);await denied(kind);}
  assert.equal((await must(student,'settings_update_v1',originalGrantBody,originalGrantKey)).replayed,true);assert.deepEqual((await read(student,mq)).sharing_approved_fields,[]);
  await update(student,mq,Object.fromEntries(fields.map(field=>[field,true])),{sharing_consents:sources});
  for(const kind of ['lesson','event'])assert.deepEqual((await shared(kind))[0].photo,photo);
  await update(student,mq,{photo_visible:false});for(const kind of ['lesson','event']){assert.equal((await shared(kind))[0].photo,undefined);await denied(kind);}
  const before=await read(student,mq);await update(owner,oq,{allow_center_sharing_restrictions:false});assert.deepEqual((await read(student,mq)).values,before.values);for(const kind of ['lesson','event'])await denied(kind);
 });
});

test('Sharing catalog selects only the same notice epoch, stores a document reference and preserves consent across language preferences',async t=>{
 const f=await preparationFixture({studentUser:true,studentMembership:true}),{db,owner,student,org}=f;t.after(()=>db.end());
 const orgScope={scope:'organization',org_id:org},memberScope={scope:'member',org_id:org};
 const notice={field:'profile_visible',content:{name:'Synthetic sharing',language:'tr',template_id:'sharing',template_version:'1',text:'Sentetik izin kaynağı.'}};
 const save=async(user,scope,patch,extra={})=>must(user,'settings_update_v1',{...scope,expected_version:(await must(user,'settings_get_v1',scope)).version,patch,...extra},key());
 await save(owner,orgScope,{sharing_notices:[notice]});await save(student,{scope:'user'},{language:'en'});
 assert.equal((await must(student,'settings_get_v1',memberScope)).sharing_notices[0].language,'tr');
 const translation={org_id:org,scope_key:'organization:'+org,code:'notice.sharing.profile_visible',channel:'document',language:'en',version:1,source_version:'1',action:'publish',content:{...notice.content,language:'en',text:'Synthetic approved sharing source.'}};
 await must(owner,'content_catalog_save_v1',translation,key());const shown=(await must(student,'settings_get_v1',memberScope)).sharing_notices[0];assert.equal(shown.language,'en');
 await save(student,memberScope,{profile_visible:true},{sharing_consents:[{field:shown.field,notice_hash:shown.notice_hash,notice_revision:shown.notice_revision}]});
 const stored=(await db.query("select e from private.frontend_settings_history h cross join lateral jsonb_array_elements(h.sharing_consents) e where h.scope_key=$1",['member:'+org+':'+(await must(student,'account_get_v1')).id])).rows[0].e;
 assert.equal(stored.rendered_document_id,shown.rendered_document_id);assert.equal(stored.auth_session_id,student.session_id);assert(!Object.hasOwn(stored,'content'));
 await save(student,{scope:'user'},{language:'auto'});assert((await must(student,'settings_get_v1',memberScope)).sharing_approved_fields.includes('profile_visible'));
 await save(owner,orgScope,{sharing_notices:[{...notice,content:{...notice.content,template_version:'2',text:'Sentetik yeni kaynak.'}}]});const next=await must(student,'settings_get_v1',memberScope);assert.equal(next.sharing_notices[0].language,'tr');assert.equal(next.sharing_notices[0].notice_revision,2);assert(!next.sharing_approved_fields.includes('profile_visible'));
 const currentNotice=next.sharing_notices[0];await save(student,memberScope,{profile_visible:true},{sharing_consents:[{field:currentNotice.field,notice_hash:currentNotice.notice_hash,notice_revision:currentNotice.notice_revision}]});
 const regional=(await must(owner,'settings_get_v1',orgScope)).values.regional_defaults;await save(owner,orgScope,{regional_defaults:{...regional,document_language:'qax'}});
 const missing=await must(student,'settings_get_v1',memberScope);assert.deepEqual(missing.sharing_notices,[]);assert.equal(missing.sharing_notice_errors[0].code,'POLICY_NOT_CONFIGURED');
 await save(student,memberScope,{profile_visible:false});assert.equal((await must(student,'settings_get_v1',memberScope)).values.profile_visible,false);
 const denied=await call(student,'settings_update_v1',{...memberScope,expected_version:(await must(student,'settings_get_v1',memberScope)).version,patch:{profile_visible:true}},key());assert.equal(denied.result.error.code,'POLICY_NOT_CONFIGURED');
});
