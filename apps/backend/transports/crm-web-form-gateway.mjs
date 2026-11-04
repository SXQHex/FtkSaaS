// Server-only bridge for existing site routes. The site keeps its own rate
// limiter and validation; Edge still owns CAPTCHA, quotas and CRM admission.
import {handlePublicApplication} from '../scripts/public-application-gateway.mjs';
import {request_public_application_submit_v1 as validRequest} from '../supabase/functions/backend-v1/validators.js';
import {newUuidV7} from '../scripts/uuid.mjs';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const only=(value,keys)=>object(value)&&Object.keys(value).every(k=>keys.includes(k));
const text=(value,max)=>typeof value==='string'&&!!value.trim()&&value.length<=max;
function configuration(kind,config){
 if(!['contact','kayit'].includes(kind)||!only(config,['form_id','consent','marketingConsent'])||typeof config.form_id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(config.form_id))throw Error('CONFIG');
 for(const name of ['consent','marketingConsent']){
  const item=config[name];if(!only(item,['purpose','version'])||!text(item.purpose,100)||!text(item.version,200))throw Error('CONFIG');
 }
 if(config.consent.purpose===config.marketingConsent.purpose)throw Error('CONFIG');
}
export function mapCrmWebForm(kind,input,config){
 configuration(kind,config);
 const name=kind==='contact'?'name':'fullName';
 const keys=['request_id','client_request_key','bot_proof','submitted_at',name,'phone','level','consent','marketingConsent','attribution',...(kind==='kayit'?['mode','partnerName']:[])];
 if(!only(input,keys)||typeof input.consent!=='boolean'||typeof input.marketingConsent!=='boolean'||typeof input.submitted_at!=='string')throw Error('VALIDATION_FAILED');
 // Explicit, stable UTC submission time survives a retry. Never invent a
 // consent version, a click timestamp, an accepted value or a delivery key.
 try{if(new Date(input.submitted_at).toISOString()!==input.submitted_at)throw Error();}catch{throw Error('VALIDATION_FAILED');}
 const intake={display_name:input[name],phone:input.phone,consents:['consent','marketingConsent'].map(field=>({purpose:config[field].purpose,version:config[field].version,accepted:input[field],occurred_at:input.submitted_at}))};
 for(const [from,to] of [['level','interest'],['partnerName','partner_name'],['mode','mode'],['attribution','attribution']])if(Object.hasOwn(input,from))intake[to]=input[from];
 const result={client_api_version:1,request_id:input.request_id,client_request_key:input.client_request_key,bot_proof:input.bot_proof,form_id:config.form_id,intake};
 if(!validRequest(result))throw Error('VALIDATION_FAILED');
 return result;
}
export function createCrmWebFormHandler(kind,config,env=process.env,fetcher=fetch){
 configuration(kind,config);
 const trusted=structuredClone(config);
 return request=>{
  if(new URL(request.url).pathname!=='/api/'+kind)return Response.json({ok:false,error:{code:'VALIDATION_FAILED',retryable:false,trace_id:newUuidV7()}},{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  return handlePublicApplication(request,env,fetcher,input=>mapCrmWebForm(kind,input,trusted));
 };
}
