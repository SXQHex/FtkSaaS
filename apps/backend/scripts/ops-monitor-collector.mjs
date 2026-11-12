// Native operator diagnostics plus an independent external availability probe.
// No caller-provided SQL, raw errors, tenant payloads or credentials are returned.
export async function readMonitorTelemetry(client,{signal}={}){
 // The adapter owns a dedicated connection; abort closes it so an abandoned
 // query cannot consume a connection indefinitely after the reader deadline.
 const abort=()=>{client.end().catch(()=>console.error('MONITOR_CONNECTION_CLOSE_FAILED'));};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  if(signal?.aborted){abort();throw new Error('MONITOR_TELEMETRY_UNAVAILABLE');}
  const result=await client.query('select ops_monitor.snapshot() value');
  if(result.rows?.length!==1||!result.rows[0].value)throw new Error('MONITOR_TELEMETRY_UNAVAILABLE');
  return result.rows[0].value;
 }finally{signal?.removeEventListener('abort',abort);}
}

export async function probeServices({targets,timeoutMs,fetcher=fetch}){
 if(!Array.isArray(targets)||!targets.length||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new Error('MONITOR_PROBE_CONFIG_REQUIRED');
 for(const target of targets){
  let url;try{url=new URL(target?.url);}catch{throw new Error('INVALID_MONITOR_PROBE');}
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))||!Array.isArray(target.statuses)||!target.statuses.length||!target.statuses.every(status=>Number.isInteger(status)&&status>=100&&status<=599))throw new Error('INVALID_MONITOR_PROBE');
 }
 const outcomes=await Promise.all(targets.map(async target=>{
  try{
   const response=await fetcher(target.url,{headers:target.headers,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
   await response.body?.cancel();return target.statuses.includes(response.status);
  }catch{return false;}
 }));
 return outcomes.every(Boolean);
}

export async function collectMonitorObservation({readTelemetry,readBackup,probe,readerTimeoutMs,clock=Date.now}){
 if(![readTelemetry,readBackup,probe].every(reader=>typeof reader==='function')||!Number.isSafeInteger(readerTimeoutMs)||readerTimeoutMs<1||readerTimeoutMs>30000)throw new Error('MONITOR_READER_DEADLINE_REQUIRED');
 const bounded=reader=>{
  const controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('MONITOR_READER_TIMEOUT'));},readerTimeoutMs);});
  return Promise.race([Promise.resolve().then(()=>reader({signal:controller.signal})),timeout]).finally(()=>clearTimeout(timer));
 };
 const [telemetry,backup,available]=await Promise.allSettled([bounded(readTelemetry),bounded(readBackup),bounded(probe)]);
 const readable=telemetry.status==='fulfilled'&&telemetry.value!==null;
 return {checkedAt:new Date(clock()).toISOString(),telemetryAvailable:readable,
  serviceAvailable:readable&&available.status==='fulfilled'&&available.value===true,
  workers:readable?telemetry.value.workers:null,jobs:readable?telemetry.value.jobs:null,incidents:readable?telemetry.value.incidents:null,backup:backup.status==='fulfilled'?backup.value:{state:'unavailable',usableAt:null}};
}
