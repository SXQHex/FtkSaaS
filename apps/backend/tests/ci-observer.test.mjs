import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {memorySnapshot,signalEvent,dockerEvent,observe,edgeMemoryBudget,EDGE_MEMORY_LIMIT_KIB} from '../scripts/ci/observe-api.mjs';
import {nativeRuntimeEvent,collectNativeRuntimeDiagnostics,invalidJsonResponseError,nativeLogLimits} from '../scripts/native-runtime-diagnostics.mjs';
test('signal tracing distinguishes sender thread, sender process and target without command arguments',()=>{
 const line=' Runner.Worker-1959  [002] d..2. 1234.567: signal_generate: sig=15 errno=0 code=0 comm=node pid=2355 grp=1 res=0';
 assert.deepEqual(signalEvent(line,tid=> `Name:\tprocess\nTgid:\t${tid==='1959'?1900:2350}\n`),{sender_comm:'Runner.Worker',sender_tid:1959,sender_pid:1900,kernel_s:1234.567,signal:15,code:0,target_comm:'node',target_tid:2355,target_pid:2350,group:1,result:0});
 assert.equal(signalEvent(line,()=>{throw Error('exited');}).sender_pid,null);
 assert.equal(signalEvent('not a signal'),null);
});
test('Docker event output excludes labels, environment, and provider credentials',()=>{
 const value=dockerEvent({Type:'container',Action:'die',Actor:{ID:'container-id',Attributes:{exitCode:'137',secret:'private',name:'do-not-log'}},timeNano:123});
 assert.deepEqual(value,{time_nano:123,type:'container',action:'die',id:'container-id',exit_code:'137'});
 assert(!JSON.stringify(value).includes('private'));
 for(const action of ['exec_create: /bin/sh -c SECRET_SENTINEL','exec_start: token=SECRET_SENTINEL','exec_die: SECRET_SENTINEL'])assert.equal(dockerEvent({Type:'container',Action:action}),null);
 assert.equal(dockerEvent({Type:'container',Action:'health_status: SECRET_SENTINEL'}).action,'health_status');
});
test('memory sample captures resource pressure and process identities without environment or argv',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-proc-'));
 try{fs.writeFileSync(path.join(dir,'meminfo'),'MemTotal: 1000 kB\nMemAvailable: 10 kB\nSwapTotal: 20 kB\nSwapFree: 2 kB\n');fs.mkdirSync(path.join(dir,'123'));fs.writeFileSync(path.join(dir,'123/status'),'Name:\tnode\nPPid:\t100\nVmRSS:\t900 kB\n');assert.deepEqual(memorySnapshot(dir),{memory:{MemTotal_kib:1000,MemAvailable_kib:10,SwapTotal_kib:20,SwapFree_kib:2},processes:[{pid:123,ppid:100,name:'node',rss_kib:900}]});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('observer preserves failing test exit code and writes evidence before command execution',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-observe-')),output=path.join(dir,'events.jsonl');
 try{const code=await observe(process.execPath,['-e','process.exit(7)'],{trace:false,docker:false,output});assert.equal(code,7);const rows=fs.readFileSync(output,'utf8').trim().split('\n').map(JSON.parse);assert.equal(rows[0].kind,'observer.start');assert(rows.some(r=>r.kind==='memory'));assert.deepEqual(rows.at(-1).kind,'test.exit');assert.equal(rows.at(-1).code,7);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

const edgeSample = rss => ({memory:{},processes:[{pid:12,ppid:1,name:'.edge-runtime-w',rss_kib:rss}]});
test('Edge memory budget accepts the measured envelope and rejects a peak even after recovery',()=>{
 const budget=edgeMemoryBudget();
 budget.sample(edgeSample(1259852));budget.sample(edgeSample(1196236));
 assert.equal(budget.result().passed,true);assert.equal(budget.result().peak_kib,1259852);
 budget.sample(edgeSample(EDGE_MEMORY_LIMIT_KIB+1));budget.sample(edgeSample(100));
 assert.equal(budget.result().passed,false);assert.equal(budget.result().reason,'EDGE_RSS_LIMIT');
});
test('Edge memory budget sums workers and rejects missing or malformed evidence',()=>{
 const absent=edgeMemoryBudget();absent.sample({memory:{},processes:[{name:'node',rss_kib:99999999}]});
 assert.equal(absent.result().reason,'EDGE_SAMPLES_MISSING');
 const invalid=edgeMemoryBudget();invalid.sample(edgeSample(NaN));assert.equal(invalid.result().reason,'EDGE_SAMPLE_INVALID');
 const workers=edgeMemoryBudget();workers.sample({memory:{},processes:[...edgeSample(2000000).processes,{...edgeSample(2000000).processes[0],pid:13}]});
 assert.equal(workers.result().reason,'EDGE_RSS_LIMIT');
});
test('required memory evidence cannot turn a successful command into a false green',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-memory-'));
 try {
  const code=await observe(process.execPath,['-e','process.exit(0)'],{trace:false,docker:false,output:path.join(dir,'events.jsonl'),memoryGuard:true,readMemory:()=>({memory:{},processes:[]})});
  assert.notEqual(code,0);
  const rows=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert(rows.some(r=>r.kind==='memory.acceptance'&&r.passed===false&&r.reason==='EDGE_SAMPLES_MISSING'));
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('memory regression stops only the observed command and preserves failed acceptance',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-memory-'));let count=0;
 try {
  const code=await observe(process.execPath,['-e','setInterval(()=>{},1000)'],{intervalMs:20,trace:false,docker:false,output:path.join(dir,'events.jsonl'),memoryGuard:true,readMemory:()=>edgeSample(++count>1?EDGE_MEMORY_LIMIT_KIB+1:100)});
  assert.notEqual(code,0);
  const rows=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert(rows.some(r=>r.kind==='memory.acceptance'&&r.passed===false&&r.reason==='EDGE_RSS_LIMIT'));
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('memory guard rejects unavailable sampling after earlier good samples',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-memory-'));let count=0;
 try {
  const code=await observe(process.execPath,['-e','setTimeout(()=>process.exit(0),90)'],{intervalMs:20,trace:false,docker:false,output:path.join(dir,'events.jsonl'),memoryGuard:true,readMemory:()=>{if(++count>2)throw Error('unavailable');return edgeSample(100);}});
  assert.notEqual(code,0);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('Edge process is retained even below the diagnostic top-process cutoff',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-proc-'));
 try{
  fs.writeFileSync(path.join(dir,'meminfo'),'MemTotal: 1000 kB\n');
  for(let pid=1;pid<=16;pid++){fs.mkdirSync(path.join(dir,String(pid)));fs.writeFileSync(path.join(dir,String(pid),'status'),`Name:\t${pid===16?'.edge-runtime-w':'node'}\nPPid:\t1\nVmRSS:\t${pid===16?1:900} kB\n`);}
  assert(memorySnapshot(dir).processes.some(p=>p.pid===16&&p.rss_kib===1));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('successful command with complete bounded memory evidence remains successful',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-memory-'));
 try {
  const code=await observe(process.execPath,['-e','setTimeout(()=>process.exit(0),90)'],{intervalMs:20,trace:false,docker:false,output:path.join(dir,'events.jsonl'),memoryGuard:true,readMemory:()=>edgeSample(EDGE_MEMORY_LIMIT_KIB)});
  assert.equal(code,0);
  const rows=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert(rows.some(r=>r.kind==='memory.acceptance'&&r.passed===true&&r.samples>=2));
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('passing memory evidence cannot override the observed command failure',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-memory-'));
 try {
  const code=await observe(process.execPath,['-e','setTimeout(()=>process.exit(7),90)'],{intervalMs:20,trace:false,docker:false,output:path.join(dir,'events.jsonl'),memoryGuard:true,readMemory:()=>edgeSample(100)});
  assert.equal(code,7);
  const rows=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert(rows.some(r=>r.kind==='memory.acceptance'&&r.passed===true));
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

const nativeTimestamp='2026-11-23T09:45:26.052Z',isolate='bba6d0ab-99dd-4c8f-997d-4731bf6b0a10';
const nativeLine=line=>({type:'log-entry',service:'functions',stream:'stderr',timestamp:nativeTimestamp,instance_id:'SECRET_INSTANCE_SENTINEL',line});
test('native runtime diagnostics retain fixed limit reasons and reject private payloads',()=>{
 for(const [line,reason] of [
  ['CPU time limit reached','CPU_LIMIT'],['CPU time hard limit reached','CPU_HARD_LIMIT'],
  ['CPU time soft limit reached','CPU_SOFT_LIMIT'],['memory limit reached for the worker','MEMORY_LIMIT'],
  ['wall clock duraiton reached','WALL_CLOCK_LIMIT'],['wall clock duration reached','WALL_CLOCK_LIMIT'],
  ['wall clock duration warning','WALL_CLOCK_WARNING'],
 ])assert.deepEqual(nativeRuntimeEvent(nativeLine(line+': isolate: '+isolate)),{at:nativeTimestamp,kind:'native.runtime',reason,isolate_id:isolate});
 const aborted=nativeRuntimeEvent(nativeLine('connection aborted (uri: "/functions/v1/backend-v1/op?token=SECRET_URI_SENTINEL")'));
 assert.deepEqual(aborted,{at:nativeTimestamp,kind:'native.runtime',reason:'CONNECTION_ABORTED'});
 assert.equal(nativeRuntimeEvent(nativeLine('[functions] worker error WorkerRequestCancelled: request has been cancelled by supervisor')).reason,'REQUEST_CANCELLED');
 assert.equal(nativeRuntimeEvent(nativeLine('main worker has been destroyed')).reason,'MAIN_WORKER_DESTROYED');
 for(const line of ['authorization: Bearer SECRET_TOKEN_SENTINEL','CPU time limit reached: isolate: SECRET_ID_SENTINEL','CPU time limit reached: isolate: '+isolate+' SECRET_SUFFIX_SENTINEL','unhandled error {"password":"SECRET_BODY_SENTINEL"}'])assert.equal(nativeRuntimeEvent(nativeLine(line)),null);
 assert.equal(nativeRuntimeEvent({...nativeLine('main worker has been destroyed'),service:'gateway'}),null);
 assert.equal(nativeRuntimeEvent({...nativeLine('main worker has been destroyed'),timestamp:'SECRET_TIME_SENTINEL'}),null);
 assert(!JSON.stringify(aborted).includes('SECRET'));
});

test('native log collection reads one bounded local history window with telemetry disabled',()=>{
 let calls=0;
 const rows=collectNativeRuntimeDiagnostics({since:nativeTimestamp,cwd:'/isolated/backend',run:(command,args,options)=>{
  calls++;
  assert.equal(command,'/isolated/backend/node_modules/.bin/supabase');
  assert.deepEqual(args,['stack','logs','--service','functions','--since',nativeTimestamp,'--tail',String(nativeLogLimits.tail),'--output-format','stream-json']);
  assert.equal(options.timeout,5000);assert.equal(options.maxBuffer,2*1024*1024);assert.equal(options.killSignal,'SIGKILL');
  assert.deepEqual(options.stdio,['ignore','pipe','ignore']);
  assert.equal(options.env.SUPABASE_TELEMETRY_DISABLED,'1');assert.equal(options.env.DO_NOT_TRACK,'1');
  return {status:0,stdout:[nativeLine('CPU time limit reached: isolate: '+isolate),nativeLine('SECRET_BODY_SENTINEL')].map(JSON.stringify).join('\n')+'\n',stderr:'SECRET_STDERR_SENTINEL'};
 }});
 assert.equal(calls,1);assert.equal(rows[0].reason,'CPU_LIMIT');
 assert.equal(rows.at(-1).complete,true);assert.equal(rows.at(-1).retained_lines,2);assert.equal(rows.at(-1).matched_events,1);
 assert(!JSON.stringify(rows).includes('SECRET'));
});

test('native diagnostics expose timeout, buffer, retention, and tail gaps without losing complete events',()=>{
 for(const [code,reason] of [['ETIMEDOUT','CLI_TIMEOUT'],['ENOBUFS','BUFFER_LIMIT'],['ENOENT','CLI_UNAVAILABLE']]){
  const rows=collectNativeRuntimeDiagnostics({since:nativeTimestamp,run:()=>({error:Object.assign(Error('SECRET_EXCEPTION_SENTINEL'),{code}),status:null,stdout:JSON.stringify(nativeLine('CPU time limit reached: isolate: '+isolate))+'\n{"private":"SECRET_PARTIAL_SENTINEL',stderr:'SECRET_STDERR_SENTINEL'})});
  assert.equal(rows[0].reason,'CPU_LIMIT');assert(rows.some(row=>row.reason===reason));assert(rows.some(row=>row.reason==='INVALID_EVENT'));assert.equal(rows.at(-1).complete,false);assert(!JSON.stringify(rows).includes('SECRET'));
 }
 const rows=collectNativeRuntimeDiagnostics({since:nativeTimestamp,run:()=>({status:0,stdout:[{type:'log-marker',service:'functions',kind:'lost'},...Array.from({length:nativeLogLimits.tail},()=>nativeLine('private application output'))].map(JSON.stringify).join('\n')})});
 assert(rows.some(row=>row.reason==='RETENTION_LOSS'));assert(rows.some(row=>row.reason==='TAIL_LIMIT'));assert.equal(rows.at(-1).complete,false);
 const unavailable=collectNativeRuntimeDiagnostics({run:()=>{throw Error('SECRET_SPAWN_SENTINEL');}});
 assert(unavailable.some(row=>row.reason==='COLLECTION_FAILED'));assert(unavailable.some(row=>row.reason==='NO_RETAINED_LOGS'));assert(!JSON.stringify(unavailable).includes('SECRET'));
});

test('invalid JSON response remains a failure while native metadata is captured without raw headers',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-native-response-')),output=path.join(dir,'events.jsonl');
 try{
  const response=new Response(null,{status:503,headers:{'x-served-by':'base/server','content-type':'text/html; secret=SECRET_HEADER_SENTINEL','set-cookie':'SECRET_COOKIE_SENTINEL'}});
  const error=invalidJsonResponseError(response,'saas_payment_verify_v1',0,{enabled:true,output,since:nativeTimestamp,run:()=>({status:0,stdout:JSON.stringify(nativeLine('CPU time limit reached: isolate: '+isolate))+'\n'})});
  assert.match(error.message,/invalid JSON \(HTTP 503, content-type text\/html, bytes 0, x-served-by base\/server\)/);
  assert.throws(()=>{throw error;},value=>value===error);
  const text=fs.readFileSync(output,'utf8'),rows=text.trim().split('\n').map(JSON.parse);
  assert.equal(rows[0].kind,'http.invalid_json');assert.equal(rows[0].status,503);assert.equal(rows[0].served_by,'base/server');assert.equal(rows[1].reason,'CPU_LIMIT');assert(!text.includes('SECRET'));assert(!error.message.includes('SECRET'));
  const unknown=invalidJsonResponseError(new Response(null,{status:503,headers:{'x-served-by':'SECRET_HEADER_SENTINEL','content-type':'SECRET_TYPE_SENTINEL'}}),'operation',0,{enabled:false});
  assert.match(unknown.message,/content-type unrecognized.*x-served-by unrecognized/);assert(!unknown.message.includes('SECRET'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('failed native collection and evidence writes cannot mask the invalid JSON failure or failing exit',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ci-native-failure-')),output=path.join(dir,'events.jsonl');
 try{
  const error=invalidJsonResponseError(new Response(null,{status:503}),'saas_payment_verify_v1',0,{enabled:true,output,run:()=>{throw Error('SECRET_FAILURE_SENTINEL');}});
  assert.match(error.message,/invalid JSON \(HTTP 503.*x-served-by missing/);
  assert(fs.readFileSync(output,'utf8').includes('COLLECTION_FAILED'));
  const helper=new URL('../scripts/native-runtime-diagnostics.mjs',import.meta.url).href;
  const code=await observe(process.execPath,['--input-type=module','-e',`import {invalidJsonResponseError} from ${JSON.stringify(helper)};const error=invalidJsonResponseError(new Response(null,{status:503}),'saas_payment_verify_v1',0,{enabled:true,output:${JSON.stringify(output)},write(){throw Error('SECRET_WRITE_SENTINEL');}});if(!error.message.includes('invalid JSON (HTTP 503')||error.message.includes('SECRET'))process.exit(9);process.exit(7);`],{trace:false,docker:false,output:path.join(dir,'observer.jsonl')});
  assert.equal(code,7);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
