import './frontend-settings-acceptance.mjs';
import test from 'node:test';
import './p05-acceptance.mjs';
import './p06-acceptance.mjs';
import './starter-operations-acceptance.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Registry real Auth/API scope, lifecycle and atomicity',async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('registry-owner'),stranger=await authUser('registry-stranger');
 const account=await must(owner,'account_get_v1');
 const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Registry',initial_plan_id:plan},key())).primary_id;
 const center=(await must(owner,'center_create_v1',{org_id:org,name:'Registry center',timezone:'Europe/Istanbul'},key())).primary_id;
 const other=(await must(owner,'center_create_v1',{org_id:org,name:'Other center',timezone:'Europe/Istanbul'},key())).primary_id;
 const db=await connect(),scope=b=>({org_id:org,center_id:center,...b});
 const mutate=(op,b={},k=key())=>must(owner,op,scope(b),k);
 const fail=async(op,b,code,k=key(),user=owner)=>{const r=await call(user,op,scope(b),k);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code,JSON.stringify(r.result));};
 const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const receipt=async k=>(await rows('select count(*)::int n from core.operation_receipts where org_id=$1 and key_hash=$2',[org,createHash('sha256').update(k).digest('hex')]))[0].n;
 const ownerPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;
 let trigger;
 try{
 await mutate('center_manager_assign_v1',{person_id:ownerPerson});
 const payment=await mutate('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'synthetic registry',occurred_at:new Date().toISOString()});
 await must(platform,'saas_payment_verify_v1',scope({payment_id:payment.primary_id,accepted:true}),key());
 const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;
 await mutate('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
 const p=(await mutate('person_create_v1',{display_name:'Offline student',contacts:[]})).primary_id;
 await mutate('student_activate_v1',{person_id:p});
 await t.test('configuration updates version, replay once and reject stale payload',async()=>{
  const k=key(),b={expected_version:1,name:'Renamed organization'};
  const a=await mutate('organization_update_v1',b,k);assert.equal(a.primary_id,org);assert.equal(a.version,2);assert.equal((await must(owner,'organization_get_v1',{org_id:org})).version,2);assert.equal((await mutate('organization_update_v1',b,k)).replayed,true);
  await fail('organization_update_v1',{...b,name:'changed'},'IDEMPOTENCY_PAYLOAD_MISMATCH',k);
  await fail('organization_update_v1',b,'VERSION_CONFLICT');
  const c=await mutate('center_update_v1',{expected_version:1,name:'Renamed center',timezone:'Europe/London'});assert.equal(c.primary_id,center);assert.equal(c.version,2);assert.equal((await must(owner,'centers_list_v1',{org_id:org,page:{}})).items.find(x=>x.id===center).version,2);
  await fail('center_update_v1',{expected_version:2,name:'Invalid',timezone:'Invalid/Zone'},'VALIDATION_FAILED');
  assert.equal((await rows('select timezone from core.centers where id=$1',[center]))[0].timezone,'Europe/London');
 });
 await t.test('organization ownership does not grant operations in unassigned center; foreign tenant is concealed',async()=>{
  await fail('center_update_v1',{center_id:other,expected_version:1,name:'denied',timezone:'UTC'},'FORBIDDEN');
  await fail('organization_update_v1',{expected_version:2,name:'denied'},'NOT_FOUND',key(),stranger);
  await fail('student_deactivate_v1',{center_id:other,person_id:p,reason:'denied'},'FORBIDDEN');
 });
 await t.test('discipline pagination is stable with equal timestamps, scoped and closed DTO',async()=>{
  const second=(await must(owner,'discipline_save_v1',{org_id:org,name:'Bachata',state:'active'},key())).primary_id;
  await db.query('update core.disciplines set created_at=$1 where org_id=$2',['2026-01-01T00:00:00Z',org]);
  const a=await must(owner,'disciplines_list_v1',{org_id:org,page:{limit:1}});assert.equal(a.items.length,1);assert(a.next_cursor);assert(!('as_of' in a));
  const b=await must(owner,'disciplines_list_v1',{org_id:org,page:{limit:1,cursor:a.next_cursor}});assert.equal(b.next_cursor,null);assert.deepEqual([a.items[0].id,b.items[0].id].sort(),[discipline,second].sort());
  await fail('disciplines_list_v1',{center_id:undefined,page:{cursor:'bad'}},'VALIDATION_FAILED');
  await fail('disciplines_list_v1',{center_id:undefined,page:{sort:'display_name_asc'}},'VALIDATION_FAILED');
 });
 let relation;
 await t.test('discipline relation requires active center membership, versions updates and grants no login',async()=>{
  relation=(await mutate('person_discipline_set_v1',{person_id:p,discipline_id:discipline,kind:'student',state:'active'})).primary_id;
  const b={person_id:p,discipline_id:discipline,kind:'student',state:'inactive',expected_version:1},k=key();
  assert.equal((await mutate('person_discipline_set_v1',b,k)).version,2);assert.equal((await mutate('person_discipline_set_v1',b,k)).replayed,true);
  await fail('person_discipline_set_v1',b,'VERSION_CONFLICT');
  await mutate('person_discipline_set_v1',{...b,state:'active',expected_version:2});
  assert.equal((await must(owner,'person_get_v1',scope({person_id:p}))).discipline_relationships.find(x=>x.discipline_id===discipline).version,3);
  const offline=(await mutate('person_create_v1',{display_name:'No student relationship',contacts:[]})).primary_id;
  await fail('person_discipline_set_v1',{person_id:offline,discipline_id:discipline,kind:'student',state:'active'},'VALIDATION_FAILED');
  await fail('person_discipline_set_v1',{person_id:p,discipline_id:key(),kind:'student',state:'active'},'NOT_FOUND');
  assert.equal((await rows('select count(*)::int n from core.account_links where org_id=$1 and person_id=$2',[org,p]))[0].n,0);
  assert.equal((await rows('select count(*)::int n from core.role_assignments where org_id=$1 and person_id=$2',[org,p]))[0].n,0);
 });
 const cls=(await mutate('class_save_v1',{name:'Registry class',discipline_id:discipline,external_open:true})).primary_id;
 const at=Date.now()+86400000;
 const session=(await mutate('session_create_v1',{class_id:cls,discipline_id:discipline,format:'group',interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()},resources:[],assignments:[],capacity:{total:10}})).primary_id;
 for(const state of ['pending','alternative_offered'])await t.test('open lesson request '+state+' blocks deactivation atomically',async()=>{
  const id=key(),k=key();await db.query('insert into core.lesson_requests(id,org_id,center_id,person_id,format,requested_start,duration_minutes,state,discipline_id) values($1,$2,$3,$4,\'group\',now(),60,$5,$6)',[id,org,center,p,state,discipline]);
  await fail('student_deactivate_v1',{person_id:p,reason:'blocked'},'OPEN_OPERATIONS_EXIST',k);assert.equal(await receipt(k),0);
  await db.query("update core.lesson_requests set state='withdrawn' where id=$1",[id]);
 });
 for(const state of ['waiting','offered'])await t.test('open waiting list '+state+' blocks deactivation',async()=>{
  const id=key();await db.query('insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values($1,$2,$3,$4,$5,now(),$6)',[id,org,center,session,p,state]);
  await fail('student_deactivate_v1',{person_id:p,reason:'blocked'},'OPEN_OPERATIONS_EXIST');
  await db.query("update core.waitlist_entries set state='closed' where id=$1",[id]);
 });
 await t.test('live seat offer blocks; elapsed offer and list close atomically without waiting for worker',async()=>{
  const entry=key(),offer=key();await db.query("insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values($1,$2,$3,$4,$5,now(),'closed')",[entry,org,center,session,p]);
  await db.query("insert into core.seat_offers(id,org_id,center_id,entry_id,session_id,person_id,expires_at,state) values($1,$2,$3,$4,$5,$6,now()-interval '1 day','active')",[offer,org,center,entry,session,p]);
  await db.query("update core.seat_offers set expires_at=now()+interval '1 hour' where id=$1",[offer]);await db.query("update core.waitlist_entries set state='offered' where id=$1",[entry]);
  await fail('student_deactivate_v1',{person_id:p,reason:'blocked'},'OPEN_OPERATIONS_EXIST');await db.query("update core.seat_offers set expires_at=now()-interval '1 second' where id=$1",[offer]);
  await mutate('student_deactivate_v1',{person_id:p,reason:'expired offer no longer open'});assert.equal((await rows('select state from core.seat_offers where id=$1',[offer]))[0].state,'expired');assert.equal((await rows('select state from core.waitlist_entries where id=$1',[entry]))[0].state,'closed');await mutate('student_activate_v1',{person_id:p});
 });
 await t.test('open reservation blocks without altering rights',async()=>{
  const id=key(),policy=key();await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[policy,org,center,{kind:'cancellation',cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'consume'}]);await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible','active',$6)",[id,org,center,session,p,policy]);
  await fail('student_deactivate_v1',{person_id:p,reason:'blocked'},'OPEN_OPERATIONS_EXIST');await db.query("update core.reservations set state='cancelled' where id=$1",[id]);
 });
 await t.test('prepared event payment and active event registration each block deactivation',async()=>{
  const terms={fee_minor:'1000',currency:'TRY',full_payment_required:true,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'consume',no_show:'consume'},refund:{method:'none'}};
  const e=(await mutate('event_save_v1',{name:'Registry event',interval:{starts_at:new Date(at+7200000).toISOString(),ends_at:new Date(at+10800000).toISOString()},timezone:'Europe/Istanbul',venue:{kind:'external',name:'Synthetic',address:'Test',timezone:'Europe/Istanbul'},capacity:{nominal:10,maximum:10},terms,discipline_ids:[],assignments:[{person_id:ownerPerson,duty:'instructor',fee_minor:'0',currency:'TRY'}]})).primary_id;
  await mutate('event_publish_v1',{event_id:e,published:true});const prep=await mutate('event_payment_prepare_v1',{event_id:e,person_id:p});
  await fail('student_deactivate_v1',{person_id:p,reason:'blocked'},'OPEN_OPERATIONS_EXIST');
  const view=await must(owner,'event_payment_get_v1',scope({preparation_id:prep.id}));
  await mutate('collection_record_v1',{person_id:p,debt_ids:[view.debt_id],amount_minor:'1000',currency:'TRY',occurred_at:new Date().toISOString()});
  await mutate('event_register_v1',{event_id:e,person_id:p,preparation_id:prep.id});
  await fail('student_deactivate_v1',{person_id:p,reason:'blocked'},'OPEN_OPERATIONS_EXIST');
  const pv=await must(owner,'event_cancel_preview_v1',scope({event_id:e,reason:'synthetic'}));await mutate('event_cancel_apply_v1',{preview:{id:pv.id,token:pv.token}});
 });
 await t.test('late audit failure rolls back relationship, receipt, notification and outbox; same key retries',async()=>{
  const expiryEntry=key(),expiryOffer=key();await db.query("insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values($1,$2,$3,$4,$5,now(),'offered')",[expiryEntry,org,center,session,p]);await db.query("insert into core.seat_offers(id,org_id,center_id,entry_id,session_id,person_id,expires_at,state) values($1,$2,$3,$4,$5,$6,now()-interval '1 day','active')",[expiryOffer,org,center,expiryEntry,session,p]);
  trigger='registry_'+key().replaceAll('-','');
  await db.query('create function private.'+trigger+"() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='P0001',message='INTEGRITY_VIOLATION';end$$");
  await db.query('create trigger '+trigger+" before insert on core.audit_events for each row when (new.org_id='"+org+"'::uuid and new.action='student_deactivate_v1') execute function private."+trigger+'()');
  const finance=async()=>JSON.stringify(await rows('select id,amount_minor,kind from core.student_credit_movements where org_id=$1 and person_id=$2 order by id',[org,p]));const beforeFinance=await finance();
  const k=key(),b={person_id:p,reason:'synthetic inactive'};
  await fail('student_deactivate_v1',b,'INTEGRITY_VIOLATION',k);assert.equal(await receipt(k),0);assert.equal((await rows('select state from core.seat_offers where id=$1',[expiryOffer]))[0].state,'active');assert.equal((await rows('select state from core.waitlist_entries where id=$1',[expiryEntry]))[0].state,'offered');
  assert.equal((await rows("select state from core.center_relationships where org_id=$1 and center_id=$2 and person_id=$3 and kind='student' and state='active'",[org,center,p]))[0].state,'active');
  await db.query('drop trigger '+trigger+' on core.audit_events');await db.query('drop function private.'+trigger+'()');trigger=null;
  const a=await mutate('student_deactivate_v1',b,k);assert.equal((await mutate('student_deactivate_v1',b,k)).replayed,true);
  assert.equal(await finance(),beforeFinance);
  const rel=(await rows('select * from core.center_relationships where id=$1',[a.primary_id]))[0];assert.equal(rel.state,'inactive');assert(rel.ended_at);assert.equal((await rows('select state from core.seat_offers where id=$1',[expiryOffer]))[0].state,'expired');assert.equal((await rows('select state from core.waitlist_entries where id=$1',[expiryEntry]))[0].state,'closed');
  assert.equal((await rows('select count(*)::int n from core.audit_events where operation_id=$1',[a.operation_id]))[0].n,1);
  assert.equal((await rows('select count(*)::int n from core.outbox_jobs where org_id=$1 and dedupe_key=$2',[org,a.operation_id]))[0].n,1);
  await fail('person_discipline_set_v1',{person_id:p,discipline_id:discipline,kind:'student',state:'active',expected_version:3},'VALIDATION_FAILED');
  await mutate('student_activate_v1',{person_id:p});
  assert.equal((await rows('select version from core.person_disciplines where id=$1',[relation]))[0].version,'3');
 });
 }finally{if(trigger){await db.query('drop trigger if exists '+trigger+' on core.audit_events');await db.query('drop function if exists private.'+trigger+'()');}await db.end();}
});

import './ops-hosted-acceptance.mjs';
import './p07-account-revocation-acceptance.mjs';
import './p07-account-profile-merge-acceptance.mjs';
import './p07-subscription-lifecycle-acceptance.mjs';
import './p07-lifecycle-acceptance.mjs';

import './starter-plan-gates-acceptance.mjs';

import './starter-studio-acceptance.mjs';
