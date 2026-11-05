import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGoogleLead} from '../transports/crm-google-lead.mjs';
const config={google_key:'synthetic-google-key',form_id:'1234'};
const lead={lead_id:'synthetic-lead',form_id:1234,campaign_id:5678,lead_submit_time:'2026-01-01T00:00:00Z',lead_source:'LEAD_FORM',user_column_data:[{column_id:'FULL_NAME',column_name:'ignored label',string_value:'Synthetic lead'},{column_id:'PHONE_NUMBER',string_value:'+905550000001'},{column_id:'EMAIL',string_value:'synthetic@example.invalid'}],google_key:config.google_key};
const read=(patch={},cfg=config)=>parseGoogleLead(JSON.stringify({...lead,...patch}),cfg);

test('Google key and configured form are required before any application fields are returned',()=>{
 assert.equal(read().external_lead_id,lead.lead_id);
 for(const patch of [{google_key:'wrong'},{google_key:''},{google_key:null},{form_id:1235},{lead_id:''}])assert.throws(()=>read(patch),/PROVIDER_(AUTH|PAYLOAD)/);
 for(const cfg of [{...config,google_key:''},{...config,form_id:'bad'},{...config,org_id:'untrusted'},{form_id:'1234'}])assert.throws(()=>read({},cfg),/PROVIDER_CONFIG/);
 const missing={...lead};delete missing.google_key;assert.throws(()=>parseGoogleLead(JSON.stringify(missing),config),/PROVIDER_AUTH/);
});

test('Google identifiers retain all int64 digits without unsafe JavaScript number rounding',()=>{
 const raw=JSON.stringify(lead).replace('"form_id":1234','"form_id":9223372036854775807').replace('"campaign_id":5678','"campaign_id":9007199254740993');
 const result=parseGoogleLead(raw,{...config,form_id:'9223372036854775807'});
 assert.equal(result.external_form_id,'9223372036854775807');assert.equal(result.attribution.campaign_id,'9007199254740993');
 for(const number of ['9223372036854775808','1.5','1e3','-1','0'])assert.throws(()=>parseGoogleLead(JSON.stringify(lead).replace('"form_id":1234','"form_id":'+number),config),/PROVIDER_PAYLOAD/);
 assert.equal(read({form_id:'1234'}).external_form_id,'1234');
});

test('only documented column IDs map to intake; extra user data and claimed routing never grant scope',()=>{
 const result=read({org_id:'forged',source:'meta',form_key:'forged',new_optional_field:{form_id:-1,campaign_id:1.5},user_column_data:[...lead.user_column_data,{column_id:'POSTAL_CODE',string_value:'private unused'},{column_id:'UNKNOWN_FUTURE',unrecognized_value:['ignored']}]});
 assert.deepEqual(result.intake,{display_name:'Synthetic lead',phone:'+905550000001',email:'synthetic@example.invalid',consents:[]});
 assert.equal(result.provider,'google_ads');assert.equal(result.external_form_id,'1234');assert.equal(result.org_id,undefined);assert.equal(JSON.stringify(result).includes(config.google_key),false);assert.equal(JSON.stringify(result).includes('private unused'),false);
 const byLabel=lead.user_column_data.map(({column_id,...entry})=>entry);assert.throws(()=>read({user_column_data:byLabel}),/PROVIDER_PAYLOAD/);
});

test('ambiguous consumed fields, invalid phone and malformed personal fields fail closed',()=>{
 const fields=lead.user_column_data;
 for(const user_column_data of [[...fields,{column_id:'PHONE_NUMBER',string_value:'+905550000002'}],fields.filter(x=>x.column_id!=='PHONE_NUMBER'),fields.map(x=>x.column_id==='PHONE_NUMBER'?{...x,string_value:'05550000001'}:x),fields.map(x=>x.column_id==='FULL_NAME'?{...x,string_value:' '}:x),fields.map(x=>x.column_id==='EMAIL'?{...x,string_value:'not-an-email'}:x)])assert.throws(()=>read({user_column_data}),/PROVIDER_PAYLOAD/);
 const missingFull=fields.filter(x=>x.column_id!=='FULL_NAME').concat([{column_id:'FIRST_NAME',string_value:'Synthetic'},{column_id:'LAST_NAME',string_value:'Lead'}]);assert.equal(read({user_column_data:missingFull}).intake.display_name,'Synthetic Lead');
});

test('provider time remains optional evidence and test leads stay distinct from production leads',()=>{
 assert.equal(read().submitted_at,'2026-01-01T00:00:00.000Z');assert.equal(read({is_test:true}).is_test,true);assert.equal(read().is_test,false);
 const old={...lead};delete old.lead_submit_time;delete old.lead_source;const result=parseGoogleLead(JSON.stringify(old),config);assert.equal(result.submitted_at,null);assert.equal(result.lead_source,null);assert.deepEqual(result.intake.consents,[]);
 for(const patch of [{lead_submit_time:'invalid'},{lead_submit_time:'2026-02-30T12:00:00Z'},{is_test:'true'},{lead_source:'CONVERSATIONAL_AGENT'}])assert.throws(()=>read(patch),/PROVIDER_PAYLOAD/);
});

test('reordered delivery remains stable; changed lead identity remains distinct; secret/raw failures are sanitized',()=>{
 const first=read(),second=read({user_column_data:[...lead.user_column_data].reverse()});assert.deepEqual(second,first);
 assert.notEqual(read({lead_id:'second-real-lead'}).external_lead_id,first.external_lead_id);
 for(const raw of ['{','null','[]','x'.repeat(65537)])assert.throws(()=>parseGoogleLead(raw,config),error=>/^PROVIDER_PAYLOAD$/.test(error.message)&&!error.message.includes(config.google_key));
});
