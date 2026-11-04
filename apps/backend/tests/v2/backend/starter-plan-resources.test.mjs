import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call,context} from '../../api-client.mjs';
import {connect} from '../../../scripts/db.mjs';
import {newUuidV7 as key} from '../../../scripts/uuid.mjs';

async function starterGateFixture(t){
 const {platform,plan}=await fixturePlatform(),owner=await authUser('starter-owner');
 const db=await connect();
 const contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
 const bodyFor=(op,b)=>{const o=contract['x-contract'].operations.find(x=>x.name===op);const props=contract.$defs[o.request.$ref.split('/').at(-1)].properties;return {org_id:org,...('center_id' in props?{center_id:center}:{}),...b};};
 const invoke=(op,b,k=key())=>must(owner,op,bodyFor(op,b),k);
 const reject=async(op,b,code,k=key())=>{const r=await call(owner,op,bodyFor(op,b),k);assert.equal(r.result.ok,false,op);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 let org,center;
 t.after(async()=>{try{await db.query('rollback');}finally{await db.end();}});
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  const account=await must(owner,'account_get_v1');
  org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Starter plan acceptance',initial_plan_id:plan},key())).primary_id;
  center=(await must(owner,'center_create_v1',{org_id:org,name:'Only center',timezone:'UTC'},key())).primary_id;
  const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await invoke('center_manager_assign_v1',{person_id:ownerPerson});
  const pay=await invoke('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC STARTER',occurred_at:new Date().toISOString()});
  await must(platform,'saas_payment_verify_v1',{org_id:org,center_id:center,payment_id:pay.primary_id,accepted:true},key());
 return {platform,plan,owner,db,contract,bodyFor,invoke,reject,org,center,account,ownerPerson};
}

test('Starter resource limits, concurrent capacity and feature gates',{timeout:300000},async t=>{
 const {platform,plan,owner,db,contract,bodyFor,invoke,reject,org,center,account,ownerPerson}=await starterGateFixture(t);
 let room,disc;
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
  await t.test('Starter discovers center discipline identity and appended closures without enabling another resource',async()=>{
   const read=(operation,k)=>invoke('management_state_get_v1',{operation,selector:{operation,key:k}});
   const relation=(await read('center_discipline_set_v1',{discipline_id:disc})).items[0];assert.equal(relation.exists,true);assert.equal(relation.entity.type,'center_disciplines');assert.equal(relation.versions[0].version,1);
   const resource={kind:'room',id:room};assert.deepEqual((await read('availability_exception_save_v1',{resource})).items,[]);
   const current=(await invoke('centers_list_v1',{page:{limit:200}})).items.find(x=>x.id===center);
   const closed=await invoke('availability_exception_save_v1',{resource,interval:{starts_at:'2032-01-01T00:00:00Z',ends_at:'2032-01-02T00:00:00Z'},reason:'Synthetic closure',expected_version:current.version});
   const view=(await read('availability_exception_save_v1',{resource})).items[0];assert.equal(view.entity.id,closed.primary_id);assert.equal(view.versions[0].version,current.version+1);assert(!('reason' in view.current.values));
  });
  const instructor=key(),otherInstructor=key();
  await t.test('Starter discovers its existing room and class through management reads',async()=>{
   const classId=(await invoke('class_save_v1',{name:'Yoga class',discipline_id:disc,external_open:true})).primary_id;
   const read=(operation,k)=>invoke('management_state_get_v1',{operation,selector:{operation,key:k},page:{limit:10}});
   const rooms=await read('room_save_v1',{});assert.equal(rooms.items.length,1);assert.equal(rooms.items[0].entity.id,room);
   const classes=await read('class_save_v1',{});assert.equal(classes.items.length,1);assert.equal(classes.items[0].entity.id,classId);assert.equal(classes.items[0].versions[0].version,1);
   assert.deepEqual((await read('program_preview_v1',{class_id:classId})).items,[]);
  });
  await db.query("insert into core.people(id,org_id,display_name,state) values($1,$3,'Instructor','active'),($2,$3,'Other instructor','active')",[instructor,otherInstructor,org]);
  await t.test('instructor database invariant also protects non-HTTP writers',async()=>{
   await db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','active',null)",[key(),org,center,instructor]);
   await assert.rejects(db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'instructor','active',now())",[key(),org,center,otherInstructor]),/center_relationships_kind_check/);
   await assert.rejects(db.query("insert into core.role_assignments(id,org_id,scope_center_id,person_id,role,state,account_link_id) values($1,$2,$3,$4,'instructor','active',null)",[key(),org,center,otherInstructor]),/PLAN_LIMIT_REACHED/);
  });
  let students=[];
  await t.test('99 students plus two simultaneous activations admit exactly one, then reject 101',async()=>{
   for(let i=0;i<101;i++)students.push(key());
   await db.query("insert into core.people(id,org_id,display_name,state) select x,$1,'Synthetic student','active' from unnest($2::uuid[]) x",[org,students]);
   await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) select x.id,$1,$2,x.person_id,'student','active',now() from unnest($3::uuid[],$4::uuid[]) x(person_id,id)",[org,center,students.slice(0,99),students.slice(0,99).map(key)]);
   const responses=await Promise.all(students.slice(99).map(person_id=>call(owner,'student_activate_v1',{org_id:org,center_id:center,person_id},key())));
   assert.equal(responses.filter(x=>x.result.ok).length,1);assert.equal(responses.filter(x=>x.result.error?.code==='PLAN_LIMIT_REACHED').length,1);
   assert.equal((await db.query("select count(distinct person_id) n from core.center_relationships where org_id=$1 and kind='student' and state='active'",[org])).rows[0].n,'100');
   const assigned=(await db.query('select count(*)::int n,min(number)::text first,max(number)::text last from private.subscriber_numbers where org_id=$1',[org])).rows[0];assert.deepEqual(assigned,{n:100,first:'1001',last:'1100'});
  });
  await t.test('Advanced CRM and event feature gate applies even when old catalog contains all features',async()=>{
   const basicLeads=await invoke('leads_list_v1',{page:{limit:10}});assert(Array.isArray(basicLeads.items));
   await reject('crm_followup_list_v1',{kind:'renewal_due',page:{limit:10}},'PLAN_FEATURE_UNAVAILABLE');
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
   const repaired=(await invoke('product_publish_v1',{product_id:legacyProduct,terms})).primary_id;assert.notEqual(repaired,legacyVersion);
   await reject('sale_preview_v1',{person_id:students[0],product_version_id:legacyVersion,start_date:'2026-01-01',end_date:'2027-01-01'},'PLAN_FEATURE_UNAVAILABLE');
   assert.equal((await db.query('select published_name from core.product_versions where id=$1',[legacyVersion])).rows[0].published_name,'Legacy incompatible name');
   assert.equal((await db.query('select name from core.products where id=$1',[legacyProduct])).rows[0].name,terms.name);

  });
});

