import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Room configuration and scoped role reads through real Auth/API',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('room-owner'),stranger=await authUser('room-stranger');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Room roles',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'First',timezone:'Europe/Istanbul'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Second',timezone:'Europe/Istanbul'},key())).primary_id;
 const db=await connect(),scope=b=>({org_id:org,center_id:center,...b});
 const mutate=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 let trigger,room;
 try{
 await mutate('center_manager_assign_v1',{person_id:ownerPerson});
 const pay=await mutate('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic rooms',occurred_at:new Date().toISOString()});
 await must(platform,'saas_payment_verify_v1',scope({payment_id:pay.primary_id,accepted:true}),key());
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;
 const second=(await must(owner,'discipline_save_v1',{org_id:org,name:'Tango',state:'active'},key())).primary_id;
 await mutate('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 await mutate('center_discipline_set_v1',{discipline_id:second,state:'active'});
 const capacities=[{discipline_id:discipline,nominal:8,maximum:10},{discipline_id:second,nominal:4,maximum:6}];
 await t.test('create and exact replay produce one room, audit and outbox',async()=>{
  const k=key(),body={name:'Studio A',capacities};const a=await mutate('room_save_v1',body,k);room=a.primary_id;
  assert.equal(a.version,1);assert.equal((await mutate('room_save_v1',body,k)).primary_id,room);assert.equal((await mutate('room_save_v1',body,k)).replayed,true);
  assert.equal((await rows('select count(*)::int n from core.room_capacities where room_id=$1',[room]))[0].n,2);
  assert.equal((await rows('select count(*)::int n from core.audit_events where operation_id=$1',[a.operation_id]))[0].n,1);
  assert.equal((await rows('select count(*)::int n from core.outbox_jobs where dedupe_key=$1',[a.operation_id]))[0].n,1);
  await fail('room_save_v1',{...body,name:'changed'},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
 });
 await t.test('create/update distinction, semantic validation and discipline scope',async()=>{
  await fail('room_save_v1',{name:'bad',capacities,expected_version:1},'VERSION_CONFLICT');
  await fail('room_save_v1',{room_id:room,name:'bad',capacities},'VERSION_CONFLICT');
  await fail('room_save_v1',{name:'bad',capacities:[capacities[0],capacities[0]]},'VALIDATION_FAILED');
  await fail('room_save_v1',{name:'bad',capacities:[{...capacities[0],nominal:11}]},'VALIDATION_FAILED');
  await fail('room_save_v1',{name:'bad',capacities:[{...capacities[0],discipline_id:key()}]},'NOT_FOUND');
  await mutate('center_discipline_set_v1',{discipline_id:second,state:'inactive',expected_version:1});
  await fail('room_save_v1',{name:'bad',capacities:[capacities[1]]},'NOT_FOUND');
  await mutate('center_discipline_set_v1',{discipline_id:second,state:'active',expected_version:2});
 });
 await t.test('update preserves retained capacity identity, removes omitted definitions and versions once',async()=>{
  const old=(await rows('select id from core.room_capacities where room_id=$1 and discipline_id=$2',[room,discipline]))[0].id;
  const b={room_id:room,expected_version:1,name:'Studio renamed',capacities:[{...capacities[0],nominal:7}]},k=key();
  assert.equal((await mutate('room_save_v1',b,k)).version,2);assert.equal((await mutate('room_save_v1',b,k)).replayed,true);
  const c=await rows('select id,version,nominal from core.room_capacities where room_id=$1',[room]);assert.equal(c.length,1);assert.equal(c[0].id,old);assert.equal(c[0].nominal,'7');assert.equal(c[0].version,'2');
  await fail('room_save_v1',b,'VERSION_CONFLICT');
 });
 await t.test('concurrent updates share the room version and only one succeeds',async()=>{
  const rs=await Promise.all(['one','two'].map(name=>call(owner,'room_save_v1',scope({room_id:room,expected_version:2,name,capacities}),key())));
  assert.equal(rs.filter(x=>x.result.ok).length,1);assert.equal(rs.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
  assert.equal((await rows('select version from core.rooms where id=$1',[room]))[0].version,'3');
 });
 await t.test('late audit failure rolls back room, capacities, receipt and notifications; retry succeeds',async()=>{
  const snapshot=async()=>JSON.stringify({room:await rows('select * from core.rooms where id=$1',[room]),caps:await rows('select * from core.room_capacities where room_id=$1 order by id',[room]),audit:await rows('select id from core.audit_events where org_id=$1 order by id',[org]),outbox:await rows('select id from core.outbox_jobs where org_id=$1 order by id',[org])});
  const before=await snapshot(),k=key(),b={room_id:room,expected_version:3,name:'Rollback',capacities:[]};
  trigger='rooms_'+key().replaceAll('-','');
  await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='room_save_v1') execute function private."+trigger+'()');
  await fail('room_save_v1',b,'INTEGRITY_VIOLATION',owner,k);assert.equal(await snapshot(),before);
  assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]))[0].n,0);
  await db.query('drop trigger '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');trigger=null;
  assert.equal((await mutate('room_save_v1',b,k)).version,4);assert.equal((await mutate('room_save_v1',b,k)).replayed,true);
 });
 await t.test('room writes require assigned center and conceal foreign tenant',async()=>{
  await fail('room_save_v1',{center_id:other,name:'denied',capacities:[]},'FORBIDDEN');
  await fail('room_save_v1',{name:'denied',capacities:[]},'NOT_FOUND',stranger);
  await fail('room_save_v1',{center_id:null,name:'denied',capacities:[]},'FORBIDDEN');
  await fail('room_save_v1',{room_id:key(),expected_version:1,name:'missing',capacities:[]},'NOT_FOUND');
 });
 await mutate('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
 async function linked(label,role,c=center){
  const p=(await mutate('person_create_v1',{center_id:c,display_name:label,contacts:[]})).primary_id;
  const u=await authUser(label),a=await must(u,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,p]);
  const grant=await mutate(role==='org_manager'?'org_manager_assign_v1':role==='center_manager'?'center_manager_assign_v1':'role_assign_v1',{center_id:c,person_id:p,...(['org_manager','center_manager'].includes(role)?{}:{role,scope:{center_id:c}})});
  return {u,p,grant};
 }
 const manager=await linked('rooms-manager','center_manager'),student=await linked('rooms-student','student'),instructor=await linked('rooms-instructor','instructor'),orgManager=await linked('rooms-org-manager','org_manager');
 const remote=await linked('rooms-other-staff','staff',other);
 const list=(u,b={})=>must(u,'roles_list_v1',{org_id:org,page:{},...b});
 await t.test('organization readers see all assignments; center manager excludes other center and org-level roles',async()=>{
  const all=await list(owner);assert(all.items.some(x=>x.id===orgManager.grant.primary_id));assert(all.items.some(x=>x.id===remote.grant.primary_id));assert(Number.isFinite(Date.parse(all.as_of)));
  assert.deepEqual((await list(orgManager.u)).items,all.items);
  const scoped=await list(manager.u);assert(scoped.items.length>0);assert(scoped.items.every(x=>x.scope_center_id===center));
  assert(!(await list(manager.u,{person_id:remote.p})).items.length);
  await fail('roles_list_v1',{center_id:other,page:{}},'FORBIDDEN',manager.u);
 });
 await t.test('student, instructor and foreign tenant cannot list roles or configure rooms',async()=>{
  for(const u of [student.u,instructor.u]){
   await fail('roles_list_v1',{center_id:null,page:{}},'FORBIDDEN',u);
   await fail('room_save_v1',{name:'denied',capacities:[]},'FORBIDDEN',u);
  }
  await fail('roles_list_v1',{center_id:null,page:{}},'NOT_FOUND',stranger);
 });
 await t.test('pagination is deterministic for equal timestamps, filters and cursor scope',async()=>{
  await db.query("update core.role_assignments set created_at='2026-01-01T00:00:00Z' where org_id=$1",[org]);
  const expected=(await list(owner)).items.map(x=>x.id),ids=[];let cursor;
  do {const page=await list(owner,{page:{limit:1,...(cursor?{cursor}:{})}});assert.equal(page.items.length,1);ids.push(page.items[0].id);cursor=page.next_cursor;}while(cursor);
  assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
  const first=await list(owner,{page:{limit:1}});assert(first.next_cursor);
  await fail('roles_list_v1',{center_id:null,page:{cursor:first.next_cursor},person_id:student.p},'VALIDATION_FAILED');
  await fail('roles_list_v1',{center_id:null,page:{cursor:first.next_cursor}},'VALIDATION_FAILED',manager.u);
  await fail('roles_list_v1',{center_id:null,page:{cursor:'bad'}},'VALIDATION_FAILED');
  await fail('roles_list_v1',{center_id:null,page:{sort:'display_name_asc'}},'VALIDATION_FAILED');
  const single=await list(owner,{person_id:student.p});assert(single.items.every(x=>x.person_id===student.p));assert.equal(single.items.length,1);
 });
 await t.test('unscoped CM list excludes inactive and plan-inaccessible centers',async()=>{
  await db.query("update core.centers set state='inactive' where id=$1",[center]);
  try {await fail('roles_list_v1',{center_id:null,page:{}},'FORBIDDEN',manager.u);}
  finally {await db.query("update core.centers set state='active' where id=$1",[center]);}
  assert((await list(manager.u)).items.every(x=>x.scope_center_id===center));
  const otherManager=await linked('rooms-other-manager','center_manager',other);
  await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
  try {
   await fail('roles_list_v1',{center_id:null,page:{}},'FORBIDDEN',otherManager.u);
   assert((await list(owner)).items.some(x=>x.id===otherManager.grant.primary_id));
   assert((await list(manager.u)).items.every(x=>x.scope_center_id===center));
  }finally {await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);}
 });
 await t.test('reads create no domain mutations and revoked manager cannot reuse cursor',async()=>{
  const count=async()=>JSON.stringify(await rows('select (select count(*) from core.audit_events where org_id=$1) a,(select count(*) from core.operation_receipts where org_id=$1) r,(select count(*) from core.outbox_jobs where org_id=$1) o',[org]));
  const before=await count();const first=await list(manager.u,{page:{limit:1}});assert(first.next_cursor);assert.equal(await count(),before);
  await mutate('center_manager_revoke_v1',{person_id:manager.p,expected_version:1,reason:'synthetic revoke'});
  await fail('roles_list_v1',{center_id:null,page:{cursor:first.next_cursor}},'FORBIDDEN',manager.u);
  await fail('room_save_v1',{room_id:room,expected_version:4,name:'denied',capacities:[]},'FORBIDDEN',manager.u);
  assert.equal((await list(owner,{person_id:manager.p})).items[0].state,'inactive');
 });
 }finally{
  if(trigger){await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function if exists private.'+trigger+'()');}
  await db.end();
 }
});
