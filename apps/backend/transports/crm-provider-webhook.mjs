// Fetch Request/Response server adapters; the host mounts these on explicit
// provider URLs. ACK follows intake commit, or minimal durable queue commit.
import {metaWebhookChallenge,parseMetaLeadNotifications} from './crm-meta-lead.mjs';
import {readMetaLead} from './crm-meta-graph.mjs';
import {parseGoogleLead} from './crm-google-lead.mjs';
import {compileProviderMapping} from './crm-provider-mapping.mjs';
import {enqueueMetaNotifications,claimMetaNotification,completeMetaNotification,retryMetaNotification} from '../scripts/crm-meta-queue.mjs';
import {authorizeProviderRoute,submitProviderApplication} from '../scripts/crm-provider-intake.mjs';
const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(status,message)=>new Response(JSON.stringify(message?{message}:{}),{status,headers});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const only=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const secret=value=>typeof value==='string'&&value.length>0&&value.length<=4096;
const id=value=>typeof value==='string'&&/^[1-9][0-9]{0,31}$/.test(value);
async function rawBody(request,limit){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))throw Error('BODY_TYPE');
 const reader=request.body?.getReader();if(!reader)return '';
 let timer,size=0;const chunks=[];
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('BODY_TIMEOUT')),10000);});
 try{
  while(true){const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;size+=value.byteLength;if(size>limit)throw Error('BODY_SIZE');chunks.push(value);}
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks));}catch{throw Error('BODY_ENCODING');}
 }catch(error){if(['BODY_SIZE','BODY_TIMEOUT','BODY_ENCODING'].includes(error.message))throw error;throw Error('BODY_TRANSPORT');}
 finally{clearTimeout(timer);void reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
const bodyFailure=error=>reply(error.message==='BODY_SIZE'?413:error.message==='BODY_TYPE'?415:['BODY_TIMEOUT','BODY_TRANSPORT'].includes(error.message)?503:400,'Request rejected');
function snapshot(config){try{return structuredClone(config);}catch{throw Error('PROVIDER_CONFIG');}}
function metaConfiguration(configuration,client){
 const config=snapshot(configuration);
 if(!client||!only(config,['app_secret','verify_token','routes'])||!secret(config.app_secret)||!secret(config.verify_token)||!Array.isArray(config.routes)||config.routes.length<1||config.routes.length>1000)throw Error('PROVIDER_CONFIG');
 const routes=new Map();
 for(const route of config.routes){
  if(!only(route,['page_id','form_id','api_version','access_token','mapping'])||!id(route.page_id)||!id(route.form_id)||typeof route.api_version!=='string'||!/^v[1-9][0-9]*\.[0-9]+$/.test(route.api_version)||!secret(route.access_token)||/[\x00-\x20\x7f-\uffff]/.test(route.access_token))throw Error('PROVIDER_CONFIG');
  const key=route.page_id+':'+route.form_id;if(routes.has(key))throw Error('PROVIDER_CONFIG');
  routes.set(key,{...route,mapper:compileProviderMapping('meta',route.mapping)});
 }
 return {config,routes};
}
export function createMetaWebhookHandler(configuration,dependencies={}){return metaWebhook(configuration,dependencies,false);}
export function createMetaQueuedWebhookHandler(configuration,dependencies={}){return metaWebhook(configuration,dependencies,true);}
function metaWebhook(configuration,{client,fetchImpl=fetch}={},queued){
 const {config,routes}=metaConfiguration(configuration,client);
 return async request=>{
  if(request.method==='GET'){
   try{return new Response(metaWebhookChallenge(request.url,config.verify_token),{status:200,headers:{...headers,'content-type':'text/plain'}});}catch{return reply(403,'Request rejected');}
  }
  if(request.method!=='POST')return reply(405,'Method not allowed');
  let raw,notifications;try{raw=await rawBody(request,1048576);}catch(error){return bodyFailure(error);}
  try{notifications=parseMetaLeadNotifications(raw,request.headers.get('x-hub-signature-256'),config.app_secret);}catch(error){return reply(error.message==='PROVIDER_AUTH'?403:400,'Request rejected');}
  try{
   if(queued){
    for(const event of notifications)if(!routes.has(event.external_page_id+':'+event.external_form_id))throw Error('PROVIDER_ADMISSION');
    await enqueueMetaNotifications(client,notifications);return reply(200);
   }
   for(const event of notifications){
    const route=routes.get(event.external_page_id+':'+event.external_form_id);if(!route)throw Error('PROVIDER_ADMISSION');
    await authorizeProviderRoute(client,'meta',event.external_form_id,event.external_page_id);
    const lead=await readMetaLead(event,{page_id:route.page_id,form_id:route.form_id,api_version:route.api_version,access_token:route.access_token,app_secret:config.app_secret},{fetchImpl});
    await submitProviderApplication(client,route.mapper.map(lead));
   }
   return reply(200);
  }catch{return reply(503,'Delivery not committed');}
 };
}
export function createGoogleWebhookHandler(configuration,{client}={}){
 const config=snapshot(configuration);
 if(!client||!only(config,['google_key','form_id','mapping'])||!secret(config.google_key)||!id(config.form_id)||BigInt(config.form_id)>9223372036854775807n)throw Error('PROVIDER_CONFIG');
 const mapper=compileProviderMapping('google_ads',config.mapping);
 return async request=>{
  if(request.method!=='POST')return reply(405,'Method not allowed');
  let raw,lead;try{raw=await rawBody(request,65536);}catch(error){return bodyFailure(error);}
  try{lead=parseGoogleLead(raw,{google_key:config.google_key,form_id:config.form_id},{extractColumns:mapper.extractColumns});}catch(error){return reply(error.message==='PROVIDER_AUTH'?403:400,'Request rejected');}
  try{
   await authorizeProviderRoute(client,'google_ads',lead.external_form_id,null);
   await submitProviderApplication(client,mapper.map(lead));
   return reply(200);
  }catch{return reply(503,'Delivery not committed');}
 };
}

// One invocation performs at most one Graph retrieval. The host owns scheduling.
export function createMetaQueueWorker(configuration,{client,fetchImpl=fetch}={}){
 const config=snapshot(configuration),leaseSeconds=config?.lease_seconds,retrySeconds=config?.retry_seconds;
 if(!Number.isInteger(leaseSeconds)||leaseSeconds<30||leaseSeconds>300||!Number.isInteger(retrySeconds)||retrySeconds<1||retrySeconds>3600)throw Error('PROVIDER_CONFIG');
 delete config.lease_seconds;delete config.retry_seconds;
 const {routes}=metaConfiguration(config,client);if(routes.size!==1)throw Error('PROVIDER_CONFIG');const route=routes.values().next().value;
 return {async runOnce(){
  const claim=await claimMetaNotification(client,route,leaseSeconds);if(claim===null)return {claimed:false};
  try{
   const lead=await readMetaLead(claim.notification,{...route,app_secret:config.app_secret},{fetchImpl});
   await completeMetaNotification(client,claim,route.mapper.map(lead));return {claimed:true,completed:true};
  }catch{
   // If retry cannot persist, the durable lease expires and another run reclaims.
   try{await retryMetaNotification(client,claim,retrySeconds);}catch{throw Error('PROVIDER_PROCESSING');}
   throw Error('PROVIDER_PROCESSING');
  }
 }};
}
