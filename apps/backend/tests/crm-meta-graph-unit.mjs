import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readMetaLead} from '../transports/crm-meta-graph.mjs';
const config={page_id:'100',form_id:'200',api_version:'v24.0',access_token:'synthetic-page-token',app_secret:'synthetic-app-secret'};
const event={provider:'meta',external_page_id:'100',external_form_id:'200',external_lead_id:'9007199254740993',attribution:{ad_id:'300'}};
const lead={id:event.external_lead_id,form_id:'200',created_time:'2026-11-04T12:30:00+0000',ad_id:'300',platform:'ig',field_data:[{name:'phone_number',values:['+905000000001']},{name:'full_name',values:['Synthetic lead']}],custom_disclaimer_responses:[{checkbox_key:'synthetic-choice',is_checked:'1'}]};
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});

test('Meta Graph reads only the fixed origin and preserves lead answers separately from disclaimer evidence',async()=>{
 const value=await readMetaLead(event,config,{fetchImpl:async(url,options)=>{
  assert.equal(url.origin,'https://graph.facebook.com');assert.equal(url.pathname,'/v24.0/'+event.external_lead_id);assert(!url.href.includes(config.access_token));
  assert.equal(options.headers.authorization,'Bearer '+config.access_token);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert(options.signal instanceof AbortSignal);
  assert(url.searchParams.get('fields').split(',').includes('custom_disclaimer_responses'));assert.match(url.searchParams.get('appsecret_proof'),/^[a-f0-9]{64}$/);assert.equal(url.searchParams.get('appsecret_proof'),createHmac('sha256',config.app_secret).update(config.access_token).digest('hex'));
  return response({...lead,ignored_extension:{arbitrary:true}});
 }});
 assert.equal(value.external_lead_id,event.external_lead_id);assert.equal(value.platform,'ig');assert.equal(value.submitted_at,'2026-11-04T12:30:00.000Z');
 assert.deepEqual(value.field_data,lead.field_data);assert.deepEqual(value.custom_disclaimer_responses,lead.custom_disclaimer_responses);assert(!('intake' in value));assert(!('consents' in value));assert(!JSON.stringify(value).includes(config.access_token));
});

test('Meta Graph rejects mismatched trusted routes and invalid config before sending credentials',async()=>{
 let requests=0;const options={fetchImpl:async()=>{requests++;return response(lead);}};
 for(const broken of [{...event,external_page_id:'101'},{...event,external_form_id:'201'},{...event,external_lead_id:'../me'},{...event,provider:'google_ads'}])await assert.rejects(readMetaLead(broken,config,options),/PROVIDER_AUTH/);
 for(const broken of [{...config,api_version:'https://attacker.invalid'},{...config,access_token:'bad\r\nheader'},{...config,app_secret:''}])await assert.rejects(readMetaLead(event,broken,options),/PROVIDER_CONFIG/);
 assert.equal(requests,0);
});

test('Meta Graph requires exact lead, form and known ad identity in the provider response',async()=>{
 for(const broken of [{...lead,id:'4'},{...lead,form_id:'4'},{...lead,ad_id:'4'},{...lead,id:9007199254740992}])await assert.rejects(readMetaLead(event,config,{fetchImpl:async()=>response(broken)}),/PROVIDER_RESPONSE/);
});

test('Meta Graph validates answer collections and provider time without inventing consent or placement',async()=>{
 for(const broken of [{...lead,field_data:null},{...lead,field_data:[{name:'phone_number',values:[2]}]},{...lead,field_data:[lead.field_data[0],lead.field_data[0]]},{...lead,custom_disclaimer_responses:{}},{...lead,created_time:'yesterday'},...['2026-02-30T12:00:00+0000','2026-04-31T12:00:00Z','2025-02-29T12:00:00+00:00','2026-12-31T23:59:60Z'].map(created_time=>({...lead,created_time}))])await assert.rejects(readMetaLead(event,config,{fetchImpl:async()=>response(broken)}),/PROVIDER_RESPONSE/);
 const {platform,custom_disclaimer_responses,...withoutOptional}=lead;const value=await readMetaLead(event,config,{fetchImpl:async()=>response(withoutOptional)});assert.equal(value.platform,null);assert.deepEqual(value.custom_disclaimer_responses,[]);
});

test('Meta Graph HTTP, redirect and transport failures never expose provider bodies or credential causes',async()=>{
 for(const status of [301,401,403,429,500]){
  await assert.rejects(readMetaLead(event,config,{fetchImpl:async()=>new Response(config.access_token,{status})}),error=>{assert.equal(error.message,[401,403].includes(status)?'PROVIDER_AUTH':'PROVIDER_UNAVAILABLE');assert.equal(error.cause,undefined);assert(!JSON.stringify(error).includes(config.access_token));return true;});
 }
 await assert.rejects(readMetaLead(event,config,{fetchImpl:async()=>{throw Error(config.access_token);}}),error=>error.message==='PROVIDER_UNAVAILABLE'&&error.cause===undefined);
});

test('Meta Graph bounds streamed responses, including bodies with no content length',async()=>{
 let cancelled=false;const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1048577));},cancel(){cancelled=true;}});
 await assert.rejects(readMetaLead(event,config,{fetchImpl:async()=>new Response(stream)}),/PROVIDER_RESPONSE/);assert(cancelled);
 await assert.rejects(readMetaLead(event,config,{fetchImpl:async()=>new Response('{bad json')}),/PROVIDER_RESPONSE/);
});
