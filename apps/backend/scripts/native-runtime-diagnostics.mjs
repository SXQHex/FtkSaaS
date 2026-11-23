import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {backendRoot,ciFile} from './paths.mjs';

const processStartedAt=new Date(performance.timeOrigin).toISOString();
export const nativeLogLimits=Object.freeze({timeout:5000,maxBuffer:2*1024*1024,tail:2000});
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const limitLine=new RegExp('^(CPU time(?: hard| soft)? limit reached|memory limit reached for the worker|wall clock (?:duration|duraiton) reached|wall clock duration warning): isolate: ('+uuid+')(?: \\(in_flight_req_exists = (?:true|false)\\))?$','i');
const reasons=new Map([
 ['CPU time limit reached','CPU_LIMIT'],['CPU time hard limit reached','CPU_HARD_LIMIT'],
 ['CPU time soft limit reached','CPU_SOFT_LIMIT'],['memory limit reached for the worker','MEMORY_LIMIT'],
 ['wall clock duration reached','WALL_CLOCK_LIMIT'],['wall clock duraiton reached','WALL_CLOCK_LIMIT'],
 ['wall clock duration warning','WALL_CLOCK_WARNING'],
]);
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;

// Native CLI machine logs preserve raw payloads. Only these fixed runtime
// messages survive; never copy the line, URI, arbitrary error, or headers.
export function nativeRuntimeEvent(record){
 if(record?.type!=='log-entry'||record.service!=='functions'||!['stdout','stderr'].includes(record.stream))return null;
 const at=timestamp(record.timestamp);if(!at||typeof record.line!=='string')return null;
 const match=limitLine.exec(record.line);
 if(match){const reason=reasons.get(match[1]);return reason?{at,kind:'native.runtime',reason,isolate_id:match[2].toLowerCase()}:null;}
 if(/^connection aborted \(uri: ".*"\)$/.test(record.line))return {at,kind:'native.runtime',reason:'CONNECTION_ABORTED'};
 if(/^(?:\[functions\] worker error )?WorkerRequestCancelled: request has been cancelled by supervisor$/.test(record.line))return {at,kind:'native.runtime',reason:'REQUEST_CANCELLED'};
 if(record.line==='main worker has been destroyed')return {at,kind:'native.runtime',reason:'MAIN_WORKER_DESTROYED'};
 return null;
}

export function collectNativeRuntimeDiagnostics({since=processStartedAt,cwd=backendRoot,run=spawnSync}={}){
 const at=new Date().toISOString(),events=[],gaps=new Set();let lines=0;
 if(!timestamp(since))return [{at,kind:'native.logs.gap',reason:'INVALID_WINDOW'}];
 try{
  // Retained local history only: this does not start, follow, or restart a stack.
  // Use a process-start timestamp: --since start would discard an earlier crash
  // if the service had restarted before this collection.
  const result=run(path.join(cwd,'node_modules/.bin/supabase'),['stack','logs','--service','functions','--since',since,'--tail',String(nativeLogLimits.tail),'--output-format','stream-json'],{
   cwd,encoding:'utf8',timeout:nativeLogLimits.timeout,maxBuffer:nativeLogLimits.maxBuffer,killSignal:'SIGKILL',
   stdio:['ignore','pipe','ignore'],env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'},
  });
  if(result.error){const code=result.error.code;gaps.add(code==='ETIMEDOUT'?'CLI_TIMEOUT':code==='ENOBUFS'?'BUFFER_LIMIT':code==='ENOENT'?'CLI_UNAVAILABLE':'CLI_FAILED');}
  else if(result.status!==0)gaps.add('CLI_FAILED');
  // stream-json lets already complete events survive a timeout/buffer limit.
  for(const line of String(result.stdout??'').split('\n').filter(Boolean)){
   let record;try{record=JSON.parse(line);}catch{gaps.add('INVALID_EVENT');continue;}
   if(record?.type==='log-marker'&&record.service==='functions'&&record.kind==='lost')gaps.add('RETENTION_LOSS');
   if(record?.type!=='log-entry'||record.service!=='functions')continue;
   lines++;
   const event=nativeRuntimeEvent(record);if(event)events.push(event);
  }
 }catch{gaps.add('COLLECTION_FAILED');}
 if(lines>=nativeLogLimits.tail)gaps.add('TAIL_LIMIT');
 if(lines===0)gaps.add('NO_RETAINED_LOGS');
 return [...events,...[...gaps].map(reason=>({at,kind:'native.logs.gap',reason})),{at,kind:'native.logs.capture',since,retained_lines:lines,matched_events:events.length,complete:gaps.size===0}];
}

export function invalidJsonResponseError(response,label,bytes,{enabled=process.env.FTK_TEST_DIAGNOSTICS==='1'||!!process.env.CI,output=ciFile('diagnostics','native-http-'+process.pid+'.jsonl'),write=fs.appendFileSync,...options}={}){
 const rawType=response.headers.get('content-type'),mime=rawType?.split(';',1)[0].trim().toLowerCase();
 const contentType=rawType===null?null:['application/json','text/plain','text/html'].includes(mime)?mime:'unrecognized';
 const rawServedBy=response.headers.get('x-served-by'),servedBy=rawServedBy===null?'missing':rawServedBy==='base/server'?'base/server':'unrecognized';
 const error=new Error(label+' returned invalid JSON (HTTP '+response.status+', content-type '+contentType+', bytes '+bytes+', x-served-by '+servedBy+')');
 if(enabled){
  try{
   fs.mkdirSync(path.dirname(output),{recursive:true});
   const record=rows=>write(output,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
   // Persist response evidence before the bounded CLI call can fail or time out.
   record([{at:new Date().toISOString(),kind:'http.invalid_json',status:response.status,content_type:contentType,bytes,served_by:servedBy}]);
   record(collectNativeRuntimeDiagnostics(options));
  }catch{
   // Diagnostics must not replace the original failed response or its test exit.
   // No raw exception detail: filesystem/CLI errors can contain private data.
   try{process.stderr.write('[native-diagnostics] {"kind":"native.logs.gap","reason":"WRITE_FAILED"}\n');}
   catch{return error;}
  }
 }
 return error;
}
