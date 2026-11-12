import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {sendEmail} from '../supabase/functions/backend-v1/email-provider.ts';
import {evaluateMonitor,validateMonitorEvent} from './ops-monitor.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=code=>{throw new Error(code);};
const date=value=>{const time=typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(time))fail('INVALID_MONITOR_OUTBOX');return time;};
const privateFile=(file,directory=false)=>{
 const stat=fs.lstatSync(file);
 if(stat.isSymbolicLink()||!(directory?stat.isDirectory():stat.isFile())||(stat.mode&0o777)!==(directory?0o700:0o600)||stat.uid!==process.getuid())fail('PRIVATE_MONITOR_STORAGE_REQUIRED');
};
function save(file,state){
 const temporary=file+'.'+randomUUID();let fd;
 try{
  fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(state));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
  fs.renameSync(temporary,file);
  const directory=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
 }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
const payload=(mail,event)=>({from:mail.from,to:[mail.to],subject:`FtkSaaS ops: ${event.kind} ${event.key}`,
 text:`${event.kind}: ${event.key}\nReason: ${event.reason}\nSeverity: ${event.severity}\nOpened: ${event.openedAt}\nObserved: ${event.checkedAt}\nRunbook: https://github.com/SXQHex/FtkSaaS/blob/main/apps/backend/docs/remote-backend-setup.md#o02-alarm-mudahalesi`});

// One externally scheduled cycle. A private, independent disk must survive
// process restarts and the monitored DB failing. A stale lock requires operator
// investigation: never infer that its owner died from a timestamp or PID alone.
export async function runOperatorMonitor({directory,observation,mail,policy,send=sendEmail,clock=Date.now}){
 privateFile(directory,true);
 if(!mail||!['from','to'].every(key=>typeof mail[key]==='string'&&mail[key].length<=254&&/^[^\s<>@]+@[^\s<>@]+$/.test(mail[key]))||typeof mail.apiKey!=='string'||!mail.apiKey||/[\r\n]/.test(mail.apiKey))fail('MONITOR_MAIL_CONFIG_REQUIRED');
 if(!policy||!Number.isSafeInteger(policy.maxAttempts)||policy.maxAttempts<1||!Number.isSafeInteger(policy.retryDelayMs)||policy.retryDelayMs<1||!Number.isSafeInteger(policy.idempotencyAgeMs)||policy.idempotencyAgeMs<1||policy.idempotencyAgeMs>23*3600000)fail('MONITOR_DELIVERY_POLICY_REQUIRED');
 const binding={from:mail.from,to:mail.to,policy:{maxAttempts:policy.maxAttempts,retryDelayMs:policy.retryDelayMs,idempotencyAgeMs:policy.idempotencyAgeMs}};
 const file=path.join(directory,'state.json'),lock=path.join(directory,'monitor.lock');let lockFd;
 try{lockFd=fs.openSync(lock,'wx',0o600);}catch(error){if(error.code==='EEXIST')fail('MONITOR_LOCKED');throw error;}
 try{
  fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid}));fs.fsyncSync(lockFd);
  let state;
  if(fs.existsSync(file)){
   privateFile(file);
   try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch{fail('INVALID_MONITOR_OUTBOX');}
   if(state.format!==1||!Array.isArray(state.outbox)||JSON.stringify(state.binding)!==JSON.stringify(binding))fail('MONITOR_CONFIG_OR_STATE_CHANGED');
  }else state={format:1,binding,monitor:null,outbox:[]};
  const ids=new Set();
  for(const job of state.outbox){
   validateMonitorEvent(job?.event);
   if(job.id!==hash(job.event)||ids.has(job.id)||!['pending','sending','accepted','rejected','exhausted','expired'].includes(job.status)||!Number.isSafeInteger(job.attempts)||job.attempts<0||job.attempts>policy.maxAttempts||JSON.stringify(job.payload)!==JSON.stringify(payload(mail,job.event)))fail('INVALID_MONITOR_OUTBOX');
   date(job.event.checkedAt);date(job.event.openedAt);ids.add(job.id);
   if(job.attempts===0){if(job.status!=='pending'||job.firstAttemptAt!==null||job.lastAttemptAt!==null)fail('INVALID_MONITOR_OUTBOX');}
   else if(date(job.firstAttemptAt)>date(job.lastAttemptAt)||date(job.lastAttemptAt)>clock())fail('INVALID_MONITOR_OUTBOX');
  }
  const evaluated=evaluateMonitor(state.monitor,observation);state.monitor=evaluated.state;
  for(const event of evaluated.events){const id=hash(event);if(ids.has(id))fail('DUPLICATE_MONITOR_EVENT');ids.add(id);state.outbox.push({id,event,payload:payload(mail,event),status:'pending',attempts:0,firstAttemptAt:null,lastAttemptAt:null});}
  // Monitor advancement and its outbox events share one atomic fsync boundary.
  save(file,state);
  for(const job of state.outbox){
   if(!['pending','sending'].includes(job.status))continue;
   const now=clock();if(!Number.isFinite(now)||now<date(observation.checkedAt))fail('MONITOR_CLOCK_REVERSED');
   if(job.firstAttemptAt!==null&&now-date(job.firstAttemptAt)>=policy.idempotencyAgeMs){job.status='expired';save(file,state);continue;}
   if(job.attempts>=policy.maxAttempts){job.status='exhausted';save(file,state);continue;}
   if(job.lastAttemptAt!==null&&now-date(job.lastAttemptAt)<policy.retryDelayMs)break;
   const at=new Date(now).toISOString();job.firstAttemptAt??=at;job.lastAttemptAt=at;job.attempts++;job.status='sending';save(file,state);
   let outcome;
   try{outcome=await send({apiKey:mail.apiKey,idempotencyKey:'ops/'+job.id,payload:job.payload});}catch{outcome={state:'unknown'};}
   if(outcome?.state==='accepted'&&typeof outcome.provider_reference==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(outcome.provider_reference)){
    job.status='accepted';job.providerReference=outcome.provider_reference;
   }else if(outcome?.state==='rejected')job.status='rejected';
   else job.status=job.attempts>=policy.maxAttempts?'exhausted':'pending';
   save(file,state);
   // Preserve event order: do not send a recovery ahead of a pending alarm.
   if(job.status==='pending')break;
  }
  const counts={};for(const status of ['pending','sending','accepted','rejected','exhausted','expired'])counts[status]=state.outbox.filter(job=>job.status===status).length;
  return {events:evaluated.events,...counts};
 }finally{fs.closeSync(lockFd);fs.unlinkSync(lock);}
}
