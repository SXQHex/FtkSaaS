import pg from 'pg';
import {newUuidV7 as id} from './uuid.mjs';
import * as validators from '../supabase/functions/backend-v1/validators.js';
import {pathToFileURL} from 'node:url';

// Credentials belong to a dedicated LOGIN granted only ftk_p06_worker, with an
// explicit private.p06_worker_scopes binding. No service key or human JWT used.
export async function tick(client,org,{limit=1}={}){
 const ids=()=>Array.from({length:4096},id);
 const claimed=(await client.query('select private.p06_jobs_claim($1,$2,$3) jobs',[org,ids(),limit])).rows[0].jobs;
 const results=[];
 for(const {operation,request} of claimed){
  if(!['import_rows_process_v1','report_build_v1'].includes(operation))throw Error('UNEXPECTED_WORKER_OPERATION');
  if(!validators['request_'+operation](request))throw Error('INVALID_WORKER_CLAIM');
  let result;
  try{
   let count=4096;
   for(let attempt=0;attempt<4;attempt++){
    result=(await client.query('select private.p06_worker_execute($1,$2,$3) result',[operation,request,Array.from({length:count},id)])).rows[0].result;
    if(result._internal_retry!=='uuid_bank_exhausted')break;
    const required=result.required_uuid_count;if(!Number.isSafeInteger(required)||required<1||required>2*Math.ceil(2097152/36)+64)throw Error('INVALID_WORKER_UUID_BANK');count=Math.max(count*2,required);
   }
   if(result._internal_retry)throw Error('WORKER_UUID_BANK_EXHAUSTED');
  }
  catch(error){
   // A center can close after claim. Keep that lease fenced for bounded reclaim,
   // and let the loop serve other live centers. Revoked worker identity still stops.
   if(error.code!=='P0001'||error.message!=='NOT_FOUND')throw error;
   result={ok:false,error:{code:'NOT_FOUND',retryable:false}};
  }
  if(result.ok&&!validators['success_'+operation](result))throw Error('INVALID_WORKER_RESULT');
  results.push(result);
 }
 return results;
}
export async function run({connectionString,org,once=true,intervalMs=5000,signal}={}){
 if(!connectionString||!org)throw Error('P06_WORKER_DATABASE_URL and P06_WORKER_ORG_ID required');
 if(!Number.isInteger(intervalMs)||intervalMs<1000)throw Error('INVALID_WORKER_INTERVAL');
 const client=new pg.Client({connectionString});await client.connect();
 try{
  const access=(await client.query("select current_user role,pg_has_role(session_user,'ftk_p06_worker','member') worker")).rows[0];
  if(!access.worker||['postgres','service_role','supabase_admin','authenticator'].includes(access.role))throw Error('DEDICATED_WORKER_LOGIN_REQUIRED');
  do{
   if(signal?.aborted)break;
   const results=await tick(client,org); // each claim/domain command commits separately
   console.log(JSON.stringify({claimed:results.length,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length}));
   if(once)break;
   await new Promise(resolve=>{const timer=setTimeout(done,intervalMs);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});
  }while(!signal?.aborted);
 }finally{await client.end();}
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const stop=new AbortController();process.once('SIGINT',()=>stop.abort());process.once('SIGTERM',()=>stop.abort());
 await run({connectionString:process.env.P06_WORKER_DATABASE_URL,org:process.env.P06_WORKER_ORG_ID,once:!process.argv.includes('--loop'),intervalMs:Number(process.env.P06_WORKER_INTERVAL_MS??5000),signal:stop.signal});
}
