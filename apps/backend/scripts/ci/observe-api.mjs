import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {constants} from 'node:os';
import {pathToFileURL} from 'node:url';
import {ciFile} from '../paths.mjs';

// API-1 oneshot acceptance peaked at 1.19 GiB in run 41297723495.
// 3 GiB leaves >2x measured headroom while bounding the previous 14 GiB failure.
export const EDGE_MEMORY_LIMIT_KIB=3*1024*1024;
const edgeProcess=p=>/^\.?edge-runtime(?:-w)?$/.test(p.name??'');
export function edgeMemoryBudget(){
 let samples=0,peak=0,reason=null;
 return {
  unavailable(){reason='EDGE_SAMPLE_UNAVAILABLE';},
  sample(snapshot){
   const workers=snapshot.processes.filter(edgeProcess);
   if(!workers.length)return;
   if(workers.some(p=>!Number.isSafeInteger(p.rss_kib)||p.rss_kib<0)){reason='EDGE_SAMPLE_INVALID';return;}
   samples++;peak=Math.max(peak,workers.reduce((sum,p)=>sum+p.rss_kib,0));
   if(peak>EDGE_MEMORY_LIMIT_KIB)reason='EDGE_RSS_LIMIT';
  },
  result(){return {passed:!reason&&samples>=2,reason:reason??(samples>=2?null:'EDGE_SAMPLES_MISSING'),samples,peak_kib:peak,limit_kib:EDGE_MEMORY_LIMIT_KIB};}
 };
}

export function memorySnapshot(root='/proc'){
 const text=fs.readFileSync(path.join(root,'meminfo'),'utf8');
 const memory=Object.fromEntries([...text.matchAll(/^(MemTotal|MemAvailable|SwapTotal|SwapFree):\s+(\d+) kB$/gm)].map(m=>[m[1]+'_kib',Number(m[2])]));
 const processes=[];
 for(const pid of fs.readdirSync(root).filter(n=>/^\d+$/.test(n))){
  try{const s=fs.readFileSync(path.join(root,pid,'status'),'utf8');
   const field=n=>s.match(new RegExp('^'+n+':\\s+(.+)$','m'))?.[1];
   processes.push({pid:Number(pid),ppid:Number(field('PPid')),name:field('Name'),rss_kib:Number(field('VmRSS')?.split(' ')[0]??0)});
  }catch{/* A process can exit between directory listing and reading status. */}
 }
 const ranked=processes.sort((a,b)=>b.rss_kib-a.rss_kib);
 // Keep every Edge process even when unrelated processes occupy the top 15.
 return {memory,processes:ranked.filter((p,i)=>i<15||edgeProcess(p))};
}
export function signalEvent(line,readStatus=tid=>fs.readFileSync(`/proc/${tid}/status`,'utf8')){
 // trace_pipe's prefix identifies the sender thread, not necessarily its TGID.
 const m=/^\s*(.+)-(\d+)\s+(?:\([^)]*\)\s+)?\[\d+\].*?\s([\d.]+):\s+signal_generate:\s+sig=(\d+)\s+errno=(-?\d+)\s+code=(-?\d+)\s+comm=(.*?)\s+pid=(\d+)\s+grp=(\d+)\s+res=(\d+)/.exec(line);
 if(!m)return null;
 const tgid=tid=>{try{return Number(readStatus(tid).match(/^Tgid:\s+(\d+)/m)?.[1])||null;}catch{return null;}};
 const senderPid=tgid(m[2]),targetPid=tgid(m[8]);
 return {sender_comm:m[1].trim(),sender_tid:Number(m[2]),sender_pid:senderPid,kernel_s:Number(m[3]),signal:Number(m[4]),code:Number(m[6]),target_comm:m[7],target_tid:Number(m[8]),target_pid:targetPid,group:Number(m[9]),result:Number(m[10])};
}
export function dockerEvent(value){
 // Docker exec_* actions can embed the complete command line in Action itself.
 // Keep only fixed lifecycle names; never forward an arbitrary Action string.
 const action=String(value.Action??'').split(':',1)[0];
 if(!['create','start','die','oom','kill','stop','restart','destroy','pause','unpause','health_status'].includes(action))return null;
 return {time_nano:value.timeNano??value.TimeNano,type:value.Type,action,id:value.Actor?.ID,exit_code:value.Actor?.Attributes?.exitCode};
}
const setupTrace=`set -eu
base=/sys/kernel/tracing
if [ ! -e "$base/events/signal/signal_generate/format" ]; then
  mkdir -p "$base"
  mount -t tracefs tracefs "$base"
fi
instance="$base/instances/$1"
mkdir "$instance"
printf '%s' 'sig == 2 || sig == 9 || sig == 15' > "$instance/events/signal/signal_generate/filter"
printf '1' > "$instance/events/signal/signal_generate/enable"
printf '1' > "$instance/tracing_on"
printf '%s' "$instance"
`;
const removeTrace=`set -eu
instance="/sys/kernel/tracing/instances/$1"
if [ -d "$instance" ]; then
 printf '0' > "$instance/tracing_on"
 printf '0' > "$instance/events/signal/signal_generate/enable"
 rmdir "$instance"
fi
`;

export async function observe(command,args,{intervalMs=5000,trace=true,docker=true,memoryGuard=process.env.FTK_EDGE_MEMORY_GUARD==='1',readMemory=memorySnapshot,output=ciFile('diagnostics',`api-${/^[1-4]$/.test(process.env.SHARD??'')?process.env.SHARD:'local'}-${process.env.GITHUB_RUN_ATTEMPT??'local'}.jsonl`)}={}){
 fs.mkdirSync(path.dirname(output),{recursive:true});
 const record=(kind,data)=>{
  const line=JSON.stringify({at:new Date().toISOString(),kind,...data});
  // Synchronous file writes preserve each sample; stdout also reaches the job
  // log immediately, without relying on an always() step after runner shutdown.
  fs.appendFileSync(output,line+'\n');process.stdout.write('[host-observer] '+line+'\n');
 };
 const children=[];let instance;let stopped=false;
 const budget=memoryGuard?edgeMemoryBudget():null;let child,limitTimer;
 // A fresh process group contains only this command and its descendants.
 const signalCommand=signal=>{if(!child?.pid)return;try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
 const stopForMemory=()=>{
  if(limitTimer||!child)return;
  record('observer.memory_stop',{reason:budget.result().reason});signalCommand('SIGTERM');
  limitTimer=setTimeout(()=>signalCommand('SIGKILL'),2000);
 };
 const stream=(name,cmd,argv,parse)=>{
  const child=spawn(cmd,argv,{stdio:['ignore','pipe','pipe']});children.push(child);
  let pending='';child.stdout.on('data',bytes=>{pending+=bytes.toString();let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);try{const data=parse(line);if(data)record(name,data);}catch{record('observer.warning',{component:name,reason:'INVALID_EVENT'});}}});
  child.on('error',error=>record('observer.warning',{component:name,reason:error.code??'START_FAILED'}));
  // Tool errors are summarized, never forwarded verbatim (Docker may include
  // service metadata). A missing observer must be explicit, not a silent gap.
  child.stderr.resume();child.on('exit',(code,signal)=>{if(!stopped)record('observer.warning',{component:name,reason:'STREAM_EXIT',code,signal});});return child;
 };
 record('observer.start',{pid:process.pid,command:path.basename(command),run:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null});
 if(trace){
  const name=`ftk-api-${process.pid}`;
  const r=spawnSync('sudo',['-n','sh','-s','--',name],{input:setupTrace,encoding:'utf8',timeout:10000,maxBuffer:65536});
  if(r.status===0&&r.stdout.trim()===`/sys/kernel/tracing/instances/${name}`){instance=name;stream('signal','sudo',['-n','cat',`${r.stdout.trim()}/trace_pipe`],signalEvent);record('observer.trace',{available:true});}
  else{spawnSync('sudo',['-n','sh','-s','--',name],{input:removeTrace,timeout:5000,stdio:['pipe','ignore','ignore']});record('observer.warning',{component:'signal',reason:'TRACEFS_UNAVAILABLE',code:r.status});}
 }
 if(docker)stream('docker.event','docker',['events','--filter','type=container','--format','{{json .}}'],line=>dockerEvent(JSON.parse(line)));
 let busy=false,sampling=Promise.resolve();
 async function sample(){
  if(busy||stopped)return;busy=true;
  try{
   try{const snapshot=readMemory();record('memory',snapshot);budget?.sample(snapshot);
    if(budget&&['EDGE_RSS_LIMIT','EDGE_SAMPLE_INVALID'].includes(budget.result().reason))stopForMemory();
   }catch{budget?.unavailable();record('observer.warning',{component:'memory',reason:'PROC_UNAVAILABLE'});}
   try{const files=['memory.current','memory.peak','memory.max','memory.events'];const values={};for(const f of files){try{values[f]=fs.readFileSync('/sys/fs/cgroup/'+f,'utf8').trim();}catch{}}record('cgroup',{values});}catch{}
   if(docker){
    const stats=spawn('docker',['stats','--no-stream','--format','{{json .}}'],{stdio:['ignore','pipe','ignore']});children.push(stats);let data='';
    const timeout=setTimeout(()=>stats.kill('SIGKILL'),4000);
    stats.stdout.on('data',b=>{if(data.length<65536)data+=b.toString();});
    await new Promise(resolve=>{stats.once('error',resolve);stats.once('close',resolve);});clearTimeout(timeout);
    for(const line of data.trim().split('\n').filter(Boolean)){try{const v=JSON.parse(line);record('docker.stats',{id:v.ID??v.Container,memory:v.MemUsage,memory_percent:v.MemPerc,cpu_percent:v.CPUPerc,pids:v.PIDs});}catch{}}
   }
  }finally{busy=false;}
 }
 await sample();const timer=setInterval(()=>{sampling=sample();},intervalMs);
 child=spawn(command,args,{stdio:'inherit',detached:process.platform!=='win32'});
 if(budget&&['EDGE_RSS_LIMIT','EDGE_SAMPLE_INVALID'].includes(budget.result().reason))setImmediate(stopForMemory);
 const forward=signal=>{record('observer.signal',{signal});signalCommand(signal);};
 const onInt=()=>forward('SIGINT'),onTerm=()=>forward('SIGTERM');process.on('SIGINT',onInt);process.on('SIGTERM',onTerm);
 let result;
 try{result=await new Promise(resolve=>{child.once('error',error=>resolve({code:1,error:error.code}));child.once('exit',(code,signal)=>resolve({code,signal}));});record('test.exit',result);}
 finally{
  stopped=true;clearInterval(timer);if(limitTimer){clearTimeout(limitTimer);signalCommand('SIGKILL');}process.off('SIGINT',onInt);process.off('SIGTERM',onTerm);
  for(const c of children)if(c.exitCode===null&&!c.killed)c.kill('SIGTERM');
  await sampling;
  await Promise.all(children.filter(c=>c.exitCode===null&&c.signalCode===null).map(c=>new Promise(resolve=>{const timeout=setTimeout(resolve,1000);c.once('close',()=>{clearTimeout(timeout);resolve();});})));
  if(instance)spawnSync('sudo',['-n','sh','-s','--',instance],{input:removeTrace,timeout:5000,stdio:['pipe','ignore','ignore']});
 }
 const code=result.code??(128+(constants.signals[result.signal]??1));
 if(budget){const acceptance=budget.result();record('memory.acceptance',acceptance);if(!acceptance.passed)return code||1;}
 return code;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const [command,...args]=process.argv.slice(2);if(!command)throw Error('OBSERVED_COMMAND_REQUIRED');
 process.exitCode=await observe(command,args);
}
