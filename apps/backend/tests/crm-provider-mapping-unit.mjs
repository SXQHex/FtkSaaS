import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProviderMapping} from '../transports/crm-provider-mapping.mjs';
import {parseGoogleLead} from '../transports/crm-google-lead.mjs';
const rule={source:'privacy-choice',purpose:'privacy',version:'synthetic-v1',accepted_value:'yes',declined_value:'no',required:true};
const config={fields:{display_name:'full_name',phone:'phone_number'},consents:[rule],consent_key_field:'checkbox_key',consent_value_field:'is_checked'};
const lead={external_page_id:'100',external_form_id:'200',external_lead_id:'300',submitted_at:'2026-01-01T00:00:00.000Z',platform:'ig',attribution:{},field_data:[{name:'full_name',values:['Synthetic lead']},{name:'phone_number',values:['0090 (555) 000-0001']}],custom_disclaimer_responses:[{checkbox_key:'privacy-choice',is_checked:'yes'}]};

test('Meta mapping binds explicit fields, exact checkbox values and provider time without granting Auth or marketing',()=>{
 const mapper=compileProviderMapping('meta',config);config.fields.phone='mutated-after-compile';const result=mapper.map(lead);config.fields.phone='phone_number';
 assert.equal(result.intake.phone,'+905550000001');assert.deepEqual(result.intake.consents,[{purpose:'privacy',version:'synthetic-v1',accepted:true,occurred_at:lead.submitted_at}]);assert.equal(result.is_test,null);assert.equal(result.attribution.platform,'ig');assert(!('person_id' in result));
 const declined=mapper.map({...lead,custom_disclaimer_responses:[{checkbox_key:'privacy-choice',is_checked:'no'}]});assert.equal(declined.intake.consents[0].accepted,false);
});

test('missing, ambiguous or unrecognized consent evidence never becomes a default acceptance or timestamp',()=>{
 const mapper=compileProviderMapping('meta',config);
 for(const broken of [{...lead,submitted_at:null},{...lead,custom_disclaimer_responses:[]},{...lead,custom_disclaimer_responses:[{checkbox_key:'privacy-choice',is_checked:true}]},{...lead,custom_disclaimer_responses:[...lead.custom_disclaimer_responses,...lead.custom_disclaimer_responses]},{...lead,field_data:lead.field_data.map(f=>f.name==='phone_number'?{...f,values:['05550000001']}:f)},{...lead,field_data:lead.field_data.map(f=>f.name==='full_name'?{...f,values:['One','Two']}:f)}])assert.throws(()=>mapper.map(broken),/PROVIDER_MAPPING/);
 const optional=compileProviderMapping('meta',{...config,consents:[{...rule,required:false}]});assert.deepEqual(optional.map({...lead,custom_disclaimer_responses:[]}).intake.consents,[]);
});

test('mapping configuration rejects unknown targets, reused controls and inferred or incomplete consent rules',()=>{
 for(const broken of [{...config,fields:{...config.fields,org_id:'tenant'}},{...config,consents:[{...rule,version:''}]},{...config,consents:[{...rule,declined_value:'yes'}]},{...config,consents:[rule,{...rule,purpose:'marketing'}]},{...config,consents:[{...rule,required:undefined}]}])assert.throws(()=>compileProviderMapping('meta',broken),/PROVIDER_CONFIG/);
});

test('Google consumes only explicitly mapped column IDs while unknown extensions stay ignored',()=>{
 const mapper=compileProviderMapping('google_ads',{fields:{interest:'INTEREST_CUSTOM'},consents:[{...rule,source:'PRIVACY_CUSTOM'}]});
 const body={lead_id:'synthetic-lead',form_id:'200',google_key:'synthetic-key',lead_submit_time:lead.submitted_at,user_column_data:[{column_id:'FULL_NAME',string_value:'Synthetic lead'},{column_id:'PHONE_NUMBER',string_value:'+905550000001'},{column_id:'INTEREST_CUSTOM',string_value:'Synthetic interest'},{column_id:'PRIVACY_CUSTOM',string_value:'no'},{column_id:'UNUSED',string_value:'private unused answer'}]};
 const parsed=parseGoogleLead(JSON.stringify(body),{google_key:body.google_key,form_id:'200'},{extractColumns:mapper.extractColumns}),result=mapper.map(parsed);
 assert.equal(result.intake.interest,'Synthetic interest');assert.equal(result.intake.consents[0].accepted,false);assert.equal(JSON.stringify(result).includes('private unused answer'),false);assert.equal(result.external_page_id,null);
 assert.throws(()=>parseGoogleLead(JSON.stringify({...body,user_column_data:[...body.user_column_data,body.user_column_data[3]]}),{google_key:body.google_key,form_id:'200'},{extractColumns:mapper.extractColumns}),/PROVIDER_PAYLOAD/);
 assert.throws(()=>parseGoogleLead(JSON.stringify({...body,lead_submit_time:'2026-12-31T23:59:60Z'}),{google_key:body.google_key,form_id:'200'}),error=>error.message==='PROVIDER_PAYLOAD');
});
