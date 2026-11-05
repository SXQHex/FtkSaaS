// Backend-only Node host. TLS terminates at the host's HTTPS reverse proxy.
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createHash,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {createMetaQueuedWebhookHandler,createGoogleWebhookHandler,createMetaQueueWorker} from './crm-provider-webhook.mjs';
import {readMetaQueueStatus} from '../scripts/crm-meta-queue.mjs';
import {createNativeReceiverClient,DB_LIMITS} from './crm-provider-host-db.mjs';
export const HOST_LIMITS=Object.freeze({statement_ms:DB_LIMITS.statement_ms,body_ms:3000,http_ms:10000,worker_ms:20000,lease_seconds:60,retry_seconds:30,interval_ms:5000,shutdown_ms:6000,max_inflight:16});
const buckets=[50,100,500,1000,3000,10000,20000,Infinity];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const digest=value=>createHash('sha256').update(value).digest();
const authorized=(request,token)=>timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+token));
async function bounded(action,ms,cancel){
 let timer;try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>{cancel();reject(Error('HOST_DEADLINE'));},ms);})]);}finally{clearTimeout(timer);}
}
export function createProviderHost(configuration,{client,clientFactory=()=>client,fetchImpl=fetch,emit=event=>process.stdout.write(JSON.stringify(event)+'\n')}={}){
 const config=structuredClone(configuration);
 if(!config||Object.keys(config).some(k=>!['monitor_token','meta','google','worker_enabled'].includes(k))||typeof config.monitor_token!=='string'||config.monitor_token.length<32||config.monitor_token.length>4096||typeof config.worker_enabled!=='boolean'||config.meta===undefined||config.google===undefined||config.worker_enabled&&!config.meta)throw Error('HOST_CONFIG');
 const probe={query:async()=>{throw Error('HOST_DATABASE_UNAVAILABLE');}};
 if(config.meta){if(config.meta.routes?.length!==1)throw Error('HOST_CONFIG');createMetaQueuedWebhookHandler(config.meta,{client:probe});}
 if(config.google)createGoogleWebhookHandler(config.google,{client:probe});
 const counters=Object.fromEntries(['meta','google','health','ops','unknown'].map(route=>[route,{requests:0,errors:0,duration_buckets:buckets.map(()=>0)}]));
 const workerState={enabled:config.worker_enabled,running:false,last_tick_at:null,last_success_at:null,completed:0,idle:0,failures:0,timeouts:0};
 let stopped=false,scheduler=false,timer,active=null,activeClient=null,activeController=null;let inflight=0;
 const log=event=>{try{emit(event);}catch{return undefined;}};
 const status=async native=>{
  const queue=config.meta?await readMetaQueueStatus(native,config.meta.routes[0]):null;
  return {configured:{meta:!!config.meta,google:!!config.google},worker:{...workerState},queue,metrics:structuredClone(counters),duration_bounds_ms:buckets.map(n=>Number.isFinite(n)?n:null)};
 };
 const host={async handle(request){
  const began=performance.now(),requestId=key();let route='unknown',response,native,admitted=false;
  try{
   const url=new URL(request.url);route=url.pathname==='/webhooks/meta'?'meta':url.pathname==='/webhooks/google'?'google':url.pathname==='/healthz'?'health':url.pathname==='/ops/status'?'ops':'unknown';
   if(stopped)response=json({message:'Unavailable'},503);
   else if(route==='health')response=request.method==='GET'&&!url.search?json({alive:true}):json({message:'Not found'},404);
   else if(route==='ops'&&!authorized(request,config.monitor_token))response=json({message:'Unauthorized'},401);
   else if(route==='ops'&&(request.method!=='GET'||url.search))response=json({message:'Not found'},404);
   else if(route==='unknown')response=json({message:'Not found'},404);
   else if((route==='meta'&&!config.meta)||(route==='google'&&!config.google))response=json({message:'Provider unconfigured'},503);
   else if(inflight>=HOST_LIMITS.max_inflight)response=json({message:'Unavailable'},503);
   else{
    inflight++;admitted=true;native=clientFactory();const run=()=>route==='ops'?status(native).then(json):route==='meta'?createMetaQueuedWebhookHandler(config.meta,{client:native,bodyTimeoutMs:HOST_LIMITS.body_ms})(request):createGoogleWebhookHandler(config.google,{client:native,bodyTimeoutMs:HOST_LIMITS.body_ms})(request);
    response=await bounded(run,HOST_LIMITS.http_ms,()=>native?.abort?.());
   }
  }catch{response=json({message:'Unavailable'},503);}
  finally{native?.abort?.();if(admitted)inflight--;}
  const duration=Math.ceil(performance.now()-began),metric=counters[route];metric.requests++;if(response.status>=500)metric.errors++;buckets.forEach((bound,i)=>{if(duration<=bound)metric.duration_buckets[i]++;});
  response.headers.set('x-request-id',requestId);log({event:'crm_http',entry_point:'http',request_id:requestId,route,status:response.status,duration_ms:duration});return response;
 },async tick(entryPoint='manual'){
  if(!['manual','scheduler'].includes(entryPoint))throw Error('HOST_ENTRY_POINT');
  if(stopped||!workerState.enabled)return {disabled:true};if(active)return {busy:true};
  const began=performance.now(),requestId=key();workerState.running=true;workerState.last_tick_at=new Date().toISOString();
  const native=clientFactory(),controller=new AbortController();activeClient=native;activeController=controller;
  const worker=createMetaQueueWorker({...config.meta,lease_seconds:HOST_LIMITS.lease_seconds,retry_seconds:HOST_LIMITS.retry_seconds},{client:native,fetchImpl:(url,options)=>{controller.signal.throwIfAborted();return fetchImpl(url,{...options,signal:AbortSignal.any([controller.signal,options.signal])});}});
  // Keep active until the actual operation settles, even after a deadline response.
  const operation=worker.runOnce();active=operation;operation.then(()=>clear(),()=>clear());
  function clear(){if(active===operation){active=null;activeClient=null;activeController=null;workerState.running=false;}}
  let outcome='failed';
  try{const result=await bounded(()=>operation,HOST_LIMITS.worker_ms,()=>{controller.abort();native.abort?.();});workerState.last_success_at=new Date().toISOString();if(result.claimed){workerState.completed++;outcome='completed';}else{workerState.idle++;outcome='idle';}return result;}
  catch(error){workerState.failures++;if(error.message==='HOST_DEADLINE')workerState.timeouts++;throw Error('HOST_WORKER_UNAVAILABLE');}
  finally{native.abort?.();log({event:'crm_worker',entry_point:entryPoint,request_id:requestId,outcome,duration_ms:Math.ceil(performance.now()-began)});}
 },startScheduler(){
  if(stopped||scheduler||!workerState.enabled)return;scheduler=true;
  const next=()=>{timer=setTimeout(async()=>{try{await host.tick('scheduler');}catch{ /* Failure is counted; the durable item remains retryable. */ }if(scheduler&&!stopped)next();},HOST_LIMITS.interval_ms);};next();
 },async stop(){
  stopped=true;scheduler=false;clearTimeout(timer);activeController?.abort();activeClient?.abort?.();
  if(active)await bounded(()=>active.catch(()=>undefined),HOST_LIMITS.shutdown_ms,()=>activeClient?.abort?.()).catch(()=>undefined);
 }};return host;
}
export function startProviderServer(host,{port,hostname='127.0.0.1'}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('HOST_PORT');
 const server=createServer(async(req,res)=>{
  try{const response=await host.handle(new Request('http://crm.internal'+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})}));if(!res.destroyed){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}}
  catch{if(!res.destroyed){res.writeHead(503,{'cache-control':'no-store'});res.end();}}
 });
 server.headersTimeout=5000;server.requestTimeout=HOST_LIMITS.http_ms;server.setTimeout(HOST_LIMITS.http_ms,socket=>socket.destroy());server.listen(port,hostname);return server;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 try{
  const {database_url,...config}=JSON.parse(process.env.FTK_CRM_PROVIDER_CONFIG??'{}');
  // Validate connection config even while providers are deliberately unconfigured.
  createNativeReceiverClient(database_url).abort();
  const host=createProviderHost(config,{clientFactory:()=>createNativeReceiverClient(database_url)}),server=startProviderServer(host,{port:Number(process.env.PORT),hostname:process.env.HOST??'127.0.0.1'});
  server.once('listening',()=>host.startScheduler());server.on('error',()=>{process.stderr.write('CRM host unavailable\n');process.exitCode=1;void host.stop();});
  const stop=()=>{void host.stop().finally(()=>{server.close();server.closeAllConnections();});};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 }catch{process.stderr.write('CRM host configuration rejected\n');process.exitCode=1;}
}
