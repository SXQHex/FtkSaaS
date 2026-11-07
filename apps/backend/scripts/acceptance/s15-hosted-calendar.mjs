import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../uuid.mjs';

// Existing development test account only. Credentials and bearer URLs remain in
// memory; only subscriptions created by this invocation are revoked in cleanup.
const origin='https://gwyprhenabtpkbojephw.supabase.co';
export async function acceptCalendar({email,password,apikey,org,checkRoute,exerciseAccessLoss,request=fetch}){
 assert(email&&password&&apikey&&org,'Authorized acceptance inputs required');
 let token,phase='native login';const checks=[],owned=new Map(),pending=new Map();
 const json=async(path,body)=>{
  const r=await request(origin+path,{method:'POST',headers:{apikey,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  if(!r.ok)throw Error('HTTP_'+r.status);return r.status===204?null:r.json();
 };
 const call=async(op,body={},operationKey)=>{
  const r=await json('/functions/v1/backend-v1/'+op,{client_api_version:1,request_id:key(),...body,...(operationKey?{operation_key:operationKey}:{})});
  if(!r.ok)throw Error(r.error?.code??'INVALID_ENVELOPE');return r.data;
 };
 const track=r=>{owned.set(r.link.id,r.link.version);return r;};
 const feed=async(url,method='GET',expected=200)=>{
  const parsed=new URL(url);assert.equal(parsed.origin,origin);assert.match(parsed.pathname,/^\/functions\/v1\/personal-calendar\/calendar\/[a-f0-9]{64}\.ics$/);assert.equal(parsed.search,'');
  const r=await request(url,{method,redirect:'error',signal:AbortSignal.timeout(35000)});assert.equal(r.status,expected);
  const text=await r.text();assert.match(r.headers.get('cache-control'),/no-store/);
  if(expected===200){assert.match(r.headers.get('content-type'),/^text\/calendar/);if(method==='HEAD')assert.equal(text,'');else{assert(text.startsWith('BEGIN:VCALENDAR\r\n'));assert(text.endsWith('END:VCALENDAR\r\n'));assert(!text.includes('ATTENDEE:'));}}
  return {text,headers:r.headers};
 };
 try{
  token=(await json('/auth/v1/token?grant_type=password',{email,password})).access_token;assert(token);
  phase='readiness and canonical self';
  const orgs=await call('organizations_list_v1',{page:{limit:200}}),self=orgs.items.find(o=>o.id===org)?.self_context;assert(self?.person_id);assert(Array.isArray(self.centers));
  const before=await call('calendar_links_get_v1',{page:{limit:200}});assert.equal(before.service_ready,true);
  checks.push('native login, canonical self and configured calendar');
  const createKey=key(),create={organization_scope:{org_id:org},kinds:['lessons','duties']};pending.set(createKey,{op:'calendar_link_create_v1',body:create});
  phase='create and replay';let credential=track(await call('calendar_link_create_v1',create,createKey));pending.delete(createKey);
  const replay=await call('calendar_link_create_v1',create,createKey);assert.equal(replay.replayed,true);assert.equal(replay.subscription_url,credential.subscription_url);
  const listing=await call('calendar_links_get_v1',{page:{limit:200}});assert(listing.items.some(x=>x.id===credential.link.id));assert(!JSON.stringify(listing).includes('subscription_url'));
  checks.push('owned credential created, safely listed and replayed');
  phase='real unauthenticated GET and HEAD';
  const current=await feed(credential.subscription_url),head=await feed(credential.subscription_url,'HEAD');assert.equal(head.headers.get('content-length'),String(Buffer.byteLength(current.text)));
  const unfolded=current.text.replace(/\r\n[ \t]/g,''),urls=[...unfolded.matchAll(/^URL:(.+)\r$/gm)].map(m=>m[1]);
  checks.push('real public GET/HEAD, ICS, content length and no-store');
  if(checkRoute){assert(urls.length>0,'A real own session is required');phase='ICS session route';await checkRoute(urls[0]);checks.push('ICS session URL rendered with authorized native browser session');}
  phase='rotation and replay';const old=credential,rotateKey=key(),rotate={organization_scope:{org_id:org},link_id:old.link.id,expected_version:old.link.version};
  pending.set(rotateKey,{op:'calendar_link_rotate_v1',body:rotate});credential=track(await call('calendar_link_rotate_v1',rotate,rotateKey));pending.delete(rotateKey);assert.notEqual(credential.subscription_url,old.subscription_url);await feed(old.subscription_url,'GET',404);await feed(credential.subscription_url);
  const rotatedReplay=await call('calendar_link_rotate_v1',rotate,rotateKey);assert.equal(rotatedReplay.replayed,true);assert.equal(rotatedReplay.subscription_url,credential.subscription_url);
  await assert.rejects(()=>call('calendar_link_rotate_v1',rotate,key()),e=>e.message==='VERSION_CONFLICT');
  checks.push('rotation invalidates previous URL; replay and stale version enforced');
  if(exerciseAccessLoss){phase='live access loss';await exerciseAccessLoss(async()=>feed(credential.subscription_url,'GET',404));await feed(credential.subscription_url);checks.push('real organization access loss rejects bearer URL; restoration reread');}
  phase='revoke and replay';const revokeKey=key(),revoke={link_id:credential.link.id,expected_version:credential.link.version};
  pending.set(revokeKey,{op:'calendar_link_revoke_v1',body:revoke});await call('calendar_link_revoke_v1',revoke,revokeKey);pending.delete(revokeKey);owned.delete(credential.link.id);await feed(credential.subscription_url,'GET',404);assert.equal((await call('calendar_link_revoke_v1',revoke,revokeKey)).replayed,true);
  checks.push('revoke invalidates bearer URL and replays safely');
  return {status:'passed',coverage:{route:!!checkRoute,access_loss:!!exerciseAccessLoss},checks};
 }catch{throw Error('Hosted calendar acceptance failed at '+phase+'; credentials and URLs withheld');}
 finally{
  let failed=false;
  if(token){
   for(const [operationKey,{op,body}] of pending){try{const recovered=await call(op,body,operationKey);if(op==='calendar_link_revoke_v1')owned.delete(body.link_id);else track(recovered);}catch{failed=true;}}
   for(const [id,version] of owned){try{await call('calendar_link_revoke_v1',{link_id:id,expected_version:version},key());}catch{failed=true;}}
   try{await json('/auth/v1/logout?scope=local');}catch{failed=true;}
  }
  if(failed)throw Error('Calendar acceptance cleanup requires inspection; no unrelated subscription was changed');
 }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{const checkRoute=process.env.FTK_PLAYWRIGHT_CHROMIUM?async url=>{const {acceptCalendarRoute}=await import('./s15-calendar-browser-route.mjs');await acceptCalendarRoute({url,email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,executablePath:process.env.FTK_PLAYWRIGHT_CHROMIUM,proxy:process.env.HTTPS_PROXY,proxyCertificate:process.env.CODEX_PROXY_CERT});}:undefined;console.log(JSON.stringify(await acceptCalendar({checkRoute,email:process.env.FTK_ACCEPTANCE_EMAIL,password:process.env.FTK_ACCEPTANCE_PASSWORD,apikey:process.env.FTK_ACCEPTANCE_APIKEY,org:process.env.FTK_ACCEPTANCE_ORG})));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
