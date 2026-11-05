// Operator-owned field/consent interpretation. Missing evidence never becomes
// an accepted value, server-now timestamp, country code or inferred purpose.
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url))),'contract');
const validIntake=ajv.getSchema('contract#/$defs/CrmIntake');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const scalar=value=>typeof value==='boolean'||typeof value==='string'&&value.length<=1024;
const only=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const targets=['display_name','phone','email','interest','message','partner_name','mode'];
export function compileProviderMapping(provider,configuration){
 let config;try{config=structuredClone(configuration);}catch{throw Error('PROVIDER_CONFIG');}
 const meta=provider==='meta';
 if(!['meta','google_ads'].includes(provider)||!only(config,meta?['fields','consents','consent_key_field','consent_value_field']:['fields','consents'])||!only(config.fields,targets)||Object.values(config.fields).some(value=>!text(value,256))||!Array.isArray(config.consents)||config.consents.length>20)throw Error('PROVIDER_CONFIG');
 if(meta&&(!text(config.fields.display_name,256)||!text(config.fields.phone,256)||!text(config.consent_key_field,256)||!text(config.consent_value_field,256)))throw Error('PROVIDER_CONFIG');
 const purposes=new Set(),sources=new Set();
 for(const rule of config.consents){
  if(!only(rule,['source','purpose','version','accepted_value','declined_value','required'])||!text(rule.source,256)||!text(rule.purpose,100)||!text(rule.version,200)||!scalar(rule.accepted_value)||!scalar(rule.declined_value)||rule.accepted_value===rule.declined_value||typeof rule.required!=='boolean'||purposes.has(rule.purpose)||sources.has(rule.source))throw Error('PROVIDER_CONFIG');
  purposes.add(rule.purpose);sources.add(rule.source);
 }
 const extractColumns=meta?[]:[...new Set([...Object.values(config.fields),...config.consents.map(rule=>rule.source)])];
 if(extractColumns.length>100)throw Error('PROVIDER_CONFIG');
 return {extractColumns,map(lead){
  const intake=meta?{consents:[]}:structuredClone(lead.intake);
  const fields=meta?new Map(lead.field_data.map(field=>[field.name,field.values])):new Map(Object.entries(lead.mapped_answers??{}));
  for(const [target,source] of Object.entries(config.fields)){
   const raw=fields.get(source);
   if(raw===undefined){if(['display_name','phone'].includes(target))throw Error('PROVIDER_MAPPING');delete intake[target];continue;}
   if(meta&&(!Array.isArray(raw)||raw.length!==1)||typeof(meta?raw[0]:raw)!=='string')throw Error('PROVIDER_MAPPING');
   intake[target]=meta?raw[0]:raw;
  }
  if(typeof intake.phone==='string'){intake.phone=intake.phone.trim().replace(/[\s().-]/g,'');if(intake.phone.startsWith('00'))intake.phone='+'+intake.phone.slice(2);}
  if(!/^\+[1-9][0-9]{6,14}$/.test(intake.phone??'')||!intake.display_name?.trim())throw Error('PROVIDER_MAPPING');
  intake.consents=[];
  for(const rule of config.consents){
   let raw;
   if(meta){const matches=lead.custom_disclaimer_responses.filter(item=>Object.hasOwn(item,config.consent_key_field)&&item[config.consent_key_field]===rule.source);if(matches.length>1)throw Error('PROVIDER_MAPPING');if(matches.length&&Object.hasOwn(matches[0],config.consent_value_field))raw=matches[0][config.consent_value_field];}
   else raw=fields.get(rule.source);
   if(raw===undefined){if(rule.required)throw Error('PROVIDER_MAPPING');continue;}
   if(raw!==rule.accepted_value&&raw!==rule.declined_value||lead.submitted_at===null)throw Error('PROVIDER_MAPPING');
   intake.consents.push({purpose:rule.purpose,version:rule.version,accepted:raw===rule.accepted_value,occurred_at:lead.submitted_at});
  }
  if(!validIntake(intake))throw Error('PROVIDER_MAPPING');
  return {provider,external_form_id:lead.external_form_id,external_page_id:meta?lead.external_page_id:null,external_lead_id:lead.external_lead_id,submitted_at:lead.submitted_at,is_test:meta?null:lead.is_test,attribution:{...lead.attribution,...(meta&&typeof lead.platform==='string'?{platform:lead.platform}:{})},intake};
 }};
}
