// Explicit isolated-target run. Operator supplies pre-provisioned synthetic
// subjects. No seeding, SQL, deployment or external provider calls.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {capturePilot,pilotPlan} from './o10-pilot.mjs';
import {newUuidV7} from '../uuid.mjs';

const project='fuiidquhnqevrozizdcj',origin='https://'+project+'.supabase.co';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const writes=new Set(['report_export_start_v1','collection_record_v1','reservation_create_v1','reservation_cancel_v1','attendance_close_v1']);

export function pilotBody(operation,actor,booking){
 const {student,center,week,debt,sale,booking_session,attendance_session,close_version,occurred_at}=actor;
 switch(operation){
  case 'people_list_v1':return {relationship:'student',page:{limit:25}};
  case 'person_get_v1':return {person_id:student};
  case 'calendar_get_v1':return {interval:week,page:{limit:50}};
  case 'report_export_start_v1':return {report:'collections_debts',format:'csv',filters:{center_ids:[center],interval:week}};
  case 'collection_record_v1':return {person_id:student,debt_ids:[debt],currency:'TRY',amount_minor:'1000',occurred_at,payment:{method:'cash'}};
  case 'reservation_create_v1':return {person_id:student,session_id:booking_session,source_sale_id:sale,mode:'flexible'};
  case 'reservation_cancel_v1':
   if(!booking)throw Error('PILOT_BOOKING_ACK_REQUIRED');
   return {reservation_id:booking.id,expected_version:booking.version,reason:'Synthetic pilot cancellation'};
  case 'attendance_close_v1':return {session_id:attendance_session,expected_version:close_version,performed:false,performed_instructor_ids:[]};
  default:throw Error('PILOT_UNSUPPORTED_OPERATION');
 }
}

function expected(operation,data,actor,booking){
 if(!data||data.replayed===true)return false;
 switch(operation){
  case 'people_list_v1':return Array.isArray(data.items)&&data.items.length===25;
  case 'person_get_v1':return data.id===actor.student&&Boolean(data.subscriber_number);
  case 'calendar_get_v1':return Array.isArray(data.items)&&data.items.length>=2;
  case 'report_export_start_v1':return uuid.test(data.job_id);
  case 'collection_record_v1':return uuid.test(data.primary_id);
  case 'reservation_create_v1':return uuid.test(data.primary_id)&&Number.isSafeInteger(data.version)&&data.version>0;
  case 'reservation_cancel_v1':return data.primary_id===booking?.id;
  case 'attendance_close_v1':return data.primary_id===actor.attendance_session;
  default:return false;
 }
}

export async function runHostedPilot(config,directory){
 if(config?.projectRef!==project||!Array.isArray(config.actors)||config.actors.length!==50||!config.publishableKey?.startsWith('sb_publishable_'))
  throw Error('PILOT_PRIVATE_FIXTURE_REQUIRED');
 for(const a of config.actors){
  if(![a.account,a.org,a.center,a.student,a.debt,a.sale,a.booking_session,a.attendance_session].every(id=>uuid.test(id))
   ||!Number.isSafeInteger(a.close_version)||a.close_version<1||!Number.isFinite(Date.parse(a.occurred_at))
   ||Date.parse(a.week?.ends_at)-Date.parse(a.week?.starts_at)!==604800000||typeof a.access_token!=='string'||!a.access_token)
   throw Error('PILOT_PRIVATE_FIXTURE_INVALID');
 }
 // Separate network/auth preparation from measurement. A key is a public
 // project key and all business calls use the actor's confirmed native session.
 const headers=a=>({apikey:config.publishableKey,authorization:'Bearer '+a.access_token,'content-type':'application/json'});
 for(const actor of config.actors){
  const response=await fetch(origin+'/auth/v1/user',{headers:headers(actor),redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok||(await response.json()).id!==actor.account)throw Error('PILOT_AUTH_SCOPE_MISMATCH');
 }
 fs.mkdirSync(directory,{mode:0o700});
 const save=(name,object)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(object)+'\n',{flag:'wx',mode:0o600});
 const keys=pilotPlan().map(wave=>wave.map(slot=>writes.has(slot.operation)?newUuidV7():null));
 save('command-keys.private.json',keys);
 const bookings=new Map(),waves=[],receipts=[];
 await capturePilot({...config,
  invoke:async({slot,actor,requestId})=>{
   const booking=bookings.get(slot.actor),operationKey=keys[slot.wave][slot.actor];
   const body={client_api_version:1,request_id:requestId,org_id:actor.org,center_id:actor.center,
    ...pilotBody(slot.operation,actor,booking),...(operationKey?{operation_key:operationKey}:{})};
   const response=await fetch(origin+'/functions/v1/backend-v1/'+slot.operation,{
    method:'POST',headers:headers(actor),body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(60000)
   });
   const provider_request_id=response.headers.get('sb-request-id');
   const result=await response.json();
   const ok=response.ok&&result.ok===true&&expected(slot.operation,result.data,actor,booking);
   if(ok&&operationKey){
    const {primary_id,version,job_id}=result.data;
    receipts.push({wave:slot.wave,actor:slot.actor,request_id:requestId,primary_id,version,job_id});
    if(slot.operation==='reservation_create_v1')bookings.set(slot.actor,{id:primary_id,version});
   }
   return {ok,provider_request_id};
  },
  saveWave:async wave=>{
   const number=wave.samples[0].wave;
   save('wave-'+number+'.json',wave);
   save('ack-'+number+'.private.json',receipts.splice(0));
   waves.push(wave);
  }
 });
 save('waves.json',waves);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [fixture,directory,...extra]=process.argv.slice(2);
  if(!fixture||!directory||extra.length)throw Error('PILOT_PRIVATE_INPUT_AND_NEW_OUTPUT_REQUIRED');
  const fd=fs.openSync(fixture,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  let config;
  try{
   const st=fs.fstatSync(fd);
   if(!st.isFile()||(st.mode&0o077)!==0)throw Error('PILOT_PRIVATE_INPUT_REQUIRED');
   config=JSON.parse(fs.readFileSync(fd,'utf8'));
  }finally{fs.closeSync(fd);}
  await runHostedPilot(config,directory);
 }catch(error){
  console.error(/^PILOT_[A-Z_]+$/.test(error.message)?error.message:'PILOT_CAPTURE_FAILED');
  process.exitCode=1;
 }
}
