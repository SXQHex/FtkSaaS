// Offline plan and evidence analysis. The runner accepts a caller-owned adapter
// for a prepared synthetic target. This module has no HTTP, DB or credential access.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const pilotProject='fuiidquhnqevrozizdcj';
const validDeployment=id=>typeof id==='string'&&id.startsWith(pilotProject+'_')&&/^[a-z0-9_-]{24,110}$/i.test(id);
const mixed=['people_list_v1','person_get_v1','calendar_get_v1','report_export_start_v1'];
const writes=['collection_record_v1','reservation_create_v1','reservation_cancel_v1','attendance_close_v1'];
const operations=[...mixed,...writes];
const failureKinds=new Set(['http_error','invalid_json','operation_rejected','unexpected_response','timeout','transport_error']);
const safeErrorCodes=new Set(JSON.parse(readFileSync(new URL('../../../../packages/api-contracts/schema/contract.json',import.meta.url),'utf8')).$defs.SafeError.properties.code.enum);
const targetMs=operation=>mixed.slice(0,2).includes(operation)?1000:2000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validMs=value=>Number.isFinite(value)&&value>=0;
const percentile95=times=>[...times].sort((a,b)=>a-b)[Math.ceil(times.length*.95)-1];

export function pilotPlan(){
 return Array.from({length:12},(_,wave)=>Array.from({length:50},(_,actor)=>({
  wave,actor,organization:Math.floor(actor/5),
  operation:wave<8?mixed[(actor+wave)%mixed.length]:writes[wave-8]
 })));
}

// The adapter validates the business result and may supply failure metadata.
// Persist each completed wave even if a later wave cannot start.
export async function capturePilot({sourceSha,projectRef,deploymentId,actors,activeStudents,invoke,saveWave}){
 if(!/^[0-9a-f]{40}$/.test(sourceSha)||projectRef!==pilotProject||!validDeployment(deploymentId)
  ||typeof invoke!=='function'||typeof saveWave!=='function')throw Error('PILOT_SOURCE_TARGET_AND_ADAPTER_REQUIRED');
 if(!Array.isArray(actors)||actors.length!==50||actors.some(a=>!uuid.test(a?.account)||!uuid.test(a?.org))
  ||new Set(actors.map(a=>a.account.toLowerCase())).size!==50)throw Error('PILOT_ACTOR_PROFILE_MISMATCH');
 const orgs=Array.from({length:10},(_,i)=>actors[i*5].org.toLowerCase());
 if(new Set(orgs).size!==10||actors.some((a,i)=>a.org.toLowerCase()!==orgs[Math.floor(i/5)])
  ||orgs.some(org=>activeStudents?.[org]!==500))throw Error('PILOT_TENANT_PROFILE_MISMATCH');
 const {newUuidV7}=await import('../uuid.mjs');
 const runId=newUuidV7();
 for(const wave of pilotPlan()){
  const started_at=new Date().toISOString();
  const samples=await Promise.all(wave.map(async slot=>{
   const requestId=newUuidV7(),started=performance.now();
   let ok=false,providerId=null,failure;
   try{
    const result=await invoke({slot,actor:actors[slot.actor],requestId});
    ok=result?.ok===true;
    if(uuid.test(result?.provider_request_id))providerId=result.provider_request_id.toLowerCase();
    if(!ok){
     const status=result?.http_status;
     failure={kind:failureKinds.has(result?.failure_kind)?result.failure_kind:'unexpected_response',
      http_status:Number.isInteger(status)&&status>=100&&status<=599?status:null};
     if(safeErrorCodes.has(result?.error_code))failure.error_code=result.error_code;
    }
   }catch(error){
    failure={kind:error?.name==='TimeoutError'?'timeout':'transport_error',http_status:null};
   }
   return {...slot,request_id:requestId,ok,provider_id:providerId,client_ms:performance.now()-started,...(failure?{failure}:{})};
  }));
  await saveWave({run_id:runId,source_sha:sourceSha,project_ref:projectRef,deployment_id:deploymentId,started_at,finished_at:new Date().toISOString(),samples});
  if(samples.some(row=>!row.ok||!row.provider_id))throw Error('PILOT_INCOMPLETE_WAVE_RECONCILE_BEFORE_RETRY');
 }
}

export function summarizePilot(waves,providerRows){
 if(!Array.isArray(waves)||waves.length!==12||!Array.isArray(providerRows)||providerRows.length!==600)
  throw Error('PILOT_COMPLETE_CAPTURE_REQUIRED');
 const {run_id,source_sha,project_ref,deployment_id}=waves[0]??{};
 if(!uuid.test(run_id)||!/^[0-9a-f]{40}$/.test(source_sha)||project_ref!==pilotProject||!validDeployment(deployment_id)
  ||waves.some(w=>!Array.isArray(w?.samples)||w.samples.length!==50||w.run_id!==run_id||w.source_sha!==source_sha||w.project_ref!==project_ref||w.deployment_id!==deployment_id))
  throw Error('PILOT_RUN_SCOPE_MISMATCH');
 const timings=new Map();
 for(const row of providerRows){
  if(row?.project_ref!==project_ref||row.deployment_id!==deployment_id||!operations.includes(row.operation)||!uuid.test(row.provider_id)||!validMs(row.execution_time_ms)
   ||timings.has(row.provider_id.toLowerCase()))throw Error('PILOT_PROVIDER_ROWS_INVALID');
  timings.set(row.provider_id.toLowerCase(),row);
 }
 const planned=pilotPlan().flat(),samples=waves.flatMap(w=>w.samples);
 if(samples.length!==planned.length)throw Error('PILOT_SAMPLES_MISSING');
 const measured=new Map(operations.map(op=>[op,{client:[],backend:[],errors:0}]));
 for(let i=0;i<planned.length;i++){
  const row=samples[i],expected=planned[i];
  if(Object.entries(expected).some(([k,v])=>row?.[k]!==v)||!uuid.test(row.provider_id)
   ||typeof row.ok!=='boolean'||!validMs(row.client_ms))throw Error('PILOT_SAMPLE_MISMATCH');
  const id=row.provider_id.toLowerCase();
  if(timings.get(id)?.operation!==row.operation)throw Error('PILOT_REQUEST_CORRELATION_FAILED');
  const op=measured.get(row.operation);
  op.backend.push(timings.get(id).execution_time_ms);op.client.push(row.client_ms);op.errors+=Number(!row.ok);
  timings.delete(id);
 }
 const results=operations.map(operation=>{
  const op=measured.get(operation),backend_p95_ms=percentile95(op.backend);
  return {operation,samples:op.backend.length,errors:op.errors,target_ms:targetMs(operation),
   backend_p95_ms,client_p95_ms:percentile95(op.client),within_target:backend_p95_ms<=targetMs(operation)};
 });
 return {run_id,source_sha,project_ref,deployment_id,results,latency_and_responses_ok:results.every(r=>r.errors===0&&r.within_target)};
}

// These four UTC instants come from one drill: a consistent DB + Storage point,
// the simulated loss, the independent detection and the verified reopening.
export function recoveryTimings({recovery_point_at,incident_at,detected_at,recovered_at}){
 const instants=[recovery_point_at,incident_at,detected_at,recovered_at];
 const ms=instants.map(x=>Date.parse(x));
 if(instants.some((x,i)=>typeof x!=='string'||!Number.isFinite(ms[i])||new Date(ms[i]).toISOString()!==x
  ||(i>0&&ms[i]<ms[i-1])))throw Error('RECOVERY_TIMELINE_INVALID');
 const rpo_ms=ms[1]-ms[0],rto_ms=ms[3]-ms[2];
 return {rpo_ms,rto_ms,rpo_within_24h:rpo_ms<=86400000,rto_within_8h:rto_ms<=28800000};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [command,...files]=process.argv.slice(2);
 if(command==='plan'&&files.length===0)console.log(JSON.stringify(pilotPlan()));
 else if(command==='recovery'&&files.length===1){
  const timing=recoveryTimings(JSON.parse(readFileSync(files[0],'utf8')));
  console.log(JSON.stringify(timing,null,2));
  if(!timing.rpo_within_24h||!timing.rto_within_8h)process.exitCode=1;
 }else if(command==='summarize'&&files.length===2){
  const [waves,provider]=files.map(file=>JSON.parse(readFileSync(file,'utf8')));
  const report=summarizePilot(waves,provider);
  console.log(JSON.stringify(report,null,2));
  if(!report.latency_and_responses_ok)process.exitCode=1;
 }else throw Error('Use plan, summarize <waves.json> <provider.json> or recovery <clock.json>');
}
