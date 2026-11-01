import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {memorySnapshot,signalEvent,dockerEvent,observe,edgeMemoryBudget,EDGE_MEMORY_LIMIT_KIB} from '../scripts/ci/observe-api.mjs';
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
