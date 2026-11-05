// Server-only lead retrieval after signature verification and trusted route lookup.
// Returned answers are provider evidence, not consent, Auth or a persisted intake.
import {createHmac} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const ajv=new Ajv({strict:false});addFormats(ajv);
const validTime=ajv.compile({type:'string',format:'date-time'});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^[1-9][0-9]{0,31}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const fail=()=>{throw Error('PROVIDER_RESPONSE');};
async function readBody(response){
 const reader=response.body?.getReader();if(!reader)fail();
 const chunks=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576)fail();chunks.push(value);}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }finally{try{await reader.cancel();}finally{reader.releaseLock();}}
}
export async function readMetaLead(notification,config,{fetchImpl=fetch}={}){
 if(!object(config)||!id(config.page_id)||!id(config.form_id)||!/^v[1-9][0-9]*\.[0-9]+$/.test(config.api_version??'')
  ||!text(config.access_token,4096)||/[\x00-\x20\x7f-\uffff]/.test(config.access_token)||!text(config.app_secret,4096))throw Error('PROVIDER_CONFIG');
 if(!object(notification)||notification.provider!=='meta'||notification.external_page_id!==config.page_id||notification.external_form_id!==config.form_id||!id(notification.external_lead_id))throw Error('PROVIDER_AUTH');
 const url=new URL('https://graph.facebook.com/'+config.api_version+'/'+notification.external_lead_id);
 url.searchParams.set('fields','id,form_id,created_time,field_data,custom_disclaimer_responses,ad_id,adset_id,campaign_id,platform,is_organic');
 url.searchParams.set('appsecret_proof',createHmac('sha256',config.app_secret).update(config.access_token).digest('hex'));
 let response;
 try{response=await fetchImpl(url,{method:'GET',headers:{authorization:'Bearer '+config.access_token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});}catch{throw Error('PROVIDER_UNAVAILABLE');}
 if(!response.ok||response.redirected){try{await response.body?.cancel();}catch{/* Body cancellation cannot expose provider error content. */}throw Error([401,403].includes(response.status)?'PROVIDER_AUTH':'PROVIDER_UNAVAILABLE');}
 let body;try{body=await readBody(response);}catch{throw Error('PROVIDER_RESPONSE');}
 if(!object(body)||Object.hasOwn(body,'error')||body.id!==notification.external_lead_id||body.form_id!==config.form_id)fail();
 const attribution={};
 for(const key of ['ad_id','adset_id','campaign_id'])if(Object.hasOwn(body,key)){if(!id(body[key]))fail();attribution[key]=body[key];}
 if(notification.attribution?.ad_id!==undefined&&attribution.ad_id!==notification.attribution.ad_id)fail();
 if(!Array.isArray(body.field_data)||body.field_data.length>500)fail();
 const names=new Set(),fields=[];
 for(const field of body.field_data){
  if(!object(field)||!text(field.name,256)||names.has(field.name)||!Array.isArray(field.values)||field.values.length>100||field.values.some(value=>typeof value!=='string'||value.length>65536))fail();
  names.add(field.name);fields.push({name:field.name,values:[...field.values]});
 }
 const disclaimers=body.custom_disclaimer_responses??[];
 if(!Array.isArray(disclaimers)||disclaimers.length>100||disclaimers.some(value=>!object(value)))fail();
 if(!text(body.created_time,64)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(body.created_time)||!validTime(body.created_time.replace(/([+-]\d{2})(\d{2})$/,'$1:$2'))||!Number.isFinite(Date.parse(body.created_time)))fail();
 if(Object.hasOwn(body,'platform')&&!text(body.platform,64)||Object.hasOwn(body,'is_organic')&&typeof body.is_organic!=='boolean')fail();
 return {provider:'meta',external_page_id:config.page_id,external_form_id:config.form_id,external_lead_id:body.id,submitted_at:new Date(body.created_time).toISOString(),platform:body.platform??null,is_organic:body.is_organic??null,attribution,field_data:fields,custom_disclaimer_responses:disclaimers};
}
