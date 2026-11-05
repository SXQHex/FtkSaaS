import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {submitProviderApplication} from '../scripts/crm-provider-intake.mjs';
import {providerFormConfigurationSQL} from '../scripts/crm-provider-form-config.mjs';
const request={provider:'meta',external_form_id:'200',external_page_id:'100',external_lead_id:'300',submitted_at:null,is_test:null,attribution:{},intake:{display_name:'Synthetic candidate',phone:'+905550000001',consents:[]}};
const config={id:'019a3d00-0000-7000-8000-000000000001',org_id:'019a3d00-0000-7000-8000-000000000002',center_id:null,channel:'meta',form_key:'synthetic',source_url:'https://example.invalid/form',enabled:true,external_form_id:'200',external_page_id:'100',db_role:'synthetic_receiver'};

test('native provider boundary accepts only a closed normalized delivery and parameterizes the database request',async()=>{
 let calls=0;
 const client={query:async(sql,args)=>{calls++;assert.equal(sql,'select private.crm_provider_submit($1,$2) result');assert.deepEqual(args[0],request);assert.equal(args[1].length,2);assert(args[1].every(id=>/^[a-f0-9-]{14}7/.test(id)));return {rows:[{result:{application_id:config.id,replayed:false}}]};}};
 assert.equal((await submitProviderApplication(client,request)).application_id,config.id);
 for(const broken of [{...request,org_id:config.org_id},{...request,external_page_id:null},{...request,external_lead_id:'../me'},{...request,submitted_at:'now'},{...request,attribution:{access_token:'synthetic-secret'}},{...request,intake:{...request.intake,display_name:2}}])await assert.rejects(submitProviderApplication(client,broken),/PROVIDER_PAYLOAD/);
 assert.equal(calls,1);
});

test('native provider database errors have closed codes and no SQL or credential causes',async()=>{
 for(const [code,message,expected] of [['P0001','FORBIDDEN','FORBIDDEN'],['P0001','IDEMPOTENCY_PAYLOAD_MISMATCH','IDEMPOTENCY_PAYLOAD_MISMATCH'],['XX000','synthetic-sensitive-diagnostic','PROVIDER_PERSISTENCE']])await assert.rejects(submitProviderApplication({query:async()=>{throw Object.assign(Error(message),{code});}},request),error=>error.message===expected&&error.cause===undefined);
});

test('provider setup requires exact routing and receiver identity without accepting credentials or invented scope',()=>{
 const sql=providerFormConfigurationSQL(config);assert(sql.includes('Form mapping is immutable'));assert(sql.includes('ftk_crm_ingress_worker'));assert(sql.includes('on conflict(id) do update set enabled=excluded.enabled'));
 const google=providerFormConfigurationSQL({...config,channel:'google_ads',external_page_id:null});assert(google.includes("'google_ads'"));
 for(const broken of [{...config,access_token:'synthetic-secret'},{...config,db_role:'receiver;select 1'},{...config,source_url:'https://user:secret@example.invalid/'},{...config,channel:'web_form'},{...config,external_page_id:null},{...config,channel:'google_ads'},{...config,channel:'google_ads',external_page_id:null,external_form_id:'9223372036854775808'}])assert.throws(()=>providerFormConfigurationSQL(broken),/PROVIDER_CONFIG/);
 const escaped=providerFormConfigurationSQL({...config,form_key:"Synthetic ' $provider_setup$ value"});assert(escaped.includes("Synthetic '' $provider_setup$ value"));assert(escaped.includes('do $provider_setup_1$'));
});

test('typed CRM source and consent views keep web and provider evidence closed and distinguish unknown test status',()=>{
 const ajv=new Ajv({strict:false});addFormats(ajv);ajv.addSchema(JSON.parse(fs.readFileSync(new URL('../../../packages/api-contracts/schema/contract.json',import.meta.url))),'contract');
 const valid=ajv.getSchema('contract#/$defs/CrmIntakeSource'),view=ajv.getSchema('contract#/$defs/CrmIntakeView');
 const web={channel:'web_form',form_id:config.id,form_key:'synthetic',source_url:config.source_url};assert(valid(web));
 const {provider,intake,...evidence}=request,meta={...web,channel:'meta',...evidence};assert(valid(meta));assert(valid({...meta,channel:'google_ads',external_page_id:null,is_test:true}));
 assert.equal(valid({...web,...evidence}),false);assert.equal(valid({...meta,external_page_id:null}),false);assert.equal(valid({...meta,credential:'not allowed'}),false);
 const consent={purpose:'privacy',accepted:true,version:'synthetic-v1',occurred_at:'2026-01-01T00:00:00Z',source:meta,received_at:'2026-01-01T00:00:01Z'};assert(view({...intake,consents:[consent]}));assert.equal(view({...intake,consents:[{...consent,source:{...meta,is_test:'unknown'}}]}),false);
});
