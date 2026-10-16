import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Person registry real Auth/API authorization and contact privacy',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('people-owner');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'People',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'First',timezone:'Europe/Istanbul'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Second',timezone:'Europe/Istanbul'},key())).primary_id;
 const db=await connect(),scope=b=>({org_id:org,center_id:center,...b});
 const mutate=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,u=owner,k=key())=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 let trigger;
 try{
 await mutate('center_manager_assign_v1',{person_id:ownerPerson});await mutate('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
 const payment=await mutate('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic people',occurred_at:new Date().toISOString()});await must(platform,'saas_payment_verify_v1',scope({payment_id:payment.primary_id,accepted:true}),key());
 const create=async(name,c=center)=>{const id=(await mutate('person_create_v1',{display_name:name,contacts:[{kind:'email',value:name+'@ftksaas.invalid'}]})).primary_id;await mutate('student_activate_v1',{center_id:c,person_id:id});return id;};
 const p=await create('Student one'),p2=await create('Student two',other);
 async function loginPerson(label,pid,role){const user=await authUser(label),a=await must(user,'account_get_v1');await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,a.id,pid]);let grant;if(role)grant=await mutate(role==='center_manager'?'center_manager_assign_v1':'role_assign_v1',{person_id:pid,...(role==='center_manager'?{}:{role,scope:{center_id:center}})});return {user,grant};}
 const student=(await loginPerson('self',p)).user;
 const cmPerson=await create('Scoped manager'),{user:cm}=await loginPerson('cm',cmPerson,'center_manager');
 const instructorPerson=await create('Instructor'),{user:instructor,grant:instructorGrant}=await loginPerson('instructor',instructorPerson,'instructor');
 const outsider=await authUser('people-outsider');
 const get=(u,id,c=center)=>must(u,'person_get_v1',{org_id:org,center_id:c,person_id:id});
 await t.test('current manager scope, self scope and organization read scope are distinct',async()=>{
  assert.equal((await get(cm,p)).contacts[0].value,'Student one@ftksaas.invalid');
  const unassigned=(await mutate('person_create_v1',{center_id:other,display_name:'Unassigned',contacts:[]})).primary_id;
  await fail('person_get_v1',{person_id:unassigned},'NOT_FOUND',cm);await fail('person_update_v1',{person_id:unassigned,expected_version:1,patch:{display_name:'denied'}},'NOT_FOUND',cm);assert.equal((await get(owner,unassigned,null)).id,unassigned);
  const ownNew=(await mutate('person_create_v1',{display_name:'Same center new',contacts:[]})).primary_id;assert.equal((await get(cm,ownNew)).id,ownNew);await mutate('person_update_v1',{person_id:ownNew,expected_version:1,patch:{display_name:'Allowed before activation'}},key(),cm);
  await mutate('student_activate_v1',{person_id:ownNew});await mutate('student_deactivate_v1',{person_id:ownNew,reason:'synthetic inactive'});
  await fail('person_get_v1',{person_id:ownNew},'NOT_FOUND',cm);await fail('person_update_v1',{person_id:ownNew,expected_version:2,patch:{display_name:'denied'}},'NOT_FOUND',cm);
  const hidden=await must(cm,'people_list_v1',scope({query:'Allowed before activation',page:{}}));assert.deepEqual(hidden.items,[]);
  await fail('person_get_v1',{person_id:p2},'NOT_FOUND',cm);await fail('person_update_v1',{person_id:p2,expected_version:1,patch:{display_name:'denied'}},'NOT_FOUND',cm);
  assert.equal((await get(owner,p2,null)).id,p2);assert.equal((await get(student,p)).id,p);
  await fail('person_get_v1',{person_id:p2},'NOT_FOUND',student);await fail('person_update_v1',{person_id:p,expected_version:1,patch:{display_name:'denied'}},'FORBIDDEN',student);
  await fail('person_get_v1',{person_id:p},'NOT_FOUND',outsider);
  const own=await must(student,'people_list_v1',scope({page:{},relationship:null}));assert.deepEqual(own.items.map(x=>x.id),[p]);
 });
 await t.test('people list filters, stable cursor, other-center exclusion and closed response',async()=>{
  await db.query("update core.people set created_at='2026-01-01T00:00:00Z' where org_id=$1",[org]);
  const first=await must(cm,'people_list_v1',scope({page:{limit:1},query:'Student'}));assert.equal(first.items.length,1);assert.equal(first.items[0].id,p);assert.equal(first.next_cursor,null);
  const a=await must(owner,'people_list_v1',{org_id:org,page:{limit:1},query:'Student'});assert(a.next_cursor);
  const b=await must(owner,'people_list_v1',{org_id:org,page:{limit:1,cursor:a.next_cursor},query:'Student'});assert.deepEqual([a.items[0].id,b.items[0].id].sort(),[p,p2].sort());assert.equal(b.next_cursor,null);
  await fail('people_list_v1',{center_id:undefined,page:{cursor:a.next_cursor},query:'other'},'VALIDATION_FAILED');
  await fail('people_list_v1',{page:{cursor:'broken'}},'VALIDATION_FAILED');
 });
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;await mutate('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const cls=(await mutate('class_save_v1',{name:'People class',discipline_id:discipline,external_open:true})).primary_id;
 const at=Date.now()+86400000,session=(await mutate('session_create_v1',{class_id:cls,discipline_id:discipline,format:'group',interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()},resources:[],assignments:[{person_id:instructorPerson,duty:'instructor'}],capacity:{nominal:10,maximum:10}})).primary_id;
 const policy=key();await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[policy,org,center,{kind:'cancellation',cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}]);
 await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[key(),org,center,session,p,policy]);
 await t.test('assigned instructor receives necessary participant fields without contacts; revocation is immediate',async()=>{
  const view=await get(instructor,p);assert.equal(view.id,p);assert(!('contacts' in view));assert(view.relationships.every(x=>x.center_id===center));
  await fail('person_get_v1',{person_id:p2},'NOT_FOUND',instructor);
  const list=await must(instructor,'people_list_v1',scope({page:{},query:'Student'}));assert.deepEqual(list.items.map(x=>x.id),[p]);assert(!('contacts' in list.items[0]));
  await mutate('role_revoke_v1',{assignment_id:instructorGrant.primary_id,expected_version:1,reason:'synthetic revoke'});await fail('person_get_v1',{person_id:p},'NOT_FOUND',instructor);
 });
 await t.test('contact replacement preserves existing verification, clears new evidence and never changes Auth identity',async()=>{
  await db.query('update core.person_contacts set verified_at=$1 where org_id=$2 and person_id=$3',['2026-01-01T00:00:00Z',org,p]);
  const beforeIdentity=await rows('select auth_user_id from core.accounts where id=$1',[(await must(student,'account_get_v1')).id]);
  const k=key(),b={person_id:p,expected_version:1,patch:{display_name:'Updated student',contacts:[{kind:'email',value:'Student one@ftksaas.invalid'},{kind:'phone',value:'+905551234567'}]}};
  const a=await mutate('person_update_v1',b,k);assert.equal(a.version,2);assert.equal((await mutate('person_update_v1',b,k)).replayed,true);
  await fail('person_update_v1',b,'VERSION_CONFLICT');await fail('person_update_v1',{...b,patch:{display_name:'changed'}},'IDEMPOTENCY_PAYLOAD_MISMATCH',owner,k);
  const v=await get(student,p);assert.equal(v.display_name,'Updated student');assert(v.contacts.find(x=>x.kind==='email').verified_at);assert.equal(v.contacts.find(x=>x.kind==='phone').verified_at,null);
  assert.deepEqual(await rows('select auth_user_id from core.accounts where id=$1',[(await must(student,'account_get_v1')).id]),beforeIdentity);
 });
 await t.test('same expected person version admits one concurrent update',async()=>{
  const results=await Promise.all(['one','two'].map(display_name=>call(owner,'person_update_v1',scope({person_id:p,expected_version:2,patch:{display_name}}),key())));
  assert.equal(results.filter(x=>x.result.ok).length,1,JSON.stringify(results));assert.equal(results.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');assert.equal((await get(owner,p)).version,3);
 });
 await t.test('late audit failure restores removed contacts and version; exact key can retry',async()=>{
  const before=await get(owner,p),k=key(),b={person_id:p,expected_version:3,patch:{display_name:'Final',contacts:[]}};
  trigger='people_'+key().replaceAll('-','');await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='person_update_v1') execute function private."+trigger+'()');
  await fail('person_update_v1',b,'INTEGRITY_VIOLATION',owner,k);assert.deepEqual(await get(owner,p),before);
  assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]))[0].n,0);
  await db.query('drop trigger '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');trigger=null;
  assert.equal((await mutate('person_update_v1',b,k)).version,4);assert.deepEqual((await get(owner,p)).contacts,[]);
 });
 }finally{if(trigger){await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function if exists private.'+trigger+'()');}await db.end();}
});
