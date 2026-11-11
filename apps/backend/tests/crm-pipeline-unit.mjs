import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import * as generated from '../supabase/functions/backend-v1/validators.js';
import {newUuidV7 as key} from '../scripts/uuid.mjs';
const contract=JSON.parse(fs.readFileSync('..\/..\/packages/api-contracts/schema/contract.json'));
const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(contract,'contract');
const valid=(name,value)=>ajv.compile({$ref:'contract#/$defs/'+name})(value);
const catalog=JSON.parse(fs.readFileSync('config/frontend-settings.json'));

test('CRM pipeline inputs and list opt-in are closed and keep legacy requests callable',()=>{
 const base={client_api_version:1,request_id:key(),operation_key:key(),org_id:key(),person_id:key(),source:'manual',interest:'Dance'};
 const pipeline={stage_key:'lost',tag_keys:['warm'],loss_reason:'price'};
 for(const check of [r=>valid('Request_lead_save',r),generated.request_lead_save_v1]){
  assert(check(base));assert(check({...base,pipeline}));
  for(const extra of [{stage_key:'<script>'},{tag_keys:['warm','warm']},{loss_reason:'invented'},{person_id:key()},{kind:'won'}])assert.equal(check({...base,pipeline:{...pipeline,...extra}}),false);
 }
 const list={client_api_version:1,request_id:key(),org_id:base.org_id,page:{},include_pipeline:true};assert(generated.request_leads_list_v1(list));assert.equal(generated.request_leads_list_v1({...list,include_pipeline:'true'}),false);
 const configuration=catalog.fields.find(f=>f.key==='crm_pipeline').default;assert(valid('CrmPipelineConfiguration',configuration));
 assert.deepEqual(configuration.stages.map(s=>s.kind),['open','open','open','open','won','lost']);assert.equal(configuration.allow_center_tags,false);
 assert.equal(valid('CrmPipelineConfiguration',{...configuration,auto_convert:true}),false);
});

test('v19 adds only CRM and business links, preserving prior field semantics and explicit public visibility',()=>{
 const catalog={version:19,fields:JSON.parse(fs.readFileSync('database/settings-catalog-v19.sql','utf8').split("$fields$select '")[1].split("'::jsonb$fields$")[0].replaceAll("''","'"))};
 const prior=JSON.parse(fs.readFileSync('database/settings-catalog-v18.sql','utf8').split("$fields$select '")[1].split("'::jsonb$fields$")[0].replaceAll("''","'"));
 const additions=['crm_pipeline','crm_local_tags','map_url','directions','website_url'];
 const existing=catalog.fields.filter(f=>!additions.includes(f.key));
 assert.deepEqual(existing,prior.map(field=>field.key==='public_fields'?{...field,schema:{...field.schema,maxItems:8,items:{...field.schema.items,enum:[...field.schema.items.enum,'location','website']}}}:field));
 assert.equal(catalog.fields.length-prior.length,8);assert.equal(catalog.version,19);
 for(const scope of ['organization','center']){
  const type=scope==='center'?'CenterSettingsValues':'OrganizationSettingsValues';
  assert(valid(type,{website_url:'https://studio.example.invalid:65535/a',map_url:'https://maps.example.invalid/a',directions:'Plain text',website_url:null}));
  for(const value of ['https://example.org:65536/','https://example.org:99999/','https://256.256.256.256/','https://[::1]/','https://example.org\\path','javascript:alert(1)','http://example.invalid','https://user:secret@example.invalid/','https://example.invalid/\nextra'])assert.equal(valid(type,{map_url:value}),false);
  assert.deepEqual(catalog.fields.find(f=>f.scope===scope&&f.key==='public_fields').default,[]);
 }
});

test('CRM migration schema references are exactly the shared schema and append-only source is complete',()=>{
 const sql=fs.readFileSync('database/crm-pipeline-settings.sql','utf8'),schemas=JSON.parse(sql.split("as $schema$ select '")[1].split("'::jsonb->$1")[0].replaceAll("''","'"));
 for(const [name,value]of Object.entries(schemas))assert.deepEqual(value,contract.$defs[name]);
 const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_crm_pipeline_settings.sql'));assert(migration);
 const expected=['database/settings-catalog-v19.sql','database/crm-pipeline-settings.sql','database/settings-business-location.sql'].map((p,i)=>fs.readFileSync(p,'utf8').replace(i?'begin;\n':'','').replace(i<2?'commit;\n':'','')).join('');
 assert.equal(fs.readFileSync('supabase/migrations/'+migration,'utf8'),expected);
});

test('every catalog field has a scoped reset key and passes both shared and Edge reset request validation',()=>{
 const scopes={user:'User',member:'Member',center:'Center',organization:'Organization',platform:'Platform'};
 const shared=ajv.getSchema('contract#/$defs/Request_settings_reset_preview');
 for(const [scope,prefix] of Object.entries(scopes)){
  const fields=catalog.fields.filter(f=>f.scope===scope).map(f=>f.key),allowed=contract.$defs[prefix+'SettingsFieldKey'].enum;
  assert.deepEqual(new Set(allowed),new Set(fields),scope+' reset key/catalog parity');
  const body={client_api_version:1,request_id:key(),scope,...(['member','center','organization'].includes(scope)?{org_id:key()}:{}),...(scope==='center'?{center_id:key()}:{}),fields};
  for(const check of [shared,generated.request_settings_reset_preview_v1]){
   assert.equal(check(body),true,scope+' reset catalog request');
   assert.equal(check({...body,fields:['unknown_setting']}),false);
   const foreign=catalog.fields.find(f=>f.scope!==scope&&!fields.includes(f.key));
   assert(foreign);assert.equal(check({...body,fields:[foreign.key]}),false,scope+' foreign field denied');
  }
 }
});
