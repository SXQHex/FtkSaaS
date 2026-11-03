import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';

test('Program agreement requirements and native recovery preserve plan and scope guards',async t=>{
 const db=await connect(),contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json'));
 try{
  await t.test('only tagged, valid agreement context escapes the exception boundary',async()=>{
   const person=key(),discipline=key(),detail={kind:'schedule_instructor_agreement',person_id:person,discipline_id:discipline,format:'group',starts_at:'2027-01-04T09:00:00Z'};
   const decode=async value=>(await db.query('select private.schedule_configuration_requirement($1) value',[value])).rows[0].value;
   assert.deepEqual(await decode(JSON.stringify({...detail,sql:'internal data must not escape',terms:{amount_minor:'999'}})),{blocker_index:0,kind:'instructor_agreement',person_id:person,discipline_id:discipline,format:'group',starts_at:'2027-01-04T09:00:00+00:00'});
   for(const value of ['',null,'not JSON','[]',JSON.stringify({...detail,kind:'other_policy'}),JSON.stringify({...detail,person_id:null}),JSON.stringify({...detail,person_id:'invalid'}),JSON.stringify({...detail,format:'event'}),JSON.stringify({...detail,starts_at:'infinity'}),JSON.stringify({...detail,starts_at:'invalid'})])assert.equal(await decode(value),null);
  });
  for(const planName of ['business','pro','starter'])await t.test(planName,async()=>{
   const {platform,plan}=await fixturePlatform(),owner=await authUser('configuration-'+planName),outsider=await authUser('configuration-outsider');
   const features=Object.entries(contract['x-contract'].feature_delivery).filter(([,f])=>f.plans[planName]).map(([k])=>k);
   await db.query('update core.saas_plan_versions set name=$1,features=$2 where id=$3',[planName,features,plan]);
   const account=await must(owner,'account_get_v1'),org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic configuration',initial_plan_id:plan},key())).primary_id;
   const center=(await must(owner,'center_create_v1',{org_id:org,name:'Configuration',timezone:'Europe/Istanbul'},key())).primary_id;
   const scope=b=>({org_id:org,center_id:center,...b}),api=(op,b={},u=owner,k=key())=>must(u,op,scope(b),k);
   const denied=async(op,b,code,u=owner)=>{const r=await call(u,op,scope(b),key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code);assert.equal(r.result.data,undefined);};
   const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
   await api('center_manager_assign_v1',{person_id:person});
   const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic configuration',occurred_at:new Date().toISOString()});
   await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
   const discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Configuration discipline',state:'active'},key())).primary_id;
   await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
   await api('role_assign_v1',{person_id:person,role:'instructor',scope:{center_id:center}});
   const rule={weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'23:59:59',valid_from:'2020-01-01'};
   await api('availability_save_v1',{resource:{kind:'person',id:person},rule});
   const room=(await api('room_save_v1',{name:'Configuration room',capacity:8})).primary_id;
   await api('availability_save_v1',{resource:{kind:'room',id:room},rule});
   const class_id=(await api('class_save_v1',{name:'Configuration class',discipline_id:discipline,external_open:false})).primary_id;
   const schedule={room_id:room,weekdays:[1],local_start:'12:00:00',duration_minutes:60,starts_on:'2027-01-04',ends_on:'2027-01-12',assignments:[{person_id:person,duty:'instructor'}],inherit_class_assignments:false,capacity:{total:4}};
   const preview=(extra={})=>api('program_preview_v1',{class_id,schedule:{...schedule,...extra}});
   const token=p=>({id:p.id,token:p.token});
   const initial=await preview();
   if(planName==='starter'){
    assert.deepEqual(initial.blockers,[]);assert.equal(initial.configuration_requirement,undefined);
    await api('program_apply_v1',{preview:token(initial)});
    assert.equal((await db.query('select count(*)::int n from core.instructor_agreements where org_id=$1',[org])).rows[0].n,0);
    return;
   }
   const requirement=at=>({blocker_index:0,kind:'instructor_agreement',person_id:person,discipline_id:discipline,format:'group',starts_at:at});
   assert.equal(initial.blockers[0].code,'POLICY_NOT_CONFIGURED');
   assert.deepEqual(initial.configuration_requirement,requirement('2027-01-04T09:00:00+00:00'));
   await denied('program_apply_v1',{preview:token(initial)},'POLICY_NOT_CONFIGURED');
   assert.equal((await db.query('select count(*)::int n from core.sessions where org_id=$1',[org])).rows[0].n,0);
   await denied('program_preview_v1',{class_id,schedule},'NOT_FOUND',outsider);
   const outsiderAccount=await must(outsider,'account_get_v1'),outsiderPerson=(await api('person_create_v1',{display_name:'Synthetic non-manager',contacts:[]})).primary_id;
   await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,outsiderAccount.id,outsiderPerson]);
   await denied('program_preview_v1',{class_id,schedule},'FORBIDDEN',outsider);
   await denied('instructor_agreements_list_v1',{person_id:person,page:{}},'FORBIDDEN',outsider);
   const terms={model:'session_fixed',currency:'TRY',components:[{kind:'session_fixed',amount_minor:'100'}],room_fee:{kind:'free',order:'before_instructor_share'}};
   const publish=(valid,extra={})=>api('instructor_agreement_publish_v1',{person_id:person,discipline_id:discipline,format:'group',valid,terms,reason:'Synthetic explicit agreement',...extra});
   const first=await publish({starts_at:'2027-01-01T00:00:00Z',ends_at:'2027-01-11T00:00:00Z'});
   const partial=await preview();assert.deepEqual(partial.configuration_requirement,requirement('2027-01-11T09:00:00+00:00'));
   const wrong=await preview({assignments:[{person_id:person,duty:'instructor',agreement_id:key()}]});
   assert.equal(wrong.blockers[0].code,'POLICY_NOT_CONFIGURED');assert.deepEqual(wrong.configuration_requirement,initial.configuration_requirement);
   await denied('program_apply_v1',{preview:token(initial)},'PREVIEW_STALE');
   const second=await publish({starts_at:'2027-01-11T00:00:00Z',ends_at:'2027-02-01T00:00:00Z'});
   const expired=await preview({starts_on:'2027-02-01',ends_on:'2027-02-02'});assert.equal(expired.blockers[0].code,'POLICY_NOT_CONFIGURED');assert.equal(expired.configuration_requirement.starts_at,'2027-02-01T09:00:00+00:00');
   const listed=await api('instructor_agreements_list_v1',{person_id:person,page:{}});assert.equal(listed.items.length,2);
   const ready=await preview();assert.deepEqual(ready.blockers,[]);assert.equal(ready.configuration_requirement,undefined);
   assert.deepEqual(ready.sessions.map(s=>s.assignments[0].agreement_id),[first.primary_id,second.primary_id]);
   const unconfiguredRoom=(await api('room_save_v1',{name:'Unconfigured room',capacity:8})).primary_id;
   const otherPolicy=await preview({room_id:unconfiguredRoom});
   assert.equal(otherPolicy.blockers[0].code,'POLICY_NOT_CONFIGURED');assert.equal(otherPolicy.configuration_requirement,undefined);
   const fresh=await preview(),applyKey=key(),payload={preview:token(fresh)};
   const made=await api('program_apply_v1',payload,owner,applyKey);assert.equal(made.related.length,2);
   assert.equal((await api('program_apply_v1',payload,owner,applyKey)).replayed,true);
   const conflict=await preview();assert.equal(conflict.blockers[0].code,'RESOURCE_CONFLICT');assert.equal(conflict.configuration_requirement,undefined);
   const firstSession=made.related[0].id,view=await api('session_get_v1',{session_id:firstSession});
   const change=await api('session_change_preview_v1',{session_id:firstSession,scope:'single',reason:'Synthetic expired agreement move',patch:{interval:{starts_at:'2027-02-01T09:00:00Z',ends_at:'2027-02-01T10:00:00Z'}}});
   assert.equal(change.blockers[0].code,'POLICY_NOT_CONFIGURED');assert.equal(change.configuration_requirement.starts_at,'2027-02-01T09:00:00+00:00');
   assert.equal((await api('session_get_v1',{session_id:firstSession})).version,view.version);
  });
 }finally{await db.end();}
});
