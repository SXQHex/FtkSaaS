import test from 'node:test';import assert from 'node:assert/strict';
import {call} from './api-client.mjs';import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {preparationFixture} from './starter-preparation-fixture.mjs';
const calendar={rules:[{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'24:00:00',valid_from:'2020-01-01'}],closures:[]};
const denied=async(user,op,body,code)=>{const r=await call(user,op,body,key());assert.equal(r.result.ok,false);assert.equal(r.result.error.code,code,JSON.stringify(r.result));};

test('S10 work calendar copies once, previews adverse sessions and guards resource-free writes',async t=>{
 const f=await preparationFixture({schedule:true,session:true,workCalendar:calendar});t.after(()=>f.db.end());
 const {owner,db,org,center,discipline,scoped,api,read,change,must,q}=f;
 const first=await read('center');assert.deepEqual(first.values.work_calendar,calendar);assert.equal(first.preparation_sources.work_calendar.kind,'organization_copy');
 await change('organization',{work_calendar:null});assert.deepEqual((await read('center')).values.work_calendar,calendar);
 const sessions=(await db.query('select id,version,starts_at,ends_at from core.sessions where org_id=$1 and center_id=$2 order by starts_at',[org,center])).rows;assert(sessions.length>0);
 const s=sessions[0],closed={...calendar,closures:[{starts_at:s.starts_at.toISOString(),ends_at:s.ends_at.toISOString(),reason:'Explicit business closure'}]};
 const inspect=await api('management_state_get_v1',{operation:'settings_update_v1',selector:{operation:'settings_update_v1',key:{scope:'center',work_calendar:closed}},page:{}});
 const proposed=inspect.items[0].current.values;assert.equal(proposed.work_calendar_impact.count,1);assert.equal(proposed.work_calendar_impact.sessions[0].id,s.id);assert.equal(proposed.settings_version,(await read('center')).version);
 const before=await read('center');await denied(owner,'settings_update_v1',{...q('center'),expected_version:before.version,patch:{work_calendar:closed}},'OPEN_OPERATIONS_EXIST');
 assert.equal((await read('center')).version,before.version);assert.deepEqual((await read('center')).values.work_calendar,calendar);
 const preview=await api('session_cancel_preview_v1',{session_id:s.id,reason:'Resolve work-calendar conflict'});await api('session_cancel_apply_v1',{preview:{id:preview.id,token:preview.token}});
 await change('center',{work_calendar:closed});const stored=await read('center');assert.equal(stored.preparation_sources.work_calendar.kind,'center_local');assert.deepEqual(stored.values.public_hours,before.values.public_hours);
 // Resource-free sessions belong to Pro; Starter requires a room and instructor before interval validation.
 await db.query("update core.saas_plan_versions set name='pro' where id=$1",[f.plan]);
 await denied(owner,'session_create_v1',scoped({discipline_id:discipline,format:'group',interval:{starts_at:s.starts_at.toISOString(),ends_at:s.ends_at.toISOString()},resources:[],assignments:[],capacity:{total:10}}),'RESOURCE_CONFLICT');
 const reset=await must(owner,'settings_reset_preview_v1',{...q('center'),fields:['work_calendar']});assert.equal(reset.after.work_calendar,null);
 await must(owner,'settings_reset_apply_v1',{...q('center'),expected_version:reset.version,preview:{id:reset.id,token:reset.token}},key());assert.equal((await read('center')).values.work_calendar,null);
 assert.equal((await db.query('select state from core.sessions where id=$1',[s.id])).rows[0].state,'cancelled');
});

test('S10 discipline effects include live offers and future alternatives and never erase or resurrect references',async t=>{
 const f=await preparationFixture({schedule:true,session:true});t.after(()=>f.db.end());
 const {owner,db,org,center,discipline,person,scoped,api,must}=f;
 const sessions=(await db.query('select id,starts_at,ends_at from core.sessions where org_id=$1 order by starts_at',[org])).rows;
 const request=key(),alternative=key(),entry=key(),offer=key();
 await db.query("insert into core.lesson_requests(id,org_id,center_id,person_id,discipline_id,format,requested_start,duration_minutes,state,expires_at) values($1,$2,$3,$4,$5,'private',now()-interval '1 day',60,'alternative_offered',now()+interval '1 day')",[request,org,center,person,discipline]);
 await db.query("insert into core.request_alternatives(id,org_id,center_id,request_id,starts_at,ends_at,instructor_id,state) values($1,$2,$3,$4,$5,$6,$7,'accepted')",[alternative,org,center,request,sessions[0].starts_at,sessions[0].ends_at,person]);
 await db.query("insert into core.waitlist_entries(id,org_id,center_id,session_id,person_id,joined_at,state) values($1,$2,$3,$4,$5,now(),'offered')",[entry,org,center,sessions[0].id,person]);
 await db.query("insert into core.seat_offers(id,org_id,center_id,entry_id,session_id,person_id,expires_at,state) values($1,$2,$3,$4,$5,$6,now()+interval '1 hour','active')",[offer,org,center,entry,sessions[0].id,person]);
 const inspect=async(local=false)=>api('management_state_get_v1',{...(local?{}:{center_id:undefined}),operation:local?'center_discipline_set_v1':'discipline_save_v1',selector:{operation:local?'center_discipline_set_v1':'discipline_save_v1',key:{discipline_id:discipline,include_deactivation_effects:true}},page:{}});
 const global=await inspect(),effects=global.items[0].current.values.deactivation_effects;assert.equal(effects.blocking,true);assert.equal(effects.counts.offers,1);assert.equal(effects.counts.requests,1);assert(effects.items.some(x=>x.id===offer));assert(effects.items.some(x=>x.id===request));
 assert.equal((await inspect(true)).items[0].current.values.deactivation_effects.counts.sessions,sessions.length);
 await denied(owner,'discipline_save_v1',{org_id:org,discipline_id:discipline,name:'Yoga',state:'inactive',expected_version:global.items[0].versions[0].version,deactivation_proof:effects.proof},'OPEN_OPERATIONS_EXIST');
 // Existing domain cancellation and request withdrawal resolve the blocking work.
 await api('lesson_request_withdraw_v1',{lesson_request_id:request,expected_version:1});
 for(const s of sessions){const p=await api('session_cancel_preview_v1',{session_id:s.id,reason:'Explicit discipline closure'});await api('session_cancel_apply_v1',{preview:{id:p.id,token:p.token}});}
 const current=await inspect(),ack=current.items[0].current.values.deactivation_effects;assert.equal(ack.blocking,false);assert(ack.counts.classes>0);
 const body={org_id:org,discipline_id:discipline,name:'Yoga',state:'inactive',expected_version:current.items[0].versions[0].version};
 await denied(owner,'discipline_save_v1',body,'PREVIEW_STALE');await must(owner,'discipline_save_v1',{...body,deactivation_proof:ack.proof},key());
 const count=(await db.query('select count(*)::int n from core.sessions where org_id=$1',[org])).rows[0].n;assert.equal(count,sessions.length);
 const inactive=(await must(owner,'disciplines_list_v1',{org_id:org,page:{}})).items.find(d=>d.id===discipline);
 await must(owner,'discipline_save_v1',{org_id:org,discipline_id:discipline,name:'Yoga',state:'active',expected_version:inactive.version},key());
 assert((await db.query('select state from core.sessions where org_id=$1',[org])).rows.every(s=>s.state==='cancelled'));
});
