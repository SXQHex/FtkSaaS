import test from 'node:test';
import assert from 'node:assert/strict';
import {call,authUser,fixturePlatform,must} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {preparationFixture} from './starter-preparation-fixture.mjs';

test('room details and deactivation preserve capacity, active work, history and authorization',async t=>{
 const f=await preparationFixture({schedule:true,session:true,studentUser:true,studentMembership:true});t.after(()=>f.db.end());
 const {owner,student,org,center,room,db,api,scoped}=f;
 const inspect=include_details=>api('management_state_get_v1',{operation:'room_save_v1',selector:{operation:'room_save_v1',key:{room_id:room,...(include_details?{include_details:true}:{})}},page:{}});
 const first=(await inspect()).items[0];assert.equal(first.current.values.description,undefined);
 const save=scoped({room_id:room,expected_version:first.versions[0].version,name:'Ground room',capacity:10,description:'Step-free entrance',location:'Ground floor',state:'active'}),opKey=key();
 const saved=await f.must(owner,'room_save_v1',save,opKey);assert.equal((await f.must(owner,'room_save_v1',save,opKey)).replayed,true);
 const current=(await inspect(true)).items[0];assert.equal(current.current.values.description,save.description);assert.equal(current.current.values.location,save.location);assert.equal(current.current.values.state,'active');assert(current.current.values.deactivation_effects.count>0);
 const reject=async(user,body,code)=>{const r=await call(user,'room_save_v1',body,key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 const deactivate={...save,expected_version:saved.version,state:'inactive'};
 await reject(owner,deactivate,'OPEN_OPERATIONS_EXIST');await reject(student,deactivate,'FORBIDDEN');
 assert.equal((await inspect(true)).items[0].versions[0].version,saved.version);
 await reject(owner,{...deactivate,state:'active',capacity:1},'CAPACITY_FULL');
 const sessions=await f.rows("select id from core.sessions where org_id=$1 and center_id=$2 and state='planned'",[org,center]);
 for(const s of sessions){const p=await api('session_cancel_preview_v1',{session_id:s.id,reason:'Resolve room deactivation'});await api('session_cancel_apply_v1',{preview:{id:p.id,token:p.token}});}
 const inactive=await f.must(owner,'room_save_v1',deactivate,key());assert.equal((await inspect(true)).items[0].current.values.state,'inactive');
 await f.must(owner,'room_save_v1',{...save,expected_version:inactive.version,state:'active'},key());
 assert.equal((await inspect(true)).items[0].current.values.state,'active');
 assert.equal((await db.query("select count(*)::int n from core.sessions where org_id=$1 and state<>'cancelled'",[org])).rows[0].n,0);
 assert.equal((await db.query('select description,location from core.rooms where id=$1',[room])).rows[0].description,save.description);
});

test('every new plan gets the same safe debt and negative defaults without changing existing histories',async()=>{
 const db=await connect();
 try{
  const existing=(await db.query('select id,org_id,key,value,version from core.policy_versions order by id')).rows;
  for(const name of ['starter','pro','business']){
   const {platform,plan}=await fixturePlatform(),owner=await authUser('new-'+name),account=await must(owner,'account_get_v1');
   await db.query('update core.saas_plan_versions set name=$1 where id=$2',[name,plan]);
   const body={verified_account_id:account.id,name:'Synthetic '+name+' defaults',initial_plan_id:plan},opKey=key();
   const created=await must(platform,'organization_create_v1',body,opKey);
   assert.equal((await must(platform,'organization_create_v1',body,opKey)).replayed,true);
   const policies=(await db.query('select key,value,version::int version from core.policy_versions where org_id=$1 order by key',[created.primary_id])).rows;
   assert.deepEqual(policies,[{key:'debt_booking',value:{kind:'boolean',value:true},version:1},{key:'debt_participation',value:{kind:'boolean',value:true},version:1},{key:'negative_default',value:{kind:'integer',value:0},version:1},{key:'reservation_window',value:{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false},version:1}]);
  }
  if(existing.length){const after=(await db.query('select id,org_id,key,value,version from core.policy_versions where id=any($1::uuid[]) order by id',[existing.map(p=>p.id)])).rows;assert.deepEqual(after,existing);}
 }finally{await db.end();}
});

test('reservation window setup defaults remain editable by live scoped managers',async t=>{
 const f=await preparationFixture({studentUser:true,studentMembership:true});t.after(()=>f.db.end());
 const {owner,student,org,center,plan,db,api,must,studentPerson}=f;
 const initial=(await must(owner,'policies_get_v1',{org_id:org,center_id:center,keys:['reservation_window']}))[0];
 assert.deepEqual(initial.value,{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});assert.equal(initial.version,1);
 const changed={kind:'window',opens_minutes_before:4320,closes_minutes_before:60,manager_exception:false};
 const body={org_id:org,center_id:null,key:'reservation_window',value:changed,effective_at:new Date().toISOString(),mandatory:false},opKey=key();
 await must(owner,'policy_publish_v1',body,opKey);assert.equal((await must(owner,'policy_publish_v1',body,opKey)).replayed,true);
 const current=(await must(owner,'policies_get_v1',{org_id:org,center_id:center,keys:['reservation_window']}))[0];assert.deepEqual(current.value,changed);assert.equal(current.version,2);
 const original=(await db.query("select value,version::int version from core.policy_versions where org_id=$1 and key='reservation_window' and scope_center_id is null and version=1",[org])).rows[0];assert.deepEqual(original,{value:initial.value,version:1});
 await api('center_manager_assign_v1',{person_id:studentPerson});
 const orgWrite=await call(student,'policy_publish_v1',{...body,effective_at:new Date().toISOString()},key());assert.equal(orgWrite.result.ok,false);assert.equal(orgWrite.result.error.code,'FORBIDDEN');
 const local={...body,center_id:center,value:{...changed,opens_minutes_before:2880}};
 for(const name of ['starter','pro']){
  await db.query('update core.saas_plan_versions set name=$1 where id=$2',[name,plan]);const r=await call(student,'policy_publish_v1',{...local,effective_at:new Date().toISOString()},key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'PLAN_FEATURE_UNAVAILABLE');
 }
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);await must(student,'policy_publish_v1',{...local,effective_at:new Date().toISOString()},key());assert.deepEqual((await must(owner,'policies_get_v1',{org_id:org,center_id:center,keys:['reservation_window']}))[0].value,local.value);
 await must(owner,'policy_publish_v1',{...body,mandatory:true,effective_at:new Date().toISOString()},key());const before=(await db.query("select count(*)::int n from core.policy_versions where org_id=$1 and key='reservation_window'",[org])).rows[0].n;
 const denied=await call(student,'policy_publish_v1',{...local,effective_at:new Date().toISOString()},key());assert.equal(denied.result.ok,false);assert.equal(denied.result.error.code,'FORBIDDEN');assert.equal((await db.query("select count(*)::int n from core.policy_versions where org_id=$1 and key='reservation_window'",[org])).rows[0].n,before);
});

test('configured forms are discoverable without secrets, scoped to live managers and usable by form rules',async t=>{
 const f=await preparationFixture({studentUser:true,studentMembership:true});t.after(()=>f.db.end());
 const {owner,student,org,center,plan,db,must,api}=f;
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);
 const other=(await api('center_create_v1',{name:'Other configured form center',timezone:'UTC'})).primary_id;
 const ids=Array.from({length:4},key);
 for(let i=0;i<ids.length;i++)await db.query("insert into private.crm_intake_forms(id,org_id,center_id,channel,form_key,source_url,enabled) values($1,$2,$3,'web_form',$4,'https://example.invalid/private-source',$5)",[ids[i],org,i<2?center:i===2?other:null,'synthetic-form-'+i,i!==1]);
 const providerId=String(BigInt('0x'+key().replaceAll('-','').slice(-16)));
 await db.query("insert into private.crm_intake_forms(id,org_id,center_id,channel,form_key,source_url,enabled,external_form_id,external_page_id) values($1,$2,$3,'meta',$4,'https://example.invalid/hidden-provider',true,$5,'123')",[key(),org,center,'hidden-'+key(),providerId]);
 const oq={org_id:org,scope:'organization'},cq={org_id:org,scope:'center',center_id:center};
 assert.equal((await must(owner,'settings_catalog_get_v1',oq)).configured_forms,undefined);
 const first=(await must(owner,'settings_catalog_get_v1',{...oq,include_configured_forms:true,configured_forms_page:{limit:1}})).configured_forms;
 assert.equal(first.items.length,1);assert(first.next_cursor);assert.equal(first.items[0].form_id,ids[0]);
 assert.deepEqual(Object.keys(first.items[0]).sort(),['channel','center_id','enabled','form_id','form_key'].sort());
 const next=(await must(owner,'settings_catalog_get_v1',{...oq,include_configured_forms:true,configured_forms_page:{limit:10,cursor:first.next_cursor}})).configured_forms;
 assert.equal(next.items.length,3);assert.equal(next.next_cursor,null);
 await api('center_manager_assign_v1',{person_id:f.studentPerson});
 const local=(await must(student,'settings_catalog_get_v1',{...cq,include_configured_forms:true})).configured_forms;assert.deepEqual(local.items.map(x=>x.form_id),ids.slice(0,2));assert.equal(local.items[1].enabled,false);
 for(const q of [oq,{...cq,center_id:other},{...cq,configured_forms_page:{cursor:first.next_cursor}}]){
  const result=await call(student,'settings_catalog_get_v1',{...q,include_configured_forms:true});assert.equal(result.result.ok,false);assert(['FORBIDDEN','VALIDATION_FAILED'].includes(result.result.error.code));
 }
 const settings=await must(owner,'settings_get_v1',oq),rules=[{form_id:first.items[0].form_id,contact_requirement:'email',required_fields:['level']}];
 await must(owner,'settings_update_v1',{...oq,expected_version:settings.version,patch:{application_form_rules:rules}},key());
 assert.deepEqual((await must(owner,'settings_get_v1',oq)).values.application_form_rules,rules);
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
 const denied=await call(owner,'settings_catalog_get_v1',{...oq,include_configured_forms:true});assert.equal(denied.result.error.code,'PLAN_FEATURE_UNAVAILABLE');
});

test('initial zero credit needs no invented upper and default debt guards remain live until explicitly changed',async t=>{
 const f=await preparationFixture({schedule:true,studentUser:true,studentMembership:true});t.after(()=>f.db.end());
 const {owner,org,center,discipline,studentPerson,db,api,must}=f;
 const session=(await api('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:f.day(1)+'T09:00:00Z',ends_at:f.day(1)+'T10:00:00Z'},resources:[{kind:'room',id:f.room}],assignments:[{person_id:f.person,duty:'instructor'}],capacity:{total:10}})).primary_id;
 const publish=(key,value)=>api('policy_publish_v1',{center_id:null,key,value,effective_at:new Date().toISOString(),mandatory:false});
 await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
 await publish('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
 await publish('participation_block_credit',{kind:'blocked_credit',effect:'release'});
 const body={org_id:org,center_id:center,session_id:session,person_id:studentPerson,mode:'flexible'};
 const reject=async code=>{
  const operationKey=key(),r=await call(owner,'reservation_create_v1',body,operationKey);
  assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);
  assert.equal((await f.rows('select count(*)::int n from core.reservations where org_id=$1',[org]))[0].n,0);
  assert.equal((await f.rows('select count(*)::int n from core.credit_deficits where org_id=$1',[org]))[0].n,0);
  assert.equal((await f.rows("select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=encode(extensions.digest($2,'sha256'),'hex')",[org,operationKey]))[0].n,0);
 };
 await reject('ENTITLEMENT_UNAVAILABLE');
 await publish('negative_default',{kind:'integer',value:1});await reject('POLICY_NOT_CONFIGURED');
 const personal=key();
 await db.query("insert into core.negative_limit_overrides(id,org_id,center_id,person_id,discipline_id,limit_count,reason) values($1,$2,$3,$4,$5,0,'Explicit pre-existing personal restriction')",[personal,org,center,studentPerson,discipline]);
 await reject('ENTITLEMENT_UNAVAILABLE');
 await publish('negative_default',{kind:'integer',value:0});
 await db.query('update core.negative_limit_overrides set limit_count=1 where id=$1',[personal]);await reject('POLICY_NOT_CONFIGURED');
 await db.query('update core.negative_limit_overrides set limit_count=0 where id=$1',[personal]);
 await publish('negative_upper',{kind:'integer',value:2});await reject('CREDIT_LIMIT_EXCEEDED');
 const terms={name:'Yoga · debt guard control',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'100',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]};
 const product=(await api('product_publish_v1',{terms})).primary_id;
 const preview=await api('sale_preview_v1',{person_id:studentPerson,product_version_id:product,start_date:f.day(0),end_date:f.day(30)});
 const sale=(await api('sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
 await reject('FORBIDDEN');
 await publish('debt_booking',{kind:'boolean',value:false});
 const booked=await must(owner,'reservation_create_v1',{...body,source_sale_id:sale},key());
 assert.equal((await f.rows('select private.debt_remaining($1,id)::text n from core.debts where org_id=$1 and sale_id=$2',[org,sale]))[0].n,'100');
 let attendance=await api('attendance_get_v1',{session_id:session});
 const mark=()=>call(owner,'attendance_mark_v1',{org_id:org,center_id:center,reservation_id:booked.primary_id,expected_version:attendance.entries[0].version,result:'attended'},key());
 assert.equal((await mark()).result.error.code,'FORBIDDEN');
 await publish('debt_participation',{kind:'boolean',value:false});
 // Explicit start follows the policy choice and preserves planned resource intervals.
 await api('attendance_start_v1',{session_id:session,expected_version:attendance.session_version,actual_started_at:new Date().toISOString(),reason:'Synthetic start after explicit debt policy choice'});
 attendance=await api('attendance_get_v1',{session_id:session});assert(attendance.actual_started_at);
 assert.equal((await mark()).result.ok,true);
 attendance=await api('attendance_get_v1',{session_id:session});assert.equal(attendance.entries[0].result,'attended');
 assert.equal((await f.rows('select count(*)::int n from core.cash_movements where org_id=$1',[org]))[0].n,0);
 assert.equal((await f.rows('select count(*)::int n from core.credit_deficits where org_id=$1',[org]))[0].n,0);
});

test('new class waitlists default closed and closure requires explicit resolution without cancelling reservations',async t=>{
 const f=await preparationFixture({schedule:true,session:true,studentUser:true,studentMembership:true});t.after(()=>f.db.end());
 const {owner,student,org,center,plan,classId,discipline,db,api,must}=f;
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const pub=(name,value)=>api('policy_publish_v1',{center_id:null,key:name,value,effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
 await pub('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
 const policy=(await pub('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}})).primary_id;
 const inspect=()=>api('management_state_get_v1',{operation:'class_save_v1',selector:{operation:'class_save_v1',key:{class_id:classId,include_waitlist:true}},page:{}});
 const first=(await inspect()).items[0];assert.equal(first.current.values.waitlist_enabled,false);
 const sid=(await f.rows('select id from core.sessions where org_id=$1 order by starts_at',[org]))[0].id;
 const join=()=>call(student,'waitlist_join_v1',{org_id:org,center_id:center,session_id:sid,person_id:f.studentPerson},key());
 const closed=await join();assert.equal(closed.result.error.code,'OFFER_UNAVAILABLE');
 const body={class_id:classId,discipline_id:discipline,name:'Explicit waitlist',external_open:true,waitlist_enabled:true,expected_version:first.versions[0].version};
 const opened=await api('class_save_v1',body),joined=await join();assert.equal(joined.result.ok,true);
 const entry=joined.result.data.primary_id,offer=key();
 await db.query("insert into core.seat_offers(id,org_id,center_id,entry_id,session_id,person_id,expires_at,state) values($1,$2,$3,$4,$5,$6,now()+interval '1 hour','active')",[offer,org,center,entry,sid,f.studentPerson]);
 await db.query("update core.waitlist_entries set state='offered',version=version+1 where id=$1",[entry]);
 const another=(await api('person_create_v1',{display_name:'Confirmed waitlist control',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:another});
 const reservation=key();await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[reservation,org,center,sid,another,policy]);
 const closeBody={...body,expected_version:opened.version,waitlist_enabled:false},denied=await call(owner,'class_save_v1',f.scoped(closeBody),key());
 assert.equal(denied.result.error.code,'OPEN_OPERATIONS_EXIST');assert.equal((await inspect()).items[0].current.values.waitlist_impact.entries[0].id,entry);
 await must(student,'waitlist_leave_v1',{org_id:org,center_id:center,entry_id:entry,expected_version:2},key());
 await api('class_save_v1',closeBody);assert.equal((await inspect()).items[0].current.values.waitlist_enabled,false);
 assert.equal((await db.query('select state from core.reservations where id=$1',[reservation])).rows[0].state,'active');
 assert.equal((await db.query('select state from core.seat_offers where id=$1',[offer])).rows[0].state,'withdrawn');
 assert.equal((await join()).result.error.code,'OFFER_UNAVAILABLE');
});

test('room deactivation requires resolution of a future internal event even when its capacity fits',async t=>{
 const f=await preparationFixture({schedule:true});t.after(()=>f.db.end());
 const {owner,plan,org,center,room,discipline,api,db}=f;
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const start=new Date(Date.now()+3*86400000),end=new Date(+start+3600000);
 const terms={fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'}};
 const event=(await api('event_save_v1',{name:'Room closure control',interval:{starts_at:start.toISOString(),ends_at:end.toISOString()},timezone:'UTC',venue:{kind:'internal',room_id:room,timezone:'UTC'},capacity:{nominal:4,maximum:4},terms,discipline_ids:[discipline],assignments:[{person_id:f.person,duty:'instructor',fee_minor:'0',currency:'TRY'}]})).primary_id;
 await api('event_publish_v1',{event_id:event,published:true});
 let cancelled=false;
 const cancel=async()=>{const p=await api('event_cancel_preview_v1',{event_id:event,reason:'Resolve room closure'});await api('event_cancel_apply_v1',{preview:{id:p.id,token:p.token}});cancelled=true;};
 t.after(async()=>{if(!cancelled)await cancel();});
 const version=(await f.rows('select version::int version from core.rooms where id=$1',[room]))[0].version;
 const body=f.scoped({room_id:room,name:'Only room',capacity:10,state:'inactive',expected_version:version}),denied=await call(owner,'room_save_v1',body,key());
 if(denied.result.ok)await api('room_save_v1',{room_id:room,name:'Only room',capacity:10,state:'active',expected_version:denied.result.data.version});
 assert.equal(denied.result.ok,false);assert.equal(denied.result.error.code,'OPEN_OPERATIONS_EXIST');
 const inspect=await api('management_state_get_v1',{operation:'room_save_v1',selector:{operation:'room_save_v1',key:{room_id:room,include_details:true}},page:{}});
 assert(inspect.items[0].current.values.deactivation_effects.items.some(item=>item.type==='events'&&item.id===event));
 await cancel();await api('room_save_v1',{...body,expected_version:version});
 assert.equal((await f.rows('select state from core.events where id=$1',[event]))[0].state,'cancelled');
});

test('work-calendar exceptions need live org permission, a manager reason and current preview versions',async t=>{
 const f=await preparationFixture({schedule:true});t.after(()=>f.db.end());
 const {owner,org,center,plan,discipline,db,api,must,scoped}=f;
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
 const forms=await must(owner,'settings_catalog_get_v1',{org_id:org,scope:'organization',include_configured_forms:true});assert.deepEqual(forms.configured_forms.items,[]);
 await f.read('center');await f.change('center',{work_calendar:{rules:[],closures:[]}});
 const start=new Date(Date.now()+4*86400000),base=scoped({discipline_id:discipline,format:'group',interval:{starts_at:start.toISOString(),ends_at:new Date(+start+3600000).toISOString()},resources:[],assignments:[],capacity:{total:4}});
 const denied=async(op,body,code,k=key())=>{const r=await call(owner,op,body,k);assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);};
 const proof=async()=>{const [o,c]=await Promise.all([f.read('organization'),f.read('center')]);return {reason:'Explicit special opening',settings_version:c.version,organization_settings_version:o.version};};
 await denied('session_create_v1',base,'RESOURCE_CONFLICT');
 await denied('session_create_v1',{...base,work_calendar_exception:await proof()},'FORBIDDEN');
 await f.change('organization',{work_calendar_exceptions_enabled:true});
 const body={...base,work_calendar_exception:await proof()},opKey=key(),created=await must(owner,'session_create_v1',body,opKey);
 assert.equal((await must(owner,'session_create_v1',body,opKey)).replayed,true);
 assert.equal((await api('session_get_v1',{session_id:created.primary_id})).work_calendar_exception,undefined);
 const details=await api('session_get_v1',{session_id:created.primary_id,include_work_calendar_exception:true});
 assert.equal(details.work_calendar_exception.reason,body.work_calendar_exception.reason);assert.equal(details.work_calendar_exception.approved_by,f.person);assert(Number.isFinite(Date.parse(details.work_calendar_exception.approved_at)));
 await f.change('organization',{description:'Unrelated version change'});
 assert.equal((await must(owner,'session_create_v1',body,opKey)).replayed,true);
 await denied('session_create_v1',body,'PREVIEW_STALE');
 await f.change('organization',{work_calendar_exceptions_enabled:false});
 await denied('session_create_v1',body,'FORBIDDEN',opKey);
 await f.change('organization',{work_calendar_exceptions_enabled:true});
 const proposal=async()=>api('program_preview_v1',{class_id:f.classId,schedule:{room_id:f.room,weekdays:[1,2,3,4,5,6,7],local_start:'09:00:00',starts_on:f.day(1),ends_on:f.day(3),assignments:[{person_id:f.person,duty:'instructor'}],capacity:{total:10}},work_calendar_exception:await proof()});
 const missingAgreement=await proposal();assert(missingAgreement.blockers.some(b=>b.code==='POLICY_NOT_CONFIGURED'));
 await api('instructor_agreement_publish_v1',{person_id:f.person,discipline_id:discipline,format:'group',valid:{starts_at:new Date(Date.now()-1000).toISOString(),ends_at:new Date(Date.now()+7*86400000).toISOString()},reason:'Explicit Pro scheduling agreement',terms:{model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'0'}],room_fee:{kind:'free',order:'after_instructor_share'}}});
 const preview=await proposal();assert.deepEqual(preview.blockers,[]);
 await f.change('organization',{work_calendar_exceptions_enabled:false});
 await denied('program_apply_v1',scoped({preview:{id:preview.id,token:preview.token}}),'FORBIDDEN');
 await f.change('organization',{work_calendar_exceptions_enabled:true});
 await denied('program_apply_v1',scoped({preview:{id:preview.id,token:preview.token}}),'PREVIEW_STALE');
 const fresh=await proposal();assert.deepEqual(fresh.blockers,[]);
 const applyBody=scoped({preview:{id:fresh.id,token:fresh.token}}),applyKey=key();
 await must(owner,'program_apply_v1',applyBody,applyKey);
 assert.equal((await must(owner,'program_apply_v1',applyBody,applyKey)).replayed,true);
 await f.change('organization',{work_calendar_exceptions_enabled:false});
 await denied('program_apply_v1',applyBody,'FORBIDDEN',applyKey);
 await f.change('organization',{work_calendar_exceptions_enabled:true});
 assert.equal((await must(owner,'program_apply_v1',applyBody,applyKey)).replayed,true);
 const changePreview=await api('session_change_preview_v1',{session_id:created.primary_id,scope:'single',patch:{capacity:{total:5}},reason:'Explicit capacity change',work_calendar_exception:await proof()});
 assert.deepEqual(changePreview.blockers,[]);
 const changeBody=scoped({preview:{id:changePreview.id,token:changePreview.token}}),changeKey=key();
 await must(owner,'session_change_apply_v1',changeBody,changeKey);
 await f.change('organization',{work_calendar_exceptions_enabled:false});
 await denied('session_change_apply_v1',changeBody,'FORBIDDEN',changeKey);
 await f.change('organization',{work_calendar_exceptions_enabled:true});
 assert.equal((await must(owner,'session_change_apply_v1',changeBody,changeKey)).replayed,true);
 await f.change('organization',{work_calendar_exceptions_enabled:false});
 const sessions=await f.rows("select id,work_calendar_exception from core.sessions where org_id=$1 and state='planned'",[org]);assert(sessions.length>=3);
 for(const s of sessions){assert.equal(s.work_calendar_exception.approved_by,f.person);const p=await api('session_cancel_preview_v1',{session_id:s.id,reason:'Explicit acceptance cleanup'});await api('session_cancel_apply_v1',{preview:{id:p.id,token:p.token}});}
 assert.equal((await f.rows('select work_calendar_exception from core.sessions where id=$1',[created.primary_id]))[0].work_calendar_exception.reason,body.work_calendar_exception.reason);
});
