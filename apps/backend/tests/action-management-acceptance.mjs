import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {authUser,must,call} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('XREQ023/024 action discovery reuses live writer authority without domain effects',{timeout:300000},async t=>{
 const f=await preparationFixture({schedule:true,studentUser:true,studentMembership:true,session:true});
 const {db,org,center,owner,student,studentPerson,person,discipline,plan,room,api,day}=f;t.after(()=>db.end());
 const scope=b=>({org_id:org,center_id:center,...b});
 const sessions=(await db.query('select id from core.sessions where org_id=$1 and center_id=$2 order by starts_at,id',[org,center])).rows;
 assert(sessions.length>0);const session=sessions[0].id;
 const product=(await api('product_publish_v1',{terms:{name:'Yoga · action discovery',kind:'credits',booking_mode:'flexible',credits:4,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'center_discipline',center_id:center,discipline_id:discipline,usage_targets:['lesson']}]}})).primary_id;
 const preview=await api('sale_preview_v1',{person_id:studentPerson,product_version_id:product,start_date:day(1),end_date:day(61)});
 const sale=(await api('sale_apply_v1',{preview:{id:preview.id,token:preview.token}})).primary_id;
 const debt=(await db.query('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale])).rows[0].id;
 const actions=[
  ['collection_record_v1',{person_id:studentPerson}],
  ['reservation_capacity_override_v1',{person_id:studentPerson,session_id:session}],
  ['student_credit_refund_v1',{person_id:studentPerson}],
  ['student_credit_offset_v1',{person_id:studentPerson,debt_id:debt}],
  ['debt_adjust_v1',{debt_id:debt}],
  ['sale_refund_preview_v1',{sale_id:sale}],
 ];
 const request=(op,k,extra={})=>scope({operation:op,selector:{operation:op,key:k},...extra});
 const read=(op,k,u=owner,extra={})=>must(u,'management_state_get_v1',request(op,k,extra));
 const denied=async(op,k,code,u=owner,extra={})=>{const result=await call(u,'management_state_get_v1',request(op,k,extra));assert.equal(result.result.ok,false);assert.equal(result.result.error.code,code,JSON.stringify(result.result));};
 const snapshot=async()=>{
  const tables=['people','sales','debts','debt_adjustments','cash_movements','debt_allocations','student_credit_movements','reservations','entitlement_allocations','entitlement_movements','previews','operation_receipts','audit_events','notifications'];
  const result={};for(const table of tables)result[table]=(await db.query('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),\'[]\') data from core.'+table+' x where org_id=$1',[org])).rows[0].data;
  return result;
 };
 await t.test('Starter CM discovers first collection and every typed action without money defaults or writes',async()=>{
  const before=await snapshot();assert.equal(before.cash_movements.length,0);
  for(const [op,k] of actions){
   const page=await read(op,k);assert.equal(page.items.length,1,op);const item=page.items[0];
   assert.equal(item.operation,op);assert.equal(item.current.operation,op);assert.deepEqual(item.current.values,k);
   assert.equal(item.exists,true);assert(item.versions[0].version>=1);assert.equal(page.next_cursor,null);
   assert.deepEqual((await read(op,k)).items[0].current,item.current);
  }
  assert.deepEqual(await snapshot(),before);
  assert.equal((await read('collection_record_v1',{person_id:person})).items.length,1);
  const source=(await read('collection_record_v1',{person_id:studentPerson})).items[0];
  await denied('collection_record_v1',{person_id:studentPerson},'NOT_FOUND',owner,{entity:{type:'people',id:key()}});
  assert.equal(source.entity.type,'people');assert.equal(source.entity.id,studentPerson);
  await denied('collection_record_v1',{person_id:studentPerson},'VALIDATION_FAILED',owner,{page:{sort:'created_at_desc'}});
 });
 await t.test('self and another tenant cannot turn finance reads into write authority',async()=>{
  const outsider=await authUser('action-outsider');
  for(const [op,k] of actions){await denied(op,k,'FORBIDDEN',student);await denied(op,k,'NOT_FOUND',outsider);}
  await denied('student_credit_offset_v1',{person_id:person,debt_id:debt},'NOT_FOUND');
 });
 await t.test('merged person selectors preserve exact input keys and canonical center scope',async()=>{
  const alias=(await api('person_create_v1',{display_name:'Synthetic old action identity',contacts:[]})).primary_id;
  await db.query("update core.people set state='merged',merged_into_id=$2,version=version+1 where org_id=$1 and id=$3",[org,studentPerson,alias]);
  for(const op of ['collection_record_v1','student_credit_refund_v1'])assert.deepEqual((await read(op,{person_id:alias})).items[0].current.values,{person_id:alias});
  assert.deepEqual((await read('student_credit_offset_v1',{person_id:alias,debt_id:debt})).items[0].current.values,{person_id:alias,debt_id:debt});
 });
 await t.test('discovery does not promise balance or physical capacity success',async()=>{
  const refund=await call(owner,'student_credit_refund_v1',scope({person_id:studentPerson,amount_minor:'1',currency:'TRY',occurred_at:new Date().toISOString(),reason:'Synthetic zero-credit rejection'}),key());
  assert.equal(refund.result.ok,false);assert.equal(refund.result.error.code,'INSUFFICIENT_STUDENT_CREDIT');
  assert.equal((await read('student_credit_refund_v1',{person_id:studentPerson})).items.length,1);
  await api('collection_record_v1',{person_id:studentPerson,debt_ids:[debt],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});
  // Authority discovery is independent of the writer's required policy. Prove
  // the missing-window guard, then publish the prerequisite before testing room capacity.
  const missingWindow=await call(owner,'reservation_capacity_override_v1',scope({...actions[1][1],mode:'flexible',reason:'Synthetic missing-window guard'}),key());
  assert.equal(missingWindow.result.ok,false);assert.equal(missingWindow.result.error.code,'POLICY_NOT_CONFIGURED');
  await api('policy_publish_v1',{center_id:null,key:'reservation_window',value:{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
  await db.query('update core.rooms set capacity=0 where org_id=$1 and id=$2',[org,room]);
  try{
   assert.equal((await read('reservation_capacity_override_v1',actions[1][1])).items.length,1);
   const result=await call(owner,'reservation_capacity_override_v1',scope({...actions[1][1],mode:'flexible',reason:'Synthetic physical room guard'}),key());
   assert.equal(result.result.ok,false);assert.equal(result.result.error.code,'CAPACITY_FULL');
  }finally{await db.query('update core.rooms set capacity=10 where org_id=$1 and id=$2',[org,room]);}
 });
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);
 const other=(await api('center_create_v1',{name:'Other action center',timezone:'UTC'})).primary_id;
 await api('center_manager_assign_v1',{center_id:other,person_id:person});
 await t.test('explicit other center and lost feature cannot reuse an authorized result',async()=>{
  for(const [op,k] of actions)await denied(op,k,'NOT_FOUND',owner,{center_id:other});
  await db.query("update core.saas_plan_versions set features=array_remove(features,'F15') where id=$1",[plan]);
  try{await denied(actions[1][0],actions[1][1],'PLAN_FEATURE_UNAVAILABLE');}finally{await db.query("update core.saas_plan_versions set features=array_append(features,'F15') where id=$1",[plan]);}
 });
 await t.test('Business cross-center source sale keeps the original capacity authority',async()=>{
  await api('center_discipline_set_v1',{center_id:other,discipline_id:discipline,state:'active'});
  await api('student_activate_v1',{center_id:other,person_id:studentPerson});
  const crossProduct=(await api('product_publish_v1',{center_id:other,terms:{name:'Cross-center discovery rights',kind:'credits',booking_mode:'flexible',credits:4,price_minor:'1600',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'credit_ratio'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson']}]}})).primary_id;
  const crossPreview=await api('sale_preview_v1',{center_id:other,person_id:studentPerson,product_version_id:crossProduct,start_date:day(1),end_date:day(61)});
  const crossSale=(await api('sale_apply_v1',{center_id:other,preview:{id:crossPreview.id,token:crossPreview.token}})).primary_id;
  const values={...actions[1][1],source_sale_id:crossSale};
  assert.deepEqual((await read(actions[1][0],values)).items[0].current.values,values);
  await denied(actions[1][0],{...values,source_sale_id:key()},'NOT_FOUND');
 });
 async function linked(label,role,activate=true){
  const p=(await api('person_create_v1',{display_name:label,contacts:[]})).primary_id;if(activate)await api('student_activate_v1',{person_id:p});
  const u=await authUser(label),account=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,p]);
  await api('role_assign_v1',{person_id:p,role,scope:{center_id:center}});return {p,u};
 }
 await t.test('explicit collector and override grants stay separate and are checked again after revocation',async()=>{
  const staff=await linked('action-collector','staff',false);
  const grant=async(permission,enabled)=>db.query('insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values($1,$2,$3,$4,$5,$6) on conflict(org_id,center_id,person_id,permission) do update set enabled=excluded.enabled',[key(),org,center,staff.p,permission,enabled]);
  await denied(actions[0][0],actions[0][1],'FORBIDDEN',staff.u);
  assert.equal((await db.query('select count(*)::int n from core.center_relationships where org_id=$1 and person_id=$2',[org,staff.p])).rows[0].n,0);
  await grant('finance.collect',true);assert.equal((await read(actions[0][0],actions[0][1],staff.u)).items.length,1);
  assert.equal((await read(actions[3][0],actions[3][1],staff.u)).items.length,1);
  assert.equal((await read(actions[0][0],{person_id:staff.p},staff.u)).items.length,1);
  for(const index of [2,4,5])await denied(actions[index][0],actions[index][1],'FORBIDDEN',staff.u);
  await denied(actions[1][0],actions[1][1],'FORBIDDEN',staff.u);
  await grant('reservation.capacity_override',true);assert.equal((await read(actions[1][0],actions[1][1],staff.u)).items.length,1);
  await grant('finance.collect',false);await grant('reservation.capacity_override',false);
  await denied(actions[0][0],actions[0][1],'FORBIDDEN',staff.u);await denied(actions[3][0],actions[3][1],'FORBIDDEN',staff.u);await denied(actions[1][0],actions[1][1],'FORBIDDEN',staff.u);
 });
 await t.test('only a live assigned instructor can discover the capacity exception',async()=>{
  const teacher=await linked('action-instructor','instructor');
  await denied(actions[1][0],actions[1][1],'FORBIDDEN',teacher.u);
  const assignment=key();await db.query("insert into core.session_assignments(id,org_id,center_id,session_id,person_id,duty,state) values($1,$2,$3,$4,$5,'instructor','active')",[assignment,org,center,session,teacher.p]);
  assert.equal((await read(actions[1][0],actions[1][1],teacher.u)).items.length,1);
  await db.query("update core.session_assignments set state='inactive' where id=$1",[assignment]);
  await denied(actions[1][0],actions[1][1],'FORBIDDEN',teacher.u);
 });
 await t.test('losing live manager and instructor roles closes previously discovered actions',async()=>{
  await db.query("update core.role_assignments set state='inactive',version=version+1 where org_id=$1 and person_id=$2 and scope_center_id=$3 and role in ('center_manager','instructor')",[org,person,center]);
  for(const [op,k] of actions)await denied(op,k,'FORBIDDEN');
 });

});
