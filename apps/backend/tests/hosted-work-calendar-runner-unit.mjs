import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptWorkCalendar} from '../scripts/acceptance/s10-hosted-work-calendar.mjs';

const input={email:'acceptance@example.invalid',password:'Synthetic!Password',apikey:'synthetic-key',org:'org',center:'center',discipline:'discipline',startsAt:'2040-06-01T12:00:00Z'};
function fixture({lostCreate=false,lostCancel=false,lostSave=false,acceptProtectedWrite=false,acceptBlockedCreate=false,lostBlockedCreate=false,concurrentChange=false,foreignImpact=false,plan='pro',logoutFails=false,initialCalendar=null,initialOverride=false,invalidCreateResponse=false,logoutStillActive=false,cancelFaults=[]}={}){
 let version=0,calendar=structuredClone(initialCalendar),override=initialOverride,sequence=0,logout=false,cancelAttempt=0;const receipts=new Map(),sessions=new Map(),calls=[];
 const result=data=>Response.json({ok:true,data});
 const denied=code=>Response.json({ok:false,error:{code}});
 const snapshot=()=>({version,values:{work_calendar:structuredClone(calendar),public_hours:{unchanged:true}},overridden_fields:override?['work_calendar']:[],inherited_fields:{}});
 const request=async(url,options)=>{
  assert.equal(new URL(url).origin,'https://gwyprhenabtpkbojephw.supabase.co');
  const body=options.body?JSON.parse(options.body):{},op=new URL(url).pathname.split('/').at(-1);calls.push({op,body});
  if(url.includes('/token?'))return Response.json({access_token:'synthetic-session'});
  if(url.includes('/logout?')){logout=true;return new Response(null,{status:logoutFails?500:204});}
  if(op==='account_get_v1')return logout&&!logoutStillActive?denied('AUTH_REQUIRED'):result({id:'synthetic'});
  if(op==='subscription_get_v1')return result({plan});
  if(op==='settings_get_v1')return result(snapshot());
  if(op==='session_cancel_apply_v1'){
   const fault=cancelFaults[cancelAttempt++];
   if(fault==='lost')throw Error('sensitive cancellation transport failure');
   if(fault==='invalid')return result({});
   if(fault==='wrong')return result({primary_id:'unrelated-session'});
  }
  if(receipts.has(body.operation_key))return result({...receipts.get(body.operation_key),replayed:true});
  const commit=data=>{receipts.set(body.operation_key,data);return result(data);};
  if(op==='session_create_v1'){
   const closed=calendar?.closures?.some(c=>Date.parse(c.starts_at)<Date.parse(body.interval.ends_at)&&Date.parse(c.ends_at)>Date.parse(body.interval.starts_at));
   if(closed&&!acceptBlockedCreate){if(concurrentChange){calendar={rules:[],closures:[],other_writer:true};version++;}return denied('RESOURCE_CONFLICT');}
   const id='owned-'+(++sequence);sessions.set(id,'planned');const response=commit({primary_id:id,version:1});
   if(invalidCreateResponse&&sequence===1)return Response.json({});
   if(lostCreate&&sequence===1||lostBlockedCreate&&sequence===2)throw Error('sensitive provider response loss');
   return response;
  }
  if(op==='management_state_get_v1')return result({items:[{current:{values:{work_calendar_impact:{count:foreignImpact?2:1,truncated:false,sessions:[...sessions].filter(([,state])=>state==='planned').map(([id])=>({id})).concat(foreignImpact?[{id:'unrelated-session'}]:[])}}}}]});
  if(op==='settings_update_v1'){
   if(body.expected_version!==version)return denied('VERSION_CONFLICT');
   if([...sessions.values()].includes('planned')&&!acceptProtectedWrite)return denied('OPEN_OPERATIONS_EXIST');
   calendar=structuredClone(body.patch.work_calendar);override=true;version++;const response=commit({version});
   if(lostSave)throw Error('sensitive committed settings response loss');return response;
  }
  if(op==='session_cancel_preview_v1')return result({id:body.session_id,token:'synthetic-preview',blockers:[]});
  if(op==='session_cancel_apply_v1'){
   sessions.set(body.preview.id,'cancelled');const response=commit({primary_id:body.preview.id});
   if(lostCancel){lostCancel=false;throw Error('sensitive cancellation response loss');}return response;
  }
  if(op==='settings_reset_preview_v1')return result({id:'reset',token:'synthetic-reset',version,before:{work_calendar:calendar},after:{work_calendar:null}});
  if(op==='settings_reset_apply_v1'){calendar=null;override=false;version++;return commit({version});}
  throw Error('Unexpected request');
 };
 return {request,calls,sessions,state:()=>({calendar,override,logout})};
}

test('calendar acceptance restores the original default source and cancels only its owned sessions',async()=>{
 const f=fixture(),r=await acceptWorkCalendar({...input,request:f.request});assert.equal(r.status,'passed');
 assert.deepEqual(f.state(),{calendar:null,override:false,logout:true});assert.deepEqual([...f.sessions.values()],['cancelled']);
 assert.equal(JSON.stringify(r).includes(input.password),false);
});

for(const initialCalendar of [null,{rules:[{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'24:00:00',valid_from:'2030-01-01'}],closures:[{starts_at:'2038-01-01T10:00:00Z',ends_at:'2038-01-01T11:00:00Z',reason:'Existing closure'}]}])test('calendar acceptance preserves an existing local '+(initialCalendar?'calendar and closure':'null override'),async()=>{
 const f=fixture({initialCalendar,initialOverride:true});await acceptWorkCalendar({...input,request:f.request});
 assert.deepEqual(f.state(),{calendar:initialCalendar,override:true,logout:true});
 assert.equal(f.calls.some(c=>c.op==='settings_reset_apply_v1'),false);
});

for(const [name,options] of [
 ['create response lost after commit',{lostCreate:true}],
 ['create returns an invalid envelope after commit',{invalidCreateResponse:true}],
 ['cancellation response lost after commit',{lostCancel:true}],
 ['settings response lost after commit',{lostSave:true}],
 ['protected calendar write unexpectedly succeeds',{acceptProtectedWrite:true}],
 ['blocked create unexpectedly succeeds',{acceptBlockedCreate:true}],
 ['blocked create commits but response is lost',{acceptBlockedCreate:true,lostBlockedCreate:true}],
])test('calendar cleanup remains safe when '+name,async()=>{
 const f=fixture(options);await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/Hosted work-calendar acceptance failed/);
 assert.deepEqual(f.state(),{calendar:null,override:false,logout:true});assert([...f.sessions.values()].every(state=>state==='cancelled'));
 if(options.lostCancel)assert.equal(f.calls.filter(c=>c.op==='session_cancel_preview_v1').length,1);
 if(options.lostCreate)assert.equal(f.sessions.size,1);
 if(options.lostBlockedCreate)assert.equal(f.sessions.size,2);
});

test('calendar acceptance refuses an impact containing an unrelated session before any settings write',async()=>{
 const f=fixture({foreignImpact:true});await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/exact impact/);
 assert.equal(f.calls.some(c=>c.op==='settings_update_v1'),false);assert.deepEqual(f.state(),{calendar:null,override:false,logout:true});
 assert.deepEqual([...f.sessions.values()],['cancelled']);
});

for(const fault of ['invalid','wrong'])test('calendar cleanup reconciles a '+fault+' cancellation result with the original key',async()=>{
 const f=fixture({cancelFaults:[fault]});await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/Hosted work-calendar acceptance failed at explicit session cancellation/);
 assert.deepEqual([...f.sessions.values()],['cancelled']);assert.deepEqual(f.state(),{calendar:null,override:false,logout:true});
 const attempts=f.calls.filter(c=>c.op==='session_cancel_apply_v1');assert.equal(attempts.length,2);assert.equal(attempts[0].body.operation_key,attempts[1].body.operation_key);
 assert.equal(f.calls.filter(c=>c.op==='session_cancel_preview_v1').length,1);
});

for(const cancelFaults of [['lost','invalid'],['invalid','invalid']])test('unresolved cancellation cannot disappear from cleanup after '+cancelFaults.join('/'),async()=>{
 const f=fixture({cancelFaults});await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/cleanup requires inspection/);
 assert.deepEqual([...f.sessions.values()],['planned']);assert(f.state().logout);
 const attempts=f.calls.filter(c=>c.op==='session_cancel_apply_v1');assert.equal(attempts.length,2);assert.equal(attempts[0].body.operation_key,attempts[1].body.operation_key);
 assert.equal(f.calls.filter(c=>c.op==='session_cancel_preview_v1').length,1);
});

test('calendar cleanup refuses to overwrite a concurrent writer and still closes its session',async()=>{
 const f=fixture({concurrentChange:true});await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/cleanup requires inspection/);
 assert.equal(f.state().calendar.other_writer,true);assert(f.state().logout);assert.equal(f.calls.some(c=>c.op==='settings_reset_apply_v1'),false);
});

test('calendar acceptance refuses another plan before creating domain records',async()=>{
 const f=fixture({plan:'starter'});await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/Pro and center preflight/);
 assert.equal(f.sessions.size,0);assert.deepEqual(f.state(),{calendar:null,override:false,logout:true});
});

test('calendar acceptance cannot report success after logout failure',async()=>{
 const f=fixture({logoutFails:true});await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/cleanup requires inspection/);
 assert.equal(f.state().calendar,null);assert([...f.sessions.values()].every(state=>state==='cancelled'));
});

test('calendar acceptance rejects a successful logout response when Edge still accepts the session',async()=>{
 const f=fixture({logoutStillActive:true});await assert.rejects(()=>acceptWorkCalendar({...input,request:f.request}),/cleanup requires inspection/);
 assert.equal(f.state().calendar,null);assert([...f.sessions.values()].every(state=>state==='cancelled'));
});
