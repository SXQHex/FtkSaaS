import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Starter real Auth/API resource limits, downgrade scope and receipt gates',{timeout:300000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('starter-owner');
 const db=await connect();
 const contract=JSON.parse(fs.readFileSync('contracts/08-FtkSaaS-tip-ve-operasyon-sozlesmesi.json'));
 const bodyFor=(op,b)=>{const o=contract['x-contract'].operations.find(x=>x.name===op);const props=contract.$defs[o.request.$ref.split('/').at(-1)].properties;return {org_id:org,...('center_id' in props?{center_id:center}:{}),...b};};
 const invoke=(op,b,k=key())=>must(owner,op,bodyFor(op,b),k);
 const reject=async(op,b,code,k=key())=>{const r=await call(owner,op,bodyFor(op,b),k);assert.equal(r.result.ok,false,op);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 let org,center,room,disc;
 try{
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Starter plan acceptance',initial_plan_id:plan},key())).primary_id;
  center=(await must(owner,'center_create_v1',{org_id:org,name:'Only center',timezone:'UTC'},key())).primary_id;
  const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await invoke('center_manager_assign_v1',{person_id:ownerPerson});
  const pay=await invoke('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC STARTER',occurred_at:new Date().toISOString()});
  await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:pay.primary_id,accepted:true},key());
  await t.test('effective catalog enforces accepted limits despite a permissive old plan snapshot',async()=>{
   const view=await invoke('subscription_get_v1',{});const limits=Object.fromEntries(view.limits.entries.map(x=>[x.key,x.value]));assert.deepEqual(limits,{centers:1,rooms:1,disciplines:1,instructors:1,active_students:100});
   await reject('center_create_v1',{name:'Second center',timezone:'UTC'},'PLAN_LIMIT_REACHED');
  });
  await t.test('first room and discipline succeed; second active resources reject atomically',async()=>{
   room=(await invoke('room_save_v1',{name:'Only room',capacity:50})).primary_id;
   await reject('room_save_v1',{name:'Second room',capacity:50},'PLAN_LIMIT_REACHED');
   disc=(await invoke('discipline_save_v1',{name:'Yoga',state:'active'})).primary_id;
   await invoke('center_discipline_set_v1',{discipline_id:disc,state:'active'});
   await reject('discipline_save_v1',{name:'Tango',state:'active'},'PLAN_LIMIT_REACHED');
   assert.equal((await db.query("select count(*) n from core.rooms where org_id=$1 and state='active'",[org])).rows[0].n,'1');
  });
  const instructor=key(),otherInstructor=key();
  await db.query("insert into core.people(id,org_id,display_name,state) values($1,$3,'Instructor','active'),($2,$3,'Other instructor','active')",[instructor,otherInstructor,org]);
  await t.test('instructor database invariant also protects non-HTTP writers',async()=>{
   await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'instructor','active',now())",[key(),org,center,instructor]);
   await assert.rejects(db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'instructor','active',now())",[key(),org,center,otherInstructor]),/PLAN_LIMIT_REACHED/);
  });
  let students=[];
  await t.test('99 students plus two simultaneous activations admit exactly one, then reject 101',async()=>{
   for(let i=0;i<101;i++)students.push(key());
   await db.query("insert into core.people(id,org_id,display_name,state) select x,$1,'Synthetic student','active' from unnest($2::uuid[]) x",[org,students]);
   await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) select x.id,$1,$2,x.person_id,'student','active',now() from unnest($3::uuid[],$4::uuid[]) x(person_id,id)",[org,center,students.slice(0,99),students.slice(0,99).map(key)]);
   const responses=await Promise.all(students.slice(99).map(person_id=>call(owner,'student_activate_v1',{org_id:org,center_id:center,person_id},key())));
   assert.equal(responses.filter(x=>x.result.ok).length,1);assert.equal(responses.filter(x=>x.result.error?.code==='PLAN_LIMIT_REACHED').length,1);
   assert.equal((await db.query("select count(distinct person_id) n from core.center_relationships where org_id=$1 and kind='student' and state='active'",[org])).rows[0].n,'100');
  });
  await t.test('CRM and event feature gate applies even when old catalog contains all features',async()=>{
   await reject('leads_list_v1',{page:{limit:10}},'PLAN_FEATURE_UNAVAILABLE');
   await reject('earnings_list_v1',{person_id:instructor,interval:{starts_at:'2026-01-01T00:00:00Z',ends_at:'2028-01-01T00:00:00Z'},page:{limit:10}},'PLAN_FEATURE_UNAVAILABLE');
   const raw=await call(owner,'event_publish_v1',{org_id:org,center_id:center,event_id:key(),published:true},key());assert.equal(raw.result.ok,false);assert.equal(raw.result.error.code,'PLAN_FEATURE_UNAVAILABLE');
   // Direct service RPC with an authenticated claim must not impersonate the Edge.
   await db.query('begin');await db.query("select set_config('request.jwt.claim.role','authenticated',true)");
   const rawRpc=await db.query("select api_v1.centers_list_v1($1,$2,$3,$4,null) result",[{org_id:org},owner.id,owner.session_id,Array.from({length:32},key)]);
   assert.equal(rawRpc.rows[0].result.error.code,'FORBIDDEN');await db.query('rollback');
  });
  await t.test('program validation requires the single room and instructor',async()=>{
   const row={center_id:center,discipline_id:disc,resources:[],assignments:[{person_id:instructor,duty:'instructor'}]};
   await assert.rejects(db.query('select private.starter_schedule_guard($1,$2)',[org,row]),/PLAN_FEATURE_UNAVAILABLE/);
   await db.query('select private.starter_schedule_guard($1,$2)',[org,{...row,resources:[{kind:'room',id:room}]}]);
  });
  await t.test('Starter publishes credit and timed packages only in its selected discipline',async()=>{
   const terms={name:'Yoga · 8 lessons',kind:'credits',booking_mode:'flexible',credits:8,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:disc,usage_targets:['lesson']}]};
   await invoke('product_publish_v1',{terms});
   await reject('product_publish_v1',{terms:{...terms,name:'Wrong prefix'}},'VALIDATION_FAILED');
   await reject('product_publish_v1',{terms:{...terms,scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}},'PLAN_FEATURE_UNAVAILABLE');
   const {credits,...timed}=terms;await invoke('product_publish_v1',{terms:{...timed,name:'Yoga · Monthly',kind:'timed'}});
   await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
   const legacyVersion=(await invoke('product_publish_v1',{terms:{...terms,name:'Legacy incompatible name'}})).primary_id;
   const legacyProduct=(await db.query('select product_id from core.product_versions where id=$1',[legacyVersion])).rows[0].product_id;
   await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
   await reject('product_publish_v1',{product_id:legacyProduct,terms},'PLAN_FEATURE_UNAVAILABLE');
   await reject('sale_preview_v1',{person_id:students[0],product_version_id:legacyVersion,start_date:'2026-01-01',end_date:'2027-01-01'},'PLAN_FEATURE_UNAVAILABLE');
   assert.equal((await db.query('select name from core.products where id=$1',[legacyProduct])).rows[0].name,'Legacy incompatible name');

  });
  await t.test('versioned downgrade keeps explicit resources and closes excluded ones without deleting history',async()=>{
   await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
   const staff=await authUser('starter-legacy-staff'),staffAccount=await must(staff,'account_get_v1');
   const staffPerson=(await invoke('person_create_v1',{display_name:'Existing Pro staff',contacts:[]})).primary_id;
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,staffAccount.id,staffPerson]);
   await invoke('role_assign_v1',{person_id:staffPerson,role:'staff',scope:{center_id:center}});
   await db.query("insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values($1,$2,$3,$4,'person.manage',true)",[key(),org,center,staffPerson]);
   await must(staff,'person_create_v1',{org_id:org,center_id:center,display_name:'Pro staff allowed candidate',contacts:[]},key());
   for(const permission of ['report.read','finance.read'])await db.query('insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values($1,$2,$3,$4,$5,true)',[key(),org,center,staffPerson,permission]);
   const reportBody={org_id:org,center_id:center,report:'collections_debts',filters:{center_ids:[center],interval:{starts_at:'2026-10-01T00:00:00Z',ends_at:'2026-11-01T00:00:00Z'}},page:{limit:10}};
   await must(staff,'report_get_v1',reportBody);

   const extraKey=key();const extraRoom=(await invoke('room_save_v1',{name:'Pro extra room',capacity:20},extraKey)).primary_id;
   const extraDisc=(await invoke('discipline_save_v1',{name:'Tango',state:'active'})).primary_id;
   await invoke('center_discipline_set_v1',{discipline_id:extraDisc,state:'active'});
   const legacyStart=new Date(Date.now()+86400000);legacyStart.setUTCHours(8,0,0,0);
   const legacySession=(await invoke('session_create_v1',{discipline_id:disc,format:'group',interval:{starts_at:legacyStart.toISOString(),ends_at:new Date(+legacyStart+3600000).toISOString()},resources:[],assignments:[],capacity:{total:10}})).primary_id;
   const excludedSession=(await invoke('session_create_v1',{discipline_id:extraDisc,format:'group',interval:{starts_at:legacyStart.toISOString(),ends_at:new Date(+legacyStart+3600000).toISOString()},resources:[],assignments:[],capacity:{total:10}})).primary_id;

   await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
   const unresolved=await invoke('subscription_get_v1',{});assert.equal(unresolved.starter_scope_required,true);
   await reject('room_save_v1',{room_id:extraRoom,expected_version:1,name:'Unselected legacy room',capacity:20},'PLAN_LIMIT_REACHED');
   await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
   const starterPlan=key();await db.query("insert into core.saas_plan_versions(id,name,effective_at,price_minor,currency,period,limits,features) select $1,'starter',now(),price_minor,currency,period,limits,features from core.saas_plan_versions where id=$2",[starterPlan,plan]);
   const sub=(await db.query('select * from core.saas_subscriptions where org_id=$1',[org])).rows[0];
   const selected=(await db.query("select distinct person_id from core.center_relationships where org_id=$1 and kind='student' and state='active' order by person_id limit 99",[org])).rows.map(x=>x.person_id);
   const excluded=(await db.query("select person_id from core.center_relationships where org_id=$1 and kind='student' and state='active' and not (person_id=any($2::uuid[]))",[org,selected])).rows[0].person_id;
   const body={target_plan_id:starterPlan,kept_center_id:center,kept_scope:{room_id:room,discipline_id:disc,instructor_id:instructor,student_person_ids:selected}};
   await reject('subscription_downgrade_request_v1',{...body,expected_version:Number(sub.version)+1},'VERSION_CONFLICT');
   const change=(await invoke('subscription_downgrade_request_v1',{...body,expected_version:Number(sub.version)})).primary_id;
   const pending=await invoke('subscription_get_v1',{});assert.deepEqual(pending.pending_starter_scope,{center_id:center,scope:body.kept_scope});assert.equal(pending.subscription_version,Number(sub.version)+1);
   await db.query("update core.saas_change_requests set effective_at=now()-interval '1 second' where id=$1",[change]);
   // Revocation after scheduling must not strand the due boundary.
   await db.query("update core.center_relationships set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and kind='instructor'",[org,instructor]);
   const boundary=key();
   await db.query("insert into core.operation_receipts(id,org_id,actor_account_id,actor_fingerprint,operation,key_hash,payload_hash,state,result_expires_at) values($1,$2,$3::uuid,$3::uuid::text,'subscription_boundary_apply_v1',repeat('a',64),repeat('b',64),'in_progress',now()+interval '1 day')",[boundary,org,account.id]);
   await db.query("select private.p07_boundary($1,$2,$3,$4)",[org,sub.id,boundary,Array.from({length:32},key)]);
   const staffDenied=await call(staff,'person_create_v1',{org_id:org,center_id:center,display_name:'Starter staff denied candidate',contacts:[]},key());assert.equal(staffDenied.result.error?.code,'FORBIDDEN');
   const reportDenied=await call(staff,'report_get_v1',reportBody);assert.equal(reportDenied.result.error?.code,'FORBIDDEN');
   await invoke('session_get_v1',{session_id:legacySession});
   await reject('reservation_create_v1',{session_id:legacySession,person_id:selected[0],mode:'flexible'},'PLAN_FEATURE_UNAVAILABLE');
   const activeScope=await invoke('subscription_get_v1',{});assert.deepEqual(activeScope.starter_scope,{center_id:center,scope:body.kept_scope});assert.equal(activeScope.pending_starter_scope,null);
   assert.equal((await db.query('select private.starter_instructor_active($1,$2,$3) allowed',[org,center,instructor])).rows[0].allowed,false);
   const replacementRole=await invoke('role_assign_v1',{person_id:staffPerson,role:'instructor',scope:{center_id:center}});
   assert.equal((await invoke('subscription_get_v1',{})).starter_scope.scope.instructor_id,staffPerson);
   await invoke('role_revoke_v1',{assignment_id:replacementRole.primary_id,expected_version:replacementRole.version,reason:'Test explicit empty instructor slot'});
   await db.query("update private.p07_subscription_scope set starter_scope=jsonb_set(starter_scope,'{instructor_id}','null') where subscription_id=$1",[sub.id]);
   await invoke('role_assign_v1',{person_id:staffPerson,role:'instructor',scope:{center_id:center}});
   assert.equal((await invoke('subscription_get_v1',{})).starter_scope.scope.instructor_id,staffPerson);
   await db.query('select private.starter_schedule_guard($1,$2)',[org,{center_id:center,discipline_id:disc,resources:[{kind:'room',id:room}],assignments:[{person_id:staffPerson,duty:'instructor'}]}]);
   for(const resource of [{kind:'room',id:extraRoom},{kind:'person',id:instructor}])await reject('availability_save_v1',{resource,rule:{weekdays:[1],local_start:'09:00:00',local_end:'10:00:00',valid_from:'2020-01-01'}},'PLAN_FEATURE_UNAVAILABLE');
   await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'instructor','inactive',now())",[key(),org,center,selected[1]]);
   await invoke('availability_save_v1',{resource:{kind:'person',id:selected[1]},rule:{weekdays:[1],local_start:'09:00:00',local_end:'10:00:00',valid_from:'2020-01-01'}});
   for(const resource of [{kind:'room',id:room},{kind:'person',id:staffPerson}])await invoke('availability_save_v1',{resource,rule:{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'}});
   const start=new Date(+legacyStart+4*3600000);
   const validSession=(await invoke('session_create_v1',{discipline_id:disc,format:'group',interval:{starts_at:start.toISOString(),ends_at:new Date(+start+3600000).toISOString()},resources:[{kind:'room',id:room}],assignments:[{person_id:staffPerson,duty:'instructor'}],capacity:{total:10}})).primary_id;
   const cancelPreview=await invoke('session_cancel_preview_v1',{session_id:validSession,reason:'Selected historical session remains readable'});
   await invoke('session_cancel_apply_v1',{preview:{id:cancelPreview.id,token:cancelPreview.token}});
   await invoke('session_get_v1',{session_id:validSession});
   const replacementBody={interval:{starts_at:new Date(+start+4*3600000).toISOString(),ends_at:new Date(+start+5*3600000).toISOString()},resources:[{kind:'room',id:room}],capacity:{total:10}};
   await reject('replacement_session_create_v1',{...replacementBody,replaces_id:excludedSession},'PLAN_FEATURE_UNAVAILABLE');
   await invoke('replacement_session_create_v1',{...replacementBody,replaces_id:validSession});

   const batchStart=new Date(+start+2*3600000);
   const batchSession=(await invoke('session_create_v1',{discipline_id:disc,format:'group',interval:{starts_at:batchStart.toISOString(),ends_at:new Date(+batchStart+3600000).toISOString()},resources:[{kind:'room',id:room}],assignments:[{person_id:staffPerson,duty:'instructor'}],capacity:{total:10}})).primary_id;
   const historicalPolicy=key(),historicalReservation=key(),outsideSessionReservation=key();
   // Synthetic Pro-era reservation retained across the boundary; no live plan is changed externally.
   await db.query('begin');try{
    await db.query("update core.saas_plan_versions set name='pro' where id=$1",[starterPlan]);
    await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[historicalPolicy,org,center,{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}}]);
    await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[historicalReservation,org,center,batchSession,excluded,historicalPolicy]);
    await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[outsideSessionReservation,org,center,excludedSession,selected[1],historicalPolicy]);
    await db.query("update core.saas_plan_versions set name='starter' where id=$1",[starterPlan]);await db.query('commit');
   }catch(e){await db.query('rollback');throw e;}
   await reject('attendance_close_v1',{session_id:batchSession,expected_version:1},'PLAN_FEATURE_UNAVAILABLE');
   await reject('attendance_correct_preview_v1',{session_id:batchSession,corrections:[{reservation_id:historicalReservation,result:'no_show'}],reason:'Excluded student must remain closed'},'PLAN_FEATURE_UNAVAILABLE');
   await reject('session_cancel_preview_v1',{session_id:batchSession,reason:'No excluded student completion exception'},'PLAN_FEATURE_UNAVAILABLE');
   await assert.rejects(db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[key(),org,center,batchSession,excluded,historicalPolicy]),/PLAN_FEATURE_UNAVAILABLE/);
   assert.equal((await db.query('select state from core.reservations where id=$1',[historicalReservation])).rows[0].state,'active');
   await reject('reservation_impact_preview_v1',{change:{kind:'negative_limit',person_id:excluded,discipline_id:disc,allowed_negative_credits:1},reason:'Nested exclusion gate'},'PLAN_FEATURE_UNAVAILABLE');
   await assert.rejects(db.query("update core.reservations set version=version+1 where id=$1",[historicalReservation]),/PLAN_FEATURE_UNAVAILABLE/);
   await assert.rejects(db.query('select private.starter_request_guard($1,$2,$3)',['reservation_impact_preview_v1',{change:{kind:'entitlement_extend',sale_id:key(),person_id:excluded}},org]),/PLAN_FEATURE_UNAVAILABLE/);
   await reject('session_assignment_set_v1',{session_id:batchSession,person_id:staffPerson,duty:'instructor',expected_version:1},'PLAN_FEATURE_UNAVAILABLE');
   const docContext={gate:'reservation',subject:{type:'sessions',id:batchSession}};
   await invoke('document_requirements_get_v1',{person_id:selected[1],context:docContext});
   await reject('document_requirements_get_v1',{person_id:selected[1],context:{...docContext,subject:{type:'sessions',id:excludedSession}}},'PLAN_FEATURE_UNAVAILABLE');
   await assert.rejects(db.query('select private.p05_context($1,$2,$3,$4)',[org,center,excluded,docContext]),/PLAN_FEATURE_UNAVAILABLE/);
   await assert.rejects(db.query('select private.starter_request_guard($1,$2,$3)',['document_version_publish_v1',{requirements:[{scope:{session_ids:[excludedSession]}}]},org]),/PLAN_FEATURE_UNAVAILABLE/);
   await assert.rejects(db.query('select private.starter_request_guard($1,$2,$3)',['sale_change_preview_v1',{keep_reservation_ids:[outsideSessionReservation]},org]),/PLAN_FEATURE_UNAVAILABLE/);
   await assert.rejects(db.query('select private.lesson_right($1,$2,false,$3,$4,1,true)',[org,outsideSessionReservation,boundary,Array.from({length:32},key)]),/PLAN_FEATURE_UNAVAILABLE/);
   const historicalCash=key();await db.query("insert into core.cash_movements(id,org_id,center_id,person_id,kind,amount_minor,currency,occurred_at,operation_id) values($1,$2,$3,$4,'collection',100,'TRY',now(),$5)",[historicalCash,org,center,excluded,boundary]);
   await reject('collection_correct_preview_v1',{cash_movement_id:historicalCash,correction:{amount_minor:'1',currency:'TRY',occurred_at:new Date().toISOString(),direction:'decrease'},reason:'Excluded student cash remains historical'},'PLAN_FEATURE_UNAVAILABLE');
   assert.equal((await db.query('select amount_minor from core.cash_movements where id=$1',[historicalCash])).rows[0].amount_minor,'100');
   const oldPublication=key(),oldApplication=key();
   await db.query("insert into core.publications(id,org_id,center_id,session_id,slug,published) values($1,$2,$3,$4,'legacy-excluded-session',true)",[oldPublication,org,center,excludedSession]);
   await db.query("insert into core.public_applications(id,org_id,center_id,publication_id,target_contact,target_hash,state,bot_verified_at) values($1,$2,$3,$4,'synthetic@ftksaas.invalid',repeat('c',64),'pending',now())",[oldApplication,org,center,oldPublication]);
   await reject('public_application_review_v1',{application_id:oldApplication,action:contract.$defs.ApplicationAction.enum[0]},'PLAN_FEATURE_UNAVAILABLE');
   assert.equal((await db.query('select state from core.public_applications where id=$1',[oldApplication])).rows[0].state,'pending');




   await reject('room_save_v1',{name:'Pro extra room',capacity:20},'PLAN_FEATURE_UNAVAILABLE',extraKey);
   await reject('room_save_v1',{room_id:extraRoom,expected_version:1,name:'Still excluded',capacity:20},'PLAN_FEATURE_UNAVAILABLE');
   await reject('discipline_save_v1',{discipline_id:extraDisc,expected_version:1,name:'Still excluded',state:'active'},'PLAN_FEATURE_UNAVAILABLE');
   assert.equal((await db.query('select count(*) n from core.rooms where org_id=$1',[org])).rows[0].n,'2');
   assert.equal((await db.query('select private.starter_student_count($1) n',[org])).rows[0].n,'99');

   assert.equal((await db.query("select private.starter_selected($1,'student',$2) allowed",[org,excluded])).rows[0].allowed,false);
   const newcomer=(await invoke('person_create_v1',{display_name:'New operational student',contacts:[]})).primary_id;
   await invoke('student_activate_v1',{person_id:newcomer});
   const full=await invoke('subscription_get_v1',{});assert.equal(full.starter_scope.scope.student_person_ids.length,100);
   const overflow=(await invoke('person_create_v1',{display_name:'Overflow student',contacts:[]})).primary_id;
   await reject('student_activate_v1',{person_id:overflow},'PLAN_LIMIT_REACHED');
   await assert.rejects(db.query('select private.p06_import_row_check($1,$2,$3,$4)',[org,center,{source_key:'overflow-row',display_name:'Overflow import'},'starter-scope-test']),/PLAN_LIMIT_REACHED/);
   await assert.rejects(db.query('select private.p06_import_row_check($1,$2,$3,$4)',[org,center,{source_key:'excluded-row',display_name:'Excluded import',person_ref:excluded},'starter-scope-test']),/PLAN_FEATURE_UNAVAILABLE/);
   await invoke('student_deactivate_v1',{person_id:selected[0],reason:'Release a vacant operational slot'});
   await db.query('select private.p06_import_row_check($1,$2,$3,$4)',[org,center,{source_key:'vacant-slot',display_name:'Scoped import'},'starter-scope-test']);
   await invoke('student_activate_v1',{person_id:overflow});
   const replaced=await invoke('subscription_get_v1',{});assert.equal(replaced.starter_scope.scope.student_person_ids.length,100);assert(!replaced.starter_scope.scope.student_person_ids.includes(selected[0]));
   // Real approved merge remaps the selected identity before operational triggers run.
   const mergeTarget=(await invoke('person_create_v1',{display_name:'Canonical student',contacts:[]})).primary_id;
   const preview=await invoke('person_merge_preview_v1',{source_id:overflow,target_id:mergeTarget});
   await invoke('person_merge_apply_v1',{preview:{id:preview.id,token:preview.token}});
   const mergedScope=(await invoke('subscription_get_v1',{})).starter_scope.scope;
   assert(mergedScope.student_person_ids.includes(mergeTarget));assert(!mergedScope.student_person_ids.includes(overflow));
   assert.equal((await db.query('select private.starter_student_count($1) n',[org])).rows[0].n,'100');
   const canonicalTeacher=(await invoke('person_create_v1',{display_name:'Canonical teacher',contacts:[]})).primary_id;
   const teacherPreview=await invoke('person_merge_preview_v1',{source_id:staffPerson,target_id:canonicalTeacher});
   await invoke('person_merge_apply_v1',{preview:{id:teacherPreview.id,token:teacherPreview.token}});
   assert.equal((await invoke('subscription_get_v1',{})).starter_scope.scope.instructor_id,canonicalTeacher);
   const mergedStaffDenied=await call(staff,'person_create_v1',{org_id:org,center_id:center,display_name:'Merged staff still unlicensed',contacts:[]},key());assert.equal(mergedStaffDenied.result.error?.code,'FORBIDDEN');


  });
 }finally{try{await db.query('rollback');}finally{await db.end();}}
});
