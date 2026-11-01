import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';
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
 const capacity=10;
 await t.test('create and exact replay produce one room, audit and outbox',async()=>{
  const k=key(),body={name:'Studio A',capacity};const a=await mutate('room_save_v1',body,k);room=a.primary_id;
  assert.equal(a.version,1);assert.equal((await mutate('room_save_v1',body,k)).primary_id,room);assert.equal((await mutate('room_save_v1',body,k)).replayed,true);
  assert.equal((await rows('select capacity from core.rooms where id=$1',[room]))[0].capacity,'10');
  assert.equal((await rows('select count(*)::int n from core.audit_events where operation_id=$1',[a.operation_id]))[0].n,1);
  assert.equal((await rows('select count(*)::int n from core.outbox_jobs where dedupe_key=$1',[a.operation_id]))[0].n,1);
  await fail('room_save_v1',{...body,name:'changed'},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
 });
 await t.test('create/update distinction, semantic validation and discipline scope',async()=>{
  await fail('room_save_v1',{name:'bad',capacity,expected_version:1},'VERSION_CONFLICT');
  await fail('room_save_v1',{room_id:room,name:'bad',capacity},'VERSION_CONFLICT');
  await fail('room_save_v1',{name:'bad',capacity:-1},'VALIDATION_FAILED');
  await fail('room_save_v1',{name:'bad',capacity:null},'VALIDATION_FAILED');
 });
 await t.test('physical capacity update versions once without discipline capacity mutation',async()=>{
  const b={room_id:room,expected_version:1,name:'Studio renamed',capacity:7},k=key();
  assert.equal((await mutate('room_save_v1',b,k)).version,2);assert.equal((await mutate('room_save_v1',b,k)).replayed,true);
  assert.equal((await rows('select capacity from core.rooms where id=$1',[room]))[0].capacity,'7');
  await fail('room_save_v1',b,'VERSION_CONFLICT');
 });
 await t.test('concurrent updates share the room version and only one succeeds',async()=>{
  const rs=await Promise.all(['one','two'].map(name=>call(owner,'room_save_v1',scope({room_id:room,expected_version:2,name,capacity}),key())));
  assert.equal(rs.filter(x=>x.result.ok).length,1);assert.equal(rs.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
  assert.equal((await rows('select version from core.rooms where id=$1',[room]))[0].version,'3');
 });
 await t.test('late audit failure rolls back room, capacities, receipt and notifications; retry succeeds',async()=>{
  const snapshot=async()=>JSON.stringify({room:await rows('select * from core.rooms where id=$1',[room]),caps:await rows('select * from core.room_capacities where room_id=$1 order by id',[room]),audit:await rows('select id from core.audit_events where org_id=$1 order by id',[org]),outbox:await rows('select id from core.outbox_jobs where org_id=$1 order by id',[org])});
  const before=await snapshot(),k=key(),b={room_id:room,expected_version:3,name:'Rollback',capacity:10};
  trigger='rooms_'+key().replaceAll('-','');
  await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='room_save_v1') execute function private."+trigger+'()');
  await fail('room_save_v1',b,'INTEGRITY_VIOLATION',owner,k);assert.equal(await snapshot(),before);
  assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]))[0].n,0);
  await db.query('drop trigger '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');trigger=null;
  assert.equal((await mutate('room_save_v1',b,k)).version,4);assert.equal((await mutate('room_save_v1',b,k)).replayed,true);
 });
 await t.test('room writes require assigned center and conceal foreign tenant',async()=>{
  await fail('room_save_v1',{center_id:other,name:'denied',capacity:10},'FORBIDDEN');
  await fail('room_save_v1',{name:'denied',capacity:10},'NOT_FOUND',stranger);
  await fail('room_save_v1',{center_id:null,name:'denied',capacity:10},'FORBIDDEN');
  await fail('room_save_v1',{room_id:key(),expected_version:1,name:'missing',capacity:10},'NOT_FOUND');
 });
 await t.test('new login discovers rooms and edits from the current projection without the create response',async()=>{
  const {env}=context();
  const response=await fetch(env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:owner.email,password:owner.password}),signal:AbortSignal.timeout(60000)});
  assert.equal(response.ok,true);const session=await response.json(),reader={...owner,jwt:session.access_token};
  const read=body=>must(reader,'management_state_get_v1',scope({operation:'room_save_v1',selector:{operation:'room_save_v1',key:{}},page:{},...body}));
  const page=await read({});const found=page.items.find(x=>x.current.values.name==='Rollback');assert(found);
  const detail=await read({selector:{operation:'room_save_v1',key:{room_id:found.entity.id}}});
  assert.equal(detail.items.length,1);assert.deepEqual(detail.items[0].current.values,found.current.values);
  assert.equal(found.versions[0].version,4);assert.equal(found.entity.id,room);
  const values=detail.items[0].current.values,version=detail.items[0].versions[0].version;
  const changed=await mutate('room_save_v1',{...values,name:'Discovered room',expected_version:version},key(),reader);
  assert.equal(changed.version,version+1);
  const reread=await read({selector:{operation:'room_save_v1',key:{room_id:found.entity.id}}});
  assert.equal(reread.items[0].current.values.name,'Discovered room');assert.equal(reread.items[0].versions[0].version,changed.version);
  await fail('room_save_v1',{...values,name:'Stale write',expected_version:version},'VERSION_CONFLICT',reader);
 });
 await t.test('room discovery paginates equal timestamps and binds cursor to the selector and live scope',async()=>{
  const secondRoom=(await mutate('room_save_v1',{name:'Second discovered room',capacity:8})).primary_id;
  await db.query("update core.rooms set created_at='2026-01-01T00:00:00Z' where org_id=$1 and center_id=$2",[org,center]);
  const request={operation:'room_save_v1',selector:{operation:'room_save_v1',key:{}},page:{limit:1}};
  const first=await must(owner,'management_state_get_v1',scope(request));assert.equal(first.items.length,1);assert(first.next_cursor);
  const next=await must(owner,'management_state_get_v1',scope({...request,page:{limit:1,cursor:first.next_cursor}}));
  assert.equal(next.items.length,1);assert.equal(next.next_cursor,null);
  assert.deepEqual([first.items[0].entity.id,next.items[0].entity.id],[room,secondRoom].sort());
  await fail('management_state_get_v1',{...request,selector:{operation:'room_save_v1',key:{room_id:room}},page:{cursor:first.next_cursor}},'VALIDATION_FAILED');
  await fail('management_state_get_v1',{...request,page:{cursor:'bad'}},'VALIDATION_FAILED');
  await fail('management_state_get_v1',{...request,page:{sort:'display_name_asc'}},'VALIDATION_FAILED');
  await fail('management_state_get_v1',{...request,center_id:other},'FORBIDDEN');
  await fail('management_state_get_v1',request,'NOT_FOUND',stranger);
  const absent=await must(owner,'management_state_get_v1',scope({...request,selector:{operation:'room_save_v1',key:{room_id:key()}}}));assert.deepEqual(absent.items,[]);
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
   await fail('room_save_v1',{name:'denied',capacity:10},'FORBIDDEN',u);
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
  // Pro retains F05 but is single-center: test scope isolation independently of the feature gate.
  await db.query("update core.saas_plan_versions set name='pro' where id=$1",[plan]);
  try {
   await fail('roles_list_v1',{center_id:null,page:{}},'FORBIDDEN',otherManager.u);
   assert((await list(owner)).items.some(x=>x.id===otherManager.grant.primary_id));
   assert((await list(manager.u)).items.every(x=>x.scope_center_id===center));
   // Starter closes the general F05 role list even for an otherwise authorized owner/manager.
   await db.query("update core.saas_plan_versions set name='starter' where id=$1",[plan]);
   for(const actor of [owner,manager.u,otherManager.u])
    await fail('roles_list_v1',{center_id:null,page:{}},'PLAN_FEATURE_UNAVAILABLE',actor);
  }finally {await db.query("update core.saas_plan_versions set name='business' where id=$1",[plan]);}
 });
 await t.test('reads create no domain mutations and revoked manager cannot reuse cursor',async()=>{
  const count=async()=>JSON.stringify(await rows('select (select count(*) from core.audit_events where org_id=$1) a,(select count(*) from core.operation_receipts where org_id=$1) r,(select count(*) from core.outbox_jobs where org_id=$1) o',[org]));
  const before=await count();const first=await list(manager.u,{page:{limit:1}});assert(first.next_cursor);assert.equal(await count(),before);
  await mutate('center_manager_revoke_v1',{person_id:manager.p,expected_version:1,reason:'synthetic revoke'});
  await fail('roles_list_v1',{center_id:null,page:{cursor:first.next_cursor}},'FORBIDDEN',manager.u);
  await fail('room_save_v1',{room_id:room,expected_version:4,name:'denied',capacity:10},'FORBIDDEN',manager.u);
  await fail('management_state_get_v1',{operation:'room_save_v1',selector:{operation:'room_save_v1',key:{room_id:room}}},'FORBIDDEN',manager.u);
  assert.equal((await list(owner,{person_id:manager.p})).items[0].state,'inactive');
 });
 }finally{
  if(trigger){await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function if exists private.'+trigger+'()');}
  await db.end();
 }
});
