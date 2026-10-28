import test from 'node:test';import assert from 'node:assert/strict';
import {authUser,fixturePlatform,must,call} from './api-client.mjs';
import {connect} from '../scripts/db.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
test('FD05 own interests and opt-in history only narrow and order authorized calendar records',{timeout:180000},async t=>{
 const {platform,plan}=await fixturePlatform(),owner=await authUser('calendar-preference-owner'),member=await authUser('calendar-preference-member'),stranger=await authUser('calendar-preference-stranger');
 const db=await connect(),rows=async(q,a=[])=>(await db.query(q,a)).rows;let org,center,person,account,early,later,hidden,discipline,second,otherCenter;
 const api=(op,b={},u=owner)=>must(u,op,{org_id:org,center_id:center,...b},key());
 const change=async patch=>{const s=await must(member,'settings_get_v1',{scope:'member',org_id:org});return must(member,'settings_update_v1',{scope:'member',org_id:org,expected_version:s.version,patch},key());};
 const interval={starts_at:'2030-01-01T00:00:00Z',ends_at:'2030-01-03T00:00:00Z'};
 const calendar=(options={},u=member)=>must(u,'calendar_get_v1',{org_id:org,center_id:center,interval,page:{},...options});
 const ids=v=>v.items.map(i=>i.id);
 const denied=async(op,b,code,u=member)=>{const r=await call(u,op,b);assert.equal(r.result.ok,false,JSON.stringify(r.result));assert.equal(r.result.error.code,code);};
 try{
  const own=await must(owner,'account_get_v1');org=(await must(platform,'organization_create_v1',{verified_account_id:own.id,name:'Synthetic calendar preferences',initial_plan_id:plan},key())).primary_id;
  center=(await api('center_create_v1',{name:'Preference center',timezone:'UTC'})).primary_id;
  otherCenter=(await api('center_create_v1',{name:'Other preference center',timezone:'UTC'})).primary_id;
  const pay=await api('saas_payment_submit_v1',{amount_minor:'1000',currency:'TRY',reference:'SYNTHETIC preference',occurred_at:new Date().toISOString()});await api('saas_payment_verify_v1',{payment_id:pay.primary_id,accepted:true},platform);
  const ownPerson=(await rows('select owner_person_id from core.organizations where id=$1',[org]))[0].owner_person_id;await api('center_manager_assign_v1',{person_id:ownPerson});
  discipline=(await must(owner,'discipline_save_v1',{org_id:org,name:'Yoga',state:'active'},key())).primary_id;second=(await must(owner,'discipline_save_v1',{org_id:org,name:'Salsa',state:'active'},key())).primary_id;
  for(const d of [discipline,second])await api('center_discipline_set_v1',{discipline_id:d,state:'active'});
  person=(await api('person_create_v1',{display_name:'Synthetic own preferences',contacts:[]})).primary_id;await api('student_activate_v1',{person_id:person});account=await must(member,'account_get_v1');
  await db.query("insert into core.account_links(id,org_id,account_id,person_id,state,verified_at) values($1,$2,$3,$4,'active',now())",[key(),org,account.id,person]);
  const policy=key();await db.query("insert into core.policy_versions(id,org_id,scope_center_id,key,effective_at,mandatory,value) values($1,$2,$3,'student_cancel_group',now(),false,$4)",[policy,org,center,JSON.stringify({kind:'cancellation',terms:{cutoff_minutes:0,before_cutoff:'release',after_cutoff:'consume',no_show:'consume'}})]);
  async function session(d,at,p=null,historical=false,attended=true){
   const id=key(),end=new Date(Date.parse(at)+3600000).toISOString();await db.query("insert into core.sessions(id,org_id,center_id,discipline_id,format,starts_at,ends_at,nominal,maximum,state,attendance_state) values($1,$2,$3,$4,'group',$5,$6,10,10,$7,$8)",[id,org,center,d,at,end,historical?'occurred':'planned',historical?'closed':'open']);
   if(p){const reservation=key();await db.query("insert into core.reservations(id,org_id,center_id,session_id,person_id,mode,state,policy_version_id) values($1,$2,$3,$4,$5,'flexible',$6,$7)",[reservation,org,center,id,p,historical?'completed':'active',policy]);if(historical)await db.query('insert into core.attendance_entries(id,org_id,center_id,reservation_id,result) values($1,$2,$3,$4,$5)',[key(),org,center,reservation,attended?'attended':'no_show']);}return id;
  }
  early=await session(discipline,'2030-01-01T10:00:00Z',person);later=await session(second,'2030-01-01T12:00:00Z',person);hidden=await session(second,'2030-01-01T11:00:00Z');
  const alias=(await api('person_create_v1',{display_name:'Synthetic merged own history',contacts:[]})).primary_id;await session(second,'2020-01-01T12:00:00Z',alias,true);await db.query("update core.people set state='merged',merged_into_id=$1 where org_id=$2 and id=$3",[person,org,alias]);await session(discipline,'2020-01-02T12:00:00Z',person,true,false);
  for(let i=3;i<6;i++)await session(discipline,`2020-01-0${i}T12:00:00Z`,ownPerson,true);
  await t.test('default and disabled history preserve chronological order, even when ranking is requested',async()=>{
   assert.deepEqual(ids(await calendar()),[early,later]);assert.deepEqual(ids(await calendar({page:{sort:'recommendation_desc'}})),[early,later]);
   assert.deepEqual(ids(await calendar({interest_filter:true})),[early,later]);
  });
  await t.test('explicit center and discipline interests intersect, independent of history opt-in',async()=>{
   await change({interest_center_ids:[center.toUpperCase()],interest_discipline_ids:[second.toUpperCase()]});assert.deepEqual(ids(await calendar({interest_filter:true})),[later]);assert.deepEqual(ids(await calendar()),[early,later]);
   await change({interest_center_ids:[otherCenter]});assert.deepEqual(ids(await calendar({interest_filter:true})),[]);await change({interest_center_ids:[],interest_discipline_ids:[]});
  });
  await t.test('opt-in ranks own completed attended history, never another person or no-show; pages retain order',async()=>{
   await change({history_recommendations:true});const ranked=await calendar({page:{sort:'recommendation_desc'}});assert.deepEqual(ids(ranked),[later,early]);assert(!ids(ranked).includes(hidden));assert.deepEqual(ids(await calendar()),[early,later]);
   assert(ranked.items.every(x=>!Object.keys(x).some(k=>k.startsWith('_'))));
   const first=await calendar({page:{sort:'recommendation_desc',limit:1}});assert.deepEqual(ids(first),[later]);assert(first.next_cursor);const next=await calendar({page:{sort:'recommendation_desc',limit:1,cursor:first.next_cursor}});assert.deepEqual(ids(next),[early]);assert.equal(next.next_cursor,null);
   await change({history_recommendations:false});await denied('calendar_get_v1',{org_id:org,center_id:center,interval,page:{sort:'recommendation_desc',cursor:first.next_cursor}},'VALIDATION_FAILED');assert.deepEqual(ids(await calendar({page:{sort:'recommendation_desc'}})),[early,later]);
  });
  await t.test('reset clears interests/history without editing business records and old preference cursors close',async()=>{
   await change({interest_discipline_ids:[second]});const p=await must(member,'settings_reset_preview_v1',{scope:'member',org_id:org,fields:['interest_center_ids','interest_discipline_ids','history_recommendations']});await must(member,'settings_reset_apply_v1',{scope:'member',org_id:org,expected_version:p.version,preview:{id:p.id,token:p.token}},key());assert.deepEqual(ids(await calendar({interest_filter:true})),[early,later]);assert.equal(Number((await rows('select count(*) from core.attendance_entries where org_id=$1',[org]))[0].count),5);
  });
  await t.test('preferences cannot select another account or widen current access; reads have no command side effects',async()=>{
   const snapshot=async()=>JSON.stringify(await rows('select (select count(*) from core.operation_receipts where org_id=$1) receipts,(select count(*) from core.audit_events where org_id=$1) audit,(select count(*) from core.reservations where org_id=$1) reservations',[org]));const before=await snapshot();await calendar({interest_filter:true,page:{sort:'recommendation_desc'}});assert.equal(await snapshot(),before);
   await denied('calendar_get_v1',{org_id:org,interval,page:{},account_id:account.id},'VALIDATION_FAILED');await denied('calendar_get_v1',{org_id:org,interval,page:{},_calendar_preferences:{}},'VALIDATION_FAILED');await denied('calendar_get_v1',{org_id:org,interval,page:{sort:'recommendation_desc'}},'NOT_FOUND',stranger);
   await db.query("update core.account_links set state='revoked' where org_id=$1 and account_id=$2",[org,account.id]);await denied('calendar_get_v1',{org_id:org,interval,page:{sort:'recommendation_desc'},interest_filter:true},'NOT_FOUND');
  });
 }finally{await db.end();}
});
