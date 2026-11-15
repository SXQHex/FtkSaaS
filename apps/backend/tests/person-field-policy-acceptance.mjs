import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationFixture} from './starter-preparation-fixture.mjs';
import {authUser,must,call} from './api-client.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Person field policies expose current ownership without account identity or write authority',{timeout:300000},async t=>{
 const f=await preparationFixture({studentUser:true,studentMembership:true}),{db,api,owner,org,center,student,studentPerson}=f;t.after(()=>db.end());
 const account=await must(student,'account_get_v1'),stranger=await authUser('field-policy-stranger');
 const read=pid=>api('person_get_v1',{person_id:pid});
 const update=async(pid,patch)=>api('person_update_v1',{person_id:pid,expected_version:(await read(pid)).version,patch});
 const deny=async(pid,patch)=>{const r=await call(owner,'person_update_v1',{org_id:org,center_id:center,person_id:pid,expected_version:(await read(pid)).version,patch},key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,'FORBIDDEN');};
 const policy=(source,writable)=>({source,person_update_writable:writable}),localMail='local-policy@ftksaas.invalid';
 const local=(await api('person_create_v1',{display_name:'Synthetic local policy',contacts:[{kind:'email',value:localMail}]})).primary_id;
 await t.test('local fields stay mutable; separate names have no person writer',async()=>{
  let p=await read(local);assert.deepEqual(p.field_policy,{display_name:policy('person',true),given_name:policy('person',false),family_name:policy('person',false)});assert.deepEqual(p.contacts[0].field_policy,policy('person',true));
  await update(local,{display_name:'Synthetic renamed local',contacts:[{kind:'email',value:'edited-policy@ftksaas.invalid'}]});p=await read(local);assert.equal(p.display_name,'Synthetic renamed local');assert.equal(p.contacts[0].value,'edited-policy@ftksaas.invalid');
 });
 await t.test('account name and native contact are protected; local verified rows stay mutable',async()=>{
  await update(studentPerson,{contacts:[{kind:'email',value:student.email},{kind:'email',value:localMail}]});
  // This is a local persisted-state fixture, not a native provider proof acceptance.
  await db.query('update core.person_contacts set verified_at=now() where org_id=$1 and person_id=$2 and value=$3',[org,studentPerson,localMail]);
  const p=await read(studentPerson);for(const field of ['display_name','given_name','family_name'])assert.deepEqual(p.field_policy[field],policy('account_profile',false));
  assert.deepEqual(p.contacts.find(c=>c.value===student.email).field_policy,policy('native_auth',false));assert.deepEqual(p.contacts.find(c=>c.value===localMail).field_policy,policy('person',true));
  const before=p.version;await deny(studentPerson,{display_name:'Cannot replace profile'});await deny(studentPerson,{contacts:[{kind:'email',value:localMail}]});assert.equal((await read(studentPerson)).version,before);
  await update(studentPerson,{contacts:[{kind:'email',value:student.email},{kind:'phone',value:'+905551234567'}]});assert((await read(studentPerson)).contacts.some(c=>c.value==='+905551234567'&&c.field_policy.person_update_writable));
 });
 await t.test('a local alias duplicate cannot make the same protected value editable',async()=>{
  const id=key(),alias=key();await db.query("insert into core.people(id,org_id,display_name,state,merged_into_id) values($1,$2,'Synthetic alias snapshot','merged',$3)",[alias,org,studentPerson]);await db.query("insert into core.person_contacts(id,org_id,person_id,kind,value,verified_at,created_at) values($1,$2,$3,'email',$4,now()+interval '1 minute',now()-interval '1 day')",[id,org,alias,student.email]);
  try{const p=await read(studentPerson),visible=p.contacts.filter(c=>c.kind==='email'&&c.value===student.email);assert.equal(visible.length,1);assert.deepEqual(visible[0].field_policy,policy('native_auth',false));await deny(studentPerson,{contacts:[]});}finally{await db.query('delete from core.person_contacts where id=$1',[id]);await db.query('delete from core.people where id=$1',[alias]);}
 });
 await t.test('list and detail agree, read only and without account identities or credentials',async()=>{
  const counts=async()=>(await db.query('select (select count(*) from core.audit_events where org_id=$1) a,(select count(*) from core.operation_receipts where org_id=$1) r,(select count(*) from core.outbox_jobs where org_id=$1) o',[org])).rows;
  const before=await counts(),p=await read(studentPerson),list=await api('people_list_v1',{query:p.display_name,page:{}}),row=list.items.find(x=>x.id===studentPerson);assert(row);assert.deepEqual(row.field_policy,p.field_policy);assert.deepEqual(row.contacts,p.contacts);assert.deepEqual(await counts(),before);
  const text=JSON.stringify(p);for(const secret of [account.id,student.id,student.jwt,student.password])assert(!text.includes(secret));
  const r=await call(stranger,'person_get_v1',{org_id:org,center_id:center,person_id:studentPerson});assert.equal(r.result.ok,false);assert(!JSON.stringify(r.result).includes('field_policy'));
  const injected=await call(owner,'person_update_v1',{org_id:org,center_id:center,person_id:studentPerson,expected_version:p.version,patch:{field_policy:{display_name:policy('person',true)}}},key());assert.equal(injected.result.ok,false);assert.equal(injected.result.error.code,'VALIDATION_FAILED');
 });
 await t.test('link revocation releases local editing; relink restores account ownership on fresh reads',async()=>{
  const link=(await db.query('select id from core.account_links where org_id=$1 and person_id=$2 and account_id=$3',[org,studentPerson,account.id])).rows[0].id;
  await db.query("update core.account_links set state='revoked' where id=$1",[link]);
  try{const p=await read(studentPerson);assert.deepEqual(p.field_policy.display_name,policy('person',true));assert(p.contacts.every(c=>c.field_policy.person_update_writable));await update(studentPerson,{display_name:'Local after revocation'});}finally{await db.query("update core.account_links set state='active' where id=$1",[link]);}
  const p=await read(studentPerson);assert.deepEqual(p.field_policy.display_name,policy('account_profile',false));assert.equal(p.display_name,account.display_name);assert.deepEqual(p.contacts.find(c=>c.value===student.email).field_policy,policy('native_auth',false));
 });
});
