import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {memorySnapshot} from './observe-api.mjs';
import {ciFile} from '../paths.mjs';
import {newUuidV7} from '../uuid.mjs';

export function pressure(sample){
 const edge=sample.processes.filter(p=>/edge-runtime/.test(p.name));
 const rss=edge.reduce((sum,p)=>sum+p.rss_kib,0);
 return {edge,rss,stop:rss>=2*1024*1024?'edge_rss_limit':sample.memory.MemAvailable_kib<1024*1024?'host_memory_limit':null};
}
export function loopback(value){
 const u=new URL(value);
 if(u.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password)throw Error('LOCAL_ONLY');
 return u.origin;
}
export async function experiment(policy){
 if(!['per_worker','oneshot'].includes(policy))throw Error('INVALID_POLICY');
 if(pressure(memorySnapshot('/proc',Infinity)).edge.length)throw Error('EXISTING_EDGE_PROCESS');
 const dir=ciFile('edge-memory',policy);fs.mkdirSync(dir,{recursive:true});
 const log=(kind,data)=>{const line=JSON.stringify({at:new Date().toISOString(),policy,kind,...data});fs.appendFileSync(path.join(dir,'samples.jsonl'),line+'\n');console.log('[edge-memory] '+line);};
 const config='supabase/config.toml',original=fs.readFileSync(config,'utf8');
 const lock='supabase/supabase.lock',originalLock=fs.readFileSync(lock);
 const changed=original.replace(/(\[edge_runtime\][\s\S]*?\npolicy = )"[^"]+"/,'$1"'+policy+'"');
 if(!changed.includes('policy = "'+policy+'"'))throw Error('POLICY_NOT_SET');
 fs.writeFileSync(config,changed);
 let phase='setup',reason=null,peak=0,requests=0,child;
 const seen=new Map(),abort=new AbortController();
 const identity=pid=>{try{return fs.readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1].split(' ')[19];}catch{return null;}};
 const terminate=()=>{for(const [pid,start] of seen){if(identity(pid)===start){try{process.kill(pid,'SIGTERM');}catch{log('process.exit_race',{pid,signal:'SIGTERM'});}}}child?.kill('SIGTERM');};
 const stop=why=>{if(reason)return;reason=why;log('stop',{reason,phase,requests});abort.abort();terminate();setTimeout(()=>{for(const [pid,start] of seen){if(identity(pid)===start){try{process.kill(pid,'SIGKILL');}catch{log('process.exit_race',{pid,signal:'SIGKILL'});}}}child?.kill('SIGKILL');},1000).unref();};
 const sample=()=>{
  const s=memorySnapshot('/proc',Infinity),p=pressure(s);peak=Math.max(peak,p.rss);
  for(const e of p.edge){const start=identity(e.pid);if(start)seen.set(e.pid,start);}
  log('memory',{phase,requests,rss_kib:p.rss,edge:p.edge,available_kib:s.memory.MemAvailable_kib,swap_free_kib:s.memory.SwapFree_kib});
  if(p.stop)stop(p.stop);
 };
 const timer=setInterval(sample,1000),deadline=setTimeout(()=>stop('experiment_timeout'),600000);
 const onSignal=()=>stop('interrupted');process.on('SIGTERM',onSignal);process.on('SIGINT',onSignal);
 const run=(args)=>new Promise((resolve,reject)=>{
  if(reason)return reject(Error('STOPPED'));
  const fd=fs.openSync(path.join(dir,'private-cli.log'),'a',0o600);
  child=spawn('node_modules/.bin/supabase',args,{stdio:['ignore',fd,fd]});fs.closeSync(fd);
  child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('CLI_FAILED')));
 });
 async function json(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
  const data=await r.json();return {status:r.status,data};
 }
 let result;
 try{
  log('source',{source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim(),bundle_sha256:createHash('sha256').update(fs.readFileSync('supabase/functions/backend-v1/index.ts')).digest('hex'),lock_sha256:createHash('sha256').update(originalLock).digest('hex'),cli:execFileSync('node_modules/.bin/supabase',['--version'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim(),requests_per_phase:240,interval_ms:500});
  await run(['start','--runtime','native','--preparation','on-demand','--exclude','analytics,realtime,pooler','--frozen=false']);
  const status=JSON.parse(execFileSync('node_modules/.bin/supabase',['status','--output-format','json'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}));
  const env=status.env,origin=loopback(env.API_URL);
  const headers={apikey:env.ANON_KEY,'content-type':'application/json'};
  const invoke=token=>json(origin+'/functions/v1/backend-v1/account_get_v1',{method:'POST',headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({client_api_version:1,request_id:newUuidV7()})});
  // A fixed serial request schedule isolates worker reuse from test concurrency.
  phase='ready';
  for(let i=0;i<30;i++){const r=await invoke();if(r.status===401&&r.data.error?.code==='AUTH_REQUIRED')break;if(i===29)throw Error('EDGE_NOT_READY');await new Promise(resolve=>setTimeout(resolve,1000));}
  phase='warmup';
  for(let i=0;i<10;i++){const r=await invoke();if(r.status!==401||r.data.error?.code!=='AUTH_REQUIRED')throw Error('WARMUP_RESPONSE');}
  for(const current of ['auth_rejection','account_read']){
   let token;
   if(current==='account_read'){
    phase='fixture';const email=randomUUID()+'@edge-lab.invalid',password=randomUUID()+'aA1!';
    const created=await json(origin+'/auth/v1/admin/users',{method:'POST',headers:{...headers,apikey:env.SERVICE_ROLE_KEY,authorization:'Bearer '+env.SERVICE_ROLE_KEY},body:JSON.stringify({email,password,email_confirm:true})});
    if(created.status!==200&&created.status!==201)throw Error('FIXTURE_CREATE_FAILED');
    const auth=await json(origin+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password})});
    if(auth.status!==200||!auth.data.access_token)throw Error('FIXTURE_LOGIN_FAILED');token=auth.data.access_token;
   }
   phase=current;log('phase',{phase});
   for(let i=0;i<240;i++){
    if(reason)throw Error('STOPPED');const start=performance.now();const r=await invoke(token);requests++;
    const ok=token?r.status===200&&r.data.ok===true:r.status===401&&r.data.error?.code==='AUTH_REQUIRED';
    log('request',{phase,index:i+1,status:r.status,expected:ok,ms:Math.round(performance.now()-start)});
    if(!ok)throw Error('UNEXPECTED_RESPONSE');
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,500-(performance.now()-start))));
   }
  }
  phase='idle';log('phase',{phase});await new Promise(resolve=>setTimeout(resolve,15000));
  result={outcome:reason??'completed',requests,peak_rss_kib:peak,observed_edge_pids:seen.size};
 }catch(error){result={outcome:reason??'experiment_error',error:reason?'STOPPED':'SETUP_OR_REQUEST_FAILED',requests,peak_rss_kib:peak,observed_edge_pids:seen.size};}
 finally{
  clearInterval(timer);clearTimeout(deadline);process.off('SIGTERM',onSignal);process.off('SIGINT',onSignal);
  terminate();
  // Kill only observed Edge identities if graceful termination cannot reclaim RAM.
  await new Promise(resolve=>setTimeout(resolve,1000));
  for(const [pid,start] of seen){if(identity(pid)===start){try{process.kill(pid,'SIGKILL');}catch{log('process.exit_race',{pid,signal:'SIGKILL'});}}}
  try{execFileSync('node_modules/.bin/supabase',['stop'],{stdio:'ignore',timeout:30000});}catch{log('cleanup',{ok:false});}
  fs.writeFileSync(config,original);fs.writeFileSync(lock,originalLock);
  log('result',result);fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({policy,...result},null,2)+'\n');
 }
 return result;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){const r=await experiment(process.argv[2]);if(r.outcome!=='completed')process.exitCode=1;}
