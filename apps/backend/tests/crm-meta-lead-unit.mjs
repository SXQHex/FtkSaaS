import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {metaWebhookChallenge,parseMetaLeadNotifications} from '../transports/crm-meta-lead.mjs';
const secret='synthetic-meta-app-secret';
const signature=body=>'sha256='+createHmac('sha256',secret).update(body).digest('hex');
const value={leadgen_id:'12345678901234567890',page_id:'100',form_id:'200',ad_id:'300',created_time:1767225600};
const event=values=>({object:'page',entry:[{id:'100',time:1767225601,changes:values.map(value=>({field:'leadgen',value}))}]});
const parse=body=>{const raw=JSON.stringify(body);return parseMetaLeadNotifications(raw,signature(raw),secret);};

test('Meta verification challenge requires exact mode/token and rejects ambiguous parameters',()=>{
 const url='https://example.invalid/meta?hub.mode=subscribe&hub.verify_token=synthetic-token&hub.challenge=001234';
 assert.equal(metaWebhookChallenge(url,'synthetic-token'),'001234');
 for(const input of [url.replace('subscribe','other'),url.replace('synthetic-token','wrong'),url+'&hub.verify_token=synthetic-token',url.replace('001234','not-an-integer')])assert.throws(()=>metaWebhookChallenge(input,'synthetic-token'),/PROVIDER_AUTH/);
 assert.throws(()=>metaWebhookChallenge(url,''),/PROVIDER_CONFIG/);
 assert.throws(()=>metaWebhookChallenge('not a url?hub.verify_token=synthetic-token','synthetic-token'),error=>error.message==='PROVIDER_AUTH'&&!Object.hasOwn(error,'input')&&!JSON.stringify(error).includes('synthetic-token'));
});

test('Meta notification signature covers exact raw bytes before payload parsing',()=>{
 const raw=JSON.stringify(event([value]));assert.equal(parseMetaLeadNotifications(raw,signature(raw),secret).length,1);
 for(const sig of [null,'sha1=abc','sha256=abc',signature(raw)+'0','sha256='+'0'.repeat(64)])assert.throws(()=>parseMetaLeadNotifications(raw,sig,secret),/PROVIDER_AUTH/);
 assert.throws(()=>parseMetaLeadNotifications(raw+' ',signature(raw),secret),/PROVIDER_AUTH/);
 assert.throws(()=>parseMetaLeadNotifications('{',signature(raw),secret),/PROVIDER_AUTH/);
 assert.throws(()=>parseMetaLeadNotifications('{',signature('{'),secret),/PROVIDER_PAYLOAD/);
});

test('Meta Page leadgen batches retain external identity and separate lead/event times without guessing Instagram placement',()=>{
 const result=parse(event([value]))[0];
 assert.deepEqual(result,{provider:'meta',external_page_id:'100',external_form_id:'200',external_lead_id:value.leadgen_id,notification_sent_at:'2026-01-01T00:00:01.000Z',lead_created_at:'2026-01-01T00:00:00.000Z',attribution:{ad_id:'300'}});
 assert.equal(result.org_id,undefined);assert.equal(result.platform,undefined);
 const two=parse(event([value,{...value,leadgen_id:'400'}]));assert.equal(two.length,2);assert.notEqual(two[0].external_lead_id,two[1].external_lead_id);
 const other={...event([value]),org_id:'forged'};other.entry[0].changes.push({field:'feed',value:{personal:'unused',id:-1}});assert.deepEqual(parse(other),[result]);
});

test('Meta large numeric IDs retain exact digits and mismatched Page identity fails closed',()=>{
 const raw=JSON.stringify(event([value])).replace('"leadgen_id":"12345678901234567890"','"leadgen_id":12345678901234567890');
 assert.equal(parseMetaLeadNotifications(raw,signature(raw),secret)[0].external_lead_id,value.leadgen_id);
 for(const patch of [{page_id:'other'},{leadgen_id:'1e20'},{form_id:''},{created_time:-1}])assert.throws(()=>parse(event([{...value,...patch}])),/PROVIDER_PAYLOAD/);
 assert.throws(()=>parse({...event([value]),object:'instagram'}),/PROVIDER_PAYLOAD/);
});

test('Meta optional facts stay absent; duplicate delivery remains visible for durable dedupe instead of false ack',()=>{
 const {ad_id,created_time,...minimal}=value;
 const body=event([minimal,minimal]);delete body.entry[0].time;
 const result=parse(body);assert.equal(result.length,2);assert.deepEqual(result[0],result[1]);assert.equal(result[0].lead_created_at,null);assert.equal(result[0].notification_sent_at,null);assert.deepEqual(result[0].attribution,{});
 assert.equal(JSON.stringify(result).includes(secret),false);
});

test('Meta signed malformed or excessive batches are bounded and sanitized',()=>{
 for(const body of [null,[],{object:'page',entry:{}},event([{...value,form_id:{id:200}}]),event(Array.from({length:1001},()=>value))])assert.throws(()=>parse(body),error=>error.message==='PROVIDER_PAYLOAD');
 const raw='x'.repeat(1048577);assert.throws(()=>parseMetaLeadNotifications(raw,signature(raw),secret),/PROVIDER_PAYLOAD/);
 assert.throws(()=>parseMetaLeadNotifications('{}',signature('{}'),''),/PROVIDER_CONFIG/);
});
