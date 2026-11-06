import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import * as validators from '../supabase/functions/backend-v1/validators.js';
const contract=JSON.parse(fs.readFileSync('../../packages/api-contracts/schema/contract.json')),id='019ab111-1234-7000-8000-000000000001';
const request=(scope,patch)=>({client_api_version:1,request_id:id,operation_key:id,scope,expected_version:0,...(['organization','member','center'].includes(scope)?{org_id:id}:{}),...(scope==='center'?{center_id:id}:{}),patch});
test('P15 settings keep closed scopes, accepted timing choices and explicit quiet configuration',()=>{
 for(const [scope,patch] of [['organization',{lesson_reminder_hours:3,package_reminder_days:14,payment_reminder_days:7}],['center',{lesson_reminders_enabled:false}],['member',{package_reminders_enabled:false}],['user',{quiet_hours_enabled:true,timezone_name:'Europe/Istanbul',quiet_hours_start:'22:00',quiet_hours_end:'08:00',quiet_hours_weekdays:[1,7]}]])assert(validators.request_settings_update_v1(request(scope,patch)),JSON.stringify(validators.request_settings_update_v1.errors));
 for(const [scope,patch] of [['organization',{lesson_reminder_hours:2}],['center',{payment_reminder_days:14}],['member',{lesson_reminder_hours:3}],['user',{quiet_hours_weekdays:[0]}],['user',{quiet_hours_weekdays:[1,1]}],['user',{quiet_hours_start:'24:00'}],['user',{quiet_hours_end:'08:99'}],['user',{digest:'daily'}]])assert.equal(validators.request_settings_update_v1(request(scope,patch)),false,JSON.stringify(patch));
});
test('P15 shared scope validators preserve all branch constraints after removing duplicated base validation',()=>{
 const expanded=structuredClone(contract);
 const names=['SettingsView','SettingsCatalog','Request_settings_update','Request_settings_reset_preview','Request_settings_reset_apply','Request_settings_history_get','Request_settings_catalog_get','Request_settings_get'];
 for(const name of names){const d=expanded.$defs[name];for(const key of Object.keys(d.properties)){const schemas=d.oneOf.flatMap(b=>b.properties[key]?[b.properties[key]]:[]);if(schemas.length)d.properties[key]={allOf:[d.properties[key],{anyOf:schemas}]};}}
 const compile=s=>{const ajv=new Ajv({strict:false,allErrors:false});addFormats(ajv);ajv.addSchema(s,'contract');return name=>ajv.getSchema('contract#/$defs/'+name);};const compact=compile(contract),repeated=compile(expanded);
 const samples=[null,{},[],request('user',{quiet_hours_enabled:false}),request('member',{in_app_reminders:false}),request('center',{lesson_reminder_hours:1}),request('organization',{payment_reminder_days:3})];
 for(const scope of ['user','member','center','organization','platform']){
  samples.push({scope,catalog_version:JSON.parse(fs.readFileSync('config/frontend-settings.json')).version,fields:[],defaults:{},brand_packages:[],limitations:[]});
  samples.push({client_api_version:1,request_id:id,scope,...(['member','organization','center'].includes(scope)?{org_id:id}:{}),...(scope==='center'?{center_id:id}:{})});
  samples.push({scope,version:0,values:{},overridden_fields:[],as_of:'2026-11-06T00:00:00Z'});
 }
 for(const name of names)for(const sample of samples){assert.equal(compact(name)(sample),repeated(name)(sample),name);if(sample&&typeof sample==='object'&&!Array.isArray(sample))for(const field of Object.keys(sample)){const missing={...sample};delete missing[field];for(const mutant of [missing,{...sample,[field]:null},{...sample,[field]:{}},{...sample,unexpected:true}])assert.equal(compact(name)(mutant),repeated(name)(mutant),name+' '+field);}}
});
test('P16 retry request keeps configuration and version checks explicit and closes arbitrary job payloads',()=>{
 const definition={name:'Reminder',trigger:{kind:'entitlement_expiring',offset_days:7},action:{kind:'send_reminder',channel:'in_app',template_key:'package.expiry'},execution_center_ids:[id],enabled:true};
 const r={client_api_version:1,request_id:id,org_id:id,center_id:id,operation_key:id,automation_id:id,expected_version:1,scope:{kind:'center',center_id:id},definition,retry_job:{id,version:3}};assert(validators.request_automation_save_v1(r));
 for(const retry_job of [{id,version:0},{id:'foreign',version:3},{id,version:3,payload:{}}])assert.equal(validators.request_automation_save_v1({...r,retry_job}),false);
});
