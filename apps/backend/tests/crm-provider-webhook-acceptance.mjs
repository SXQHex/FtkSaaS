import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {must} from './api-client.mjs';
import {providerFixture} from './crm-provider-fixture.mjs';
import {createMetaWebhookHandler,createGoogleWebhookHandler} from '../transports/crm-provider-webhook.mjs';

test('provider HTTP acknowledgement follows native commit, batch retries converge and live scope revocation blocks Graph',{timeout:300000},async t=>{
 const {db,org,owner,center,role,metaForm,meta,google,client,count}=await providerFixture(t);
 const rule={source:'privacy',purpose:'privacy',version:'synthetic-v1',accepted_value:'yes',declined_value:'no',required:true};
 const mapping={fields:{display_name:'full_name',phone:'phone_number'},consents:[rule,{...rule,source:'marketing',purpose:'marketing'}],consent_key_field:'checkbox_key',consent_value_field:'is_checked'};
 const config={app_secret:'synthetic-app-secret',verify_token:'synthetic-verify',routes:[{page_id:meta.external_page_id,form_id:meta.external_form_id,api_version:'v24.0',access_token:'synthetic-page-token',mapping}]};
 const ids=[meta.external_lead_id,meta.external_lead_id+'1'];let transient=true,reads=0;
 const handler=createMetaWebhookHandler(config,{client,fetchImpl:async url=>{
  reads++;const id=url.pathname.split('/').at(-1);if(id===ids[1]&&transient)return new Response('Synthetic temporary provider failure',{status:500});
  return Response.json({id,form_id:meta.external_form_id,ad_id:meta.attribution.ad_id,created_time:meta.submitted_at,platform:'ig',field_data:[{name:'full_name',values:['Synthetic HTTP lead']},{name:'phone_number',values:[meta.intake.phone]}],custom_disclaimer_responses:[{checkbox_key:'privacy',is_checked:'yes'},{checkbox_key:'marketing',is_checked:'no'}]});
 }});
 const body=JSON.stringify({object:'page',entry:[{id:meta.external_page_id,changes:ids.map(id=>({field:'leadgen',value:{page_id:meta.external_page_id,form_id:meta.external_form_id,leadgen_id:id,ad_id:meta.attribution.ad_id}}))}]}),signature=createHmac('sha256',config.app_secret).update(body).digest('hex');
 const send=()=>handler(new Request('https://example.invalid/meta',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+signature},body}));
 assert.equal((await send()).status,503);assert.equal(await count(),1);
 transient=false;const retry=await send();assert.equal(retry.status,200);assert.deepEqual(await retry.json(),{});assert.equal(await count(),2);assert.equal(reads,4);
 assert.equal((await send()).status,200);assert.equal(await count(),2);
 const googleConfig={google_key:'synthetic-google-key',form_id:google.external_form_id,mapping:{fields:{},consents:[{...rule,source:'PRIVACY_ANSWER'},{...rule,source:'MARKETING_ANSWER',purpose:'marketing'}]}};
 const googleHandler=createGoogleWebhookHandler(googleConfig,{client}),googleBody=JSON.stringify({google_key:googleConfig.google_key,form_id:google.external_form_id,lead_id:google.external_lead_id,is_test:true,lead_submit_time:meta.submitted_at,user_column_data:[{column_id:'FULL_NAME',string_value:'Synthetic Google HTTP lead'},{column_id:'PHONE_NUMBER',string_value:google.intake.phone},{column_id:'PRIVACY_ANSWER',string_value:'yes'},{column_id:'MARKETING_ANSWER',string_value:'no'}]});
 const googleRequest=()=>new Request('https://example.invalid/google',{method:'POST',headers:{'content-type':'application/json'},body:googleBody});
 assert.equal((await googleHandler(googleRequest())).status,200);assert.equal((await googleHandler(googleRequest())).status,200);assert.equal(await count(),3);
 const inbox=await must(owner,'management_state_get_v1',{org_id:org,center_id:center,operation:'public_application_review_v1',selector:{operation:'public_application_review_v1',key:{}},page:{limit:100}});assert.equal(inbox.items.length,3);
 for(const item of inbox.items){assert.equal(item.current.values.intake.consents.length,2);assert.equal(item.current.values.intake.consents[1].accepted,false);assert(['meta','google_ads'].includes(item.current.values.source.channel));}
 const before=reads;await db.query('delete from private.crm_provider_receiver_scopes where db_role=$1 and form_id=$2',[role,metaForm]);assert.equal((await send()).status,503);assert.equal(reads,before);assert.equal(await count(),3);
 for(const who of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'private.crm_provider_authorize(text,text,text)','EXECUTE') allowed",[who])).rows[0].allowed,false);
});
