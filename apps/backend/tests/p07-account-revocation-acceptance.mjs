// Existing registry shard. These use real Auth sessions and the Edge dispatcher.
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('P07 draft: scoped invitation and account-link revocation',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p07-owner'),member=await authUser('p07-member'),stranger=await authUser('p07-stranger');
 const account=await must(owner,'account_get_v1'),memberAccount=await must(member,'account_get_v1'),foreignAccount=await must(stranger,'account_get_v1');
 const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:foreignAccount.id,name:'P07 untouched org',initial_plan_id:plan},key())).primary_id;
 const foreignCenter=(await must(stranger,'center_create_v1',{org_id:foreignOrg,name:'P07 untouched center',timezone:'UTC'},key())).primary_id;
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P07 revocation',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'P07 A',timezone:'UTC'},key())).primary_id,other=(await must(owner,'center_create_v1',{org_id:org,name:'P07 B',timezone:'UTC'},key())).primary_id;
 const db=await connect();let trigger;
 const rows=async(q,a=[])=>(await db.query(q,a)).rows,scope=b=>({org_id:org,center_id:center,...b});
 const mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,k=key(),u=owner)=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const manage=(op,id)=>must(owner,'management_state_get_v1',scope({operation:op,selector:{operation:op,key:op==='account_link_remove_v1'?{link_id:id}:{invitation_id:id}}}));
 const invitation=async(person,at=center)=>{const id=key(),token=key();await db.query("insert into core.invitations(id,org_id,center_id,person_id,email,token_hash,inviter_account_id,expires_at,state) values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '7 days','pending')",[id,org,at,person,member.email,createHash('sha256').update(token).digest('hex'),account.id]);return {id,token};};
 try{
  const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
  const foreignPerson=(await rows('select owner_person_id from core.organizations where id=$1',[foreignOrg]))[0].owner_person_id,foreignInvite=key();
  await db.query("insert into core.invitations(id,org_id,center_id,person_id,email,token_hash,inviter_account_id,expires_at,state) values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()-interval '1 day','pending')",[foreignInvite,foreignOrg,foreignCenter,foreignPerson,stranger.email,createHash('sha256').update(key()).digest('hex'),foreignAccount.id]);
  await mut('center_manager_assign_v1',{person_id:ownerPerson});
  const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic P07',occurred_at:new Date().toISOString()});await must(platform,'saas_payment_verify_v1',scope({payment_id:pay.primary_id,accepted:true}),key());
  const person=(await mut('person_create_v1',{display_name:'P07 member',contacts:[]})).primary_id;
  const unrelatedPerson=(await mut('person_create_v1',{display_name:'P07 untouched',contacts:[]})).primary_id;
  const unrelatedInvite=await invitation(unrelatedPerson);
  const inv=await invitation(person),revokeKey=key(),revokeBody={invitation_id:inv.id,expected_version:1};
  await t.test('person selector discovers only scoped invitations, pages stably and rejects outsiders',async()=>{
   const extra=await invitation(person);
   const query={operation:'account_access_revoke_v1',selector:{operation:'account_access_revoke_v1',key:{person_id:person}},page:{limit:1}};
   const first=await must(owner,'management_state_get_v1',scope(query));assert.equal(first.items.length,1);assert(first.next_cursor);
   const next=await must(owner,'management_state_get_v1',scope({...query,page:{limit:1,cursor:first.next_cursor}}));assert.equal(next.items.length,1);assert.notEqual(first.items[0].entity.id,next.items[0].entity.id);
   assert.deepEqual(new Set([first.items[0].entity.id,next.items[0].entity.id]),new Set([inv.id,extra.id]));
   for(const row of [...first.items,...next.items]){assert.equal(row.current.values.person_id,person);assert.equal(row.current.values.actionable,true);assert.equal(row.versions[0].version,1);}
   const encoded=JSON.stringify(first);assert.equal(encoded.includes(member.email),false);assert.equal(encoded.includes(inv.token),false);assert.equal(encoded.includes('token_hash'),false);
   await fail('management_state_get_v1',query,'NOT_FOUND',key(),stranger);
   await fail('management_state_get_v1',{...query,center_id:other},'FORBIDDEN');
   await db.query("update core.invitations set state='revoked',version=version+1 where id=$1",[extra.id]);
   await fail('management_state_get_v1',{...query,page:{limit:1,cursor:first.next_cursor}},'VERSION_CONFLICT');
  });
  await t.test('versioned management read, wrong center, stale version, revoke and single receipt replay',async()=>{
   const m=(await manage('account_access_revoke_v1',inv.id)).items[0];assert.equal(m.state,'pending');assert.equal(m.versions[0].version,1);assert.equal(JSON.stringify(m).includes(member.email),false);
   await fail('account_access_revoke_v1',{...revokeBody,center_id:other},'NOT_FOUND');await fail('account_access_revoke_v1',{...revokeBody,expected_version:2},'VERSION_CONFLICT');
   const a=await mut('account_access_revoke_v1',revokeBody,revokeKey);assert.equal(a.version,2);assert.equal((await mut('account_access_revoke_v1',revokeBody,revokeKey)).replayed,true);
   await fail('account_access_revoke_v1',{...revokeBody,expected_version:2},'IDEMPOTENCY_PAYLOAD_MISMATCH',revokeKey);
   await fail('account_access_revoke_v1',{...revokeBody,expected_version:2},'INVITATION_UNAVAILABLE');
   assert.equal((await rows('select state from core.invitations where id=$1',[unrelatedInvite.id]))[0].state,'pending');
   assert.equal((await rows('select state from core.invitations where id=$1',[foreignInvite]))[0].state,'pending');
   const accept=await call(member,'account_access_accept_v1',{token:inv.token},key());assert.equal(accept.result.error.code,'INVITATION_UNAVAILABLE');
   assert.equal((await rows("select count(*)::int n from core.audit_events where org_id=$1 and action='account_access_revoke_v1'",[org]))[0].n,1);
  });
  await t.test('replay rechecks live authority and outsider cannot read or mutate this tenant',async()=>{
   await fail('account_access_revoke_v1',revokeBody,'NOT_FOUND',key(),stranger);
   const assignment=(await rows("select id from core.role_assignments where org_id=$1 and person_id=$2 and role='center_manager' and scope_center_id=$3 and state='active'",[org,ownerPerson,center]))[0].id;
   await db.query("update core.role_assignments set state='inactive',version=version+1 where id=$1",[assignment]);await fail('account_access_revoke_v1',revokeBody,'FORBIDDEN',revokeKey);
   await db.query("update core.role_assignments set state='active',version=version+1 where id=$1",[assignment]);
  });
  const accepted=await invitation(person);await must(member,'account_access_accept_v1',{token:accepted.token},key());
  const link=(await rows("select id from core.account_links where org_id=$1 and person_id=$2 and state='active'",[org,person]))[0].id;
  await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now()),($5,$2,$6,$4,'student','active',now())",[key(),org,center,person,key(),other]);
  await db.query("insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values($1,$2,$3,'staff',$4,'active',$5)",[key(),org,person,center,link]);
  await db.query("insert into core.permission_overrides(id,org_id,center_id,person_id,permission,enabled) values($1,$2,$3,$4,'person.manage',true)",[key(),org,center,person]);await db.query('insert into private.settlement_grants values($1,$2,$3,true,1)',[org,person,center]);
  const body={link_id:link,expected_version:1,reason:'Synthetic link revocation'},removeKey=key();
  await t.test('global link change requires every affected center and protects the owner',async()=>{
   await fail('account_link_remove_v1',body,'FORBIDDEN');
   const query={operation:'account_link_remove_v1',selector:{operation:'account_link_remove_v1',key:{person_id:person}}};
   const before=await must(owner,'management_state_get_v1',scope(query));assert.equal(before.items[0].entity.id,link);assert.equal(before.items[0].current.values.actionable,false);assert.equal(JSON.stringify(before).includes(memberAccount.id),false);

   await mut('center_manager_assign_v1',{center_id:other,person_id:ownerPerson});
   const ownerLink=(await rows("select id from core.account_links where org_id=$1 and person_id=$2 and state='active'",[org,ownerPerson]))[0].id;
   await fail('account_link_remove_v1',{link_id:ownerLink,expected_version:1,reason:'Owner must transfer first'},'OPEN_OPERATIONS_EXIST');
   assert.equal((await manage('account_link_remove_v1',link)).items[0].versions[0].version,1);
   const discovered=await must(owner,'management_state_get_v1',scope(query));assert.equal(discovered.items[0].current.values.actionable,true);
  });
  await t.test('late audit error rolls link, roles, grants, receipt and outbox back together',async()=>{
   trigger='p07_fail_'+key().replaceAll('-','');await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='account_link_remove_v1' then raise exception using errcode='23514',message='synthetic audit failure';end if;return new;end$$`);await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
   const before=(await rows('select count(*)::int n from core.outbox_jobs where org_id=$1',[org]))[0].n;await fail('account_link_remove_v1',body,'INTEGRITY_VIOLATION',removeKey);
   assert.equal((await rows('select state from core.account_links where id=$1',[link]))[0].state,'active');assert.equal((await rows('select enabled from core.permission_overrides where org_id=$1 and person_id=$2',[org,person]))[0].enabled,true);assert.equal((await rows('select granted from private.settlement_grants where org_id=$1 and person_id=$2',[org,person]))[0].granted,true);
   assert.equal((await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(removeKey).digest('hex')]))[0].n,0);assert.equal((await rows('select count(*)::int n from core.outbox_jobs where org_id=$1',[org]))[0].n,before);
   await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);trigger=null;
  });
  await t.test('old JWT loses org access; fresh accepted link never revives old grants',async()=>{
   await must(member,'centers_list_v1',{org_id:org,page:{}});assert.equal((await mut('account_link_remove_v1',body,removeKey)).version,2);assert.equal((await mut('account_link_remove_v1',body,removeKey)).replayed,true);
   assert.equal((await rows('select state from core.account_links where id=$1',[link]))[0].state,'revoked');
   assert.equal((await rows('select state from core.account_links where org_id=$1 and account_id=$2',[org,account.id]))[0].state,'active');
   assert.equal((await rows('select state from core.account_links where org_id=$1 and account_id=$2',[foreignOrg,foreignAccount.id]))[0].state,'active');
   const denied=await call(member,'centers_list_v1',{org_id:org,page:{}});assert.equal(denied.result.error.code,'NOT_FOUND');assert.equal((await must(member,'organizations_list_v1',{page:{}})).items.some(x=>x.id===org),false);
   const again=await invitation(person);await must(member,'account_access_accept_v1',{token:again.token},key());const newLink=(await rows("select id from core.account_links where org_id=$1 and person_id=$2 and state='active'",[org,person]))[0].id;assert.notEqual(newLink,link);
   assert.equal((await rows("select count(*)::int n from core.role_assignments where org_id=$1 and person_id=$2 and state='active'",[org,person]))[0].n,0);assert.equal((await rows('select enabled from core.permission_overrides where org_id=$1 and person_id=$2',[org,person]))[0].enabled,false);assert.equal((await rows('select granted from private.settlement_grants where org_id=$1 and person_id=$2',[org,person]))[0].granted,false);
   assert.equal((await rows('select private.has_role($1,$2,\'staff\',$3) allowed',[org,person,center]))[0].allowed,false);assert.equal((await must(member,'account_get_v1')).id,memberAccount.id);
  });
 }finally{if(trigger){await db.query(`drop trigger if exists ${trigger} on core.audit_events`);await db.query(`drop function if exists private.${trigger}()`);}await db.end();}
});
