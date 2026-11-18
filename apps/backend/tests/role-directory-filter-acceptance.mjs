import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {authUser,must,call} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('W1-BE-35 role and state filters precede paging and preserve native manager visibility and commands',async t=>{
 const f=await preparationFixture({studentUser:true,studentMembership:true});
 const {db,org,center,api,owner,student,studentPerson}=f;t.after(()=>db.end());
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Synthetic remote team',timezone:'UTC'},key())).primary_id;
 const ownerPerson=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
 await api('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
 await api('role_assign_v1',{person_id:studentPerson,role:'student',scope:{center_id:center}});
 const linked=async(label,role,scope=center)=>{
  const user=await authUser(label.toLowerCase().replaceAll(' ','-')),account=await must(user,'account_get_v1');
  const person=(await api('person_create_v1',{display_name:label,contacts:[]})).primary_id;
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,person]);
  const grant=await api(role==='org_manager'?'org_manager_assign_v1':'center_manager_assign_v1',{center_id:scope,person_id:person});
  return {user,person,grant};
 };
 const cm=await linked('Synthetic team CM','center_manager');
 const remote=await linked('Synthetic remote CM','center_manager',other);
 const om=await linked('Synthetic team OM','org_manager');
 const omOrganizations=await must(om.user,'organizations_list_v1',{page:{},include_self_management_scope:true});
 assert.deepEqual(omOrganizations.items.find(item=>item.id===org)?.self_management_scope,
  {owner:false,org_manager:true,managed_center_ids:[]});
 const retired=await linked('Synthetic former OM','org_manager');
 const read=(body={},user=owner)=>must(user,'roles_list_v1',{org_id:org,page:{},...body});
 const reject=async(body,code,user=owner)=>{
  const {result}=await call(user,'roles_list_v1',{org_id:org,page:{},...body});
  assert.equal(result.ok,false);assert.equal(result.error.code,code);
 };
 const allBefore=await read();
 const retiredRole=allBefore.items.find(x=>x.id===retired.grant.primary_id);
 await api('org_manager_revoke_v1',{person_id:retired.person,expected_version:retiredRole.version,reason:'Synthetic team history'});
 const expected=async(role,state,scope)=> (await db.query('select id from core.role_assignments where org_id=$1 and role=$2 and ($3::text is null or state=$3) and ($4::uuid is null or scope_center_id=$4) order by created_at,id',[org,role,state??null,scope??null])).rows.map(x=>x.id);
 const all=await read(),allIds=all.items.map(x=>x.id);
 for(const state of ['active','inactive']){
  const result=await read({role:'org_manager',state,page:{limit:1}});
  assert.deepEqual(result.items.map(x=>x.id),await expected('org_manager',state));
  assert.equal(result.next_cursor,null);assert.equal(result.items.length,1);
 }
 const first=await read({role:'org_manager',page:{limit:1}});
 assert(first.next_cursor);assert.equal(first.items.length,1);
 const next=await read({role:'org_manager',page:{limit:1,cursor:first.next_cursor}});
 assert.equal(next.next_cursor,null);assert.deepEqual([...first.items,...next.items].map(x=>x.id),await expected('org_manager'));
 assert([...first.items,...next.items].every(x=>allIds.includes(x.id)));
 assert.deepEqual((await read({role:'org_manager',state:'active',person_id:om.person})).items.map(x=>x.id),[om.grant.primary_id]);
 assert.deepEqual((await read({center_id:center,role:'org_manager'})).items,[]);
 assert.deepEqual((await read({role:'owner'})).items,[]); // Ownership is not synthesized as a stored assignment.
 const centered=await read({center_id:center,role:'center_manager',state:'active'});
 assert.deepEqual(centered.items.map(x=>x.id),await expected('center_manager','active',center));
 assert(!centered.items.some(x=>x.id===remote.grant.primary_id));
 for(const body of [{role:'center_manager'},{role:'org_manager',state:'active'},{role:'org_manager',person_id:om.person},{role:'org_manager',center_id:center}])await reject({...body,page:{cursor:first.next_cursor}},'VALIDATION_FAILED');
 await reject({role:'org_manager',page:{cursor:first.next_cursor}},'VALIDATION_FAILED',om.user);
 const cmFirst=await read({role:'center_manager',state:'active',page:{limit:1}},cm.user);
 assert(cmFirst.next_cursor);assert(cmFirst.items.every(x=>x.scope_center_id===center));
 assert.deepEqual((await read({role:'org_manager'},cm.user)).items,[]);
 await reject({center_id:other,role:'center_manager'},'FORBIDDEN',cm.user);
 await reject({role:'center_manager'},'FORBIDDEN',student);
 await api('role_assign_v1',{person_id:studentPerson,role:'staff',scope:{center_id:center}});
 await reject({role:'center_manager'},'FORBIDDEN',student);
 const badAssign=await call(student,'center_manager_assign_v1',{org_id:org,center_id:center,person_id:studentPerson},key());
 assert.equal(badAssign.result.ok,false);assert.equal(badAssign.result.error.code,'FORBIDDEN');
 const operational=await call(owner,'role_assign_v1',{org_id:org,center_id:center,person_id:studentPerson,role:'center_manager',scope:{center_id:center}},key());
 assert.equal(operational.result.ok,false);assert.equal(operational.result.error.code,'VALIDATION_FAILED');
 const foreign=await authUser('synthetic-foreign-team');await reject({role:'org_manager'},'NOT_FOUND',foreign);
 const safe=JSON.stringify(centered);for(const hidden of ['account_id','auth_user_id','token'])assert(!safe.includes(hidden));
 const before=(await db.query('select (select count(*) from core.role_assignments where org_id=$1) roles,(select count(*) from core.audit_events where org_id=$1) audits,(select count(*) from core.operation_receipts where org_id=$1) receipts',[org])).rows[0];
 await read({role:'center_manager',state:'active'});
 assert.deepEqual((await db.query('select (select count(*) from core.role_assignments where org_id=$1) roles,(select count(*) from core.audit_events where org_id=$1) audits,(select count(*) from core.operation_receipts where org_id=$1) receipts',[org])).rows[0],before);
 const cmRole=(await read({person_id:cm.person,role:'center_manager'})).items[0];
 await api('center_manager_revoke_v1',{person_id:cm.person,expected_version:cmRole.version,reason:'Synthetic live revocation'});
 await reject({role:'center_manager',state:'active',page:{cursor:cmFirst.next_cursor}},'FORBIDDEN',cm.user);
 await db.query("update core.saas_plan_versions set features=array_remove(features,'F05') where id=$1",[f.plan]);
 try{await reject({role:'org_manager'},'PLAN_FEATURE_UNAVAILABLE');}finally{await db.query("update core.saas_plan_versions set features=features||array['F05'] where id=$1",[f.plan]);}
});

test('W1-BE-42 native Starter self scope preserves live management authority and F05',async t=>{
 const f=await preparationFixture({studentUser:true,studentMembership:true});
 const {db,org,center,api,owner,student,studentPerson}=f;
 t.after(()=>db.end());
 const manager=await authUser('starter-self-manager'),account=await must(manager,'account_get_v1');
 const person=(await api('person_create_v1',{display_name:'Synthetic Starter center manager',contacts:[]})).primary_id;
 await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",
  [key(),org,account.id,person]);
 const grant=await api('center_manager_assign_v1',{person_id:person});
 const listing=async(user,option={include_self_management_scope:true})=>(await must(user,'organizations_list_v1',{page:{},...option})).items;
 const own=async(user,option)=>(await listing(user,option)).find(item=>item.id===org);
 const read=async user=>(await own(user))?.self_management_scope;
 const ownerScope={owner:true,org_manager:false,managed_center_ids:[center]};
 const managerScope={owner:false,org_manager:false,managed_center_ids:[center]};
 assert.deepEqual(await read(owner),ownerScope);
 assert.deepEqual(await read(manager),managerScope);
 assert.equal(await read(student),null);
 assert.deepEqual((await own(student)).self_context.centers.map(item=>item.center_id),[center]);
 const outsider=await authUser('starter-self-outsider');
 assert.equal(await own(outsider),undefined);
 const legacy=await own(owner,{});
 assert(!Object.hasOwn(legacy,'self_management_scope'));
 assert.deepEqual(await own(owner,{include_self_management_scope:false}),legacy);
 const suppliedPerson=await call(manager,'organizations_list_v1',{page:{},include_self_management_scope:true,person_id:studentPerson});
 assert.equal(suppliedPerson.result.error?.code,'VALIDATION_FAILED');

 const directory=(user,target)=>call(user,'roles_list_v1',{org_id:org,page:{},person_id:target});
 const assertStarterGate=async()=>{
  for(const [user,target] of [[owner,person],[manager,person],[manager,studentPerson]]){
   assert.equal((await directory(user,target)).result.error?.code,'PLAN_FEATURE_UNAVAILABLE');
  }
 };
 await assertStarterGate();
 const staff=await call(owner,'role_assign_v1',{org_id:org,center_id:center,person_id:studentPerson,role:'staff',scope:{center_id:center}},key());
 assert.equal(staff.result.error?.code,'PLAN_FEATURE_UNAVAILABLE');

 await api('center_manager_revoke_v1',{person_id:person,expected_version:grant.version,reason:'Synthetic live scope revocation'});
 assert.equal(await read(manager),null);
 assert.deepEqual(await read(owner),ownerScope);
 await api('center_manager_assign_v1',{person_id:person});
 assert.deepEqual(await read(manager),managerScope);

 // Reuse the same authenticated sessions before and after the effective plan
 // changes. The older first center is the kept center for this fixture.
 await db.query("update core.saas_plan_versions set name='business' where id=$1",[f.plan]);
 const remote=(await must(owner,'center_create_v1',{org_id:org,name:'Synthetic second managed center',timezone:'UTC'},key())).primary_id;
 assert.deepEqual(await read(owner),ownerScope);
 assert.deepEqual((await own(owner)).self_context.centers.map(x=>x.center_id),[center,remote].sort());
 await api('center_manager_assign_v1',{center_id:remote,person_id:person});
 assert.deepEqual(await read(manager),{...managerScope,managed_center_ids:[center,remote].sort()});
 assert((await directory(owner,person)).result.ok);
 await db.query("update core.saas_plan_versions set name='starter' where id=$1",[f.plan]);
 assert.deepEqual(await read(manager),managerScope);
 assert.deepEqual((await own(owner)).self_context.centers.map(x=>x.center_id),[center]);
 await assertStarterGate();
});
