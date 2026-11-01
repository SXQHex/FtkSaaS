import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {memorySnapshot,signalEvent,dockerEvent,observe} from '../scripts/ci/observe-api.mjs';
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
