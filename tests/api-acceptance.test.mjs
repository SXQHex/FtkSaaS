import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';import {connect} from '../scripts/db.mjs';import {newUuidV7} from '../scripts/uuid.mjs';import {version} from 'uuid';
const key=()=>newUuidV7();
test('Real Auth → Edge UUID producer → named RPC → PostgreSQL acceptance',async t=>{
 const {platform,plan}=await fixturePlatform();const owner=await authUser('owner');const student=await authUser('student');const stranger=await authUser('stranger');
 const ownerAccount=await must(owner,'account_get_v1');const platformAccount=await must(platform,'account_get_v1');await must(student,'account_get_v1');
 const createKey=key();const orgData=await must(platform,'organization_create_v1',{verified_account_id:ownerAccount.id,name:'API '+key(),initial_plan_id:plan},createKey);
 const org=orgData.primary_id;const db=await connect();let center,ownerPerson,studentPerson,discipline,product,sale,eventA,eventB,registration;
 const scoped=(b={})=>({org_id:org,center_id:center,...b});const mutate=(u,op,b={},k=key())=>must(u,op,scoped(b),k);
 const error=async(u,op,b,code,k=key())=>{const r=await call(u,op,b,k);assert.equal(r.result.ok,false,op);assert.equal(r.result.error.code,code,JSON.stringify(r.result));return r;};
 async function persist(){fs.mkdirSync('.dev',{recursive:true});fs.writeFileSync('.dev/api-suite.json',JSON.stringify({platform,owner,student,stranger,ownerAccount,platformAccount,org,plan,center,ownerPerson,studentPerson,discipline,product,sale,eventA,eventB,registration}));}
 try{
 ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await t.test('backend-created records are UUIDv7 and bootstrap starts only after verified payment',async()=>{
  assert.equal(version(org),7);assert.equal(version(ownerAccount.id),7);assert.equal((await must(owner,'organization_get_v1',{org_id:org})).access_mode,'bootstrap');
  await error(owner,'person_create_v1',scoped({display_name:'blocked',contacts:[]}),'SUBSCRIPTION_NOT_STARTED');
  await error(owner,'organization_create_v1',{verified_account_id:ownerAccount.id,name:'no',initial_plan_id:plan},'FORBIDDEN');
 });
 await t.test('bootstrap retry is idempotent; UUID production does not create a second organization',async()=>{
  const replay=await must(platform,'organization_create_v1',{verified_account_id:ownerAccount.id,name:(await db.query('select name from core.organizations where id=$1',[org])).rows[0].name,initial_plan_id:plan},createKey);assert.equal(replay.primary_id,org);assert.equal(replay.replayed,true);
 });
 center=(await must(owner,'center_create_v1',{org_id:org,name:'Center',timezone:'Europe/Istanbul'},key())).primary_id;await persist();
 await error(owner,'account_access_send_v1',scoped({person_id:ownerPerson}),'SUBSCRIPTION_NOT_STARTED');
 await mutate(owner,'center_manager_assign_v1',{person_id:ownerPerson});
 const pay=await mutate(owner,'saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic',occurred_at:new Date().toISOString()});
 await mutate(platform,'saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true});
 await t.test('first verified payment activates service; customer cannot verify own SaaS payment',async()=>{
  const subscription=await must(owner,'subscription_get_v1',{org_id:org});assert.equal(subscription.state,'active');assert(subscription.period_start);await error(owner,'saas_payment_verify_v1',scoped({payment_id:pay.primary_id,accepted:true}),'FORBIDDEN');
 });
 studentPerson=(await mutate(owner,'person_create_v1',{display_name:'Student',contacts:[{kind:'email',value:student.email}]})).primary_id;
 await mutate(owner,'student_activate_v1',{person_id:studentPerson});
 discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;
 await mutate(owner,'center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[key(),org,center,{kind:'cancellation',cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}]);
 await persist();
 await t.test('tenant isolation through API; request cannot impersonate an actor or platform role',async()=>{
  await error(stranger,'organization_get_v1',{org_id:org},'NOT_FOUND',undefined);
  await error(owner,'event_save_v1',scoped({actor_role:'platform'}),'VALIDATION_FAILED');
 });
 const terms={name:'One shared right',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]};
 product=(await mutate(owner,'product_publish_v1',{terms})).primary_id;
 const dates={start_date:'2026-01-01',end_date:'2027-01-01'};
 const preview=await must(owner,'sale_preview_v1',scoped({person_id:studentPerson,product_version_id:product,...dates}));
 sale=(await mutate(owner,'sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
 await mutate(owner,'collection_record_v1',{person_id:studentPerson,amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});
 const eventTerms={fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[product],cancellation:{before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'}};
 let slot=0;
 function eventInput(extra={}){const start=Date.now()-20*86400000+(slot++)*7200000;return {name:'Event '+key(),interval:{starts_at:new Date(start).toISOString(),ends_at:new Date(start+3600000).toISOString()},timezone:'Europe/Istanbul',venue:{kind:'external',name:'Venue',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{nominal:10,maximum:10},terms:eventTerms,discipline_ids:[discipline],assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'0',currency:'TRY'}],...extra};}
 async function newEvent(extra={}){const input=eventInput(extra);const data=await mutate(owner,'event_save_v1',input);await mutate(owner,'event_publish_v1',{event_id:data.primary_id,published:true});return {id:data.primary_id,input};}
 await t.test('sale creates one shared ledger-backed right and a single account',async()=>{
  const balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,1);
  assert.equal((await db.query('select count(*)::int n from core.entitlement_accounts where org_id=$1 and sale_id=$2',[org,sale])).rows[0].n,1);
 });
 const a=await newEvent(),b=await newEvent();eventA=a.id;eventB=b.id;await persist();
 await t.test('event_save is versioned; read projection returns discipline IDs',async()=>{
  const view=await must(owner,'event_get_v1',scoped({event_id:eventA}));assert.deepEqual(view.discipline_ids,[discipline]);assert.equal(view.version,2);
  await error(owner,'event_save_v1',scoped({...a.input,event_id:eventA,expected_version:1}),'VERSION_CONFLICT');
 });
 await t.test('atomic event save rolls back tags, assignments, receipt and event on a late foreign-person failure',async()=>{
  const input=eventInput({assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'0',currency:'TRY'},{person_id:newUuidV7(),duty:'assistant',fee_minor:'0',currency:'TRY'}]});const k=key();
  await error(owner,'event_save_v1',scoped(input),'NOT_FOUND',k);
  assert.equal((await db.query('select count(*)::int n from core.events where org_id=$1 and name=$2',[org,input.name])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')])).rows[0].n,0);
 });
 await t.test('last shared right: event vs event named RPC race allocates only once',async()=>{
  const results=await Promise.all([call(owner,'event_register_v1',scoped({event_id:eventA,person_id:studentPerson,sale_id:sale}),key()),call(owner,'event_register_v1',scoped({event_id:eventB,person_id:studentPerson,sale_id:sale}),key())]);
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results.map(x=>x.result)));assert.equal(results.find(x=>!x.result.ok).result.error?.code,'ENTITLEMENT_UNAVAILABLE',JSON.stringify(results.map(x=>x.result)));
  registration=results.find(x=>x.result.ok).result.data.primary_id;
  assert.equal((await db.query("select count(*)::int n from core.entitlement_allocations where org_id=$1 and sale_id=$2 and state='reserved'",[org,sale])).rows[0].n,1);
 });
 await persist();
 await t.test('cancel releases the same shared pool; payment record is unchanged',async()=>{
  await mutate(owner,'event_registration_cancel_v1',{registration_id:registration,expected_version:1,reason:'synthetic'});
  const balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,1);assert.equal((await db.query('select count(*)::int n from core.cash_movements where org_id=$1',[org])).rows[0].n,1);
 });
 await t.test('same idempotency key replay and changed payload; no second reservation or credit allocation',async()=>{
  const k=key(),body={event_id:eventA,person_id:studentPerson,sale_id:sale};const first=await mutate(owner,'event_register_v1',body,k);const second=await mutate(owner,'event_register_v1',body,k);assert.equal(second.primary_id,first.primary_id);assert.equal(second.replayed,true);
  await error(owner,'event_register_v1',scoped({...body,event_id:eventB}),'IDEMPOTENCY_PAYLOAD_MISMATCH',k);registration=first.primary_id;
 });
 await t.test('draft attendance does not consume; close consumes and correction releases by linked movement',async()=>{
  await mutate(owner,'event_attendance_mark_v1',{registration_id:registration,expected_version:1,result:'attended'});
  assert.equal((await db.query("select count(*)::int n from core.entitlement_movements where org_id=$1 and kind='consume'",[org])).rows[0].n,0);
  const view=await must(owner,'event_get_v1',scoped({event_id:eventA}));
  await mutate(owner,'event_attendance_close_v1',{event_id:eventA,expected_version:view.version});
  let balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).consumed,1);
  await mutate(owner,'event_attendance_correct_v1',{registration_id:registration,expected_version:3,result:'no_show',reason:'synthetic correction'});
  balance=await must(owner,'entitlements_get_v1',scoped({person_id:studentPerson}));assert.equal(balance.find(x=>x.sale_id===sale).available,1);
  assert.equal((await db.query("select count(*)::int n from core.entitlement_movements where org_id=$1 and kind='reverse' and previous_id is not null",[org])).rows[0].n,1);
 });
 const classId=(await mutate(owner,'class_save_v1',{name:'Class',discipline_id:discipline,external_open:true})).primary_id;
 const session=(await mutate(owner,'session_create_v1',{class_id:classId,discipline_id:discipline,format:'group',interval:eventInput().interval,resources:[],assignments:[],capacity:{nominal:10,maximum:10}})).primary_id;
 const ev=await newEvent();
 await t.test('last shared right: event vs lesson named RPC race cannot double spend',async()=>{
  const results=await Promise.all([call(owner,'event_register_v1',scoped({event_id:ev.id,person_id:studentPerson,sale_id:sale}),key()),call(owner,'reservation_create_v1',scoped({session_id:session,person_id:studentPerson,mode:'flexible',source_sale_id:sale}),key())]);
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results.map(x=>x.result)));assert.equal(results.find(x=>!x.result.ok).result.error.code,'ENTITLEMENT_UNAVAILABLE');
  const rows=await db.query("select count(*)::int n from core.entitlement_allocations where org_id=$1 and sale_id=$2 and state='reserved'",[org,sale]);assert.equal(rows.rows[0].n,1);
 });
 await t.test('events never create negative credit, even if normal lesson policy allows it',async()=>{
  await db.query("insert into core.policy_versions(id,org_id,key,effective_at,mandatory,value) values($1,$2,'negative_default',now(),false,$3)",[key(),org,{kind:'integer',value:100}]);
  const next=await newEvent();
  await error(owner,'event_register_v1',scoped({event_id:next.id,person_id:studentPerson,sale_id:sale}),'ENTITLEMENT_UNAVAILABLE');
  assert.equal((await db.query('select count(*)::int n from core.credit_deficits where org_id=$1',[org])).rows[0].n,0);
 });
 await t.test('role revocation invalidates an existing JWT immediately at the next command',async()=>{
  await mutate(owner,'center_manager_revoke_v1',{person_id:ownerPerson,expected_version:1,reason:'synthetic'});
  await error(owner,'event_save_v1',scoped(eventInput()),'FORBIDDEN');
  await mutate(owner,'center_manager_assign_v1',{person_id:ownerPerson});
 });
 await t.test('revoked Auth session cannot use its unexpired JWT',async()=>{
  const {env}=context();await fetch(env.API_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{authorization:'Bearer '+stranger.jwt,apikey:env.ANON_KEY}});
  const result=await call(stranger,'account_get_v1');assert.equal(result.result.ok,false);assert(['SESSION_REVOKED','AUTH_REQUIRED'].includes(result.result.error.code));
 });
 await t.test('bootstrap, grace and closed subscription boundaries are enforced on actual API calls',async()=>{
  await db.query("update core.saas_subscriptions set period_end=now()-interval '1 day',grace_until=now()+interval '6 days' where org_id=$1",[org]);
  await error(owner,'event_save_v1',scoped(eventInput()),'BILLING_OPERATION_RESTRICTED');
  await db.query("update core.saas_subscriptions set period_end=now()-interval '8 days',grace_until=now()-interval '1 day' where org_id=$1",[org]);
  await error(owner,'event_get_v1',scoped({event_id:eventA}),'SERVICE_UNAVAILABLE',undefined);
  assert((await must(owner,'subscription_get_v1',{org_id:org})).state==='suspended');
  await db.query("update core.saas_subscriptions set period_end=now()+interval '1 month',grace_until=now()+interval '1 month 7 days' where org_id=$1",[org]);
 });
 await persist();
 }finally{await db.end();}
});
