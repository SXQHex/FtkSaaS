import test from 'node:test';
import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
const token=p=>({id:p.id,token:p.token});
const date=days=>{const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());return new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);};
async function fixture(planName){
 const db=await connect();
 try{
  const {platform,plan}=await fixturePlatform(),owner=await authUser('event-'+planName),account=await must(owner,'account_get_v1');
  await db.query('update core.saas_plan_versions set name=$1 where id=$2',[planName,plan]);
  const org=(await must(platform,'organization_create_v1',{verified_account_id:account.id,name:'Synthetic event '+planName,initial_plan_id:plan},key())).primary_id;
  const center=(await must(owner,'center_create_v1',{org_id:org,name:'Event center',timezone:'Europe/Istanbul'},key())).primary_id;
  const scope=b=>({org_id:org,center_id:center,...b}),api=(op,b={},k=key())=>must(owner,op,scope(b),k);
  const person=(await db.query('select owner_person_id from core.organizations where id=$1',[org])).rows[0].owner_person_id;
  await api('center_manager_assign_v1',{person_id:person});
  const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'Synthetic event',occurred_at:new Date().toISOString()});
  await must(platform,'saas_payment_verify_v1',scope({payment_id:pay.primary_id,accepted:true}),key());
  const student=async()=>{const p=(await api('person_create_v1',{display_name:'Synthetic event student',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:p});return p;};
  const fail=async(op,b,code)=>{const response=await call(owner,op,scope(b),key());assert.equal(response.result.ok,false,JSON.stringify(response.result));assert.equal(response.result.error.code,code,JSON.stringify(response.result));};
  const terms={fee_minor:'0',currency:'TRY',full_payment_required:false,allowed_product_version_ids:[],cancellation:{before_cutoff:'release',after_cutoff:'release',no_show:'release'},refund:{method:'none'}};
  let slot=0;
  const input=(extra={})=>{const at=Date.now()+86400000+(slot++)*7200000;return {name:'Synthetic event',interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()},timezone:'Europe/Istanbul',venue:{kind:'external',name:'Synthetic venue',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{nominal:2,maximum:2},terms,discipline_ids:[],assignments:[{person_id:person,duty:'instructor',fee_minor:'0',currency:'TRY'}],...extra};};
  const event=async extra=>{const b=input(extra),id=(await api('event_save_v1',b)).primary_id;await api('event_publish_v1',{event_id:id,published:true});return id;};
  const read=id=>api('event_get_v1',{event_id:id});
  const edit=async(id,patch)=>{const v=await read(id);return {event_id:id,expected_version:v.version,name:v.name,interval:v.interval,timezone:v.timezone,venue:v.venue,capacity:v.capacity,terms:v.terms,discipline_ids:v.discipline_ids,assignments:v.assignment_terms,...patch};};
  return {db,plan,org,center,owner,scope,api,student,fail,terms,input,event,read,edit};
 }catch(error){await db.end();throw error;}
}
for(const planName of ['pro','business']){
 test('P12 '+planName+' explicit capacity preserves registrations and room ceilings',async()=>{
  const f=await fixture(planName),{db,org,api,student,fail,event,input,read,edit}=f;
  try{
   const room=(await api('room_save_v1',{name:'Synthetic room',capacity:2})).primary_id;
   await fail('event_save_v1',input({venue:{kind:'internal',room_id:room,timezone:'Europe/Istanbul'},capacity:{kind:'unlimited'}}),'VALIDATION_FAILED');
   await fail('event_save_v1',input({venue:{kind:'internal',room_id:room,timezone:'Europe/Istanbul'},capacity:{nominal:2,maximum:3}}),'CAPACITY_FULL');
   const e=await event({capacity:{kind:'unlimited'}}),a=await student(),b=await student();
   const register=p=>api('event_register_v1',{event_id:e,person_id:p});
   const one=await register(a),two=await register(b);assert.equal(one.outcome,'registered');assert.equal(two.outcome,'registered');
   assert.deepEqual((await read(e)).capacity,{kind:'unlimited'});
   const registrations=(await read(e)).registrations.map(r=>r.id).sort();
   await fail('event_save_v1',await edit(e,{venue:{kind:'internal',room_id:room,timezone:'Europe/Istanbul'},capacity:{nominal:1,maximum:1}}),'CAPACITY_FULL');
   assert.deepEqual((await read(e)).capacity,{kind:'unlimited'});
   await api('event_save_v1',await edit(e,{venue:{kind:'internal',room_id:room,timezone:'Europe/Istanbul'},capacity:{nominal:2,maximum:2}}));
   assert.deepEqual((await read(e)).registrations.map(r=>r.id).sort(),registrations);
   const rm=(await db.query('select version from core.rooms where org_id=$1 and id=$2',[org,room])).rows[0];
   await fail('room_save_v1',{room_id:room,expected_version:Number(rm.version),name:'Synthetic room',capacity:1},'CAPACITY_FULL');
   const finite=await event({capacity:{nominal:1,maximum:1}}),c=await student(),d=await student();
   const race=await Promise.all([c,d].map(person_id=>call(f.owner,'event_register_v1',f.scope({event_id:finite,person_id}),key())));
   assert.equal(race.filter(x=>x.result.ok).length,1);assert.equal(race.find(x=>!x.result.ok).result.error.code,'CAPACITY_FULL');
   const stale=await api('event_registration_preview_v1',{event_id:e,person_id:c});
   await api('event_save_v1',await edit(e,{venue:{kind:'external',name:'Synthetic',address:'Synthetic',timezone:'Europe/Istanbul'},capacity:{kind:'unlimited'}}));
   await fail('event_register_v1',{event_id:e,person_id:c,preview:token(stale)},'PREVIEW_STALE');
   const outsider=await authUser('event-outsider');await must(outsider,'account_get_v1');
   const denied=await call(outsider,'event_get_v1',f.scope({event_id:e}),key());assert.equal(denied.result.ok,false);
   const cancelled=await api('event_cancel_preview_v1',{event_id:e,reason:'Synthetic cancellation'});await api('event_cancel_apply_v1',{preview:token(cancelled)});
   assert.equal((await read(e)).state,'cancelled');
  }finally{await db.end();}
 });
 test('P13 '+planName+' package eligibility is live while attendance and credits stay distinct',async()=>{
  const f=await fixture(planName),{db,org,api,student,fail,event,read}=f;
  try{
   const p=await student();
   const discipline=(await must(f.owner,'discipline_save_v1',{org_id:org,name:'Synthetic event discipline',state:'active'},key())).primary_id;
   await api('center_discipline_set_v1',{discipline_id:discipline,state:'active'});
   for(const name of ['student_cancel_group','student_cancel_private'])await api('policy_publish_v1',{center_id:null,key:name,value:{kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'release',no_show:'release'}},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
   await api('policy_publish_v1',{center_id:null,key:'reservation_window',value:{kind:'window',opens_minutes_before:10080,closes_minutes_before:0,manager_exception:false},effective_at:new Date(Date.now()-1000).toISOString(),mandatory:false});
   const product=(await api('product_publish_v1',{terms:{name:'Synthetic lesson and event credit',kind:'credits',booking_mode:'flexible',credits:1,price_minor:'100',currency:'TRY',freeze:{enabled:true,extends_validity:true,max_days:10},refund:{method:'none'},scopes:[{scope_kind:'organization_all',center_id:null,discipline_id:null,usage_targets:['lesson','event']}]}})).primary_id;
   const sell=async(person_id=p)=>{const v=await api('sale_preview_v1',{person_id,product_version_id:product,start_date:date(0),end_date:date(10)});assert.deepEqual(v.blockers,[]);return(await api('sale_apply_v1',{preview:token(v)})).primary_id;};
   const sale=await sell(),at=Date.parse(date(2)+'T10:00:00Z');
   const strict=await event({terms:{...f.terms,full_payment_required:true,package_usage:'eligibility_only',allowed_product_version_ids:[product]}});
   assert.equal((await api('event_registration_preview_v1',{event_id:strict,person_id:p,sale_id:sale})).blockers[0].code,'ENTITLEMENT_UNAVAILABLE');
   const debt=(await db.query('select id from core.debts where org_id=$1 and sale_id=$2',[org,sale])).rows[0].id;
   await api('collection_record_v1',{person_id:p,debt_ids:[debt],amount_minor:'100',currency:'TRY',occurred_at:new Date().toISOString(),payment:{method:'cash'}});
   assert.deepEqual((await api('event_registration_preview_v1',{event_id:strict,person_id:p,sale_id:sale})).blockers,[]);
   const e=await event({interval:{starts_at:new Date(at).toISOString(),ends_at:new Date(at+3600000).toISOString()},capacity:{kind:'unlimited'},terms:{...f.terms,package_usage:'eligibility_only',allowed_product_version_ids:[product]}});
   const accounts=async()=>(await db.query('select to_jsonb(a) account,private.credit_available($1,a.sale_id)::text available from core.entitlement_accounts a where org_id=$1 and person_id=$2 order by sale_id',[org,p])).rows;
   const baseline=await accounts(),k=key(),reg=await api('event_register_v1',{event_id:e,person_id:p,sale_id:sale},k);
   assert.equal((await api('event_register_v1',{event_id:e,person_id:p,sale_id:sale},k)).replayed,true);
   assert.deepEqual(await accounts(),baseline);
   for(const result of ['no_show','blocked','cancel']){
    const other=await student();await sell(other);
    const extra=await api('event_register_v1',{event_id:e,person_id:other});
    const entry=(await read(e)).registrations.find(x=>x.id===extra.primary_id);
    if(result==='cancel')await api('event_registration_cancel_v1',{registration_id:entry.id,expected_version:entry.version,reason:'Synthetic participant cancellation'});
    else await api('event_attendance_mark_v1',{registration_id:entry.id,expected_version:entry.version,result});
   }
   await fail('event_payment_prepare_v1',{event_id:e,person_id:p},'VALIDATION_FAILED');
   const row=async()=>(await read(e)).registrations.find(r=>r.id===reg.primary_id);
   assert.equal((await row()).package_eligible,true);
   const frozen=await api('freeze_preview_v1',{sale_id:sale,dates:{start_date:date(1),end_date:date(4)},reason:'Synthetic freeze'});assert.deepEqual(frozen.blockers,[]);const appliedFreeze=await api('freeze_apply_v1',{preview:token(frozen)});
   // Isolated fixture clock: the scheduled freeze and event have now started.
   await db.query("update core.freezes set starts_at=clock_timestamp()-interval '2 minutes',state='active' where org_id=$1 and id=$2",[org,appliedFreeze.primary_id]);
   await db.query("update core.events set starts_at=clock_timestamp()-interval '1 minute',ends_at=clock_timestamp()+interval '59 minutes' where org_id=$1 and id=$2",[org,e]);
   assert.equal((await row()).state,'active');assert.equal((await row()).package_eligible,false);
   const mark=async(extra={})=>({registration_id:reg.primary_id,expected_version:(await row()).version,result:'attended',...extra});
   await fail('event_attendance_mark_v1',await mark(),'ENTITLEMENT_UNAVAILABLE');
   await api('event_attendance_mark_v1',await mark({record_ineligible_attendance:true,reason:'Observed physical attendance, no free eligibility granted'}));
   assert.equal((await row()).attendance_result,'attended');assert.equal((await row()).package_eligible_at_attendance,false);
   const ended=await api('sale_terminate_preview_v1',{sale_id:sale,reason:'Synthetic termination'});await api('sale_terminate_apply_v1',{preview:token(ended)});
   await sell();assert.equal((await row()).package_eligible,true);assert.equal((await row()).package_eligible_at_attendance,false);
   const beforeClose=await accounts();await api('event_attendance_close_v1',{event_id:e,expected_version:(await read(e)).version});
   assert.deepEqual(await accounts(),beforeClose);
   await api('event_attendance_correct_v1',{registration_id:reg.primary_id,expected_version:(await row()).version,result:'attended',reason:'Explicit new eligibility review'});
   assert.equal((await row()).package_eligible_at_attendance,true);assert.deepEqual(await accounts(),beforeClose);
   assert.equal((await db.query('select count(*)::int n from core.entitlement_allocations a join core.event_registrations r on r.org_id=a.org_id and r.id=a.event_registration_id where r.org_id=$1 and r.event_id=$2',[org,e])).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from core.entitlement_movements m join core.event_registrations r on r.org_id=m.org_id and r.id=m.event_registration_id where r.org_id=$1 and r.event_id=$2',[org,e])).rows[0].n,0);
   const raceEvent=await event({terms:{...f.terms,package_usage:'eligibility_only',allowed_product_version_ids:[product]}});
   const lesson=(await api('session_create_v1',{discipline_id:discipline,format:'group',interval:{starts_at:date(2)+'T10:00:00Z',ends_at:date(2)+'T11:00:00Z'},resources:[],assignments:[],capacity:{total:1}})).primary_id;
   const results=await Promise.all([call(f.owner,'event_register_v1',f.scope({event_id:raceEvent,person_id:p}),key()),call(f.owner,'reservation_create_v1',f.scope({session_id:lesson,person_id:p,mode:'flexible'}),key())]);
   assert.equal(results[1].result.ok,true,JSON.stringify(results[1].result));
   if(results[0].result.ok){const held=(await read(raceEvent)).registrations.find(r=>r.person_id===p);assert.equal(held.state,'active');assert.equal(held.package_eligible,false);}else assert.equal(results[0].result.error.code,'ENTITLEMENT_UNAVAILABLE');
   await db.query("update core.saas_plan_versions set name='starter' where id=$1",[f.plan]);
   await fail('event_save_v1',f.input(),'PLAN_FEATURE_UNAVAILABLE');
  }finally{await db.end();}
 });
}
