import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
import {request_room_save_v1 as room,request_settings_catalog_get_v1 as catalog,request_class_save_v1 as classSave,request_session_create_v1 as sessionCreate} from '../supabase/functions/backend-v1/validators.js';

test('room settings accept explicit details and lifecycle while retaining the closed capacity contract',()=>{
 const r={client_api_version:1,request_id:key(),operation_key:key(),org_id:key(),center_id:key(),name:'Studio A',capacity:12,description:'Accessible room',location:'Ground floor',state:'inactive'};
 assert.equal(room(r),true);
 assert.equal(room({...r,room_id:key(),expected_version:1}),true);
 assert.equal(room({...r,state:'deleted'}),false);
 assert.equal(room({...r,description:42}),false);
 assert.equal(room({...r,capacity:-1}),false);
});

test('configured form discovery is explicitly scoped and paginated without allowing private configuration keys',()=>{
 const r={client_api_version:1,request_id:key(),org_id:key(),scope:'organization',include_configured_forms:true,configured_forms_page:{limit:1}};
 assert.equal(catalog(r),true);
 assert.equal(catalog({...r,include_configured_forms:false}),false);
 const missing={...r};delete missing.include_configured_forms;assert.equal(catalog(missing),false);
 assert.equal(catalog({...r,scope:'user'}),false);
 assert.equal(catalog({...r,configured_forms_page:{limit:201}}),false);
});

test('new class waitlists require explicit opt-in and keep the external-enrollment switch separate',()=>{
 const r={client_api_version:1,request_id:key(),operation_key:key(),org_id:key(),center_id:key(),name:'Explicit class',discipline_id:key(),external_open:false,waitlist_enabled:true};
 assert.equal(classSave(r),true);assert.equal(classSave({...r,waitlist_enabled:'open'}),false);
});

test('calendar exception proofs are closed, version bound and cannot claim a server approver',()=>{
 const r={client_api_version:1,request_id:key(),operation_key:key(),org_id:key(),center_id:key(),discipline_id:key(),format:'group',interval:{starts_at:'2030-01-01T10:00:00Z',ends_at:'2030-01-01T11:00:00Z'},resources:[],assignments:[],capacity:{total:4},work_calendar_exception:{reason:'Explicit special opening',settings_version:0,organization_settings_version:1}};
 assert.equal(sessionCreate(r),true);
 assert.equal(sessionCreate({...r,work_calendar_exception:{...r.work_calendar_exception,approved_by:key()}}),false);
 assert.equal(sessionCreate({...r,work_calendar_exception:{...r.work_calendar_exception,reason:''}}),false);
 assert.equal(sessionCreate({...r,work_calendar_exception:{...r.work_calendar_exception,settings_version:-1}}),false);
});

test('catalog keys, values and override projections cover every configured scope field',()=>{
 const contract=JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url))),config=JSON.parse(fs.readFileSync(new URL('../config/frontend-settings.json',import.meta.url))),d=contract.$defs;
 const frozen=JSON.parse(fs.readFileSync(new URL('../database/settings-catalog-v20.sql',import.meta.url),'utf8').split("$fields$select '")[1].split("'::jsonb$fields$")[0].replaceAll("''","'"));
 assert.equal(config.version,22);assert.equal(config.fields.length,119);
 assert.deepEqual(config.fields.filter(f=>f.key!=='work_calendar_exceptions_enabled'&&f.consumer!=='sharing_consent'),frozen);
 assert.deepEqual(config.fields.filter(f=>f.consumer==='sharing_consent').map(f=>[f.scope,f.key]),[['organization','sharing_notices'],['organization','allow_center_sharing_restrictions'],['center','sharing_restrictions']]);
 assert.deepEqual(config.fields.find(f=>f.key==='work_calendar_exceptions_enabled'),{scope:'organization',key:'work_calendar_exceptions_enabled',schema:{type:'boolean'},default:false,group:'O18',consumer:'work_calendar_exception_assert'});
 for(const scope of ['user','member','center','organization','platform']){
  const fields=config.fields.filter(f=>f.scope===scope).map(f=>f.key).sort(),name=scope[0].toUpperCase()+scope.slice(1),view=d.SettingsView.oneOf.find(v=>v.properties.scope.const===scope);
  assert.deepEqual([...d[name+'SettingsFieldKey'].enum].sort(),fields);
  assert.deepEqual(Object.keys(d[name+'SettingsValues'].properties).sort(),fields);
  assert.deepEqual([...view.properties.overridden_fields.items.enum].sort(),fields);
 }
 assert.deepEqual([...d.SettingsFieldKey.enum].sort(),[...new Set(config.fields.map(f=>f.key))].sort());
 for(const f of config.fields)assert(d.SettingsFieldDescriptor.properties.consumer.enum.includes(f.consumer),f.key+' consumer is declared');
});
