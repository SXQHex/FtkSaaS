// Google native lead-form verification/normalization only. This does not mount
// a webhook, acknowledge delivery, persist an application or grant Auth/consent.
import {createHash,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const ajv=new Ajv({strict:false});addFormats(ajv);
ajv.addSchema(JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url))),'contract');
const validIntake=ajv.getSchema('contract#/$defs/CrmIntake');
const validTime=ajv.compile({type:'string',format:'date-time'});
const numericIds=new Set(['form_id','campaign_id','adgroup_id','creative_id','asset_group_id']);
const columns=new Set(['FULL_NAME','FIRST_NAME','LAST_NAME','PHONE_NUMBER','EMAIL']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>createHash('sha256').update(value,'utf8').digest();
const string=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
function providerId(value){
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('PROVIDER_PAYLOAD');value=String(value);}
 if(typeof value!=='string'||!/^[1-9][0-9]{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw Error('PROVIDER_PAYLOAD');
 return value;
}
export function parseGoogleLead(raw,config,{extractColumns=[]}={}){
 if(!Array.isArray(extractColumns)||extractColumns.length>100||new Set(extractColumns).size!==extractColumns.length||extractColumns.some(id=>!string(id,256)))throw Error('PROVIDER_CONFIG');
 const selected=new Set([...columns,...extractColumns]);
 if(!object(config)||Object.keys(config).length!==2||!Object.hasOwn(config,'google_key')||!Object.hasOwn(config,'form_id')||!string(config.google_key,4096)||typeof config.form_id!=='string')throw Error('PROVIDER_CONFIG');
 let expectedForm;try{expectedForm=providerId(config.form_id);}catch{throw Error('PROVIDER_CONFIG');}
 let body;
 try{
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>65536)throw Error();
  // Node 24's reviver source retains every int64 digit before JS number
  // conversion can lose it. Numeric IDs use decimal integer tokens only.
  body=JSON.parse(raw,(key,value,context)=>{
   if(numericIds.has(key)&&typeof value==='number'){
    return context.source; // Validate only consumed IDs below, not unknown extensions.
   }
   return value;
  });
  if(!object(body))throw Error();
 }catch{throw Error('PROVIDER_PAYLOAD');}
 if(!string(body.google_key,4096)||!timingSafeEqual(hash(body.google_key),hash(config.google_key)))throw Error('PROVIDER_AUTH');
 if(providerId(body.form_id)!==expectedForm)throw Error('PROVIDER_AUTH');
 if(!string(body.lead_id,2048)||!Array.isArray(body.user_column_data)||body.user_column_data.length>500||Object.hasOwn(body,'is_test')&&typeof body.is_test!=='boolean')throw Error('PROVIDER_PAYLOAD');
 if(Object.hasOwn(body,'lead_source')&&body.lead_source!=='LEAD_FORM')throw Error('PROVIDER_PAYLOAD');
 const fields=new Map();
 for(const item of body.user_column_data){
  if(!object(item)||!selected.has(item.column_id))continue; // Provider extensions are not a closed DTO.
  if(fields.has(item.column_id)||typeof item.string_value!=='string')throw Error('PROVIDER_PAYLOAD');
  fields.set(item.column_id,item.string_value);
 }
 const display=fields.get('FULL_NAME')??[fields.get('FIRST_NAME'),fields.get('LAST_NAME')].filter(value=>value!==undefined).join(' ');
 const phone=fields.get('PHONE_NUMBER');
 if(typeof display!=='string'||!display.trim()||typeof phone!=='string'||!/^\+[1-9][0-9]{6,14}$/.test(phone))throw Error('PROVIDER_PAYLOAD');
 const intake={display_name:display,phone,...(fields.has('EMAIL')?{email:fields.get('EMAIL')}:{}),consents:[]};
 if(!validIntake(intake))throw Error('PROVIDER_PAYLOAD');
 let submitted=null;
 if(Object.hasOwn(body,'lead_submit_time')){if(!validTime(body.lead_submit_time)||!Number.isFinite(Date.parse(body.lead_submit_time)))throw Error('PROVIDER_PAYLOAD');submitted=new Date(body.lead_submit_time).toISOString();}
 const attribution={};
 for(const key of ['campaign_id','adgroup_id','creative_id','asset_group_id'])if(Object.hasOwn(body,key))attribution[key]=providerId(body[key]);
 if(Object.hasOwn(body,'gcl_id')){if(!string(body.gcl_id,2048))throw Error('PROVIDER_PAYLOAD');attribution.gcl_id=body.gcl_id;}
 return {...(extractColumns.length?{mapped_answers:Object.fromEntries(extractColumns.filter(id=>fields.has(id)).map(id=>[id,fields.get(id)]))}:{}),provider:'google_ads',external_form_id:expectedForm,external_lead_id:body.lead_id,is_test:body.is_test??false,lead_source:body.lead_source??null,submitted_at:submitted,attribution,intake};
}
