import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../uuid.mjs';
import {restoreSettingsField} from './s10-hosted-sources.mjs';

const origin='https://gwyprhenabtpkbojephw.supabase.co';
class DomainError extends Error {}

// Opt-in acceptance on an explicitly supplied test center/discipline. There are
// no participants, duties, products or financial mutations. Only sessions made
// by this invocation are cancelled; concurrent calendar changes are not replaced.
export async function acceptWorkCalendar({email,password,apikey,org,center,discipline,startsAt,request=fetch}){
 assert(email&&password&&apikey&&org&&center&&discipline,'Authorized acceptance inputs required');
 const start=Date.parse(startsAt);assert(Number.isFinite(start)&&start>Date.now()+86400000,'Explicit future test interval required');
 const interval={starts_at:new Date(start).toISOString(),ends_at:new Date(start+3600000).toISOString()};
 let token,restore,phase='login';const checks=[],owned=new Set(),pendingCreates=new Map(),pendingCancels=new Map();
 const json=async(path,body)=>{
  const r=await request(origin+path,{method:'POST',headers:{apikey,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('HTTP_'+r.status);
  if(path==='/auth/v1/logout?scope=local'){assert.equal(r.status,204);return null;}
  return r.json();
 };
 const call=async(op,body={},operationKey)=>{
  const r=await json('/functions/v1/backend-v1/'+op,{client_api_version:1,request_id:key(),org_id:org,center_id:center,...body,...(operationKey?{operation_key:operationKey}:{})});
  if(r?.ok===false&&/^[A-Z_]+$/.test(r.error?.code??''))throw new DomainError(r.error.code);
  if(r?.ok!==true||!r.data||typeof r.data!=='object')throw Error('INVALID_ENVELOPE');return r.data;
 };
 const scope={scope:'center',center_id:center},read=q=>call('settings_get_v1',q);
 const create=async(body,operationKey=key())=>{
  pendingCreates.set(operationKey,body);
  try{const result=await call('session_create_v1',body,operationKey);assert.equal(typeof result.primary_id,'string');owned.add(result.primary_id);pendingCreates.delete(operationKey);return result;}
  catch(error){if(error instanceof DomainError&&!['OPERATION_IN_PROGRESS','OPERATION_RESULT_EXPIRED','TEMPORARY_FAILURE'].includes(error.message))pendingCreates.delete(operationKey);throw error;}
 };
 const cancel=async id=>{
  const preview=await call('session_cancel_preview_v1',{session_id:id,reason:'Complete isolated backend calendar acceptance'});
  assert.deepEqual(preview.blockers,[]);
  const body={preview:{id:preview.id,token:preview.token}},operationKey=key();pendingCancels.set(operationKey,{id,body});
  await call('session_cancel_apply_v1',body,operationKey);pendingCancels.delete(operationKey);owned.delete(id);
 };
 try{
  token=(await json('/auth/v1/token?grant_type=password',{email,password})).access_token;assert(token);
  phase='Pro and center preflight';assert.equal((await call('subscription_get_v1')).plan,'pro');
  const before=await read(scope),sessionBody={discipline_id:discipline,format:'group',interval,resources:[],assignments:[],capacity:{total:1}};
  phase='test-owned session';const session=await create(sessionBody);
  const proposed=structuredClone(before.values.work_calendar??{rules:[{weekdays:[1,2,3,4,5,6,7],local_start:'00:00:00',local_end:'24:00:00',valid_from:'1970-01-01'}],closures:[]});
  proposed.closures.push({...interval,reason:'Isolated backend acceptance closure'});
  phase='exact impact';const view=await call('management_state_get_v1',{operation:'settings_update_v1',selector:{operation:'settings_update_v1',key:{scope:'center',work_calendar:proposed}},page:{}});
  const impact=view.items[0].current.values.work_calendar_impact;
  assert.equal(impact.count,1);assert.equal(impact.truncated,false);assert.deepEqual(impact.sessions.map(s=>s.id),[session.primary_id]);
  const body={...scope,expected_version:before.version,patch:{work_calendar:proposed}};
  // Capture before even a negative write: an unexpected commit or response loss
  // must still restore the original effective value AND its source.
  restore={q:scope,field:'work_calendar',before,expected:proposed,expectedInherited:false,expectedOverride:true};
  phase='active-session rejection';await assert.rejects(()=>call('settings_update_v1',body,key()),error=>error instanceof DomainError&&error.message==='OPEN_OPERATIONS_EXIST');
  const unchanged=await read(scope);assert.equal(unchanged.version,before.version);assert.deepEqual(unchanged.values.work_calendar,before.values.work_calendar);
  checks.push('real scoped impact and active-session rejection without mutation');
  phase='explicit session cancellation';await cancel(session.primary_id);
  phase='closure save and replay';const saveKey=key();await call('settings_update_v1',body,saveKey);assert.equal((await call('settings_update_v1',body,saveKey)).replayed,true);
  const saved=await read(scope);assert.deepEqual(saved.values.work_calendar,proposed);assert.deepEqual(saved.values.public_hours,before.values.public_hours);
  checks.push('explicit cancellation permits closure, reread and replay; public hours unchanged');
  phase='resource-free session rejection';await assert.rejects(()=>create(sessionBody),error=>error instanceof DomainError&&error.message==='RESOURCE_CONFLICT');
  checks.push('real Pro resource-free writer enforces the saved center calendar');
 }catch(error){
  const code=error instanceof DomainError&&/^[A-Z_]+$/.test(error.message)?error.message:'ASSERTION_OR_TRANSPORT';
  throw Error('Hosted work-calendar acceptance failed at '+phase+'; code='+code+'; provider data withheld');
 }finally{
  let failed=false;
  if(token){
   // Recover the original intent before issuing another cancellation. A lost
   // response is not evidence that a create/apply failed to commit.
   const unresolvedCancels=new Set();
   for(const [operationKey,body] of pendingCreates){try{owned.add((await call('session_create_v1',body,operationKey)).primary_id);}catch{failed=true;}}
   for(const [operationKey,{id,body}] of pendingCancels){try{await call('session_cancel_apply_v1',body,operationKey);owned.delete(id);}catch{failed=true;unresolvedCancels.add(id);}}
   for(const id of owned)if(!unresolvedCancels.has(id))try{await cancel(id);}catch{failed=true;}
   if(restore)try{await restoreSettingsField(restore,{read,call});}catch{failed=true;}
   try{
    await json('/auth/v1/logout?scope=local');
    const r=await request(origin+'/functions/v1/backend-v1/account_get_v1',{method:'POST',headers:{apikey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({client_api_version:1,request_id:key()}),signal:AbortSignal.timeout(30000)});
    const closed=await r.json();assert.equal(closed.ok,false);assert(['AUTH_REQUIRED','SESSION_REVOKED'].includes(closed.error?.code));
   }catch{failed=true;}
  }
  if(failed)throw Error('Work-calendar cleanup requires inspection; concurrent state was not overwritten');
 }
 checks.push('only test-owned sessions cancelled; original calendar value/source restored; local logout');
 return {status:'passed',checks};
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{console.log(JSON.stringify(await acceptWorkCalendar({email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,apikey:process.env.FTK_ACCEPTANCE_APIKEY,org:process.env.FTK_ACCEPTANCE_ORG,center:process.env.FTK_ACCEPTANCE_CENTER,discipline:process.env.FTK_ACCEPTANCE_DISCIPLINE,startsAt:process.env.FTK_ACCEPTANCE_START})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
