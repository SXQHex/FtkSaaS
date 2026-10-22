// Existing registry shard: native Auth -> Edge -> service-only RPC.
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call,context} from './api-client.mjs';import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('P07 account profile and manual cross-center alias merge',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('p07-a2-owner'),second=await authUser('p07-a2-manager'),member=await authUser('p07-a2-member');
 const account=await must(owner,'account_get_v1'),secondAccount=await must(second,'account_get_v1'),memberAccount=await must(member,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'P07 A completion',initial_plan_id:plan},key())).primary_id;
 const c1=(await must(owner,'center_create_v1',{org_id:org,name:'P07 first',timezone:'UTC'},key())).primary_id,c2=(await must(owner,'center_create_v1',{org_id:org,name:'P07 second',timezone:'UTC'},key())).primary_id;
 const db=await connect();let trigger;
 const rows=async(q,a=[])=>(await db.query(q,a)).rows,scope=b=>({org_id:org,center_id:c1,...b});
 const mut=(op,b={},k=key(),u=owner)=>must(u,op,scope(b),k);
 const fail=async(op,b,code,k=key(),u=owner)=>{const r=await call(u,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const profile=(b,k=key(),u=member)=>must(u,'account_profile_update_v1',b,k);
 const getVersion=async()=>Number((await rows('select version from core.accounts where id=$1',[memberAccount.id]))[0].version);
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 try{
  await mut('center_manager_assign_v1',{person_id:ownerPerson});
  const pay=await mut('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic P07 A',occurred_at:new Date().toISOString()});await must(platform,'saas_payment_verify_v1',scope({payment_id:pay.primary_id,accepted:true}),key());
  await t.test('global profile has scoped management version, receipt, audit/inbox and no role/contact changes',async()=>{
   const m=await must(member,'management_state_get_v1',{operation:'account_profile_update_v1',selector:{operation:'account_profile_update_v1',key:{}}});assert.equal(m.items[0].entity.id,memberAccount.id);
   const k=key(),b={expected_version:await getVersion(),display_name:'Updated global account'};
   const before=(await rows('select raw_user_meta_data from auth.users where id=$1',[member.id]))[0].raw_user_meta_data;
   const result=await profile(b,k);assert.equal(result.primary_id,memberAccount.id);assert.equal(result.version,b.expected_version+1);assert.equal((await profile(b,k)).replayed,true);
   const view=await must(member,'account_get_v1');assert.equal(view.display_name,b.display_name);assert.equal(view.profile_notices.length,1);assert.equal(view.profile_notices[0].kind,'account_profile_updated');assert.equal((await must(owner,'account_get_v1')).profile_notices.length,0);
   assert.deepEqual((await rows('select raw_user_meta_data from auth.users where id=$1',[member.id]))[0].raw_user_meta_data,before);
   assert.equal((await rows('select count(*)::int n from private.p07_account_events where account_id=$1',[memberAccount.id]))[0].n,1);
   const forbidden=await call(owner,'management_state_get_v1',{operation:'account_profile_update_v1',selector:{operation:'account_profile_update_v1',key:{}},entity:{type:'accounts',id:memberAccount.id}});assert.equal(forbidden.result.error.code,'NOT_FOUND');
   const stale=await call(member,'account_profile_update_v1',b,key());assert.equal(stale.result.error.code,'VERSION_CONFLICT');
  });
  await t.test('concurrent profile updates yield one version winner; late inbox failure rolls back every effect',async()=>{
   const version=await getVersion(),results=await Promise.all(['A','B'].map(display_name=>call(member,'account_profile_update_v1',{expected_version:version,display_name},key())));
   assert.equal(results.filter(x=>x.result.ok).length,1);assert.equal(results.find(x=>!x.result.ok).result.error.code,'VERSION_CONFLICT');
   const before=await must(member,'account_get_v1');trigger='p07_profile_'+key().replaceAll('-','');
   await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.account_id='${memberAccount.id}'::uuid then raise exception using errcode='23514',message='synthetic inbox failure';end if;return new;end$$`);await db.query(`create trigger ${trigger} before insert on private.p07_account_inbox for each row execute function private.${trigger}()`);
   const k=key(),failed=await call(member,'account_profile_update_v1',{expected_version:await getVersion(),display_name:'Rollback profile'},k);assert.equal(failed.result.error.code,'INTEGRITY_VIOLATION');assert.deepEqual(await must(member,'account_get_v1'),before);
   assert.equal((await rows('select count(*)::int n from core.operation_receipts where actor_account_id=$1 and operation=$2 and key_hash=$3',[memberAccount.id,'account_profile_update_v1',createHash('sha256').update(k).digest('hex')]))[0].n,0);
   await db.query(`drop trigger ${trigger} on private.p07_account_inbox`);await db.query(`drop function private.${trigger}()`);trigger=null;
  });
  const manager=(await mut('person_create_v1',{display_name:'P07 second manager',contacts:[]})).primary_id;
  const source=(await mut('person_create_v1',{display_name:'P07 duplicate',contacts:[]})).primary_id,target=(await mut('person_create_v1',{display_name:'P07 canonical',contacts:[]})).primary_id;
  const managerLink=key();await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[managerLink,org,secondAccount.id,manager]);
  const assignment=key();await db.query("insert into core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) values($1,$2,$3,'center_manager',$4,'active',$5)",[assignment,org,manager,c2,managerLink]);
  const token=key(),invitation=key();await db.query("insert into core.invitations(id,org_id,center_id,person_id,email,token_hash,inviter_account_id,expires_at,state) values($1,$2,$3,$4,$5,$6,$7,now()+interval '7 days','pending')",[invitation,org,c1,source,member.email,createHash('sha256').update(token).digest('hex'),account.id]);await must(member,'account_access_accept_v1',{token},key());
  await db.query("insert into core.center_relationships(id,org_id,center_id,person_id,kind,state,started_at) values($1,$2,$3,$4,'student','active',now()),($5,$2,$6,$7,'student','active',now())",[key(),org,c1,source,key(),c2,target]);
  await db.query("insert into core.person_contacts(id,org_id,person_id,kind,value) values($1,$2,$3,'email','p07-old@ftksaas.invalid')",[key(),org,source]);
  const debt=key();await db.query("insert into core.debts(id,org_id,center_id,person_id,amount_minor,currency,due_at,state) values($1,$2,$3,$4,1700,'TRY',now(),'open')",[debt,org,c1,source]);
  const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'P07 old right',state:'active'},key())).primary_id;
  await db.query("insert into core.negative_limit_overrides(id,org_id,center_id,person_id,discipline_id,limit_count,reason) values($1,$2,$3,$4,$5,0,'synthetic restriction')",[key(),org,c1,source,discipline]);
  await mut('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
  const cls=(await mut('class_save_v1',{name:'P07 closed class',discipline_id:discipline,external_open:false})).primary_id;
  const terms={name:'P07 prior paid right',kind:'credits',booking_mode:'flexible',credits:3,price_minor:'1000',currency:'TRY',freeze:{enabled:false,extends_validity:false},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,class_id:cls,usage_targets:['lesson']}]};
  const productVersion=(await mut('product_publish_v1',{terms})).primary_id;
  const salePreview=await must(owner,'sale_preview_v1',scope({person_id:source,product_version_id:productVersion,start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+864000000).toISOString().slice(0,10)}));
  const sold=(await mut('sale_apply_v1',{preview:{id:salePreview.id,token:salePreview.token}})).primary_id;
  const saleDebt=(await rows('select id from core.debts where org_id=$1 and sale_id=$2',[org,sold]))[0].id;
  await mut('collection_record_v1',{person_id:source,debt_ids:[saleDebt],amount_minor:'1500',currency:'TRY',occurred_at:new Date().toISOString()});
  const publish=(policy,value)=>mut('policy_publish_v1',{center_id:null,key:policy,value,effective_at:new Date().toISOString(),mandatory:false});
  await publish('student_cancel_group',{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}});
  await publish('reservation_window',{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false});
  await publish('debt_participation',{kind:'boolean',value:true});
  const makeSession=async hours=>{const id=key(),start=new Date(Date.now()+hours*3600000);await db.query("insert into core.sessions(id,org_id,center_id,class_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,$5,'group',$6,$7,10,10,'planned','open')",[id,org,c1,cls,discipline,start,new Date(+start+3600000)]);return id;};
  const firstSession=await makeSession(24),futureSession=await makeSession(28),blockedSession=await makeSession(32);
  const existingReservation=(await mut('reservation_create_v1',{person_id:source,session_id:firstSession,source_sale_id:sold,mode:'flexible'})).primary_id;
  const foreignOrg=(await must(platform,'organization_create_v1',{verified_account_id:secondAccount.id,name:'P07 foreign scope',initial_plan_id:plan},key())).primary_id;
  const foreignPerson=(await rows('select owner_person_id from core.organizations where id=$1',[foreignOrg]))[0].owner_person_id;
  const preview=()=>must(owner,'person_merge_preview_v1',scope({source_id:source,target_id:target}));let p;
  await t.test('same-org only, management scopes, root versions and required center approval',async()=>{
   const a=await must(owner,'management_state_get_v1',scope({operation:'person_merge_preview_v1',selector:{operation:'person_merge_preview_v1',key:{source_id:source,target_id:target}}}));assert.equal(a.items[0].versions.length,2);
   await fail('person_merge_preview_v1',{source_id:source,target_id:target},'FORBIDDEN',key(),member);
   p=await preview();assert.deepEqual(p.blockers,[]);assert.deepEqual(p.merge_summary.required_approval_center_ids,[c2]);
   await fail('person_merge_preview_v1',{source_id:source,target_id:foreignPerson},'NOT_FOUND');
   const conflict=await must(owner,'person_merge_preview_v1',scope({source_id:source,target_id:manager}));assert(conflict.blockers.some(x=>x.code==='ACCOUNT_LINK_CONFLICT'));
   await fail('person_merge_apply_v1',{preview:{id:p.id,token:p.token}},'APPROVAL_REQUIRED');
   await db.query('update core.people set version=version+1 where id=$1',[source]);await fail('person_merge_apply_v1',{preview:{id:p.id,token:p.token}},'PREVIEW_STALE');
   p=await preview();
   const managed=await must(second,'management_state_get_v1',scope({center_id:c2,operation:'person_merge_approve_v1',selector:{operation:'person_merge_approve_v1',key:{preview_id:p.id,approval_center_id:c2}}}));assert.equal(managed.items[0].current.values.approval_center_id,c2);assert.equal(JSON.stringify(managed).includes(p.token),false);
   await fail('person_merge_approve_v1',{approval_center_id:c2,preview:{id:p.id,token:p.token}},'FORBIDDEN');
  });
  await t.test('other-center CM approval is live and version-bound; late audit error is atomic',async()=>{
   const approve=()=>must(second,'person_merge_approve_v1',scope({center_id:c2,approval_center_id:c2,preview:{id:p.id,token:p.token}}),key());await approve();
   await db.query('update core.role_assignments set version=version+1 where id=$1',[assignment]);await fail('person_merge_apply_v1',{preview:{id:p.id,token:p.token}},'APPROVAL_REQUIRED');await approve();
   trigger='p07_merge_'+key().replaceAll('-','');await db.query(`create function private.${trigger}() returns trigger language plpgsql as $$begin if new.org_id='${org}'::uuid and new.action='person_merge_apply_v1' then raise exception using errcode='23514',message='synthetic merge audit failure';end if;return new;end$$`);await db.query(`create trigger ${trigger} before insert on core.audit_events for each row execute function private.${trigger}()`);
   const link=(await rows('select id,version,person_id from core.account_links where org_id=$1 and account_id=$2',[org,memberAccount.id]))[0];await fail('person_merge_apply_v1',{preview:{id:p.id,token:p.token}},'INTEGRITY_VIOLATION');assert.deepEqual((await rows('select id,version,person_id from core.account_links where id=$1',[link.id]))[0],link);assert.equal((await rows('select state from core.previews where id=$1',[p.id]))[0].state,'current');
   await db.query(`drop trigger ${trigger} on core.audit_events`);await db.query(`drop function private.${trigger}()`);trigger=null;
  });
  await t.test('merge keeps old debt exact, rebinds current account and resolves history through both IDs',async()=>{
   const before=(await rows('select * from core.debts where id=$1',[debt]))[0],k=key(),body={preview:{id:p.id,token:p.token}};
   const applied=await mut('person_merge_apply_v1',body,k);assert.equal(applied.primary_id,target);assert.equal((await mut('person_merge_apply_v1',body,k)).replayed,true);
   assert.deepEqual((await rows('select * from core.debts where id=$1',[debt]))[0],before);assert.equal((await rows('select person_id from core.account_links where org_id=$1 and account_id=$2',[org,memberAccount.id]))[0].person_id,target);
   const person=await must(member,'person_get_v1',scope({person_id:source}));assert.equal(person.id,target);assert(person.linked_person_ids.includes(source));assert(person.linked_person_ids.includes(target));
   for(const person_id of [source,target]){const f=await must(member,'finance_get_v1',scope({person_id,currency:'TRY',page:{}}));assert.equal(f.debts.find(x=>x.id===debt).remaining_minor,'1700');}
   await fail('person_merge_apply_v1',body,'PREVIEW_STALE');
  });
  await t.test('old debt continues to block participation/booking; old paid right and credit remain actionable',async()=>{
   assert.equal((await rows('select limit_count from core.negative_limit_overrides where org_id=$1 and center_id=$2 and person_id=$3 and discipline_id=$4',[org,c1,target,discipline]))[0].limit_count,0);
   const eligibility=(await rows('select private.lesson_eligibility($1,$2) code',[org,existingReservation]))[0].code;assert.equal(eligibility.eligible,false);assert.equal(eligibility.reason,'debt_policy');
   const personBefore=await must(owner,'person_get_v1',scope({person_id:target}));assert(personBefore.contacts.some(x=>x.value==='p07-old@ftksaas.invalid'));
   await mut('person_update_v1',{person_id:target,expected_version:personBefore.version,patch:{contacts:[]}});
   assert.deepEqual((await must(owner,'person_get_v1',scope({person_id:target}))).contacts,[]);
   const rights=await must(member,'entitlements_get_v1',scope({person_id:target,session_id:futureSession}));assert(rights.some(x=>x.sale_id===sold));
   const booked=await mut('reservation_create_v1',{person_id:target,session_id:futureSession,source_sale_id:sold,mode:'flexible'});assert.equal((await rows('select sale_id from core.entitlement_allocations where org_id=$1 and reservation_id=$2',[org,booked.primary_id]))[0].sale_id,sold);
   const offset=await mut('student_credit_offset_v1',{person_id:target,debt_id:debt,expected_version:1,amount_minor:'500',currency:'TRY'});assert(offset.primary_id);
   const finance=await must(member,'finance_get_v1',scope({person_id:target,currency:'TRY',page:{}}));assert.equal(finance.debts.find(x=>x.id===debt).remaining_minor,'1200');assert.equal(finance.credit_available_minor,'0');
   await publish('debt_booking',{kind:'boolean',value:true});await fail('reservation_create_v1',{person_id:target,session_id:blockedSession,source_sale_id:sold,mode:'flexible'},'FORBIDDEN');
  });
  await t.test('recovery rate gates are atomic under concurrent callers and do not store addresses',async()=>{
   await db.query('insert into private.p07_recovery_config values(true,86400,1,1)');
   const clients=[await connect(),await connect()],request={client_api_version:1,request_id:key(),email:'synthetic@ftksaas.invalid'},aux={ip_hash:createHash('sha256').update(key()).digest('hex'),target_hash:createHash('sha256').update(key()).digest('hex'),bot_verified:true};
   try{
    for(const c of clients)await c.query("select set_config('request.jwt.claim.role','service_role',false)");
    const results=await Promise.all(clients.map(c=>c.query('select api_v1.account_password_reset_request_v1($1::jsonb,null,null,$2::uuid[],$3::jsonb) result',[request,Array.from({length:32},key),aux])));
    const values=results.map(x=>x.rows[0].result);assert.equal(values.filter(x=>x._internal_recovery_ready).length,1);assert.equal(values.find(x=>!x._internal_recovery_ready).error.code,'RATE_LIMITED');
    const stored=await rows('select * from private.p07_recovery_rates where fingerprint in ($1,$2)',[aux.ip_hash,aux.target_hash]);assert.equal(stored.length,2);assert.equal(stored.every(x=>x.hits===1),true);assert.equal(JSON.stringify(stored).includes(request.email),false);
   }finally{for(const c of clients)await c.end();await db.query('delete from private.p07_recovery_rates where fingerprint in ($1,$2)',[aux.ip_hash,aux.target_hash]);await db.query('delete from private.p07_recovery_config');}
  });
  await t.test('Auth handoff uses live original session; public recovery stays closed without ingress/config',async()=>{
   const challenge=await must(member,'account_password_change_v1');assert.equal(challenge.provider,'supabase_auth');assert.equal(challenge.status,'challenge_required');
   const unknown=await call({jwt:context().env.ANON_KEY},'account_password_reset_request_v1',{email:'unknown-'+key()+'@ftksaas.invalid'});assert.equal(unknown.result.error.code,'TEMPORARY_FAILURE');
   const {env}=context(),nextPassword='P07-Changed-'+key();const updated=await fetch(env.API_URL+'/auth/v1/user',{method:'PUT',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+member.jwt,'content-type':'application/json'},body:JSON.stringify({password:nextPassword})});assert.equal(updated.ok,true,'native provider password completion');
   const login=await fetch(env.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:member.email,password:nextPassword})});assert.equal(login.ok,true,'new password accepted by real Auth');
   await db.query('delete from auth.sessions where id=$1',[member.session_id]);const denied=await call(member,'account_password_change_v1');assert.equal(denied.result.error.code,'SESSION_REVOKED');
  });
 }finally{
  if(trigger){const table=trigger.startsWith('p07_profile_')?'private.p07_account_inbox':'core.audit_events';await db.query(`drop trigger if exists ${trigger} on ${table}`);await db.query(`drop function if exists private.${trigger}()`);}await db.end();
 }
});
